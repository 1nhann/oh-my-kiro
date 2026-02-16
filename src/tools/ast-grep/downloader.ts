/**
 * AST-grep Binary Downloader
 */

import { existsSync } from "fs"
import { join } from "path"
import { homedir } from "os"
import {
  cleanupArchive,
  downloadArchive,
  ensureCacheDir,
  ensureExecutable,
  extractZipArchive,
  getCachedBinaryPath as getCachedBinaryPathShared,
} from "../../shared/binary-downloader"
import { log } from "../../shared/logger"

const REPO = "ast-grep/ast-grep"
const DEFAULT_VERSION = "0.40.0"

interface PlatformInfo {
  arch: string
  os: string
}

const PLATFORM_MAP: Record<string, PlatformInfo> = {
  "darwin-arm64": { arch: "aarch64", os: "apple-darwin" },
  "darwin-x64": { arch: "x86_64", os: "apple-darwin" },
  "linux-arm64": { arch: "aarch64", os: "unknown-linux-gnu" },
  "linux-x64": { arch: "x86_64", os: "unknown-linux-gnu" },
  "win32-x64": { arch: "x86_64", os: "pc-windows-msvc" },
  "win32-arm64": { arch: "aarch64", os: "pc-windows-msvc" },
  "win32-ia32": { arch: "i686", os: "pc-windows-msvc" },
}

export function getCacheDir(): string {
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || process.env.APPDATA
    const base = localAppData || join(homedir(), "AppData", "Local")
    return join(base, "kiro", "bin")
  }

  const xdgCache = process.env.XDG_CACHE_HOME
  const base = xdgCache || join(homedir(), ".cache")
  return join(base, "kiro", "bin")
}

export function getBinaryName(): string {
  // Prefer the main binary in downloaded archives. The tiny `sg` wrapper can fail
  // in some environments when it cannot resolve the sibling executable.
  return process.platform === "win32" ? "ast-grep.exe" : "ast-grep"
}

export function getCachedBinaryPath(): string | null {
  const cacheDir = getCacheDir()
  const primary = getCachedBinaryPathShared(cacheDir, getBinaryName())
  if (primary) return primary
  const legacy = getCachedBinaryPathShared(cacheDir, process.platform === "win32" ? "sg.exe" : "sg")
  return legacy
}

export async function downloadAstGrep(version: string = DEFAULT_VERSION): Promise<string | null> {
  const platformKey = `${process.platform}-${process.arch}`
  const platformInfo = PLATFORM_MAP[platformKey]

  if (!platformInfo) {
    log(`[kiro] Unsupported platform for ast-grep: ${platformKey}`)
    return null
  }

  const cacheDir = getCacheDir()
  const binaryName = getBinaryName()
  const binaryPath = join(cacheDir, binaryName)

  if (existsSync(binaryPath)) {
    return binaryPath
  }

  const { arch, os } = platformInfo
  const assetName = `app-${arch}-${os}.zip`
  const downloadUrl = `https://github.com/${REPO}/releases/download/${version}/${assetName}`

  log(`[kiro] Downloading ast-grep binary from ${downloadUrl}...`)

  try {
    const archivePath = join(cacheDir, assetName)
    ensureCacheDir(cacheDir)
    await downloadArchive(downloadUrl, archivePath)
    await extractZipArchive(archivePath, cacheDir)
    cleanupArchive(archivePath)
    ensureExecutable(binaryPath)

    log(`[kiro] ast-grep binary ready at ${binaryPath}`)

    return binaryPath
  } catch (err) {
    log(`[kiro] Failed to download ast-grep: ${err instanceof Error ? err.message : err}`)
    return null
  }
}

export async function ensureAstGrepBinary(): Promise<string | null> {
  const cachedPath = getCachedBinaryPath()
  if (cachedPath) {
    return cachedPath
  }

  return downloadAstGrep(DEFAULT_VERSION)
}
