import { basename } from "node:path"
import { pathToFileURL } from "node:url"
import { tool, type PluginInput, type ToolDefinition } from "@opencode-ai/plugin"
import { LOOK_AT_DESCRIPTION, MULTIMODAL_LOOKER_AGENT } from "./constants"
import type { LookAtArgs } from "./types"
import type { KiroPluginConfig } from "../../config/types"
import { log } from "../../shared/logger"
import { extractLatestAssistantText } from "./assistant-message-extractor"
import type { LookAtArgsWithAlias } from "./look-at-arguments"
import { normalizeArgs, validateArgs } from "./look-at-arguments"
import {
  extractBase64Data,
  inferMimeTypeFromBase64,
  inferMimeTypeFromFilePath,
} from "./mime-type-inference"

export { normalizeArgs, validateArgs } from "./look-at-arguments"

export function createLookAtTool(
  ctx: PluginInput,
  pluginConfig?: KiroPluginConfig,
): ToolDefinition {
  return tool({
    description: LOOK_AT_DESCRIPTION,
    args: {
      file_path: tool.schema.string().optional().describe("Absolute path to the file to analyze"),
      image_data: tool.schema.string().optional().describe("Base64 encoded image data (for clipboard/pasted images)"),
      goal: tool.schema.string().describe("What specific information to extract from the file"),
    },
    async execute(rawArgs: LookAtArgs, toolContext) {
      const args = normalizeArgs(rawArgs as LookAtArgsWithAlias)
      const validationError = validateArgs(args)
      if (validationError) {
        log(`[look_at] Validation failed: ${validationError}`)
        return validationError
      }

      const isBase64Input = Boolean(args.image_data)
      const sourceDescription = isBase64Input ? "clipboard/pasted image" : args.file_path
      log(`[look_at] Analyzing ${sourceDescription}, goal: ${args.goal}`)
      log("[look_at] Input summary", {
        mode: isBase64Input ? "image_data" : "file_path",
        goalLength: args.goal.length,
        hasSessionID: Boolean(toolContext.sessionID),
        workingDirectory: toolContext.directory ?? ctx.directory,
      })

      const imageData = args.image_data
      const filePath = args.file_path

      let mimeType: string
      let filePart: { type: "file"; mime: string; url: string; filename: string }

      if (imageData) {
        mimeType = inferMimeTypeFromBase64(imageData)
        filePart = {
          type: "file",
          mime: mimeType,
          url: `data:${mimeType};base64,${extractBase64Data(imageData)}`,
          filename: `clipboard-image.${mimeType.split("/")[1] || "png"}`,
        }
        log("[look_at] Prepared image_data file part", {
          mimeType,
          filename: filePart.filename,
          rawLength: imageData.length,
        })
      } else if (filePath) {
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
        return "Error: Must provide either 'file_path' or 'image_data'."
      }

      const prompt = `Analyze this ${isBase64Input ? "image" : "file"} and extract the requested information.

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
      // 1. multimodal from config
      // 2. if malformed, don't specify model (let OpenCode decide)
      const configModel = pluginConfig?.multimodal
      let agentModel: { providerID: string; modelID: string } | undefined
      if (configModel) {
        const [providerID, ...modelParts] = configModel.split("/")
        if (providerID && modelParts.length > 0) {
          const modelID = modelParts.join("/")
          agentModel = { providerID, modelID }
          log(`[look_at] Using multimodal config model: ${providerID}/${modelID}`)
        }
      }
      // If malformed, agentModel stays undefined - let OpenCode decide

      log(`[look_at] Sending prompt with ${isBase64Input ? "base64 image" : "file"} to session ${sessionID}`)
      log("[look_at] Prompt config", {
        agent: MULTIMODAL_LOOKER_AGENT,
        sessionID,
        parentSessionID: toolContext.sessionID,
        model: agentModel ? `${agentModel.providerID}/${agentModel.modelID}` : "auto",
        disabledTools: ["task", "lookAt", "read"],
        mimeType: filePart.mime,
      })
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

      log(`[look_at] Got response, length: ${responseText.length}`)
      return responseText
    },
  })
}
