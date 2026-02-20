/**
 * Error classification utilities for background tasks
 */

/**
 * Extract error text from various error types
 */
export function getErrorText(error: unknown): string {
  if (!error) return ""
  if (typeof error === "string") return error
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`
  }
  if (typeof error === "object" && error !== null) {
    if ("message" in error && typeof error.message === "string") {
      return error.message
    }
    if ("name" in error && typeof error.name === "string") {
      return error.name
    }
  }
  return ""
}

/**
 * Check if error indicates an aborted session
 */
export function isAbortedSessionError(error: unknown): boolean {
  const message = getErrorText(error)
  return message.toLowerCase().includes("aborted")
}
