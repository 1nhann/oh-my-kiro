/**
 * Background Task Types
 * Types for managing background subagent tasks
 */

import type { ToolContextWithExtras } from "../tools/kiro-specific/subagent/types"

/**
 * Background task status
 */
export type BackgroundTaskStatus =
  | "pending"    // Task created but not started
  | "running"   // Task is currently executing
  | "completed" // Task finished successfully
  | "failed"    // Task failed with error
  | "cancelled" // Task was cancelled by user

/**
 * Background task metadata for tracking
 */
export interface BackgroundTaskMeta {
  /** Unique task ID */
  taskId: string
  /** Agent type used */
  agent: string
  /** Short description for notifications */
  description: string
  /** Original prompt */
  prompt: string
  /** Task status */
  status: BackgroundTaskStatus
  /** Creation timestamp */
  createdAt: Date
  /** Start timestamp */
  startedAt?: Date
  /** Completion timestamp */
  completedAt?: Date
  /** Session ID for the subagent */
  sessionId?: string
  /** Result when completed */
  result?: string
  /** Error message if failed */
  error?: string
  /** Progress updates */
  progress: ProgressUpdate[]
  /** Parent context for callbacks */
  parentContext: {
    sessionID: string
    messageID: string
    directory: string
    worktree: string
  }
}

/**
 * Progress update from a background task
 */
export interface ProgressUpdate {
  timestamp: Date
  message: string
  type: "info" | "warning" | "error" | "success"
}

/**
 * Options for creating a background task
 */
export interface CreateBackgroundTaskOptions {
  agent: string
  /** Short description for notifications */
  description?: string
  prompt: string
  ctx: ToolContextWithExtras
  onProgress?: (update: ProgressUpdate) => void
  /** Model to use for the background task (inherited from parent session) */
  model?: { providerID: string; modelID: string }
}

/**
 * Background task manager interface
 */
export interface BackgroundTaskManager {
  /** Create and start a new background task */
  createTask(options: CreateBackgroundTaskOptions): Promise<string>

  /** Get task by ID */
  getTask(taskId: string): BackgroundTaskMeta | undefined

  /** Get all tasks */
  getAllTasks(): BackgroundTaskMeta[]

  /** Get tasks by status */
  getTasksByStatus(status: BackgroundTaskStatus): BackgroundTaskMeta[]

  /** Cancel a running task */
  cancelTask(taskId: string): Promise<boolean>

  /** Get task output (partial or complete) */
  getTaskOutput(taskId: string): Promise<string>

  /** Wait for task completion */
  waitForTask(taskId: string, timeout?: number): Promise<BackgroundTaskMeta>

  /** Clean up completed/failed tasks older than maxAge ms */
  cleanup(maxAge?: number): number

  /** Get task count */
  getTaskCount(): number
}

/**
 * Message stored for background task communication
 */
export interface BackgroundTaskMessage {
  taskId: string
  type: "status" | "progress" | "result" | "error"
  payload: unknown
  timestamp: Date
}
