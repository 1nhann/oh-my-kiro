/**
 * Sub-Agent Invocation Tool
 * Real implementation that creates and manages actual subagent sessions
 */

import type { PluginInput } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { loadAgentPrompt } from "../../agents/loader"
import { createExploreAgent } from "../../agents/explore-agent"
import {
  createSubagentSession,
  sendSubagentPrompt,
  pollSubagentSession,
  fetchSubagentResult,
  type ToolContextWithExtras,
  type OpencodeClient,
} from "./subagent"
import { SUBAGENT_NAME_MAPPING, isSubagentName } from "./subagent/agents"

const z = tool.schema

/** Get the system prompt for a given agent */
function getAgentPrompt(agentName: string): string | null {
  // Check for TS-based agents first
  if (agentName === "explore") {
    const config = createExploreAgent()
    return config.prompt
  }

  // Fallback to embedded prompts
  return loadAgentPrompt(agentName)
}

/** Format duration for display */
function formatDuration(startTime: Date): string {
  const elapsed = Date.now() - startTime.getTime()
  const seconds = Math.floor(elapsed / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`
  }
  return `${seconds}s`
}

/**
 * Create sub-agent invocation tool
 */
export function createInvokeSubAgentTool(ctx: PluginInput) {
  const client = ctx.client as OpencodeClient

  return tool({
    description: `Invoke a specialized subagent to handle a delegated task. The subagent runs in a separate session with full tool access.

Available subagents:
- explore: Fast codebase exploration and file discovery
- requirements-first-workflow: Guides requirements → design → tasks workflow
- spec-task-execution: Implements predefined tasks from specs
- context-gatherer: Fast context gathering for codebase questions
- general-task-execution: General-purpose task execution

This is a SYNCHRONOUS call - waits for the subagent to complete before returning.

Returns the subagent's response text along with session_id for follow-up if needed.`,
    args: {
      name: z.string().describe("Name of the subagent to invoke (explore, requirements-first-workflow, spec-task-execution, context-gatherer, general-task-execution)"),
      prompt: z.string().describe("The detailed task instruction for the subagent"),
      explanation: z.string().optional().describe("Optional short description of why this subagent is being invoked"),
      session_id: z.string().optional().describe("Optional: Continue an existing session instead of creating a new one"),
    },
    execute: async (args, toolCtx) => {
      const ctx = toolCtx as ToolContextWithExtras

      // Validate agent name
      if (!isSubagentName(args.name)) {
        return `Error: Unknown subagent '${args.name}'. Available subagents: ${Object.keys(SUBAGENT_NAME_MAPPING).join(", ")}`
      }
      const registeredAgent = SUBAGENT_NAME_MAPPING[args.name]

      // Get the agent's system prompt
      const agentPrompt = getAgentPrompt(args.name)
      if (!agentPrompt) {
        return `Error: Could not load prompt for subagent '${args.name}'. Check that the agent is properly configured.`
      }

      const startTime = new Date()

      try {
        let sessionID: string

        // Use existing session or create new one
        if (args.session_id) {
          const existingSession = args.session_id.trim()
          if (!existingSession) {
            return "Error: session_id cannot be empty."
          }
          sessionID = existingSession
        } else {
          // Create new session
          const sessionResult = await createSubagentSession(client, {
            parentSessionID: ctx.sessionID,
            agentName: registeredAgent,
            description: (args.explanation || args.prompt).slice(0, 50),
            defaultDirectory: ctx.directory,
          })

          if (!sessionResult.ok) {
            return sessionResult.error
          }

          sessionID = sessionResult.sessionID
        }

        // Update tool metadata
        await ctx.metadata?.({
          title: `Subagent: ${args.name}`,
          metadata: {
            subagent: args.name,
            sessionID,
            prompt: args.prompt.slice(0, 200),
          },
        })

        // Send prompt to subagent session
        const promptResult = await sendSubagentPrompt(client, {
          sessionID,
          agentName: registeredAgent,
          prompt: args.prompt,
          systemPrompt: agentPrompt,
        })

        if (!promptResult.ok) {
          return promptResult.error
        }

        // Poll for completion
        const pollResult = await pollSubagentSession(ctx, client, {
          sessionID,
          agentName: registeredAgent,
        })

        if (!pollResult.ok) {
          return pollResult.error
        }

        // Fetch result
        const result = await fetchSubagentResult(client, sessionID)
        if (!result.ok) {
          return result.error
        }

        const duration = formatDuration(startTime)

        // Return formatted result
        return `Subagent '${args.name}' completed in ${duration}.

---

${result.textContent || "(No text output)"}

<subagent_metadata>
session_id: ${sessionID}
agent: ${args.name}
</subagent_metadata>`
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        return `Error invoking subagent '${args.name}': ${errorMessage}`
      }
    },
  })
}
