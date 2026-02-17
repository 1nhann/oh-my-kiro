import type { KiroPluginConfig, LookAtConfig } from "./types"

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean"
}

function stripJsonc(text: string) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:\\])\/\/.*$/gm, "$1")
    .replace(/,\s*([}\]])/g, "$1")
}

export function parseJsonc(text: string): unknown | null {
  try {
    return JSON.parse(text)
  } catch {
  }

  try {
    return JSON.parse(stripJsonc(text))
  } catch {
    return null
  }
}

/**
 * Parse lookAt configuration from raw config object
 */
function parseLookAtConfig(value: unknown): { config: Partial<LookAtConfig>; warnings: string[] } {
  const config: Partial<LookAtConfig> = {}
  const warnings: string[] = []

  if (!isObject(value)) {
    warnings.push("lookAt config must be an object")
    return { config, warnings }
  }

  if ("enable" in value) {
    if (isBoolean(value.enable)) {
      config.enable = value.enable
    } else {
      warnings.push("lookAt.enable must be a boolean")
    }
  }

  if ("model" in value) {
    if (isString(value.model)) {
      config.model = value.model
    } else {
      warnings.push("lookAt.model must be a string")
    }
  }

  return { config, warnings }
}

export function parseConfig(raw: unknown): { config: Partial<KiroPluginConfig>; warnings: string[] } {
  if (!isObject(raw)) {
    return { config: {}, warnings: ["Config root must be a JSON object"] }
  }

  const config: Partial<KiroPluginConfig> = {}
  const warnings: string[] = []

  Object.entries(raw).forEach(([key, value]) => {
    if (key === "lookAt") {
      const parsed = parseLookAtConfig(value)
      if (Object.keys(parsed.config).length > 0) {
        // Store as Partial<LookAtConfig> - defaults will be filled in mergeConfig
        config.lookAt = parsed.config as LookAtConfig
      }
      warnings.push(...parsed.warnings)
      return
    }
    if (key === "multimodal") {
      // Deprecated: migrate to lookAt.model
      if (!isString(value)) {
        warnings.push("multimodal must be a string")
        return
      }
      // Convert deprecated multimodal to lookAt.model
      // Note: enable defaults to true in mergeConfig
      config.lookAt = { enable: true, model: value }
      warnings.push("'multimodal' is deprecated, use 'lookAt.model' instead")
      return
    }
    warnings.push(`Unknown key skipped: ${key}`)
  })

  return { config, warnings }
}
