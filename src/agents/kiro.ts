import { loadAgentPrompt } from "./loader"

/**
 * Create the Kiro agent configuration
 *
 * The permission table is aligned with the actual tools registered in the plugin.
 * Tools are grouped by category for easier maintenance.
 */
export function createKiroAgent(model: string = "zai-coding-plan/glm-5") {
  const prompt = loadAgentPrompt("orchestrator", model)

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
    permission: {
      // ============================================
      // Kiro-Specific Workflow Tools
      // ============================================
      invokeSubAgent: "allow",
      prework: "allow",
      kiroSpecTaskStatus: "allow",
      updatePBTStatus: "allow",

      // ============================================
      // Background Task Tools (Parallel Execution)
      // ============================================
      backgroundTask: "allow",
      backgroundTaskStatus: "allow",
      backgroundTaskOutput: "allow",
      backgroundTaskCancel: "allow",
      listBackgroundTasks: "allow",

      // ============================================
      // AST-Based Code Analysis Tools
      // ============================================
      astGrepSearch: "allow",
      astGrepReplace: "allow",

      // ============================================
      // Multimodal Analysis Tool
      // ============================================
      lookAt: "allow",

      // ============================================
      // LSP Tools (Code Intelligence)
      // ============================================
      kiroGetDiagnostics: "allow",
      kiroRenameSymbol: "allow",

      // ============================================
      // Native OpenCode Tools
      // These are provided by OpenCode core
      // ============================================
      // File operations (required for code development)
      read: "allow",
      write: "allow",
      edit: "allow",
      list: "allow",
      glob: "allow",
      grep: "allow",

      // Command execution
      bash: "allow",

      // Code intelligence
      lsp: "allow",
      codesearch: "allow",

      // User interaction (REQUIRED for requirements-first workflow)
      question: "allow",

      // Research capabilities (required for design phase)
      webfetch: "allow",
      websearch: "allow",

      // MCP and skills integration (REQUIRED for extensibility)
      skill: "allow",

      // Task tracking (helps agent write better code)
      todowrite: "allow",

      // ============================================
      // Safety
      // ============================================
      doom_loop: "ask",
    }
  }
}
