import { mkdtempSync, mkdirSync, writeFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { describe, expect, test } from "bun:test"
import type { PluginInput } from "@opencode-ai/plugin"
import { loadPluginConfig } from "./loader"

function ctx() {
  return {} as PluginInput
}

function configDir() {
  const root = mkdtempSync(join(tmpdir(), "kiro-config-"))
  const dir = join(root, ".kiro", "settings")
  mkdirSync(dir, { recursive: true })
  return { root, file: join(dir, "kiro.json") }
}

describe("loadPluginConfig", () => {
  test("parses jsonc with comments and trailing commas", () => {
    const path = configDir()
    writeFileSync(
      path.file,
      `{
        // comments should be supported
        "debug": true,
        "backgroundTasks": {
          "enabled": false,
        },
      }`,
      "utf-8",
    )

    const config = loadPluginConfig(path.root, ctx())
    expect(config.debug).toBe(true)
    expect(config.backgroundTasks?.enabled).toBe(false)
  })

  test("keeps valid keys when some sections are invalid", () => {
    const path = configDir()
    writeFileSync(
      path.file,
      `{
        "agent_model": "demo-model",
        "lsp": { "enabled": "nope" }
      }`,
      "utf-8",
    )

    const config = loadPluginConfig(path.root, ctx())
    expect(config.agent_model).toBe("demo-model")
  })
})

