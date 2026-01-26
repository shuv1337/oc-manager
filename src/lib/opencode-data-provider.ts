/**
 * Data Provider Abstraction for opencode data access.
 *
 * This module provides a unified interface for accessing opencode session/project data
 * from either the JSONL file-based storage or SQLite database backend.
 *
 * Provider pattern notes:
 * - The DataProvider interface is the contract for all backends.
 * - To add a new backend, implement its loader/writer functions, add a new
 *   StorageBackend value, and wire a createXProvider() branch in createProvider().
 * - Keep behavior consistent with JSONL defaults (ordering, filters, error handling).
 *
 * Usage:
 * ```ts
 * // Create provider based on options
 * const provider = createProvider({ backend: 'sqlite', dbPath: '/path/to/db' })
 *
 * // Use the same interface regardless of backend
 * const projects = await provider.loadProjectRecords()
 * const sessions = await provider.loadSessionRecords({ projectId: 'abc123' })
 * ```
 */
import { resolve } from "node:path"
import type {
  ProjectRecord,
  SessionRecord,
  ChatMessage,
  ChatPart,
  DeleteResult,
  DeleteOptions,
  TokenSummary,
  AggregateTokenSummary,
  ChatSearchResult,
} from "./opencode-data"
import {
  DEFAULT_ROOT,
  loadProjectRecords,
  loadSessionRecords,
  loadSessionChatIndex,
  loadMessageParts,
  hydrateChatMessageParts,
  deleteProjectMetadata,
  deleteSessionMetadata,
  updateSessionTitle,
  moveSession,
  copySession,
  computeSessionTokenSummary,
  computeProjectTokenSummary,
  computeGlobalTokenSummary,
  searchSessionsChat,
} from "./opencode-data"
import {
  DEFAULT_SQLITE_PATH,
  loadProjectRecordsSqlite,
  loadSessionRecordsSqlite,
  loadSessionChatIndexSqlite,
  loadMessagePartsSqlite,
  deleteSessionMetadataSqlite,
  deleteProjectMetadataSqlite,
  updateSessionTitleSqlite,
  moveSessionSqlite,
  copySessionSqlite,
} from "./opencode-data-sqlite"

// ========================
// Types
// ========================

/**
 * Storage backend type.
 */
export type StorageBackend = "jsonl" | "sqlite"

/**
 * Options for creating a data provider.
 */
export interface DataProviderOptions {
  /**
   * Storage backend to use. Defaults to "jsonl".
   */
  backend?: StorageBackend

  /**
   * Root directory for JSONL storage.
   * Required when backend is "jsonl".
   * Defaults to DEFAULT_ROOT (~/.local/share/opencode).
   */
  root?: string

  /**
   * Path to SQLite database file.
   * Required when backend is "sqlite".
   * Defaults to DEFAULT_SQLITE_PATH (~/.local/share/opencode/opencode.db).
   */
  dbPath?: string

  /**
   * Fail fast on any SQLite error or malformed data.
   * Only applies when backend is "sqlite".
   */
  sqliteStrict?: boolean

  /**
   * Wait for SQLite write locks to clear before failing.
   * Only applies when backend is "sqlite".
   */
  forceWrite?: boolean

  /**
   * Optional warning sink for SQLite warnings.
   */
  onWarning?: (warning: string) => void
}

/**
 * Options for loading sessions.
 */
export interface SessionLoadOptions {
  projectId?: string
}

/**
 * Unified data provider interface for both storage backends.
 *
 * This interface mirrors the existing JSONL loader functions but allows
 * transparent switching between backends.
 */
export interface DataProvider {
  /**
   * The storage backend being used.
   */
  readonly backend: StorageBackend

  /**
   * Load all project records.
   */
  loadProjectRecords(): Promise<ProjectRecord[]>

  /**
   * Load session records, optionally filtered by project.
   */
  loadSessionRecords(options?: SessionLoadOptions): Promise<SessionRecord[]>

  /**
   * Load chat message index for a session (metadata only, no parts).
   */
  loadSessionChatIndex(sessionId: string): Promise<ChatMessage[]>

  /**
   * Load all parts for a message.
   */
  loadMessageParts(messageId: string): Promise<ChatPart[]>

  /**
   * Hydrate a chat message with its parts.
   */
  hydrateChatMessageParts(message: ChatMessage): Promise<ChatMessage>

  /**
   * Delete project metadata files/records.
   */
  deleteProjectMetadata(records: ProjectRecord[], options?: DeleteOptions): Promise<DeleteResult>

  /**
   * Delete session metadata files/records.
   */
  deleteSessionMetadata(records: SessionRecord[], options?: DeleteOptions): Promise<DeleteResult>

  /**
   * Update session title.
   */
  updateSessionTitle(session: SessionRecord, newTitle: string): Promise<void>

  /**
   * Move a session to another project.
   */
  moveSession(session: SessionRecord, targetProjectId: string): Promise<SessionRecord>

  /**
   * Copy a session to another project.
   */
  copySession(session: SessionRecord, targetProjectId: string): Promise<SessionRecord>

  /**
   * Compute token summary for a single session.
   */
  computeSessionTokenSummary(session: SessionRecord): Promise<TokenSummary>

  /**
   * Compute aggregate token summary for a project.
   */
  computeProjectTokenSummary(projectId: string, sessions: SessionRecord[]): Promise<AggregateTokenSummary>

  /**
   * Compute aggregate token summary for all sessions.
   */
  computeGlobalTokenSummary(sessions: SessionRecord[]): Promise<AggregateTokenSummary>

  /**
   * Search chat content across sessions.
   */
  searchSessionsChat(
    sessions: SessionRecord[],
    query: string,
    options?: { maxResults?: number }
  ): Promise<ChatSearchResult[]>
}

// ========================
// JSONL Provider Implementation
// ========================

/**
 * Create a JSONL-backed data provider.
 */
function createJsonlProvider(root: string): DataProvider {
  const normalizedRoot = resolve(root)

  return {
    backend: "jsonl",

    async loadProjectRecords() {
      return loadProjectRecords({ root: normalizedRoot })
    },

    async loadSessionRecords(options?: SessionLoadOptions) {
      return loadSessionRecords({ root: normalizedRoot, projectId: options?.projectId })
    },

    async loadSessionChatIndex(sessionId: string) {
      return loadSessionChatIndex(sessionId, normalizedRoot)
    },

    async loadMessageParts(messageId: string) {
      return loadMessageParts(messageId, normalizedRoot)
    },

    async hydrateChatMessageParts(message: ChatMessage) {
      return hydrateChatMessageParts(message, normalizedRoot)
    },

    async deleteProjectMetadata(records: ProjectRecord[], options?: DeleteOptions) {
      return deleteProjectMetadata(records, options)
    },

    async deleteSessionMetadata(records: SessionRecord[], options?: DeleteOptions) {
      return deleteSessionMetadata(records, options)
    },

    async updateSessionTitle(session: SessionRecord, newTitle: string) {
      return updateSessionTitle(session.filePath, newTitle)
    },

    async moveSession(session: SessionRecord, targetProjectId: string) {
      return moveSession(session, targetProjectId, normalizedRoot)
    },

    async copySession(session: SessionRecord, targetProjectId: string) {
      return copySession(session, targetProjectId, normalizedRoot)
    },

    async computeSessionTokenSummary(session: SessionRecord) {
      return computeSessionTokenSummary(session, normalizedRoot)
    },

    async computeProjectTokenSummary(projectId: string, sessions: SessionRecord[]) {
      return computeProjectTokenSummary(projectId, sessions, normalizedRoot)
    },

    async computeGlobalTokenSummary(sessions: SessionRecord[]) {
      return computeGlobalTokenSummary(sessions, normalizedRoot)
    },

    async searchSessionsChat(
      sessions: SessionRecord[],
      query: string,
      options?: { maxResults?: number }
    ) {
      return searchSessionsChat(sessions, query, normalizedRoot, options)
    },
  }
}

// ========================
// SQLite Provider Implementation
// ========================

/**
 * Hydrate a chat message with its parts (SQLite version).
 */
async function hydrateChatMessagePartsSqlite(
  message: ChatMessage,
  dbPath: string,
  options?: { strict?: boolean; onWarning?: (warning: string) => void }
): Promise<ChatMessage> {
  const parts = await loadMessagePartsSqlite({
    db: dbPath,
    messageId: message.messageId,
    strict: options?.strict,
    onWarning: options?.onWarning,
  })

  // Combine all part texts for total chars and preview
  const combinedText = parts.map((p) => p.text).join("\n\n")
  const totalChars = combinedText.length

  const PREVIEW_CHARS = 200
  let previewText: string
  if (combinedText.length === 0) {
    previewText = "[no content]"
  } else if (combinedText.length <= PREVIEW_CHARS) {
    previewText = combinedText.replace(/\n/g, " ").trim()
  } else {
    previewText = combinedText.slice(0, PREVIEW_CHARS).replace(/\n/g, " ").trim() + "..."
  }

  return {
    ...message,
    parts,
    previewText,
    totalChars,
  }
}

/**
 * Create a SQLite-backed data provider.
 */
function createSqliteProvider(
  dbPath: string,
  options?: { strict?: boolean; forceWrite?: boolean; onWarning?: (warning: string) => void }
): DataProvider {
  const normalizedDbPath = resolve(dbPath)
  const readOptions = {
    db: normalizedDbPath,
    strict: options?.strict,
    onWarning: options?.onWarning,
  }
  const writeOptions = {
    ...readOptions,
    forceWrite: options?.forceWrite,
  }

  return {
    backend: "sqlite",

    async loadProjectRecords() {
      return loadProjectRecordsSqlite(readOptions)
    },

    async loadSessionRecords(options?: SessionLoadOptions) {
      return loadSessionRecordsSqlite({ ...readOptions, projectId: options?.projectId })
    },

    async loadSessionChatIndex(sessionId: string) {
      return loadSessionChatIndexSqlite({ ...readOptions, sessionId })
    },

    async loadMessageParts(messageId: string) {
      return loadMessagePartsSqlite({ ...readOptions, messageId })
    },

    async hydrateChatMessageParts(message: ChatMessage) {
      return hydrateChatMessagePartsSqlite(message, normalizedDbPath, readOptions)
    },

    // Write operations: SQLite implementations not yet available
    // For now, these throw NotImplementedError to be clear about limitations

    async deleteProjectMetadata(records: ProjectRecord[], options?: DeleteOptions) {
      const projectIds = records.map(r => r.projectId)
      return deleteProjectMetadataSqlite(projectIds, {
        ...writeOptions,
        dryRun: options?.dryRun,
      })
    },

    async deleteSessionMetadata(records: SessionRecord[], options?: DeleteOptions) {
      const sessionIds = records.map(r => r.sessionId)
      return deleteSessionMetadataSqlite(sessionIds, {
        ...writeOptions,
        dryRun: options?.dryRun,
      })
    },

    async updateSessionTitle(session: SessionRecord, newTitle: string) {
      return updateSessionTitleSqlite({
        ...writeOptions,
        sessionId: session.sessionId,
        newTitle,
      })
    },

    async moveSession(session: SessionRecord, targetProjectId: string) {
      return moveSessionSqlite({
        ...writeOptions,
        sessionId: session.sessionId,
        targetProjectId,
      })
    },

    async copySession(session: SessionRecord, targetProjectId: string) {
      return copySessionSqlite({
        ...writeOptions,
        sessionId: session.sessionId,
        targetProjectId,
      })
    },

    // Token computation: Use SQLite data loading but same computation logic
    async computeSessionTokenSummary(session: SessionRecord) {
      // Load messages from SQLite
      const messages = await loadSessionChatIndexSqlite({
        ...readOptions,
        sessionId: session.sessionId,
      })

      if (messages.length === 0) {
        return { kind: "unknown", reason: "no_messages" } as const
      }

      // Sum tokens from assistant messages
      let totalInput = 0
      let totalOutput = 0
      let totalReasoning = 0
      let totalCacheRead = 0
      let totalCacheWrite = 0
      let foundAnyAssistant = false

      for (const message of messages) {
        if (message.role !== "assistant") continue
        foundAnyAssistant = true

        if (!message.tokens) {
          return { kind: "unknown", reason: "missing" } as const
        }

        totalInput += message.tokens.input
        totalOutput += message.tokens.output
        totalReasoning += message.tokens.reasoning
        totalCacheRead += message.tokens.cacheRead
        totalCacheWrite += message.tokens.cacheWrite
      }

      if (!foundAnyAssistant) {
        return { kind: "unknown", reason: "no_messages" } as const
      }

      return {
        kind: "known",
        tokens: {
          input: totalInput,
          output: totalOutput,
          reasoning: totalReasoning,
          cacheRead: totalCacheRead,
          cacheWrite: totalCacheWrite,
          total: totalInput + totalOutput + totalReasoning + totalCacheRead + totalCacheWrite,
        },
      } as const
    },

    async computeProjectTokenSummary(projectId: string, sessions: SessionRecord[]) {
      const projectSessions = sessions.filter((s) => s.projectId === projectId)
      return computeAggregateSqlite(projectSessions, this)
    },

    async computeGlobalTokenSummary(sessions: SessionRecord[]) {
      return computeAggregateSqlite(sessions, this)
    },

    // Search: Use SQLite data loading but same search logic
    async searchSessionsChat(
      sessions: SessionRecord[],
      query: string,
      options?: { maxResults?: number }
    ) {
      const queryLower = query.toLowerCase().trim()
      const maxResults = options?.maxResults ?? 100
      const results: ChatSearchResult[] = []

      if (!queryLower) {
        return results
      }

      for (const session of sessions) {
        if (results.length >= maxResults) break

        // Load messages for this session
        const messages = await loadSessionChatIndexSqlite({
          ...readOptions,
          sessionId: session.sessionId,
        })

        for (const message of messages) {
          if (results.length >= maxResults) break

          // Load parts to search content
          const parts = await loadMessagePartsSqlite({
            ...readOptions,
            messageId: message.messageId,
          })

          for (const part of parts) {
            if (results.length >= maxResults) break

            const textLower = part.text.toLowerCase()
            const matchIndex = textLower.indexOf(queryLower)

            if (matchIndex !== -1) {
              // Create a snippet around the match
              const snippetStart = Math.max(0, matchIndex - 50)
              const snippetEnd = Math.min(part.text.length, matchIndex + query.length + 50)
              let snippet = part.text.slice(snippetStart, snippetEnd)
              if (snippetStart > 0) snippet = "..." + snippet
              if (snippetEnd < part.text.length) snippet = snippet + "..."

              results.push({
                sessionId: session.sessionId,
                sessionTitle: session.title || session.sessionId,
                projectId: session.projectId,
                messageId: message.messageId,
                role: message.role,
                matchedText: snippet.replace(/\n/g, " "),
                fullText: part.text,
                partType: part.type,
                createdAt: message.createdAt,
              })

              // Only one result per message to avoid duplicates
              break
            }
          }
        }
      }

      return results
    },
  }
}

/**
 * Helper to compute aggregate token summary for SQLite provider.
 */
async function computeAggregateSqlite(
  sessions: SessionRecord[],
  provider: DataProvider
): Promise<AggregateTokenSummary> {
  if (sessions.length === 0) {
    return {
      total: { kind: "unknown", reason: "no_messages" },
      knownOnly: {
        input: 0,
        output: 0,
        reasoning: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0,
      },
      unknownSessions: 0,
    }
  }

  const knownOnly = {
    input: 0,
    output: 0,
    reasoning: 0,
    cacheRead: 0,
    cacheWrite: 0,
    total: 0,
  }
  let unknownSessions = 0

  for (const session of sessions) {
    const summary = await provider.computeSessionTokenSummary(session)
    if (summary.kind === "known") {
      knownOnly.input += summary.tokens.input
      knownOnly.output += summary.tokens.output
      knownOnly.reasoning += summary.tokens.reasoning
      knownOnly.cacheRead += summary.tokens.cacheRead
      knownOnly.cacheWrite += summary.tokens.cacheWrite
      knownOnly.total += summary.tokens.total
    } else {
      unknownSessions += 1
    }
  }

  // If all sessions are unknown, total is unknown
  if (unknownSessions === sessions.length) {
    return {
      total: { kind: "unknown", reason: "missing" },
      knownOnly: {
        input: 0,
        output: 0,
        reasoning: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0,
      },
      unknownSessions,
    }
  }

  return {
    total: { kind: "known", tokens: { ...knownOnly } },
    knownOnly,
    unknownSessions,
  }
}

// ========================
// Factory Function
// ========================

/**
 * Create a data provider based on the specified options.
 *
 * @param options - Configuration options for the provider.
 * @returns A DataProvider instance for the specified backend.
 * @throws Error if required options are missing.
 *
 * @example
 * ```ts
 * // JSONL backend (default)
 * const jsonlProvider = createProvider({ root: '~/.local/share/opencode' })
 *
 * // SQLite backend
 * const sqliteProvider = createProvider({
 *   backend: 'sqlite',
 *   dbPath: '~/.local/share/opencode/opencode.db'
 * })
 * ```
 */
export function createProvider(options: DataProviderOptions = {}): DataProvider {
  const backend = options.backend ?? "jsonl"

  // Validate backend value
  if (backend !== "jsonl" && backend !== "sqlite") {
    throw new Error(
      `Invalid storage backend: "${backend}". Must be "jsonl" or "sqlite".`
    )
  }

  if (backend === "sqlite") {
    const dbPath = options.dbPath ?? DEFAULT_SQLITE_PATH
    return createSqliteProvider(dbPath, {
      strict: options.sqliteStrict,
      forceWrite: options.forceWrite,
      onWarning: options.onWarning,
    })
  }

  // JSONL backend (default)
  const root = options.root ?? DEFAULT_ROOT
  return createJsonlProvider(root)
}

/**
 * Create a data provider from CLI global options.
 *
 * This is a convenience function for CLI commands to create a provider
 * based on the parsed global options (experimentalSqlite, dbPath, root).
 *
 * @param globalOptions - Parsed CLI global options.
 * @returns A DataProvider instance.
 */
export function createProviderFromGlobalOptions(globalOptions: {
  experimentalSqlite?: boolean
  dbPath?: string
  root?: string
  sqliteStrict?: boolean
  forceWrite?: boolean
}): DataProvider {
  if (globalOptions.experimentalSqlite || globalOptions.dbPath) {
    return createProvider({
      backend: "sqlite",
      dbPath: globalOptions.dbPath,
      sqliteStrict: globalOptions.sqliteStrict,
      forceWrite: globalOptions.forceWrite,
    })
  }

  return createProvider({
    backend: "jsonl",
    root: globalOptions.root,
  })
}
