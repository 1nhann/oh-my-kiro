# Kiro Plugin for OpenCode

Kiro is a spec-oriented orchestration plugin for OpenCode. It focuses on:
- Requirements/design/task workflow
- Delegation to specialized subagents
- Background parallel subagent execution
- LSP-assisted diagnostics and rename

## What Is Included

### Agents

| Agent | Description |
|-------|-------------|
| `kiro` (orchestrator) | Main orchestrator that delegates to subagents |
| `requirements-first-workflow` | Requirements gathering and spec creation |
| `spec-task-execution` | Execute tasks from a spec |
| `context-gatherer` | Gather context for a task |
| `general-task-execution` | General development tasks |
| `explore` | Fast codebase exploration |
| `multimodal-looker` | Image/document analysis agent |

### Kiro Tools

| Category | Tools |
|----------|-------|
| **Kiro-specific** | `invokeSubAgent`, `prework`, `kiroSpecTaskStatus`, `updatePBTStatus` |
| **AST-grep** | `astGrepSearch`, `astGrepReplace` |
| **Look-at** | `lookAt` |
| **Background Tasks** | `backgroundTask`, `backgroundTaskStatus`, `backgroundTaskOutput`, `backgroundTaskCancel`, `listBackgroundTasks` |
| **LSP** | `kiroGetDiagnostics`, `kiroRenameSymbol` |

Kiro also relies on OpenCode native tools like `read`, `write`, `edit`, `bash`, `glob`, `grep`, and `lsp`.

## Repository Layout

```text
plugins/kiro/
└── src/
    ├── agents/
    │   ├── prompts/             # Agent prompts (TypeScript)
    │   ├── explore-agent.ts     # Explore agent definition
    │   ├── kiro.ts              # Main kiro agent config
    │   ├── loader.ts            # Prompt loader
    │   └── multimodal-looker.ts # Multimodal agent definition
    ├── background/              # Background task management
    ├── config/                  # Configuration types and loader
    ├── features/                # Feature implementations
    │   └── builtin-commands/    # Built-in commands
    ├── model-fallback/          # Model fallback logic
    ├── plugin/                  # Plugin type definitions
    ├── shared/                  # Shared utilities
    └── tools/
        ├── ast-grep/            # AST-based code search/replace
        ├── background-tools/    # Background task tools
        ├── kiro-specific/       # Kiro-specific tools
        │   └── subagent/        # Subagent management
        ├── look-at/             # Image/document viewer
        └── lsp-tools/           # LSP integration tools
```

## Configuration

Use `.kiro/settings/kiro.json` (workspace) or `~/.config/opencode/kiro/*.json` (user).

Key settings:

| Setting | Description |
|---------|-------------|
| `disabled_tools` | List of tools to disable |
| `spec_path` | Path to store spec files (default: `.kiro/specs`) |
| `agent_model` | Default model for agents |
| `debug` | Enable debug logging |
| `features` | Feature flags (`requirements_first`, `spec_execution`) |
| `contextRecovery` | Context recovery settings |
| `backgroundTasks` | Background task settings (`enabled`, `maxConcurrent`, `timeout`) |
| `lsp` | LSP settings (`enabled`, `languages`) |
| `modelFallback` | Model fallback configuration |

See `kiro.example.json` for a complete example.

## Build and Install

```bash
make install
make build
```

This generates `dist/index.js`.

Then add the plugin to `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "file:///path/to/oh-my-kiro/dist/index.js"
  ],
  // ... other config
}
```
