/**
 * Kiro Plugin - Main Entry Point
 * A modular AI agent plugin for code development workflows
 *
 * Features:
 * - Background task execution with parallel subagents
 * - Event-driven notification (like OpenCode PR #13261)
 * - Context window recovery
 * - LSP tools integration
 * - /spec command for spec-driven development (registered as OpenCode command)
 * - Clipboard files queue for pasted images
 */

import type { Plugin, ToolDefinition } from "@opencode-ai/plugin"
import type { Config } from "@opencode-ai/sdk"

// Import modularized components
import { loadPluginConfig } from "./config"
import { createTools } from "./tools"
import { createKiroAgent, createKiroSubagents } from "./agents/kiro"
import { createMultimodalLookerAgent } from "./agents/multimodal-looker"
import { loadBuiltinCommands } from "./features/builtin-commands"
import { createHooks } from "./hooks"

/**
 * Kiro Plugin Definition
 */
const KiroPlugin: Plugin = async (ctx) => {
  // 1. Load configuration
  const pluginConfig = loadPluginConfig(ctx.directory, ctx)

  // 2. Check if lookAt feature is enabled
  const lookAtEnabled = pluginConfig.lookAt?.enable !== false

  // 3. Create tools (with managers)
  const { tools, managers } = createTools({
    ctx,
    pluginConfig,
  })

  // 4. Load builtin commands (e.g., /spec)
  const builtinCommands = loadBuiltinCommands(pluginConfig.disabled_commands)

  // 5. Create hooks (chat.message for clipboard files queue, event for session.status)
  const hooks = createHooks({
    ctx,
    pluginConfig,
    taskManager: managers.backgroundTaskManager,
  })

  return {
    tool: tools as Record<string, ToolDefinition>,
    config: async (input: Config) => {
      // Use model from OpenCode config for prompt hydration, fallback to plugin config default
      const modelForPrompt = input.model || pluginConfig.agent_model

      // Inject kiro agent (no model field - respects OpenCode's model selection)
      const kiroAgent = createKiroAgent(modelForPrompt, lookAtEnabled)
      if (kiroAgent) {
        input.agent = input.agent || {}

        // Cast to any because of potential type mismatch with strict SDK types
        // In runtime, this should work as Config merges agent definitions
        input.agent["kiro"] = kiroAgent as any
        for (const [name, agent] of Object.entries(createKiroSubagents(modelForPrompt, lookAtEnabled))) {
          input.agent[name] = agent as any
        }

        // Only register multimodal-looker agent if lookAt is enabled
        if (lookAtEnabled) {
          // Only set model if user explicitly configured lookAt.model
          const multimodalModel = pluginConfig.lookAt?.model
          input.agent["multimodal-looker"] = createMultimodalLookerAgent(multimodalModel) as any
        }
      }

      // Inject builtin commands into OpenCode's command system
      // This makes /spec appear in the TUI command list (ctrl+p)
      input.command = input.command || {}
      for (const [name, cmd] of Object.entries(builtinCommands)) {
        input.command[name] = cmd as any
      }
    },
    // Register chat.message hook for clipboard files queue
    "chat.message": hooks["chat.message"],
    // Register event hook for session.status (flushes pending notifications)
    event: hooks.event,
  }
}

export default KiroPlugin
