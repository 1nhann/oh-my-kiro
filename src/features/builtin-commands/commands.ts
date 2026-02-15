/**
 * Builtin commands loader for Kiro plugin
 */

import type { BuiltinCommandName, BuiltinCommands, CommandDefinition } from "./types"
import { SPEC_TEMPLATE } from "./templates/spec"

const BUILTIN_COMMAND_DEFINITIONS: Record<BuiltinCommandName, Omit<CommandDefinition, "name">> = {
  spec: {
    description: "Spec-driven development workflow - Requirements → Design → Tasks → Implementation",
    template: `<command-instruction>
${SPEC_TEMPLATE}
</command-instruction>

<user-request>
$ARGUMENTS
</user-request>`,
    agent: "kiro",
  },
}

/**
 * Load builtin commands, optionally filtering out disabled ones
 */
export function loadBuiltinCommands(
  disabledCommands?: BuiltinCommandName[]
): BuiltinCommands {
  const disabled = new Set(disabledCommands ?? [])
  const commands: BuiltinCommands = {}

  for (const [name, definition] of Object.entries(BUILTIN_COMMAND_DEFINITIONS)) {
    if (!disabled.has(name as BuiltinCommandName)) {
      commands[name] = { ...definition, name }
    }
  }

  return commands
}
