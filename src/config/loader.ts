/**
 * Configuration Loader
 * Handles loading and merging plugin configuration from multiple sources
 *
 * Configuration priority (highest to lowest):
 * 1. Environment variables
 * 2. Project-level config (.kiro/settings/kiro.json, .kiro/kiro.json)
 * 3. User-level config (~/.config/opencode/kiro/settings/kiro.json)
 * 4. Default configuration
 */

import { existsSync, readFileSync } from "fs"
import { join } from "path"
import { homedir } from "os"
import type { PluginInput } from "@opencode-ai/plugin"
import { mergeConfig, type KiroPluginConfig } from "./types"
import { parseConfig, parseJsonc } from "./validation"

/**
 * Project-level configuration file paths (in order of priority)
 */
const PROJECT_CONFIG_PATHS = [
  ".kiro/settings/kiro.json",
  ".kiro/kiro.json",
  ".kiro/config.json",
]

/**
 * User-level configuration file paths (in order of priority)
 */
const USER_CONFIG_PATHS = [
  join(homedir(), ".config", "opencode", "kiro", "settings", "kiro.json"),
  join(homedir(), ".config", "opencode", "kiro", "kiro.json"),
  join(homedir(), ".config", "opencode", "kiro", "config.json"),
]

/**
 * Try to load configuration from a file path
 */
function loadConfigFromFile(filePath: string): Partial<KiroPluginConfig> | null {
  if (!existsSync(filePath)) {
    return null
  }

  const content = readFileSync(filePath, "utf-8")
  const raw = parseJsonc(content)
  if (!raw) {
    console.warn(`[KiroConfig] Failed to parse ${filePath}`)
    return null
  }

  const parsed = parseConfig(raw)
  if (parsed.warnings.length > 0) {
    console.warn(`[KiroConfig] Partial config loaded from ${filePath}: ${parsed.warnings.join("; ")}`)
  } else {
    console.log(`[KiroConfig] Loaded configuration from ${filePath}`)
  }
  return parsed.config
}

/**
 * Try to load configuration from a list of paths (returns first found)
 */
function loadConfigFromPaths(paths: string[]): Partial<KiroPluginConfig> | null {
  for (const configPath of paths) {
    const config = loadConfigFromFile(configPath)
    if (config) {
      return config
    }
  }
  return null
}

/**
 * Load user-level configuration
 */
function loadUserConfig(): Partial<KiroPluginConfig> {
  return loadConfigFromPaths(USER_CONFIG_PATHS) || {}
}

/**
 * Load project-level configuration
 */
function loadProjectConfig(directory: string): Partial<KiroPluginConfig> {
  const fullPaths = PROJECT_CONFIG_PATHS.map(p => join(directory, p))
  return loadConfigFromPaths(fullPaths) || {}
}

/**
 * Apply environment variable overrides
 */
function applyEnvOverrides(config: Partial<KiroPluginConfig>): Partial<KiroPluginConfig> {
  const result = { ...config }

  if (process.env.KIRO_DEBUG === "true") {
    result.debug = true
  }

  if (process.env.KIRO_AGENT_MODEL) {
    result.agent_model = process.env.KIRO_AGENT_MODEL
  }

  if (process.env.KIRO_BACKGROUND_TASKS === "false") {
    result.backgroundTasks = { ...result.backgroundTasks, enabled: false }
  }

  if (process.env.KIRO_MAX_CONTEXT_TOKENS) {
    const maxTokens = parseInt(process.env.KIRO_MAX_CONTEXT_TOKENS, 10)
    if (!isNaN(maxTokens)) {
      result.contextRecovery = { ...result.contextRecovery, maxTokens }
    }
  }

  return result
}

/**
 * Load plugin configuration with defaults
 *
 * Merges configuration from multiple sources in priority order:
 * 1. Environment variables (highest priority)
 * 2. Project-level config files
 * 3. User-level config files
 * 4. Default configuration (lowest priority)
 *
 * @param directory - Project working directory
 * @param ctx - Plugin input context (can be used for additional context)
 * @returns Merged configuration
 */
export function loadPluginConfig(
  directory: string,
  _ctx: PluginInput,
): KiroPluginConfig {
  // Load from all sources
  const userConfig = loadUserConfig()
  const projectConfig = loadProjectConfig(directory)

  // Merge: user < project (project overrides user)
  let mergedConfig: Partial<KiroPluginConfig> = {
    ...userConfig,
    ...projectConfig,
  }

  // Apply environment variable overrides (highest priority)
  mergedConfig = applyEnvOverrides(mergedConfig)

  // Merge with defaults
  const finalConfig = mergeConfig(mergedConfig)

  // Log configuration in debug mode
  if (finalConfig.debug) {
    console.log("[KiroConfig] Final configuration:", JSON.stringify(finalConfig, null, 2))
  }

  return finalConfig
}
