/**
 * Path Utilities
 * Common path operations and helpers
 */

import { join, resolve, relative, dirname } from "path"
import { homedir } from "os"
import { existsSync } from "fs"
import { fileURLToPath } from "url"

/**
 * Get the Kiro data directory path
 * First tries the plugin's bundled data directory, then falls back to user config
 */
export function getKiroDataDir(): string {
  // Try plugin's bundled data directory first
  const pluginDataDir = getPluginDataDir()
  if (existsSync(pluginDataDir)) {
    return pluginDataDir
  }

  // Fallback to user config directory
  return join(homedir(), ".config", "opencode", "kiro")
}

/**
 * Get the plugin's bundled data directory
 */
export function getPluginDataDir(): string {
  // Get the directory where this file is located
  const currentFile = fileURLToPath(import.meta.url)
  const srcDir = dirname(currentFile) // shared directory
  const pluginRoot = resolve(srcDir, "../..") // plugins/kiro
  return join(pluginRoot, "data")
}

/**
 * Get the user config directory for Kiro
 */
export function getUserConfigDir(): string {
  return join(homedir(), ".config", "opencode", "kiro")
}

/**
 * Resolve a path relative to a base directory
 */
export function resolvePath(base: string, ...paths: string[]): string {
  return resolve(base, ...paths)
}

/**
 * Join path segments
 */
export function joinPaths(...paths: string[]): string {
  return join(...paths)
}

/**
 * Get relative path from base to target
 */
export function getRelativePath(from: string, to: string): string {
  return relative(from, to)
}

/**
 * Normalize path separators
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/")
}
