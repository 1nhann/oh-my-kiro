![pic1](assets/image.png)

# https://inhann.top/2026/02/25/browser-agent/

# Oh My Kiro Plugin for OpenCode

Oh My Kiro is a spec-driven, multi-agent coding plugin for [OpenCode](https://github.com/opencode-ai/opencode).

> Kiro is great, Spec-Driven Development works, but the subscription credits are too limited, and the context window is too small for serious use. So I reverse-engineered Kiro and built oh-my-kiro — an open-source alternative with the same capabilities and better UX, no more worrying about context limits, and full freedom to configure the underlying model.

## Features

- **Spec-Driven Development**: Enforces **Requirements → Design → Tasks → Implementation** workflow
- **Dynamic Task Graph**: Supports branching, loops, and parallel execution in task workflows
- **Multi-Agent Architecture**: Specialized subagents for different tasks (exploration, execution, analysis)
- **Background Tasks**: Run subagents in parallel without blocking the main conversation
- **AST-based Search**: Structural code search and refactoring using ast-grep
- **Code Execution**: Stateful JavaScript execution in Jupyter kernels for browser automation and workflows
- **Browser Automation**: Built-in support for Stagehand and browser-use skills
- **Multimodal Support**: Image and document analysis via configurable vision models
- **LSP Integration**: Get diagnostics and rename symbols using Language Server Protocol

## Agents

| Agent                         | Mode     | Purpose                                                |
| ----------------------------- | -------- | ------------------------------------------------------ |
| `kiro` (orchestrator)         | primary  | Main orchestrator that coordinates all subagents       |
| `requirements-first-workflow` | subagent | Build and refine specs (requirements → design → tasks) |
| `spec-task-execution`         | subagent | Execute a single task from a spec's tasks.md           |
| `kiroExplore`                 | subagent | Deep codebase exploration                              |
| `context-gatherer`            | subagent | Gather focused code context                            |
| `general-task-execution`      | subagent | General implementation work                            |
| `multimodal-looker`           | subagent | Image/document understanding                           |

## Tools

| Category             | Tools                                                                                                                                                     | Description                            |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **Kiro-specific**    | `prework`, `kiroSpecTaskStatus`                                                                                                                           | Spec workflow management               |
| **Background tasks** | `backgroundTask`, `backgroundTaskStatus`, `getTaskOutput`, `backgroundTaskCancel`, `listBackgroundTasks`, `waitForBackgroundTasks`, `listAllTaskSessions` | Parallel subagent execution            |
| **AST-grep**         | `astGrepSearch`, `astGrepReplace`                                                                                                                         | Structural code search and refactoring |
| **Code execution**   | `execute_code`, `list_code_sessions`, `close_code_session`                                                                                                | Stateful JavaScript in Jupyter kernels |
| **Multimodal**       | `lookAt`                                                                                                                                                  | Image/PDF analysis (optional)          |
| **LSP**              | `kiroGetDiagnostics`, `kiroRenameSymbol`                                                                                                                  | Language Server integration            |
| **Clipboard**        | `listClipboardFiles`                                                                                                                                      | Access pasted images queue             |

## Built-in Commands

| Command          | Description                                                                       |
| ---------------- | --------------------------------------------------------------------------------- |
| `/spec`          | Spec-driven development workflow - Requirements → Design → Tasks → Implementation |
| `/skill`         | Trigger agent to use a skill (e.g., browser automation)                           |
| `/session-reuse` | Reuse existing subagent sessions                                                  |
| `/general`       | Trigger general-task-execution for implementation work                            |

> **Note:** `/spec` is optional—Kiro operates in spec-driven mode by default. The command serves as a helper/reminder.

## Installation

Edit `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "plugin": ["@oh-my-kiro/oh-my-kiro"],
}
```

```bash
# 1. Install Jupyter
pip install jupyter

# 2. Install jslab kernel (JavaScript kernel based on tslab)
npm install -g tslab
tslab install

# 3. (Optional) Start Jupyter server manually
jupyter server --no-browser --port=8888 --IdentityProvider.token=your-token --ServerApp.allow_origin='*' --KernelManager.autorestart=False --MappingKernelManager.kernel_info_timeout=60

# Or let Kiro auto-spawn one (no manual setup needed)
```

## Configuration

Oh My Kiro reads config from `~/.config/opencode/kiro/kiro.json`:

```json
{
  "lookAt": {
    "enable": true,
    "model": "openai/gpt-5.3-codex"
  },
  "codeExecution": {
    "script_dir": ".kiro/scripts",
    "jupyter": {
      "baseUrl": "http://localhost:8888",
      "token": "your-token"
    },
    "env": {
      "BROWSER_LLM_API_KEY": "your-api-key",
      "BROWSER_LLM_BASE_URL": "https://api.openai.com/v1",
      "BROWSER_LLM_MODEL": "gpt-5.3-codex"
    }
  }
}
```

### Configuration Options

| Key                        | Type    | Default         | Description                                        |
| -------------------------- | ------- | --------------- | -------------------------------------------------- |
| `lookAt.enable`            | boolean | `false`         | Enable/disable multimodal tool                     |
| `lookAt.model`             | string  | -               | Vision model for `lookAt` (e.g., `openai/gpt-4o`)  |
| `codeExecution.script_dir` | string  | `.kiro/scripts` | Directory for execution notebooks                  |
| `codeExecution.jupyter`    | object  | -               | Jupyter server config (auto-spawn if not provided) |
| `codeExecution.env`        | object  | -               | Environment variables for execute_code sessions    |

---

## Technical Deep Dive

### 1. Dynamic Task Graph

Tasks.md supports a **task graph** syntax that enables branching, loops, and parallel execution:

#### Task Types

| Marker | Type             | Description                                      |
| ------ | ---------------- | ------------------------------------------------ |
| `[ ]^` | **Start**        | Entry point - can have multiple start nodes      |
| `[ ]`  | **Regular**      | Standard implementation task                     |
| `[ ]?` | **Branch Point** | Decision point - returns conclusions for routing |
| `[ ]$` | **Terminal**     | Execution ends here                              |

#### Task Status

| Status      | Syntax | Description         |
| ----------- | ------ | ------------------- |
| Not started | `[ ]`  | Task not yet begun  |
| In progress | `[-]`  | Currently executing |
| Queued      | `[/]`  | Waiting to execute  |
| Completed   | `[x]`  | Done                |
| Failed      | `[!]`  | Error occurred      |

#### Iteration Support (Loops)

For retry/polling workflows, cycles are **permitted**. Iteration count is tracked:

```
- [ ]^ 1. Initialize        → [x]   (1st completion)
- [ ]  2. Poll for result   → [/1]  (queued, 1 prior completion)
                          → [-1]  (in_progress, 1 prior)
                          → [x2]  (2nd completion)
```

#### Example 1: Database Migration with Validation Gates

```markdown
# Implementation Plan: Database Migration Workflow

- [ ]^ 1. Analyze current schema and migration request
  - [ ] 1.1 Use execute_code to query DB schema, establish baseline
  - _Requirements: 1.1_

- [ ] 2. Create non-destructive schema migration
  - [ ] 2.1 Generate SQL to add NEW tables/columns ONLY (no DROP)
  - _Requirements: 1.2_

- [ ]? 3. Execute migration in staging (dry-run first)
  - [ ] 3.1 Run migration with --dry-run flag
  - [ ]? 3.2 If dry-run fails, jump to 8; if successful, jump to 4
  - _Requirements: 2.1_

- [ ] 4. Write data backfill script
  - [ ] 4.1 Create batch-processing script for old→new schema mapping
  - _Requirements: 2.2_

- [ ]? 5. Execute backfill and verify data integrity
  - [ ] 5.1 Run backfill, compare row counts and sample data
  - [ ]? 5.2 If mismatch > 0%, jump to 6; if 100% match, jump to 7
  - _Requirements: 3.1_

- [ ] 6. Rollback and refine backfill (self-correction loop)
  - [ ] 6.1 Truncate new columns, analyze logs
  - [ ]? 6.2 Jump back to 4
  - _Requirements: 3.2_

- [ ] 7. Generate cleanup migration
  - [ ] 7.1 Create final SQL to safely drop deprecated columns/tables
  - _Requirements: 4.1_

- [ ]$ 8. Terminal: Migration blocked, revert staging, save error trace for human review

- [ ]$ 9. Terminal: Migration PRs ready, output 3 PRs: Expand Schema, Data Backfill, Cleanup
```

#### Example 2: Compilation-Driven Code Translation (with loops)

```markdown
# Implementation Plan: Python to Rust Translation Workflow

- [ ]^ 1. Source analysis and initial translation
  - [ ] 1.1 Parse Python, generate initial Rust, initialize cargo
  - [ ] 1.2 Use execute_code to store: compile_retry_count = 0
  - _Requirements: 1.1_

- [ ] 2. Execute strict compiler check (loop anchor)
  - [ ] 2.1 Run cargo check --message-format=json
  - _Requirements: 1.2_

- [ ]? 3. Evaluate compilation results
  - [ ]? 3.1 If 0 errors, jump to 6
  - [ ]? 3.2 If errors AND compile_retry_count < 5, jump to 4
  - [ ]? 3.3 If errors AND compile_retry_count >= 5, jump to 8
  - _Requirements: 2.1_

- [ ] 4. Deep analysis of compiler errors
  - [ ] 4.1 Extract error codes (E0382, E0597), formulate patch strategy
  - _Requirements: 2.2_

- [ ] 5. Apply patch and retry
  - [ ] 5.1 Modify .rs files
  - [ ] 5.2 Use execute_code to increment compile_retry_count
  - [ ]? 5.3 Jump back to 2
  - _Requirements: 2.3_

- [ ]? 6. Semantic testing evaluation
  - [ ]? 6.1 If cargo test passes, jump to 9; if fails, jump to 7
  - _Requirements: 3.1_

- [ ] 7. Logic error remediation
  - [ ] 7.1 Fix business logic
  - [ ]? 7.2 Jump back to 2 (logic changes may break compilation)
  - _Requirements: 3.2_

- [ ]$ 8. Terminal: Translation failed, output errors, request human intervention

- [ ]$ 9. Terminal: Translation complete, commit compilable, tested Rust project
```

#### Example 3: Multi-Entry Code Review Workflow (convergent workflow)

```markdown
# Implementation Plan: Code Review and Improvement Workflow

- [ ]^ 1. Entry A: Pull Request Review
  - [ ] 1.1 Fetch PR diff, changed files, author context
  - [ ]? 1.2 Jump to 4 (convergence point)
  - _Requirements: 1.1_

- [ ]^ 2. Entry B: Pre-Commit Hook Analysis
  - [ ] 2.1 Run linter, type checker, collect violations
  - [ ]? 2.2 Jump to 4
  - _Requirements: 1.2_

- [ ]^ 3. Entry C: Manual Code Improvement Request
  - [ ] 3.1 Parse improvement request, identify target files/modules
  - [ ]? 3.2 Jump to 4
  - _Requirements: 1.3_

- [ ] 4. Context aggregation and analysis (convergence)
  - [ ] 4.1 Analyze code patterns, identify improvement opportunities
  - [ ] 4.2 Use execute_code to store: entry_point = 'A' | 'B' | 'C'
  - _Requirements: 2.1_

- [ ] 5. Generate improvement suggestions
  - [ ] 5.1 Create detailed recommendations with code examples
  - _Requirements: 2.2_

- [ ]? 6. Apply improvements and verify
  - [ ]? 6.1 If changes break tests, jump back to 5; if pass, jump to 7
  - _Requirements: 3.1_

- [ ]? 7. Output strategy decision
  - [ ] 7.1 Read entry_point from execute_code
  - [ ]? 7.2 If entry_point == 'A', jump to 8
  - [ ]? 7.3 If entry_point == 'B' or 'C', jump to 9
  - _Requirements: 3.2_

- [ ]$ 8. Terminal: Post PR review comments with suggested improvements

- [ ]$ 9. Terminal: Apply auto-fixable changes, commit with descriptive message
```

#### Example 4: Full-Stack Parallel Development (fan-out pattern)

```markdown
# Implementation Plan: Full-Stack Feature Parallel Development

- [ ]^ 1. Analyze request and define API contract (entry)
  - [ ] 1.1 Parse requirements, draft OpenAPI/Swagger schema
  - [ ]? 1.2 Trigger 2, 3, 4 simultaneously (parallel fan-out)
  - _Requirements: 1.1_

- [ ] 2. Branch A: Backend implementation (parallel)
  - [ ] 2.1 Generate migrations, ORM models, API controllers
  - [ ]? 2.2 Jump to 5 when complete
  - _Requirements: 2.1_

- [ ] 3. Branch B: Frontend implementation (parallel)
  - [ ] 3.1 Auto-generate API client from OpenAPI spec
  - [ ] 3.2 Build UI components, wire up state
  - [ ]? 3.3 Jump to 5 when complete
  - _Requirements: 2.2_

- [ ] 4. Branch C: E2E test generation (parallel)
  - [ ] 4.1 Write Cypress/Playwright tests based on contract
  - [ ]? 4.2 Jump to 5 when complete
  - _Requirements: 2.3_

- [ ] 5. Integration and environment spin-up (convergence/fan-in)
  - [ ] 5.1 Wait for branches A, B, C to report complete
  - [ ] 5.2 Build and launch docker-compose stack
  - _Requirements: 3.1_

- [ ]? 6. Execute E2E suite
  - [ ] 6.1 Run tests (from Branch C) against live stack (from 5)
  - [ ]? 6.2 If pass, jump to 8; if fail, jump to 7
  - _Requirements: 4.1_

- [ ] 7. Cross-stack debugging (feedback loop)
  - [ ] 7.1 Analyze failure logs, identify bug location
  - [ ]? 7.2 If backend bug, jump to 2; if frontend bug, jump to 3
  - _Requirements: 4.2_

- [ ]$ 8. Terminal: All tests pass, feature complete, ready for PR

- [ ]$ 9. Terminal: Max retries exceeded, escalate for human review
```

#### Example 5: API Polling with Retry (iteration tracking)

```markdown
# Implementation Plan: API Polling Workflow

- [ ]^ 1. Initialize polling state
  - [ ] 1.1 Use execute_code to set: poll_count = 0, max_polls = 5
  - _Requirements: 1.1_

- [ ] 2. Check API status
  - [ ] 2.1 Increment poll_count via execute_code
  - [ ] 2.2 Call API endpoint, store response status
  - _Requirements: 1.2_

- [ ]? 3. Evaluate polling result
  - [ ] 3.1 Read poll_count and status from execute_code
  - [ ]? 3.2 If status is 'complete', jump to 5
  - [ ]? 3.3 If status is 'pending' AND poll_count < max_polls, jump to 2
  - [ ]? 3.4 If max polls reached, jump to 4
  - _Requirements: 2.1_

- [ ]$ 4. Terminal: Polling timeout, operation did not complete

- [ ]$ 5. Terminal: Success, operation completed
```

**After execution with 2 polling attempts, task status would show:**

```markdown
- [x]^ 1. Initialize polling state
- [x2] 2. Check API status # Completed twice
- [x]? 3. Evaluate polling result # Final: status is 'complete'
- [ ]$ 4. Terminal: Polling timeout
- [x]$ 5. Terminal: Success
```

#### Execution Algorithm

1. **Static Mode** (no markers): Queue all tasks, execute sequentially
2. **Dynamic Mode** (has `^? $`):
   - Queue tasks from START to FIRST branch point only
   - Execute queued tasks
   - When branch point completes, evaluate conditions and route to appropriate branch
   - Continue until terminal node or no more tasks

#### Routing Syntax

Branch points use natural language routing rules in sub-tasks:

| Pattern                 | Example                                             |
| ----------------------- | --------------------------------------------------- |
| **Conditional**         | `If [condition], jump to [task]`                    |
| **Multiple conditions** | `If X, jump to 3; if Y, jump to 4; if Z, jump to 5` |
| **Unconditional**       | `Jump to 4`                                         |
| **Loop back**           | `Jump back to 2`                                    |
| **Parallel trigger**    | `Trigger 2, 3, 4 simultaneously`                    |

#### Example 6: Codebase Modernization (parallel branches from analysis)

When a branch point detects multiple independent issues, it can trigger parallel remediation branches:

```markdown
# Implementation Plan: Codebase Modernization Workflow

- [ ]^ 1. Run codebase analysis
  - [ ] 1.1 Use execute_code to run static analysis (ESLint, TypeScript strict mode, etc.)
  - [ ] 1.2 Store results: improvements = ["Type safety", "Promise handling", "Error handling"]
  - _Requirements: 1.1_

- [ ]? 2. Analyze improvement areas and dispatch modernization tasks
  - [ ] 2.1 Read improvements from execute_code
  - [ ]? 2.2 For each area, trigger parallel branch: Type safety → 3, Promise handling → 4, Error handling → 5
  - _Requirements: 1.2_

- [ ] 3. Branch A: Improve type safety (parallel)
  - [ ] 3.1 Identify all `any` types and implicit any usages
  - [ ] 3.2 Replace with proper TypeScript types, add interfaces
  - [ ] 3.3 Store fix summary in execute_code: type_fixes = {count, files}
  - [ ]? 3.4 Jump to 6 when complete
  - _Requirements: 2.1_

- [ ] 4. Branch B: Modernize promise handling (parallel)
  - [ ] 4.1 Find all callback patterns and `.then()` chains
  - [ ] 4.2 Convert to async/await syntax with proper error handling
  - [ ] 4.3 Store fix summary in execute_code: promise_fixes = {count, files}
  - [ ]? 4.4 Jump to 6 when complete
  - _Requirements: 2.2_

- [ ] 5. Branch C: Improve error handling (parallel)
  - [ ] 5.1 Identify all unhandled promise rejections and try-catch gaps
  - [ ] 5.2 Add proper error boundaries and logging
  - [ ] 5.3 Store fix summary in execute_code: error_fixes = {count, files}
  - [ ]? 5.4 Jump to 6 when complete
  - _Requirements: 2.3_

- [ ] 6. Convergence: Generate modernization report (fan-in)
  - [ ] 6.1 Wait for all branches (3, 4, 5) to report complete
  - [ ] 6.2 Read type_fixes, promise_fixes, error_fixes from execute_code
  - [ ] 6.3 Compile comprehensive modernization report
  - _Requirements: 3.1_

- [ ]? 7. Verify changes with test suite
  - [ ] 7.1 Run full test suite
  - [ ]? 7.2 If tests fail, jump to 2; if all pass, jump to 8
  - _Requirements: 3.2_

- [ ]$ 8. Terminal: Modernization complete, all improvements applied, PR ready

- [ ]$ 9. Terminal: Max retry attempts exceeded, escalate for manual review
```

**Execution flow when 3 improvement areas are found:**

1. Task 2 branch point returns `["Type safety", "Promise handling", "Error handling"]`
2. Agent launches tasks 3, 4, 5 simultaneously via `backgroundTask`
3. Each branch works independently on its improvement area
4. `waitForBackgroundTasks` blocks until all branches complete
5. Task 6 merges results and continues sequentially

```

---

### 2. Code Execution Architecture

The `execute_code` tool runs JavaScript in **Jupyter kernels**, enabling stateful workflows.

#### How It Works

```

     ┌─────────────────────────────────────┐
     │         OpenCode / Kiro             │
     │                                     │
     │  execute_code({ notebook_file,     │
     │                code })              │
     │              │                      │
     │              ▼                      │
     │  ┌───────────────────────────────┐  │
     │  │      SessionManager           │  │
     │  │  (SQLite metadata + runtime)  │  │
     │  └──────────────┬────────────────┘  │
     │                 │                   │
     │    ┌────────────┴────────────┐        │
     │    ▼                         ▼       │
     │ ┌──────────┐          ┌──────────┐   │
     │ │ REST API │◄────────►│ WebSocket│   │
     │ └────┬─────┘          └────┬─────┘   │
     │      │                      │         │
     │      └──────────┬───────────┘         │
     │                 ▼                      │
     │    ┌─────────────────────────────┐    │
     │    │      Jupyter Server         │    │
     │    └─────────────┬───────────────┘    │
     │                  │                      │
     │                  ▼                      │
     │    ┌─────────────────────────────┐    │
     │    │       KernelClient          │    │
     │    │      (WebSocket)            │    │
     │    └─────────────┬───────────────┘    │
     │                  │                      │
     │                  ▼                      │
     │    ┌─────────────────────────────┐    │
     │    │       jslab kernel          │    │
     │    │   (JavaScript / Node.js)    │    │
     │    └─────────────────────────────┘    │
     └─────────────────────────────────────┘

````

**Key Components:**

1. **Jupyter Server**: REST API for kernel lifecycle, WebSocket for code execution
2. **jslab Kernel**: JavaScript kernel based on tslab, provides Node.js runtime
3. **SessionManager**: SQLite-backed session persistence, runtime kernel connections
4. **Notebook Storage**: `.ipynb` files preserve execution history and state

#### State Persistence

Variables persist across calls when using the same `notebook_file`:

```typescript
// First call - initialize
execute_code({
  notebook_file: "/workspace/.kiro/scripts/session.ipynb",
  code: "const data = await fetch(url).then(r => r.json());",
})

// Later call - data still exists!
execute_code({
  notebook_file: "/workspace/.kiro/scripts/session.ipynb", // SAME path
  code: "console.log(data.filter(x => x.active));",
})
````

#### Package Loading

`kiro.require()` loads npm packages from multiple paths:

```typescript
// Search order:
// 1. .kiro/scripts/node_modules (project-local)
// 2. npm global (system)

const stagehand = kiro.require("@browserbasehq/stagehand")
```

#### Setup Requirements

```bash
# 1. Install Jupyter
pip install jupyter

# 2. Install jslab kernel (JavaScript kernel based on tslab)
npm install -g tslab
tslab install

# 3. (Optional) Start Jupyter server manually
jupyter server --no-browser --port=8888 --IdentityProvider.token=your-token --ServerApp.allow_origin='*' --KernelManager.autorestart=False --MappingKernelManager.kernel_info_timeout=60

# Or let Kiro auto-spawn one (no manual setup needed)
```

---

### 3. Browser Automation

Oh My Kiro supports browser automation through the `execute_code` tool with **Stagehand**.

#### Architecture

```
┌───────────────────────────────────────────────────────────┐
│  browser-use related request                               │
│         │                                                  │
│         ▼                                                  │
│  Agent loads skill context                                 │
│         │                                                  │
│         ▼                                                  │
│  execute_code({                                            │
│    path: ".kiro/scripts/browser.ipynb",                   │
│    code: `                                                 │
│      const stagehand = kiro.require("@browserbasehq/...");│
│      const browser = new Stagehand({                      │
│        llmClient: new CustomOpenAIClient({                │
│          modelName: process.env.BROWSER_LLM_MODEL,        │
│          client: new OpenAI({                             │
│            apiKey: process.env.BROWSER_LLM_API_KEY,       │
│            baseURL: process.env.BROWSER_LLM_BASE_URL,     │
│          })                                                │
│        })                                                  │
│      });                                                   │
│      await stagehand.init();                              │
│    `                                                       │
│  })                                                        │
│         │                                                  │
│         ▼                                                  │
│  jslab kernel executes in Node.js runtime                 │
│         │                                                  │
│         ▼                                                  │
│  Stagehand controls browser via CDP                       │
└───────────────────────────────────────────────────────────┘
```

#### Usage Example

```javascript
// Step 1: initialize once (stateful kernel session)
execute_code({
  notebook_file: "/workspace/.kiro/scripts/browser.ipynb",
  description: "Initialize Stagehand and open target page",
  code: `
const { Stagehand, CustomOpenAIClient } = kiro.require("@browserbasehq/stagehand")
const OpenAI = kiro.require("openai").default

const stagehand = new Stagehand({
  env: "LOCAL",
  llmClient: new CustomOpenAIClient({
    modelName: process.env.BROWSER_LLM_MODEL,
    client: new OpenAI({
      apiKey: process.env.BROWSER_LLM_API_KEY,
      baseURL: process.env.BROWSER_LLM_BASE_URL,
    }),
  }),
})

await stagehand.init()
const page = stagehand.context.pages()[0]
await page.goto("https://demo.site/login")
console.log("Stagehand ready")
`,
})

// Step 2: Variables persist, reuse existing variables in the same notebook_file
execute_code({
  notebook_file: "/workspace/.kiro/scripts/browser.ipynb",
  description: "Perform actions and extract structured result",
  code: `
await stagehand.act("type user@example.com into email input")
await stagehand.act("type correct-password into password input")
await stagehand.act("click sign in button")

const result = await stagehand.extract(
  "extract current page title and whether login succeeded",
  {
    type: "object",
    properties: {
      title: { type: "string" },
      login_success: { type: "boolean" },
    },
    required: ["title", "login_success"],
  }
)

console.log(result)
`,
})
```

#### Install Dependencies

```bash
# The agent load packages from ${script_dir}/node_modules, by default, it is .kiro/scripts/node_modules
# In your project's .kiro/scripts directory
cd .kiro/scripts
npm init -y
npm install @browserbasehq/stagehand
```

---

## Spec-Driven Development

Specs are stored in `.kiro/specs/<feature>/`:

```
.kiro/specs/
└── my-feature/
    ├── requirements.md   # What to build
    ├── design.md         # How to build it
    └── tasks.md          # Implementation steps (supports task graph syntax)
```

### Spec Workflow

1. **Requirements**: Define what you're building
2. **Design**: Plan the architecture and approach
3. **Tasks**: Break down into actionable steps (use task graph for complex flows)
4. **Implementation**: Execute tasks via spec-task-execution subagent

## Background Tasks

Run subagents in parallel without blocking:

```typescript
// Start background exploration
backgroundTask({
  subagent_type: "kiroExplore",
  description: "Explore auth flow",
  prompt: "Find all authentication-related code",
})

// Check status
backgroundTaskStatus({ taskId: "task-uuid" })

// Get results when complete
getTaskOutput({ taskId: "task-uuid" })
```

## Clipboard Files Queue

Oh My Kiro automatically saves pasted images to a persistent queue (~/.local/share/opencode/kiro/clipboard-files-queue/{sessionID}/{datetime}.png), enabling image analysis even with non-vision models:

```
User: [pastes screenshot]
Agent: [calls lookAt with index=-1 to analyze most recent image]
```

## Acknowledgments

- [Kiro](https://kiro.dev/) - Original spec-driven development inspiration
- [OpenCode](https://github.com/anomalyco/opencode) - The platform this plugin runs on
- [tslab](https://github.com/yunabe/tslab) - JavaScript kernel for Jupyter
- [Stagehand](https://github.com/browserbase/stagehand) - AI-powered browser automation
