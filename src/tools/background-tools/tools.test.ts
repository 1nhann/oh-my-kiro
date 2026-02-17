import { describe, expect, test } from "bun:test"
import type { BackgroundTaskManager, BackgroundTaskMeta } from "../../background/types"
import {
  createBackgroundTaskCancelTool,
  createBackgroundTaskOutputTool,
  createBackgroundTaskStatusTool,
  createListBackgroundTasksTool,
} from "./tools"

function task(overrides: Partial<BackgroundTaskMeta> = {}): BackgroundTaskMeta {
  return {
    taskId: "bg-1",
    agent: "kiroExplore",
    prompt: "find auth flow",
    status: "running",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    startedAt: new Date("2026-01-01T00:00:05.000Z"),
    progress: [{ timestamp: new Date("2026-01-01T00:00:06.000Z"), message: "started", type: "info" }],
    parentContext: {
      sessionID: "s-1",
      messageID: "m-1",
      directory: "/tmp",
      worktree: "/tmp",
    },
    ...overrides,
  }
}

function manager(tasks: BackgroundTaskMeta[]): BackgroundTaskManager {
  return {
    createTask: async () => "bg-new",
    getTask: (id) => tasks.find((t) => t.taskId === id),
    getAllTasks: () => tasks,
    getTasksByStatus: (status) => tasks.filter((t) => t.status === status),
    cancelTask: async () => true,
    getTaskOutput: async (id) => `output:${id}`,
    waitForTask: async (id) => tasks.find((t) => t.taskId === id) || task({ taskId: id }),
    cleanup: () => 0,
    getTaskCount: () => tasks.length,
  }
}

function run(tool: unknown, args: Record<string, unknown>) {
  return (tool as { execute: (args: Record<string, unknown>, ctx: unknown) => Promise<unknown> }).execute(args, {})
}

describe("background tools formatting", () => {
  test("backgroundTaskStatus returns structured table output", async () => {
    const t = task({ taskId: "bg-42", status: "running" })
    const tool = createBackgroundTaskStatusTool(manager([t]))
    const res = await run(tool, { taskId: "bg-42" })
    const out = String((res as { output: string }).output)

    expect(out).toContain("# Task Status")
    expect(out).toContain("| Task ID |")
    expect(out).toContain("bg-42")
    expect(out).toContain("## Progress")
  })

  test("listBackgroundTasks returns markdown table rows", async () => {
    const a = task({ taskId: "bg-a", status: "running" })
    const b = task({ taskId: "bg-b", status: "pending", startedAt: undefined })
    const tool = createListBackgroundTasksTool(manager([a, b]))
    const res = await run(tool, { status: "all" })
    const out = String((res as { output: string }).output)

    expect(out).toContain("| Task ID | Agent | Status | Duration |")
    expect(out).toContain("`bg-a`")
    expect(out).toContain("`bg-b`")
    expect(out).toContain("Summary:")
  })

  test("backgroundTaskOutput returns status view when wait=false and running", async () => {
    const t = task({ taskId: "bg-run", status: "running" })
    const tool = createBackgroundTaskOutputTool(manager([t]))
    const res = await run(tool, { taskId: "bg-run", wait: false })
    const out = String((res as { output: string }).output)

    expect(out).toContain("# Task Status")
    expect(out).toContain("Non-blocking check")
  })

  test("backgroundTaskOutput returns timeout status snapshot", async () => {
    const t = task({ taskId: "bg-timeout", status: "running" })
    const m = manager([t])
    m.waitForTask = async () => {
      throw new Error("timeout while waiting")
    }
    const tool = createBackgroundTaskOutputTool(m)
    const res = await run(tool, { taskId: "bg-timeout", wait: true, timeout: 1 })
    const out = String((res as { output: string }).output)

    expect(out).toContain("# Task Status")
    expect(out).toContain("Wait timeout reached")
  })

  test("backgroundTaskCancel(all=true) returns table and continue instructions", async () => {
    const a = task({ taskId: "bg-a", status: "running", sessionId: "ses-a" })
    const b = task({ taskId: "bg-b", status: "pending", sessionId: undefined })
    const tool = createBackgroundTaskCancelTool(manager([a, b]))
    const res = await run(tool, { all: true })
    const out = String((res as { output: string }).output)

    expect(out).toContain("| Task ID | Description | Status | Session ID |")
    expect(out).toContain("`bg-a`")
    expect(out).toContain("## Continue Instructions")
    expect(out).toContain("`ses-a`")
  })

  test("backgroundTaskCancel(single) includes session id", async () => {
    const a = task({ taskId: "bg-one", status: "running", sessionId: "ses-one" })
    const tool = createBackgroundTaskCancelTool(manager([a]))
    const res = await run(tool, { taskId: "bg-one" })
    const out = String((res as { output: string }).output)

    expect(out).toContain("Task cancelled successfully")
    expect(out).toContain("Session ID: ses-one")
  })
})
