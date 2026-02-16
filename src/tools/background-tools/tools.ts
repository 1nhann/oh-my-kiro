/**
 * Background Task Tools
 * Tools for managing background subagent tasks
 */

import { tool } from "@opencode-ai/plugin"
import type { ToolContext } from "@opencode-ai/plugin"
import type { BackgroundTaskManager } from "../../background/types"
import type { ToolContextWithExtras } from "../kiro-specific/subagent/types"
import type { ToolDef } from "../../plugin/types"
import { SUBAGENT_NAME_MAPPING, isSubagentName } from "../kiro-specific/subagent/agents"

function ms(task: {
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
}) {
  if (task.completedAt) {
    return task.completedAt.getTime() - (task.startedAt?.getTime() || task.createdAt.getTime())
  }
  if (task.startedAt) {
    return Date.now() - task.startedAt.getTime()
  }
  return 0
}

function sec(task: {
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
}) {
  return Math.max(0, Math.round(ms(task) / 1000))
}

function icon(status: "pending" | "running" | "completed" | "failed" | "cancelled") {
  return {
    pending: "⏳",
    running: "🔄",
    completed: "✅",
    failed: "❌",
    cancelled: "🚫",
  }[status]
}

function note(status: "pending" | "running" | "completed" | "failed" | "cancelled") {
  if (status === "pending") return "Queued: waiting for execution slot."
  if (status === "running") return "Running: use backgroundTaskOutput(wait=false) to check without blocking."
  if (status === "completed") return "Completed: use backgroundTaskOutput to fetch full result."
  if (status === "failed") return "Failed: inspect error and latest progress below."
  return "Cancelled: task was stopped before completion."
}

function progressLines(progress: Array<{ timestamp: Date; type: string; message: string }>) {
  if (progress.length === 0) return "(No progress updates yet)"
  return progress.map((p) => `- [${p.timestamp.toLocaleTimeString()}] ${p.type.toUpperCase()}: ${p.message}`).join("\n")
}

function statusView(task: {
  taskId: string
  agent: string
  status: "pending" | "running" | "completed" | "failed" | "cancelled"
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  progress: Array<{ timestamp: Date; type: string; message: string }>
  error?: string
  result?: string
}, info?: string) {
  const infoLine = info ? `\n> ${info}\n` : ""
  return `# Task Status

| Field | Value |
|---|---|
| Task ID | \`${task.taskId}\` |
| Agent | ${task.agent} |
| Status | ${icon(task.status)} ${task.status} |
| Created | ${task.createdAt.toLocaleString()} |
| Duration | ${sec(task)}s |

> ${note(task.status)}${infoLine}
## Progress
${progressLines(task.progress)}

${task.error ? `\n## Error\n${task.error}\n` : ""}${task.result ? `\n## Result Preview\n${task.result.slice(0, 500)}${task.result.length > 500 ? "..." : ""}\n` : ""}`
}

function resultView(task: {
  taskId: string
  agent: string
  status: "pending" | "running" | "completed" | "failed" | "cancelled"
  startedAt?: Date
  completedAt?: Date
}, output: string) {
  return `# Task Result

| Field | Value |
|---|---|
| Task ID | \`${task.taskId}\` |
| Agent | ${task.agent} |
| Status | ${icon(task.status)} ${task.status} |
| Duration | ${sec({ createdAt: task.startedAt || new Date(), startedAt: task.startedAt, completedAt: task.completedAt })}s |

## Output
${output || "(No output)"}`
}

/**
 * Create background task tool
 * Starts a subagent in the background
 */
export function createBackgroundTaskTool(manager: BackgroundTaskManager): ToolDef {
  return {
    description: `Start a subagent task in the background for parallel execution.

Use this tool when you want to run multiple tasks concurrently. The task runs
asynchronously and you can check its status later using backgroundTaskStatus.

Supported agents:
- explore: Fast codebase exploration
- requirements-first-workflow: Requirements gathering and spec creation
- spec-task-execution: Execute tasks from a spec
- context-gatherer: Gather context for a task
- general-task-execution: General development tasks

Returns a taskId that can be used to check status or cancel the task.`,

    parameters: {
      agent: tool.schema.string().describe("The agent type to use (explore, spec-task-execution, etc.)"),
      prompt: tool.schema.string().describe("The task prompt for the subagent"),
      description: tool.schema.string().optional().describe("Optional description for tracking"),
    },

    execute: async (args: { agent: string; prompt: string; description?: string }, ctx: ToolContext) => {
      const extras = ctx as ToolContextWithExtras
      if (!isSubagentName(args.agent)) {
        return {
          title: "Invalid agent",
          output: `Unknown agent '${args.agent}'. Available agents: ${Object.keys(SUBAGENT_NAME_MAPPING).join(", ")}`,
          metadata: { error: "invalid_agent" },
        }
      }

      try {
        const report = (update: { message: string; type: string }) =>
          extras.metadata?.({
            metadata: {
              progress: update.message,
              type: update.type,
            },
          })
        const taskId = await manager.createTask({
          agent: args.agent,
          prompt: args.prompt,
          ctx: extras,
          onProgress: report,
        })

        return {
          title: args.description || `Background task: ${args.agent}`,
          output: `Background task started successfully.

Task ID: ${taskId}
Agent: ${args.agent}
Status: running

Use backgroundTaskStatus to check progress:
  backgroundTaskStatus({ taskId: "${taskId}" })

Use backgroundTaskOutput to get results when complete:
  backgroundTaskOutput({ taskId: "${taskId}" })

Use backgroundTaskCancel to cancel if needed:
  backgroundTaskCancel({ taskId: "${taskId}" })`,
          metadata: { taskId, status: "running" },
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        return {
          title: "Failed to start background task",
          output: `Error starting background task: ${errorMessage}`,
          metadata: { error: errorMessage },
        }
      }
    },
  }
}

/**
 * Background task status tool
 * Check the status of a background task
 */
export function createBackgroundTaskStatusTool(manager: BackgroundTaskManager): ToolDef {
  return {
    description: `Check the status of a background task.

Returns current status (pending/running/completed/failed/cancelled),
progress updates, and timing information.`,

    parameters: {
      taskId: tool.schema.string().describe("The task ID to check"),
    },

    execute: async (args: { taskId: string }, _ctx: ToolContext) => {
      const task = manager.getTask(args.taskId)

      if (!task) {
        return {
          title: "Task not found",
          output: `No task found with ID: ${args.taskId}
`,
          metadata: { error: "not_found" },
        }
      }

      const output = `# Task Status

| Field | Value |
|---|---|
| Task ID | \`${task.taskId}\` |
| Agent | ${task.agent} |
| Status | ${icon(task.status)} ${task.status} |
| Created | ${task.createdAt.toLocaleString()} |
| Duration | ${sec(task)}s |

> ${note(task.status)}

## Progress
${progressLines(task.progress)}

${task.error ? `\n## Error\n${task.error}\n` : ""}${task.result ? `\n## Result Preview\n${task.result.slice(0, 500)}${task.result.length > 500 ? "..." : ""}\n` : ""}`

      return {
        title: `Task status: ${task.status}`,
        output,
        metadata: {
          taskId: task.taskId,
          status: task.status,
          duration: ms(task),
          hasResult: !!task.result,
        },
      }
    },
  }
}

/**
 * Background task output tool
 * Get the output of a completed task
 */
export function createBackgroundTaskOutputTool(manager: BackgroundTaskManager): ToolDef {
  return {
    description: `Get the output/result of a background task.

Waits for task completion if still running (with optional timeout).
Returns the full result or error message.`,

    parameters: {
      taskId: tool.schema.string().describe("The task ID to get output from"),
      wait: tool.schema.boolean().optional().default(true).describe("Wait for completion if still running"),
      timeout: tool.schema.number().optional().default(60000).describe("Timeout in ms when waiting (default: 60s)"),
    },

    execute: async (args: { taskId: string; wait?: boolean; timeout?: number }, _ctx: ToolContext) => {
      const task = manager.getTask(args.taskId)

      if (!task) {
        return {
          title: "Task not found",
          output: `No task found with ID: ${args.taskId}`,
          metadata: { error: "not_found" },
        }
      }

      const shouldWait = args.wait === true
      const timeoutRaw = Number(args.timeout ?? 60000)
      const timeout = Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? Math.min(timeoutRaw, 600000) : 60000

      try {

        if (task.status === "completed") {
          const output = await manager.getTaskOutput(args.taskId)
          return {
            title: `Task output: ${task.status}`,
            output: resultView(task, output),
            metadata: {
              taskId: task.taskId,
              status: task.status,
              view: "result",
            },
          }
        }

        if (task.status === "failed" || task.status === "cancelled") {
          return {
            title: `Task output: ${task.status}`,
            output: statusView(task, "Task is not running. Returning latest status snapshot."),
            metadata: {
              taskId: task.taskId,
              status: task.status,
              view: "status",
            },
          }
        }

        if (shouldWait && (task.status === "pending" || task.status === "running")) {
          const completedTask = await manager.waitForTask(args.taskId, timeout)
          const output = await manager.getTaskOutput(args.taskId)

          return {
            title: `Task output: ${completedTask.status}`,
            output: resultView(completedTask, output),
            metadata: {
              taskId: completedTask.taskId,
              status: completedTask.status,
              view: "result",
            },
          }
        }

        return {
          title: `Task output: status`,
          output: statusView(task, "Non-blocking check. Use wait=true to block until completion."),
          metadata: {
            taskId: task.taskId,
            status: task.status,
            view: "status",
          },
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const latest = manager.getTask(args.taskId)
        if (latest && errorMessage.toLowerCase().includes("timeout")) {
          return {
            title: "Task output: timeout",
            output: `${statusView(latest, `Wait timeout reached (${timeout}ms). Task may still be running.`)}\n\nTimeout: ${errorMessage}`,
            metadata: { taskId: latest.taskId, status: latest.status, error: errorMessage, view: "status" },
          }
        }
        return {
          title: "Error getting task output",
          output: `Error: ${errorMessage}`,
          metadata: { error: errorMessage },
        }
      }
    },
  }
}

/**
 * Background task cancel tool
 * Cancel a running background task
 */
export function createBackgroundTaskCancelTool(manager: BackgroundTaskManager): ToolDef {
  return {
    description: `Cancel a running background task.

The task will be stopped and marked as cancelled.
Cannot be undone.`,

    parameters: {
      taskId: tool.schema.string().optional().describe("The task ID to cancel"),
      all: tool.schema.boolean().optional().default(false).describe("Cancel all running/pending tasks"),
    },

    execute: async (args: { taskId?: string; all?: boolean }, _ctx: ToolContext) => {
      if (args.all === true) {
        const tasks = manager.getAllTasks().filter((task) => task.status === "running" || task.status === "pending")
        if (tasks.length === 0) {
          return {
            title: "No cancellable tasks",
            output: "No running or pending background tasks to cancel.",
            metadata: { cancelled: 0 },
          }
        }
        const cancelled = (await Promise.all(tasks.map(async (task) => {
          const ok = await manager.cancelTask(task.taskId)
          if (!ok) return null
          return {
            taskId: task.taskId,
            description: task.prompt.slice(0, 60),
            status: task.status,
            sessionId: task.sessionId,
          }
        }))).flatMap((row) => row ? [row] : [])

        const rows = cancelled
          .map((row) => `| \`${row.taskId}\` | ${row.description} | ${row.status} | ${row.sessionId ? `\`${row.sessionId}\`` : "(not started)"} |`)
          .join("\n")
        const resumable = cancelled.filter((row) => !!row.sessionId)
        const resume = resumable.length === 0
          ? ""
          : `\n## Continue Instructions

Use \`task\` with \`task_id\` and matching \`subagent_type\` to continue an existing subagent session.

Continuable sessions:
${resumable.map((row) => `- \`${row.sessionId}\` (\`${row.taskId}\`)`).join("\n")}`

        return {
          title: `Cancelled ${cancelled.length} task(s)`,
          output: `Cancelled ${cancelled.length} background task(s):

| Task ID | Description | Status | Session ID |
|---|---|---|---|
${rows}${resume}`,
          metadata: { cancelled: cancelled.length, taskIds: cancelled.map((row) => row.taskId) },
        }
      }

      if (!args.taskId) {
        return {
          title: "Missing task ID",
          output: "Provide taskId, or set all=true to cancel all running tasks.",
          metadata: { error: "missing_task_id" },
        }
      }

      const task = manager.getTask(args.taskId)
      if (!task) {
        return {
          title: "Task not found",
          output: `No task found with ID: ${args.taskId}`,
          metadata: { error: "not_found" },
        }
      }
      if (task.status !== "running" && task.status !== "pending") {
        return {
          title: "Cannot cancel task",
          output: `Task is already ${task.status}. Only running or pending tasks can be cancelled.`,
          metadata: { status: task.status },
        }
      }

      const cancelled = await manager.cancelTask(args.taskId)
      if (!cancelled) {
        return {
          title: "Failed to cancel task",
          output: `Could not cancel task ${args.taskId}. It may have already completed.`,
          metadata: { error: "cancel_failed" },
        }
      }

      return {
        title: "Task cancelled",
        output: `Task cancelled successfully.

Task ID: ${task.taskId}
Status: ${task.status}
Session ID: ${task.sessionId ?? "(not started)"}`,
        metadata: { taskId: task.taskId, status: "cancelled", sessionId: task.sessionId ?? null },
      }
    },
  }
}

/**
 * List background tasks tool
 * List all background tasks
 */
export function createListBackgroundTasksTool(manager: BackgroundTaskManager): ToolDef {
  return {
    description: `List all background tasks, optionally filtered by status.

Shows task IDs, agents, status, and timing information.`,

    parameters: {},

    execute: async (_args: {}, _ctx: ToolContext) => {
      const allTasks = manager.getAllTasks()
      const filteredTasks = allTasks

      if (filteredTasks.length === 0) {
        return {
          title: "No background tasks",
          output: "No background tasks found.",
          metadata: { count: 0 },
        }
      }

      const statusEmoji = {
        pending: "⏳",
        running: "🔄",
        completed: "✅",
        failed: "❌",
        cancelled: "🚫",
      }

      const lines = filteredTasks.map((task) => {
        const emoji = statusEmoji[task.status]
        return `| ${emoji} \`${task.taskId}\` | ${task.agent} | ${task.status} | ${sec(task)}s |`
      })

      return {
        title: `Background tasks (${filteredTasks.length})`,
        output: `Found ${filteredTasks.length} task(s).

| Task ID | Agent | Status | Duration |
|---|---|---|---|
${lines.join("\n")}

Summary:
- Pending: ${allTasks.filter((t) => t.status === "pending").length}
- Running: ${allTasks.filter((t) => t.status === "running").length}
- Completed: ${allTasks.filter((t) => t.status === "completed").length}
- Failed: ${allTasks.filter((t) => t.status === "failed").length}
- Cancelled: ${allTasks.filter((t) => t.status === "cancelled").length}`,
        metadata: {
          count: filteredTasks.length,
          total: allTasks.length,
        },
      }
    },
  }
}

/**
 * Create all background task tools
 */
export function createBackgroundTools(manager: BackgroundTaskManager): Record<string, ToolDef> {
  const wrap = (def: ToolDef): ToolDef => ({
    description: def.description,
    args: def.parameters,
    parameters: def.parameters,
    execute: async (args: unknown, ctx: ToolContext) => {
      try {
        const res = await (def.execute as (args: unknown, ctx: ToolContext) => Promise<unknown>)(args, ctx)
        if (typeof res === "string") return res
        if (res && typeof res === "object" && "output" in res) {
          const text = (res as { output?: unknown }).output
          if (typeof text === "string") return text
          return String(text ?? "")
        }
        return String(res ?? "")
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        return `Error: ${msg}`
      }
    },
  })

  return {
    backgroundTask: wrap(createBackgroundTaskTool(manager)),
    backgroundTaskStatus: wrap(createBackgroundTaskStatusTool(manager)),
    backgroundTaskOutput: wrap(createBackgroundTaskOutputTool(manager)),
    backgroundTaskCancel: wrap(createBackgroundTaskCancelTool(manager)),
    listBackgroundTasks: wrap(createListBackgroundTasksTool(manager)),
  }
}
