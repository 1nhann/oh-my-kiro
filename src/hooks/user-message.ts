/**
 * User Message Hook
 * Handles user message events via chat.message hook
 */

import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import type { KiroPluginConfig } from "../config"

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
    // Extract message text from parts or message content
    let messageText = ""

    // Try to get text from parts first (OpenCode message structure)
    if (output.parts && Array.isArray(output.parts)) {
      for (const part of output.parts) {
        if (part.type === "text" && part.text) {
          messageText += part.text
        }
      }
    }

    // Handle user messages
    if (onMessage && messageText) {
      onMessage(input.sessionID, messageText)
    }
  }

  return handler
}
