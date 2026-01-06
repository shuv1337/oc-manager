/**
 * Projects CLI subcommands.
 *
 * Provides commands for listing and deleting OpenCode projects.
 */

import { Command, type OptionValues } from "commander"
import { parseGlobalOptions, type GlobalOptions } from "../index"

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
    .description("Delete a project")
    .requiredOption("--id <projectId>", "Project ID to delete")
    .action(function (this: Command) {
      const globalOpts = parseGlobalOptions(collectOptions(this))
      const cmdOpts = this.opts()
      const deleteOpts: ProjectsDeleteOptions = {
        id: String(cmdOpts.id),
      }
      handleProjectsDelete(globalOpts, deleteOpts)
    })
}

/**
 * Handle the projects list command.
 */
function handleProjectsList(
  globalOpts: GlobalOptions,
  listOpts: ProjectsListOptions
): void {
  console.log("projects list: not yet implemented")
  console.log("Global options:", globalOpts)
  console.log("List options:", listOpts)
}

/**
 * Handle the projects delete command.
 */
function handleProjectsDelete(
  globalOpts: GlobalOptions,
  deleteOpts: ProjectsDeleteOptions
): void {
  console.log("projects delete: not yet implemented")
  console.log("Global options:", globalOpts)
  console.log("Delete options:", deleteOpts)
}
