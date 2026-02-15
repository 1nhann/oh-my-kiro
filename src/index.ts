/**
 * Kiro Plugin - Main Entry Point
 * A modular AI agent plugin for code development workflows
 *
 * Features:
 * - Background task execution with parallel subagents
 * - Context window recovery
 * - Model fallback chain for resilience
 * - LSP tools integration
 * - /spec command for spec-driven development (registered as OpenCode command)
 */

import type { Plugin, ToolDefinition } from "@opencode-ai/plugin"
import type { Config } from "@opencode-ai/sdk"

// Import modularized components
import { loadPluginConfig } from "./config"
import { createTools } from "./tools"
import { createKiroAgent } from "./agents/kiro"
import { loadBuiltinCommands } from "./features/builtin-commands"

/**
 * Kiro Plugin Definition
 */
const KiroPlugin: Plugin = async (ctx) => {
  console.log("[KiroPlugin] Loading plugin...")

  // 1. Load configuration
  const pluginConfig = loadPluginConfig(ctx.directory, ctx)

  // 2. Create tools (with managers)
  const { tools } = createTools({
    ctx,
    pluginConfig,
  })

  // 3. Load builtin commands (e.g., /spec)
  const builtinCommands = loadBuiltinCommands(pluginConfig.disabled_commands)

  // Log loaded features
  const features = [
    "Background tasks",
    "Context recovery",
    "Model fallback",
    "LSP tools",
    `/spec command (${Object.keys(builtinCommands).length} builtin)`,
  ]
  console.log(`[KiroPlugin] Features: ${features.join(", ")}`)
  console.log(`[KiroPlugin] Loaded ${Object.keys(tools).length} tools`)
  console.log("[KiroPlugin] Loaded successfully.")

  return {
    tool: tools as Record<string, ToolDefinition>,
    config: async (input: Config) => {
      // Inject kiro agent
      const kiroAgent = createKiroAgent(pluginConfig.agent_model)
      if (kiroAgent) {
        input.agent = input.agent || {}
        // Cast to any because of potential type mismatch with strict SDK types
        // In runtime, this should work as Config merges agent definitions
        input.agent["kiro"] = kiroAgent as any
      }

      // Inject builtin commands into OpenCode's command system
      // This makes /spec appear in the TUI command list (ctrl+p)
      input.command = input.command || {}
      for (const [name, cmd] of Object.entries(builtinCommands)) {
        input.command[name] = cmd as any
      }
    },
  }
}

export default KiroPlugin
