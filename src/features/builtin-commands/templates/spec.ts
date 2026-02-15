/**
 * /spec command template for spec-driven development workflow
 */

export const SPEC_TEMPLATE = `# /spec Command - Spec-Driven Development Workflow

When the user uses the \`/spec\` prefix, they want to work with spec-driven development workflow.

## Command Detection

You have detected that the user is using the \`/spec\` command. This means:

1. **Prefer spec-task-execution subagent** for implementation tasks
2. **Use the requirements-first-workflow** for creating new specs
3. **Follow the spec workflow**: Requirements → Design → Tasks → Implementation

## Instructions

### Case 0: Just /spec (no arguments)
If the user just says \`/spec\` without any arguments:

1. Look at \`.kiro/specs/\` to find existing specs
2. If one spec exists: Focus on that spec and recommend next action
3. If multiple specs: Ask user which spec they want to work on
4. If no specs: Ask if user wants to create a new spec

### Case 1: /spec with action/request (no feature name)
If the user provides a request without a feature name (e.g., \`/spec run task 1\`, \`/spec continue\`):

1. **Infer the spec from context** - check \`.kiro/specs/\` for existing specs
2. If context makes it clear which spec, proceed with that spec
3. If ambiguous, ask the user to clarify
4. **IMPORTANT**: Use \`invokeSubAgent\` with name="spec-task-execution" for implementation

### Case 2: Feature name only (e.g., \`/spec my-feature\`)
If the user provides only a feature name:

1. Check if \`.kiro/specs/{feature-name}/\` exists
2. If exists: Read the spec files and recommend next action
3. If not exists: Ask if user wants to create a new spec using requirements-first-workflow

### Case 3: Feature name + task number (e.g., \`/spec my-feature 1\`)
If the user specifies a feature and task number:

1. Read \`.kiro/specs/{feature-name}/tasks.md\` to identify the task
2. **IMPORTANT**: Use \`invokeSubAgent\` with name="spec-task-execution" to execute the task
3. The subagent will handle all implementation details

### Case 4: Feature name + run-all (e.g., \`/spec my-feature run-all\`)
If the user wants to run all tasks for a specific spec:

1. Read \`.kiro/specs/{feature-name}/tasks.md\`
2. Follow the "Run All Tasks Mode" procedure from orchestrator instructions
3. Queue and execute tasks sequentially using \`invokeSubAgent\` with name="spec-task-execution"

### Case 5: Status query (e.g., \`/spec my-feature status\` or \`/spec status\`)
If the user asks about spec status:

1. Read the relevant spec files
2. Provide information without starting any tasks
3. Only start tasks when explicitly requested

## Key Principle

**When in \`/spec\` mode, ALWAYS prefer \`invokeSubAgent(name="spec-task-execution")\` over direct implementation.**

This ensures:
- Consistent spec-driven workflow
- Proper task tracking
- Better isolation and error handling
- Adherence to the spec documents

## Context Inference

When no feature name is provided, use these hints to infer the relevant spec:
- Previous conversation context about a specific feature
- Recently modified files in \`.kiro/specs/\`
- The only spec if there's just one
- User's described task matching a spec's tasks`
