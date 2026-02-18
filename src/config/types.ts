/**
 * Kiro Plugin Configuration Types
 */

import type { BuiltinCommandName } from "../features/builtin-commands/types"

/** Fixed spec path (not configurable) */
export const SPEC_PATH = ".kiro/specs"

/** Default coding model (fallback when OpenCode config doesn't specify a model) */
export const DEFAULT_AGENT_MODEL = "openai/gpt-5.3-codex"

/**
 * LookAt feature configuration
 */
export interface LookAtConfig {
  /** Enable or disable the lookAt tool and multimodal-looker agent */
  enable: boolean
  /** Model to use for multimodal analysis (defaults to current OpenCode model if not specified) */
  model?: string
}

/**
 * Kiro Plugin Configuration
 * Note: Many values are fixed (spec_path, debug) and not configurable
 */
export interface KiroPluginConfig {
  /** List of tools to disable (fixed, not user configurable) */
  disabled_tools: string[]

  /** List of builtin commands to disable (fixed, not user configurable) */
  disabled_commands: BuiltinCommandName[]

  /**
   * Coding agent model (fallback only)
   * This is used when OpenCode's config doesn't specify a model.
   * The actual model is read from OpenCode's config.model at runtime.
   */
  agent_model: string

  /** LookAt feature configuration (image/PDF analysis) */
  lookAt: LookAtConfig

  /** @deprecated Use lookAt.model instead */
  multimodal?: string
}

/** Default configuration values */
export const DEFAULT_CONFIG: KiroPluginConfig = {
  disabled_tools: [],
  disabled_commands: [],
  agent_model: DEFAULT_AGENT_MODEL,
  lookAt: {
    enable: false,
    model: undefined, // Will default to agent_model
  },
}

/**
 * Merge user config with defaults
 */
export function mergeConfig(userConfig: Partial<KiroPluginConfig>): KiroPluginConfig {
  const base = {
    ...DEFAULT_CONFIG,
    ...userConfig,
  }

  // Handle lookAt config with defaults
  const lookAt: LookAtConfig = {
    enable: userConfig.lookAt?.enable ?? false,
    // Default model to agent_model if not specified
    model: userConfig.lookAt?.model ?? base.agent_model,
  }

  return {
    ...base,
    lookAt,
  }
}
