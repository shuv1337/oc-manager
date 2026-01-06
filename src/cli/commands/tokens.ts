/**
 * Tokens CLI subcommands.
 *
 * Provides commands for viewing token usage statistics at session,
 * project, and global levels.
 */

import { Command, type OptionValues } from "commander"
import { parseGlobalOptions, type GlobalOptions } from "../index"
import {
  computeGlobalTokenSummary,
  computeProjectTokenSummary,
  computeSessionTokenSummary,
  loadProjectRecords,
  loadSessionRecords,
} from "../../lib/opencode-data"
import { getOutputOptions, printAggregateTokensOutput, printTokensOutput } from "../output"
import { handleError } from "../errors"
import { findProjectById, findSessionById } from "../resolvers"

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
 * Options specific to the tokens session command.
 */
export interface TokensSessionOptions {
  /** Session ID to show token usage for */
  session: string
}

/**
 * Options specific to the tokens project command.
 */
export interface TokensProjectOptions {
  /** Project ID to show token usage for */
  project: string
}

/**
 * Register tokens subcommands on the given parent command.
 */
export function registerTokensCommands(parent: Command): void {
  const tokens = parent
    .command("tokens")
    .description("View token usage statistics")

  tokens
    .command("session")
    .description("Show token usage for a session")
    .requiredOption("--session <sessionId>", "Session ID to show token usage for")
    .action(async function (this: Command) {
      const globalOpts = parseGlobalOptions(collectOptions(this))
      const cmdOpts = this.opts()
      const sessionOpts: TokensSessionOptions = {
        session: String(cmdOpts.session),
      }
      try {
        await handleTokensSession(globalOpts, sessionOpts)
      } catch (error) {
        handleError(error, globalOpts.format)
      }
    })

  tokens
    .command("project")
    .description("Show token usage for a project")
    .requiredOption("--project <projectId>", "Project ID to show token usage for")
    .action(async function (this: Command) {
      const globalOpts = parseGlobalOptions(collectOptions(this))
      const cmdOpts = this.opts()
      const projectOpts: TokensProjectOptions = {
        project: String(cmdOpts.project),
      }
      try {
        await handleTokensProject(globalOpts, projectOpts)
      } catch (error) {
        handleError(error, globalOpts.format)
      }
    })

  tokens
    .command("global")
    .description("Show global token usage")
    .action(async function (this: Command) {
      const globalOpts = parseGlobalOptions(collectOptions(this))
      try {
        await handleTokensGlobal(globalOpts)
      } catch (error) {
        handleError(error, globalOpts.format)
      }
    })
}

/**
 * Handle the tokens session command.
 */
async function handleTokensSession(
  globalOpts: GlobalOptions,
  sessionOpts: TokensSessionOptions
): Promise<void> {
  // Load all sessions to find the one we want
  const sessions = await loadSessionRecords({ root: globalOpts.root })

  // Find the session by ID
  const session = findSessionById(sessions, sessionOpts.session)

  // Compute token summary for the session
  const summary = await computeSessionTokenSummary(session, globalOpts.root)

  // Output the result
  const outputOpts = getOutputOptions(globalOpts)
  printTokensOutput(summary, outputOpts.format)
}

/**
 * Handle the tokens project command.
 */
async function handleTokensProject(
  globalOpts: GlobalOptions,
  projectOpts: TokensProjectOptions
): Promise<void> {
  // Load all projects to validate the project exists
  const projects = await loadProjectRecords({ root: globalOpts.root })

  // Find the project by ID (throws if not found)
  findProjectById(projects, projectOpts.project)

  // Load all sessions to compute token summary
  const sessions = await loadSessionRecords({ root: globalOpts.root })

  // Compute token summary for the project
  const summary = await computeProjectTokenSummary(
    projectOpts.project,
    sessions,
    globalOpts.root
  )

  // Output the result
  const outputOpts = getOutputOptions(globalOpts)
  printAggregateTokensOutput(summary, outputOpts.format, `Project: ${projectOpts.project}`)
}

/**
 * Handle the tokens global command.
 */
async function handleTokensGlobal(globalOpts: GlobalOptions): Promise<void> {
  // Load all sessions to compute global token summary
  const sessions = await loadSessionRecords({ root: globalOpts.root })

  // Compute token summary across all sessions
  const summary = await computeGlobalTokenSummary(sessions, globalOpts.root)

  // Output the result
  const outputOpts = getOutputOptions(globalOpts)
  printAggregateTokensOutput(summary, outputOpts.format, "Global")
}
