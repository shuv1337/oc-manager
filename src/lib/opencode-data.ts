import { constants, promises as fs } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { homedir } from "node:os"

export type ProjectState = "present" | "missing" | "unknown"

// ========================
// Token Types
// ========================

export type TokenBreakdown = {
  input: number
  output: number
  reasoning: number
  cacheRead: number
  cacheWrite: number
  total: number
}

export type TokenSummary =
  | { kind: "known"; tokens: TokenBreakdown }
  | { kind: "unknown"; reason: "missing" | "parse_error" | "no_messages" }

export type AggregateTokenSummary = {
  total: TokenSummary
  knownOnly?: TokenBreakdown
  unknownSessions?: number
}

export interface ProjectRecord {
  index: number
  bucket: ProjectBucket
  filePath: string
  projectId: string
  worktree: string
  vcs: string | null
  createdAt: Date | null
  state: ProjectState
}

export interface SessionRecord {
  index: number
  filePath: string
  sessionId: string
  projectId: string
  directory: string
  title: string
  version: string
  createdAt: Date | null
  updatedAt: Date | null
}

export const DEFAULT_ROOT = join(homedir(), ".local", "share", "opencode")
const PROJECT_BUCKETS = ["project", "sessions"] as const
type ProjectBucket = (typeof PROJECT_BUCKETS)[number]

export interface LoadOptions {
  root?: string
}

export interface SessionLoadOptions extends LoadOptions {
  projectId?: string
}

export interface DeleteOptions {
  dryRun?: boolean
}

export interface DeleteResult {
  removed: string[]
  failed: { path: string; error?: string }[]
}

const BUCKET_SORT = new Map(PROJECT_BUCKETS.map((bucket, idx) => [bucket, idx]))

function expandUserPath(rawPath?: string): string | null {
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

function shortenPath(path: string): string {
  if (!path) {
    return path
  }
  const home = homedir()
  return path.startsWith(home) ? path.replace(home, "~") : path
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.access(path, constants.F_OK)
    return true
  } catch (error) {
    return false
  }
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8")
    return JSON.parse(raw) as T
  } catch (error) {
    return null
  }
}

function msToDate(ms?: number | null): Date | null {
  if (typeof ms !== "number" || Number.isNaN(ms)) {
    return null
  }
  return new Date(ms)
}

async function computeState(worktree: string | null): Promise<ProjectState> {
  if (!worktree) {
    return "unknown"
  }
  try {
    const stat = await fs.stat(worktree)
    return stat.isDirectory() ? "present" : "missing"
  } catch (error) {
    return "missing"
  }
}

function compareDates(a: Date | null, b: Date | null): number {
  const aTime = a?.getTime() ?? 0
  const bTime = b?.getTime() ?? 0
  return bTime - aTime
}

function withIndex<T extends { index: number }>(records: T[]): T[] {
  return records.map((record, idx) => ({ ...record, index: idx + 1 }))
}

export function formatDisplayPath(path: string, options?: { fullPath?: boolean }): string {
  if (options?.fullPath || !path) {
    return path
  }
  return shortenPath(path)
}

export async function loadProjectRecords(options: LoadOptions = {}): Promise<ProjectRecord[]> {
  const root = resolve(options.root ?? DEFAULT_ROOT)
  const records: ProjectRecord[] = []

  for (const bucket of PROJECT_BUCKETS) {
    const bucketDir = join(root, "storage", bucket)
    if (!(await pathExists(bucketDir))) {
      continue
    }
    const entries = await fs.readdir(bucketDir)
    for (const entry of entries) {
      if (!entry.endsWith(".json")) {
        continue
      }
      const filePath = join(bucketDir, entry)
      const payload = await readJsonFile<any>(filePath)
      if (!payload) {
        continue
      }
      const createdAt = msToDate(payload?.time?.created)
      const worktree = expandUserPath(payload?.worktree ?? undefined)
      const state = await computeState(worktree)
      records.push({
        index: 0,
        bucket,
        filePath,
        projectId: String(payload?.id ?? entry.replace(/\.json$/i, "")),
        worktree: worktree ?? "",
        vcs: typeof payload?.vcs === "string" ? payload.vcs : null,
        createdAt,
        state,
      })
    }
  }

  records.sort((a, b) => {
    const dateDelta = compareDates(a.createdAt, b.createdAt)
    if (dateDelta !== 0) {
      return dateDelta
    }
    const bucketDelta = (BUCKET_SORT.get(a.bucket) ?? 0) - (BUCKET_SORT.get(b.bucket) ?? 0)
    if (bucketDelta !== 0) {
      return bucketDelta
    }
    return a.projectId.localeCompare(b.projectId)
  })

  return withIndex(records)
}

export async function loadSessionRecords(options: SessionLoadOptions = {}): Promise<SessionRecord[]> {
  const root = resolve(options.root ?? DEFAULT_ROOT)
  const sessionRoot = join(root, "storage", "session")

  if (!(await pathExists(sessionRoot))) {
    return []
  }

  const projectDirs = await fs.readdir(sessionRoot, { withFileTypes: true })
  const sessions: SessionRecord[] = []

  // Some older OpenCode layouts may store message/part data under `storage/session/*`.
  // Avoid treating those as project IDs when loading sessions.
  const reservedSessionDirs = new Set(["message", "part"])

  for (const dirent of projectDirs) {
    if (!dirent.isDirectory()) {
      continue
    }
    const currentProjectId = dirent.name
    if (reservedSessionDirs.has(currentProjectId)) {
      continue
    }
    if (options.projectId && options.projectId !== currentProjectId) {
      continue
    }
    const projectDir = join(sessionRoot, dirent.name)
    const files = await fs.readdir(projectDir)
    for (const file of files) {
      if (!file.endsWith(".json")) {
        continue
      }
      const filePath = join(projectDir, file)
      const payload = await readJsonFile<any>(filePath)
      if (!payload) {
        continue
      }
      const createdAt = msToDate(payload?.time?.created)
      const updatedAt = msToDate(payload?.time?.updated)
      const directory = expandUserPath(payload?.directory ?? undefined)
      sessions.push({
        index: 0,
        filePath,
        sessionId: String(payload?.id ?? file.replace(/\.json$/i, "")),
        projectId: String(payload?.projectID ?? currentProjectId),
        directory: directory ?? "",
        title: typeof payload?.title === "string" ? payload.title : "",
        version: typeof payload?.version === "string" ? payload.version : "",
        createdAt,
        updatedAt,
      })
    }
  }

  sessions.sort((a, b) => {
    const updatedDelta = compareDates(a.updatedAt ?? a.createdAt, b.updatedAt ?? b.createdAt)
    if (updatedDelta !== 0) {
      return updatedDelta
    }
    return a.sessionId.localeCompare(b.sessionId)
  })

  return withIndex(sessions)
}

export async function deleteProjectMetadata(
  records: ProjectRecord[],
  options: DeleteOptions = {},
): Promise<DeleteResult> {
  const removed: string[] = []
  const failed: { path: string; error?: string }[] = []
  for (const record of records) {
    if (options.dryRun) {
      removed.push(record.filePath)
      continue
    }
    try {
      await fs.unlink(record.filePath)
      removed.push(record.filePath)
    } catch (error) {
      failed.push({ path: record.filePath, error: error instanceof Error ? error.message : String(error) })
    }
  }
  return { removed, failed }
}

export async function deleteSessionMetadata(
  records: SessionRecord[],
  options: DeleteOptions = {},
): Promise<DeleteResult> {
  const removed: string[] = []
  const failed: { path: string; error?: string }[] = []
  for (const session of records) {
    if (options.dryRun) {
      removed.push(session.filePath)
      continue
    }
    try {
      await fs.unlink(session.filePath)
      removed.push(session.filePath)
    } catch (error) {
      failed.push({ path: session.filePath, error: error instanceof Error ? error.message : String(error) })
    }
  }
  return { removed, failed }
}

export function filterProjectsByState(records: ProjectRecord[], state: ProjectState): ProjectRecord[] {
  return records.filter((record) => record.state === state)
}

export function filterProjectsByIds(records: ProjectRecord[], ids: Set<string>): ProjectRecord[] {
  return records.filter((record) => ids.has(record.projectId))
}

export function filterProjectsByIndexes(records: ProjectRecord[], indexes: Set<number>): ProjectRecord[] {
  return records.filter((record) => indexes.has(record.index))
}

export function filterSessionsByIndexes(records: SessionRecord[], indexes: Set<number>): SessionRecord[] {
  return records.filter((record) => indexes.has(record.index))
}

export function formatDate(date: Date | null): string {
  if (!date) {
    return "?"
  }
  return date.toLocaleString()
}

export function describeProject(record: ProjectRecord, options?: { fullPath?: boolean }): string {
  return `${record.bucket}:${record.projectId} (${formatDisplayPath(record.worktree, options)})`
}

export function describeSession(record: SessionRecord, options?: { fullPath?: boolean }): string {
  return `${record.sessionId} [${record.projectId}] (${record.title || "no title"})`
}

export async function ensureDirectory(path: string): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true })
}

export async function updateSessionTitle(filePath: string, newTitle: string): Promise<void> {
  const payload = await readJsonFile<any>(filePath)
  if (!payload) {
    throw new Error(`Session file not found or unreadable: ${filePath}`)
  }
  payload.title = newTitle
  payload.time = payload.time || {}
  payload.time.updated = Date.now()
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8')
}

export async function copySession(
  session: SessionRecord,
  targetProjectId: string,
  root: string = DEFAULT_ROOT
): Promise<SessionRecord> {
  const payload = await readJsonFile<any>(session.filePath)
  if (!payload) {
    throw new Error(`Session file not found: ${session.filePath}`)
  }

  // Generate new session ID
  const newSessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  // Update payload for new session
  payload.id = newSessionId
  payload.projectID = targetProjectId
  payload.time = payload.time || {}
  payload.time.created = Date.now()
  payload.time.updated = Date.now()

  // Ensure target directory exists
  const targetDir = join(root, 'storage', 'session', targetProjectId)
  await ensureDirectory(join(targetDir, 'dummy'))

  // Write new session file
  const targetPath = join(targetDir, `${newSessionId}.json`)
  await fs.writeFile(targetPath, JSON.stringify(payload, null, 2), 'utf8')

  // Return new session record
  return {
    index: 0,
    filePath: targetPath,
    sessionId: newSessionId,
    projectId: targetProjectId,
    directory: session.directory,
    title: session.title,
    version: session.version,
    createdAt: new Date(),
    updatedAt: new Date()
  }
}

export async function moveSession(
  session: SessionRecord,
  targetProjectId: string,
  root: string = DEFAULT_ROOT
): Promise<SessionRecord> {
  const payload = await readJsonFile<any>(session.filePath)
  if (!payload) {
    throw new Error(`Session file not found: ${session.filePath}`)
  }

  payload.projectID = targetProjectId
  payload.time = payload.time || {}
  payload.time.updated = Date.now()

  // Ensure target directory exists
  const targetDir = join(root, 'storage', 'session', targetProjectId)
  await ensureDirectory(join(targetDir, 'dummy'))

  // Write to new location
  const targetPath = join(targetDir, `${session.sessionId}.json`)
  await fs.writeFile(targetPath, JSON.stringify(payload, null, 2), 'utf8')

  // Remove old file
  await fs.unlink(session.filePath)

  return {
    ...session,
    filePath: targetPath,
    projectId: targetProjectId,
    updatedAt: new Date()
  }
}

export interface BatchOperationResult {
  succeeded: { session: SessionRecord; newRecord: SessionRecord }[]
  failed: { session: SessionRecord; error: string }[]
}

export async function copySessions(
  sessions: SessionRecord[],
  targetProjectId: string,
  root?: string
): Promise<BatchOperationResult> {
  const succeeded: BatchOperationResult['succeeded'] = []
  const failed: BatchOperationResult['failed'] = []

  for (const session of sessions) {
    try {
      const newRecord = await copySession(session, targetProjectId, root)
      succeeded.push({ session, newRecord })
    } catch (error) {
      failed.push({
        session,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  return { succeeded, failed }
}

export async function moveSessions(
  sessions: SessionRecord[],
  targetProjectId: string,
  root?: string
): Promise<BatchOperationResult> {
  const succeeded: BatchOperationResult['succeeded'] = []
  const failed: BatchOperationResult['failed'] = []

  for (const session of sessions) {
    try {
      const newRecord = await moveSession(session, targetProjectId, root)
      succeeded.push({ session, newRecord })
    } catch (error) {
      failed.push({
        session,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  return { succeeded, failed }
}

// ========================
// Token Aggregation
// ========================

// Cache: key includes root+project+session+updatedAtMs to avoid collisions.
const tokenCache = new Map<string, TokenSummary>()

function getCacheKey(session: SessionRecord, root: string): string {
  const updatedMs = session.updatedAt?.getTime() ?? session.createdAt?.getTime() ?? 0
  return JSON.stringify([root, session.projectId, session.sessionId, updatedMs])
}

export function clearTokenCache(): void {
  tokenCache.clear()
}

function emptyBreakdown(): TokenBreakdown {
  return {
    input: 0,
    output: 0,
    reasoning: 0,
    cacheRead: 0,
    cacheWrite: 0,
    total: 0,
  }
}

function addBreakdown(a: TokenBreakdown, b: TokenBreakdown): TokenBreakdown {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    reasoning: a.reasoning + b.reasoning,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheWrite: a.cacheWrite + b.cacheWrite,
    total: a.total + b.total,
  }
}

interface MessageTokens {
  input?: number
  output?: number
  reasoning?: number
  cache?: {
    read?: number
    write?: number
  }
}

interface MessagePayload {
  role?: string
  tokens?: MessageTokens | null
}

function asTokenNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null
  }
  if (value < 0) {
    return null
  }
  return value
}

function parseMessageTokens(tokens: MessageTokens | null | undefined): TokenBreakdown | null {
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

  const breakdown = emptyBreakdown()
  breakdown.input = input ?? 0
  breakdown.output = output ?? 0
  breakdown.reasoning = reasoning ?? 0
  breakdown.cacheRead = cacheRead ?? 0
  breakdown.cacheWrite = cacheWrite ?? 0
  breakdown.total = breakdown.input + breakdown.output + breakdown.reasoning + breakdown.cacheRead + breakdown.cacheWrite
  return breakdown
}

async function loadSessionMessagePaths(sessionId: string, root: string): Promise<string[] | null> {
  // Primary path: storage/message/<sessionId>
  const primaryPath = join(root, 'storage', 'message', sessionId)
  if (await pathExists(primaryPath)) {
    try {
      const entries = await fs.readdir(primaryPath)
      return entries
        .filter((e) => e.endsWith('.json'))
        .map((e) => join(primaryPath, e))
    } catch {
      return null
    }
  }

  // Legacy fallback: storage/session/message/<sessionId>
  const legacyPath = join(root, 'storage', 'session', 'message', sessionId)
  if (await pathExists(legacyPath)) {
    try {
      const entries = await fs.readdir(legacyPath)
      return entries
        .filter((e) => e.endsWith('.json'))
        .map((e) => join(legacyPath, e))
    } catch {
      return null
    }
  }

  return null
}

export async function computeSessionTokenSummary(
  session: SessionRecord,
  root: string = DEFAULT_ROOT
): Promise<TokenSummary> {
  const normalizedRoot = resolve(root)
  const cacheKey = getCacheKey(session, normalizedRoot)
  const cached = tokenCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const messagePaths = await loadSessionMessagePaths(session.sessionId, normalizedRoot)
  if (messagePaths === null) {
    const result: TokenSummary = { kind: 'unknown', reason: 'missing' }
    tokenCache.set(cacheKey, result)
    return result
  }

  if (messagePaths.length === 0) {
    const result: TokenSummary = { kind: 'unknown', reason: 'no_messages' }
    tokenCache.set(cacheKey, result)
    return result
  }

  const breakdown = emptyBreakdown()
  let foundAnyAssistant = false

  for (const msgPath of messagePaths) {
    const payload = await readJsonFile<MessagePayload>(msgPath)
    if (!payload) {
      const result: TokenSummary = { kind: "unknown", reason: "parse_error" }
      tokenCache.set(cacheKey, result)
      return result
    }

    // Only sum assistant messages (they have token telemetry)
    if (payload.role !== "assistant") {
      continue
    }

    foundAnyAssistant = true

    const msgTokens = parseMessageTokens(payload.tokens)
    if (!msgTokens) {
      const result: TokenSummary = { kind: "unknown", reason: "missing" }
      tokenCache.set(cacheKey, result)
      return result
    }

    breakdown.input += msgTokens.input
    breakdown.output += msgTokens.output
    breakdown.reasoning += msgTokens.reasoning
    breakdown.cacheRead += msgTokens.cacheRead
    breakdown.cacheWrite += msgTokens.cacheWrite
  }

  if (!foundAnyAssistant) {
    const result: TokenSummary = { kind: "unknown", reason: "no_messages" }
    tokenCache.set(cacheKey, result)
    return result
  }

  // Compute total
  breakdown.total = breakdown.input + breakdown.output + breakdown.reasoning + breakdown.cacheRead + breakdown.cacheWrite

  const result: TokenSummary = { kind: "known", tokens: breakdown }
  tokenCache.set(cacheKey, result)
  return result
}

export async function computeProjectTokenSummary(
  projectId: string,
  sessions: SessionRecord[],
  root: string = DEFAULT_ROOT
): Promise<AggregateTokenSummary> {
  const projectSessions = sessions.filter((s) => s.projectId === projectId)
  return computeAggregateTokenSummary(projectSessions, root)
}

export async function computeGlobalTokenSummary(
  sessions: SessionRecord[],
  root: string = DEFAULT_ROOT
): Promise<AggregateTokenSummary> {
  return computeAggregateTokenSummary(sessions, root)
}

async function computeAggregateTokenSummary(
  sessions: SessionRecord[],
  root: string
): Promise<AggregateTokenSummary> {
  if (sessions.length === 0) {
    return {
      total: { kind: 'unknown', reason: 'no_messages' },
      knownOnly: emptyBreakdown(),
      unknownSessions: 0,
    }
  }

  const knownOnly = emptyBreakdown()
  let unknownSessions = 0

  const normalizedRoot = resolve(root)

  for (const session of sessions) {
    const summary = await computeSessionTokenSummary(session, normalizedRoot)
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

  // Recompute knownOnly.total (defensive)
  knownOnly.total = knownOnly.input + knownOnly.output + knownOnly.reasoning + knownOnly.cacheRead + knownOnly.cacheWrite

  // If all sessions are unknown, total is unknown
  if (unknownSessions === sessions.length) {
    return {
      total: { kind: 'unknown', reason: 'missing' },
      knownOnly: emptyBreakdown(),
      unknownSessions,
    }
  }

  // Otherwise, total is the known aggregate (even if some sessions are unknown)
  return {
    total: { kind: 'known', tokens: { ...knownOnly } },
    knownOnly,
    unknownSessions,
  }
}
