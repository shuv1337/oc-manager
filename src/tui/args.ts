/**
 * TUI argument parsing module.
 *
 * Exports `parseArgs()` for parsing command-line arguments
 * and `TUIOptions` type for TUI configuration.
 */

import { resolve } from "node:path"
import { DEFAULT_ROOT } from "../lib/opencode-data"

export interface TUIOptions {
  root: string
}

/**
 * Print TUI usage/help text to console.
 */
export function printUsage(): void {
  console.log(`OpenCode Metadata TUI
Usage: bun run tui [-- --root /path/to/storage]

Key bindings:
  Tab / 1 / 2     Switch between projects and sessions
  /               Start search (active tab)
  X               Clear search
  ? / H           Toggle help
  R               Reload (and refresh token cache)
  Q               Quit the application

Projects view:
  Space           Toggle selection
  A               Select all (visible)
  M               Toggle missing-only filter
  D               Delete selected (with confirmation)
  Enter           Jump to Sessions for project
  Esc             Clear selection

Sessions view:
  Space           Toggle selection
  A               Select all (visible)
  S               Toggle sort (updated/created)
  V               View chat history for selected session
  F               Search across all chat content in sessions
  Shift+R         Rename session
  M               Move selected sessions to project
  P               Copy selected sessions to project
  Y               Copy session ID to clipboard
  C               Clear project filter
  D               Delete selected (with confirmation)
  Enter           Show details
  Esc             Clear selection

Chat search (when open):
  Type            Enter search query
  Enter           Search / open selected result
  Up/Down         Navigate results
  Esc             Close search

Chat viewer (when open):
  Esc             Close viewer
  Up/Down         Navigate messages
  PgUp/PgDn       Jump 10 messages
  Home/End        Jump to first/last message
  Y               Copy message content to clipboard
`)
}

/**
 * Parse command-line arguments for TUI options.
 */
export function parseArgs(argv: string[] = process.argv.slice(2)): TUIOptions {
  let root = DEFAULT_ROOT

  for (let idx = 0; idx < argv.length; idx += 1) {
    const token = argv[idx]
    if (token === "--root" && argv[idx + 1]) {
      root = resolve(argv[idx + 1])
      idx += 1
      continue
    }
    if (token === "--help" || token === "-h") {
      printUsage()
      process.exit(0)
    }
    if (token === "--version" || token === "-V") {
      console.log("0.4.0")
      process.exit(0)
    }
  }

  return { root }
}
