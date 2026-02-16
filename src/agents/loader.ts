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

function hydrate(prompt: string, model?: string) {
  const withTime = replaceBlock(prompt, "current_date_and_time", nowText())
  const withSystem = replaceBlock(withTime, "system_information", systemText())
  return replaceBlock(withSystem, "model_information", modelText(model))
}

export function loadAgentPrompt(agentName: string, model?: string): string | null {
  const prompt = getPrompt(agentName)
  if (prompt) return hydrate(prompt, model)
  console.warn(`Agent prompt not found for ${agentName}.`)
  return null
}
