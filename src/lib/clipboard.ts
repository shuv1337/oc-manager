import { exec } from "node:child_process"

/**
 * Copy text to the system clipboard.
 * Uses pbcopy on macOS and xclip on Linux.
 *
 * @param text The text to copy to clipboard
 * @returns Promise that resolves when copy is complete, rejects on error
 */
export function copyToClipboard(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd =
      process.platform === "darwin" ? "pbcopy" : "xclip -selection clipboard"
    const proc = exec(cmd, (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
    proc.stdin?.write(text)
    proc.stdin?.end()
  })
}

/**
 * Copy text to clipboard, logging errors to console.
 * This is a fire-and-forget version for use in contexts where
 * error handling is not critical.
 *
 * @param text The text to copy to clipboard
 */
export function copyToClipboardSync(text: string): void {
  copyToClipboard(text).catch((error) => {
    console.error("Failed to copy to clipboard:", error)
  })
}
