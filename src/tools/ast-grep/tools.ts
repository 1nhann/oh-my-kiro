/**
 * AST-grep Tools for Kiro
 * AST-based code search and replace across 25+ programming languages
 */

import type { PluginInput } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { CLI_LANGUAGES } from "./constants"
import { runSg } from "./cli"
import { formatSearchResult, formatReplaceResult } from "./result-formatter"
import type { CliLanguage } from "./types"

const z = tool.schema

function getEmptyResultHint(pattern: string, lang: CliLanguage): string | null {
  const src = pattern.trim()

  if (lang === "python") {
    if (src.startsWith("class ") && src.endsWith(":")) {
      const withoutColon = src.slice(0, -1)
      return `Hint: Remove trailing colon. Try: "${withoutColon}"`
    }
    if ((src.startsWith("def ") || src.startsWith("async def ")) && src.endsWith(":")) {
      const withoutColon = src.slice(0, -1)
      return `Hint: Remove trailing colon. Try: "${withoutColon}"`
    }
  }

  if (["javascript", "typescript", "tsx"].includes(lang)) {
    if (/^(export\s+)?(async\s+)?function\s+\$[A-Z_]+\s*$/i.test(src)) {
      return `Hint: Function patterns need params and body. Try "function $NAME($$$) { $$$ }"`
    }
  }

  return null
}

/**
 * Create AST-grep search tool
 */
export function createAstGrepSearchTool(ctx: PluginInput) {
  return tool({
    description:
      "Search code patterns across filesystem using AST-aware matching. Supports 25 languages. " +
      "Use meta-variables: $VAR (single node), $$$ (multiple nodes). " +
      "IMPORTANT: Patterns must be complete AST nodes (valid code). " +
      "For functions, include params and body: 'export async function $NAME($$$) { $$$ }' not 'export async function $NAME'. " +
      "Examples: 'console.log($MSG)', 'def $FUNC($$$):', 'async function $NAME($$$)'",
    args: {
      pattern: z.string().describe("AST pattern with meta-variables ($VAR, $$$). Must be complete AST node."),
      lang: z.enum(CLI_LANGUAGES).describe("Target language"),
      paths: z.array(z.string()).optional().describe("Paths to search (default: ['.'])"),
      globs: z.array(z.string()).optional().describe("Include/exclude globs (prefix ! to exclude)"),
      context: z.number().optional().describe("Context lines around match"),
    },
    execute: async (args) => {
      try {
        const result = await runSg({
          pattern: args.pattern as string,
          lang: args.lang as CliLanguage,
          paths: args.paths ?? [ctx.worktree],
          globs: args.globs,
          context: args.context,
        })

        let output = formatSearchResult(result)

        if (result.matches.length === 0 && !result.error) {
          const hint = getEmptyResultHint(args.pattern as string, args.lang as CliLanguage)
          if (hint) {
            output += `\n\n${hint}`
          }
        }

        return output
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })
}

/**
 * Create AST-grep replace tool
 */
export function createAstGrepReplaceTool(ctx: PluginInput) {
  return tool({
    description:
      "Replace code patterns across filesystem with AST-aware rewriting. " +
      "Dry-run by default. Use meta-variables in rewrite to preserve matched content. " +
      "Example: pattern='console.log($MSG)' rewrite='logger.info($MSG)'",
    args: {
      pattern: z.string().describe("AST pattern to match"),
      rewrite: z.string().describe("Replacement pattern (can use $VAR from pattern)"),
      lang: z.enum(CLI_LANGUAGES).describe("Target language"),
      paths: z.array(z.string()).optional().describe("Paths to search"),
      globs: z.array(z.string()).optional().describe("Include/exclude globs"),
      dryRun: z.boolean().optional().describe("Preview changes without applying (default: true)"),
    },
    execute: async (args) => {
      try {
        const result = await runSg({
          pattern: args.pattern as string,
          rewrite: args.rewrite as string,
          lang: args.lang as CliLanguage,
          paths: args.paths ?? [ctx.worktree],
          globs: args.globs,
          updateAll: args.dryRun === false,
        })
        return formatReplaceResult(result, args.dryRun !== false)
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`
      }
    },
  })
}
