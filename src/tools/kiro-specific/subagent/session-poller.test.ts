import { describe, expect, test } from "bun:test"
import { isSessionComplete } from "./session-poller"
import type { SubagentSessionMessage } from "./types"

function msg(input: Partial<SubagentSessionMessage["info"]>): SubagentSessionMessage {
  return {
    info: {
      role: input.role,
      id: input.id,
      finish: input.finish,
      time: input.time,
    },
    parts: [],
  }
}

describe("isSessionComplete", () => {
  test("returns true when final assistant message is terminal and newer than user", () => {
    const messages = [
      msg({ role: "user", id: "1", time: { created: 100 } }),
      msg({ role: "assistant", id: "2", finish: "stop", time: { created: 200 } }),
    ]

    expect(isSessionComplete(messages)).toBe(true)
  })

  test("returns false for non-terminal assistant finish", () => {
    const messages = [
      msg({ role: "user", id: "1", time: { created: 100 } }),
      msg({ role: "assistant", id: "2", finish: "tool-calls", time: { created: 200 } }),
    ]

    expect(isSessionComplete(messages)).toBe(false)
  })

  test("uses created time instead of lexical id ordering", () => {
    const messages = [
      msg({ role: "user", id: "9", time: { created: 200 } }),
      msg({ role: "assistant", id: "10", finish: "stop", time: { created: 100 } }),
      msg({ role: "assistant", id: "2", finish: "stop", time: { created: 300 } }),
    ]

    expect(isSessionComplete(messages)).toBe(true)
  })

  test("returns true for terminal assistant when no user message exists", () => {
    const messages = [msg({ role: "assistant", id: "1", finish: "stop", time: { created: 100 } })]

    expect(isSessionComplete(messages)).toBe(true)
  })
})

