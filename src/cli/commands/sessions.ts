/**
 * Sessions CLI subcommands.
 *
 * Provides commands for listing, deleting, renaming, moving, and copying
 * OpenCode sessions.
 */

import { Command, type OptionValues } from "commander"
import { parseGlobalOptions, type GlobalOptions } from "../index"
import {
  copySession,
  type SessionRecord,
} from "../../lib/opencode-data"
import { createProviderFromGlobalOptions } from "../../lib/opencode-data-provider"
import {
  getOutputOptions,
  printSessionsOutput,
  printDryRunOutput,
  createDryRunResult,
  printSuccessOutput,
} from "../output"
import { fuzzySearch, type SearchCandidate } from "../../lib/search"
import { resolveSessionId, resolveProjectId } from "../resolvers"
import { requireConfirmation, withErrorHandling, FileOperationError, UsageError } from "../errors"
import { copyToBackupDir, formatBackupResult } from "../backup"

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
  /** Skip confirmation prompt */
  yes: boolean
  /** Preview changes without deleting */
  dryRun: boolean
  /** Directory to backup files before deletion */
  backupDir?: string
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
    .description("Delete a session's metadata file")
    .requiredOption("--session <sessionId>", "Session ID to delete")
    .option("--yes", "Skip confirmation prompt", false)
    .option("--dry-run", "Preview changes without deleting", false)
    .option("--backup-dir <dir>", "Directory to backup files before deletion")
    .action(async function (this: Command) {
      const allOpts = collectOptions(this)
      const globalOpts = parseGlobalOptions(allOpts)
      const cmdOpts = this.opts()
      const deleteOpts: SessionsDeleteOptions = {
        session: String(cmdOpts.session),
        yes: Boolean(allOpts.yes ?? cmdOpts.yes),
        dryRun: Boolean(allOpts.dryRun ?? cmdOpts.dryRun),
        backupDir: (allOpts.backupDir ?? cmdOpts.backupDir) as string | undefined,
      }
      await withErrorHandling(handleSessionsDelete, getOutputOptions(globalOpts).format)(
        globalOpts,
        deleteOpts
      )
    })

  sessions
    .command("rename")
    .description("Rename a session")
    .requiredOption("--session <sessionId>", "Session ID to rename")
    .requiredOption("-t, --title <title>", "New title for the session")
    .action(async function (this: Command) {
      const globalOpts = parseGlobalOptions(collectOptions(this))
      const cmdOpts = this.opts()
      const renameOpts: SessionsRenameOptions = {
        session: String(cmdOpts.session),
        title: String(cmdOpts.title),
      }
      await withErrorHandling(handleSessionsRename, getOutputOptions(globalOpts).format)(
        globalOpts,
        renameOpts
      )
    })

  sessions
    .command("move")
    .description("Move a session to another project")
    .requiredOption("--session <sessionId>", "Session ID to move")
    .requiredOption("--to <projectId>", "Target project ID")
    .action(async function (this: Command) {
      const globalOpts = parseGlobalOptions(collectOptions(this))
      const cmdOpts = this.opts()
      const moveOpts: SessionsMoveOptions = {
        session: String(cmdOpts.session),
        to: String(cmdOpts.to),
      }
      await withErrorHandling(handleSessionsMove, getOutputOptions(globalOpts).format)(
        globalOpts,
        moveOpts
      )
    })

  sessions
    .command("copy")
    .description("Copy a session to another project")
    .requiredOption("--session <sessionId>", "Session ID to copy")
    .requiredOption("--to <projectId>", "Target project ID")
    .action(async function (this: Command) {
      const globalOpts = parseGlobalOptions(collectOptions(this))
      const cmdOpts = this.opts()
      const copyOpts: SessionsCopyOptions = {
        session: String(cmdOpts.session),
        to: String(cmdOpts.to),
      }
      await withErrorHandling(handleSessionsCopy, getOutputOptions(globalOpts).format)(
        globalOpts,
        copyOpts
      )
    })

  sessions.addHelpText(
    "after",
    [
      "",
      "Examples:",
      "  opencode-manager sessions list --experimental-sqlite",
      "  opencode-manager sessions list --db ~/.local/share/opencode/opencode.db",
    ].join("\n")
  )
}

/**
 * Build search text for a session record (matches TUI behavior).
 * Combines title, sessionId, directory, and projectId.
 */
function buildSessionSearchText(session: SessionRecord): string {
  return [
    session.title || "",
    session.sessionId,
    session.directory || "",
    session.projectId,
  ].join(" ").replace(/\s+/g, " ").trim()
}

/**
 * Handle the sessions list command.
 */
async function handleSessionsList(
  globalOpts: GlobalOptions,
  listOpts: SessionsListOptions
): Promise<void> {
  // Create data provider based on global options (JSONL or SQLite backend)
  const provider = createProviderFromGlobalOptions(globalOpts)

  // Load session records from the data layer
  // If a project filter is provided, pass it to the loader
  let sessions = await provider.loadSessionRecords({
    projectId: listOpts.project,
  })

  // Apply fuzzy search if search query is provided
  if (listOpts.search?.trim()) {
    const candidates: SearchCandidate<SessionRecord>[] = sessions.map((s) => ({
      item: s,
      searchText: buildSessionSearchText(s),
    }))
    
    const results = fuzzySearch(candidates, listOpts.search, {
      limit: globalOpts.limit,
    })
    
    // Sort by score descending, then by sort field descending, then by sessionId
    const sortField = globalOpts.sort // "updated" or "created"
    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const aTime = sortField === "created"
        ? (a.item.createdAt?.getTime() ?? 0)
        : ((a.item.updatedAt ?? a.item.createdAt)?.getTime() ?? 0)
      const bTime = sortField === "created"
        ? (b.item.createdAt?.getTime() ?? 0)
        : ((b.item.updatedAt ?? b.item.createdAt)?.getTime() ?? 0)
      if (bTime !== aTime) return bTime - aTime
      return a.item.sessionId.localeCompare(b.item.sessionId)
    })
    
    sessions = results.map((r) => r.item)
  } else {
    // Sort by the specified sort field (descending), then by sessionId
    const sortField = globalOpts.sort // "updated" or "created"
    sessions.sort((a, b) => {
      const aTime = sortField === "created"
        ? (a.createdAt?.getTime() ?? 0)
        : ((a.updatedAt ?? a.createdAt)?.getTime() ?? 0)
      const bTime = sortField === "created"
        ? (b.createdAt?.getTime() ?? 0)
        : ((b.updatedAt ?? b.createdAt)?.getTime() ?? 0)
      if (bTime !== aTime) return bTime - aTime
      return a.sessionId.localeCompare(b.sessionId)
    })
    
    // Apply limit cap (default 200) when no search
    sessions = sessions.slice(0, globalOpts.limit)
  }

  // Output the sessions using the appropriate formatter
  const outputOpts = getOutputOptions(globalOpts)
  printSessionsOutput(sessions, outputOpts)
}

/**
 * Handle the sessions delete command.
 *
 * This command deletes a session's metadata file from the OpenCode storage.
 * For SQLite backend, it deletes session, messages, and parts in a transaction.
 *
 * Exit codes:
 * - 0: Success (or dry-run completed)
 * - 2: Usage error (--yes not provided for destructive operation)
 * - 3: Session not found
 * - 4: File operation failure (backup or delete failed)
 */
async function handleSessionsDelete(
  globalOpts: GlobalOptions,
  deleteOpts: SessionsDeleteOptions
): Promise<void> {
  const outputOpts = getOutputOptions(globalOpts)

  // Create data provider based on global options (JSONL or SQLite backend)
  const provider = createProviderFromGlobalOptions(globalOpts)

  // Resolve session ID to a session record (use provider for backend-agnostic resolution)
  const { session } = await resolveSessionId(deleteOpts.session, {
    root: globalOpts.root,
    allowPrefix: true,
    provider,
  })

  const pathsToDelete = [session.filePath]

  // Handle dry-run mode
  if (deleteOpts.dryRun) {
    const dryRunResult = createDryRunResult(pathsToDelete, "delete", "session")
    printDryRunOutput(dryRunResult, outputOpts.format)
    return
  }

  // Require confirmation for destructive operation
  requireConfirmation(deleteOpts.yes, "Session deletion")

  // Backup files if requested (only applies to JSONL backend - SQLite has no files to backup)
  if (deleteOpts.backupDir && provider.backend === "jsonl") {
    const backupResult = await copyToBackupDir(pathsToDelete, {
      backupDir: deleteOpts.backupDir,
      prefix: "session",
      preserveStructure: true,
      structureRoot: globalOpts.root,
    })

    if (backupResult.failed.length > 0) {
      throw new FileOperationError(
        `Backup failed for ${backupResult.failed.length} file(s): ${backupResult.failed
          .map((f) => f.path)
          .join(", ")}`,
        "backup"
      )
    }

    if (!globalOpts.quiet) {
      console.log(formatBackupResult(backupResult))
    }
  }

  // Perform the deletion using the provider (handles both JSONL and SQLite)
  const deleteResult = await provider.deleteSessionMetadata([session], { dryRun: false })

  if (deleteResult.failed.length > 0) {
    throw new FileOperationError(
      `Failed to delete ${deleteResult.failed.length} file(s): ${deleteResult.failed
        .map((f) => `${f.path}: ${f.error || "unknown error"}`)
        .join(", ")}`,
      "delete"
    )
  }

  // Output success
  printSuccessOutput(
    `Deleted session: ${session.sessionId}`,
    { sessionId: session.sessionId, deleted: deleteResult.removed },
    outputOpts.format
  )
}

/**
 * Handle the sessions rename command.
 *
 * This command updates a session's title in its metadata file.
 * For SQLite backend, it updates the title in the database.
 *
 * Exit codes:
 * - 0: Success
 * - 2: Usage error (empty title provided)
 * - 3: Session not found
 */
async function handleSessionsRename(
  globalOpts: GlobalOptions,
  renameOpts: SessionsRenameOptions
): Promise<void> {
  const outputOpts = getOutputOptions(globalOpts)

  // Validate non-empty title
  const newTitle = renameOpts.title.trim()
  if (!newTitle) {
    throw new UsageError("Title cannot be empty")
  }

  // Create data provider based on global options (JSONL or SQLite backend)
  const provider = createProviderFromGlobalOptions(globalOpts)

  // Resolve session ID to a session record (use provider for backend-agnostic resolution)
  const { session } = await resolveSessionId(renameOpts.session, {
    root: globalOpts.root,
    allowPrefix: true,
    provider,
  })

  // Update the session title using the provider
  await provider.updateSessionTitle(session, newTitle)

  // Output success
  printSuccessOutput(
    `Renamed session: ${session.sessionId}`,
    { sessionId: session.sessionId, title: newTitle },
    outputOpts.format
  )
}

/**
 * Handle the sessions move command.
 *
 * This command moves a session to a different project.
 * For JSONL backend, the session file is moved to the target project's session directory.
 * For SQLite backend, the project_id column is updated in the database.
 *
 * Exit codes:
 * - 0: Success
 * - 3: Session or target project not found
 * - 4: File operation failure
 */
async function handleSessionsMove(
  globalOpts: GlobalOptions,
  moveOpts: SessionsMoveOptions
): Promise<void> {
  const outputOpts = getOutputOptions(globalOpts)

  // Create data provider based on global options (JSONL or SQLite backend)
  const provider = createProviderFromGlobalOptions(globalOpts)

  // Resolve session ID to a session record (use provider for backend-agnostic resolution)
  const { session } = await resolveSessionId(moveOpts.session, {
    root: globalOpts.root,
    allowPrefix: true,
    provider,
  })

  // Validate target project exists
  // Use prefix matching for convenience, but require exactly one match
  // For SQLite, we don't enforce target project existence (consistent with JSONL behavior)
  // but we still try to resolve it for prefix matching
  const { project: targetProject } = await resolveProjectId(moveOpts.to, {
    root: globalOpts.root,
    allowPrefix: true,
    provider,
  })

  // Check if session is already in the target project
  if (session.projectId === targetProject.projectId) {
    printSuccessOutput(
      `Session ${session.sessionId} is already in project ${targetProject.projectId}`,
      { sessionId: session.sessionId, projectId: targetProject.projectId, moved: false },
      outputOpts.format
    )
    return
  }

  // Move the session using the provider
  const newRecord = await provider.moveSession(session, targetProject.projectId)

  // Output success
  printSuccessOutput(
    `Moved session ${session.sessionId} to project ${targetProject.projectId}`,
    {
      sessionId: session.sessionId,
      fromProject: session.projectId,
      toProject: targetProject.projectId,
      newPath: newRecord.filePath,
    },
    outputOpts.format
  )
}

/**
 * Handle the sessions copy command.
 *
 * This command copies a session to a different project.
 * A new session file is created in the target project with a new session ID.
 *
 * Exit codes:
 * - 0: Success
 * - 3: Session or target project not found
 * - 4: File operation failure
 */
async function handleSessionsCopy(
  globalOpts: GlobalOptions,
  copyOpts: SessionsCopyOptions
): Promise<void> {
  const outputOpts = getOutputOptions(globalOpts)

  // Resolve session ID to a session record
  const { session } = await resolveSessionId(copyOpts.session, {
    root: globalOpts.root,
    allowPrefix: true,
  })

  // Validate target project exists
  // Use prefix matching for convenience, but require exactly one match
  const { project: targetProject } = await resolveProjectId(copyOpts.to, {
    root: globalOpts.root,
    allowPrefix: true,
  })

  // Copy the session
  const newRecord = await copySession(session, targetProject.projectId, globalOpts.root)

  // Output success
  printSuccessOutput(
    `Copied session ${session.sessionId} to project ${targetProject.projectId}`,
    {
      originalSessionId: session.sessionId,
      newSessionId: newRecord.sessionId,
      fromProject: session.projectId,
      toProject: targetProject.projectId,
      newPath: newRecord.filePath,
    },
    outputOpts.format
  )
}
