/**
 * Clipboard Files Queue Types
 * Defines the data structures for managing saved clipboard files
 */

/**
 * Saved clipboard file metadata
 */
export interface SavedClipboardFile {
  /** Unique identifier for this file */
  id: string
  /** Original filename or generated name */
  filename: string
  /** MIME type (e.g., image/png, image/jpeg) */
  mime: string
  /** Absolute path to the saved file */
  path: string
  /** Timestamp when the file was saved */
  savedAt: number
  /** Session ID where the file was pasted */
  sessionID?: string
  /** Size in bytes */
  size: number
}

/**
 * Clipboard files queue configuration
 */
export interface ClipboardFilesQueueConfig {
  /** Maximum number of files to keep in the queue (default: 20) */
  maxSize: number
  /** Directory to save files (default: ~/.config/opencode/kiro/clipboard-files-queue) */
  saveDir?: string
  /** Auto-cleanup files older than this many hours (default: 24, 0 = disabled) */
  cleanupAfterHours: number
}

/**
 * Default clipboard files queue configuration
 */
export const DEFAULT_CLIPBOARD_FILES_QUEUE_CONFIG: ClipboardFilesQueueConfig = {
  maxSize: 20,
  cleanupAfterHours: 24,
}
