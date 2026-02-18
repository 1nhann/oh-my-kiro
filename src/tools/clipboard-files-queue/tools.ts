/**
 * Clipboard Files Queue Management Tools
 * Tools for listing, viewing, and managing saved clipboard files
 */

import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import { getClipboardFilesQueueManager } from "../../clipboard-files-queue"
import { log } from "../../shared/logger"

const LIST_CLIPBOARD_FILES_QUEUE_DESCRIPTION = `List all files currently saved in the clipboard files queue.
The queue contains pasted/clipboard files (images, etc.) that have been automatically saved.
Use this tool to see available files before using lookAt with index.

Index convention:
- index=-1: most recent file (last pasted)
- index=-2: second most recent
- index=0: oldest file in queue`

const CLEAR_CLIPBOARD_FILES_QUEUE_DESCRIPTION = `Clear all files from the clipboard files queue for the current session.
This will permanently delete all saved clipboard files in this session.
Use with caution - this action cannot be undone.`

const REMOVE_FILE_FROM_QUEUE_DESCRIPTION = `Remove a specific file from the clipboard files queue for the current session.
Provide the file ID (from listClipboardFilesQueue).
The file will be permanently deleted.`

/**
 * Create the listClipboardFilesQueue tool
 */
export function createListClipboardFilesQueueTool(): ToolDefinition {
  return tool({
    description: LIST_CLIPBOARD_FILES_QUEUE_DESCRIPTION,
    args: {},
    async execute(_args, context) {
      try {
        const queueManager = getClipboardFilesQueueManager()
        await queueManager.initialize()

        // Only get files for current session (session isolation)
        const sessionFiles = queueManager.getBySession(context.sessionID)

        if (sessionFiles.length === 0) {
          return "No files in the clipboard queue for this session. Paste a file in a chat to add it to the queue."
        }

        const totalSize = sessionFiles.reduce((sum, f) => sum + f.size, 0)

        const lines = [
          `Clipboard Files Queue (${sessionFiles.length} files, ${(totalSize / 1024).toFixed(1)} KB total)`,
          "",
          "| Index | Filename | Size | Path | Saved At |",
          "|-------|----------|------|------|----------|",
        ]

        for (let i = 0; i < sessionFiles.length; i++) {
          const file = sessionFiles[i]
          // Display index: -1 = most recent, -2 = second, 0 = oldest
          const displayIndex = -(i + 1)
          const date = new Date(file.savedAt).toLocaleString()
          const sizeKB = (file.size / 1024).toFixed(1)
          lines.push(`| ${displayIndex} | ${file.filename} | ${sizeKB} KB | ${file.path} | ${date} |`)
        }

        lines.push("")
        lines.push("Usage with lookAt:")
        lines.push("  - lookAt(index=-1, goal='describe the most recent file')")
        lines.push("  - lookAt(index=-2, goal='extract text from second file')")
        lines.push("  - lookAt(index=0, goal='analyze the oldest file')")

        return lines.join("\n")
      } catch (error) {
        log(`[listClipboardFilesQueue] Error: ${error}`)
        return `Error listing clipboard files queue: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  })
}

/**
 * Create the clearClipboardFilesQueue tool
 */
export function createClearClipboardFilesQueueTool(): ToolDefinition {
  return tool({
    description: CLEAR_CLIPBOARD_FILES_QUEUE_DESCRIPTION,
    args: {},
    async execute(_args, context) {
      try {
        const queueManager = getClipboardFilesQueueManager()
        await queueManager.initialize()

        // Only clear files for current session (session isolation)
        const sessionFiles = queueManager.getBySession(context.sessionID)

        if (sessionFiles.length === 0) {
          return "Clipboard files queue is already empty for this session."
        }

        // Remove each file in the session
        for (const file of sessionFiles) {
          await queueManager.removeById(file.id)
        }

        log(`[clearClipboardFilesQueue] Cleared ${sessionFiles.length} files from session ${context.sessionID}`)

        return `Successfully cleared ${sessionFiles.length} file(s) from the queue for this session.`
      } catch (error) {
        log(`[clearClipboardFilesQueue] Error: ${error}`)
        return `Error clearing clipboard files queue: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  })
}

/**
 * Create the removeFileFromQueue tool
 */
export function createRemoveFileFromQueueTool(): ToolDefinition {
  return tool({
    description: REMOVE_FILE_FROM_QUEUE_DESCRIPTION,
    args: {
      file_id: tool.schema.string().describe("ID of the file to remove (from listClipboardFilesQueue)"),
    },
    async execute(args, context) {
      try {
        const queueManager = getClipboardFilesQueueManager()
        await queueManager.initialize()

        if (!args.file_id) {
          return "Error: Must provide 'file_id'."
        }

        // Only allow removing files from current session (session isolation)
        const sessionFiles = queueManager.getBySession(context.sessionID)
        const file = sessionFiles.find(f => f.id === args.file_id)

        if (!file) {
          return `Error: No file found with ID: ${args.file_id} in this session.`
        }

        const description = `file ${file.filename} (${args.file_id})`
        const success = await queueManager.removeById(args.file_id)

        if (success) {
          log(`[removeFileFromQueue] Removed ${description} from session ${context.sessionID}`)
          return `Successfully removed ${description} from the queue.`
        } else {
          return `Failed to remove ${description}.`
        }
      } catch (error) {
        log(`[removeFileFromQueue] Error: ${error}`)
        return `Error removing file: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  })
}

/**
 * Create all clipboard files queue management tools
 */
export function createClipboardFilesQueueTools(): Record<string, ToolDefinition> {
  return {
    listClipboardFilesQueue: createListClipboardFilesQueueTool(),
    clearClipboardFilesQueue: createClearClipboardFilesQueueTool(),
    removeFileFromQueue: createRemoveFileFromQueueTool(),
  }
}
