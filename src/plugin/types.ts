/**
 * Plugin Core Types
 */

import type { PluginInput } from "@opencode-ai/plugin"

export interface ToolDef<
  Args = unknown,
  Result = unknown,
  Ctx = unknown,
> {
  description: string
  args?: Record<string, unknown>
  parameters?: Record<string, unknown>
  execute: unknown
}

/**
 * Tool factory function type
 */
export type ToolFactory = (ctx: PluginInput) => ToolDef

/**
 * Tool category for organization
 */
export type ToolCategory = 
  | "bash"
  | "file-operations"
  | "kiro-specific"
  | "web"
  | "diagnostics"

/**
 * Tool metadata for registration
 */
export interface ToolMetadata {
  name: string
  category: ToolCategory
  factory: ToolFactory
  enabled?: boolean
}
