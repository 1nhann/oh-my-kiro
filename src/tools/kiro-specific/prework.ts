/**
 * Prework Tool
 * Stores prework analysis in conversation context for generating correctness properties
 */

import type { PluginInput } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"

const z = tool.schema

/**
 * Create prework tool for acceptance criteria testing
 *
 * This tool is used before writing Correctness Properties in the design document.
 * It analyzes each acceptance criterion for testability and stores the result
 * in conversation context for later reference.
 */
export function createPreworkTool(ctx: PluginInput) {
  return tool({
    description: `Performs acceptance criteria testing prework for property-based testing workflow.

Usage: Use this tool BEFORE writing the Correctness Properties section in design.md.

Purpose: Analyze each acceptance criterion to determine if it's testable and how.

Format of preworkAnalysis:
X.Y Criterion Name
  Thoughts: Step-by-step analysis of whether this requirement is testable
  Testable: yes - property | yes - example | no | edge-case

Categories:
- yes - property: Can be tested as a universal property (applies to all inputs)
- yes - example: Can be tested with specific examples
- edge-case: Edge case that should be covered by property generators
- no: Not testable (e.g., UI aesthetics, subjective qualities)

The analysis result is stored in context and used to guide correctness property generation.`,
    args: {
      featureName: z.string().describe("The name of the feature being designed (e.g., 'user-auth')"),
      preworkAnalysis: z.string().describe(`The complete prework analysis following the format:
X.Y Criterion Name
  Thoughts: Analysis of testability
  Testable: yes - property | yes - example | no | edge-case`),
    },
    execute: async (args) => {
      const name = String(args.featureName).trim()
      if (!name) {
        return "Error: featureName cannot be empty."
      }

      // Return the analysis - it will be in the conversation context
      // for the AI to reference when writing Correctness Properties
      return `Prework analysis completed for feature: ${name}

${args.preworkAnalysis}

---

This analysis is now in context. Use it to:
1. Identify which acceptance criteria can become property-based tests
2. Guide the writing of Correctness Properties in design.md
3. Eliminate redundant properties during Property Reflection`
    },
  })
}
