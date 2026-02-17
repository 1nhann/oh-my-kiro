import { getPrompt } from "./prompts"

function block(tag: string, value: string) {
  return `<${tag}>\n${value}\n</${tag}>`
}

function replaceBlock(text: string, tag: string, value: string) {
  return text.replace(new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`, "g"), block(tag, value))
}

function nowText() {
  const now = new Date()
  const date = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  const day = now.toLocaleDateString("en-US", { weekday: "long" })
  return `Date: ${date}\nDay of Week: ${day}\n\nUse this carefully for any queries involving date, time, or ranges. Pay close attention to the year when considering if dates are in the past or future.`
}

function systemText() {
  const shell = process.env.SHELL?.split("/").at(-1) || "unknown"
  return `Operating System: ${process.platform}\nPlatform: ${process.platform}\nShell: ${shell}`
}

function modelText(model?: string) {
  const name = model || "runtime-selected"
  return `Name: ${name}\nDescription: Model selected by runtime configuration`
}

/**
 * Remove lookAt-related content from the prompt
 * This includes the "### 2. Multimodal Analysis (Tool)" section
 */
function removeLookAtContent(prompt: string): string {
  // Remove the lookAt tool section (### 2. Multimodal Analysis)
  // Pattern matches from "### 2. Multimodal Analysis" to the next "###" or end of section
  return prompt.replace(
    /### 2\. Multimodal Analysis \(Tool\)[\s\S]*?(?=### 3\.|$)/,
    ""
  ).replace(
    // Also fix the numbering after removal (### 3 -> ### 2, etc.)
    /### 3\. AST-based Search & Refactoring/,
    "### 2. AST-based Search & Refactoring"
  ).replace(
    /### 4\. Text & File Search/,
    "### 3. Text & File Search"
  ).replace(
    /### 5\. Background Task Tools/,
    "### 4. Background Task Tools"
  ).replace(
    /### 6\. LSP Tools/,
    "### 5. LSP Tools"
  )
}

function hydrate(prompt: string, model?: string, lookAtEnabled: boolean = true) {
  let result = prompt

  // Remove lookAt content if disabled
  if (!lookAtEnabled) {
    result = removeLookAtContent(result)
  }

  const withTime = replaceBlock(result, "current_date_and_time", nowText())
  const withSystem = replaceBlock(withTime, "system_information", systemText())
  return replaceBlock(withSystem, "model_information", modelText(model))
}

export function loadAgentPrompt(agentName: string, model?: string, lookAtEnabled: boolean = true): string | null {
  const prompt = getPrompt(agentName)
  if (prompt) return hydrate(prompt, model, lookAtEnabled)
  console.warn(`Agent prompt not found for ${agentName}.`)
  return null
}
