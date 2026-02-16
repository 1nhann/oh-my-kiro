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
  pluginConfig: KiroPluginConfig,
<<<<<<< HEAD
<<<<<<< HEAD
  onMessage?: (sessionID: string, message: string) => void,
=======
  onMessage?: (sessionID: string, message: string) => void
>>>>>>> 0309c112f (已按“先修可运行性，再修配置生效”的方向把 `kiro` 做了一轮实改，重点是把之前容易失效/崩溃的链路先补齐。)
=======
  onMessage?: (sessionID: string, message: string) => void,
>>>>>>> a41390a2f (已继续完善并收敛了一轮，主要补了这 4 个文件：)
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

<<<<<<< HEAD
    // Handle user messages
    if (onMessage && messageText) {
      onMessage(input.sessionID, messageText)
    }

=======
>>>>>>> a41390a2f (已继续完善并收敛了一轮，主要补了这 4 个文件：)
    // Handle user messages
    if (onMessage && messageText) {
      onMessage(input.sessionID, messageText)
    }

    // Handle user messages
    // Example: Detect keywords to activate spec workflow
    if (messageText.includes("create spec") && pluginConfig.features?.requirements_first) {
      if (pluginConfig.debug) {
        console.log("[KiroHook] Detected spec creation request in session:", input.sessionID)
      }
    }

    // Detect ultrawork mode trigger
    const ultraworkKeywords = ["ulw", "ultrawork", "ultraworking", "parallel"]
    const lowerMessage = messageText.toLowerCase()
    for (const keyword of ultraworkKeywords) {
      if (lowerMessage.includes(keyword)) {
        if (pluginConfig.debug) {
          console.log("[KiroHook] Ultrawork mode triggered by keyword:", keyword)
        }
        break
      }
    }

    // Future enhancements:
    // - Detect requirements gathering keywords
    // - Trigger spec generation workflow
    // - Handle spec-related commands
  }

  return handler
}
