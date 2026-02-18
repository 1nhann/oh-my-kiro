import { basename } from "path"
import { pathToFileURL } from "url"
import { tool, type PluginInput, type ToolDefinition } from "@opencode-ai/plugin"
import { LOOK_AT_DESCRIPTION, MULTIMODAL_LOOKER_AGENT } from "./constants"
import type { LookAtArgs } from "./types"
import type { KiroPluginConfig } from "../../config/types"
import { log } from "../../shared/logger"
import { extractLatestAssistantText } from "./assistant-message-extractor"
import type { LookAtArgsWithAlias } from "./look-at-arguments"
import { normalizeArgs, validateArgs } from "./look-at-arguments"
import { inferMimeTypeFromFilePath } from "./mime-type-inference"
import { getClipboardFilesQueueManager } from "../../clipboard-files-queue"

export { normalizeArgs, validateArgs } from "./look-at-arguments"

export function createLookAtTool(
  ctx: PluginInput,
  pluginConfig?: KiroPluginConfig,
): ToolDefinition {
  return tool({
    description: LOOK_AT_DESCRIPTION,
    args: {
      file_path: tool.schema.string().optional().describe("Absolute path to the file to analyze"),
      goal: tool.schema.string().describe("What specific information to extract from the file"),
      index: tool.schema.number().optional().describe("Index into clipboard files queue: -1 = most recent, -2 = second recent, 0 = oldest"),
    },
    async execute(rawArgs: LookAtArgs, toolContext) {
      const args = normalizeArgs(rawArgs as LookAtArgsWithAlias)
      const validationError = validateArgs(args)
      if (validationError) {
        log(`[look_at] Validation failed: ${validationError}`)
        return validationError
      }

      const filePath = args.file_path
      const stackIndex = args.index

      // Determine input mode
      const isStackInput = stackIndex !== undefined
      const isFileInput = Boolean(filePath)

      // Count input sources
      const inputSourceCount = [isStackInput, isFileInput].filter(Boolean).length
      if (inputSourceCount === 0) {
        return "Error: Must provide one of: 'file_path' or 'index'."
      }
      if (inputSourceCount > 1) {
        return "Error: Provide only one input source (file_path or index)."
      }

      let sourceDescription: string
      log("[look_at] Input summary", {
        mode: isStackInput ? "clipboard_queue" : "file_path",
        goalLength: args.goal.length,
        hasSessionID: Boolean(toolContext.sessionID),
        workingDirectory: toolContext.directory ?? ctx.directory,
        stackIndex,
      })

      let mimeType: string
      let filePart: { type: "file"; mime: string; url: string; filename: string }

      if (isStackInput) {
        // Handle clipboard files queue input (session isolation)
        const queueManager = getClipboardFilesQueueManager()
        await queueManager.initialize()

        // Only get files for current session (session isolation)
        const sessionFiles = queueManager.getBySession(toolContext.sessionID)
        if (sessionFiles.length === 0) {
          return "Error: No files in the clipboard queue for this session. Paste a file first, then use lookAt with index=-1."
        }

        // Convert negative index to positive
        // -1 = last (most recent) -> index 0 in queue (since queue is most recent first)
        // -2 = second last -> index 1
        // 0 = oldest -> index length-1
        let actualIndex: number
        if (stackIndex! < 0) {
          // Negative: -1 = most recent (index 0), -2 = second recent (index 1)
          actualIndex = Math.abs(stackIndex!) - 1
        } else {
          // Positive: 0 = oldest, 1 = second oldest
          // Convert to queue index (which is 0 = most recent)
          actualIndex = sessionFiles.length - 1 - stackIndex!
        }

        const savedFile = sessionFiles[actualIndex]
        if (!savedFile) {
          return `Error: No file at index ${stackIndex} in queue. Queue has ${sessionFiles.length} files. Valid range: -${sessionFiles.length} to ${sessionFiles.length - 1}.`
        }

        sourceDescription = `clipboard queue[${stackIndex}]: ${savedFile.filename}`
        mimeType = savedFile.mime
        filePart = {
          type: "file",
          mime: mimeType,
          url: pathToFileURL(savedFile.path).href,
          filename: savedFile.filename,
        }
        log("[look_at] Prepared clipboard_queue file part", {
          id: savedFile.id,
          filename: savedFile.filename,
          path: savedFile.path,
          mimeType,
          size: savedFile.size,
          requestedIndex: stackIndex,
          actualIndex,
          sessionID: toolContext.sessionID,
        })
      } else if (filePath) {
        sourceDescription = filePath
        const file = Bun.file(filePath)
        const exists = await file.exists()
        const size = exists ? file.size : 0
        mimeType = inferMimeTypeFromFilePath(filePath)
        filePart = {
          type: "file",
          mime: mimeType,
          url: pathToFileURL(filePath).href,
          filename: basename(filePath),
        }
        log("[look_at] Prepared file_path file part", {
          filePath,
          exists,
          size,
          mimeType,
          filename: filePart.filename,
          urlPrefix: filePart.url.slice(0, 64),
        })
      } else {
        return "Error: No valid input source provided."
      }

      log(`[look_at] Analyzing ${sourceDescription}, goal: ${args.goal}`)

      const inputType = isStackInput ? "image from clipboard queue" : "file"
      const prompt = `Analyze this ${inputType} and extract the requested information.

Goal: ${args.goal}

Provide ONLY the extracted information that matches the goal.
Be thorough on what was requested, concise on everything else.
If the requested information is not found, clearly state what is missing.`

      log(`[look_at] Creating session with parent: ${toolContext.sessionID}`)
      const parentSession = await ctx.client.session.get({
        path: { id: toolContext.sessionID },
      }).catch(() => null)
      const parentDirectory = parentSession?.data?.directory ?? ctx.directory
      log("[look_at] Session parent context", {
        parentSessionID: toolContext.sessionID,
        parentDirectory,
        hasParentSession: Boolean(parentSession?.data),
      })

      const createResult = await ctx.client.session.create({
        body: {
          parentID: toolContext.sessionID,
          title: `look_at: ${args.goal.substring(0, 50)}`,
        },
        query: { directory: parentDirectory },
      })

      if (createResult.error) {
        log(`[look_at] Session create error:`, createResult.error)
        const errorStr = String(createResult.error)
        if (errorStr.toLowerCase().includes("unauthorized")) {
          return `Error: Failed to create session (Unauthorized). This may be due to:
1. OAuth token restrictions (e.g., Claude Code credentials are restricted to Claude Code only)
2. Provider authentication issues
3. Session permission inheritance problems

Try using a different provider or API key authentication.

Original error: ${createResult.error}`
        }
        return `Error: Failed to create session: ${createResult.error}`
      }

      const sessionID = createResult.data.id
      log(`[look_at] Created session: ${sessionID}`)

      // Model selection:
      // 1. lookAt.model from config
      // 2. if malformed, don't specify model (let OpenCode decide)
      const configModel = pluginConfig?.lookAt?.model
      let agentModel: { providerID: string; modelID: string } | undefined
      if (configModel) {
        const [providerID, ...modelParts] = configModel.split("/")
        if (providerID && modelParts.length > 0) {
          const modelID = modelParts.join("/")
          agentModel = { providerID, modelID }
          log(`[look_at] Using lookAt.model config: ${providerID}/${modelID}`)
        }
      }
      // If malformed, agentModel stays undefined - let OpenCode decide

      try {
        await ctx.client.session.prompt({
          path: { id: sessionID },
          body: {
            agent: MULTIMODAL_LOOKER_AGENT,
            tools: {
              task: false,
              lookAt: false,
              read: false,
            },
            parts: [
              { type: "text", text: prompt },
              filePart,
            ],
            ...(agentModel ? { model: { providerID: agentModel.providerID, modelID: agentModel.modelID } } : {}),
          },
        })
      } catch (promptError) {
        log(`[look_at] Prompt error (ignored, will still fetch messages):`, promptError)
        log("[look_at] Prompt error summary", {
          name: promptError instanceof Error ? promptError.name : undefined,
          message: promptError instanceof Error ? promptError.message : String(promptError),
        })
      }

      log(`[look_at] Fetching messages from session ${sessionID}...`)

      const messagesResult = await ctx.client.session.messages({
        path: { id: sessionID },
      })

      if (messagesResult.error) {
        log(`[look_at] Messages error:`, messagesResult.error)
        return `Error: Failed to get messages: ${messagesResult.error}`
      }

      const messages = messagesResult.data
      log(`[look_at] Got ${messages.length} messages`)
      log("[look_at] Messages summary", Array.isArray(messages)
        ? messages.slice(-3).map((msg) => ({
            role: (msg as { info?: { role?: string } })?.info?.role ?? "unknown",
            parts: Array.isArray((msg as { parts?: unknown[] })?.parts) ? (msg as { parts?: unknown[] }).parts?.length ?? 0 : 0,
          }))
        : []
      )

      const responseText = extractLatestAssistantText(messages)
      if (!responseText) {
        log("[look_at] No assistant message found")
        log("[look_at] No assistant message context", {
          messageCount: Array.isArray(messages) ? messages.length : 0,
          roles: Array.isArray(messages) ? messages.map((msg) => (msg as { info?: { role?: string } })?.info?.role ?? "unknown") : [],
        })
        return "Error: No response from multimodal-looker agent"
      }

      return responseText
    },
  })
}
