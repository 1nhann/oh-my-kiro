/**
 * Hooks Module
 * Exports all plugin hooks and manages hook configuration
 */

import type { PluginInput } from "@opencode-ai/plugin"
import type { KiroPluginConfig } from "../config"
import { createUserMessageHook } from "./user-message"

/**
 * Create all plugin hooks
 */
export function createHooks(args: {
  ctx: PluginInput
  pluginConfig: KiroPluginConfig
}) {
  const { ctx, pluginConfig } = args

  // Create hook instances
  const userMessageHook = createUserMessageHook(ctx, pluginConfig)

  return {
    // User message hook - using official OpenCode hook name
    "chat.message": userMessageHook,
  }
}

// Export individual hooks
export { createUserMessageHook } from "./user-message"
