/**
 * Table output formatter for CLI commands.
 *
 * Provides human-readable table output for terminal display.
 * Supports column definitions, truncation, and alignment.
 */

import type { AggregateTokenSummary, ChatMessage, ChatRole, ProjectRecord, ProjectState, SessionRecord, TokenBreakdown, TokenSummary } from "../../lib/opencode-data"

// ========================
// Column Definition Types
// ========================

export type Alignment = "left" | "right" | "center"

export interface ColumnDefinition<T, V = string | number | Date | null | undefined> {
  /** Column header label */
  header: string
  /** Width of the column (characters) */
  width: number
  /** Text alignment */
  align?: Alignment
  /** Function to extract the cell value from the row data */
  accessor: (row: T) => V
  /** Optional function to format the value for display (required for non-primitive types) */
  format?: (value: V) => string
}

export interface TableFormatOptions {
  /** Character used to separate columns (default: "  ") */
  separator?: string
  /** Character used for header underline (default: "-") */
  headerUnderline?: string
  /** Whether to show header underline (default: true) */
  showUnderline?: boolean
  /** Whether to show headers (default: true) */
  showHeaders?: boolean
  /** Truncation suffix when text is too long (default: "…") */
  truncateSuffix?: string
}

// ========================
// Core Table Utilities
// ========================

/**
 * Truncate a string to fit within a specified width.
 */
export function truncate(text: string, width: number, suffix = "…"): string {
  if (text.length <= width) {
    return text
  }
  if (width <= suffix.length) {
    return suffix.slice(0, width)
  }
  return text.slice(0, width - suffix.length) + suffix
}

/**
 * Pad a string to a specified width with alignment.
 */
export function pad(text: string, width: number, align: Alignment = "left"): string {
  if (text.length >= width) {
    return text
  }
  const padding = width - text.length
  switch (align) {
    case "right":
      return " ".repeat(padding) + text
    case "center": {
      const left = Math.floor(padding / 2)
      const right = padding - left
      return " ".repeat(left) + text + " ".repeat(right)
    }
    case "left":
    default:
      return text + " ".repeat(padding)
  }
}

/**
 * Format a cell value, truncating and padding as needed.
 */
export function formatCell(
  value: string | number | null | undefined,
  width: number,
  align: Alignment = "left",
  truncateSuffix = "…"
): string {
  const text = value == null ? "" : String(value)
  const truncated = truncate(text, width, truncateSuffix)
  return pad(truncated, width, align)
}

/**
 * Format a row of data into a table line.
 */
export function formatRow<T>(
  row: T,
  columns: ColumnDefinition<T>[],
  options?: TableFormatOptions
): string {
  const separator = options?.separator ?? "  "
  const truncateSuffix = options?.truncateSuffix ?? "…"

  return columns
    .map((col) => {
      const raw = col.accessor(row)
      // If format function is provided, use it; otherwise convert to string
      let formatted: string | number | null | undefined
      if (col.format) {
        formatted = col.format(raw)
      } else if (raw instanceof Date) {
        formatted = raw.toISOString()
      } else {
        formatted = raw as string | number | null | undefined
      }
      return formatCell(formatted, col.width, col.align ?? "left", truncateSuffix)
    })
    .join(separator)
}

/**
 * Format the header row.
 */
export function formatHeader<T>(
  columns: ColumnDefinition<T>[],
  options?: TableFormatOptions
): string {
  const separator = options?.separator ?? "  "
  return columns
    .map((col) => pad(col.header, col.width, col.align ?? "left"))
    .join(separator)
}

/**
 * Format the header underline.
 */
export function formatHeaderUnderline<T>(
  columns: ColumnDefinition<T>[],
  options?: TableFormatOptions
): string {
  const separator = options?.separator ?? "  "
  const underlineChar = options?.headerUnderline ?? "-"
  return columns
    .map((col) => underlineChar.repeat(col.width))
    .join(separator)
}

/**
 * Format a table from an array of records.
 */
export function formatTable<T>(
  data: T[],
  columns: ColumnDefinition<T>[],
  options?: TableFormatOptions
): string {
  const showHeaders = options?.showHeaders ?? true
  const showUnderline = options?.showUnderline ?? true

  const lines: string[] = []

  if (showHeaders) {
    lines.push(formatHeader(columns, options))
    if (showUnderline) {
      lines.push(formatHeaderUnderline(columns, options))
    }
  }

  for (const row of data) {
    lines.push(formatRow(row, columns, options))
  }

  return lines.join("\n")
}

/**
 * Print a table to stdout.
 */
export function printTable<T>(
  data: T[],
  columns: ColumnDefinition<T>[],
  options?: TableFormatOptions
): void {
  console.log(formatTable(data, columns, options))
}

// ========================
// Date/Time Formatting
// ========================

/**
 * Format a date for table display.
 * Uses ISO format but truncated for readability.
 */
export function formatDateForTable(date: Date | null | undefined): string {
  if (!date) {
    return "-"
  }
  // Format: YYYY-MM-DD HH:MM
  const iso = date.toISOString()
  return iso.slice(0, 16).replace("T", " ")
}

// ========================
// Projects List Columns
// ========================

/**
 * Format project state with visual indicator.
 */
export function formatProjectState(state: ProjectState): string {
  switch (state) {
    case "present":
      return "✓"
    case "missing":
      return "✗"
    case "unknown":
      return "?"
  }
}

/**
 * Column definitions for projects list output.
 *
 * Columns: #, State, Path, ProjectID, Created
 */
export const projectListColumns: ColumnDefinition<ProjectRecord>[] = [
  {
    header: "#",
    width: 4,
    align: "right",
    accessor: (row) => row.index,
  },
  {
    header: "State",
    width: 5,
    align: "center",
    accessor: (row) => row.state,
    format: (state) => formatProjectState(state as ProjectState),
  },
  {
    header: "Path",
    width: 50,
    align: "left",
    accessor: (row) => row.worktree,
  },
  {
    header: "Project ID",
    width: 24,
    align: "left",
    accessor: (row) => row.projectId,
  },
  {
    header: "Created",
    width: 16,
    align: "left",
    accessor: (row) => row.createdAt,
    format: (val) => formatDateForTable(val as Date | null | undefined),
  },
]

/**
 * Compact column definitions for projects list (narrower terminals).
 */
export const projectListColumnsCompact: ColumnDefinition<ProjectRecord>[] = [
  {
    header: "#",
    width: 4,
    align: "right",
    accessor: (row) => row.index,
  },
  {
    header: "St",
    width: 2,
    align: "center",
    accessor: (row) => row.state,
    format: (state) => formatProjectState(state as ProjectState),
  },
  {
    header: "Path",
    width: 40,
    align: "left",
    accessor: (row) => row.worktree,
  },
  {
    header: "Project ID",
    width: 20,
    align: "left",
    accessor: (row) => row.projectId,
  },
]

/**
 * Format a projects list as a table.
 */
export function formatProjectsTable(
  projects: ProjectRecord[],
  options?: TableFormatOptions & { compact?: boolean }
): string {
  const columns = options?.compact ? projectListColumnsCompact : projectListColumns
  return formatTable(projects, columns, options)
}

/**
 * Print a projects list table to stdout.
 */
export function printProjectsTable(
  projects: ProjectRecord[],
  options?: TableFormatOptions & { compact?: boolean }
): void {
  console.log(formatProjectsTable(projects, options))
}

// ========================
// Sessions List Columns
// ========================

/**
 * Column definitions for sessions list output.
 *
 * Columns: #, Title, SessionID, ProjectID, Updated, Created
 */
export const sessionListColumns: ColumnDefinition<SessionRecord>[] = [
  {
    header: "#",
    width: 4,
    align: "right",
    accessor: (row) => row.index,
  },
  {
    header: "Title",
    width: 40,
    align: "left",
    accessor: (row) => row.title,
  },
  {
    header: "Session ID",
    width: 24,
    align: "left",
    accessor: (row) => row.sessionId,
  },
  {
    header: "Project ID",
    width: 24,
    align: "left",
    accessor: (row) => row.projectId,
  },
  {
    header: "Updated",
    width: 16,
    align: "left",
    accessor: (row) => row.updatedAt,
    format: (val) => formatDateForTable(val as Date | null | undefined),
  },
  {
    header: "Created",
    width: 16,
    align: "left",
    accessor: (row) => row.createdAt,
    format: (val) => formatDateForTable(val as Date | null | undefined),
  },
]

/**
 * Compact column definitions for sessions list (narrower terminals).
 */
export const sessionListColumnsCompact: ColumnDefinition<SessionRecord>[] = [
  {
    header: "#",
    width: 4,
    align: "right",
    accessor: (row) => row.index,
  },
  {
    header: "Title",
    width: 30,
    align: "left",
    accessor: (row) => row.title,
  },
  {
    header: "Session ID",
    width: 20,
    align: "left",
    accessor: (row) => row.sessionId,
  },
  {
    header: "Updated",
    width: 16,
    align: "left",
    accessor: (row) => row.updatedAt,
    format: (val) => formatDateForTable(val as Date | null | undefined),
  },
]

/**
 * Format a sessions list as a table.
 */
export function formatSessionsTable(
  sessions: SessionRecord[],
  options?: TableFormatOptions & { compact?: boolean }
): string {
  const columns = options?.compact ? sessionListColumnsCompact : sessionListColumns
  return formatTable(sessions, columns, options)
}

/**
 * Print a sessions list table to stdout.
 */
export function printSessionsTable(
  sessions: SessionRecord[],
  options?: TableFormatOptions & { compact?: boolean }
): void {
  console.log(formatSessionsTable(sessions, options))
}

// ========================
// Chat List Columns
// ========================

/**
 * Format chat role with visual indicator.
 */
export function formatChatRole(role: ChatRole): string {
  switch (role) {
    case "user":
      return "U"
    case "assistant":
      return "A"
    case "unknown":
      return "?"
  }
}

/**
 * Format token count for display.
 * Shows abbreviated number with K suffix for thousands.
 */
export function formatTokenCount(count: number | null | undefined): string {
  if (count == null || count === 0) {
    return "-"
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`
  }
  return String(count)
}

/**
 * Column definitions for chat list output.
 *
 * Columns: #, Role, MessageID, Preview, Tokens, Created
 */
export const chatListColumns: ColumnDefinition<ChatMessage & { index: number }>[] = [
  {
    header: "#",
    width: 4,
    align: "right",
    accessor: (row) => row.index,
  },
  {
    header: "Role",
    width: 4,
    align: "center",
    accessor: (row) => row.role,
    format: (role) => formatChatRole(role as ChatRole),
  },
  {
    header: "Message ID",
    width: 24,
    align: "left",
    accessor: (row) => row.messageId,
  },
  {
    header: "Preview",
    width: 40,
    align: "left",
    accessor: (row) => row.previewText,
  },
  {
    header: "Tokens",
    width: 8,
    align: "right",
    accessor: (row) => row.tokens?.total,
    format: (val) => formatTokenCount(val as number | null | undefined),
  },
  {
    header: "Created",
    width: 16,
    align: "left",
    accessor: (row) => row.createdAt,
    format: (val) => formatDateForTable(val as Date | null | undefined),
  },
]

/**
 * Compact column definitions for chat list (narrower terminals).
 */
export const chatListColumnsCompact: ColumnDefinition<ChatMessage & { index: number }>[] = [
  {
    header: "#",
    width: 4,
    align: "right",
    accessor: (row) => row.index,
  },
  {
    header: "R",
    width: 1,
    align: "center",
    accessor: (row) => row.role,
    format: (role) => formatChatRole(role as ChatRole),
  },
  {
    header: "Preview",
    width: 50,
    align: "left",
    accessor: (row) => row.previewText,
  },
  {
    header: "Tokens",
    width: 8,
    align: "right",
    accessor: (row) => row.tokens?.total,
    format: (val) => formatTokenCount(val as number | null | undefined),
  },
]

/**
 * Format a chat list as a table.
 * Messages are expected to have an index property added.
 */
export function formatChatTable(
  messages: (ChatMessage & { index: number })[],
  options?: TableFormatOptions & { compact?: boolean }
): string {
  const columns = options?.compact ? chatListColumnsCompact : chatListColumns
  return formatTable(messages, columns, options)
}

/**
 * Print a chat list table to stdout.
 */
export function printChatTable(
  messages: (ChatMessage & { index: number })[],
  options?: TableFormatOptions & { compact?: boolean }
): void {
  console.log(formatChatTable(messages, options))
}

// ========================
// Tokens Summary Formatting
// ========================

/**
 * Row type for token breakdown table.
 * Each row represents a single token category.
 */
export interface TokenBreakdownRow {
  category: string
  count: number
  percentage: number
}

/**
 * Convert a TokenBreakdown into table rows.
 */
export function tokenBreakdownToRows(breakdown: TokenBreakdown): TokenBreakdownRow[] {
  const total = breakdown.total || 1 // avoid division by zero
  return [
    { category: "Input", count: breakdown.input, percentage: (breakdown.input / total) * 100 },
    { category: "Output", count: breakdown.output, percentage: (breakdown.output / total) * 100 },
    { category: "Reasoning", count: breakdown.reasoning, percentage: (breakdown.reasoning / total) * 100 },
    { category: "Cache Read", count: breakdown.cacheRead, percentage: (breakdown.cacheRead / total) * 100 },
    { category: "Cache Write", count: breakdown.cacheWrite, percentage: (breakdown.cacheWrite / total) * 100 },
    { category: "Total", count: breakdown.total, percentage: 100 },
  ]
}

/**
 * Format a percentage for display.
 */
export function formatPercentage(value: number): string {
  if (value === 0) {
    return "-"
  }
  if (value === 100) {
    return "100%"
  }
  return `${value.toFixed(1)}%`
}

/**
 * Format a large number with K/M suffix.
 */
export function formatLargeNumber(value: number): string {
  if (value === 0) {
    return "0"
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`
  }
  return String(value)
}

/**
 * Column definitions for token breakdown table.
 */
export const tokenBreakdownColumns: ColumnDefinition<TokenBreakdownRow>[] = [
  {
    header: "Category",
    width: 12,
    align: "left",
    accessor: (row) => row.category,
  },
  {
    header: "Tokens",
    width: 12,
    align: "right",
    accessor: (row) => row.count,
    format: (val) => formatLargeNumber(val as number),
  },
  {
    header: "%",
    width: 8,
    align: "right",
    accessor: (row) => row.percentage,
    format: (val) => formatPercentage(val as number),
  },
]

/**
 * Format a TokenBreakdown as a table.
 */
export function formatTokenBreakdownTable(
  breakdown: TokenBreakdown,
  options?: TableFormatOptions
): string {
  const rows = tokenBreakdownToRows(breakdown)
  return formatTable(rows, tokenBreakdownColumns, options)
}

/**
 * Print a TokenBreakdown table to stdout.
 */
export function printTokenBreakdownTable(
  breakdown: TokenBreakdown,
  options?: TableFormatOptions
): void {
  console.log(formatTokenBreakdownTable(breakdown, options))
}

/**
 * Format a TokenSummary for display.
 * Returns a table for known summaries, or a message for unknown.
 */
export function formatTokenSummary(
  summary: TokenSummary,
  options?: TableFormatOptions
): string {
  if (summary.kind === "known") {
    return formatTokenBreakdownTable(summary.tokens, options)
  }
  // Unknown summary - return reason message
  switch (summary.reason) {
    case "missing":
      return "[Token data unavailable]"
    case "parse_error":
      return "[Token data parse error]"
    case "no_messages":
      return "[No messages found]"
    default:
      return "[Unknown token status]"
  }
}

/**
 * Print a TokenSummary to stdout.
 */
export function printTokenSummary(
  summary: TokenSummary,
  options?: TableFormatOptions
): void {
  console.log(formatTokenSummary(summary, options))
}

/**
 * Row type for aggregate token summary table.
 */
export interface AggregateTokenRow {
  label: string
  value: string
}

/**
 * Format an AggregateTokenSummary as a detailed summary.
 * Includes breakdown table plus metadata about unknown sessions.
 */
export function formatAggregateTokenSummary(
  summary: AggregateTokenSummary,
  options?: TableFormatOptions & { label?: string }
): string {
  const lines: string[] = []
  const label = options?.label ?? "Token Summary"

  lines.push(label)
  lines.push("=".repeat(label.length))
  lines.push("")

  if (summary.total.kind === "known") {
    lines.push(formatTokenBreakdownTable(summary.total.tokens, options))
  } else {
    lines.push(formatTokenSummary(summary.total, options))
  }

  // Add metadata if there are unknown sessions
  if (summary.unknownSessions && summary.unknownSessions > 0) {
    lines.push("")
    lines.push(`Note: ${summary.unknownSessions} session(s) with unavailable token data`)
  }

  return lines.join("\n")
}

/**
 * Print an AggregateTokenSummary to stdout.
 */
export function printAggregateTokenSummary(
  summary: AggregateTokenSummary,
  options?: TableFormatOptions & { label?: string }
): void {
  console.log(formatAggregateTokenSummary(summary, options))
}
