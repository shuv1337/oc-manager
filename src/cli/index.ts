/**
 * CLI entrypoint module.
 *
 * Provides Commander-based CLI with subcommands for projects, sessions,
 * chat, and tokens. Global options are defined here and passed to
 * subcommand handlers.
 */

import { Command, type OptionValues } from "commander"
import { resolve } from "node:path"
import { DEFAULT_ROOT } from "../lib/opencode-data"
import { registerProjectsCommands } from "./commands/projects"
import { registerSessionsCommands } from "./commands/sessions"
import { registerChatCommands } from "./commands/chat"
import { registerTokensCommands } from "./commands/tokens"
import { registerTUICommand } from "./commands/tui"

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
 * Global CLI options available to all subcommands.
 */
export interface GlobalOptions {
  /** Root path to OpenCode metadata store */
  root: string
  /** Output format: json, ndjson, or table */
  format: "json" | "ndjson" | "table"
  /** Maximum number of records to return */
  limit: number
  /** Sort order for list commands */
  sort: "updated" | "created"
  /** Skip confirmation prompts for destructive operations */
  yes: boolean
  /** Show planned changes without executing */
  dryRun: boolean
  /** Suppress non-essential output */
  quiet: boolean
  /** Copy output to clipboard */
  clipboard: boolean
  /** Directory for backup copies before deletion */
  backupDir?: string
}

/**
 * Default global options.
 */
export const DEFAULT_OPTIONS: GlobalOptions = {
  root: DEFAULT_ROOT,
  format: "table",
  limit: 200,
  sort: "updated",
  yes: false,
  dryRun: false,
  quiet: false,
  clipboard: false,
  backupDir: undefined,
}

/**
 * Create the Commander program with global options and subcommands.
 */
function createProgram(): Command {
  const program = new Command()

  program
    .name("opencode-manager")
    .description("CLI for managing OpenCode metadata stores")
    .version("0.4.0")
    // Global options
    .option(
      "-r, --root <path>",
      "Root path to OpenCode metadata store",
      DEFAULT_OPTIONS.root
    )
    .option(
      "-f, --format <format>",
      "Output format: json, ndjson, or table",
      DEFAULT_OPTIONS.format
    )
    .option(
      "-l, --limit <number>",
      "Maximum number of records to return",
      String(DEFAULT_OPTIONS.limit)
    )
    .option(
      "--sort <order>",
      "Sort order: updated or created",
      DEFAULT_OPTIONS.sort
    )
    .option("-y, --yes", "Skip confirmation prompts", DEFAULT_OPTIONS.yes)
    .option(
      "-n, --dry-run",
      "Show planned changes without executing",
      DEFAULT_OPTIONS.dryRun
    )
    .option("-q, --quiet", "Suppress non-essential output", DEFAULT_OPTIONS.quiet)
    .option("-c, --clipboard", "Copy output to clipboard", DEFAULT_OPTIONS.clipboard)
    .option("--backup-dir <path>", "Directory for backup copies before deletion")

  // Projects subcommand group
  registerProjectsCommands(program)

  // Sessions subcommand group
  registerSessionsCommands(program)

  // Chat subcommand group
  registerChatCommands(program)

  // Tokens subcommand group
  registerTokensCommands(program)

  // TUI subcommand to explicitly launch TUI from CLI
  registerTUICommand(program)

  return program
}

/**
 * Parse global options from Commander's parsed options object.
 * Resolves paths and converts types as needed.
 */
export function parseGlobalOptions(opts: Record<string, unknown>): GlobalOptions {
  return {
    root: resolve(String(opts.root ?? DEFAULT_OPTIONS.root)),
    format: validateFormat(String(opts.format ?? DEFAULT_OPTIONS.format)),
    limit: parseInt(String(opts.limit ?? DEFAULT_OPTIONS.limit), 10),
    sort: validateSort(String(opts.sort ?? DEFAULT_OPTIONS.sort)),
    yes: Boolean(opts.yes ?? DEFAULT_OPTIONS.yes),
    dryRun: Boolean(opts.dryRun ?? DEFAULT_OPTIONS.dryRun),
    quiet: Boolean(opts.quiet ?? DEFAULT_OPTIONS.quiet),
    clipboard: Boolean(opts.clipboard ?? DEFAULT_OPTIONS.clipboard),
    backupDir: opts.backupDir ? resolve(String(opts.backupDir)) : undefined,
  }
}

function validateFormat(format: string): GlobalOptions["format"] {
  if (format === "json" || format === "ndjson" || format === "table") {
    return format
  }
  return DEFAULT_OPTIONS.format
}

function validateSort(sort: string): GlobalOptions["sort"] {
  if (sort === "updated" || sort === "created") {
    return sort
  }
  return DEFAULT_OPTIONS.sort
}

/**
 * Run the CLI with the given arguments.
 * This is the main entry point called from opencode-manager.ts.
 */
export async function runCLI(args: string[]): Promise<void> {
  const program = createProgram()
  await program.parseAsync(args, { from: "user" })
}
