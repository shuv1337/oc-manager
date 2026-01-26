/**
 * Tests for CLI resolver helpers.
 *
 * Verifies session and project ID resolution with exact and prefix matching.
 * Also tests DataProvider integration for backend-agnostic resolution.
 */

import { describe, expect, it } from "bun:test"
import { FIXTURE_STORE_ROOT, FIXTURE_SQLITE_PATH } from "../helpers"
import {
  findSessionById,
  findSessionsByPrefix,
  resolveSessionId,
  findProjectById,
  findProjectsByPrefix,
  resolveProjectId,
} from "../../src/cli/resolvers"
import { NotFoundError } from "../../src/cli/errors"
import {
  loadSessionRecords,
  loadProjectRecords,
  type SessionRecord,
  type ProjectRecord,
} from "../../src/lib/opencode-data"
import { createProvider } from "../../src/lib/opencode-data-provider"

// ========================
// Session Resolution Tests
// ========================

describe("findSessionById", () => {
  it("should find a session by exact ID", async () => {
    const sessions = await loadSessionRecords({ root: FIXTURE_STORE_ROOT })
    const session = findSessionById(sessions, "session_add_tests")

    expect(session).toBeDefined()
    expect(session.sessionId).toBe("session_add_tests")
  })

  it("should throw NotFoundError for non-existent session ID", async () => {
    const sessions = await loadSessionRecords({ root: FIXTURE_STORE_ROOT })

    expect(() => findSessionById(sessions, "nonexistent_session")).toThrow(NotFoundError)
  })

  it("should include session ID in error message", async () => {
    const sessions = await loadSessionRecords({ root: FIXTURE_STORE_ROOT })

    try {
      findSessionById(sessions, "nonexistent_session")
    } catch (error) {
      expect((error as NotFoundError).message).toContain("nonexistent_session")
      expect((error as NotFoundError).resourceType).toBe("session")
    }
  })
})

describe("findSessionsByPrefix", () => {
  it("should find sessions matching a prefix", async () => {
    const sessions = await loadSessionRecords({ root: FIXTURE_STORE_ROOT })
    const matches = findSessionsByPrefix(sessions, "session_")

    expect(matches.length).toBe(2)
    expect(matches.every((s) => s.sessionId.startsWith("session_"))).toBe(true)
  })

  it("should return empty array when no sessions match prefix", async () => {
    const sessions = await loadSessionRecords({ root: FIXTURE_STORE_ROOT })
    const matches = findSessionsByPrefix(sessions, "zzz_nonexistent_")

    expect(matches).toBeArray()
    expect(matches.length).toBe(0)
  })

  it("should return single match for unique prefix", async () => {
    const sessions = await loadSessionRecords({ root: FIXTURE_STORE_ROOT })
    const matches = findSessionsByPrefix(sessions, "session_add")

    expect(matches.length).toBe(1)
    expect(matches[0].sessionId).toBe("session_add_tests")
  })
})

describe("resolveSessionId", () => {
  it("should resolve session by exact ID", async () => {
    const result = await resolveSessionId("session_add_tests", {
      root: FIXTURE_STORE_ROOT,
    })

    expect(result.session.sessionId).toBe("session_add_tests")
    expect(result.matchType).toBe("exact")
    expect(result.allSessions.length).toBeGreaterThan(0)
  })

  it("should throw NotFoundError when session doesn't exist", async () => {
    await expect(
      resolveSessionId("nonexistent_session", { root: FIXTURE_STORE_ROOT })
    ).rejects.toThrow(NotFoundError)
  })

  it("should resolve session by prefix when allowPrefix is true", async () => {
    const result = await resolveSessionId("session_add", {
      root: FIXTURE_STORE_ROOT,
      allowPrefix: true,
    })

    expect(result.session.sessionId).toBe("session_add_tests")
    expect(result.matchType).toBe("prefix")
  })

  it("should throw NotFoundError for ambiguous prefix", async () => {
    // "session_" prefix matches multiple sessions
    await expect(
      resolveSessionId("session_", {
        root: FIXTURE_STORE_ROOT,
        allowPrefix: true,
      })
    ).rejects.toThrow(NotFoundError)
  })

  it("should include ambiguous matches in error message", async () => {
    try {
      await resolveSessionId("session_", {
        root: FIXTURE_STORE_ROOT,
        allowPrefix: true,
      })
    } catch (error) {
      const message = (error as NotFoundError).message
      expect(message).toContain("Ambiguous")
      expect(message).toContain("session_")
    }
  })

  it("should prefer exact match over prefix match", async () => {
    const result = await resolveSessionId("session_add_tests", {
      root: FIXTURE_STORE_ROOT,
      allowPrefix: true,
    })

    expect(result.matchType).toBe("exact")
  })

  it("should filter by projectId when provided", async () => {
    const result = await resolveSessionId("session_add_tests", {
      root: FIXTURE_STORE_ROOT,
      projectId: "proj_present",
    })

    expect(result.session.sessionId).toBe("session_add_tests")
    expect(result.session.projectId).toBe("proj_present")
  })

  it("should throw NotFoundError when session exists but in different project", async () => {
    await expect(
      resolveSessionId("session_add_tests", {
        root: FIXTURE_STORE_ROOT,
        projectId: "nonexistent_project",
      })
    ).rejects.toThrow(NotFoundError)
  })

  it("should return all loaded sessions for reuse", async () => {
    const result = await resolveSessionId("session_add_tests", {
      root: FIXTURE_STORE_ROOT,
    })

    expect(result.allSessions).toBeArray()
    expect(result.allSessions.length).toBeGreaterThan(0)
    expect(result.allSessions.every((s) => "sessionId" in s)).toBe(true)
  })
})

// ========================
// Project Resolution Tests
// ========================

describe("findProjectById", () => {
  it("should find a project by exact ID", async () => {
    const projects = await loadProjectRecords({ root: FIXTURE_STORE_ROOT })
    const project = findProjectById(projects, "proj_present")

    expect(project).toBeDefined()
    expect(project.projectId).toBe("proj_present")
  })

  it("should throw NotFoundError for non-existent project ID", async () => {
    const projects = await loadProjectRecords({ root: FIXTURE_STORE_ROOT })

    expect(() => findProjectById(projects, "nonexistent_project")).toThrow(NotFoundError)
  })

  it("should include project ID in error message", async () => {
    const projects = await loadProjectRecords({ root: FIXTURE_STORE_ROOT })

    try {
      findProjectById(projects, "nonexistent_project")
    } catch (error) {
      expect((error as NotFoundError).message).toContain("nonexistent_project")
      expect((error as NotFoundError).resourceType).toBe("project")
    }
  })
})

describe("findProjectsByPrefix", () => {
  it("should find projects matching a prefix", async () => {
    const projects = await loadProjectRecords({ root: FIXTURE_STORE_ROOT })
    const matches = findProjectsByPrefix(projects, "proj_")

    expect(matches.length).toBe(2)
    expect(matches.every((p) => p.projectId.startsWith("proj_"))).toBe(true)
  })

  it("should return empty array when no projects match prefix", async () => {
    const projects = await loadProjectRecords({ root: FIXTURE_STORE_ROOT })
    const matches = findProjectsByPrefix(projects, "zzz_nonexistent_")

    expect(matches).toBeArray()
    expect(matches.length).toBe(0)
  })

  it("should return single match for unique prefix", async () => {
    const projects = await loadProjectRecords({ root: FIXTURE_STORE_ROOT })
    const matches = findProjectsByPrefix(projects, "proj_pres")

    expect(matches.length).toBe(1)
    expect(matches[0].projectId).toBe("proj_present")
  })
})

describe("resolveProjectId", () => {
  it("should resolve project by exact ID", async () => {
    const result = await resolveProjectId("proj_present", {
      root: FIXTURE_STORE_ROOT,
    })

    expect(result.project.projectId).toBe("proj_present")
    expect(result.matchType).toBe("exact")
    expect(result.allProjects.length).toBeGreaterThan(0)
  })

  it("should throw NotFoundError when project doesn't exist", async () => {
    await expect(
      resolveProjectId("nonexistent_project", { root: FIXTURE_STORE_ROOT })
    ).rejects.toThrow(NotFoundError)
  })

  it("should resolve project by prefix when allowPrefix is true", async () => {
    const result = await resolveProjectId("proj_pres", {
      root: FIXTURE_STORE_ROOT,
      allowPrefix: true,
    })

    expect(result.project.projectId).toBe("proj_present")
    expect(result.matchType).toBe("prefix")
  })

  it("should throw NotFoundError for ambiguous prefix", async () => {
    // "proj_" prefix matches multiple projects
    await expect(
      resolveProjectId("proj_", {
        root: FIXTURE_STORE_ROOT,
        allowPrefix: true,
      })
    ).rejects.toThrow(NotFoundError)
  })

  it("should include ambiguous matches in error message", async () => {
    try {
      await resolveProjectId("proj_", {
        root: FIXTURE_STORE_ROOT,
        allowPrefix: true,
      })
    } catch (error) {
      const message = (error as NotFoundError).message
      expect(message).toContain("Ambiguous")
      expect(message).toContain("proj_")
    }
  })

  it("should prefer exact match over prefix match", async () => {
    const result = await resolveProjectId("proj_present", {
      root: FIXTURE_STORE_ROOT,
      allowPrefix: true,
    })

    expect(result.matchType).toBe("exact")
  })

  it("should return all loaded projects for reuse", async () => {
    const result = await resolveProjectId("proj_present", {
      root: FIXTURE_STORE_ROOT,
    })

    expect(result.allProjects).toBeArray()
    expect(result.allProjects.length).toBeGreaterThan(0)
    expect(result.allProjects.every((p) => "projectId" in p)).toBe(true)
  })
})

// ========================
// Edge Cases
// ========================

describe("Edge cases", () => {
  it("should handle empty session list gracefully", () => {
    const sessions: SessionRecord[] = []
    expect(() => findSessionById(sessions, "any")).toThrow(NotFoundError)
  })

  it("should handle empty project list gracefully", () => {
    const projects: ProjectRecord[] = []
    expect(() => findProjectById(projects, "any")).toThrow(NotFoundError)
  })

  it("should handle prefix that is entire session ID", async () => {
    const result = await resolveSessionId("session_add_tests", {
      root: FIXTURE_STORE_ROOT,
      allowPrefix: true,
    })

    // Exact match should take precedence
    expect(result.matchType).toBe("exact")
  })

  it("should handle prefix that is entire project ID", async () => {
    const result = await resolveProjectId("proj_present", {
      root: FIXTURE_STORE_ROOT,
      allowPrefix: true,
    })

    // Exact match should take precedence
    expect(result.matchType).toBe("exact")
  })

  it("should not do prefix matching when allowPrefix is false", async () => {
    // "session_add" is a valid prefix but should not match
    await expect(
      resolveSessionId("session_add", {
        root: FIXTURE_STORE_ROOT,
        allowPrefix: false,
      })
    ).rejects.toThrow(NotFoundError)
  })

  it("should not do prefix matching by default", async () => {
    // "proj_pres" is a valid prefix but should not match
    await expect(
      resolveProjectId("proj_pres", {
        root: FIXTURE_STORE_ROOT,
      })
    ).rejects.toThrow(NotFoundError)
  })
})

// ========================
// DataProvider Integration Tests
// ========================

describe("resolveSessionId with DataProvider", () => {
  it("should resolve session using JSONL provider", async () => {
    const provider = createProvider({ backend: "jsonl", root: FIXTURE_STORE_ROOT })

    const result = await resolveSessionId("session_add_tests", {
      provider,
    })

    expect(result.session.sessionId).toBe("session_add_tests")
    expect(result.matchType).toBe("exact")
  })

  it("should resolve session using SQLite provider", async () => {
    const provider = createProvider({ backend: "sqlite", dbPath: FIXTURE_SQLITE_PATH })

    const result = await resolveSessionId("session_add_tests", {
      provider,
    })

    expect(result.session.sessionId).toBe("session_add_tests")
    expect(result.matchType).toBe("exact")
  })

  it("should support prefix matching with provider", async () => {
    const provider = createProvider({ backend: "sqlite", dbPath: FIXTURE_SQLITE_PATH })

    const result = await resolveSessionId("session_add", {
      provider,
      allowPrefix: true,
    })

    expect(result.session.sessionId).toBe("session_add_tests")
    expect(result.matchType).toBe("prefix")
  })

  it("should throw NotFoundError with provider for non-existent session", async () => {
    const provider = createProvider({ backend: "sqlite", dbPath: FIXTURE_SQLITE_PATH })

    await expect(
      resolveSessionId("nonexistent_session", { provider })
    ).rejects.toThrow(NotFoundError)
  })
})

describe("resolveProjectId with DataProvider", () => {
  it("should resolve project using JSONL provider", async () => {
    const provider = createProvider({ backend: "jsonl", root: FIXTURE_STORE_ROOT })

    const result = await resolveProjectId("proj_present", {
      provider,
    })

    expect(result.project.projectId).toBe("proj_present")
    expect(result.matchType).toBe("exact")
  })

  it("should resolve project using SQLite provider", async () => {
    const provider = createProvider({ backend: "sqlite", dbPath: FIXTURE_SQLITE_PATH })

    const result = await resolveProjectId("proj_present", {
      provider,
    })

    expect(result.project.projectId).toBe("proj_present")
    expect(result.matchType).toBe("exact")
  })

  it("should support prefix matching with provider", async () => {
    const provider = createProvider({ backend: "sqlite", dbPath: FIXTURE_SQLITE_PATH })

    const result = await resolveProjectId("proj_pres", {
      provider,
      allowPrefix: true,
    })

    expect(result.project.projectId).toBe("proj_present")
    expect(result.matchType).toBe("prefix")
  })

  it("should throw NotFoundError with provider for non-existent project", async () => {
    const provider = createProvider({ backend: "sqlite", dbPath: FIXTURE_SQLITE_PATH })

    await expect(
      resolveProjectId("nonexistent_project", { provider })
    ).rejects.toThrow(NotFoundError)
  })
})
