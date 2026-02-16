/**
 * Binary Downloader Utilities
 * Shared utilities for downloading and managing CLI binaries
 */

import { chmodSync, existsSync, mkdirSync, unlinkSync } from "node:fs"
import * as path from "node:path"
import { spawn } from "child_process"
import { promisify } from "node:util"
import { exec } from "node:child_process"

const execAsync = promisify(exec)

export function getCachedBinaryPath(cacheDir: string, binaryName: string): string | null {
  const binaryPath = path.join(cacheDir, binaryName)
  return existsSync(binaryPath) ? binaryPath : null
}

export function ensureCacheDir(cacheDir: string): void {
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true })
  }
}

export async function downloadArchive(downloadUrl: string, archivePath: string): Promise<void> {
  const response = await fetch(downloadUrl, { redirect: "follow" })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const fs = await import("node:fs/promises")
  await fs.writeFile(archivePath, buffer)
}

export async function extractTarGzArchive(
  archivePath: string,
  destDir: string,
  options?: { args?: string[]; cwd?: string }
): Promise<void> {
  const args = options?.args ?? ["tar", "-xzf", archivePath, "-C", destDir]
  const cwd = options?.cwd ?? destDir

  return new Promise((resolve, reject) => {
    const proc = spawn(args[0], args.slice(1), {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stderr = ""
    if (proc.stderr) {
      proc.stderr.on("data", (data) => {
        stderr += data.toString()
      })
    }

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`tar extraction failed (exit ${code}): ${stderr}`))
      } else {
        resolve()
      }
    })

    proc.on("error", (err) => {
      reject(err)
    })
  })
}

export async function extractZipArchive(archivePath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let cmd: string

    if (process.platform === "win32") {
      // Windows: use PowerShell
      cmd = `powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force"`
    } else {
      // Unix: use unzip
      cmd = `unzip -o "${archivePath}" -d "${destDir}"`
    }

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Extraction failed: ${stderr || error.message}`))
      } else {
        resolve()
      }
    })
  })
}

export function cleanupArchive(archivePath: string): void {
  if (existsSync(archivePath)) {
    unlinkSync(archivePath)
  }
}

export function ensureExecutable(binaryPath: string): void {
  if (process.platform !== "win32" && existsSync(binaryPath)) {
    chmodSync(binaryPath, 0o755)
  }
}
