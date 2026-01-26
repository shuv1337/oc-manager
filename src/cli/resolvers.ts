/**
 * CLI resolver helpers for converting user-provided IDs to records.
 *
 * These helpers provide consistent ID resolution across all CLI commands,
 * supporting both exact matches and flexible matching patterns.
 *
 * Resolvers can optionally accept a DataProvider to support both JSONL and
 * SQLite backends. When no provider is given, they fall back to direct JSONL
 * loading for backward compatibility.
 */

import {
  loadProjectRecords,
  loadSessionRecords,
  type LoadOptions,
  type SessionLoadOptions,
  type ProjectRecord,
  type SessionRecord,
} from "../lib/opencode-data"
import { type DataProvider } from "../lib/opencode-data-provider"
import { NotFoundError, projectNotFound, sessionNotFound } from "./errors"

// ========================
// Session Resolution
// ========================

/**
 * Options for resolving session IDs.
 */
export interface ResolveSessionOptions extends SessionLoadOptions {
  /**
   * If true, allow partial prefix matching when exact match fails.
   * Requires the prefix to match exactly one session uniquely.
   * Defaults to false.
   */
  allowPrefix?: boolean

  /**
   * Optional data provider for backend-agnostic data loading.
   * When provided, uses the provider's loadSessionRecords method.
   * When omitted, falls back to direct JSONL loading for backward compatibility.
   */
  provider?: DataProvider
}

/**
 * Result of a session resolution attempt.
 */
export interface ResolveSessionResult {
  session: SessionRecord
  /** How the session was matched */
  matchType: "exact" | "prefix"
  /** All sessions that were loaded (for reuse) */
  allSessions: SessionRecord[]
}

/**
 * Find a session by exact ID from a pre-loaded list of sessions.
 *
 * @param sessions - Pre-loaded session records
 * @param sessionId - Session ID to find
 * @returns The matching session
 * @throws NotFoundError if session doesn't exist
 */
export function findSessionById(
  sessions: SessionRecord[],
  sessionId: string
): SessionRecord {
  const session = sessions.find((s) => s.sessionId === sessionId)
  if (!session) {
    sessionNotFound(sessionId)
  }
  return session
}

/**
 * Find sessions matching a prefix from a pre-loaded list.
 *
 * @param sessions - Pre-loaded session records
 * @param prefix - Session ID prefix to match
 * @returns Array of matching sessions
 */
export function findSessionsByPrefix(
  sessions: SessionRecord[],
  prefix: string
): SessionRecord[] {
  return sessions.filter((s) => s.sessionId.startsWith(prefix))
}

/**
 * Resolve a session ID to a session record, loading data as needed.
 *
 * Supports exact matching and optional prefix matching.
 *
 * @param sessionId - Session ID or prefix to resolve
 * @param options - Resolution options including root, projectId filters, and optional provider
 * @returns Resolution result with session and metadata
 * @throws NotFoundError if no session matches
 * @throws NotFoundError if prefix matches multiple sessions (ambiguous)
 */
export async function resolveSessionId(
  sessionId: string,
  options: ResolveSessionOptions = {}
): Promise<ResolveSessionResult> {
  // Use provider if available, otherwise fall back to direct JSONL loading
  const sessions = options.provider
    ? await options.provider.loadSessionRecords({ projectId: options.projectId })
    : await loadSessionRecords({
        root: options.root,
        projectId: options.projectId,
      })

  // Try exact match first
  const exactMatch = sessions.find((s) => s.sessionId === sessionId)
  if (exactMatch) {
    return {
      session: exactMatch,
      matchType: "exact",
      allSessions: sessions,
    }
  }

  // Try prefix match if allowed
  if (options.allowPrefix) {
    const prefixMatches = findSessionsByPrefix(sessions, sessionId)

    if (prefixMatches.length === 1) {
      return {
        session: prefixMatches[0],
        matchType: "prefix",
        allSessions: sessions,
      }
    }

    if (prefixMatches.length > 1) {
      throw new NotFoundError(
        `Ambiguous session ID prefix "${sessionId}" matches ${prefixMatches.length} sessions: ${prefixMatches
          .slice(0, 3)
          .map((s) => s.sessionId)
          .join(", ")}${prefixMatches.length > 3 ? "..." : ""}`,
        "session"
      )
    }
  }

  // No match found
  sessionNotFound(sessionId)
}

// ========================
// Project Resolution
// ========================

/**
 * Options for resolving project IDs.
 */
export interface ResolveProjectOptions extends LoadOptions {
  /**
   * If true, allow partial prefix matching when exact match fails.
   * Requires the prefix to match exactly one project uniquely.
   * Defaults to false.
   */
  allowPrefix?: boolean

  /**
   * Optional data provider for backend-agnostic data loading.
   * When provided, uses the provider's loadProjectRecords method.
   * When omitted, falls back to direct JSONL loading for backward compatibility.
   */
  provider?: DataProvider
}

/**
 * Result of a project resolution attempt.
 */
export interface ResolveProjectResult {
  project: ProjectRecord
  /** How the project was matched */
  matchType: "exact" | "prefix"
  /** All projects that were loaded (for reuse) */
  allProjects: ProjectRecord[]
}

/**
 * Find a project by exact ID from a pre-loaded list of projects.
 *
 * @param projects - Pre-loaded project records
 * @param projectId - Project ID to find
 * @returns The matching project
 * @throws NotFoundError if project doesn't exist
 */
export function findProjectById(
  projects: ProjectRecord[],
  projectId: string
): ProjectRecord {
  const project = projects.find((p) => p.projectId === projectId)
  if (!project) {
    projectNotFound(projectId)
  }
  return project
}

/**
 * Find projects matching a prefix from a pre-loaded list.
 *
 * @param projects - Pre-loaded project records
 * @param prefix - Project ID prefix to match
 * @returns Array of matching projects
 */
export function findProjectsByPrefix(
  projects: ProjectRecord[],
  prefix: string
): ProjectRecord[] {
  return projects.filter((p) => p.projectId.startsWith(prefix))
}

/**
 * Resolve a project ID to a project record, loading data as needed.
 *
 * Supports exact matching and optional prefix matching.
 *
 * @param projectId - Project ID or prefix to resolve
 * @param options - Resolution options including root and optional provider
 * @returns Resolution result with project and metadata
 * @throws NotFoundError if no project matches
 * @throws NotFoundError if prefix matches multiple projects (ambiguous)
 */
export async function resolveProjectId(
  projectId: string,
  options: ResolveProjectOptions = {}
): Promise<ResolveProjectResult> {
  // Use provider if available, otherwise fall back to direct JSONL loading
  const projects = options.provider
    ? await options.provider.loadProjectRecords()
    : await loadProjectRecords({
        root: options.root,
      })

  // Try exact match first
  const exactMatch = projects.find((p) => p.projectId === projectId)
  if (exactMatch) {
    return {
      project: exactMatch,
      matchType: "exact",
      allProjects: projects,
    }
  }

  // Try prefix match if allowed
  if (options.allowPrefix) {
    const prefixMatches = findProjectsByPrefix(projects, projectId)

    if (prefixMatches.length === 1) {
      return {
        project: prefixMatches[0],
        matchType: "prefix",
        allProjects: projects,
      }
    }

    if (prefixMatches.length > 1) {
      throw new NotFoundError(
        `Ambiguous project ID prefix "${projectId}" matches ${prefixMatches.length} projects: ${prefixMatches
          .slice(0, 3)
          .map((p) => p.projectId)
          .join(", ")}${prefixMatches.length > 3 ? "..." : ""}`,
        "project"
      )
    }
  }

  // No match found
  projectNotFound(projectId)
}
