/**
 * Prework Tool
 * Stores prework analysis to files for persistence
 */

import type { PluginInput } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { join, resolve, sep } from "path"
import { mkdirSync, writeFileSync, existsSync } from "fs"

const z = tool.schema

/**
 * Create prework tool for acceptance criteria testing
 */
export function createPreworkTool(ctx: PluginInput) {
  return tool({
    description: "Performs acceptance criteria testing prework. Saves the analysis to .kiro/prework/{featureName}.md for persistence.",
    args: {
      featureName: z.string().describe("The name of the feature being analyzed"),
      preworkAnalysis: z.string().describe("The prework analysis content to save"),
    },
    execute: async (args) => {
      const name = String(args.featureName).trim()
      if (!name) {
        return "Error saving prework: featureName cannot be empty."
      }
      if (name.includes("/") || name.includes("\\") || name === "." || name === "..") {
        return "Error saving prework: featureName must be a simple file name without path separators."
      }
      const preworkDir = resolve(ctx.worktree, ".kiro", "prework")
      const filePath = resolve(preworkDir, `${name}.md`)
      if (filePath !== preworkDir && !filePath.startsWith(preworkDir + sep)) {
        return "Error saving prework: path is outside workspace."
      }

      try {
        // Ensure directory exists
        if (!existsSync(preworkDir)) {
          mkdirSync(preworkDir, { recursive: true })
        }

        // Write the analysis
        writeFileSync(filePath, args.preworkAnalysis, "utf-8")

        return `Prework analysis saved to ${filePath}

The analysis has been persisted and can be referenced later for acceptance criteria testing.`
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e)
        return `Error saving prework: ${errorMessage}`
      }
    },
  })
}
