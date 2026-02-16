import { describe, expect, test } from "bun:test"
import { loadAgentPrompt } from "./loader"

describe("loadAgentPrompt", () => {
  test("hydrates runtime date/system/model blocks", () => {
    const prompt = loadAgentPrompt("orchestrator", "demo-model")
    expect(prompt).not.toBeNull()
    expect(prompt).toContain("Name: demo-model")
    expect(prompt).toContain(`Platform: ${process.platform}`)
    expect(prompt).not.toContain("Date: February 13, 2026")
  })

  test("returns null for unknown agent", () => {
    expect(loadAgentPrompt("not-found")).toBeNull()
  })
})

