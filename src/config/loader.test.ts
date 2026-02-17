import { mkdtempSync, mkdirSync, writeFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { describe, expect, test } from "bun:test"
import type { PluginInput } from "@opencode-ai/plugin"
import { loadPluginConfig } from "./loader"

function ctx() {
  return {} as PluginInput
}

function configDir(root: string) {
  const dir = join(root, ".config", "opencode", "kiro")
  mkdirSync(dir, { recursive: true })
  return { root, file: join(dir, "kiro.json") }
}

function withHome(run: (file: string) => void) {
  const original = process.env.HOME
  const root = mkdtempSync(join(tmpdir(), "kiro-config-"))
  const path = configDir(root)
  process.env.HOME = path.root
  try {
    run(path.file)
  } finally {
    process.env.HOME = original
  }
}

describe("loadPluginConfig", () => {
  test("falls back to coding agent model when config file is missing", () => {
    withHome(() => {
      const config = loadPluginConfig("", ctx())
      expect(config.multimodal).toBe(config.agent_model)
    })
  })

  test("falls back to coding agent model when multimodal is not set", () => {
    withHome((file) => {
      writeFileSync(file, `{}`, "utf-8")
      const config = loadPluginConfig("", ctx())
      expect(config.multimodal).toBe(config.agent_model)
    })
  })

  test("parses jsonc with comments and trailing commas", () => {
    withHome((file) => {
      writeFileSync(
        file,
        `{
        // comments should be supported
        "multimodal": "openai/gpt-4.1-mini",
      }`,
        "utf-8",
      )

      const config = loadPluginConfig("", ctx())
      expect(config.multimodal).toBe("openai/gpt-4.1-mini")
    })
  })

  test("ignores unsupported keys from kiro.json", () => {
    withHome((file) => {
      writeFileSync(
        file,
        `{
        "multimodal": "openai/gpt-5.3-codex",
        "agent_model": "demo-model",
        "disabled_tools": ["astGrepReplace"],
        "modelFallback": { "multimodal": ["openai/gpt-4.1-mini"] },
        "unknown_key": "should be ignored"
      }`,
        "utf-8",
      )

      const config = loadPluginConfig("", ctx())
      expect(config.multimodal).toBe("openai/gpt-5.3-codex")
      expect(config.agent_model).toBe("openai/gpt-5.3-codex")
      expect(config.disabled_tools).toEqual([])
    })
  })
})
