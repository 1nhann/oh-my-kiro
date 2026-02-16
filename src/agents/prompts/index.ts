import contextGatherer from "./context-gatherer"
import generalTaskExecution from "./general-task-execution"
import multimodalLooker from "./multimodal-looker"
import orchestrator from "./orchestrator"
import requirementsFirstWorkflow from "./requirements-first-workflow"
import specTaskExecution from "./spec-task-execution"

export const AGENT_PROMPTS = {
  orchestrator,
  "requirements-first-workflow": requirementsFirstWorkflow,
  "spec-task-execution": specTaskExecution,
  "context-gatherer": contextGatherer,
  "general-task-execution": generalTaskExecution,
  "multimodal-looker": multimodalLooker,
} as const

export function getPrompt(name: string): string | null {
  if (name === "kiro") return AGENT_PROMPTS.orchestrator
  if (name in AGENT_PROMPTS) return AGENT_PROMPTS[name as keyof typeof AGENT_PROMPTS]
  return null
}
