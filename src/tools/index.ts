/**
 * Tools Module - Main Export
 * Exports all tool categories and creates the unified tool creation function
 */

import type { PluginInput } from "@opencode-ai/plugin"
import type { KiroPluginConfig } from "../config"
import type { ToolDef } from "../plugin/types"
import { createBackgroundTaskManager } from "../background"

// Import all tool creators
import {
  createInvokeSubAgentTool,
  createPreworkTool,
  createKiroSpecTaskStatusTool,
  createUpdatePBTStatusTool,
} from "./kiro-specific"

import {
  createAstGrepSearchTool,
  createAstGrepReplaceTool,
} from "./ast-grep"

import { createLookAtTool } from "./look-at"

import { createBackgroundTools } from "./background-tools"

import { createLSPTools } from "./lsp-tools"

// Re-export all tool creators
export * from "./kiro-specific"
export * from "./look-at"
export * from "./background-tools"
export { createAstGrepSearchTool, createAstGrepReplaceTool } from "./ast-grep"
export { createLSPTools, createGetDiagnosticsTool, createRenameSymbolTool } from "./lsp-tools/tools"

/**
 * Managers container for sharing state across tools
 */
export interface ToolManagers {
  backgroundTaskManager: ReturnType<typeof createBackgroundTaskManager>
}

/**
 * Create tool managers
 */
function createManagers(ctx: PluginInput): ToolManagers {
  // Use the client from the plugin context
  const backgroundTaskManager = createBackgroundTaskManager(ctx.client)

  return {
    backgroundTaskManager,
  }
}

/**
 * Tool name to factory function mapping (basic tools)
 */
const basicToolFactories: Record<string, (ctx: PluginInput) => ToolDef> = {
  // Kiro-specific tools
  invokeSubAgent: createInvokeSubAgentTool,
  prework: createPreworkTool,
  kiroSpecTaskStatus: createKiroSpecTaskStatusTool,
  updatePBTStatus: createUpdatePBTStatusTool,

  // AST-grep tools
  astGrepSearch: createAstGrepSearchTool,
  astGrepReplace: createAstGrepReplaceTool,

  // Look-at tool
  lookAt: createLookAtTool,
}

/**
 * Create all tools from built-in definitions and managers
 */
export function createTools(args: {
  ctx: PluginInput
  pluginConfig: KiroPluginConfig
}) {
  const { ctx, pluginConfig } = args
  const tools: Record<string, ToolDef> = {}

  // Get list of disabled tools from config
  const disabledTools = new Set(pluginConfig.disabled_tools || [])

  // Create managers for tools that need shared state
  const managers = createManagers(ctx)

  // Register basic tools from built-in factories
  for (const [name, factory] of Object.entries(basicToolFactories)) {
    if (!disabledTools.has(name)) {
      tools[name] = factory(ctx)
    }
  }

  if (pluginConfig.backgroundTasks?.enabled !== false) {
    const backgroundTools = createBackgroundTools(managers.backgroundTaskManager)
    for (const [name, tool] of Object.entries(backgroundTools)) {
      if (!disabledTools.has(name)) {
        tools[name] = tool
      }
    }
  }

  if (pluginConfig.lsp?.enabled !== false) {
    const lspTools = createLSPTools(ctx)
    for (const [name, tool] of Object.entries(lspTools)) {
      if (!disabledTools.has(name)) {
        tools[name] = tool
      }
    }
  }

  // Log registered tools in debug mode
  if (pluginConfig.debug) {
    console.log(`[Kiro] Registered ${Object.keys(tools).length} tools:`, Object.keys(tools).join(", "))
    if (disabledTools.size > 0) {
      console.log(`[Kiro] Disabled tools:`, Array.from(disabledTools).join(", "))
    }
  }

  return {
    tools,
    managers,
  }
}

/**
 * Get tool managers for external access
 */
export function getToolManagers(args: {
  ctx: PluginInput
  pluginConfig: KiroPluginConfig
}): ToolManagers {
  const { ctx } = args
  return createManagers(ctx)
}
