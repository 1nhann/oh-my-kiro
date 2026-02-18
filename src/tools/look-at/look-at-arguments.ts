import type { LookAtArgs } from "./types"

export interface LookAtArgsWithAlias extends LookAtArgs {
  path?: string
}

export function normalizeArgs(args: LookAtArgsWithAlias): LookAtArgs {
  return {
    file_path: args.file_path ?? args.path,
    goal: args.goal ?? "",
    index: args.index,
  }
}

export function validateArgs(args: LookAtArgs): string | null {
  const hasFilePath = Boolean(args.file_path && args.file_path.length > 0)
  const hasIndex = args.index !== undefined && args.index !== null

  if (hasFilePath && /^https?:\/\//i.test(args.file_path!)) {
    return "Error: Remote URLs are not supported for file_path. Download the file first or use a local path."
  }

  // Count how many input sources are provided
  const sourceCount = [hasFilePath, hasIndex].filter(Boolean).length
  if (sourceCount === 0) {
    return `Error: Must provide one of 'file_path' or 'index'. Usage:
- look_at(file_path="/path/to/file", goal="what to extract")
- look_at(index=-1, goal="analyze the most recent pasted image")
- look_at(index=-2, goal="analyze the second most recent image")`
  }
  if (sourceCount > 1) {
    return "Error: Provide only one input source: 'file_path' or 'index'."
  }
  if (!args.goal) {
    return "Error: Missing required parameter 'goal'. Usage: look_at(file_path=\"/path/to/file\", goal=\"what to extract\")"
  }
  return null
}
