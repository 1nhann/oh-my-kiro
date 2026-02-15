/**
 * Look At Tool
 * Analyzes images and PDFs using a sub-session
 */

import { basename } from "path"
import { pathToFileURL } from "url"
import { existsSync } from "fs"
import type { PluginInput } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { inferMimeTypeFromFilePath } from "./mime"
import { createMultimodalLookerAgent } from "../../agents/multimodal-looker"
import { extractLatestAssistantText } from "./assistant-message-extractor"

const z = tool.schema

export function createLookAtTool(ctx: PluginInput) {
  return tool({
    description: "Analyze media files (images, PDFs) using a specialized multimodal agent. Extracts text, descriptions, or data.",
    args: {
      file_path: z.string().describe("Absolute path to the file to analyze"),
      goal: z.string().describe("What specific information to extract from the file"),
    },
    execute: async (args, toolContext) => {
      const filePath = args.file_path as string
      const goal = args.goal as string

      if (!filePath.startsWith("/")) {
        return "Error: file_path must be an absolute path."
      }
      if (!existsSync(filePath)) {
        return `Error: File not found: ${filePath}`
      }

      const mimeType = inferMimeTypeFromFilePath(filePath)

      if (mimeType === "application/octet-stream") {
        return "Error: Unsupported file type. Only PNG, JPEG, GIF, WEBP, and PDF are supported."
      }

      const filePart: { type: "file"; mime: string; url: string; filename: string } = {
        type: "file",
        mime: mimeType,
        url: pathToFileURL(filePath).href,
        filename: basename(filePath),
      }

      const agentConfig = createMultimodalLookerAgent()
      const prompt = `Goal: ${goal}\n\n${agentConfig.prompt}`
      const parentSession = await ctx.client.session.get({
        path: { id: toolContext.sessionID },
      }).catch(() => null)
      const parentDirectory = parentSession?.data?.directory ?? ctx.directory

      const sessionRes = await ctx.client.session.create({
        body: {
          parentID: toolContext.sessionID,
          title: `look_at: ${goal.substring(0, 50)}`,
        },
        query: {
          directory: parentDirectory,
        },
      })

      if (sessionRes.error) {
        return `Error creating session: ${sessionRes.error}`
      }

      const sessionID = sessionRes.data.id

      try {
        await ctx.client.session.prompt({
          path: { id: sessionID },
          body: {
            agent: "multimodal-looker",
            parts: [{ type: "text", text: prompt }, filePart],
            model: { providerID: "google", modelID: agentConfig.model },
          },
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return `Error sending multimodal prompt: ${msg}`
      }

      const timeoutMs = 60_000
      const pollMs = 1_000
      const start = Date.now()

      while (Date.now() - start < timeoutMs) {
        if (toolContext.abort?.aborted) {
          return "Error: lookAt request was aborted."
        }

        const statusRes = await ctx.client.session.status().catch(() => null)
        const status = statusRes?.data?.[sessionID]
        if (status && status.type !== "idle") {
          await new Promise((r) => setTimeout(r, pollMs))
          continue
        }

        const messagesRes = await ctx.client.session.messages({
          path: { id: sessionID },
        })
        if (messagesRes.error) {
          await new Promise((r) => setTimeout(r, pollMs))
          continue
        }

        const responseText = extractLatestAssistantText(messagesRes.data)
        if (responseText) {
          return responseText
        }
        await new Promise((r) => setTimeout(r, pollMs))
      }

      return "Error: Timeout waiting for multimodal agent response."
    }
  })
}
