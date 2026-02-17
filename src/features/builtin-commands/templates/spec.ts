/**
 * /spec command template for spec-driven development workflow
 */

export const SPEC_TEMPLATE = `# /spec Command

## Guidance

- Use spec workflow: Requirements → Design → Tasks → Implementation
- Prefer \`task\` with \`subagent_type="spec-task-execution"\` for implementation
- When a feature is unclear, check \`.kiro/specs/\` and ask for clarification
- When no specs exist, offer to create one using requirements-first-workflow
- For status-only requests, read spec files and report without starting tasks`
