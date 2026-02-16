/**
 * Permission Compatibility Helper
 */

export function createAgentToolAllowlist(tools: string[]) {
  const permission: Record<string, string> = { "*": "deny" }
  for (const tool of tools) {
    permission[tool] = "allow"
  }
  return { permission }
}
