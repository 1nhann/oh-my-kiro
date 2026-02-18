/**
 * User Message Hook
 * Handles user message events via chat.message hook
 *
 * Features:
 * 1. Extract text from user messages
 * 2. Save pasted files to the clipboard files queue for later processing
 *    (always enabled, independent of lookAt feature)
 */

import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import type { KiroPluginConfig } from "../config"
import { getClipboardFilesQueueManager } from "../clipboard-files-queue"
import { log } from "../shared/logger"

/**
 * File part structure from OpenCode messages
 */
interface FilePart {
  type: "file"
  mime: string
  url: string
  filename?: string
}

/**
 * Check if a part is an image file part
 */
function isImageFilePart(part: unknown): part is FilePart {
  if (!part || typeof part !== "object") return false
  const p = part as Record<string, unknown>
  return p.type === "file" && typeof p.mime === "string" && p.mime.startsWith("image/")
}

/**
 * Create user message hook handler
 * Uses the official chat.message hook from OpenCode plugin API
 */
export function createUserMessageHook(
  _ctx: PluginInput,
  _pluginConfig: KiroPluginConfig,
  onMessage?: (sessionID: string, message: string) => void,
) {
  const handler: NonNullable<Hooks["chat.message"]> = async (input, output) => {
    try {
      // Extract message text from parts or message content
      let messageText = ""

      // Try to get text from parts first (OpenCode message structure)
      if (output.parts && Array.isArray(output.parts)) {
        for (const part of output.parts) {
          if (part.type === "text" && "text" in part && typeof part.text === "string") {
            messageText += part.text
          }
        }

        // Extract and save image parts to clipboard files queue
        // ALWAYS save clipboard files regardless of lookAt enable status
        // This ensures files are available when lookAt is later enabled
        try {
          const queueManager = getClipboardFilesQueueManager()

          for (const part of output.parts) {
            if (isImageFilePart(part)) {
              try {
                // The url can be a data URL or file path
                const imageUrl = part.url

                // Only process data URLs (clipboard images)
                // Skip if url is empty or not a string
                if (typeof imageUrl === "string" && imageUrl.startsWith("data:image/")) {
                  const savedFile = await queueManager.addFile(imageUrl, input.sessionID)
                  log(`[chat.message] Saved pasted file to queue: ${savedFile.id}, filename: ${savedFile.filename}`)
                }
              } catch (error) {
                // Log error but don't fail the whole hook
                log(`[chat.message] Failed to save file to queue: ${error}`)
              }
            }
          }
        } catch (error) {
          // Failed to get queue manager or initialize - log and continue
          log(`[chat.message] Failed to access clipboard files queue: ${error}`)
        }
      }

      // Handle user messages
      if (onMessage && messageText) {
        try {
          onMessage(input.sessionID ?? "", messageText)
        } catch (error) {
          log(`[chat.message] Error in onMessage callback: ${error}`)
        }
      }
    } catch (error) {
      // Catch-all to prevent hook errors from crashing
      log(`[chat.message] Hook error: ${error}`)
    }
  }

  return handler
}
