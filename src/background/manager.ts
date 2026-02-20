/**
 * Background Task Manager
 * Manages background subagent tasks for parallel execution
 */

import { randomUUID } from "crypto"
import type { OpencodeClient } from "../tools/kiro-specific/subagent/types"
import { isSubagentName } from "../tools/kiro-specific/subagent/agents"
import type {
  BackgroundTaskManager as IBackgroundTaskManager,
  BackgroundTaskMeta,
  BackgroundTaskStatus,
  CreateBackgroundTaskOptions,
  ProgressUpdate,
} from "./types"
import { buildBackgroundTaskNotification } from "./notification-builder"
import { isAbortedSessionError } from "./error-classifier"

const NON_TERMINAL_FINISH_REASONS = new Set(["tool-calls", "unknown"])

/** Delay before cleaning up completed tasks from memory */
const TASK_CLEANUP_DELAY_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Fetch model info from parent session messages
 * Used to inherit model from parent session to background task
 */
async function getParentSessionModel(
  client: OpencodeClient,
  sessionID: string,
): Promise<{ providerID: string; modelID: string } | undefined> {
  try {
    const messagesResp = await client.session.messages({
      path: { id: sessionID },
    })
    const raw = (messagesResp as { data?: unknown }).data ?? []
    const messages = Array.isArray(raw) ? raw : []

    // Find the last message with model info
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i] as { info?: { model?: { providerID: string; modelID: string } } }
      if (msg.info?.model?.providerID && msg.info?.model?.modelID) {
        return msg.info.model
      }
    }
  } catch {
    // Ignore errors when fetching messages - use defaults
  }
  return undefined
}

type SessionMessage = {
  info?: {
    id?: string
    role?: "user" | "assistant"
    finish?: string
    time?: {
      created?: number
    }
  }
  parts?: Array<{
    type: string
    text?: string
  }>
}

/**
 * Create a background task manager
 */
export function createBackgroundTaskManager(client: OpencodeClient): IBackgroundTaskManager {
  // In-memory task storage
  const tasks = new Map<string, BackgroundTaskMeta>()

  // Abort controllers for running tasks
  const abortControllers = new Map<string, AbortController>()

  // Track pending tasks per parent session for notifications
  const pendingByParent = new Map<string, Set<string>>()

  // Completion timers for cleanup
  const completionTimers = new Map<string, ReturnType<typeof setTimeout>>()

  /**
   * Generate a unique task ID
   */
  function generateTaskId(): string {
    const timestamp = Date.now().toString(36)
    const random = randomUUID().split("-")[0]
    return `bg-${timestamp}-${random}`
  }

  /**
   * Update task status
   */
  function updateTaskStatus(taskId: string, status: BackgroundTaskStatus, extras?: Partial<BackgroundTaskMeta>): void {
    const task = tasks.get(taskId)
    if (!task) return

    task.status = status
    Object.assign(task, extras)
  }

  /**
   * Add progress update to task
   */
  function addProgress(taskId: string, message: string, type: ProgressUpdate["type"] = "info"): void {
    const task = tasks.get(taskId)
    if (!task) return

    task.progress.push({
      timestamp: new Date(),
      message,
      type,
    })
  }

  /**
   * Send notification when task completes
   * Only sends notification when ALL tasks for this parent session are complete.
   * This avoids spamming the main agent with partial completion notifications.
   * If the agent is using waitForBackgroundTasks, it will return when all complete anyway.
   */
  async function sendNotification(task: BackgroundTaskMeta): Promise<void> {
    const parentSessionID = task.parentContext.sessionID

    // Update pending set
    const pendingSet = pendingByParent.get(parentSessionID)
    if (pendingSet) {
      pendingSet.delete(task.taskId)
      if (pendingSet.size === 0) {
        pendingByParent.delete(parentSessionID)
      }
    }

    const allComplete = !pendingSet || pendingSet.size === 0
    const remainingCount = pendingSet?.size ?? 0

    // Only send notification when ALL tasks are complete
    // If there are still running tasks, skip notification
    if (!allComplete) {
      return
    }

    // Get all completed tasks for this parent session
    const completedTasks = Array.from(tasks.values()).filter(
      (t) =>
        t.parentContext.sessionID === parentSessionID &&
        t.status !== "running" &&
        t.status !== "pending"
    )

    const notification = buildBackgroundTaskNotification({
      task,
      allComplete,
      remainingCount,
      completedTasks,
    })

    // Try to get agent/model from parent session for correct reply context
    let agent: string | undefined
    let model: { providerID: string; modelID: string } | undefined

    try {
      const messagesResp = await client.session.messages({
        path: { id: parentSessionID },
      })
      const raw = (messagesResp as { data?: unknown }).data ?? []
      const messages = Array.isArray(raw) ? raw : []

      // Find the last message with agent/model info
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i] as { info?: { agent?: string; model?: { providerID: string; modelID: string } } }
        if (msg.info?.agent || msg.info?.model) {
          agent = msg.info.agent
          if (msg.info.model?.providerID && msg.info.model?.modelID) {
            model = msg.info.model
          }
          break
        }
      }
    } catch (error) {
      // Skip notification if parent session was aborted
      if (isAbortedSessionError(error)) {
        return
      }
      // Ignore other errors when fetching messages - use defaults
    }

    // Send notification only when all complete
    try {
      await client.session.promptAsync({
        path: { id: parentSessionID },
        body: {
          noReply: false, // Trigger reply since all tasks are complete
          ...(agent !== undefined ? { agent } : {}),
          ...(model !== undefined ? { model } : {}),
          parts: [{ type: "text", text: notification }],
        },
      })
    } catch (error) {
      // Skip notification if parent session was aborted
      if (isAbortedSessionError(error)) {
        return
      }
      // Ignore other errors
    }

    // Schedule cleanup
    for (const completedTask of completedTasks) {
      const taskId = completedTask.taskId
      const existingTimer = completionTimers.get(taskId)
      if (existingTimer) {
        clearTimeout(existingTimer)
        completionTimers.delete(taskId)
      }

      const timer = setTimeout(() => {
        completionTimers.delete(taskId)
        if (tasks.has(taskId)) {
          tasks.delete(taskId)
        }
      }, TASK_CLEANUP_DELAY_MS)

      completionTimers.set(taskId, timer)
    }
  }

  /**
   * Execute a background task
   */
  async function executeTask(taskId: string, options: CreateBackgroundTaskOptions): Promise<void> {
    const { agent, prompt, ctx, onProgress, model: explicitModel } = options
    if (!isSubagentName(agent)) {
      throw new Error(`Unknown agent '${agent}'`)
    }
    const abortController = new AbortController()
    abortControllers.set(taskId, abortController)

    try {
      updateTaskStatus(taskId, "running", { startedAt: new Date() })
      addProgress(taskId, `Starting background task with agent: ${agent}`, "info")
      onProgress?.({ timestamp: new Date(), message: "Task started", type: "info" })

      const parentSession = client.session.get
        ? await client.session.get({ path: { id: ctx.sessionID } }).catch(() => null)
        : null
      const parentDirectory = parentSession?.data?.directory ?? ctx.directory
      const sessionResult = await client.session.create({
        body: {
          parentID: ctx.sessionID,
          title: `Background task (@${agent})`,
        },
        query: {
          directory: parentDirectory,
        },
      })
      if (sessionResult.error) {
        throw new Error(`Failed to create session: ${sessionResult.error}`)
      }

      const sessionId = sessionResult.data?.id
      if (!sessionId) {
        throw new Error("Failed to create session: missing session id")
      }
      updateTaskStatus(taskId, "running", { sessionId })
      addProgress(taskId, `Created session: ${sessionId}`, "info")

      if (abortController.signal.aborted) {
        throw new Error("Task cancelled")
      }

      // Get model from explicit param, or from ctx, or fetch from parent session
      let model = explicitModel ?? ctx.model
      if (!model) {
        model = await getParentSessionModel(client, ctx.sessionID)
      }

      const promptResult = await client.session.promptAsync({
        path: { id: sessionId },
        body: {
          agent,
          system: getAgentSystemPrompt(agent),
          ...(model ? { model } : {}),
          parts: [{ type: "text", text: prompt }],
        },
      })
      if (promptResult.error) {
        throw new Error(`Failed to prompt session: ${promptResult.error}`)
      }

      addProgress(taskId, "Prompt sent to agent", "info")
      onProgress?.({ timestamp: new Date(), message: "Prompt sent", type: "info" })

      // 3. Poll for completion (with abort support)
      const startTime = Date.now()
      const timeout = 10 * 60 * 1000 // 10 minutes
      const pollInterval = 1000 // 1 second

      while (true) {
        if (abortController.signal.aborted) {
          throw new Error("Task cancelled")
        }

        const elapsed = Date.now() - startTime
        if (elapsed > timeout) {
          throw new Error(`Task timeout after ${timeout / 1000} seconds`)
        }

        const statusResult = await client.session.status().catch(() => null)
        const statuses = (statusResult?.data ?? {}) as Record<string, { type: string }>
        const sessionStatus = statuses[sessionId]
        if (sessionStatus && sessionStatus.type !== "idle") {
          await new Promise((resolve) => setTimeout(resolve, pollInterval))
          continue
        }

        const messagesResult = await client.session.messages({
          path: { id: sessionId },
        }).catch(() => null)
        const messages = ((messagesResult as { data?: unknown } | null)?.data ??
          []) as SessionMessage[]
        const lastAssistant = getLastAssistant(messages)
        const isFinal = !!lastAssistant?.info?.finish && !NON_TERMINAL_FINISH_REASONS.has(lastAssistant.info.finish)
        const hasOutput = !!lastAssistant && extractTextFromMessage(lastAssistant).trim().length > 0
        if (isFinal || hasOutput) {
          const result = lastAssistant ? extractTextFromMessage(lastAssistant) : ""
          updateTaskStatus(taskId, "completed", {
            completedAt: new Date(),
            result,
          })
          addProgress(taskId, "Task completed successfully", "success")
          onProgress?.({ timestamp: new Date(), message: "Task completed", type: "success" })
          return
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, pollInterval))
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      if (errorMessage === "Task cancelled") {
        updateTaskStatus(taskId, "cancelled", {
          completedAt: new Date(),
          error: errorMessage,
        })
        addProgress(taskId, "Task was cancelled", "warning")
      } else {
        updateTaskStatus(taskId, "failed", {
          completedAt: new Date(),
          error: errorMessage,
        })
        addProgress(taskId, `Task failed: ${errorMessage}`, "error")
      }
      onProgress?.({
        timestamp: new Date(),
        message: errorMessage,
        type: errorMessage === "Task cancelled" ? "warning" : "error",
      })
    } finally {
      abortControllers.delete(taskId)
    }
  }

  return {
    async createTask(options: CreateBackgroundTaskOptions): Promise<string> {
      const taskId = generateTaskId()
      const description = options.description ?? `${options.agent} task`

      const task: BackgroundTaskMeta = {
        taskId,
        agent: options.agent,
        description,
        prompt: options.prompt,
        status: "pending",
        createdAt: new Date(),
        progress: [],
        parentContext: {
          sessionID: options.ctx.sessionID,
          messageID: options.ctx.messageID,
          directory: options.ctx.directory,
          worktree: options.ctx.worktree,
        },
      }

      tasks.set(taskId, task)

      // Track pending task for notifications
      const parentSessionID = options.ctx.sessionID
      if (!pendingByParent.has(parentSessionID)) {
        pendingByParent.set(parentSessionID, new Set())
      }
      pendingByParent.get(parentSessionID)!.add(taskId)

      // Start execution in background (don't await)
      executeTask(taskId, options)
        .then(() => {
          // Send notification immediately when task completes
          const completedTask = tasks.get(taskId)
          if (completedTask) {
            sendNotification(completedTask).catch(() => {
              // Ignore notification errors
            })
          }
        })
        .catch(() => {
          // Still send notification on error
          const failedTask = tasks.get(taskId)
          if (failedTask) {
            sendNotification(failedTask).catch(() => {
              // Ignore notification errors
            })
          }
        })

      return taskId
    },

    getTask(taskId: string): BackgroundTaskMeta | undefined {
      return tasks.get(taskId)
    },

    getAllTasks(): BackgroundTaskMeta[] {
      return Array.from(tasks.values())
    },

    getTasksByStatus(status: BackgroundTaskStatus): BackgroundTaskMeta[] {
      return this.getAllTasks().filter((task) => task.status === status)
    },

    async cancelTask(taskId: string): Promise<boolean> {
      const controller = abortControllers.get(taskId)
      if (!controller) return false

      controller.abort()
      updateTaskStatus(taskId, "cancelled", { completedAt: new Date() })
      return true
    },

    async getTaskOutput(taskId: string): Promise<string> {
      const task = tasks.get(taskId)
      if (!task) {
        throw new Error(`Task not found: ${taskId}`)
      }

      if (task.status === "completed" && task.result) {
        return task.result
      }

      if (task.status === "failed") {
        return `Task failed: ${task.error}`
      }

      if (task.status === "cancelled") {
        return "Task was cancelled"
      }

      // For running tasks, return progress summary
      const progressLines = task.progress.map(
        (p) => `[${p.timestamp.toISOString()}] ${p.type.toUpperCase()}: ${p.message}`
      )
      return `Task is ${task.status}...\n\nProgress:\n${progressLines.join("\n")}`
    },

    async waitForTask(taskId: string, timeout = 600000): Promise<BackgroundTaskMeta> {
      const limit = Number.isFinite(timeout) && timeout > 0 ? timeout : 600000
      const startTime = Date.now()
      const pollInterval = 500

      while (true) {
        const task = tasks.get(taskId)
        if (!task) {
          throw new Error(`Task not found: ${taskId}`)
        }

        if (task.status === "completed" || task.status === "failed" || task.status === "cancelled") {
          return task
        }

        const elapsed = Date.now() - startTime
        if (elapsed > limit) {
          throw new Error(`Timeout waiting for task ${taskId}`)
        }

        await new Promise((resolve) => setTimeout(resolve, pollInterval))
      }
    },

    cleanup(maxAge = 3600000): number {
      const now = Date.now()
      let cleaned = 0

      for (const [taskId, task] of tasks) {
        if (
          (task.status === "completed" || task.status === "failed" || task.status === "cancelled") &&
          task.completedAt &&
          now - task.completedAt.getTime() > maxAge
        ) {
          tasks.delete(taskId)
          cleaned++
        }
      }

      return cleaned
    },

    getTaskCount(): number {
      return tasks.size
    },
  }
}

/**
 * Get system prompt for an agent type
 */
function getAgentSystemPrompt(agent: string): string {
  // Fallback prompts for background tasks when no explicit system prompt is provided.
  const prompts: Record<string, string> = {
    kiroExplore: "You are a fast codebase exploration agent.",
    "requirements-first-workflow": "You are a requirements-first workflow agent.",
    "spec-task-execution": "You are a spec-driven task execution agent.",
    "context-gatherer": "You are a context gathering agent.",
    "general-task-execution": "You are a general task execution agent.",
  }
  return prompts[agent] || `You are a ${agent} agent.`
}

/**
 * Extract text content from a message
 */
function extractTextFromMessage(message: {
  content?: unknown
  parts?: Array<{ type: string; text?: string }>
}): string {
  if ("parts" in message && Array.isArray(message.parts)) {
    return message.parts
      .filter((part) => part.type === "text" || part.type === "reasoning")
      .map((part) => part.text ?? "")
      .join("\n")
  }

  if ("content" in message) {
    const content = message.content
    if (typeof content === "string") return content
    if (Array.isArray(content)) {
      return content
        .filter((part): part is { type: "text"; text: string } => part.type === "text")
        .map((part) => part.text)
        .join("\n")
    }
    return String(content)
  }

  return ""
}

function getLastAssistant(messages: SessionMessage[]): SessionMessage | undefined {
  return messages
    .map((msg, index) => ({ msg, order: getMessageOrder(msg, index) }))
    .filter((item) => item.msg.info?.role === "assistant")
    .sort((a, b) => b.order - a.order)
    .at(0)?.msg
}

function getMessageOrder(message: SessionMessage, index: number): number {
  const created = message.info?.time?.created
  if (typeof created === "number" && Number.isFinite(created)) return created
  const numericId = Number(message.info?.id)
  if (Number.isFinite(numericId)) return numericId
  return index
}
