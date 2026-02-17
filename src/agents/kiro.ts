import { loadAgentPrompt } from "./loader"

const SUBAGENTS = [
  "requirements-first-workflow",
  "spec-task-execution",
  "context-gatherer",
  "general-task-execution",
] as const

type SubagentName = (typeof SUBAGENTS)[number]

function basePermission(lookAtEnabled: boolean = true) {
  return {
    prework: "allow",
    kiroSpecTaskStatus: "allow",
    updatePBTStatus: "allow",
    task: "allow",

    backgroundTask: "allow",
    backgroundTaskStatus: "allow",
    backgroundTaskOutput: "allow",
    backgroundTaskCancel: "allow",
    listBackgroundTasks: "allow",

    astGrepSearch: "allow",
    astGrepReplace: "allow",
    // Only include lookAt permission if the feature is enabled
    ...(lookAtEnabled ? { lookAt: "allow" as const } : {}),
    kiroGetDiagnostics: "allow",
    kiroRenameSymbol: "allow",

    read: "allow",
    write: "allow",
    edit: "allow",
    list: "allow",
    glob: "allow",
    grep: "allow",
    bash: "allow",
    lsp: "allow",
    codesearch: "allow",
    question: "allow",
    webfetch: "allow",
    websearch: "allow",
    skill: "allow",
    todowrite: "allow",
    doom_loop: "ask",
  } as const
}

/**
 * Create the Kiro agent configuration
 *
 * The permission table is aligned with the actual tools registered in the plugin.
 * Tools are grouped by category for easier maintenance.
 */
export function createKiroAgent(model: string = "openai/gpt-5.3-codex", lookAtEnabled: boolean = true) {
  const prompt = loadAgentPrompt("orchestrator", model, lookAtEnabled)

  if (!prompt) {
    console.error("Failed to load orchestrator prompt")
    return null
  }

  return {
    name: "kiro",
    description: "Kiro: Spec-Driven Development Orchestrator. Manages the lifecycle of features from requirements to implementation using a team of specialized agents.",
    mode: "primary",
    model,
    prompt,
    temperature: 0.1,
    color: "#8142E6",
    permission: basePermission(lookAtEnabled),
  }
}

function desc(name: SubagentName) {
  if (name === "requirements-first-workflow") {
    return "Guides requirements -> design -> tasks workflow for spec creation."
  }
  if (name === "spec-task-execution") {
    return "Implements a single spec task with tests and validation."
  }
  if (name === "context-gatherer") {
    return "Quickly gathers focused context across files for a request."
  }
  return "General-purpose implementation and execution specialist."
}

export function createKiroSubagents(model: string = "openai/gpt-5.3-codex", lookAtEnabled: boolean = true) {
  const agents: Record<string, {
    name: SubagentName
    description: string
    mode: "subagent"
    hidden: true
    model: string
    prompt: string
    temperature: number
    permission: ReturnType<typeof basePermission>
  }> = {}

  for (const name of SUBAGENTS) {
    const prompt = loadAgentPrompt(name, model, lookAtEnabled)
    if (!prompt) continue
    agents[name] = {
      name,
      description: desc(name),
      mode: "subagent",
      hidden: true,
      model,
      prompt,
      temperature: 0.1,
      permission: basePermission(lookAtEnabled),
    }
  }

  return agents
}
