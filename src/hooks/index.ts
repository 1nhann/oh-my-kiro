/**
 * Hooks Module
 * Exports all plugin hooks and manages hook configuration
 */

import type { PluginInput } from "@opencode-ai/plugin"
import type { KiroPluginConfig } from "../config"
import { createUserMessageHook } from "./user-message"
import {
  createToolExecuteBeforeHook,
  createToolExecuteAfterHook,
  getToolLogs,
  clearToolLogs,
} from "./tool-execute"
import { createContextRecoveryHook } from "./context-recovery"
import { createUltraworkHook, getUltraworkSystemPrompt } from "./ultrawork"
import type { HookConfig, HookManager, ToolExecutionLog } from "./types"
import { DEFAULT_HOOK_CONFIG } from "./types"

/**
 * Create hook configuration from plugin config
 */
function createHookConfig(pluginConfig: KiroPluginConfig): HookConfig {
  return {
    ...DEFAULT_HOOK_CONFIG,
    contextRecovery: {
      ...DEFAULT_HOOK_CONFIG.contextRecovery,
      ...pluginConfig.contextRecovery,
    },
    ultraworkDetection: {
      ...DEFAULT_HOOK_CONFIG.ultraworkDetection,
      ...pluginConfig.ultrawork,
    },
    maxBackgroundTasks:
      pluginConfig.backgroundTasks?.maxConcurrent ?? DEFAULT_HOOK_CONFIG.maxBackgroundTasks,
    debug: pluginConfig.debug ?? DEFAULT_HOOK_CONFIG.debug,
  }
}

/**
 * Create hook manager
 */
function createHookManager(config: HookConfig): HookManager {
<<<<<<< HEAD
  return {
    getToolLogs: (sessionId?: string) => {
      return getToolLogs(sessionId)
    },

    clearToolLogs: (sessionId?: string) => {
      clearToolLogs(sessionId)
=======
  const toolLogs: ToolExecutionLog[] = []

  return {
    getToolLogs: (sessionId?: string) => {
      if (sessionId) {
        return toolLogs.filter((log) => log.sessionID === sessionId)
      }
      return toolLogs
    },

    clearToolLogs: (sessionId?: string) => {
      if (!sessionId) {
        toolLogs.length = 0
        return
      }

      const keep = toolLogs.filter((log) => log.sessionID !== sessionId)
      toolLogs.length = 0
      toolLogs.push(...keep)
>>>>>>> 0309c112f (已按“先修可运行性，再修配置生效”的方向把 `kiro` 做了一轮实改，重点是把之前容易失效/崩溃的链路先补齐。)
    },

    getConfig: () => config,

    updateConfig: (updates: Partial<HookConfig>) => {
      Object.assign(config, updates)
    },

    detectUltrawork: (message: string) => {
      const lowerMessage = message.toLowerCase()

      for (const keyword of config.ultraworkDetection.keywords) {
        const index = lowerMessage.indexOf(keyword.toLowerCase())
        if (index !== -1) {
          const intensity =
            keyword.toLowerCase() === "ultrawork" || keyword.toLowerCase() === "ultraworking"
              ? "maximum"
              : "aggressive"
          return {
            detected: true,
            keyword,
            position: index,
            intensity,
          }
        }
      }

      return { detected: false, intensity: "normal" }
    },
  }
}

/**
 * Create all plugin hooks
 */
export function createHooks(args: {
  ctx: PluginInput
  pluginConfig: KiroPluginConfig
}) {
  const { ctx, pluginConfig } = args
  const hookConfig = createHookConfig(pluginConfig)
  const manager = createHookManager(hookConfig)
  const disabled = new Set(pluginConfig.disabled_hooks ?? [])
  const enabled = (name: string) => !disabled.has(name)

  // Create hook instances
  const ultrawork = createUltraworkHook(hookConfig)
  const userMessageHook = createUserMessageHook(ctx, pluginConfig, (sessionID, message) => {
    ultrawork.processMessage(sessionID, message)
  })
  const toolExecuteBeforeHook = createToolExecuteBeforeHook(hookConfig)
  const toolExecuteAfterHook = createToolExecuteAfterHook(hookConfig)
  const contextRecovery = createContextRecoveryHook(hookConfig)

  return {
    // User message hook - using official OpenCode hook name
    ...(enabled("chat.message") ? { "chat.message": userMessageHook } : {}),

    // Tool execution hooks
    ...(enabled("tool.execute.before")
      ? { "tool.execute.before": toolExecuteBeforeHook }
      : {}),
    ...(enabled("tool.execute.after")
      ? { "tool.execute.after": toolExecuteAfterHook }
      : {}),

    ...(enabled("experimental.chat.system.transform")
      ? {
          "experimental.chat.system.transform": async (
<<<<<<< HEAD
<<<<<<< HEAD
            input: { sessionID?: string; model: unknown },
=======
            input: { sessionID?: string; model: { providerID: string; modelID: string } },
>>>>>>> 0309c112f (已按“先修可运行性，再修配置生效”的方向把 `kiro` 做了一轮实改，重点是把之前容易失效/崩溃的链路先补齐。)
=======
            input: { sessionID?: string; model: unknown },
>>>>>>> a41390a2f (已继续完善并收敛了一轮，主要补了这 4 个文件：)
            output: { system: string[] },
          ) => {
            if (!input.sessionID) return
            const state = ultrawork.getState(input.sessionID)
            if (!state) return
            output.system.push(getUltraworkSystemPrompt(state))
          },
        }
      : {}),

    ...(enabled("experimental.chat.messages.transform")
      ? {
          "experimental.chat.messages.transform": async (
            _input: {},
            output: {
              messages: Array<{
                info: { role?: "user" | "assistant" | "system" }
                parts: Array<{ type: string; text?: string }>
              }>
            },
          ) => {
            if (!hookConfig.contextRecovery.enabled) return
            if (output.messages.length === 0) return

<<<<<<< HEAD
            const source = output.messages
            const rows = source.map((item, index) => ({
              id: index,
              role:
                item.info.role === "assistant" || item.info.role === "system"
                  ? item.info.role
                  : ("user" as const),
=======
            const rows = output.messages.map((item) => ({
<<<<<<< HEAD
              role: item.info.role === "assistant" || item.info.role === "system" ? item.info.role : "user",
>>>>>>> 0309c112f (已按“先修可运行性，再修配置生效”的方向把 `kiro` 做了一轮实改，重点是把之前容易失效/崩溃的链路先补齐。)
=======
              role:
                item.info.role === "assistant" || item.info.role === "system"
                  ? item.info.role
                  : ("user" as const),
>>>>>>> a41390a2f (已继续完善并收敛了一轮，主要补了这 4 个文件：)
              content: item.parts
                .filter((part) => part.type === "text" || part.type === "reasoning")
                .map((part) => part.text ?? "")
                .join("\n"),
            }))
            const result = contextRecovery.processMessages("chat-transform", rows)
            if (!result.recovered) return
<<<<<<< HEAD
            output.messages = result.messages.flatMap((item) => {
              if (typeof item.id === "number") {
                const msg = source[item.id]
                return msg ? [msg] : []
              }
              const text = typeof item.content === "string" ? item.content : JSON.stringify(item.content)
              return [
                {
                  info: { role: item.role },
                  parts: [{ type: "text", text }],
                },
              ]
            })
=======

            const headCount = Math.min(
              hookConfig.contextRecovery.keepHead,
              Math.floor(output.messages.length / 3),
            )
            const tailCount = Math.min(
              hookConfig.contextRecovery.keepTail,
              Math.floor(output.messages.length / 3),
            )
            if (headCount + tailCount >= output.messages.length) return

            output.messages = [
              ...output.messages.slice(0, headCount),
              ...output.messages.slice(output.messages.length - tailCount),
            ]
>>>>>>> 0309c112f (已按“先修可运行性，再修配置生效”的方向把 `kiro` 做了一轮实改，重点是把之前容易失效/崩溃的链路先补齐。)
          },
        }
      : {}),

    // Expose manager for external access
    _manager: manager,
  }
}

// Export types
export type { HookConfig, HookManager } from "./types"

// Export individual hooks
export { createUserMessageHook } from "./user-message"
export { createToolExecuteBeforeHook, createToolExecuteAfterHook } from "./tool-execute"
export { createContextRecoveryHook } from "./context-recovery"
export { createUltraworkHook, getUltraworkSystemPrompt, detectUltrawork } from "./ultrawork"
export { DEFAULT_HOOK_CONFIG } from "./types"
