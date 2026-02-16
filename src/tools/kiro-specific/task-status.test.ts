import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { describe, expect, test } from "bun:test"
import type { PluginInput } from "@opencode-ai/plugin"
import { createKiroSpecTaskStatusTool, createUpdatePBTStatusTool } from "./task-status"

function makeCtx(worktree: string) {
  return { worktree } as unknown as PluginInput
}

function run(tool: unknown, args: Record<string, unknown>) {
  return (tool as { execute: (args: Record<string, unknown>) => Promise<unknown> }).execute(args)
}

function makeTasksFile(root: string, content: string) {
  const dir = join(root, ".kiro", "specs", "demo")
  mkdirSync(dir, { recursive: true })
  const path = join(dir, "tasks.md")
  writeFileSync(path, content, "utf-8")
  return {
    rel: ".kiro/specs/demo/tasks.md",
    abs: path,
  }
}

describe("task-status tools", () => {
  test("taskStatus updates by numeric id prefix", async () => {
    const root = mkdtempSync(join(tmpdir(), "kiro-task-status-"))
    const file = makeTasksFile(
      root,
      [
        "# Tasks",
        "- [ ] 1.1 Setup project",
        "- [ ] 1.2 Build API",
      ].join("\n"),
    )
    const tool = createKiroSpecTaskStatusTool(makeCtx(root))
    const out = await run(tool, {
      taskFilePath: file.rel,
      task: "1.2",
      status: "in_progress",
    })

    expect(String(out)).toContain("updated")
    const next = readFileSync(file.abs, "utf-8")
    expect(next).toContain("- [-] 1.2 Build API")
  })

  test("taskStatus returns ambiguity error for fuzzy query", async () => {
    const root = mkdtempSync(join(tmpdir(), "kiro-task-status-"))
    const file = makeTasksFile(
      root,
      [
        "# Tasks",
        "- [ ] 1.1 Build API",
        "- [ ] 1.2 Build worker API",
      ].join("\n"),
    )
    const tool = createKiroSpecTaskStatusTool(makeCtx(root))
    const out = await run(tool, {
      taskFilePath: file.rel,
      task: "Build",
      status: "completed",
    })

    expect(String(out)).toContain("ambiguous")
  })

  test("updatePBTStatus writes tag and failing example", async () => {
    const root = mkdtempSync(join(tmpdir(), "kiro-task-status-"))
    const file = makeTasksFile(
      root,
      [
        "# Tasks",
        "- [ ] 3.2 Property test for parser",
      ].join("\n"),
    )
    const tool = createUpdatePBTStatusTool(makeCtx(root))
    const out = await run(tool, {
      taskFilePath: file.rel,
      taskId: "3.2",
      status: "failed",
      failingExample: "input='{'",
    })

    expect(String(out)).toContain("updated")
    const next = readFileSync(file.abs, "utf-8")
    expect(next).toContain("- [!] 3.2 Property test for parser [pbt:failed]")
    expect(next).toContain("failing_example: input='{'")
  })

  test("updatePBTStatus clears failing example when status is not_run", async () => {
    const root = mkdtempSync(join(tmpdir(), "kiro-task-status-"))
    const file = makeTasksFile(
      root,
      [
        "# Tasks",
        "- [!] 3.2 Property test for parser [pbt:failed]",
        "  - failing_example: input='{'",
      ].join("\n"),
    )
    const tool = createUpdatePBTStatusTool(makeCtx(root))
    await run(tool, {
      taskFilePath: file.rel,
      taskId: "3.2",
      status: "not_run",
    })

    const next = readFileSync(file.abs, "utf-8")
    expect(next).toContain("- [ ] 3.2 Property test for parser [pbt:not_run]")
    expect(next).not.toContain("failing_example:")
  })
})
