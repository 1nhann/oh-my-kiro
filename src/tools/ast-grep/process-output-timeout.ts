/**
 * Process Output Timeout Handler
 */

import type { ChildProcess } from "child_process"

interface ProcessWithStreams {
  stdout: NodeJS.ReadableStream | null
  stderr: NodeJS.ReadableStream | null
  kill: () => void
}

export async function collectProcessOutputWithTimeout(
  process: ChildProcess,
  timeoutMs: number
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    let stdout = ""
    let stderr = ""
    let isTimedOut = false

    const timeout = setTimeout(() => {
      isTimedOut = true
      process.kill()
      reject(new Error(`Search timeout after ${timeoutMs}ms`))
    }, timeoutMs)

    if (process.stdout) {
      process.stdout.on("data", (data) => {
        stdout += data.toString()
      })
    }

    if (process.stderr) {
      process.stderr.on("data", (data) => {
        stderr += data.toString()
      })
    }

    process.on("close", (code) => {
      clearTimeout(timeout)
      if (!isTimedOut) {
        resolve({ stdout, stderr, exitCode: code ?? 0 })
      }
    })

    process.on("error", (error) => {
      clearTimeout(timeout)
      if (!isTimedOut) {
        reject(error)
      }
    })
  })
}
