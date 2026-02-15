/**
 * Session Poller for Subagent Invocation
 * Polls the session until it completes or times out
 */

import type { OpencodeClient, PollSessionInput, SubagentSessionMessage, ToolContextWithExtras } from "./types"

/** Finish reasons that indicate session is still running */
const NON_TERMINAL_FINISH_REASONS = new Set(["tool-calls", "unknown"])

/** Polling configuration */
const POLL_CONFIG = {
  /** Maximum time to poll (10 minutes) */
  MAX_POLL_TIME_MS: 600_000,
  /** Interval between polls */
  POLL_INTERVAL_MS: 500,
}

function getMessageOrder(msg: SubagentSessionMessage, index: number): number {
  const created = msg.info?.time?.created
  if (typeof created === "number" && Number.isFinite(created)) {
    return created
  }
  const numericId = Number(msg.info?.id)
  if (Number.isFinite(numericId)) {
    return numericId
  }
  return index
}

/**
 * Check if session is complete based on messages
 */
export function isSessionComplete(messages: SubagentSessionMessage[]): boolean {
  const ordered = messages
    .map((msg, index) => ({ msg, order: getMessageOrder(msg, index) }))
    .sort((a, b) => a.order - b.order)
  const lastUser = ordered.filter((item) => item.msg.info?.role === "user").at(-1)
  const lastAssistant = ordered.filter((item) => item.msg.info?.role === "assistant").at(-1)
  if (!lastAssistant?.msg.info?.finish) return false
  if (NON_TERMINAL_FINISH_REASONS.has(lastAssistant.msg.info.finish)) return false
  if (!lastUser) return true
  return lastAssistant.order > lastUser.order
}

/**
 * Poll session until completion
 */
export async function pollSubagentSession(
  ctx: ToolContextWithExtras,
  client: OpencodeClient,
  input: PollSessionInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const pollStart = Date.now()
  let pollCount = 0

  while (Date.now() - pollStart < POLL_CONFIG.MAX_POLL_TIME_MS) {
    // Check for abort signal
    if (ctx.abort?.aborted) {
      return { ok: false, error: `Task aborted by user.\n\nSession ID: ${input.sessionID}` }
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, POLL_CONFIG.POLL_INTERVAL_MS))
    pollCount++

    // Check session status
    let statusResult: { data?: Record<string, { type: string }> }
    try {
      statusResult = await client.session.status()
    } catch {
      // Retry on error
      continue
    }

    const allStatuses = (statusResult.data ?? {}) as Record<string, { type: string }>
    const sessionStatus = allStatuses[input.sessionID]

    // If session is not idle, it's still processing
    if (sessionStatus && sessionStatus.type !== "idle") {
      continue
    }

    // Fetch messages to check completion
    let messagesResult: { data?: unknown } | SubagentSessionMessage[]
    try {
      messagesResult = await client.session.messages({ path: { id: input.sessionID } })
    } catch {
      continue
    }

    const rawData = (messagesResult as { data?: unknown })?.data ?? messagesResult
    const messages = Array.isArray(rawData) ? (rawData as SubagentSessionMessage[]) : []

    // Check if session is complete
    if (isSessionComplete(messages)) {
      return { ok: true }
    }

    // Fallback: check for assistant text content (some agents don't set finish properly)
    const lastAssistant = [...messages].reverse().find((m) => m.info?.role === "assistant")
    const hasAssistantText = messages.some((m) => {
      if (m.info?.role !== "assistant") return false
      const parts = m.parts ?? []
      return parts.some((p) => {
        if (p.type !== "text" && p.type !== "reasoning") return false
        const text = (p.text ?? "").trim()
        return text.length > 0
      })
    })

    if (!lastAssistant?.info?.finish && hasAssistantText) {
      return { ok: true }
    }
  }

  // Timeout reached
  return {
    ok: false,
    error: `Poll timeout reached after ${POLL_CONFIG.MAX_POLL_TIME_MS}ms for session ${input.sessionID}`,
  }
}
