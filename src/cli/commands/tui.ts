/**
 * TUI CLI subcommand.
 *
 * Provides a command to explicitly launch the Terminal UI from the CLI.
 */

import { Command, type OptionValues } from "commander"
import { parseGlobalOptions } from "../index"

/**
 * Collect all options from a command and its ancestors.
 * Commander stores global options on the root program, not on subcommands.
 */
function collectOptions(cmd: Command): OptionValues {
  const opts: OptionValues = {}
  let current: Command | null = cmd
  while (current) {
    Object.assign(opts, current.opts())
    current = current.parent
  }
  return opts
}

/**
 * Register the TUI subcommand on the given parent command.
 */
export function registerTUICommand(parent: Command): void {
  parent
    .command("tui")
    .description("Launch the Terminal UI for interactive project management")
    .action(async function (this: Command) {
      const globalOpts = parseGlobalOptions(collectOptions(this))
      const { launchTUI } = await import("../../tui/index")
      await launchTUI({ root: globalOpts.root })
    })
}
