/**
 * Kiro Plugin Configuration Types
 */

import type { BuiltinCommandName } from "../features/builtin-commands/types"

/** Fixed spec path (not configurable) */
export const SPEC_PATH = ".kiro/specs"

/** Default coding model */
export const DEFAULT_AGENT_MODEL = "zai-coding-plan/glm-5"

/**
 * Kiro Plugin Configuration
 * Note: Many values are fixed (spec_path, debug) and not configurable
 */
export interface KiroPluginConfig {
  /** List of tools to disable (fixed, not user configurable) */
  disabled_tools: string[]

  /** List of builtin commands to disable (fixed, not user configurable) */
  disabled_commands: BuiltinCommandName[]

  /** Coding agent model (fixed, not user configurable) */
  agent_model: string

  /** Multimodal model (the only user-configurable value) */
  multimodal: string
}

/** Default configuration values */
export const DEFAULT_CONFIG: KiroPluginConfig = {
  disabled_tools: [],
  disabled_commands: [],
  agent_model: DEFAULT_AGENT_MODEL,
  multimodal: DEFAULT_AGENT_MODEL,
}

/**
 * Merge user config with defaults
 */
export function mergeConfig(userConfig: Partial<KiroPluginConfig>): KiroPluginConfig {
  const base = {
    ...DEFAULT_CONFIG,
    ...userConfig,
  }

  return {
    ...base,
    multimodal: userConfig.multimodal ?? base.agent_model,
  }
}
