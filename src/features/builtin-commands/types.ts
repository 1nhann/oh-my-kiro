/**
 * Type definitions for builtin commands
 * Compatible with OpenCode's command system
 */

export type BuiltinCommandName = "spec"

export interface BuiltinCommandConfig {
  disabled_commands?: BuiltinCommandName[]
}

/**
 * Command definition structure that OpenCode expects
 */
export interface CommandDefinition {
  name: string
  description?: string
  template: string
  agent?: string
  model?: string
  subtask?: boolean
}

export type BuiltinCommands = Record<string, CommandDefinition>
