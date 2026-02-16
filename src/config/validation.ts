import type { KiroPluginConfig } from "./types"

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === "string"
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
    if (key === "multimodal") {
      if (!isString(value)) warnings.push(`Invalid key skipped: ${key}`)
      if (isString(value)) config.multimodal = value
      return
    }
    warnings.push(`Unknown key skipped: ${key}`)
  })

  return { config, warnings }
}
