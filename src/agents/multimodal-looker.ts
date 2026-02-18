import { createAgentToolAllowlist } from "../shared/permission-compat"
import prompt from "./prompts/multimodal-looker"

export const MULTIMODAL_LOOKER_AGENT = "multimodal-looker" as const

/**
 * Create the multimodal-looker agent
 *
 * @param model - Optional model override. If not provided, OpenCode will use
 * its default model. For multimodal analysis, the model should support vision.
 */
export function createMultimodalLookerAgent(model?: string) {
  const restrictions = createAgentToolAllowlist(["read"])

  const config: {
    name: string
    description: string
    mode: "subagent"
    hidden: boolean
    temperature: number
    model?: string
    prompt: string
  } = {
    name: MULTIMODAL_LOOKER_AGENT,
    description:
      "Analyze media files (PDFs, images, diagrams) that require interpretation beyond raw text. Extracts specific information or summaries from documents, describes visual content. Use when you need analyzed/extracted data rather than literal file contents.",
    mode: "subagent" as const,
    hidden: true,
    temperature: 0.1,
    prompt,
  }

  // Only set model if explicitly provided (e.g., from lookAt.model config)
  // Otherwise let OpenCode use its default model
  if (model) {
    config.model = model
  }

  return {
    ...config,
    ...restrictions,
  }
}
