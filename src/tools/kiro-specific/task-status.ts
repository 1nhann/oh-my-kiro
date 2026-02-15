/**
 * Task Status Management Tools
 */

import type { PluginInput } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { readFileSync, writeFileSync, existsSync } from "fs"
import { resolve, sep } from "path"

const z = tool.schema

function getSafePath(worktree: string, taskFilePath: string): { path?: string; error?: string } {
  const root = resolve(worktree)
  const fullPath = resolve(root, String(taskFilePath))
  if (fullPath !== root && !fullPath.startsWith(root + sep)) {
    return { error: `Error: Task file path is outside workspace: ${taskFilePath}` }
  }
  if (!existsSync(fullPath)) {
    return { error: `Error: Task file not found at ${taskFilePath}` }
  }
  return { path: fullPath }
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function normalize(input: string): string {
  return input.trim().toLowerCase()
}

function isTaskLine(line: string): boolean {
  return /^\s*[-*]\s*\[[ xX\-\/!]\]\s+/.test(line)
}

function taskBody(line: string): string {
  return line.replace(/^\s*[-*]\s*\[[ xX\-\/!]\]\s+/, "")
}

function looksLikeTaskId(input: string): boolean {
  return /^\d+(\.\d+)*$/.test(input.trim())
}

function findTaskIndexes(lines: string[], query: string): number[] {
  const q = normalize(query)
  if (!q) return []

  if (looksLikeTaskId(query)) {
    const idRegex = new RegExp(`^${escapeRegex(query.trim())}(?:[\\s.:]|$)`)
    const byId = lines
      .map((line, i) => ({ line, i }))
      .filter((x) => isTaskLine(x.line))
      .filter((x) => idRegex.test(taskBody(x.line)))
      .map((x) => x.i)
    if (byId.length > 0) return byId
  }

  return lines
    .map((line, i) => ({ line, i }))
    .filter((x) => isTaskLine(x.line))
    .filter((x) => normalize(taskBody(x.line)).includes(q))
    .map((x) => x.i)
}

function setLineStatus(line: string, mark: string): string {
  return line.replace(/^(\s*[-*]\s*)\[[ xX\-\/!]\](\s+)/, `$1[${mark}]$2`)
}

function findFailingExampleLine(lines: string[], index: number): number {
  const next = lines[index + 1]
  if (!next) return -1
  return /^\s*[-*]\s*failing_example:\s*/.test(next) ? index + 1 : -1
}

/**
 * Create Kiro spec task status update tool
 * Use this to update task status in .kiro/specs/ tasks.md files
 * This is DIFFERENT from todowrite - kiroSpecTaskStatus is for spec workflow tasks only
 */
export function createKiroSpecTaskStatusTool(ctx: PluginInput) {
  return tool({
    description: "Updates the status of tasks in Kiro spec workflow (.kiro/specs/*/tasks.md). Use this for spec-driven development tasks, NOT for general todo lists (use todowrite for that).",
    args: {
      taskFilePath: z.string(),
      task: z.string(),
      status: z.enum(["not_started", "queued", "in_progress", "completed"]),
    },
    execute: async (args) => {
      const safe = getSafePath(ctx.worktree, args.taskFilePath)
      if (safe.error) return safe.error
      if (!safe.path) return "Error: invalid task file path."

      const task = String(args.task).trim()
      if (!task) return "Error: task cannot be empty."

      const content = readFileSync(safe.path, "utf-8")
      const lines = content.split("\n")
      const matches = findTaskIndexes(lines, task)
      if (matches.length === 0) {
        return `Warning: Task "${task}" not found.`
      }
      if (matches.length > 1) {
        const preview = matches.slice(0, 3).map((i) => `- line ${i + 1}: ${taskBody(lines[i])}`).join("\n")
        return `Error: Task query "${task}" is ambiguous (${matches.length} matches).\n${preview}`
      }

      const i = matches[0]
      const statusChar = args.status === "completed"
        ? "x"
        : args.status === "in_progress"
          ? "-"
          : args.status === "queued"
            ? "/"
            : " "
      const nextLine = setLineStatus(lines[i], statusChar)
      if (nextLine === lines[i]) {
        return `Warning: Could not update status for task "${task}".`
      }
      lines[i] = nextLine
      writeFileSync(safe.path, lines.join("\n"), "utf-8")
      return `Task "${task}" status updated to ${args.status}`
    }
  })
}

/**
 * Create PBT (Property-Based Test) status update tool
 */
export function createUpdatePBTStatusTool(ctx: PluginInput) {
  return tool({
    description: "Updates Property-Based Test task status in tasks.md and records failing examples.",
    args: {
      taskFilePath: z.string(),
      taskId: z.string(),
      status: z.enum(["passed", "failed", "not_run"]),
      failingExample: z.string().optional().nullable(),
    },
    execute: async (args) => {
      const safe = getSafePath(ctx.worktree, args.taskFilePath)
      if (safe.error) return safe.error
      if (!safe.path) return "Error: invalid task file path."

      const id = String(args.taskId).trim()
      if (!id) return "Error: taskId cannot be empty."

      const lines = readFileSync(safe.path, "utf-8").split("\n")
      const matches = findTaskIndexes(lines, id)
      if (matches.length === 0) {
        return `Error: PBT task '${id}' not found in ${args.taskFilePath}`
      }
      if (matches.length > 1) {
        const preview = matches.slice(0, 3).map((i) => `- line ${i + 1}: ${taskBody(lines[i])}`).join("\n")
        return `Error: PBT task query '${id}' is ambiguous (${matches.length} matches).\n${preview}`
      }
      const i = matches[0]

      const mark = args.status === "passed" ? "x" : args.status === "failed" ? "!" : " "
      lines[i] = setLineStatus(lines[i], mark)

      const statusTag = ` [pbt:${args.status}]`
      const hasTag = /\s\[pbt:(passed|failed|not_run)\]/.test(lines[i])
      lines[i] = hasTag
        ? lines[i].replace(/\s\[pbt:(passed|failed|not_run)\]/, statusTag)
        : `${lines[i]}${statusTag}`

      const failPrefix = "failing_example:"
      const failLineIndex = findFailingExampleLine(lines, i)
      const hasFailLine = failLineIndex >= 0
      if (args.status === "failed" && args.failingExample) {
        const failLine = `${" ".repeat(Math.max(2, lines[i].search(/\S|$/)))}- ${failPrefix} ${args.failingExample}`
        if (hasFailLine) {
          lines[failLineIndex] = failLine
        } else {
          lines.splice(i + 1, 0, failLine)
        }
      }
      if (args.status !== "failed" && hasFailLine) {
        lines.splice(failLineIndex, 1)
      }

      writeFileSync(safe.path, lines.join("\n"), "utf-8")
      const failMsg = args.status === "failed" && args.failingExample
        ? ` Failing example recorded.`
        : ""
      return `PBT status for ${id} updated to ${args.status}.${failMsg}`
    }
  })
}
