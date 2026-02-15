import type { PluginInput } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import type { ToolDef } from "../../plugin/types"
import { lsp_diagnostics } from "./diagnostics-tool"
import { lsp_prepare_rename, lsp_rename } from "./rename-tools"

export function createGetDiagnosticsTool(_ctx: PluginInput): ToolDef {
  return tool({
    description: lsp_diagnostics.description,
    args: {
      file: tool.schema.string().optional().describe("Absolute or workspace-relative file path"),
      filePath: tool.schema.string().optional().describe("Alias of file"),
      severity: tool.schema
        .enum(["error", "warning", "information", "hint", "all"])
        .optional()
        .describe("Filter by severity level"),
    },
    execute: async (args, toolContext) => {
      const file = args.file || args.filePath || ""
      const severity = args.severity
      if (file.trim() === "") {
        return "Error: 'file' is required for kiroGetDiagnostics."
      }
      try {
        return await lsp_diagnostics.execute({
          filePath: file,
          severity,
        }, toolContext as Parameters<typeof lsp_diagnostics.execute>[1])
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        return `Error: ${msg}`
      }
    },
  })
}

export function createRenameSymbolTool(_ctx: PluginInput): ToolDef {
  return tool({
    description: lsp_rename.description,
    args: {
      file: tool.schema.string().describe("Absolute or workspace-relative file path"),
      line: tool.schema.number().describe("0-based line index"),
      character: tool.schema.number().describe("1-based column index"),
      newName: tool.schema.string().describe("Target symbol name"),
    },
    execute: async (args, toolContext) => {
      const prepare = await lsp_prepare_rename.execute({
        filePath: args.file,
        line: args.line,
        character: Math.max(args.character - 1, 0),
      }, toolContext as Parameters<typeof lsp_prepare_rename.execute>[1])

      if (typeof prepare === "string" && prepare.startsWith("Cannot rename")) {
        return prepare
      }

      return lsp_rename.execute({
        filePath: args.file,
        line: args.line,
        character: Math.max(args.character - 1, 0),
        newName: args.newName,
      }, toolContext as Parameters<typeof lsp_rename.execute>[1])
    },
  })
}

export function createLSPTools(ctx: PluginInput): Record<string, ToolDef> {
  return {
    kiroGetDiagnostics: createGetDiagnosticsTool(ctx),
    kiroRenameSymbol: createRenameSymbolTool(ctx),
  }
}
