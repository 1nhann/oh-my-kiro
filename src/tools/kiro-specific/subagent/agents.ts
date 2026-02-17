/**
 * Shared subagent definitions.
 */

export const SUBAGENT_NAME_MAPPING = {
  kiroExplore: "kiro",
  "requirements-first-workflow": "kiro",
  "spec-task-execution": "kiro",
  "context-gatherer": "kiro",
  "general-task-execution": "kiro",
} as const

export type SubagentName = keyof typeof SUBAGENT_NAME_MAPPING

export function isSubagentName(name: string): name is SubagentName {
  return name in SUBAGENT_NAME_MAPPING
}
