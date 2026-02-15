import { existsSync } from "fs"
import { homedir } from "os"
import { join } from "path"

function getOpenCodeConfigDir(): string {
  const configured = process.env.OPENCODE_CONFIG_DIR?.trim()
  if (configured) return configured
  return join(homedir(), ".config", "opencode")
}

function getDataDir(): string {
  return process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share")
}

export function isServerInstalled(command: string[]): boolean {
  if (command.length === 0) return false

  const cmd = command[0]

  // Support absolute paths (e.g., C:\Users\...\server.exe or /usr/local/bin/server)
  if (cmd.includes("/") || cmd.includes("\\")) {
    if (existsSync(cmd)) return true
  }

  const isWindows = process.platform === "win32"

  let exts = [""]
  if (isWindows) {
    const pathExt = process.env.PATHEXT || ""
    if (pathExt) {
      const systemExts = pathExt.split(";").filter(Boolean)
      exts = [...new Set([...exts, ...systemExts, ".exe", ".cmd", ".bat", ".ps1"])]
    } else {
      exts = ["", ".exe", ".cmd", ".bat", ".ps1"]
    }
  }

  let pathEnv = process.env.PATH || ""
  if (isWindows && !pathEnv) {
    pathEnv = process.env.Path || ""
  }

  const pathSeparator = isWindows ? ";" : ":"
  const paths = pathEnv.split(pathSeparator)

  for (const p of paths) {
    for (const suffix of exts) {
      if (existsSync(join(p, cmd + suffix))) {
        return true
      }
    }
  }

  const cwd = process.cwd()
  const configDir = getOpenCodeConfigDir()
  const dataDir = join(getDataDir(), "opencode")
  const additionalBases = [
    join(cwd, "node_modules", ".bin"),
    join(configDir, "bin"),
    join(configDir, "node_modules", ".bin"),
    join(dataDir, "bin"),
  ]

  for (const base of additionalBases) {
    for (const suffix of exts) {
      if (existsSync(join(base, cmd + suffix))) {
        return true
      }
    }
  }

  // Runtime wrappers (bun/node) are always available in oh-my-opencode context
  if (cmd === "bun" || cmd === "node") {
    return true
  }

  return false
}
