/**
 * Table output formatter for CLI commands.
 *
 * Provides human-readable table output for terminal display.
 * Supports column definitions, truncation, and alignment.
 */

import type { ProjectRecord, ProjectState } from "../../lib/opencode-data"

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
