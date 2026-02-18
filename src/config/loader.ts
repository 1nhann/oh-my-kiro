/**
 * Configuration Loader
 * Handles loading and merging plugin configuration from a single source
 *
 * Configuration priority (highest to lowest):
 * 1. User-level config (~/.config/opencode/kiro/kiro.json)
 * 2. Default configuration
 */

import { existsSync, readFileSync } from "fs"
import { homedir } from "os"
import type { PluginInput } from "@opencode-ai/plugin"
import { mergeConfig, type KiroPluginConfig } from "./types"
import { parseConfig, parseJsonc } from "./validation"

function configPath() {
  return `${process.env.HOME || homedir()}/.config/opencode/kiro/kiro.json`
}

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

function loadUserConfig(): Partial<KiroPluginConfig> {
  return loadConfigFromFile(configPath()) || {}
}

/**
 * Load plugin configuration with defaults
 *
 * Merges configuration from user config and defaults:
 * 1. User-level config file (highest priority)
 * 2. Default configuration (lowest priority)
 *
 * @param ctx - Plugin input context (can be used for additional context)
 * @returns Merged configuration
 */
export function loadPluginConfig(
  _directory: string,
  _ctx: PluginInput,
): KiroPluginConfig {
  const userConfig = loadUserConfig()
  const finalConfig = mergeConfig(userConfig)

  // Log configuration if KIRO_DEBUG is set
  if (process.env.KIRO_DEBUG === "true") {
    console.log("[KiroConfig] Final configuration:", JSON.stringify(finalConfig, null, 2))
  }

  return finalConfig
}
