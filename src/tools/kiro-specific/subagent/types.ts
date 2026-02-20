/**
 * Types for subagent invocation
 */

import type { PluginInput } from "@opencode-ai/plugin"

export type OpencodeClient = PluginInput["client"]

export interface ToolContextWithExtras {
  sessionID: string
  messageID: string
  agent: string
  directory: string
  worktree: string
  abort: AbortSignal
  metadata: (input: { title?: string; metadata?: Record<string, unknown> }) => void | Promise<void>
  callID?: string
  /** Model info from parent session (optional, may be fetched from API if not provided) */
  model?: { providerID: string; modelID: string }
}

export interface SubagentSessionMessage {
  info: {
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
