/**
 * Sessions CLI subcommands.
 *
 * Provides commands for listing, deleting, renaming, moving, and copying
 * OpenCode sessions.
 */

import { Command, type OptionValues } from "commander"
import { parseGlobalOptions, type GlobalOptions } from "../index"
import { loadSessionRecords, type SessionRecord } from "../../lib/opencode-data"
import { getOutputOptions, printSessionsOutput } from "../output"

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
 * Options specific to the sessions list command.
 */
export interface SessionsListOptions {
  /** Filter sessions by project ID */
  project?: string
  /** Search query to filter sessions (fuzzy match) */
  search?: string
}

/**
 * Options specific to the sessions delete command.
 */
export interface SessionsDeleteOptions {
  /** Session ID to delete */
  session: string
}

/**
 * Options specific to the sessions rename command.
 */
export interface SessionsRenameOptions {
  /** Session ID to rename */
  session: string
  /** New title for the session */
  title: string
}

/**
 * Options specific to the sessions move command.
 */
export interface SessionsMoveOptions {
  /** Session ID to move */
  session: string
  /** Target project ID */
  to: string
}

/**
 * Options specific to the sessions copy command.
 */
export interface SessionsCopyOptions {
  /** Session ID to copy */
  session: string
  /** Target project ID */
  to: string
}

/**
 * Register sessions subcommands on the given parent command.
 */
export function registerSessionsCommands(parent: Command): void {
  const sessions = parent
    .command("sessions")
    .description("Manage OpenCode sessions")

  sessions
    .command("list")
    .description("List sessions")
    .option("-p, --project <projectId>", "Filter by project ID")
    .option("-s, --search <query>", "Search query to filter sessions")
    .action(function (this: Command) {
      const globalOpts = parseGlobalOptions(collectOptions(this))
      const cmdOpts = this.opts()
      const listOpts: SessionsListOptions = {
        project: cmdOpts.project as string | undefined,
        search: cmdOpts.search as string | undefined,
      }
      handleSessionsList(globalOpts, listOpts)
    })

  sessions
    .command("delete")
    .description("Delete a session")
    .requiredOption("--session <sessionId>", "Session ID to delete")
    .action(function (this: Command) {
      const globalOpts = parseGlobalOptions(collectOptions(this))
      const cmdOpts = this.opts()
      const deleteOpts: SessionsDeleteOptions = {
        session: String(cmdOpts.session),
      }
      handleSessionsDelete(globalOpts, deleteOpts)
    })

  sessions
    .command("rename")
    .description("Rename a session")
    .requiredOption("--session <sessionId>", "Session ID to rename")
    .requiredOption("-t, --title <title>", "New title for the session")
    .action(function (this: Command) {
      const globalOpts = parseGlobalOptions(collectOptions(this))
      const cmdOpts = this.opts()
      const renameOpts: SessionsRenameOptions = {
        session: String(cmdOpts.session),
        title: String(cmdOpts.title),
      }
      handleSessionsRename(globalOpts, renameOpts)
    })

  sessions
    .command("move")
    .description("Move a session to another project")
    .requiredOption("--session <sessionId>", "Session ID to move")
    .requiredOption("--to <projectId>", "Target project ID")
    .action(function (this: Command) {
      const globalOpts = parseGlobalOptions(collectOptions(this))
      const cmdOpts = this.opts()
      const moveOpts: SessionsMoveOptions = {
        session: String(cmdOpts.session),
        to: String(cmdOpts.to),
      }
      handleSessionsMove(globalOpts, moveOpts)
    })

  sessions
    .command("copy")
    .description("Copy a session to another project")
    .requiredOption("--session <sessionId>", "Session ID to copy")
    .requiredOption("--to <projectId>", "Target project ID")
    .action(function (this: Command) {
      const globalOpts = parseGlobalOptions(collectOptions(this))
      const cmdOpts = this.opts()
      const copyOpts: SessionsCopyOptions = {
        session: String(cmdOpts.session),
        to: String(cmdOpts.to),
      }
      handleSessionsCopy(globalOpts, copyOpts)
    })
}

/**
 * Handle the sessions list command.
 */
async function handleSessionsList(
  globalOpts: GlobalOptions,
  listOpts: SessionsListOptions
): Promise<void> {
  // Load session records from the data layer
  // If a project filter is provided, pass it to the loader
  let sessions = await loadSessionRecords({
    root: globalOpts.root,
    projectId: listOpts.project,
  })

  // Apply limit cap (default 200)
  sessions = sessions.slice(0, globalOpts.limit)

  // Output the sessions using the appropriate formatter
  const outputOpts = getOutputOptions(globalOpts)
  printSessionsOutput(sessions, outputOpts)
}

/**
 * Handle the sessions delete command.
 */
function handleSessionsDelete(
  globalOpts: GlobalOptions,
  deleteOpts: SessionsDeleteOptions
): void {
  console.log("sessions delete: not yet implemented")
  console.log("Global options:", globalOpts)
  console.log("Delete options:", deleteOpts)
}

/**
 * Handle the sessions rename command.
 */
function handleSessionsRename(
  globalOpts: GlobalOptions,
  renameOpts: SessionsRenameOptions
): void {
  console.log("sessions rename: not yet implemented")
  console.log("Global options:", globalOpts)
  console.log("Rename options:", renameOpts)
}

/**
 * Handle the sessions move command.
 */
function handleSessionsMove(
  globalOpts: GlobalOptions,
  moveOpts: SessionsMoveOptions
): void {
  console.log("sessions move: not yet implemented")
  console.log("Global options:", globalOpts)
  console.log("Move options:", moveOpts)
}

/**
 * Handle the sessions copy command.
 */
function handleSessionsCopy(
  globalOpts: GlobalOptions,
  copyOpts: SessionsCopyOptions
): void {
  console.log("sessions copy: not yet implemented")
  console.log("Global options:", globalOpts)
  console.log("Copy options:", copyOpts)
}
