/**
 * Types for subagent invocation
 */

import type { PluginInput } from "@opencode-ai/plugin"

export type OpencodeClient = PluginInput["client"]

export interface InvokeSubAgentArgs {
  name: string
  prompt: string
  explanation: string
  /** Run subagent in background (returns session_id immediately) */
  run_in_background?: boolean
  /** Continue an existing session */
  session_id?: string
}

export interface ToolContextWithExtras {
  sessionID: string
  messageID: string
  agent: string
  directory: string
  worktree: string
  abort: AbortSignal
  metadata: (input: { title?: string; metadata?: Record<string, unknown> }) => void | Promise<void>
  callID?: string
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

export interface SubagentExecutorOptions {
  client: OpencodeClient
  directory: string
}

export interface CreateSessionInput {
  parentSessionID: string
  agentName: string
  description: string
  defaultDirectory: string
}

export interface SendPromptInput {
  sessionID: string
  agentName: string
  prompt: string
  systemPrompt?: string
}

export interface PollSessionInput {
  sessionID: string
  agentName: string
}

export interface SubagentResult {
  ok: boolean
  textContent?: string
  error?: string
  sessionID: string
}
