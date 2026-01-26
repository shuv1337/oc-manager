import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Database } from "bun:sqlite"
import { existsSync, unlinkSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { FIXTURE_STORE_ROOT, FIXTURE_SQLITE_PATH } from "../helpers"
import {
  createProvider,
  createProviderFromGlobalOptions,
  type StorageBackend,
  type DataProvider,
} from "../../src/lib/opencode-data-provider"

describe("opencode-data-provider", () => {
  const testDir = "/tmp/oc-manager-provider-tests"
  const testDbPath = join(testDir, "test.db")

  // Setup test directory
  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true })
    }
  })

  afterEach(() => {
    // Clean up test database after each test
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath)
    }
  })

  /**
   * Helper to create a minimal SQLite test database with required schema.
   */
  function createTestDatabase(path: string): void {
    const db = new Database(path)
    db.run(`
      CREATE TABLE IF NOT EXISTS project (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      )
    `)
    db.run(`
      CREATE TABLE IF NOT EXISTS session (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        parent_id TEXT,
        created_at INTEGER,
        updated_at INTEGER,
        data TEXT NOT NULL
      )
    `)
    db.run(`
      CREATE TABLE IF NOT EXISTS message (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        created_at INTEGER,
        data TEXT NOT NULL
      )
    `)
    db.run(`
      CREATE TABLE IF NOT EXISTS part (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        data TEXT NOT NULL
      )
    `)
    db.close()
  }

  describe("createProvider", () => {
    test("returns JSONL provider by default", () => {
      const provider = createProvider()

      expect(provider).toBeDefined()
      expect(provider.backend).toBe("jsonl")

      // Verify it has all expected methods
      expect(typeof provider.loadProjectRecords).toBe("function")
      expect(typeof provider.loadSessionRecords).toBe("function")
      expect(typeof provider.loadSessionChatIndex).toBe("function")
      expect(typeof provider.loadMessageParts).toBe("function")
      expect(typeof provider.hydrateChatMessageParts).toBe("function")
      expect(typeof provider.deleteProjectMetadata).toBe("function")
      expect(typeof provider.deleteSessionMetadata).toBe("function")
      expect(typeof provider.updateSessionTitle).toBe("function")
      expect(typeof provider.moveSession).toBe("function")
      expect(typeof provider.copySession).toBe("function")
      expect(typeof provider.computeSessionTokenSummary).toBe("function")
      expect(typeof provider.computeProjectTokenSummary).toBe("function")
      expect(typeof provider.computeGlobalTokenSummary).toBe("function")
      expect(typeof provider.searchSessionsChat).toBe("function")
    })

    test("returns JSONL provider when backend is explicitly 'jsonl'", () => {
      const provider = createProvider({ backend: "jsonl" })

      expect(provider.backend).toBe("jsonl")
    })

    test("returns SQLite provider when backend is 'sqlite'", () => {
      // Create test database for SQLite provider
      createTestDatabase(testDbPath)

      const provider = createProvider({
        backend: "sqlite",
        dbPath: testDbPath,
      })

      expect(provider).toBeDefined()
      expect(provider.backend).toBe("sqlite")

      // Verify it has all expected methods
      expect(typeof provider.loadProjectRecords).toBe("function")
      expect(typeof provider.loadSessionRecords).toBe("function")
      expect(typeof provider.loadSessionChatIndex).toBe("function")
      expect(typeof provider.loadMessageParts).toBe("function")
    })

    test("SQLite provider uses default path when dbPath not provided", () => {
      // This test verifies the provider is created (may fail at runtime
      // if default path doesn't exist, but that's expected behavior)
      const provider = createProvider({ backend: "sqlite" })

      expect(provider).toBeDefined()
      expect(provider.backend).toBe("sqlite")
    })

    test("JSONL provider uses custom root when provided", async () => {
      const customRoot = "/tmp/custom-opencode-root"
      const provider = createProvider({ backend: "jsonl", root: customRoot })

      expect(provider.backend).toBe("jsonl")
      // The provider will use the custom root for data loading
      // (actual data loading would fail since directory doesn't exist,
      // but the provider is correctly configured)
    })

    test("throws on invalid backend value", () => {
      expect(() => {
        createProvider({ backend: "invalid" as StorageBackend })
      }).toThrow('Invalid storage backend: "invalid". Must be "jsonl" or "sqlite".')
    })
  })

  describe("createProviderFromGlobalOptions", () => {
    test("returns JSONL provider when experimentalSqlite is false", () => {
      const provider = createProviderFromGlobalOptions({
        experimentalSqlite: false,
      })

      expect(provider.backend).toBe("jsonl")
    })

    test("returns JSONL provider when no SQLite options provided", () => {
      const provider = createProviderFromGlobalOptions({})

      expect(provider.backend).toBe("jsonl")
    })

    test("returns SQLite provider when experimentalSqlite is true", () => {
      const provider = createProviderFromGlobalOptions({
        experimentalSqlite: true,
      })

      expect(provider.backend).toBe("sqlite")
    })

    test("returns SQLite provider when dbPath is provided", () => {
      createTestDatabase(testDbPath)

      const provider = createProviderFromGlobalOptions({
        dbPath: testDbPath,
      })

      expect(provider.backend).toBe("sqlite")
    })

    test("dbPath takes precedence over experimentalSqlite: false", () => {
      createTestDatabase(testDbPath)

      // Even if experimentalSqlite is false, providing dbPath should use SQLite
      const provider = createProviderFromGlobalOptions({
        experimentalSqlite: false,
        dbPath: testDbPath,
      })

      expect(provider.backend).toBe("sqlite")
    })

    test("uses custom root for JSONL provider", () => {
      const customRoot = "/tmp/custom-root"
      const provider = createProviderFromGlobalOptions({
        root: customRoot,
        experimentalSqlite: false,
      })

      expect(provider.backend).toBe("jsonl")
    })
  })

  describe("DataProvider interface compliance", () => {
    test("JSONL provider implements all DataProvider methods", () => {
      const provider = createProvider({ backend: "jsonl" })

      // All required methods from DataProvider interface
      const requiredMethods = [
        "loadProjectRecords",
        "loadSessionRecords",
        "loadSessionChatIndex",
        "loadMessageParts",
        "hydrateChatMessageParts",
        "deleteProjectMetadata",
        "deleteSessionMetadata",
        "updateSessionTitle",
        "moveSession",
        "copySession",
        "computeSessionTokenSummary",
        "computeProjectTokenSummary",
        "computeGlobalTokenSummary",
        "searchSessionsChat",
      ]

      for (const method of requiredMethods) {
        expect(typeof (provider as unknown as Record<string, unknown>)[method]).toBe("function")
      }
    })

    test("SQLite provider implements all DataProvider methods", () => {
      createTestDatabase(testDbPath)

      const provider = createProvider({ backend: "sqlite", dbPath: testDbPath })

      // All required methods from DataProvider interface
      const requiredMethods = [
        "loadProjectRecords",
        "loadSessionRecords",
        "loadSessionChatIndex",
        "loadMessageParts",
        "hydrateChatMessageParts",
        "deleteProjectMetadata",
        "deleteSessionMetadata",
        "updateSessionTitle",
        "moveSession",
        "copySession",
        "computeSessionTokenSummary",
        "computeProjectTokenSummary",
        "computeGlobalTokenSummary",
        "searchSessionsChat",
      ]

      for (const method of requiredMethods) {
        expect(typeof (provider as unknown as Record<string, unknown>)[method]).toBe("function")
      }
    })

    test("both providers have backend property", () => {
      const jsonlProvider = createProvider({ backend: "jsonl" })
      createTestDatabase(testDbPath)
      const sqliteProvider = createProvider({ backend: "sqlite", dbPath: testDbPath })

      expect(jsonlProvider.backend).toBe("jsonl")
      expect(sqliteProvider.backend).toBe("sqlite")
    })
  })

  describe("SQLite provider write operations", () => {
    test("deleteProjectMetadata works for SQLite backend", async () => {
      createTestDatabase(testDbPath)
      const provider = createProvider({ backend: "sqlite", dbPath: testDbPath })

      // Empty input should return empty result
      const result = await provider.deleteProjectMetadata([])
      expect(result.removed).toHaveLength(0)
      expect(result.failed).toHaveLength(0)
    })

    test("deleteSessionMetadata works for SQLite backend", async () => {
      createTestDatabase(testDbPath)
      const provider = createProvider({ backend: "sqlite", dbPath: testDbPath })

      // Empty input should return empty result
      const result = await provider.deleteSessionMetadata([])
      expect(result.removed).toHaveLength(0)
      expect(result.failed).toHaveLength(0)
    })

    test("updateSessionTitle works for SQLite backend", async () => {
      createTestDatabase(testDbPath)
      
      // Insert a test session
      const db = new Database(testDbPath)
      const sessionData = { id: "test_update", projectID: "proj", title: "Original Title", time: { created: Date.now() } }
      db.run(
        "INSERT INTO session (id, project_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?)",
        ["test_update", "proj", Date.now(), Date.now(), JSON.stringify(sessionData)]
      )
      db.close()
      
      const provider = createProvider({ backend: "sqlite", dbPath: testDbPath })

      const mockSession = {
        sessionId: "test_update",
        projectId: "proj",
        directory: "/tmp",
        title: "Original Title",
        version: "1.0",
        createdAt: new Date(),
        updatedAt: new Date(),
        index: 1,
        filePath: "sqlite:session:test_update",
      }

      // Should not throw - it's now implemented
      await provider.updateSessionTitle(mockSession, "New Title")
      
      // Verify the title was updated
      const verifyDb = new Database(testDbPath, { readonly: true })
      const row = verifyDb.query("SELECT data FROM session WHERE id = ?").get("test_update") as { data: string }
      const data = JSON.parse(row.data)
      expect(data.title).toBe("New Title")
      verifyDb.close()
    })

    test("moveSession works for SQLite backend", async () => {
      // Create test database with a session to move
      const db = new Database(testDbPath)
      db.run(`
        CREATE TABLE session (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          parent_id TEXT,
          created_at INTEGER,
          updated_at INTEGER,
          data TEXT NOT NULL
        )
      `)
      const sessionData = { id: "test_move", projectID: "proj_source", title: "Test" }
      db.run(
        "INSERT INTO session (id, project_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?)",
        ["test_move", "proj_source", Date.now(), Date.now(), JSON.stringify(sessionData)]
      )
      db.close()

      const provider = createProvider({ backend: "sqlite", dbPath: testDbPath })

      const mockSession = {
        sessionId: "test_move",
        projectId: "proj_source",
        directory: "/tmp",
        title: "Test",
        version: "1.0",
        createdAt: new Date(),
        updatedAt: new Date(),
        index: 1,
        filePath: "/tmp/test",
      }

      const result = await provider.moveSession(mockSession, "proj_target")

      // Verify returned record has new project ID
      expect(result.sessionId).toBe("test_move")
      expect(result.projectId).toBe("proj_target")

      // Verify the session was moved in database
      const verifyDb = new Database(testDbPath, { readonly: true })
      const row = verifyDb.query("SELECT project_id, data FROM session WHERE id = ?").get("test_move") as { 
        project_id: string
        data: string 
      }
      expect(row.project_id).toBe("proj_target")
      const data = JSON.parse(row.data)
      expect(data.projectID).toBe("proj_target")
      verifyDb.close()
    })

    test("copySession works for SQLite backend", async () => {
      createTestDatabase(testDbPath)
      const db = new Database(testDbPath)

      // Insert a session to copy
      const sessionData = {
        id: "sess_provider_copy",
        projectID: "proj_source",
        title: "Provider Copy Test"
      }
      db.run(
        "INSERT INTO session (id, project_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?)",
        ["sess_provider_copy", "proj_source", Date.now(), Date.now(), JSON.stringify(sessionData)]
      )
      db.close()

      const provider = createProvider({ backend: "sqlite", dbPath: testDbPath })

      const mockSession = {
        sessionId: "sess_provider_copy",
        projectId: "proj_source",
        directory: "/tmp",
        title: "Provider Copy Test",
        version: "1.0",
        createdAt: new Date(),
        updatedAt: new Date(),
        index: 1,
        filePath: "sqlite:session:sess_provider_copy",
      }

      const result = await provider.copySession(mockSession, "proj_target")

      // Verify the copy was created
      expect(result.sessionId).not.toBe("sess_provider_copy")
      expect(result.sessionId).toMatch(/^session_\d+_[a-z0-9]+$/)
      expect(result.projectId).toBe("proj_target")
      expect(result.title).toBe("Provider Copy Test")

      // Verify both sessions exist in database
      const verifyDb = new Database(testDbPath, { readonly: true })
      const sessionCount = verifyDb.query("SELECT COUNT(*) as count FROM session").get() as any
      expect(sessionCount.count).toBe(2) // Original + copy
      verifyDb.close()
    })
  })

  describe("token summary parity (JSONL vs SQLite)", () => {
    test("computeSessionTokenSummary matches for shared session", async () => {
      const jsonlProvider = createProvider({ backend: "jsonl", root: FIXTURE_STORE_ROOT })
      const sqliteProvider = createProvider({ backend: "sqlite", dbPath: FIXTURE_SQLITE_PATH })

      const sessionId = "session_add_tests"
      const jsonlSessions = await jsonlProvider.loadSessionRecords({ projectId: "proj_present" })
      const sqliteSessions = await sqliteProvider.loadSessionRecords({ projectId: "proj_present" })

      const jsonlSession = jsonlSessions.find((s) => s.sessionId === sessionId)
      const sqliteSession = sqliteSessions.find((s) => s.sessionId === sessionId)

      expect(jsonlSession).toBeDefined()
      expect(sqliteSession).toBeDefined()

      const jsonlSummary = await jsonlProvider.computeSessionTokenSummary(jsonlSession!)
      const sqliteSummary = await sqliteProvider.computeSessionTokenSummary(sqliteSession!)

      expect(sqliteSummary).toEqual(jsonlSummary)
    })

  })
})
