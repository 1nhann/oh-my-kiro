/**
 * Clipboard Files Queue Manager
 * Manages saved clipboard files for the lookAt tool
 *
 * Storage structure (follows XDG Base Directory Specification):
 * ~/.local/share/opencode/kiro/clipboard-files-queue/{sessionID}/{datetime}.{ext}
 *
 * This module provides functionality to:
 * 1. Save pasted files to disk (so they can be processed by non-vision models)
 * 2. Maintain a queue of files per session (most recent at front)
 * 3. Build queue from filesystem on startup
 * 4. Auto-cleanup old files
 */

import { mkdir, rm, readdir, stat } from "fs/promises"
import { existsSync } from "fs"
import { join, extname } from "path"
import { xdgData } from "xdg-basedir"
import { homedir } from "os"
import type { SavedClipboardFile, ClipboardFilesQueueConfig } from "./types"
import { DEFAULT_CLIPBOARD_FILES_QUEUE_CONFIG } from "./types"
import { log } from "../shared/logger"

// XDG data directory for opencode: ~/.local/share/opencode
// Fallback to ~/.local/share/opencode if xdgData is undefined
const OPENCODE_DATA_DIR = join(xdgData ?? join(homedir(), ".local", "share"), "opencode")

/**
 * Generate datetime filename for file storage
 * Format: YYYYMMDD-HHmmss-SSS
 */
function generateDatetimeFilename(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  const hours = String(now.getHours()).padStart(2, "0")
  const minutes = String(now.getMinutes()).padStart(2, "0")
  const seconds = String(now.getSeconds()).padStart(2, "0")
  const ms = String(now.getMilliseconds()).padStart(3, "0")
  return `${year}${month}${day}-${hours}${minutes}${seconds}-${ms}`
}

/**
 * Parse datetime from filename
 * Returns timestamp or 0 if parsing fails
 */
function parseDatetimeFromFilename(filename: string): number {
  // Expected format: YYYYMMDD-HHmmss-SSS.ext
  const match = filename.match(/^(\d{8})-(\d{6})-(\d{3})\.\w+$/)
  if (!match) return 0

  try {
    const [, datePart, timePart, msPart] = match
    const year = parseInt(datePart.substring(0, 4))
    const month = parseInt(datePart.substring(4, 6)) - 1
    const day = parseInt(datePart.substring(6, 8))
    const hours = parseInt(timePart.substring(0, 2))
    const minutes = parseInt(timePart.substring(2, 4))
    const seconds = parseInt(timePart.substring(4, 6))
    const ms = parseInt(msPart)

    return new Date(year, month, day, hours, minutes, seconds, ms).getTime()
  } catch {
    return 0
  }
}

/**
 * Generate a unique ID for files based on datetime
 */
function generateFileId(datetime: string): string {
  const random = Math.random().toString(36).substring(2, 6)
  return `cb_${datetime}_${random}`
}

/**
 * Get mime type from file extension
 */
function getMimeFromExtension(ext: string): string {
  const mimes: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    svg: "image/svg+xml",
  }
  return mimes[ext.toLowerCase()] || "image/png"
}

/**
 * Clipboard Files Queue Manager
 * Queue structure: index 0 = most recent, last index = oldest
 * Uses filesystem as source of truth - no separate metadata file
 */
export class ClipboardFilesQueueManager {
  private config: ClipboardFilesQueueConfig
  private baseDir: string
  private queue: SavedClipboardFile[] = []
  private initialized = false

  constructor(config: Partial<ClipboardFilesQueueConfig> = {}) {
    this.config = { ...DEFAULT_CLIPBOARD_FILES_QUEUE_CONFIG, ...config }
    // Use XDG data directory for storage (not config directory)
    this.baseDir = config.saveDir || join(OPENCODE_DATA_DIR, "kiro", "clipboard-files-queue")
  }

  /**
   * Initialize the manager - build queue from filesystem
   * Does NOT create directories - only reads existing files
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // Build queue from filesystem (don't create directories here)
      await this.buildQueueFromFilesystem()

      // Run cleanup if configured
      if (this.config.cleanupAfterHours > 0) {
        await this.cleanup()
      }

      this.initialized = true
      log(`[ClipboardFilesQueue] Initialized with ${this.queue.length} files`)
    } catch (error) {
      log(`[ClipboardFilesQueue] Initialize error: ${error}`)
      this.queue = []
      this.initialized = true
    }
  }

  /**
   * Build queue from filesystem by scanning session directories
   * Silently handles missing directories (normal when no files have been saved yet)
   */
  private async buildQueueFromFilesystem(): Promise<void> {
    this.queue = []

    // If base directory doesn't exist, that's fine - no files saved yet
    if (!existsSync(this.baseDir)) {
      log(`[ClipboardFilesQueue] Base directory does not exist, starting with empty queue`)
      return
    }

    try {
      // Read all session directories
      const sessionDirs = await readdir(this.baseDir, { withFileTypes: true })

      for (const sessionDir of sessionDirs) {
        if (!sessionDir.isDirectory()) continue

        const sessionID = sessionDir.name
        const sessionPath = join(this.baseDir, sessionID)

        try {
          // Read files in session directory
          const files = await readdir(sessionPath, { withFileTypes: true })

          for (const file of files) {
            if (!file.isFile()) continue

            // Parse datetime from filename
            const savedAt = parseDatetimeFromFilename(file.name)
            if (savedAt === 0) continue // Skip files that don't match expected format

            const filePath = join(sessionPath, file.name)
            const ext = extname(file.name).slice(1) // Remove leading dot

            // Get file stats safely
            let fileSize = 0
            try {
              const stats = await stat(filePath)
              fileSize = stats.size
            } catch {
              // File might have been deleted, skip it
              continue
            }

            const savedFile: SavedClipboardFile = {
              id: generateFileId(file.name.replace(/\.\w+$/, "")),
              filename: file.name,
              mime: getMimeFromExtension(ext),
              path: filePath,
              savedAt,
              sessionID,
              size: fileSize,
            }

            this.queue.push(savedFile)
          }
        } catch (error) {
          // Failed to read session directory, log and continue
          log(`[ClipboardFilesQueue] Error reading session directory ${sessionID}: ${error}`)
        }
      }

      // Sort by savedAt descending (most recent first)
      this.queue.sort((a, b) => b.savedAt - a.savedAt)

      log(`[ClipboardFilesQueue] Built queue from filesystem: ${this.queue.length} files`)
    } catch (error) {
      log(`[ClipboardFilesQueue] Error building queue from filesystem: ${error}`)
      // Keep queue empty on error
    }
  }

  /**
   * Add a file to the queue
   * @param dataUrl - Base64 data URL (data:image/png;base64,...) or raw base64
   * @param sessionID - Session ID where the file was pasted (required for proper storage)
   * @returns The saved file metadata
   */
  async addFile(dataUrl: string, sessionID?: string): Promise<SavedClipboardFile> {
    await this.initialize()

    // Use "default" session if no sessionID provided
    const sid = sessionID || "default"

    // Parse data URL
    let mime: string
    let base64Data: string

    if (dataUrl.startsWith("data:")) {
      // data:image/png;base64,xxxxx
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
      if (!match) {
        throw new Error("Invalid data URL format")
      }
      mime = match[1]
      base64Data = match[2]
    } else {
      // Assume raw base64, default to PNG
      mime = "image/png"
      base64Data = dataUrl
    }

    // Generate datetime filename
    const datetime = generateDatetimeFilename()
    const ext = mime.split("/")[1] || "png"
    const filename = `${datetime}.${ext}`

    // Create session directory and file path (only when actually saving)
    const sessionDir = join(this.baseDir, sid)
    try {
      if (!existsSync(sessionDir)) {
        await mkdir(sessionDir, { recursive: true })
      }
    } catch (error) {
      throw new Error(`Failed to create session directory: ${error}`)
    }

    const filePath = join(sessionDir, filename)

    // Decode and save to file
    const buffer = Buffer.from(base64Data, "base64")
    await Bun.write(filePath, buffer)

    // Create metadata
    const savedFile: SavedClipboardFile = {
      id: generateFileId(datetime),
      filename,
      mime,
      path: filePath,
      savedAt: Date.now(),
      sessionID: sid,
      size: buffer.length,
    }

    // Add to front of queue (most recent first)
    this.queue.unshift(savedFile)

    // Enforce max size (remove oldest from end)
    while (this.queue.length > this.config.maxSize) {
      const removed = this.queue.pop()
      if (removed) {
        await this.removeFile(removed)
      }
    }

    log(`[ClipboardFilesQueue] Saved file: ${sid}/${filename}, size: ${buffer.length} bytes, queue size: ${this.queue.length}`)

    return savedFile
  }

  /**
   * Remove a file from disk
   * Silently handles missing files
   */
  private async removeFile(file: SavedClipboardFile): Promise<void> {
    try {
      // Only try to remove if file exists
      if (existsSync(file.path)) {
        await rm(file.path)
        log(`[ClipboardFilesQueue] Removed file: ${file.sessionID}/${file.filename}`)
      }
    } catch (error) {
      log(`[ClipboardFilesQueue] Failed to remove file ${file.filename}: ${error}`)
    }

    // Try to remove session directory if empty
    if (file.sessionID) {
      const sessionDir = join(this.baseDir, file.sessionID)
      try {
        const remaining = await readdir(sessionDir)
        if (remaining.length === 0) {
          await rm(sessionDir)
          log(`[ClipboardFilesQueue] Removed empty session directory: ${file.sessionID}`)
        }
      } catch {
        // Ignore errors when trying to remove session directory
        // (directory might not exist, or might have been removed already)
      }
    }
  }

  /**
   * Get the most recent file
   */
  getLatest(): SavedClipboardFile | undefined {
    return this.queue[0]
  }

  /**
   * Get a file by ID
   */
  getById(id: string): SavedClipboardFile | undefined {
    return this.queue.find((file) => file.id === id)
  }

  /**
   * Get a file by index (0 = most recent, -1 = most recent via negative index)
   */
  getByIndex(index: number): SavedClipboardFile | undefined {
    return this.queue[index]
  }

  /**
   * Get all files in the queue (most recent first)
   */
  getAll(): SavedClipboardFile[] {
    return [...this.queue]
  }

  /**
   * Get files for a specific session
   */
  getBySession(sessionID: string): SavedClipboardFile[] {
    return this.queue.filter((file) => file.sessionID === sessionID)
  }

  /**
   * Remove a file by ID
   */
  async removeById(id: string): Promise<boolean> {
    const index = this.queue.findIndex((file) => file.id === id)
    if (index === -1) return false

    const removed = this.queue.splice(index, 1)[0]
    await this.removeFile(removed)

    return true
  }

  /**
   * Clear all files from the queue
   */
  async clear(): Promise<void> {
    // Remove files from disk
    for (const file of [...this.queue]) {
      await this.removeFile(file)
    }
    this.queue = []
    log(`[ClipboardFilesQueue] Cleared all files`)
  }

  /**
   * Cleanup old files based on cleanupAfterHours config
   */
  async cleanup(): Promise<number> {
    if (this.config.cleanupAfterHours <= 0) return 0

    const cutoff = Date.now() - this.config.cleanupAfterHours * 60 * 60 * 1000
    const toRemove = this.queue.filter((file) => file.savedAt < cutoff)

    for (const file of toRemove) {
      const index = this.queue.indexOf(file)
      if (index !== -1) {
        this.queue.splice(index, 1)
        await this.removeFile(file)
      }
    }

    if (toRemove.length > 0) {
      log(`[ClipboardFilesQueue] Cleaned up ${toRemove.length} old files`)
    }

    return toRemove.length
  }

  /**
   * Get queue summary for display
   */
  getSummary(): { count: number; totalSize: number; files: Array<{ id: string; filename: string; size: number; savedAt: number }> } {
    return {
      count: this.queue.length,
      totalSize: this.queue.reduce((sum, file) => sum + file.size, 0),
      files: this.queue.map((file) => ({
        id: file.id,
        filename: file.filename,
        size: file.size,
        savedAt: file.savedAt,
      })),
    }
  }

  /**
   * Get the base save directory path
   */
  getSaveDir(): string {
    return this.baseDir
  }
}

/**
 * Singleton instance
 */
let instance: ClipboardFilesQueueManager | undefined

/**
 * Get or create the clipboard files queue manager instance
 */
export function getClipboardFilesQueueManager(config?: Partial<ClipboardFilesQueueConfig>): ClipboardFilesQueueManager {
  if (!instance) {
    instance = new ClipboardFilesQueueManager(config)
  }
  return instance
}

/**
 * Reset the singleton (for testing)
 */
export function resetClipboardFilesQueueManager(): void {
  instance = undefined
}
