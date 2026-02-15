/**
 * Prompt Sender for Subagent Invocation
 */

import type { OpencodeClient, SendPromptInput } from "./types"

export async function sendSubagentPrompt(
  client: OpencodeClient,
  input: SendPromptInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await client.session.prompt({
      path: { id: input.sessionID },
      body: {
        agent: input.agentName,
        system: input.systemPrompt,
        parts: [{ type: "text", text: input.prompt }],
      },
    })

    return { ok: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (errorMessage.includes("agent.name") || errorMessage.includes("undefined")) {
      return {
        ok: false,
        error: `Agent "${input.agentName}" not found. Make sure the agent is registered in opencode.json or provided by the kiro plugin.`,
      }
    }

    return {
      ok: false,
      error: `Failed to send prompt to session: ${errorMessage}`,
    }
  }
}
