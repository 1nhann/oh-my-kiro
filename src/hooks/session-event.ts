/**
 * Session Event Hook
 *
 * Previously used for flushing pending background task notifications when
 * a session becomes idle. Now notifications are sent immediately when tasks
 * complete, so this hook is a no-op.
 *
 * Kept for future extension if needed.
 */

import type { PluginInput } from "@opencode-ai/plugin"
import type { KiroPluginConfig } from "../config"
import type { BackgroundTaskManager } from "../background/types"

/**
 * Create the session event hook
 * Currently a no-op since notifications are sent immediately on task completion
 */
export function createSessionEventHook(
  _ctx: PluginInput,
  _pluginConfig: KiroPluginConfig,
  _taskManager: BackgroundTaskManager
) {
  return async (_input: { event: unknown }): Promise<void> => {
    // No-op: notifications are now sent immediately when tasks complete
    // This hook is kept for potential future use
  }
}
