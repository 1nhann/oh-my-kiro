/**
 * Hooks Module
 * Exports all plugin hooks and manages hook configuration
 */

import type { PluginInput } from "@opencode-ai/plugin"
import type { KiroPluginConfig } from "../config"
import type { BackgroundTaskManager } from "../background/types"
import { createUserMessageHook } from "./user-message"
import { createSessionEventHook } from "./session-event"

/**
 * Create all plugin hooks
 */
export function createHooks(args: {
  ctx: PluginInput
  pluginConfig: KiroPluginConfig
  taskManager: BackgroundTaskManager
}) {
  const { ctx, pluginConfig, taskManager } = args

  // Create hook instances
  const userMessageHook = createUserMessageHook(ctx, pluginConfig)
  const sessionEventHook = createSessionEventHook(ctx, pluginConfig, taskManager)

  return {
    // User message hook - using official OpenCode hook name
    "chat.message": userMessageHook,
    // Event hook for session.status events
    event: sessionEventHook,
  }
}

// Export individual hooks
export { createUserMessageHook } from "./user-message"
export { createSessionEventHook } from "./session-event"
