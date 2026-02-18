export const MULTIMODAL_LOOKER_AGENT = "multimodal-looker" as const

export const LOOK_AT_DESCRIPTION = `Analyze media files (PDFs, images, diagrams) that require interpretation beyond raw text. Extracts specific information or summaries from documents, describes visual content. Use when you need analyzed/extracted data rather than literal file contents.

CLIPBOARD FILES QUEUE (pasted files):
When the coding model lacks vision capabilities, use the clipboard files queue to analyze pasted images:
- index=-1: most recently pasted file (last one)
- index=-2: second most recent file
- index=0: oldest file in queue
This allows processing clipboard files with a multimodal model via lookAt.`
