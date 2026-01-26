/**
 * SQLite backend for opencode data access.
 *
 * This module provides functions for reading opencode session/project data
 * from SQLite databases (as an alternative to the default JSONL file-based storage).
 *
 * @experimental This module is experimental and may change.
 */
import { Database } from "bun:sqlite"
import { homedir } from "node:os"
import { join, resolve } from "node:path"
import { promises as fs, constants } from "node:fs"
import type { 
  ProjectRecord, 
  ProjectState, 
  SessionRecord, 
  ChatMessage, 
  ChatRole,
  TokenBreakdown,
  ChatPart,
  PartType,
  DeleteResult,
  DeleteOptions,
} from "./opencode-data"

// ========================
// Constants
// ========================

/**
 * Default path to the opencode SQLite database.
 */
export const DEFAULT_SQLITE_PATH = join(homedir(), ".local", "share", "opencode", "opencode.db")

/**
 * Busy timeout for force-write operations (milliseconds).
 */
const SQLITE_BUSY_TIMEOUT_MS = 5000

/**
 * Required SQLite schema for OpenCode data.
 * These table/column names are assumed by the loader and writer functions.
 *
 * Tables:
 * - project(id, data)
 * - session(id, project_id, parent_id, created_at, updated_at, data)
 * - message(id, session_id, created_at, data)
 * - part(id, message_id, session_id, data)
 */
const SQLITE_REQUIRED_COLUMNS = {
  project: ["id", "data"],
  session: ["id", "project_id", "parent_id", "created_at", "updated_at", "data"],
  message: ["id", "session_id", "created_at", "data"],
  part: ["id", "message_id", "session_id", "data"],
} as const

// ========================
// Types
// ========================

/**
 * Options for SQLite-based data loading functions.
 *
 * Accepts either a path string (which will be opened as a new Database connection)
 * or an existing Database instance (which will be used directly).
 */
export interface SqliteLoadOptions {
  /**
   * Database connection or path to SQLite file.
   * - If a string, opens a new readonly Database connection.
   * - If a Database instance, uses it directly (caller manages lifecycle).
   */
  db: Database | string
  /**
   * If true, fail fast on any SQLite error or malformed data.
   * Default behavior is to warn and continue when possible.
   */
  strict?: boolean
  /**
   * Optional warning sink for recoverable issues (schema gaps, malformed rows).
   * Defaults to console.warn when not provided.
   */
  onWarning?: (warning: string) => void
  /**
   * If true, wait for SQLite write locks to clear before failing.
   * Only applies to write operations (readonly: false).
   */
  forceWrite?: boolean
}

// ========================
// Database Helpers
// ========================

/**
 * Opens a SQLite database from a path or returns an existing Database instance.
 *
 * @param pathOrDb - Either a file path to open, or an existing Database instance.
 * @param options - Optional configuration for opening the database.
 * @returns A Database instance ready for queries.
 * @throws Error if the path does not exist or cannot be opened.
 */
export function openDatabase(
  pathOrDb: Database | string,
  options: { readonly?: boolean; forceWrite?: boolean } = {}
): Database {
  // If already a Database instance, return as-is
  if (pathOrDb instanceof Database) {
    return pathOrDb
  }

  // Open database from path
  // Note: bun:sqlite only accepts { readonly: true } for readonly mode
  // Omit the option entirely for read-write mode (the default)
  const readonly = options.readonly ?? true
  try {
    if (readonly) {
      return new Database(pathOrDb, { readonly: true })
    }
    const db = new Database(pathOrDb)
    if (options.forceWrite) {
      // Wait briefly for write locks to clear when force-write is enabled.
      db.exec(`PRAGMA busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`)
    }
    return db
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (isSqliteBusyError(error)) {
      const busyMessage = formatBusyErrorMessage(
        `SQLite database at "${pathOrDb}" is locked`,
        { forceWrite: options.forceWrite, allowForceWrite: !readonly }
      )
      throw new Error(busyMessage)
    }
    throw new Error(`Failed to open SQLite database at "${pathOrDb}": ${message}`)
  }
}

/**
 * Closes the database if it was opened from a path string.
 *
 * This is a helper to manage database lifecycle correctly:
 * - If the original input was a path string, the database was opened by us and should be closed.
 * - If the original input was a Database instance, the caller owns it and we should not close it.
 *
 * @param db - The Database instance to potentially close.
 * @param originalInput - The original input that was passed to openDatabase.
 */
export function closeIfOwned(db: Database, originalInput: Database | string): void {
  // Only close if we opened it (i.e., originalInput was a string path)
  if (typeof originalInput === "string") {
    db.close()
  }
}

// ========================
// Internal Helpers
// ========================

/**
 * Expand ~ to home directory in paths.
 */
function expandUserPath(rawPath?: string | null): string | null {
  if (!rawPath) {
    return null
  }
  if (rawPath === "~") {
    return homedir()
  }
  if (rawPath.startsWith("~/")) {
    return join(homedir(), rawPath.slice(2))
  }
  return resolve(rawPath)
}

/**
 * Convert milliseconds timestamp to Date, or null if invalid.
 */
function msToDate(ms?: number | null): Date | null {
  if (typeof ms !== "number" || Number.isNaN(ms)) {
    return null
  }
  return new Date(ms)
}

/**
 * Check if a path exists and is a directory.
 */
async function computeState(worktree: string | null): Promise<ProjectState> {
  if (!worktree) {
    return "unknown"
  }
  try {
    const stat = await fs.stat(worktree)
    return stat.isDirectory() ? "present" : "missing"
  } catch {
    return "missing"
  }
}

/**
 * Compare dates for sorting (descending, most recent first).
 */
function compareDates(a: Date | null, b: Date | null): number {
  const aTime = a?.getTime() ?? 0
  const bTime = b?.getTime() ?? 0
  return bTime - aTime
}

/**
 * Add 1-based index to records.
 */
function withIndex<T extends { index: number }>(records: T[]): T[] {
  return records.map((record, idx) => ({ ...record, index: idx + 1 }))
}

/**
 * Emit a warning for recoverable SQLite issues.
 */
function warnSqlite(options: { onWarning?: (warning: string) => void } | undefined, message: string): void {
  if (options?.onWarning) {
    options.onWarning(message)
    return
  }
  console.warn(`Warning: ${message}`)
}

/**
 * Detect SQLITE_BUSY errors from bun:sqlite.
 */
function isSqliteBusyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /SQLITE_BUSY|database is locked/i.test(message)
}

/**
 * Build a friendly error message for SQLite lock contention.
 */
function formatBusyErrorMessage(
  context: string,
  options?: { forceWrite?: boolean; allowForceWrite?: boolean }
): string {
  const allowForceWrite = options?.allowForceWrite ?? true
  const hint = allowForceWrite
    ? options?.forceWrite
      ? "Close OpenCode or wait for the lock to clear."
      : "Close OpenCode and retry, or pass --force-write to wait for the lock."
    : "Close OpenCode and retry."
  return `${context}. ${hint}`
}

/**
 * Format a SQLite error with context, handling SQLITE_BUSY specially.
 */
function formatSqliteErrorMessage(
  error: unknown,
  context: string,
  options?: { forceWrite?: boolean; allowForceWrite?: boolean }
): string {
  if (isSqliteBusyError(error)) {
    return formatBusyErrorMessage("SQLite database is locked", options)
  }
  const message = error instanceof Error ? error.message : String(error)
  return `${context}: ${message}`
}

interface SchemaValidationResult {
  ok: boolean
  missingTables: string[]
  missingColumns: Record<string, string[]>
}

type SchemaRequirements = Record<string, readonly string[]>

function buildSchemaRequirements(tables: (keyof typeof SQLITE_REQUIRED_COLUMNS)[]): SchemaRequirements {
  const requirements: SchemaRequirements = {}
  for (const table of tables) {
    requirements[table] = SQLITE_REQUIRED_COLUMNS[table]
  }
  return requirements
}

function validateSchemaForTables(db: Database, requirements: SchemaRequirements): SchemaValidationResult {
  const tableRows = db.query("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
    name: string
  }[]
  const existingTables = new Set(tableRows.map((row) => row.name))

  const missingTables: string[] = []
  const missingColumns: Record<string, string[]> = {}

  for (const [table, columns] of Object.entries(requirements)) {
    if (!existingTables.has(table)) {
      missingTables.push(table)
      continue
    }

    const columnRows = db.query(`PRAGMA table_info(${table})`).all() as { name: string }[]
    const existingColumns = new Set(columnRows.map((row) => row.name))
    const missing = columns.filter((column) => !existingColumns.has(column))

    if (missing.length > 0) {
      missingColumns[table] = missing
    }
  }

  return {
    ok: missingTables.length === 0 && Object.keys(missingColumns).length === 0,
    missingTables,
    missingColumns,
  }
}

function formatSchemaIssues(result: SchemaValidationResult, context?: string): string {
  const parts: string[] = []
  if (result.missingTables.length > 0) {
    parts.push(`missing tables: ${result.missingTables.join(", ")}`)
  }
  const columnEntries = Object.entries(result.missingColumns)
  if (columnEntries.length > 0) {
    const missingCols = columnEntries
      .flatMap(([table, columns]) => columns.map((column) => `${table}.${column}`))
      .join(", ")
    parts.push(`missing columns: ${missingCols}`)
  }

  const detail = parts.join("; ")
  const prefix = context ? `${context}: ` : ""
  return `${prefix}SQLite schema is invalid (${detail}).`
}

function ensureSchema(
  db: Database,
  requirements: SchemaRequirements,
  options?: SqliteLoadOptions,
  context?: string
): boolean {
  let result: SchemaValidationResult
  try {
    result = validateSchemaForTables(db, requirements)
  } catch (error) {
    const message = formatSqliteErrorMessage(error, "Failed to read SQLite schema", {
      forceWrite: options?.forceWrite,
      allowForceWrite: false,
    })
    if (isSqliteBusyError(error) || options?.strict) {
      throw new Error(message)
    }
    warnSqlite(options, message)
    return false
  }
  if (result.ok) {
    return true
  }

  const message = formatSchemaIssues(result, context)
  if (options?.strict) {
    throw new Error(message)
  }
  warnSqlite(options, message)
  return false
}

function getSchemaIssueMessage(
  db: Database,
  requirements: SchemaRequirements,
  context?: string
): string | null {
  const result = validateSchemaForTables(db, requirements)
  if (result.ok) {
    return null
  }
  return formatSchemaIssues(result, context)
}

/**
 * Validate the OpenCode SQLite schema.
 *
 * Returns true when all required tables and columns are present.
 * When strict is enabled, throws an error on invalid schema.
 */
export function validateSchema(
  db: Database,
  options: { strict?: boolean; onWarning?: (warning: string) => void } = {}
): boolean {
  const requirements = buildSchemaRequirements([
    "project",
    "session",
    "message",
    "part",
  ])
  let result: SchemaValidationResult
  try {
    result = validateSchemaForTables(db, requirements)
  } catch (error) {
    const message = formatSqliteErrorMessage(error, "Failed to read SQLite schema", {
      allowForceWrite: false,
    })
    if (isSqliteBusyError(error) || options.strict) {
      throw new Error(message)
    }
    warnSqlite(options, message)
    return false
  }
  if (!result.ok) {
    const message = formatSchemaIssues(result)
    if (options.strict) {
      throw new Error(message)
    }
    warnSqlite(options, message)
  }
  return result.ok
}

// ========================
// Project Loading
// ========================

/**
 * Raw row structure from the SQLite project table.
 */
interface ProjectRow {
  id: string
  data: string
}

/**
 * Parsed JSON structure from the project data column.
 */
interface ProjectData {
  id?: string
  worktree?: string
  vcs?: string
  time?: {
    created?: number
  }
}

/**
 * Load project records from SQLite database.
 *
 * Queries the `project` table and parses the JSON `data` column.
 * Returns an array of ProjectRecord objects compatible with the JSONL loader.
 *
 * @param options - Database connection options.
 * @returns Array of ProjectRecord objects, sorted by createdAt (descending).
 */
export async function loadProjectRecordsSqlite(
  options: SqliteLoadOptions
): Promise<ProjectRecord[]> {
  const db = openDatabase(options.db)
  const records: ProjectRecord[] = []

  try {
    if (!ensureSchema(db, buildSchemaRequirements(["project"]), options, "loadProjectRecords")) {
      return []
    }

    // Query all projects from the database
    let rows: ProjectRow[] = []
    try {
      rows = db.query("SELECT id, data FROM project").all() as ProjectRow[]
    } catch (error) {
      const message = formatSqliteErrorMessage(error, "Failed to query project table", {
        forceWrite: options.forceWrite,
        allowForceWrite: false,
      })
      if (isSqliteBusyError(error)) {
        throw new Error(message)
      }
      if (options.strict) {
        throw new Error(message)
      }
      warnSqlite(options, message)
      return []
    }

    for (const row of rows) {
      let data: ProjectData = {}

      // Parse JSON data column, skip malformed entries
      try {
        data = JSON.parse(row.data) as ProjectData
      } catch (error) {
        const message = formatSqliteErrorMessage(
          error,
          `Malformed JSON in project row "${row.id}"`,
          options
        )
        if (options.strict) {
          throw new Error(message)
        }
        warnSqlite(options, message)
        continue
      }

      const createdAt = msToDate(data.time?.created)
      const worktree = expandUserPath(data.worktree)
      const state = await computeState(worktree)

      records.push({
        index: 0, // Will be set by withIndex
        bucket: "project", // SQLite projects are always in the "project" bucket
        filePath: `sqlite:project:${row.id}`, // Virtual path for SQLite records
        projectId: row.id,
        worktree: worktree ?? "",
        vcs: typeof data.vcs === "string" ? data.vcs : null,
        createdAt,
        state,
      })
    }
  } finally {
    closeIfOwned(db, options.db)
  }

  // Sort by createdAt descending, then by projectId for stability
  records.sort((a, b) => {
    const dateDelta = compareDates(a.createdAt, b.createdAt)
    if (dateDelta !== 0) {
      return dateDelta
    }
    return a.projectId.localeCompare(b.projectId)
  })

  return withIndex(records)
}

// ========================
// Session Loading
// ========================

/**
 * Options for session loading from SQLite.
 */
export interface SqliteSessionLoadOptions extends SqliteLoadOptions {
  /**
   * Filter sessions by project ID.
   */
  projectId?: string
}

/**
 * Raw row structure from the SQLite session table.
 */
interface SessionRow {
  id: string
  project_id: string
  parent_id: string | null
  created_at: number | null
  updated_at: number | null
  data: string
}

/**
 * Parsed JSON structure from the session data column.
 */
interface SessionData {
  id?: string
  projectID?: string
  parentID?: string
  directory?: string
  title?: string
  version?: string
  time?: {
    created?: number
    updated?: number
  }
}

/**
 * Load session records from SQLite database.
 *
 * Queries the `session` table and parses the JSON `data` column.
 * Returns an array of SessionRecord objects compatible with the JSONL loader.
 *
 * @param options - Database connection options with optional projectId filter.
 * @returns Array of SessionRecord objects, sorted by updatedAt/createdAt (descending).
 */
export async function loadSessionRecordsSqlite(
  options: SqliteSessionLoadOptions
): Promise<SessionRecord[]> {
  const db = openDatabase(options.db)
  const records: SessionRecord[] = []

  try {
    if (!ensureSchema(db, buildSchemaRequirements(["session"]), options, "loadSessionRecords")) {
      return []
    }

    // Build query with optional project_id filter
    let query = "SELECT id, project_id, parent_id, created_at, updated_at, data FROM session"
    const params: string[] = []
    
    if (options.projectId) {
      query += " WHERE project_id = ?"
      params.push(options.projectId)
    }

    let rows: SessionRow[] = []
    try {
      rows = params.length > 0
        ? db.query(query).all(params[0]) as SessionRow[]
        : db.query(query).all() as SessionRow[]
    } catch (error) {
      const message = formatSqliteErrorMessage(error, "Failed to query session table", {
        forceWrite: options.forceWrite,
        allowForceWrite: false,
      })
      if (isSqliteBusyError(error)) {
        throw new Error(message)
      }
      if (options.strict) {
        throw new Error(message)
      }
      warnSqlite(options, message)
      return []
    }

    for (const row of rows) {
      let data: SessionData = {}

      // Parse JSON data column, skip malformed entries
      try {
        data = JSON.parse(row.data) as SessionData
      } catch (error) {
        const message = formatSqliteErrorMessage(
          error,
          `Malformed JSON in session row "${row.id}"`,
          options
        )
        if (options.strict) {
          throw new Error(message)
        }
        warnSqlite(options, message)
        continue
      }

      // Use column values first, fall back to data JSON
      // created_at/updated_at columns are epoch milliseconds
      const createdAt = msToDate(row.created_at) ?? msToDate(data.time?.created)
      const updatedAt = msToDate(row.updated_at) ?? msToDate(data.time?.updated)
      const directory = expandUserPath(data.directory)

      records.push({
        index: 0, // Will be set by withIndex
        filePath: `sqlite:session:${row.id}`, // Virtual path for SQLite records
        sessionId: row.id,
        projectId: row.project_id ?? data.projectID ?? "",
        directory: directory ?? "",
        title: typeof data.title === "string" ? data.title : "",
        version: typeof data.version === "string" ? data.version : "",
        createdAt,
        updatedAt,
      })
    }
  } finally {
    closeIfOwned(db, options.db)
  }

  // Sort by updatedAt (or createdAt) descending, then by sessionId for stability
  records.sort((a, b) => {
    const aSortDate = a.updatedAt ?? a.createdAt
    const bSortDate = b.updatedAt ?? b.createdAt
    const dateDelta = compareDates(aSortDate, bSortDate)
    if (dateDelta !== 0) {
      return dateDelta
    }
    return a.sessionId.localeCompare(b.sessionId)
  })

  return withIndex(records)
}

// ========================
// Chat Message Loading
// ========================

/**
 * Options for chat message loading from SQLite.
 */
export interface SqliteChatLoadOptions extends SqliteLoadOptions {
  /**
   * Session ID to load messages for.
   */
  sessionId: string
}

/**
 * Raw row structure from the SQLite message table.
 */
interface MessageRow {
  id: string
  session_id: string
  created_at: number | null
  data: string
}

/**
 * Parsed JSON structure from the message data column.
 */
interface MessageData {
  id?: string
  sessionID?: string
  role?: string
  time?: {
    created?: number
  }
  parentID?: string
  tokens?: {
    input?: number
    output?: number
    reasoning?: number
    cache?: {
      read?: number
      write?: number
    }
  } | null
}

/**
 * Safely convert a value to a non-negative number, or null if invalid.
 */
function asTokenNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null
  }
  if (value < 0) {
    return null
  }
  return value
}

/**
 * Parse token breakdown from message data.
 */
function parseMessageTokens(tokens: MessageData["tokens"]): TokenBreakdown | null {
  if (!tokens || typeof tokens !== "object") {
    return null
  }

  const input = asTokenNumber(tokens.input)
  const output = asTokenNumber(tokens.output)
  const reasoning = asTokenNumber(tokens.reasoning)
  const cacheRead = asTokenNumber(tokens.cache?.read)
  const cacheWrite = asTokenNumber(tokens.cache?.write)

  const hasAny = input !== null || output !== null || reasoning !== null || cacheRead !== null || cacheWrite !== null
  if (!hasAny) {
    return null
  }

  const breakdown: TokenBreakdown = {
    input: input ?? 0,
    output: output ?? 0,
    reasoning: reasoning ?? 0,
    cacheRead: cacheRead ?? 0,
    cacheWrite: cacheWrite ?? 0,
    total: 0,
  }
  breakdown.total = breakdown.input + breakdown.output + breakdown.reasoning + breakdown.cacheRead + breakdown.cacheWrite
  return breakdown
}

/**
 * Load chat message index for a session from SQLite (metadata only, no parts).
 * Returns an array of ChatMessage stubs with parts set to null.
 *
 * @param options - Database connection options with sessionId.
 * @returns Array of ChatMessage objects, sorted by createdAt (ascending, oldest first).
 */
export async function loadSessionChatIndexSqlite(
  options: SqliteChatLoadOptions
): Promise<ChatMessage[]> {
  const db = openDatabase(options.db)
  const messages: ChatMessage[] = []

  try {
    if (!ensureSchema(db, buildSchemaRequirements(["message"]), options, "loadSessionChatIndex")) {
      return []
    }

    // Query messages for the given session, ordered by created_at ascending
    let rows: MessageRow[] = []
    try {
      rows = db.query(
        "SELECT id, session_id, created_at, data FROM message WHERE session_id = ? ORDER BY created_at ASC"
      ).all(options.sessionId) as MessageRow[]
    } catch (error) {
      const message = formatSqliteErrorMessage(error, "Failed to query message table", {
        forceWrite: options.forceWrite,
        allowForceWrite: false,
      })
      if (isSqliteBusyError(error)) {
        throw new Error(message)
      }
      if (options.strict) {
        throw new Error(message)
      }
      warnSqlite(options, message)
      return []
    }

    for (const row of rows) {
      let data: MessageData = {}

      // Parse JSON data column, skip malformed entries
      try {
        data = JSON.parse(row.data) as MessageData
      } catch (error) {
        const message = formatSqliteErrorMessage(
          error,
          `Malformed JSON in message row "${row.id}"`,
          options
        )
        if (options.strict) {
          throw new Error(message)
        }
        warnSqlite(options, message)
        continue
      }

      // Determine role
      const role: ChatRole =
        data.role === "user" ? "user" :
        data.role === "assistant" ? "assistant" :
        "unknown"

      // Use column timestamp first, fall back to data JSON
      const createdAt = msToDate(row.created_at) ?? msToDate(data.time?.created)

      // Parse tokens for assistant messages
      let tokens: TokenBreakdown | undefined
      if (role === "assistant" && data.tokens) {
        const parsed = parseMessageTokens(data.tokens)
        if (parsed) {
          tokens = parsed
        }
      }

      messages.push({
        sessionId: row.session_id,
        messageId: row.id,
        role,
        createdAt,
        parentId: data.parentID,
        tokens,
        parts: null,
        previewText: "[loading...]",
        totalChars: null,
      })
    }
  } finally {
    closeIfOwned(db, options.db)
  }

  // Messages are already sorted by created_at ASC from the query,
  // but apply stable sort for any ties using messageId
  messages.sort((a, b) => {
    const aTime = a.createdAt?.getTime() ?? 0
    const bTime = b.createdAt?.getTime() ?? 0
    if (aTime !== bTime) {
      return aTime - bTime // ascending (oldest first)
    }
    return a.messageId.localeCompare(b.messageId)
  })

  return messages
}

// ========================
// Message Parts Loading
// ========================

/**
 * Options for message parts loading from SQLite.
 */
export interface SqlitePartsLoadOptions extends SqliteLoadOptions {
  /**
   * Message ID to load parts for.
   */
  messageId: string
}

/**
 * Raw row structure from the SQLite part table.
 */
interface PartRow {
  id: string
  message_id: string
  session_id: string
  data: string
}

/**
 * Parsed JSON structure from the part data column.
 */
interface PartData {
  id?: string
  messageID?: string
  sessionID?: string
  type?: string
  text?: unknown
  prompt?: unknown
  description?: unknown
  tool?: string
  state?: {
    status?: string
    input?: Record<string, unknown>
    output?: unknown
  }
}

/**
 * Convert a value to a display-safe string.
 */
function toDisplayText(value: unknown): string {
  if (typeof value === "string") {
    return value
  }
  if (value === null || value === undefined) {
    return ""
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/**
 * Extract human-readable content from a part data object.
 */
function extractPartContent(data: PartData): { text: string; toolName?: string; toolStatus?: string } {
  const type = data.type ?? "unknown"

  switch (type) {
    case "text":
      return { text: toDisplayText(data.text) }

    case "subtask":
      return { text: toDisplayText(data.prompt ?? data.description ?? "") }

    case "tool": {
      const state = data.state ?? {}
      const toolName = typeof data.tool === "string" ? data.tool : "unknown"
      const status = typeof state.status === "string" ? state.status : "unknown"

      // Prefer output when present; otherwise show a prompt-like input summary.
      if (state.output !== undefined) {
        return { text: toDisplayText(state.output), toolName, toolStatus: status }
      }

      const input = state.input ?? {}
      const prompt = input.prompt ?? `[tool:${toolName}]`
      return { text: toDisplayText(prompt), toolName, toolStatus: status }
    }

    default:
      // Unknown part type: attempt a safe JSON preview, then fall back to a label.
      return { text: toDisplayText(data) || `[${type} part]` }
  }
}

/**
 * Load message parts from SQLite database.
 *
 * Queries the `part` table for parts belonging to a specific message.
 * Returns an array of ChatPart objects compatible with the JSONL loader.
 *
 * @param options - Database connection options with messageId.
 * @returns Array of ChatPart objects, sorted by partId for deterministic order.
 */
export async function loadMessagePartsSqlite(
  options: SqlitePartsLoadOptions
): Promise<ChatPart[]> {
  const db = openDatabase(options.db)
  const parts: ChatPart[] = []

  try {
    if (!ensureSchema(db, buildSchemaRequirements(["part"]), options, "loadMessageParts")) {
      return []
    }

    // Query parts for the given message
    let rows: PartRow[] = []
    try {
      rows = db.query(
        "SELECT id, message_id, session_id, data FROM part WHERE message_id = ?"
      ).all(options.messageId) as PartRow[]
    } catch (error) {
      const message = formatSqliteErrorMessage(error, "Failed to query part table", {
        forceWrite: options.forceWrite,
        allowForceWrite: false,
      })
      if (isSqliteBusyError(error)) {
        throw new Error(message)
      }
      if (options.strict) {
        throw new Error(message)
      }
      warnSqlite(options, message)
      return []
    }

    for (const row of rows) {
      let data: PartData = {}

      // Parse JSON data column, skip malformed entries
      try {
        data = JSON.parse(row.data) as PartData
      } catch (error) {
        const message = formatSqliteErrorMessage(
          error,
          `Malformed JSON in part row "${row.id}"`,
          options
        )
        if (options.strict) {
          throw new Error(message)
        }
        warnSqlite(options, message)
        continue
      }

      // Determine part type
      const typeRaw = typeof data.type === "string" ? data.type : "unknown"
      const type: PartType =
        typeRaw === "text" ? "text" :
        typeRaw === "subtask" ? "subtask" :
        typeRaw === "tool" ? "tool" :
        "unknown"

      const extracted = extractPartContent(data)

      parts.push({
        partId: row.id,
        messageId: row.message_id,
        type,
        text: extracted.text,
        toolName: extracted.toolName,
        toolStatus: extracted.toolStatus,
      })
    }
  } finally {
    closeIfOwned(db, options.db)
  }

  // Sort by partId for deterministic order (consistent with JSONL loader's filename sort)
  parts.sort((a, b) => a.partId.localeCompare(b.partId))

  return parts
}

// ========================
// Session Delete Operations
// ========================

/**
 * Options for deleting session metadata from SQLite.
 */
export interface SqliteDeleteSessionOptions extends SqliteLoadOptions {
  /**
   * If true, report what would be deleted without actually deleting.
   */
  dryRun?: boolean
}

/**
 * Delete session metadata and all related data from SQLite database.
 *
 * This function deletes sessions and their associated data (messages, parts) in a
 * transaction for atomicity. If any part of the deletion fails, the entire operation
 * is rolled back.
 *
 * Deletion order (to satisfy foreign key constraints if enabled):
 * 1. Delete parts where session_id IN (sessionIds)
 * 2. Delete messages where session_id IN (sessionIds)
 * 3. Delete sessions where id IN (sessionIds)
 *
 * @param sessionIds - Array of session IDs to delete.
 * @param options - Database connection options and dry-run flag.
 * @returns DeleteResult with removed session IDs and any failures.
 */
export async function deleteSessionMetadataSqlite(
  sessionIds: string[],
  options: SqliteDeleteSessionOptions
): Promise<DeleteResult> {
  // Handle empty input
  if (sessionIds.length === 0) {
    return { removed: [], failed: [] }
  }

  // For dry-run, we don't need write access
  const removed: string[] = []
  const failed: { path: string; error?: string }[] = []
  const needsWrite = !options.dryRun
  let db: Database | undefined

  try {
    try {
      db = openDatabase(options.db, { readonly: !needsWrite, forceWrite: options.forceWrite })
    } catch (error) {
      const message = formatSqliteErrorMessage(error, "Failed to open SQLite database", options)
      if (options.strict) {
        throw new Error(message)
      }
      for (const sessionId of sessionIds) {
        failed.push({ path: `sqlite:session:${sessionId}`, error: message })
      }
      return { removed, failed }
    }

    if (!db) {
      return { removed, failed }
    }

    let schemaMessage: string | null
    try {
      schemaMessage = getSchemaIssueMessage(
        db,
        buildSchemaRequirements(["session", "message", "part"]),
        "deleteSessionMetadata"
      )
    } catch (error) {
      const message = formatSqliteErrorMessage(error, "Failed to read SQLite schema", options)
      if (options.strict) {
        throw new Error(message)
      }
      for (const sessionId of sessionIds) {
        failed.push({ path: `sqlite:session:${sessionId}`, error: message })
      }
      return { removed, failed }
    }
    if (schemaMessage) {
      if (options.strict) {
        throw new Error(schemaMessage)
      }
      warnSqlite(options, schemaMessage)
      for (const sessionId of sessionIds) {
        failed.push({ path: `sqlite:session:${sessionId}`, error: schemaMessage })
      }
      return { removed, failed }
    }

    if (options.dryRun) {
      // Dry run: just check which sessions exist and would be deleted
      const placeholders = sessionIds.map(() => "?").join(", ")
      const selectStmt = db.prepare(
        `SELECT id FROM session WHERE id IN (${placeholders})`
      )
      const existingRows = selectStmt.all(...sessionIds) as { id: string }[]
      
      const existingIds = new Set(existingRows.map(r => r.id))
      
      for (const sessionId of sessionIds) {
        if (existingIds.has(sessionId)) {
          removed.push(`sqlite:session:${sessionId}`)
        } else {
          // Session doesn't exist - not a failure, just not removed
          // (matching JSONL behavior where non-existent files report error)
          failed.push({ 
            path: `sqlite:session:${sessionId}`, 
            error: "Session not found" 
          })
        }
      }
      
      return { removed, failed }
    }

    // Actual deletion: use transaction for atomicity
    try {
      db.run(options.forceWrite ? "BEGIN IMMEDIATE" : "BEGIN TRANSACTION")
    } catch (error) {
      const message = formatSqliteErrorMessage(error, "Failed to start SQLite transaction", options)
      if (options.strict) {
        throw new Error(message)
      }
      for (const sessionId of sessionIds) {
        failed.push({ path: `sqlite:session:${sessionId}`, error: message })
      }
      return { removed, failed }
    }
    
    try {
      // Build parameterized query with placeholders
      const placeholders = sessionIds.map(() => "?").join(", ")
      
      // Delete parts first (child of message, also references session_id directly)
      const deleteParts = db.prepare(
        `DELETE FROM part WHERE session_id IN (${placeholders})`
      )
      deleteParts.run(...sessionIds)
      
      // Delete messages next (child of session)
      const deleteMessages = db.prepare(
        `DELETE FROM message WHERE session_id IN (${placeholders})`
      )
      deleteMessages.run(...sessionIds)
      
      // Finally delete sessions
      // Get the list of actually deleted sessions for accurate reporting
      const selectSessions = db.prepare(
        `SELECT id FROM session WHERE id IN (${placeholders})`
      )
      const existingRows = selectSessions.all(...sessionIds) as { id: string }[]
      
      const existingIds = new Set(existingRows.map(r => r.id))
      
      const deleteSessions = db.prepare(
        `DELETE FROM session WHERE id IN (${placeholders})`
      )
      deleteSessions.run(...sessionIds)
      
      db.run("COMMIT")
      
      // Report results
      for (const sessionId of sessionIds) {
        if (existingIds.has(sessionId)) {
          removed.push(`sqlite:session:${sessionId}`)
        } else {
          failed.push({ 
            path: `sqlite:session:${sessionId}`, 
            error: "Session not found" 
          })
        }
      }
      
    } catch (error) {
      // Rollback on any error
      try {
        db.run("ROLLBACK")
      } catch {
        // Ignore rollback errors
      }
      
      // Report all sessions as failed
      const message = formatSqliteErrorMessage(error, "SQLite delete failed", options)
      if (options.strict) {
        throw new Error(message)
      }
      for (const sessionId of sessionIds) {
        failed.push({ 
          path: `sqlite:session:${sessionId}`, 
          error: message 
        })
      }
    }
    
  } finally {
    if (db) {
      closeIfOwned(db, options.db)
    }
  }

  return { removed, failed }
}

/**
 * Options for SQLite-based project deletion.
 */
export interface SqliteDeleteProjectOptions extends SqliteLoadOptions {
  /**
   * If true, report what would be deleted without actually deleting.
   */
  dryRun?: boolean
}

/**
 * Delete project metadata and all related data from SQLite database.
 *
 * This function deletes projects and their associated data (sessions, messages, parts)
 * in a transaction for atomicity. If any part of the deletion fails, the entire operation
 * is rolled back.
 *
 * Deletion order (to satisfy foreign key constraints if enabled):
 * 1. Get all session IDs for the projects
 * 2. Delete parts where session_id IN (sessionIds)
 * 3. Delete messages where session_id IN (sessionIds)
 * 4. Delete sessions where project_id IN (projectIds)
 * 5. Delete projects where id IN (projectIds)
 *
 * @param projectIds - Array of project IDs to delete.
 * @param options - Database connection options and dry-run flag.
 * @returns DeleteResult with removed project IDs and any failures.
 */
export async function deleteProjectMetadataSqlite(
  projectIds: string[],
  options: SqliteDeleteProjectOptions
): Promise<DeleteResult> {
  // Handle empty input
  if (projectIds.length === 0) {
    return { removed: [], failed: [] }
  }

  // For dry-run, we don't need write access
  const removed: string[] = []
  const failed: { path: string; error?: string }[] = []
  const needsWrite = !options.dryRun
  let db: Database | undefined

  try {
    try {
      db = openDatabase(options.db, { readonly: !needsWrite, forceWrite: options.forceWrite })
    } catch (error) {
      const message = formatSqliteErrorMessage(error, "Failed to open SQLite database", options)
      if (options.strict) {
        throw new Error(message)
      }
      for (const projectId of projectIds) {
        failed.push({ path: `sqlite:project:${projectId}`, error: message })
      }
      return { removed, failed }
    }

    if (!db) {
      return { removed, failed }
    }

    let schemaMessage: string | null
    try {
      schemaMessage = getSchemaIssueMessage(
        db,
        buildSchemaRequirements(["project", "session", "message", "part"]),
        "deleteProjectMetadata"
      )
    } catch (error) {
      const message = formatSqliteErrorMessage(error, "Failed to read SQLite schema", options)
      if (options.strict) {
        throw new Error(message)
      }
      for (const projectId of projectIds) {
        failed.push({ path: `sqlite:project:${projectId}`, error: message })
      }
      return { removed, failed }
    }
    if (schemaMessage) {
      if (options.strict) {
        throw new Error(schemaMessage)
      }
      warnSqlite(options, schemaMessage)
      for (const projectId of projectIds) {
        failed.push({ path: `sqlite:project:${projectId}`, error: schemaMessage })
      }
      return { removed, failed }
    }

    // Build parameterized query with placeholders
    const placeholders = projectIds.map(() => "?").join(", ")
    
    // First, get all session IDs for these projects
    const selectSessions = db.prepare(
      `SELECT id FROM session WHERE project_id IN (${placeholders})`
    )
    const sessionRows = selectSessions.all(...projectIds) as { id: string }[]
    const sessionIds = sessionRows.map(r => r.id)
    const sessionPlaceholders = sessionIds.length > 0 ? sessionIds.map(() => "?").join(", ") : ""
    
    if (options.dryRun) {
      // Dry run: just check which projects exist and would be deleted
      const selectProjects = db.prepare(
        `SELECT id FROM project WHERE id IN (${placeholders})`
      )
      const existingRows = selectProjects.all(...projectIds) as { id: string }[]
      
      const existingIds = new Set(existingRows.map(r => r.id))
      
      for (const projectId of projectIds) {
        if (existingIds.has(projectId)) {
          removed.push(`sqlite:project:${projectId}`)
        } else {
          failed.push({ 
            path: `sqlite:project:${projectId}`, 
            error: "Project not found" 
          })
        }
      }
      
      return { removed, failed }
    }

    // Actual deletion: use transaction for atomicity
    try {
      db.run(options.forceWrite ? "BEGIN IMMEDIATE" : "BEGIN TRANSACTION")
    } catch (error) {
      const message = formatSqliteErrorMessage(error, "Failed to start SQLite transaction", options)
      if (options.strict) {
        throw new Error(message)
      }
      for (const projectId of projectIds) {
        failed.push({ path: `sqlite:project:${projectId}`, error: message })
      }
      return { removed, failed }
    }
    
    try {
      // Delete parts first (child of message, also references session_id directly)
      if (sessionIds.length > 0) {
        const deleteParts = db.prepare(
          `DELETE FROM part WHERE session_id IN (${sessionPlaceholders})`
        )
        deleteParts.run(...sessionIds)
        
        // Delete messages next (child of session)
        const deleteMessages = db.prepare(
          `DELETE FROM message WHERE session_id IN (${sessionPlaceholders})`
        )
        deleteMessages.run(...sessionIds)
      }
      
      // Delete sessions (child of project)
      const deleteSessions = db.prepare(
        `DELETE FROM session WHERE project_id IN (${placeholders})`
      )
      deleteSessions.run(...projectIds)
      
      // Get the list of actually existing projects for accurate reporting
      const selectProjects = db.prepare(
        `SELECT id FROM project WHERE id IN (${placeholders})`
      )
      const existingRows = selectProjects.all(...projectIds) as { id: string }[]
      
      const existingIds = new Set(existingRows.map(r => r.id))
      
      // Finally delete projects
      const deleteProjects = db.prepare(
        `DELETE FROM project WHERE id IN (${placeholders})`
      )
      deleteProjects.run(...projectIds)
      
      db.run("COMMIT")
      
      // Report results
      for (const projectId of projectIds) {
        if (existingIds.has(projectId)) {
          removed.push(`sqlite:project:${projectId}`)
        } else {
          failed.push({ 
            path: `sqlite:project:${projectId}`, 
            error: "Project not found" 
          })
        }
      }
      
    } catch (error) {
      // Rollback on any error
      try {
        db.run("ROLLBACK")
      } catch {
        // Ignore rollback errors
      }
      
      // Report all projects as failed
      const message = formatSqliteErrorMessage(error, "SQLite delete failed", options)
      if (options.strict) {
        throw new Error(message)
      }
      for (const projectId of projectIds) {
        failed.push({ 
          path: `sqlite:project:${projectId}`, 
          error: message 
        })
      }
    }
    
  } finally {
    if (db) {
      closeIfOwned(db, options.db)
    }
  }

  return { removed, failed }
}

// ========================
// Session Update Operations
// ========================

/**
 * Options for updating session title in SQLite.
 */
export interface SqliteUpdateTitleOptions extends SqliteLoadOptions {
  /**
   * The session ID to update.
   */
  sessionId: string
  
  /**
   * The new title to set.
   */
  newTitle: string
}

/**
 * Update the title of a session in SQLite database.
 *
 * This function:
 * 1. Loads the existing session data from the database
 * 2. Updates the title field in the JSON data
 * 3. Updates the updated_at timestamp in both the column and JSON data
 * 4. Writes the updated data back to the database
 *
 * @param options - Database connection options with sessionId and newTitle.
 * @throws Error if the session is not found.
 */
export async function updateSessionTitleSqlite(
  options: SqliteUpdateTitleOptions
): Promise<void> {
  const db = openDatabase(options.db, { readonly: false, forceWrite: options.forceWrite })

  try {
    const schemaMessage = getSchemaIssueMessage(
      db,
      buildSchemaRequirements(["session"]),
      "updateSessionTitle"
    )
    if (schemaMessage) {
      if (options.strict) {
        throw new Error(schemaMessage)
      }
      warnSqlite(options, schemaMessage)
      throw new Error(schemaMessage)
    }

    // Load existing session data
    let row: { id: string; data: string } | null = null
    try {
      row = db.query(
        "SELECT id, data FROM session WHERE id = ?"
      ).get(options.sessionId) as { id: string; data: string } | null
    } catch (error) {
      throw new Error(formatSqliteErrorMessage(error, "Failed to query session table", options))
    }

    if (!row) {
      throw new Error(`Session not found: ${options.sessionId}`)
    }

    // Parse existing JSON data
    let data: SessionData
    try {
      data = JSON.parse(row.data) as SessionData
    } catch (error) {
      throw new Error(
        formatSqliteErrorMessage(error, `Failed to parse session data for: ${options.sessionId}`, options)
      )
    }

    // Update title and timestamp
    data.title = options.newTitle
    data.time = data.time ?? {}
    const now = Date.now()
    data.time.updated = now

    // Update the database
    try {
      const stmt = db.prepare(
        "UPDATE session SET data = ?, updated_at = ? WHERE id = ?"
      )
      stmt.run(JSON.stringify(data), now, options.sessionId)
    } catch (error) {
      throw new Error(formatSqliteErrorMessage(error, "Failed to update session title", options))
    }
  } catch (error) {
    if (isSqliteBusyError(error)) {
      throw new Error(
        formatBusyErrorMessage("SQLite database is locked", { forceWrite: options.forceWrite })
      )
    }
    throw error instanceof Error ? error : new Error(String(error))
  } finally {
    closeIfOwned(db, options.db)
  }
}

// ========================
// Session Move Operations
// ========================

/**
 * Options for moving a session to a different project in SQLite.
 */
export interface SqliteMoveSessionOptions extends SqliteLoadOptions {
  /**
   * The session ID to move.
   */
  sessionId: string

  /**
   * The target project ID to move the session to.
   */
  targetProjectId: string
}

/**
 * Move a session to a different project in SQLite database.
 *
 * This function:
 * 1. Loads the existing session data from the database
 * 2. Verifies the target project exists (optional - see notes)
 * 3. Updates the project_id column in the session row
 * 4. Updates the projectID field in the JSON data
 * 5. Updates the updated_at timestamp in both column and JSON
 * 6. Returns the updated session record
 *
 * Note: Unlike JSONL which moves files between directories, SQLite just updates
 * the project_id column. There's no file system operation.
 *
 * @param options - Database connection options with sessionId and targetProjectId.
 * @returns The updated SessionRecord with new projectId.
 * @throws Error if the session is not found.
 */
export async function moveSessionSqlite(
  options: SqliteMoveSessionOptions
): Promise<SessionRecord> {
  const db = openDatabase(options.db, { readonly: false, forceWrite: options.forceWrite })

  try {
    const schemaMessage = getSchemaIssueMessage(
      db,
      buildSchemaRequirements(["session"]),
      "moveSession"
    )
    if (schemaMessage) {
      if (options.strict) {
        throw new Error(schemaMessage)
      }
      warnSqlite(options, schemaMessage)
      throw new Error(schemaMessage)
    }

    // Load existing session data
    let row: SessionRow | null = null
    try {
      row = db.query(
        "SELECT id, project_id, parent_id, created_at, updated_at, data FROM session WHERE id = ?"
      ).get(options.sessionId) as SessionRow | null
    } catch (error) {
      throw new Error(formatSqliteErrorMessage(error, "Failed to query session table", options))
    }

    if (!row) {
      throw new Error(`Session not found: ${options.sessionId}`)
    }

    // Parse existing JSON data
    let data: SessionData
    try {
      data = JSON.parse(row.data) as SessionData
    } catch (error) {
      throw new Error(
        formatSqliteErrorMessage(error, `Failed to parse session data for: ${options.sessionId}`, options)
      )
    }

    // Update project ID and timestamp
    const now = Date.now()
    data.projectID = options.targetProjectId
    data.time = data.time ?? {}
    data.time.updated = now

    // Update the database - both project_id column and data JSON
    try {
      const stmt = db.prepare(
        "UPDATE session SET project_id = ?, data = ?, updated_at = ? WHERE id = ?"
      )
      stmt.run(options.targetProjectId, JSON.stringify(data), now, options.sessionId)
    } catch (error) {
      throw new Error(formatSqliteErrorMessage(error, "Failed to move session", options))
    }

    // Build and return the updated session record
    const createdAt = msToDate(row.created_at) ?? msToDate(data.time?.created)
    const directory = expandUserPath(data.directory)

    return {
      index: 1, // Single result, so index is 1
      filePath: `sqlite:session:${row.id}`,
      sessionId: row.id,
      projectId: options.targetProjectId,
      directory: directory ?? "",
      title: typeof data.title === "string" ? data.title : "",
      version: typeof data.version === "string" ? data.version : "",
      createdAt,
      updatedAt: new Date(now),
    }
  } catch (error) {
    if (isSqliteBusyError(error)) {
      throw new Error(
        formatBusyErrorMessage("SQLite database is locked", { forceWrite: options.forceWrite })
      )
    }
    throw error instanceof Error ? error : new Error(String(error))
  } finally {
    closeIfOwned(db, options.db)
  }
}

// ========================
// Session Copy Operations
// ========================

/**
 * Options for copying a session to a different project in SQLite.
 */
export interface SqliteCopySessionOptions extends SqliteLoadOptions {
  /**
   * The session ID to copy.
   */
  sessionId: string

  /**
   * The target project ID to copy the session to.
   */
  targetProjectId: string
}

/**
 * Generate a new unique ID with a given prefix.
 * Format: {prefix}_{timestamp}_{random}
 *
 * @param prefix - Prefix for the ID (e.g., "session", "msg", "part")
 * @returns A unique ID string.
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Copy a session to a different project in SQLite database.
 *
 * This function:
 * 1. Generates new IDs for the session, all messages, and all parts
 * 2. Copies the session row with new ID and target project_id
 * 3. Copies all messages with new IDs, pointing to the new session
 * 4. Copies all parts with new IDs, pointing to the new messages
 * 5. Uses a transaction for atomicity
 * 6. Returns the new session record
 *
 * Note: Unlike JSONL which copies files, SQLite duplicates rows with new IDs.
 * All relationships (session->messages->parts) are preserved via ID remapping.
 *
 * @param options - Database connection options with sessionId and targetProjectId.
 * @returns The new SessionRecord with new sessionId and targetProjectId.
 * @throws Error if the source session is not found.
 */
export async function copySessionSqlite(
  options: SqliteCopySessionOptions
): Promise<SessionRecord> {
  const db = openDatabase(options.db, { readonly: false, forceWrite: options.forceWrite })

  try {
    const schemaMessage = getSchemaIssueMessage(
      db,
      buildSchemaRequirements(["session", "message", "part"]),
      "copySession"
    )
    if (schemaMessage) {
      if (options.strict) {
        throw new Error(schemaMessage)
      }
      warnSqlite(options, schemaMessage)
      throw new Error(schemaMessage)
    }

    // Load existing session data
    let sessionRow: SessionRow | null = null
    try {
      sessionRow = db.query(
        "SELECT id, project_id, parent_id, created_at, updated_at, data FROM session WHERE id = ?"
      ).get(options.sessionId) as SessionRow | null
    } catch (error) {
      throw new Error(formatSqliteErrorMessage(error, "Failed to query session table", options))
    }

    if (!sessionRow) {
      throw new Error(`Session not found: ${options.sessionId}`)
    }

    // Parse existing session JSON data
    let sessionData: SessionData
    try {
      sessionData = JSON.parse(sessionRow.data) as SessionData
    } catch (error) {
      throw new Error(
        formatSqliteErrorMessage(error, `Failed to parse session data for: ${options.sessionId}`, options)
      )
    }

    // Generate new session ID
    const newSessionId = generateId("session")
    const now = Date.now()

    // Update session data for the copy
    const newSessionData: SessionData = {
      ...sessionData,
      id: newSessionId,
      projectID: options.targetProjectId,
      time: {
        ...sessionData.time,
        created: now,
        updated: now,
      },
    }

    // Load all messages for this session
    let messageRows: MessageRow[] = []
    try {
      messageRows = db.query(
        "SELECT id, session_id, created_at, data FROM message WHERE session_id = ? ORDER BY created_at ASC"
      ).all(options.sessionId) as MessageRow[]
    } catch (error) {
      throw new Error(formatSqliteErrorMessage(error, "Failed to query message table", options))
    }

    // Load all parts for this session
    let partRows: PartRow[] = []
    try {
      partRows = db.query(
        "SELECT id, message_id, session_id, data FROM part WHERE session_id = ?"
      ).all(options.sessionId) as PartRow[]
    } catch (error) {
      throw new Error(formatSqliteErrorMessage(error, "Failed to query part table", options))
    }

    // Create ID mapping for messages (old ID -> new ID)
    const messageIdMap = new Map<string, string>()
    for (const msg of messageRows) {
      messageIdMap.set(msg.id, generateId("msg"))
    }

    // Begin transaction for atomicity
    try {
      db.run(options.forceWrite ? "BEGIN IMMEDIATE" : "BEGIN TRANSACTION")
    } catch (error) {
      throw new Error(formatSqliteErrorMessage(error, "Failed to start SQLite transaction", options))
    }

    try {
      // Insert new session
      const insertSessionStmt = db.prepare(
        "INSERT INTO session (id, project_id, parent_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?, ?)"
      )
      insertSessionStmt.run(
        newSessionId,
        options.targetProjectId,
        null, // Copied sessions have no parent_id
        now,
        now,
        JSON.stringify(newSessionData)
      )

      // Insert copied messages
      if (messageRows.length > 0) {
        const insertMessageStmt = db.prepare(
          "INSERT INTO message (id, session_id, created_at, data) VALUES (?, ?, ?, ?)"
        )

        for (const msgRow of messageRows) {
          const newMessageId = messageIdMap.get(msgRow.id)!

          // Parse and update message data
          let msgData: MessageData
          try {
            msgData = JSON.parse(msgRow.data) as MessageData
          } catch (error) {
            const message = formatSqliteErrorMessage(
              error,
              `Malformed JSON in message row "${msgRow.id}"`,
              options
            )
            if (options.strict) {
              throw new Error(message)
            }
            warnSqlite(options, message)
            continue
          }

          const newMsgData: MessageData = {
            ...msgData,
            id: newMessageId,
            sessionID: newSessionId,
          }

          insertMessageStmt.run(
            newMessageId,
            newSessionId,
            msgRow.created_at,
            JSON.stringify(newMsgData)
          )
        }
      }

      // Insert copied parts
      if (partRows.length > 0) {
        const insertPartStmt = db.prepare(
          "INSERT INTO part (id, message_id, session_id, data) VALUES (?, ?, ?, ?)"
        )

        for (const partRow of partRows) {
          const newMessageId = messageIdMap.get(partRow.message_id)
          if (!newMessageId) {
            // Skip orphaned parts (message was skipped due to malformed data)
            continue
          }

          const newPartId = generateId("part")

          // Parse and update part data
          let partData: PartData
          try {
            partData = JSON.parse(partRow.data) as PartData
          } catch (error) {
            const message = formatSqliteErrorMessage(
              error,
              `Malformed JSON in part row "${partRow.id}"`,
              options
            )
            if (options.strict) {
              throw new Error(message)
            }
            warnSqlite(options, message)
            continue
          }

          const newPartData: PartData = {
            ...partData,
            id: newPartId,
            messageID: newMessageId,
            sessionID: newSessionId,
          }

          insertPartStmt.run(
            newPartId,
            newMessageId,
            newSessionId,
            JSON.stringify(newPartData)
          )
        }
      }

      // Commit transaction
      db.run("COMMIT")
    } catch (err) {
      // Rollback on error
      db.run("ROLLBACK")
      throw err
    }

    // Build and return the new session record
    const directory = expandUserPath(newSessionData.directory)

    return {
      index: 1, // Single result, so index is 1
      filePath: `sqlite:session:${newSessionId}`,
      sessionId: newSessionId,
      projectId: options.targetProjectId,
      directory: directory ?? "",
      title: typeof newSessionData.title === "string" ? newSessionData.title : "",
      version: typeof newSessionData.version === "string" ? newSessionData.version : "",
      createdAt: new Date(now),
      updatedAt: new Date(now),
    }
  } catch (error) {
    if (isSqliteBusyError(error)) {
      throw new Error(
        formatBusyErrorMessage("SQLite database is locked", { forceWrite: options.forceWrite })
      )
    }
    throw error instanceof Error ? error : new Error(String(error))
  } finally {
    closeIfOwned(db, options.db)
  }
}
