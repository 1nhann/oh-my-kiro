import type { KiroPluginConfig } from "./types"

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean"
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString)
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value)
}

function isPositiveInteger(value: unknown): value is number {
  return isInteger(value) && value > 0
}

function isNonNegativeInteger(value: unknown): value is number {
  return isInteger(value) && value >= 0
}

function parseFeatures(value: unknown): KiroPluginConfig["features"] | null {
  if (!isObject(value)) return null
  const keys = Object.keys(value)
  if (!keys.every((x) => x === "requirements_first" || x === "spec_execution")) return null
  if (value.requirements_first !== undefined && !isBoolean(value.requirements_first)) return null
  if (value.spec_execution !== undefined && !isBoolean(value.spec_execution)) return null
  return value
}

function parseContextRecovery(value: unknown): KiroPluginConfig["contextRecovery"] | null {
  if (!isObject(value)) return null
  const keys = Object.keys(value)
  if (!keys.every((x) => ["enabled", "maxTokens", "strategy", "keepHead", "keepTail"].includes(x))) return null
  if (value.enabled !== undefined && !isBoolean(value.enabled)) return null
  if (value.maxTokens !== undefined && !isPositiveInteger(value.maxTokens)) return null
  if (value.strategy !== undefined && !["truncate", "summarize", "hybrid"].includes(String(value.strategy))) return null
  if (value.keepHead !== undefined && !isNonNegativeInteger(value.keepHead)) return null
  if (value.keepTail !== undefined && !isNonNegativeInteger(value.keepTail)) return null
  return value
}

function parseBackgroundTasks(value: unknown): KiroPluginConfig["backgroundTasks"] | null {
  if (!isObject(value)) return null
  const keys = Object.keys(value)
  if (!keys.every((x) => ["enabled", "maxConcurrent", "timeout", "cleanupInterval"].includes(x))) return null
  if (value.enabled !== undefined && !isBoolean(value.enabled)) return null
  if (value.maxConcurrent !== undefined && !isPositiveInteger(value.maxConcurrent)) return null
  if (value.timeout !== undefined && !isPositiveInteger(value.timeout)) return null
  if (value.cleanupInterval !== undefined && !isPositiveInteger(value.cleanupInterval)) return null
  return value
}

function parseLsp(value: unknown): KiroPluginConfig["lsp"] | null {
  if (!isObject(value)) return null
  const keys = Object.keys(value)
  if (!keys.every((x) => x === "enabled" || x === "languages")) return null
  if (value.enabled !== undefined && !isBoolean(value.enabled)) return null
  if (value.languages !== undefined && !isStringArray(value.languages)) return null
  return value
}

function parseModelFallback(value: unknown): KiroPluginConfig["modelFallback"] | null {
  if (!isObject(value)) return null
  return value
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

export function parseConfig(raw: unknown): { config: Partial<KiroPluginConfig>; warnings: string[] } {
  if (!isObject(raw)) {
    return { config: {}, warnings: ["Config root must be a JSON object"] }
  }

  const config: Partial<KiroPluginConfig> = {}
  const warnings: string[] = []

  Object.entries(raw).forEach(([key, value]) => {
    if (key === "disabled_tools") {
      if (!isStringArray(value)) warnings.push(`Invalid key skipped: ${key}`)
      if (isStringArray(value)) config.disabled_tools = value
      return
    }
    if (key === "spec_path") {
      if (!isString(value)) warnings.push(`Invalid key skipped: ${key}`)
      if (isString(value)) config.spec_path = value
      return
    }
    if (key === "agent_model") {
      if (!isString(value)) warnings.push(`Invalid key skipped: ${key}`)
      if (isString(value)) config.agent_model = value
      return
    }
    if (key === "debug") {
      if (!isBoolean(value)) warnings.push(`Invalid key skipped: ${key}`)
      if (isBoolean(value)) config.debug = value
      return
    }
    if (key === "features") {
      const parsed = parseFeatures(value)
      if (!parsed) warnings.push(`Invalid key skipped: ${key}`)
      if (parsed) config.features = parsed
      return
    }
    if (key === "contextRecovery") {
      const parsed = parseContextRecovery(value)
      if (!parsed) warnings.push(`Invalid key skipped: ${key}`)
      if (parsed) config.contextRecovery = parsed
      return
    }
    if (key === "backgroundTasks") {
      const parsed = parseBackgroundTasks(value)
      if (!parsed) warnings.push(`Invalid key skipped: ${key}`)
      if (parsed) config.backgroundTasks = parsed
      return
    }
    if (key === "lsp") {
      const parsed = parseLsp(value)
      if (!parsed) warnings.push(`Invalid key skipped: ${key}`)
      if (parsed) config.lsp = parsed
      return
    }
    if (key === "modelFallback") {
      const parsed = parseModelFallback(value)
      if (!parsed) warnings.push(`Invalid key skipped: ${key}`)
      if (parsed) config.modelFallback = parsed
      return
    }
    warnings.push(`Unknown key skipped: ${key}`)
  })

  return { config, warnings }
}
