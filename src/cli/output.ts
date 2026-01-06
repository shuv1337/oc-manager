/**
 * CLI output module.
 *
 * Provides a unified interface for outputting data in different formats
 * based on the --format global option (json, ndjson, table).
 *
 * This module acts as a router that selects the appropriate formatter
 * based on the format option and handles all domain-specific output types.
 */

import type { GlobalOptions } from "./index"
import type {
  AggregateTokenSummary,
  ChatMessage,
  ChatSearchResult,
  ProjectRecord,
  SessionRecord,
  TokenSummary,
} from "../lib/opencode-data"

// Import formatters
import {
  formatJson,
  formatJsonArraySuccess,
  formatJsonError,
  formatJsonSuccess,
  printJson,
  printJsonArraySuccess,
  printJsonError,
  printJsonSuccess,
  type JsonFormatOptions,
  type JsonResponse,
} from "./formatters/json"
import { formatNdjson, printNdjson } from "./formatters/ndjson"
import {
  formatAggregateTokenSummary,
  formatChatSearchTable,
  formatChatTable,
  formatProjectsTable,
  formatSessionsTable,
  formatTokenSummary,
  printAggregateTokenSummary,
  printChatSearchTable,
  printChatTable,
  printProjectsTable,
  printSessionsTable,
  printTokenSummary,
  type IndexedChatSearchResult,
  type TableFormatOptions,
} from "./formatters/table"

// ========================
// Types
// ========================

/**
 * Output format types supported by the CLI.
 */
export type OutputFormat = "json" | "ndjson" | "table"

/**
 * Output options derived from global CLI options.
 */
export interface OutputOptions {
  format: OutputFormat
  quiet?: boolean
  /** Metadata for list responses (limit, truncation info) */
  meta?: {
    limit?: number
    truncated?: boolean
  }
}

/**
 * Extract output options from global CLI options.
 */
export function getOutputOptions(globalOpts: GlobalOptions): OutputOptions {
  return {
    format: globalOpts.format,
    quiet: globalOpts.quiet,
    meta: {
      limit: globalOpts.limit,
    },
  }
}

// ========================
// Generic Output Functions
// ========================

/**
 * Format any data array using the specified output format.
 * This is the low-level generic formatter - prefer domain-specific functions.
 */
export function formatOutput<T>(
  data: T[],
  format: OutputFormat,
  tableFormatter?: (data: T[], options?: TableFormatOptions) => string,
  options?: OutputOptions
): string {
  switch (format) {
    case "json":
      return formatJsonArraySuccess(data, options?.meta, {
        pretty: process.stdout.isTTY,
      })
    case "ndjson":
      return formatNdjson(data)
    case "table":
      if (tableFormatter) {
        return tableFormatter(data)
      }
      // Fallback: format as JSON if no table formatter provided
      return formatJsonArraySuccess(data, options?.meta)
    default:
      // Exhaustive check
      const _exhaustive: never = format
      throw new Error(`Unknown format: ${_exhaustive}`)
  }
}

/**
 * Print any data array using the specified output format.
 */
export function printOutput<T>(
  data: T[],
  format: OutputFormat,
  tableFormatter?: (data: T[], options?: TableFormatOptions) => string,
  options?: OutputOptions
): void {
  console.log(formatOutput(data, format, tableFormatter, options))
}

/**
 * Format a single item using the specified output format.
 */
export function formatSingleOutput<T>(
  data: T,
  format: OutputFormat,
  tableFormatter?: (data: T, options?: TableFormatOptions) => string
): string {
  switch (format) {
    case "json":
      return formatJsonSuccess(data, undefined, {
        pretty: process.stdout.isTTY,
      })
    case "ndjson":
      return formatNdjson([data])
    case "table":
      if (tableFormatter) {
        return tableFormatter(data)
      }
      return formatJsonSuccess(data)
    default:
      const _exhaustive: never = format
      throw new Error(`Unknown format: ${_exhaustive}`)
  }
}

/**
 * Print a single item using the specified output format.
 */
export function printSingleOutput<T>(
  data: T,
  format: OutputFormat,
  tableFormatter?: (data: T, options?: TableFormatOptions) => string
): void {
  console.log(formatSingleOutput(data, format, tableFormatter))
}

// ========================
// Projects Output
// ========================

/**
 * Format projects list for output.
 */
export function formatProjectsOutput(
  projects: ProjectRecord[],
  options: OutputOptions
): string {
  switch (options.format) {
    case "json":
      return formatJsonArraySuccess(projects, options.meta, {
        pretty: process.stdout.isTTY,
      })
    case "ndjson":
      return formatNdjson(projects)
    case "table":
      return formatProjectsTable(projects)
    default:
      const _exhaustive: never = options.format
      throw new Error(`Unknown format: ${_exhaustive}`)
  }
}

/**
 * Print projects list to stdout.
 */
export function printProjectsOutput(
  projects: ProjectRecord[],
  options: OutputOptions
): void {
  if (options.quiet && options.format === "table") {
    // In quiet mode with table format, just show count
    console.log(`${projects.length} project(s)`)
    return
  }
  console.log(formatProjectsOutput(projects, options))
}

// ========================
// Sessions Output
// ========================

/**
 * Format sessions list for output.
 */
export function formatSessionsOutput(
  sessions: SessionRecord[],
  options: OutputOptions
): string {
  switch (options.format) {
    case "json":
      return formatJsonArraySuccess(sessions, options.meta, {
        pretty: process.stdout.isTTY,
      })
    case "ndjson":
      return formatNdjson(sessions)
    case "table":
      return formatSessionsTable(sessions)
    default:
      const _exhaustive: never = options.format
      throw new Error(`Unknown format: ${_exhaustive}`)
  }
}

/**
 * Print sessions list to stdout.
 */
export function printSessionsOutput(
  sessions: SessionRecord[],
  options: OutputOptions
): void {
  if (options.quiet && options.format === "table") {
    console.log(`${sessions.length} session(s)`)
    return
  }
  console.log(formatSessionsOutput(sessions, options))
}

// ========================
// Chat Output
// ========================

/**
 * Chat message with index for list display.
 */
export type IndexedChatMessage = ChatMessage & { index: number }

/**
 * Format chat messages list for output.
 */
export function formatChatOutput(
  messages: IndexedChatMessage[],
  options: OutputOptions
): string {
  switch (options.format) {
    case "json":
      return formatJsonArraySuccess(messages, options.meta, {
        pretty: process.stdout.isTTY,
      })
    case "ndjson":
      return formatNdjson(messages)
    case "table":
      return formatChatTable(messages)
    default:
      const _exhaustive: never = options.format
      throw new Error(`Unknown format: ${_exhaustive}`)
  }
}

/**
 * Print chat messages list to stdout.
 */
export function printChatOutput(
  messages: IndexedChatMessage[],
  options: OutputOptions
): void {
  if (options.quiet && options.format === "table") {
    console.log(`${messages.length} message(s)`)
    return
  }
  console.log(formatChatOutput(messages, options))
}

/**
 * Format a single chat message for detailed display.
 * For table format, shows the full message content rather than a table row.
 */
export function formatChatMessageOutput(
  message: ChatMessage,
  format: OutputFormat
): string {
  switch (format) {
    case "json":
      return formatJsonSuccess(message, undefined, {
        pretty: process.stdout.isTTY,
      })
    case "ndjson":
      return formatNdjson([message])
    case "table":
      // For single message display, show formatted content
      const lines: string[] = []
      lines.push(`Message ID: ${message.messageId}`)
      lines.push(`Role: ${message.role}`)
      lines.push(`Created: ${message.createdAt?.toISOString() ?? "unknown"}`)
      if (message.tokens) {
        lines.push(`Tokens: ${message.tokens.total}`)
      }
      lines.push("")
      lines.push("Content:")
      lines.push("-".repeat(40))
      lines.push(message.previewText ?? "[No content]")
      return lines.join("\n")
    default:
      const _exhaustive: never = format
      throw new Error(`Unknown format: ${_exhaustive}`)
  }
}

/**
 * Print a single chat message to stdout.
 */
export function printChatMessageOutput(
  message: ChatMessage,
  format: OutputFormat
): void {
  console.log(formatChatMessageOutput(message, format))
}

// ========================
// Chat Search Output
// ========================

/**
 * Format chat search results for output.
 */
export function formatChatSearchOutput(
  results: IndexedChatSearchResult[],
  options: OutputOptions
): string {
  switch (options.format) {
    case "json":
      return formatJsonArraySuccess(results, options.meta, {
        pretty: process.stdout.isTTY,
      })
    case "ndjson":
      return formatNdjson(results)
    case "table":
      return formatChatSearchTable(results)
    default:
      const _exhaustive: never = options.format
      throw new Error(`Unknown format: ${_exhaustive}`)
  }
}

/**
 * Print chat search results to stdout.
 */
export function printChatSearchOutput(
  results: IndexedChatSearchResult[],
  options: OutputOptions
): void {
  if (options.quiet && options.format === "table") {
    console.log(`${results.length} match(es)`)
    return
  }
  console.log(formatChatSearchOutput(results, options))
}

// ========================
// Tokens Output
// ========================

/**
 * Format token summary for output.
 */
export function formatTokensOutput(
  summary: TokenSummary,
  format: OutputFormat
): string {
  switch (format) {
    case "json":
      return formatJsonSuccess(summary, undefined, {
        pretty: process.stdout.isTTY,
      })
    case "ndjson":
      return formatNdjson([summary])
    case "table":
      return formatTokenSummary(summary)
    default:
      const _exhaustive: never = format
      throw new Error(`Unknown format: ${_exhaustive}`)
  }
}

/**
 * Print token summary to stdout.
 */
export function printTokensOutput(
  summary: TokenSummary,
  format: OutputFormat
): void {
  console.log(formatTokensOutput(summary, format))
}

/**
 * Format aggregate token summary for output.
 */
export function formatAggregateTokensOutput(
  summary: AggregateTokenSummary,
  format: OutputFormat,
  label?: string
): string {
  switch (format) {
    case "json":
      return formatJsonSuccess(summary, undefined, {
        pretty: process.stdout.isTTY,
      })
    case "ndjson":
      return formatNdjson([summary])
    case "table":
      return formatAggregateTokenSummary(summary, { label })
    default:
      const _exhaustive: never = format
      throw new Error(`Unknown format: ${_exhaustive}`)
  }
}

/**
 * Print aggregate token summary to stdout.
 */
export function printAggregateTokensOutput(
  summary: AggregateTokenSummary,
  format: OutputFormat,
  label?: string
): void {
  console.log(formatAggregateTokensOutput(summary, format, label))
}

// ========================
// Error Output
// ========================

/**
 * Format an error for output.
 */
export function formatErrorOutput(
  error: string | Error,
  format: OutputFormat
): string {
  switch (format) {
    case "json":
    case "ndjson":
      return formatJsonError(error, { pretty: process.stdout.isTTY })
    case "table":
      // For table format, just return the error message
      const message = error instanceof Error ? error.message : error
      return `Error: ${message}`
    default:
      const _exhaustive: never = format
      throw new Error(`Unknown format: ${_exhaustive}`)
  }
}

/**
 * Print an error to stderr.
 */
export function printErrorOutput(
  error: string | Error,
  format: OutputFormat
): void {
  console.error(formatErrorOutput(error, format))
}

// ========================
// Success/Info Output
// ========================

/**
 * Format a success message for output.
 */
export function formatSuccessOutput(
  message: string,
  data?: Record<string, unknown>,
  format: OutputFormat = "table"
): string {
  switch (format) {
    case "json":
    case "ndjson":
      return formatJsonSuccess(
        data ?? { message },
        undefined,
        { pretty: process.stdout.isTTY }
      )
    case "table":
      return message
    default:
      const _exhaustive: never = format
      throw new Error(`Unknown format: ${_exhaustive}`)
  }
}

/**
 * Print a success message to stdout.
 */
export function printSuccessOutput(
  message: string,
  data?: Record<string, unknown>,
  format: OutputFormat = "table"
): void {
  console.log(formatSuccessOutput(message, data, format))
}

// ========================
// Dry-Run Output
// ========================

/**
 * Dry-run result for delete operations.
 * Mirrors DeleteResult from opencode-data but typed for CLI output.
 */
export interface DryRunResult {
  /** Paths that would be affected */
  paths: string[]
  /** Operation that would be performed */
  operation: "delete" | "backup" | "move" | "copy"
  /** Resource type (project, session) */
  resourceType: "project" | "session"
  /** Count of items affected */
  count: number
}

/**
 * Format dry-run output showing what would be affected.
 *
 * @param result - The dry-run result
 * @param format - Output format
 * @returns Formatted string
 */
export function formatDryRunOutput(
  result: DryRunResult,
  format: OutputFormat
): string {
  switch (format) {
    case "json":
      return formatJsonSuccess(
        {
          dryRun: true,
          operation: result.operation,
          resourceType: result.resourceType,
          count: result.count,
          paths: result.paths,
        },
        undefined,
        { pretty: process.stdout.isTTY }
      )
    case "ndjson":
      return formatNdjson(
        result.paths.map((path) => ({
          dryRun: true,
          operation: result.operation,
          resourceType: result.resourceType,
          path,
        }))
      )
    case "table": {
      const lines: string[] = []
      lines.push(`[DRY RUN] Would ${result.operation} ${result.count} ${result.resourceType}(s):`)
      lines.push("")
      for (const path of result.paths) {
        lines.push(`  ${path}`)
      }
      return lines.join("\n")
    }
    default:
      const _exhaustive: never = format
      throw new Error(`Unknown format: ${_exhaustive}`)
  }
}

/**
 * Print dry-run output to stdout.
 *
 * @param result - The dry-run result
 * @param format - Output format
 */
export function printDryRunOutput(
  result: DryRunResult,
  format: OutputFormat
): void {
  console.log(formatDryRunOutput(result, format))
}

/**
 * Create a DryRunResult from a list of paths.
 *
 * @param paths - List of file paths
 * @param operation - The operation being performed
 * @param resourceType - The type of resource
 * @returns DryRunResult object
 */
export function createDryRunResult(
  paths: string[],
  operation: DryRunResult["operation"],
  resourceType: DryRunResult["resourceType"]
): DryRunResult {
  return {
    paths,
    operation,
    resourceType,
    count: paths.length,
  }
}

// ========================
// Re-exports for convenience
// ========================

export {
  // JSON formatter exports
  formatJson,
  formatJsonArraySuccess,
  formatJsonError,
  formatJsonSuccess,
  printJson,
  printJsonArraySuccess,
  printJsonError,
  printJsonSuccess,
  type JsonFormatOptions,
  type JsonResponse,
} from "./formatters/json"

export { formatNdjson, printNdjson } from "./formatters/ndjson"

export {
  formatAggregateTokenSummary,
  formatChatSearchTable,
  formatChatTable,
  formatProjectsTable,
  formatSessionsTable,
  formatTokenSummary,
  printAggregateTokenSummary,
  printChatSearchTable,
  printChatTable,
  printProjectsTable,
  printSessionsTable,
  printTokenSummary,
  type IndexedChatSearchResult,
  type TableFormatOptions,
} from "./formatters/table"
