/**
 * TUI entrypoint module.
 *
 * Exports `launchTUI(args)` for starting the OpenCode Metadata TUI.
 * This module serves as the public interface for launching the TUI,
 * allowing both direct execution and programmatic invocation from CLI.
 *
 * NOTE: This file currently imports App from the main TUI file.
 * A future refactor task will move `opencode-tui.tsx` to `tui/app.tsx`.
 */

import { resolve } from "node:path"
import { createRoot } from "@opentui/react"
import { createCliRenderer } from "@opentui/core"

// TODO: Replace with "./app" import after moving opencode-tui.tsx to tui/app.tsx
import { App } from "../opencode-tui"
import { DEFAULT_ROOT } from "../lib/opencode-data"

export interface TUIOptions {
  root: string
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
  }

  return { root }
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
 * Launch the TUI with the given options.
 * This is the main entrypoint for starting the TUI.
 */
export async function launchTUI(options?: Partial<TUIOptions>): Promise<void> {
  const root = options?.root ?? DEFAULT_ROOT
  const renderer = await createCliRenderer()
  createRoot(renderer).render(<App root={root} />)
}

/**
 * Bootstrap the TUI from command-line arguments.
 * Parses args and launches the TUI.
 */
export async function bootstrap(): Promise<void> {
  const options = parseArgs()
  await launchTUI(options)
}
