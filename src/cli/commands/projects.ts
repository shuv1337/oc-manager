/**
 * Projects CLI subcommands.
 *
 * Provides commands for listing and deleting OpenCode projects.
 */

import { Command, type OptionValues } from "commander"
import { parseGlobalOptions, type GlobalOptions } from "../index"
import {
  filterProjectsByState,
  type ProjectRecord,
} from "../../lib/opencode-data"
import { createProviderFromGlobalOptions } from "../../lib/opencode-data-provider"
import {
  getOutputOptions,
  printProjectsOutput,
  printDryRunOutput,
  createDryRunResult,
  printSuccessOutput,
} from "../output"
import { tokenizedSearch } from "../../lib/search"
import { resolveProjectId } from "../resolvers"
import { requireConfirmation, withErrorHandling, FileOperationError } from "../errors"
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
 * Options specific to the projects list command.
 */
export interface ProjectsListOptions {
  /** Only show projects with missing directories */
  missingOnly: boolean
  /** Search query to filter projects */
  search?: string
}

/**
 * Options specific to the projects delete command.
 */
export interface ProjectsDeleteOptions {
  /** Project ID to delete */
  id: string
  /** Skip confirmation prompt */
  yes: boolean
  /** Preview changes without deleting */
  dryRun: boolean
  /** Directory to backup files before deletion */
  backupDir?: string
}

/**
 * Register projects subcommands on the given parent command.
 */
export function registerProjectsCommands(parent: Command): void {
  const projects = parent
    .command("projects")
    .description("Manage OpenCode projects")

  projects
    .command("list")
    .description("List projects")
    .option("--missing-only", "Only show projects with missing directories", false)
    .option("-s, --search <query>", "Search query to filter projects")
    .action(function (this: Command) {
      const globalOpts = parseGlobalOptions(collectOptions(this))
      const cmdOpts = this.opts()
      const listOpts: ProjectsListOptions = {
        missingOnly: Boolean(cmdOpts.missingOnly),
        search: cmdOpts.search as string | undefined,
      }
      handleProjectsList(globalOpts, listOpts)
    })

  projects
    .command("delete")
    .description("Delete a project's metadata file")
    .requiredOption("--id <projectId>", "Project ID to delete")
    .option("--yes", "Skip confirmation prompt", false)
    .option("--dry-run", "Preview changes without deleting", false)
    .option("--backup-dir <dir>", "Directory to backup files before deletion")
    .action(async function (this: Command) {
      const allOpts = collectOptions(this)
      const globalOpts = parseGlobalOptions(allOpts)
      const cmdOpts = this.opts()
      const deleteOpts: ProjectsDeleteOptions = {
        id: String(cmdOpts.id),
        yes: Boolean(allOpts.yes ?? cmdOpts.yes),
        dryRun: Boolean(allOpts.dryRun ?? cmdOpts.dryRun),
        backupDir: (allOpts.backupDir ?? cmdOpts.backupDir) as string | undefined,
      }
      await withErrorHandling(handleProjectsDelete, getOutputOptions(globalOpts).format)(
        globalOpts,
        deleteOpts
      )
    })

  projects.addHelpText(
    "after",
    [
      "",
      "Examples:",
      "  opencode-manager projects list --experimental-sqlite",
      "  opencode-manager projects list --db ~/.local/share/opencode/opencode.db",
    ].join("\n")
  )
}

/**
 * Handle the projects list command.
 */
async function handleProjectsList(
  globalOpts: GlobalOptions,
  listOpts: ProjectsListOptions
): Promise<void> {
  // Create data provider based on global options (JSONL or SQLite backend)
  const provider = createProviderFromGlobalOptions(globalOpts)

  // Load project records from the data layer
  let projects = await provider.loadProjectRecords()

  // Apply missing-only filter if requested
  if (listOpts.missingOnly) {
    projects = filterProjectsByState(projects, "missing")
  }

  // Apply tokenized search if query provided (matches TUI semantics)
  if (listOpts.search) {
    projects = tokenizedSearch(
      projects,
      listOpts.search,
      (p) => [p.projectId, p.worktree],
      { limit: globalOpts.limit }
    )
  } else {
    // Apply limit cap even without search (default 200)
    projects = projects.slice(0, globalOpts.limit)
  }

  // Output the projects using the appropriate formatter
  const outputOpts = getOutputOptions(globalOpts)
  printProjectsOutput(projects, outputOpts)
}

/**
 * Handle the projects delete command.
 *
 * This command deletes a project's metadata file from the OpenCode storage.
 * It does NOT delete the actual project directory on disk.
 *
 * Exit codes:
 * - 0: Success (or dry-run completed)
 * - 2: Usage error (--yes not provided for destructive operation)
 * - 3: Project not found
 * - 4: File operation failure (backup or delete failed)
 */
async function handleProjectsDelete(
  globalOpts: GlobalOptions,
  deleteOpts: ProjectsDeleteOptions
): Promise<void> {
  const outputOpts = getOutputOptions(globalOpts)

  // Create data provider based on global options (JSONL or SQLite backend)
  const provider = createProviderFromGlobalOptions(globalOpts)

  // Resolve project ID to a project record (use provider for backend-agnostic resolution)
  const { project } = await resolveProjectId(deleteOpts.id, {
    root: globalOpts.root,
    allowPrefix: true,
    provider,
  })

  const pathsToDelete = [project.filePath]

  // Handle dry-run mode
  if (deleteOpts.dryRun) {
    const dryRunResult = createDryRunResult(pathsToDelete, "delete", "project")
    printDryRunOutput(dryRunResult, outputOpts.format)
    return
  }

  // Require confirmation for destructive operation
  requireConfirmation(deleteOpts.yes, "Project deletion")

  // Backup files if requested (only applies to JSONL backend - SQLite has no files to backup)
  if (deleteOpts.backupDir && provider.backend === "jsonl") {
    const backupResult = await copyToBackupDir(pathsToDelete, {
      backupDir: deleteOpts.backupDir,
      prefix: "project",
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
  const deleteResult = await provider.deleteProjectMetadata([project], { dryRun: false })

  if (deleteResult.failed.length > 0) {
    throw new FileOperationError(
      `Failed to delete ${deleteResult.failed.length} file(s): ${deleteResult.failed
        .map((f: { path: string; error?: string }) => `${f.path}: ${f.error || "unknown error"}`)
        .join(", ")}`,
      "delete"
    )
  }

  // Output success
  printSuccessOutput(
    `Deleted project: ${project.projectId}`,
    { projectId: project.projectId, deleted: deleteResult.removed },
    outputOpts.format
  )
}
