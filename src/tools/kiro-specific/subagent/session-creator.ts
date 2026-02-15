/**
 * Session Creator for Subagent Invocation
 */

import type { OpencodeClient, CreateSessionInput } from "./types"

export async function createSubagentSession(
  client: OpencodeClient,
  input: CreateSessionInput
): Promise<{ ok: true; sessionID: string; parentDirectory: string } | { ok: false; error: string }> {
  // Get parent session to inherit directory
  const parentSession = client.session.get
    ? await client.session.get({ path: { id: input.parentSessionID } }).catch(() => null)
    : null
  const parentDirectory = parentSession?.data?.directory ?? input.defaultDirectory

  // Create new session as child of parent
  const createResult = await client.session.create({
    body: {
      parentID: input.parentSessionID,
      title: `${input.description} (@${input.agentName})`,
    } as any,
    query: {
      directory: parentDirectory,
    },
  })

  if (createResult.error) {
    return { ok: false, error: `Failed to create session: ${createResult.error}` }
  }

  return { ok: true, sessionID: createResult.data.id, parentDirectory }
}
