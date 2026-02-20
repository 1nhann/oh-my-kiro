/**
 * Background Task Notification Builder
 * Builds notification text for background task completion
 */

import type { BackgroundTaskMeta } from "./types"

/**
 * Format duration between two dates
 */
function formatDuration(start: Date, end?: Date): string {
  const endTime = end ?? new Date()
  const diffMs = endTime.getTime() - start.getTime()

  if (diffMs < 1000) return "<1s"
  if (diffMs < 60000) return `${Math.floor(diffMs / 1000)}s`
  if (diffMs < 3600000) {
    const minutes = Math.floor(diffMs / 60000)
    const seconds = Math.floor((diffMs % 60000) / 1000)
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
  }
  const hours = Math.floor(diffMs / 3600000)
  const minutes = Math.floor((diffMs % 3600000) / 60000)
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
}

/**
 * Build notification text for a background task
 */
export function buildBackgroundTaskNotification(args: {
  task: BackgroundTaskMeta
  allComplete: boolean
  remainingCount: number
  completedTasks: BackgroundTaskMeta[]
}): string {
  const { task, allComplete, remainingCount, completedTasks } = args

  const duration = task.startedAt ? formatDuration(task.startedAt, task.completedAt) : "N/A"
  const statusText =
    task.status === "completed"
      ? "COMPLETED"
      : task.status === "failed"
        ? "ERROR"
        : task.status === "cancelled"
          ? "CANCELLED"
          : "UNKNOWN"

  const errorInfo = task.error ? `\n**Error:** ${task.error}` : ""

  // All tasks complete - show summary
  if (allComplete) {
    const completedTasksText =
      completedTasks.length > 0
        ? completedTasks.map((t) => `- \`${t.taskId}\`: ${t.description}`).join("\n")
        : `- \`${task.taskId}\`: ${task.description}`

    return `<system-reminder>
[ALL BACKGROUND TASKS COMPLETE]

**Completed:**
${completedTasksText}

Use \`backgroundTaskOutput(task_id="<id>")\` to retrieve each result.
</system-reminder>`
  }

  // Single task complete - show status with remaining count
  return `<system-reminder>
[BACKGROUND TASK ${statusText}]
**ID:** \`${task.taskId}\`
**Description:** ${task.description}
**Duration:** ${duration}${errorInfo}

**${remainingCount} task${remainingCount === 1 ? "" : "s"} still in progress.** You WILL be notified when ALL complete.
Do NOT poll - continue productive work.

Use \`backgroundTaskOutput(task_id="${task.taskId}")\` to retrieve this result when ready.
</system-reminder>`
}
