import { describe, expect, test } from "bun:test"
import { AGENT_PROMPTS, getPrompt } from "./index"

describe("prompt registry", () => {
  test("contains expected prompt keys", () => {
    expect(Object.keys(AGENT_PROMPTS)).toEqual([
      "orchestrator",
      "requirements-first-workflow",
      "spec-task-execution",
      "context-gatherer",
      "kiroExplore",
      "general-task-execution",
      "multimodal-looker",
    ])
  })

  test("maps kiro alias to orchestrator prompt", () => {
    expect(getPrompt("kiro")).toBe(AGENT_PROMPTS.orchestrator)
  })
})
