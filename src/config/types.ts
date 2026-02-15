/**
 * Kiro Plugin Configuration Types
 */

import type { FallbackChainConfig } from "../model-fallback/types"
import { DEFAULT_FALLBACK_CONFIG } from "../model-fallback/types"
import type { BuiltinCommandName } from "../features/builtin-commands/types"

/**
 * Context recovery configuration
 */
export interface ContextRecoveryConfig {
  /** Enable automatic context recovery */
  enabled: boolean
  /** Maximum context window size before triggering recovery */
  maxTokens: number
  /** Recovery strategy */
  strategy: "truncate" | "summarize" | "hybrid"
  /** Number of messages to keep at the start */
  keepHead: number
  /** Number of messages to keep at the end */
  keepTail: number
}

/**
 * Background task configuration
 */
export interface BackgroundTaskConfig {
  /** Enable background task support */
  enabled: boolean
  /** Maximum concurrent background tasks */
  maxConcurrent: number
  /** Task timeout in milliseconds */
  timeout: number
  /** Cleanup interval for completed tasks */
  cleanupInterval: number
}

/**
 * LSP configuration
 */
export interface LSPConfig {
  /** Enable LSP tools */
  enabled: boolean
  /** Languages to enable LSP for */
  languages: string[]
}

/**
 * Kiro Plugin Configuration
 */
export interface KiroPluginConfig {
  /** List of tools to disable */
  disabled_tools?: string[]

  /** List of builtin commands to disable */
  disabled_commands?: BuiltinCommandName[]

  /** Path to specification files */
  spec_path?: string

  /** Agent model to use */
  agent_model?: string

  /** Enable debug mode */
  debug?: boolean

  /** Feature flags */
  features?: {
    /** Enable requirements-first workflow */
    requirements_first?: boolean

    /** Enable specification execution */
    spec_execution?: boolean
  }

  /** Context recovery configuration */
  contextRecovery?: Partial<ContextRecoveryConfig>

  /** Background task configuration */
  backgroundTasks?: Partial<BackgroundTaskConfig>

  /** LSP configuration */
  lsp?: Partial<LSPConfig>

  /** Model fallback chain configuration */
  modelFallback?: Partial<FallbackChainConfig>
}

/** Default context recovery configuration */
export const DEFAULT_CONTEXT_RECOVERY_CONFIG: ContextRecoveryConfig = {
  enabled: true,
  maxTokens: 180000,
  strategy: "hybrid",
  keepHead: 3,
  keepTail: 10,
}

/** Default background task configuration */
export const DEFAULT_BACKGROUND_TASK_CONFIG: BackgroundTaskConfig = {
  enabled: true,
  maxConcurrent: 5,
  timeout: 600000, // 10 minutes
  cleanupInterval: 3600000, // 1 hour
}

/** Default LSP configuration */
export const DEFAULT_LSP_CONFIG: LSPConfig = {
  enabled: true,
  languages: ["typescript", "javascript", "python", "go", "rust"],
}

/** Default configuration values */
export const DEFAULT_CONFIG: KiroPluginConfig = {
  disabled_tools: [],
  spec_path: ".kiro/specs",
  debug: false,
  features: {
    requirements_first: true,
    spec_execution: true,
  },
  contextRecovery: DEFAULT_CONTEXT_RECOVERY_CONFIG,
  backgroundTasks: DEFAULT_BACKGROUND_TASK_CONFIG,
  lsp: DEFAULT_LSP_CONFIG,
  modelFallback: DEFAULT_FALLBACK_CONFIG,
}

/**
 * Merge user config with defaults
 */
export function mergeConfig(userConfig: Partial<KiroPluginConfig>): KiroPluginConfig {
  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
    features: {
      ...DEFAULT_CONFIG.features,
      ...userConfig.features,
    },
    contextRecovery: {
      ...DEFAULT_CONTEXT_RECOVERY_CONFIG,
      ...userConfig.contextRecovery,
    },
    backgroundTasks: {
      ...DEFAULT_BACKGROUND_TASK_CONFIG,
      ...userConfig.backgroundTasks,
    },
    lsp: {
      ...DEFAULT_LSP_CONFIG,
      ...userConfig.lsp,
    },
    modelFallback: {
      ...DEFAULT_FALLBACK_CONFIG,
      ...userConfig.modelFallback,
    },
  }
}
