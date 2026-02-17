import { createAgentToolAllowlist } from "../shared/permission-compat"
import prompt from "./prompts/multimodal-looker"

export const MULTIMODAL_LOOKER_AGENT = "multimodal-looker" as const

export function createMultimodalLookerAgent(model: string = "openai/gpt-5.3-codex") {
  const restrictions = createAgentToolAllowlist(["read"])

  return {
    name: MULTIMODAL_LOOKER_AGENT,
    description:
      "Analyze media files (PDFs, images, diagrams) that require interpretation beyond raw text. Extracts specific information or summaries from documents, describes visual content. Use when you need analyzed/extracted data rather than literal file contents.",
    mode: "subagent" as const,
    hidden: true,
    model,
    temperature: 0.1,
    ...restrictions,
    prompt,
  }
}
