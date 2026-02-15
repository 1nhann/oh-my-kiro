import { BUILTIN_SERVERS, LSP_INSTALL_HINTS } from "./constants"
import { isServerInstalled } from "./server-installation"
import type { ServerLookupResult } from "./types"

export function findServerForExtension(ext: string): ServerLookupResult {
  const servers = Object.entries(BUILTIN_SERVERS).map(([id, server]) => ({
    id,
    command: server.command,
    extensions: server.extensions,
    priority: 0,
    source: "builtin",
    env: server.env,
    initialization: server.initialization,
  }))

  for (const server of servers) {
    if (server.extensions.includes(ext) && isServerInstalled(server.command)) {
      return {
        status: "found",
        server: {
          id: server.id,
          command: server.command,
          extensions: server.extensions,
          priority: server.priority,
          env: server.env,
          initialization: server.initialization,
        },
      }
    }
  }

  for (const server of servers) {
    if (server.extensions.includes(ext)) {
      const installHint = LSP_INSTALL_HINTS[server.id] || `Install '${server.command[0]}' and ensure it's in your PATH`
      return {
        status: "not_installed",
        server: {
          id: server.id,
          command: server.command,
          extensions: server.extensions,
        },
        installHint,
      }
    }
  }

  const availableServers = [...new Set(servers.map((s) => s.id))]
  return {
    status: "not_configured",
    extension: ext,
    availableServers,
  }
}

export function getAllServers(): Array<{
  id: string
  installed: boolean
  extensions: string[]
  disabled: boolean
  source: string
  priority: number
}> {
  return Object.entries(BUILTIN_SERVERS).map(([id, server]) => ({
    id,
    installed: isServerInstalled(server.command),
    extensions: server.extensions,
    disabled: false,
    source: "builtin",
    priority: 0,
  }))
}

export function getConfigPaths_(): { project: string; user: string; opencode: string } {
  return {
    project: "",
    user: "",
    opencode: "",
  }
}
