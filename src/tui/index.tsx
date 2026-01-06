/**
 * TUI entrypoint module.
 *
 * Exports `launchTUI(args)` for starting the OpenCode Metadata TUI.
 * This module serves as the public interface for launching the TUI,
 * allowing both direct execution and programmatic invocation from CLI.
 *
 * Imports the App component from `./app.tsx` for rendering.
 */

import { createRoot } from "@opentui/react"
import { createCliRenderer } from "@opentui/core"

import { App } from "./app"
import { DEFAULT_ROOT } from "../lib/opencode-data"
import { parseArgs, printUsage, type TUIOptions } from "./args"

// Re-export args module for external consumers
export { parseArgs, printUsage, type TUIOptions }

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
 *
 * @param argv - Optional argument array (defaults to process.argv.slice(2))
 */
export async function bootstrap(argv?: string[]): Promise<void> {
  const options = parseArgs(argv)
  await launchTUI(options)
}

// Auto-bootstrap when run directly
bootstrap().catch((error) => {
  console.error(error)
  process.exit(1)
})
