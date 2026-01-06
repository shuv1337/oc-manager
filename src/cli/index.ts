/**
 * CLI entrypoint module.
 *
 * Provides Commander-based CLI with subcommands for projects, sessions,
 * chat, and tokens. Global options are defined here and passed to
 * subcommand handlers.
 */

import { Command } from "commander"
import { resolve } from "node:path"
import { DEFAULT_ROOT } from "../lib/opencode-data"

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
    .version("0.3.1")
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
  const projects = program
    .command("projects")
    .description("Manage OpenCode projects")

  projects
    .command("list")
    .description("List projects")
    .action(() => {
      console.log("projects list: not yet implemented")
    })

  projects
    .command("delete")
    .description("Delete a project")
    .action(() => {
      console.log("projects delete: not yet implemented")
    })

  // Sessions subcommand group
  const sessions = program
    .command("sessions")
    .description("Manage OpenCode sessions")

  sessions
    .command("list")
    .description("List sessions")
    .action(() => {
      console.log("sessions list: not yet implemented")
    })

  sessions
    .command("delete")
    .description("Delete a session")
    .action(() => {
      console.log("sessions delete: not yet implemented")
    })

  sessions
    .command("rename")
    .description("Rename a session")
    .action(() => {
      console.log("sessions rename: not yet implemented")
    })

  sessions
    .command("move")
    .description("Move a session to another project")
    .action(() => {
      console.log("sessions move: not yet implemented")
    })

  sessions
    .command("copy")
    .description("Copy a session to another project")
    .action(() => {
      console.log("sessions copy: not yet implemented")
    })

  // Chat subcommand group
  const chat = program
    .command("chat")
    .description("View and search chat messages")

  chat
    .command("list")
    .description("List messages in a session")
    .action(() => {
      console.log("chat list: not yet implemented")
    })

  chat
    .command("show")
    .description("Show a specific message")
    .action(() => {
      console.log("chat show: not yet implemented")
    })

  chat
    .command("search")
    .description("Search chat content across sessions")
    .action(() => {
      console.log("chat search: not yet implemented")
    })

  // Tokens subcommand group
  const tokens = program
    .command("tokens")
    .description("View token usage statistics")

  tokens
    .command("session")
    .description("Show token usage for a session")
    .action(() => {
      console.log("tokens session: not yet implemented")
    })

  tokens
    .command("project")
    .description("Show token usage for a project")
    .action(() => {
      console.log("tokens project: not yet implemented")
    })

  tokens
    .command("global")
    .description("Show global token usage")
    .action(() => {
      console.log("tokens global: not yet implemented")
    })

  // TUI subcommand to explicitly launch TUI from CLI
  program
    .command("tui")
    .description("Launch the Terminal UI")
    .action(async () => {
      const { bootstrap } = await import("../tui/index")
      const opts = program.opts()
      await bootstrap(["--root", opts.root])
    })

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
