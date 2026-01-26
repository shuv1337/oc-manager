import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Database } from "bun:sqlite"
import { existsSync, unlinkSync, mkdirSync, rmdirSync } from "node:fs"
import { join } from "node:path"
import {
  DEFAULT_SQLITE_PATH,
  openDatabase,
  closeIfOwned,
  validateSchema,
  loadProjectRecordsSqlite,
  loadSessionRecordsSqlite,
  loadSessionChatIndexSqlite,
  loadMessagePartsSqlite,
  deleteSessionMetadataSqlite,
  deleteProjectMetadataSqlite,
  updateSessionTitleSqlite,
  moveSessionSqlite,
  copySessionSqlite,
} from "../../src/lib/opencode-data-sqlite"

describe("opencode-data-sqlite", () => {
  const testDir = "/tmp/oc-manager-sqlite-tests"
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

  describe("DEFAULT_SQLITE_PATH", () => {
    test("is defined and points to opencode.db in user data directory", () => {
      expect(DEFAULT_SQLITE_PATH).toBeDefined()
      expect(DEFAULT_SQLITE_PATH).toContain("opencode")
      expect(DEFAULT_SQLITE_PATH).toEndWith("opencode.db")
    })
  })

  describe("openDatabase", () => {
    test("opens database from path string", () => {
      // Create a test database first
      const setupDb = new Database(testDbPath)
      setupDb.run("CREATE TABLE test (id INTEGER)")
      setupDb.close()

      // Now test openDatabase
      const db = openDatabase(testDbPath)
      expect(db).toBeDefined()
      expect(db).toBeInstanceOf(Database)

      // Verify it's actually connected
      const rows = db.query("SELECT * FROM test").all()
      expect(rows).toBeArray()

      db.close()
    })

    test("returns existing Database instance unchanged", () => {
      const existingDb = new Database(":memory:")
      existingDb.run("CREATE TABLE test (id INTEGER)")

      const result = openDatabase(existingDb)

      // Should return the exact same instance
      expect(result).toBe(existingDb)

      // Should still work
      existingDb.run("INSERT INTO test (id) VALUES (1)")
      const rows = existingDb.query("SELECT * FROM test").all()
      expect(rows).toHaveLength(1)

      existingDb.close()
    })

    test("opens database in readonly mode by default", () => {
      // Create a test database first
      const setupDb = new Database(testDbPath)
      setupDb.run("CREATE TABLE test (id INTEGER)")
      setupDb.close()

      // Open via openDatabase (readonly by default)
      const db = openDatabase(testDbPath)

      // Reads should work
      const rows = db.query("SELECT * FROM test").all()
      expect(rows).toBeArray()

      // Writes should fail
      expect(() => {
        db.run("INSERT INTO test (id) VALUES (1)")
      }).toThrow()

      db.close()
    })

    test("can open database in read-write mode when specified", () => {
      // Create a test database first
      const setupDb = new Database(testDbPath)
      setupDb.run("CREATE TABLE test (id INTEGER)")
      setupDb.close()

      // Open in read-write mode
      const db = openDatabase(testDbPath, { readonly: false })

      // Writes should work
      db.run("INSERT INTO test (id) VALUES (1)")
      const rows = db.query("SELECT * FROM test").all()
      expect(rows).toHaveLength(1)

      db.close()
    })

    test("throws clear error for missing file", () => {
      const missingPath = join(testDir, "does-not-exist.db")

      expect(() => {
        openDatabase(missingPath)
      }).toThrow(/Failed to open SQLite database/)
      expect(() => {
        openDatabase(missingPath)
      }).toThrow(missingPath)
    })
  })

  describe("closeIfOwned", () => {
    test("closes database when original input was a path string", () => {
      // Create a test database
      const setupDb = new Database(testDbPath)
      setupDb.run("CREATE TABLE test (id INTEGER)")
      setupDb.close()

      // Open via path
      const db = openDatabase(testDbPath)

      // closeIfOwned should close it
      closeIfOwned(db, testDbPath)

      // Database should now be closed - operations should throw
      expect(() => {
        db.query("SELECT * FROM test").all()
      }).toThrow()
    })

    test("does NOT close database when original input was a Database instance", () => {
      const existingDb = new Database(":memory:")
      existingDb.run("CREATE TABLE test (id INTEGER)")

      const db = openDatabase(existingDb)

      // closeIfOwned should NOT close it since we passed a Database instance
      closeIfOwned(db, existingDb)

      // Database should still be usable
      existingDb.run("INSERT INTO test (id) VALUES (1)")
      const rows = existingDb.query("SELECT * FROM test").all()
      expect(rows).toHaveLength(1)

      // Clean up
      existingDb.close()
    })
  })

  describe("validateSchema", () => {
    function createFullSchemaDb(): Database {
      const db = new Database(":memory:")
      db.run(`CREATE TABLE project (id TEXT PRIMARY KEY, data TEXT NOT NULL)`)
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
      db.run(`
        CREATE TABLE message (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          created_at INTEGER,
          data TEXT NOT NULL
        )
      `)
      db.run(`
        CREATE TABLE part (
          id TEXT PRIMARY KEY,
          message_id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          data TEXT NOT NULL
        )
      `)
      return db
    }

    test("returns true for valid schema", () => {
      const db = createFullSchemaDb()
      expect(validateSchema(db)).toBe(true)
      db.close()
    })

    test("returns false for missing table", () => {
      const db = new Database(":memory:")
      db.run(`CREATE TABLE project (id TEXT PRIMARY KEY, data TEXT NOT NULL)`)
      expect(validateSchema(db)).toBe(false)
      db.close()
    })
  })

  describe("loadProjectRecordsSqlite", () => {
    /**
     * Helper to create a test database with the project table schema.
     */
    function createTestDb(): Database {
      const db = new Database(":memory:")
      db.run(`
        CREATE TABLE project (
          id TEXT PRIMARY KEY,
          data TEXT NOT NULL
        )
      `)
      return db
    }

    test("returns empty array for empty DB", async () => {
      const db = createTestDb()
      
      const records = await loadProjectRecordsSqlite({ db, onWarning: () => {} })
      
      expect(records).toBeArray()
      expect(records).toHaveLength(0)
      
      db.close()
    })

    test("logs warning for malformed JSON and returns partial results", async () => {
      const db = createTestDb()
      const warnings: string[] = []

      db.run(
        "INSERT INTO project (id, data) VALUES (?, ?)",
        ["proj_good", JSON.stringify({ id: "proj_good", time: { created: 1700000000000 } })]
      )
      db.run(
        "INSERT INTO project (id, data) VALUES (?, ?)",
        ["proj_bad", "{not-json"]
      )

      const records = await loadProjectRecordsSqlite({
        db,
        onWarning: (warning) => warnings.push(warning),
      })

      expect(records).toHaveLength(1)
      expect(records[0].projectId).toBe("proj_good")
      expect(warnings).toHaveLength(1)
      expect(warnings[0]).toContain("Malformed JSON")

      db.close()
    })

    test("strict mode throws on malformed JSON", async () => {
      const db = createTestDb()
      db.run(
        "INSERT INTO project (id, data) VALUES (?, ?)",
        ["proj_bad", "{not-json"]
      )

      await expect(
        loadProjectRecordsSqlite({ db, strict: true })
      ).rejects.toThrow(/Malformed JSON/)

      db.close()
    })

    test("parses single project correctly", async () => {
      const db = createTestDb()
      
      const projectData = {
        id: "proj_123",
        worktree: "/tmp/test-project",
        vcs: "git",
        time: { created: 1700000000000 }
      }
      
      db.run(
        "INSERT INTO project (id, data) VALUES (?, ?)",
        ["proj_123", JSON.stringify(projectData)]
      )
      
      const records = await loadProjectRecordsSqlite({ db })
      
      expect(records).toHaveLength(1)
      expect(records[0].projectId).toBe("proj_123")
      expect(records[0].worktree).toBe("/tmp/test-project")
      expect(records[0].vcs).toBe("git")
      expect(records[0].createdAt).toBeInstanceOf(Date)
      expect(records[0].createdAt?.getTime()).toBe(1700000000000)
      expect(records[0].index).toBe(1)
      expect(records[0].bucket).toBe("project")
      expect(records[0].filePath).toContain("sqlite:project:proj_123")
      
      db.close()
    })

    test("parses multiple projects", async () => {
      const db = createTestDb()
      
      // Insert projects with different timestamps
      const projects = [
        { id: "proj_a", worktree: "/tmp/a", vcs: "git", time: { created: 1700000000000 } },
        { id: "proj_b", worktree: "/tmp/b", vcs: "git", time: { created: 1700100000000 } },
        { id: "proj_c", worktree: "/tmp/c", vcs: null, time: { created: 1700050000000 } },
      ]
      
      for (const p of projects) {
        db.run("INSERT INTO project (id, data) VALUES (?, ?)", [p.id, JSON.stringify(p)])
      }
      
      const records = await loadProjectRecordsSqlite({ db })
      
      expect(records).toHaveLength(3)
      
      // Should be sorted by createdAt descending (most recent first)
      expect(records[0].projectId).toBe("proj_b") // 1700100000000
      expect(records[1].projectId).toBe("proj_c") // 1700050000000
      expect(records[2].projectId).toBe("proj_a") // 1700000000000
      
      // Indexes should be 1-based
      expect(records[0].index).toBe(1)
      expect(records[1].index).toBe(2)
      expect(records[2].index).toBe(3)
      
      db.close()
    })

    test("handles malformed JSON in data column", async () => {
      const db = createTestDb()
      
      // Insert one valid and one malformed project
      const validProject = { id: "valid", worktree: "/tmp/valid", time: { created: 1700000000000 } }
      db.run("INSERT INTO project (id, data) VALUES (?, ?)", ["valid", JSON.stringify(validProject)])
      db.run("INSERT INTO project (id, data) VALUES (?, ?)", ["malformed", "not-valid-json{"])
      
      const records = await loadProjectRecordsSqlite({ db })
      
      // Should only return the valid project
      expect(records).toHaveLength(1)
      expect(records[0].projectId).toBe("valid")
      
      db.close()
    })

    test("handles null/missing fields gracefully", async () => {
      const db = createTestDb()
      
      // Project with minimal data
      const minimalProject = { id: "minimal" }
      db.run("INSERT INTO project (id, data) VALUES (?, ?)", ["minimal", JSON.stringify(minimalProject)])
      
      const records = await loadProjectRecordsSqlite({ db })
      
      expect(records).toHaveLength(1)
      expect(records[0].projectId).toBe("minimal")
      expect(records[0].worktree).toBe("")
      expect(records[0].vcs).toBeNull()
      expect(records[0].createdAt).toBeNull()
      expect(records[0].state).toBe("unknown")
      
      db.close()
    })

    test("expands ~ in worktree paths", async () => {
      const db = createTestDb()
      
      const projectData = {
        id: "home_project",
        worktree: "~/my-project",
        time: { created: 1700000000000 }
      }
      
      db.run("INSERT INTO project (id, data) VALUES (?, ?)", ["home_project", JSON.stringify(projectData)])
      
      const records = await loadProjectRecordsSqlite({ db })
      
      expect(records).toHaveLength(1)
      // Worktree should be expanded (not contain ~)
      expect(records[0].worktree).not.toContain("~")
      expect(records[0].worktree).toContain("my-project")
      
      db.close()
    })

    test("works with path string option", async () => {
      // Create a test database file
      const db = new Database(testDbPath)
      db.run("CREATE TABLE project (id TEXT PRIMARY KEY, data TEXT NOT NULL)")
      db.run(
        "INSERT INTO project (id, data) VALUES (?, ?)",
        ["file_proj", JSON.stringify({ id: "file_proj", worktree: "/tmp/file" })]
      )
      db.close()
      
      // Load using path string
      const records = await loadProjectRecordsSqlite({ db: testDbPath })
      
      expect(records).toHaveLength(1)
      expect(records[0].projectId).toBe("file_proj")
    })
  })

  describe("loadSessionRecordsSqlite", () => {
    /**
     * Helper to create a test database with the session table schema.
     */
    function createTestDb(): Database {
      const db = new Database(":memory:")
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
      return db
    }

    test("returns empty array for empty DB", async () => {
      const db = createTestDb()
      
      const records = await loadSessionRecordsSqlite({ db, onWarning: () => {} })
      
      expect(records).toBeArray()
      expect(records).toHaveLength(0)
      
      db.close()
    })

    test("parses single session correctly", async () => {
      const db = createTestDb()
      
      const sessionData = {
        id: "sess_123",
        projectID: "proj_456",
        directory: "/tmp/test-project",
        title: "Test Session",
        version: "1.0.0",
        time: { created: 1700000000000, updated: 1700100000000 }
      }
      
      db.run(
        "INSERT INTO session (id, project_id, parent_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?, ?)",
        ["sess_123", "proj_456", null, 1700000000000, 1700100000000, JSON.stringify(sessionData)]
      )
      
      const records = await loadSessionRecordsSqlite({ db })
      
      expect(records).toHaveLength(1)
      expect(records[0].sessionId).toBe("sess_123")
      expect(records[0].projectId).toBe("proj_456")
      expect(records[0].directory).toBe("/tmp/test-project")
      expect(records[0].title).toBe("Test Session")
      expect(records[0].version).toBe("1.0.0")
      expect(records[0].createdAt).toBeInstanceOf(Date)
      expect(records[0].createdAt?.getTime()).toBe(1700000000000)
      expect(records[0].updatedAt).toBeInstanceOf(Date)
      expect(records[0].updatedAt?.getTime()).toBe(1700100000000)
      expect(records[0].index).toBe(1)
      expect(records[0].filePath).toContain("sqlite:session:sess_123")
      
      db.close()
    })

    test("parses session with parent_id", async () => {
      const db = createTestDb()
      
      // Insert parent session
      const parentData = {
        id: "parent_sess",
        projectID: "proj_1",
        title: "Parent Session"
      }
      db.run(
        "INSERT INTO session (id, project_id, parent_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?, ?)",
        ["parent_sess", "proj_1", null, 1700000000000, 1700000000000, JSON.stringify(parentData)]
      )
      
      // Insert child session with parent_id
      const childData = {
        id: "child_sess",
        projectID: "proj_1",
        parentID: "parent_sess",
        title: "Child Session"
      }
      db.run(
        "INSERT INTO session (id, project_id, parent_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?, ?)",
        ["child_sess", "proj_1", "parent_sess", 1700100000000, 1700100000000, JSON.stringify(childData)]
      )
      
      const records = await loadSessionRecordsSqlite({ db })
      
      expect(records).toHaveLength(2)
      // Both sessions should be loaded (parent_id is stored but not exposed in SessionRecord)
      const sessionIds = records.map(r => r.sessionId)
      expect(sessionIds).toContain("parent_sess")
      expect(sessionIds).toContain("child_sess")
      
      db.close()
    })

    test("handles timestamps from columns correctly", async () => {
      const db = createTestDb()
      
      // Session with timestamps in columns but not in data JSON
      const sessionData = {
        id: "sess_timestamps",
        projectID: "proj_1",
        title: "Timestamp Test"
        // No time object in data
      }
      
      const createdMs = 1700000000000
      const updatedMs = 1700200000000
      
      db.run(
        "INSERT INTO session (id, project_id, parent_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?, ?)",
        ["sess_timestamps", "proj_1", null, createdMs, updatedMs, JSON.stringify(sessionData)]
      )
      
      const records = await loadSessionRecordsSqlite({ db })
      
      expect(records).toHaveLength(1)
      expect(records[0].createdAt?.getTime()).toBe(createdMs)
      expect(records[0].updatedAt?.getTime()).toBe(updatedMs)
      
      db.close()
    })

    test("handles null parent_id for root sessions", async () => {
      const db = createTestDb()
      
      const sessionData = {
        id: "root_sess",
        projectID: "proj_1",
        title: "Root Session"
      }
      
      db.run(
        "INSERT INTO session (id, project_id, parent_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?, ?)",
        ["root_sess", "proj_1", null, 1700000000000, 1700000000000, JSON.stringify(sessionData)]
      )
      
      const records = await loadSessionRecordsSqlite({ db })
      
      expect(records).toHaveLength(1)
      expect(records[0].sessionId).toBe("root_sess")
      // Session should load correctly despite null parent_id
      
      db.close()
    })

    test("parses multiple sessions with sorting", async () => {
      const db = createTestDb()
      
      // Insert sessions with different timestamps
      const sessions = [
        { id: "sess_a", projectID: "proj_1", title: "A", time: { created: 1700000000000, updated: 1700000000000 } },
        { id: "sess_b", projectID: "proj_1", title: "B", time: { created: 1700100000000, updated: 1700300000000 } },
        { id: "sess_c", projectID: "proj_2", title: "C", time: { created: 1700050000000, updated: 1700200000000 } },
      ]
      
      for (const s of sessions) {
        db.run(
          "INSERT INTO session (id, project_id, parent_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?, ?)",
          [s.id, s.projectID, null, s.time.created, s.time.updated, JSON.stringify(s)]
        )
      }
      
      const records = await loadSessionRecordsSqlite({ db })
      
      expect(records).toHaveLength(3)
      
      // Should be sorted by updatedAt descending (most recent first)
      expect(records[0].sessionId).toBe("sess_b") // updated: 1700300000000
      expect(records[1].sessionId).toBe("sess_c") // updated: 1700200000000
      expect(records[2].sessionId).toBe("sess_a") // updated: 1700000000000
      
      // Indexes should be 1-based
      expect(records[0].index).toBe(1)
      expect(records[1].index).toBe(2)
      expect(records[2].index).toBe(3)
      
      db.close()
    })

    test("filters sessions by projectId", async () => {
      const db = createTestDb()
      
      // Insert sessions in different projects
      const sessions = [
        { id: "sess_a", projectID: "proj_1", title: "A" },
        { id: "sess_b", projectID: "proj_1", title: "B" },
        { id: "sess_c", projectID: "proj_2", title: "C" },
      ]
      
      for (const s of sessions) {
        db.run(
          "INSERT INTO session (id, project_id, parent_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?, ?)",
          [s.id, s.projectID, null, 1700000000000, 1700000000000, JSON.stringify(s)]
        )
      }
      
      // Filter by proj_1
      const records = await loadSessionRecordsSqlite({ db, projectId: "proj_1" })
      
      expect(records).toHaveLength(2)
      const sessionIds = records.map(r => r.sessionId)
      expect(sessionIds).toContain("sess_a")
      expect(sessionIds).toContain("sess_b")
      expect(sessionIds).not.toContain("sess_c")
      
      db.close()
    })

    test("handles malformed JSON in data column", async () => {
      const db = createTestDb()
      
      // Insert one valid and one malformed session
      const validSession = { id: "valid", projectID: "proj_1", title: "Valid" }
      db.run(
        "INSERT INTO session (id, project_id, parent_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?, ?)",
        ["valid", "proj_1", null, 1700000000000, 1700000000000, JSON.stringify(validSession)]
      )
      db.run(
        "INSERT INTO session (id, project_id, parent_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?, ?)",
        ["malformed", "proj_1", null, 1700000000000, 1700000000000, "not-valid-json{"]
      )
      
      const records = await loadSessionRecordsSqlite({ db })
      
      // Should only return the valid session
      expect(records).toHaveLength(1)
      expect(records[0].sessionId).toBe("valid")
      
      db.close()
    })

    test("handles null/missing fields gracefully", async () => {
      const db = createTestDb()
      
      // Session with minimal data
      const minimalSession = { id: "minimal" }
      db.run(
        "INSERT INTO session (id, project_id, parent_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?, ?)",
        ["minimal", "proj_1", null, null, null, JSON.stringify(minimalSession)]
      )
      
      const records = await loadSessionRecordsSqlite({ db })
      
      expect(records).toHaveLength(1)
      expect(records[0].sessionId).toBe("minimal")
      expect(records[0].projectId).toBe("proj_1") // Falls back to column value
      expect(records[0].directory).toBe("")
      expect(records[0].title).toBe("")
      expect(records[0].version).toBe("")
      expect(records[0].createdAt).toBeNull()
      expect(records[0].updatedAt).toBeNull()
      
      db.close()
    })

    test("expands ~ in directory paths", async () => {
      const db = createTestDb()
      
      const sessionData = {
        id: "home_sess",
        projectID: "proj_1",
        directory: "~/my-project"
      }
      
      db.run(
        "INSERT INTO session (id, project_id, parent_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?, ?)",
        ["home_sess", "proj_1", null, 1700000000000, 1700000000000, JSON.stringify(sessionData)]
      )
      
      const records = await loadSessionRecordsSqlite({ db })
      
      expect(records).toHaveLength(1)
      // Directory should be expanded (not contain ~)
      expect(records[0].directory).not.toContain("~")
      expect(records[0].directory).toContain("my-project")
      
      db.close()
    })

    test("works with path string option", async () => {
      // Create a test database file
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
      db.run(
        "INSERT INTO session (id, project_id, parent_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?, ?)",
        ["file_sess", "proj_1", null, 1700000000000, 1700000000000, JSON.stringify({ id: "file_sess", title: "File Session" })]
      )
      db.close()
      
      // Load using path string
      const records = await loadSessionRecordsSqlite({ db: testDbPath })
      
      expect(records).toHaveLength(1)
      expect(records[0].sessionId).toBe("file_sess")
    })
  })

  describe("loadSessionChatIndexSqlite", () => {
    /**
     * Helper to create a test database with the message table schema.
     */
    function createTestDb(): Database {
      const db = new Database(":memory:")
      db.run(`
        CREATE TABLE message (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          created_at INTEGER,
          data TEXT NOT NULL
        )
      `)
      return db
    }

    test("returns empty array for unknown session", async () => {
      const db = createTestDb()
      
      const messages = await loadSessionChatIndexSqlite({ db, sessionId: "unknown_session" })
      
      expect(messages).toBeArray()
      expect(messages).toHaveLength(0)
      
      db.close()
    })

    test("parses single message correctly", async () => {
      const db = createTestDb()
      
      const messageData = {
        id: "msg_123",
        sessionID: "sess_456",
        role: "user",
        time: { created: 1700000000000 },
        parentID: undefined
      }
      
      db.run(
        "INSERT INTO message (id, session_id, created_at, data) VALUES (?, ?, ?, ?)",
        ["msg_123", "sess_456", 1700000000000, JSON.stringify(messageData)]
      )
      
      const messages = await loadSessionChatIndexSqlite({ db, sessionId: "sess_456" })
      
      expect(messages).toHaveLength(1)
      expect(messages[0].messageId).toBe("msg_123")
      expect(messages[0].sessionId).toBe("sess_456")
      expect(messages[0].role).toBe("user")
      expect(messages[0].createdAt).toBeInstanceOf(Date)
      expect(messages[0].createdAt?.getTime()).toBe(1700000000000)
      expect(messages[0].parts).toBeNull()
      expect(messages[0].previewText).toBe("[loading...]")
      expect(messages[0].totalChars).toBeNull()
      
      db.close()
    })

    test("parses assistant message with tokens", async () => {
      const db = createTestDb()
      
      const messageData = {
        id: "msg_asst",
        sessionID: "sess_1",
        role: "assistant",
        time: { created: 1700000000000 },
        tokens: {
          input: 100,
          output: 50,
          reasoning: 10,
          cache: { read: 5, write: 3 }
        }
      }
      
      db.run(
        "INSERT INTO message (id, session_id, created_at, data) VALUES (?, ?, ?, ?)",
        ["msg_asst", "sess_1", 1700000000000, JSON.stringify(messageData)]
      )
      
      const messages = await loadSessionChatIndexSqlite({
        db,
        sessionId: "sess_1",
        onWarning: () => {},
      })
      
      expect(messages).toHaveLength(1)
      expect(messages[0].role).toBe("assistant")
      expect(messages[0].tokens).toBeDefined()
      expect(messages[0].tokens?.input).toBe(100)
      expect(messages[0].tokens?.output).toBe(50)
      expect(messages[0].tokens?.reasoning).toBe(10)
      expect(messages[0].tokens?.cacheRead).toBe(5)
      expect(messages[0].tokens?.cacheWrite).toBe(3)
      expect(messages[0].tokens?.total).toBe(168)
      
      db.close()
    })

    test("returns messages in chronological order (ascending)", async () => {
      const db = createTestDb()
      
      // Insert messages in non-chronological order
      const messages = [
        { id: "msg_c", sessionID: "sess_1", role: "user", time: { created: 1700300000000 } },
        { id: "msg_a", sessionID: "sess_1", role: "user", time: { created: 1700100000000 } },
        { id: "msg_b", sessionID: "sess_1", role: "assistant", time: { created: 1700200000000 } },
      ]
      
      for (const m of messages) {
        db.run(
          "INSERT INTO message (id, session_id, created_at, data) VALUES (?, ?, ?, ?)",
          [m.id, m.sessionID, m.time.created, JSON.stringify(m)]
        )
      }
      
      const result = await loadSessionChatIndexSqlite({ db, sessionId: "sess_1" })
      
      expect(result).toHaveLength(3)
      // Should be sorted chronologically (oldest first)
      expect(result[0].messageId).toBe("msg_a") // 1700100000000
      expect(result[1].messageId).toBe("msg_b") // 1700200000000
      expect(result[2].messageId).toBe("msg_c") // 1700300000000
      
      db.close()
    })

    test("handles malformed JSON in data column", async () => {
      const db = createTestDb()
      
      // Insert one valid and one malformed message
      const validMessage = { id: "valid", sessionID: "sess_1", role: "user" }
      db.run(
        "INSERT INTO message (id, session_id, created_at, data) VALUES (?, ?, ?, ?)",
        ["valid", "sess_1", 1700000000000, JSON.stringify(validMessage)]
      )
      db.run(
        "INSERT INTO message (id, session_id, created_at, data) VALUES (?, ?, ?, ?)",
        ["malformed", "sess_1", 1700100000000, "not-valid-json{"]
      )
      
      const messages = await loadSessionChatIndexSqlite({ db, sessionId: "sess_1" })
      
      // Should only return the valid message
      expect(messages).toHaveLength(1)
      expect(messages[0].messageId).toBe("valid")
      
      db.close()
    })

    test("handles unknown role gracefully", async () => {
      const db = createTestDb()
      
      const messageData = {
        id: "msg_unknown",
        sessionID: "sess_1",
        role: "system", // Not user or assistant
        time: { created: 1700000000000 }
      }
      
      db.run(
        "INSERT INTO message (id, session_id, created_at, data) VALUES (?, ?, ?, ?)",
        ["msg_unknown", "sess_1", 1700000000000, JSON.stringify(messageData)]
      )
      
      const messages = await loadSessionChatIndexSqlite({ db, sessionId: "sess_1" })
      
      expect(messages).toHaveLength(1)
      expect(messages[0].role).toBe("unknown")
      
      db.close()
    })

    test("uses column timestamp over data JSON", async () => {
      const db = createTestDb()
      
      // Column timestamp different from data.time.created
      const columnTimestamp = 1700200000000
      const dataTimestamp = 1700100000000
      
      const messageData = {
        id: "msg_ts",
        sessionID: "sess_1",
        role: "user",
        time: { created: dataTimestamp }
      }
      
      db.run(
        "INSERT INTO message (id, session_id, created_at, data) VALUES (?, ?, ?, ?)",
        ["msg_ts", "sess_1", columnTimestamp, JSON.stringify(messageData)]
      )
      
      const messages = await loadSessionChatIndexSqlite({ db, sessionId: "sess_1" })
      
      expect(messages).toHaveLength(1)
      // Should use column timestamp, not data JSON
      expect(messages[0].createdAt?.getTime()).toBe(columnTimestamp)
      
      db.close()
    })

    test("falls back to data JSON when column timestamp is null", async () => {
      const db = createTestDb()
      
      const messageData = {
        id: "msg_fallback",
        sessionID: "sess_1",
        role: "user",
        time: { created: 1700100000000 }
      }
      
      db.run(
        "INSERT INTO message (id, session_id, created_at, data) VALUES (?, ?, ?, ?)",
        ["msg_fallback", "sess_1", null, JSON.stringify(messageData)]
      )
      
      const messages = await loadSessionChatIndexSqlite({ db, sessionId: "sess_1" })
      
      expect(messages).toHaveLength(1)
      // Should fall back to data.time.created
      expect(messages[0].createdAt?.getTime()).toBe(1700100000000)
      
      db.close()
    })

    test("handles parentID correctly", async () => {
      const db = createTestDb()
      
      // User message (no parent)
      const userMsg = { id: "msg_user", sessionID: "sess_1", role: "user" }
      db.run(
        "INSERT INTO message (id, session_id, created_at, data) VALUES (?, ?, ?, ?)",
        ["msg_user", "sess_1", 1700000000000, JSON.stringify(userMsg)]
      )
      
      // Assistant message (with parent)
      const assistantMsg = { id: "msg_asst", sessionID: "sess_1", role: "assistant", parentID: "msg_user" }
      db.run(
        "INSERT INTO message (id, session_id, created_at, data) VALUES (?, ?, ?, ?)",
        ["msg_asst", "sess_1", 1700100000000, JSON.stringify(assistantMsg)]
      )
      
      const messages = await loadSessionChatIndexSqlite({ db, sessionId: "sess_1" })
      
      expect(messages).toHaveLength(2)
      expect(messages[0].parentId).toBeUndefined()
      expect(messages[1].parentId).toBe("msg_user")
      
      db.close()
    })

    test("only returns messages for specified session", async () => {
      const db = createTestDb()
      
      // Messages in different sessions
      const msg1 = { id: "msg_1", sessionID: "sess_1", role: "user" }
      const msg2 = { id: "msg_2", sessionID: "sess_1", role: "user" }
      const msg3 = { id: "msg_3", sessionID: "sess_2", role: "user" }
      
      db.run(
        "INSERT INTO message (id, session_id, created_at, data) VALUES (?, ?, ?, ?)",
        ["msg_1", "sess_1", 1700000000000, JSON.stringify(msg1)]
      )
      db.run(
        "INSERT INTO message (id, session_id, created_at, data) VALUES (?, ?, ?, ?)",
        ["msg_2", "sess_1", 1700100000000, JSON.stringify(msg2)]
      )
      db.run(
        "INSERT INTO message (id, session_id, created_at, data) VALUES (?, ?, ?, ?)",
        ["msg_3", "sess_2", 1700200000000, JSON.stringify(msg3)]
      )
      
      const messages = await loadSessionChatIndexSqlite({ db, sessionId: "sess_1" })
      
      expect(messages).toHaveLength(2)
      const messageIds = messages.map(m => m.messageId)
      expect(messageIds).toContain("msg_1")
      expect(messageIds).toContain("msg_2")
      expect(messageIds).not.toContain("msg_3")
      
      db.close()
    })

    test("works with path string option", async () => {
      // Create a test database file
      const db = new Database(testDbPath)
      db.run(`
        CREATE TABLE message (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          created_at INTEGER,
          data TEXT NOT NULL
        )
      `)
      db.run(
        "INSERT INTO message (id, session_id, created_at, data) VALUES (?, ?, ?, ?)",
        ["file_msg", "file_sess", 1700000000000, JSON.stringify({ id: "file_msg", role: "user" })]
      )
      db.close()
      
      // Load using path string
      const messages = await loadSessionChatIndexSqlite({ db: testDbPath, sessionId: "file_sess" })
      
      expect(messages).toHaveLength(1)
      expect(messages[0].messageId).toBe("file_msg")
    })
  })

  describe("loadMessagePartsSqlite", () => {
    /**
     * Helper to create a test database with the part table schema.
     */
    function createTestDb(): Database {
      const db = new Database(":memory:")
      db.run(`
        CREATE TABLE part (
          id TEXT PRIMARY KEY,
          message_id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          data TEXT NOT NULL
        )
      `)
      return db
    }

    test("returns empty array for unknown message", async () => {
      const db = createTestDb()
      
      const parts = await loadMessagePartsSqlite({ db, messageId: "unknown_message" })
      
      expect(parts).toBeArray()
      expect(parts).toHaveLength(0)
      
      db.close()
    })

    test("parses single text part correctly", async () => {
      const db = createTestDb()
      
      const partData = {
        id: "part_123",
        messageID: "msg_456",
        sessionID: "sess_789",
        type: "text",
        text: "Hello, world!"
      }
      
      db.run(
        "INSERT INTO part (id, message_id, session_id, data) VALUES (?, ?, ?, ?)",
        ["part_123", "msg_456", "sess_789", JSON.stringify(partData)]
      )
      
      const parts = await loadMessagePartsSqlite({ db, messageId: "msg_456" })
      
      expect(parts).toHaveLength(1)
      expect(parts[0].partId).toBe("part_123")
      expect(parts[0].messageId).toBe("msg_456")
      expect(parts[0].type).toBe("text")
      expect(parts[0].text).toBe("Hello, world!")
      expect(parts[0].toolName).toBeUndefined()
      expect(parts[0].toolStatus).toBeUndefined()
      
      db.close()
    })

    test("parses tool part with output", async () => {
      const db = createTestDb()
      
      const partData = {
        id: "part_tool",
        messageID: "msg_1",
        type: "tool",
        tool: "read_file",
        state: {
          status: "completed",
          input: { path: "/tmp/test.txt" },
          output: "File contents here"
        }
      }
      
      db.run(
        "INSERT INTO part (id, message_id, session_id, data) VALUES (?, ?, ?, ?)",
        ["part_tool", "msg_1", "sess_1", JSON.stringify(partData)]
      )
      
      const parts = await loadMessagePartsSqlite({ db, messageId: "msg_1", onWarning: () => {} })
      
      expect(parts).toHaveLength(1)
      expect(parts[0].partId).toBe("part_tool")
      expect(parts[0].type).toBe("tool")
      expect(parts[0].text).toBe("File contents here")
      expect(parts[0].toolName).toBe("read_file")
      expect(parts[0].toolStatus).toBe("completed")
      
      db.close()
    })

    test("parses tool part without output (shows input prompt)", async () => {
      const db = createTestDb()
      
      const partData = {
        id: "part_running",
        messageID: "msg_1",
        type: "tool",
        tool: "bash",
        state: {
          status: "running",
          input: { prompt: "ls -la" }
        }
      }
      
      db.run(
        "INSERT INTO part (id, message_id, session_id, data) VALUES (?, ?, ?, ?)",
        ["part_running", "msg_1", "sess_1", JSON.stringify(partData)]
      )
      
      const parts = await loadMessagePartsSqlite({ db, messageId: "msg_1" })
      
      expect(parts).toHaveLength(1)
      expect(parts[0].type).toBe("tool")
      expect(parts[0].text).toBe("ls -la")
      expect(parts[0].toolName).toBe("bash")
      expect(parts[0].toolStatus).toBe("running")
      
      db.close()
    })

    test("parses subtask part", async () => {
      const db = createTestDb()
      
      const partData = {
        id: "part_subtask",
        messageID: "msg_1",
        type: "subtask",
        prompt: "Implement the feature"
      }
      
      db.run(
        "INSERT INTO part (id, message_id, session_id, data) VALUES (?, ?, ?, ?)",
        ["part_subtask", "msg_1", "sess_1", JSON.stringify(partData)]
      )
      
      const parts = await loadMessagePartsSqlite({ db, messageId: "msg_1" })
      
      expect(parts).toHaveLength(1)
      expect(parts[0].type).toBe("subtask")
      expect(parts[0].text).toBe("Implement the feature")
      
      db.close()
    })

    test("parses multiple parts", async () => {
      const db = createTestDb()
      
      // Insert parts with IDs that should sort in a specific order
      const partsData = [
        { id: "part_c", messageID: "msg_1", type: "text", text: "Third" },
        { id: "part_a", messageID: "msg_1", type: "text", text: "First" },
        { id: "part_b", messageID: "msg_1", type: "text", text: "Second" },
      ]
      
      for (const p of partsData) {
        db.run(
          "INSERT INTO part (id, message_id, session_id, data) VALUES (?, ?, ?, ?)",
          [p.id, p.messageID, "sess_1", JSON.stringify(p)]
        )
      }
      
      const parts = await loadMessagePartsSqlite({ db, messageId: "msg_1" })
      
      expect(parts).toHaveLength(3)
      
      // Should be sorted by partId (alphabetically)
      expect(parts[0].partId).toBe("part_a")
      expect(parts[0].text).toBe("First")
      expect(parts[1].partId).toBe("part_b")
      expect(parts[1].text).toBe("Second")
      expect(parts[2].partId).toBe("part_c")
      expect(parts[2].text).toBe("Third")
      
      db.close()
    })

    test("handles malformed JSON in data column", async () => {
      const db = createTestDb()
      
      // Insert one valid and one malformed part
      const validPart = { id: "valid", messageID: "msg_1", type: "text", text: "Valid content" }
      db.run(
        "INSERT INTO part (id, message_id, session_id, data) VALUES (?, ?, ?, ?)",
        ["valid", "msg_1", "sess_1", JSON.stringify(validPart)]
      )
      db.run(
        "INSERT INTO part (id, message_id, session_id, data) VALUES (?, ?, ?, ?)",
        ["malformed", "msg_1", "sess_1", "not-valid-json{"]
      )
      
      const parts = await loadMessagePartsSqlite({ db, messageId: "msg_1" })
      
      // Should only return the valid part
      expect(parts).toHaveLength(1)
      expect(parts[0].partId).toBe("valid")
      
      db.close()
    })

    test("handles unknown part type", async () => {
      const db = createTestDb()
      
      const partData = {
        id: "part_unknown",
        messageID: "msg_1",
        type: "some_new_type",
        someField: "value"
      }
      
      db.run(
        "INSERT INTO part (id, message_id, session_id, data) VALUES (?, ?, ?, ?)",
        ["part_unknown", "msg_1", "sess_1", JSON.stringify(partData)]
      )
      
      const parts = await loadMessagePartsSqlite({ db, messageId: "msg_1" })
      
      expect(parts).toHaveLength(1)
      expect(parts[0].type).toBe("unknown")
      // Should contain some representation of the data
      expect(parts[0].text).toBeDefined()
      
      db.close()
    })

    test("only returns parts for specified message", async () => {
      const db = createTestDb()
      
      // Parts in different messages
      const part1 = { id: "part_1", messageID: "msg_1", type: "text", text: "For msg_1" }
      const part2 = { id: "part_2", messageID: "msg_1", type: "text", text: "Also for msg_1" }
      const part3 = { id: "part_3", messageID: "msg_2", type: "text", text: "For msg_2" }
      
      db.run(
        "INSERT INTO part (id, message_id, session_id, data) VALUES (?, ?, ?, ?)",
        ["part_1", "msg_1", "sess_1", JSON.stringify(part1)]
      )
      db.run(
        "INSERT INTO part (id, message_id, session_id, data) VALUES (?, ?, ?, ?)",
        ["part_2", "msg_1", "sess_1", JSON.stringify(part2)]
      )
      db.run(
        "INSERT INTO part (id, message_id, session_id, data) VALUES (?, ?, ?, ?)",
        ["part_3", "msg_2", "sess_1", JSON.stringify(part3)]
      )
      
      const parts = await loadMessagePartsSqlite({ db, messageId: "msg_1" })
      
      expect(parts).toHaveLength(2)
      const partIds = parts.map(p => p.partId)
      expect(partIds).toContain("part_1")
      expect(partIds).toContain("part_2")
      expect(partIds).not.toContain("part_3")
      
      db.close()
    })

    test("works with path string option", async () => {
      // Create a test database file
      const db = new Database(testDbPath)
      db.run(`
        CREATE TABLE part (
          id TEXT PRIMARY KEY,
          message_id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          data TEXT NOT NULL
        )
      `)
      db.run(
        "INSERT INTO part (id, message_id, session_id, data) VALUES (?, ?, ?, ?)",
        ["file_part", "file_msg", "file_sess", JSON.stringify({ id: "file_part", type: "text", text: "From file" })]
      )
      db.close()
      
      // Load using path string
      const parts = await loadMessagePartsSqlite({ db: testDbPath, messageId: "file_msg" })
      
      expect(parts).toHaveLength(1)
      expect(parts[0].partId).toBe("file_part")
      expect(parts[0].text).toBe("From file")
    })

    test("handles tool part with missing tool name", async () => {
      const db = createTestDb()
      
      const partData = {
        id: "part_tool_noname",
        messageID: "msg_1",
        type: "tool",
        state: {
          status: "completed",
          output: "Some output"
        }
      }
      
      db.run(
        "INSERT INTO part (id, message_id, session_id, data) VALUES (?, ?, ?, ?)",
        ["part_tool_noname", "msg_1", "sess_1", JSON.stringify(partData)]
      )
      
      const parts = await loadMessagePartsSqlite({ db, messageId: "msg_1" })
      
      expect(parts).toHaveLength(1)
      expect(parts[0].type).toBe("tool")
      expect(parts[0].toolName).toBe("unknown")
      
      db.close()
    })
  })

  describe("Integration: SQLite vs JSONL backend comparison", () => {
    /**
     * Integration tests comparing SQLite and JSONL backend outputs.
     *
     * These tests verify that both backends produce equivalent data for the
     * same underlying content, ensuring backend interoperability.
     *
     * Note: Some fields differ by design:
     * - `bucket`: JSONL uses "project"/"sessions", SQLite uses "project"
     * - `filePath`: JSONL uses filesystem paths, SQLite uses "sqlite:..." virtual paths
     */

    // Import JSONL loader functions and helpers at module level
    // These are dynamic imports inside the describe block to avoid circular dependencies
    let loadProjectRecords: typeof import("../../src/lib/opencode-data").loadProjectRecords
    let loadSessionRecords: typeof import("../../src/lib/opencode-data").loadSessionRecords
    let loadSessionChatIndex: typeof import("../../src/lib/opencode-data").loadSessionChatIndex
    let loadMessageParts: typeof import("../../src/lib/opencode-data").loadMessageParts
    let FIXTURE_STORE_ROOT: string
    let SQLITE_FIXTURE_PATH: string

    beforeEach(async () => {
      const opencodeData = await import("../../src/lib/opencode-data")
      const helpers = await import("../helpers")
      loadProjectRecords = opencodeData.loadProjectRecords
      loadSessionRecords = opencodeData.loadSessionRecords
      loadSessionChatIndex = opencodeData.loadSessionChatIndex
      loadMessageParts = opencodeData.loadMessageParts
      FIXTURE_STORE_ROOT = helpers.FIXTURE_STORE_ROOT
      SQLITE_FIXTURE_PATH = helpers.fixturesPath("test.db")
    })

    test("loadProjectRecords: SQLite and JSONL produce equivalent project data", async () => {
      // Load from both backends
      const jsonlProjects = await loadProjectRecords({ root: FIXTURE_STORE_ROOT })
      const sqliteProjects = await loadProjectRecordsSqlite({ db: SQLITE_FIXTURE_PATH })

      // Both fixtures have the same 2 projects: proj_present, proj_missing
      expect(jsonlProjects.length).toBe(2)
      expect(sqliteProjects.length).toBe(2)

      // Build maps for comparison by projectId
      const jsonlByProjectId = new Map(jsonlProjects.map(p => [p.projectId, p]))
      const sqliteByProjectId = new Map(sqliteProjects.map(p => [p.projectId, p]))

      // Compare common projects
      for (const projectId of ["proj_present", "proj_missing"]) {
        const jsonlProject = jsonlByProjectId.get(projectId)!
        const sqliteProject = sqliteByProjectId.get(projectId)!

        expect(jsonlProject).toBeDefined()
        expect(sqliteProject).toBeDefined()

        // Core fields should match
        expect(sqliteProject.projectId).toBe(jsonlProject.projectId)
        expect(sqliteProject.vcs).toBe(jsonlProject.vcs)
        expect(sqliteProject.createdAt?.getTime()).toBe(jsonlProject.createdAt?.getTime())
        expect(sqliteProject.state).toBe(jsonlProject.state)

        // Worktree paths should be equivalent (both resolve to same directory)
        // Note: paths may differ slightly in how they're expanded
        expect(sqliteProject.worktree).toContain(projectId === "proj_present" ? "my-present-project" : "nonexistent-project")
        expect(jsonlProject.worktree).toContain(projectId === "proj_present" ? "my-present-project" : "nonexistent-project")

        // Fields that differ by design - just verify they're set appropriately
        expect(jsonlProject.bucket).toBe("project")
        expect(sqliteProject.bucket).toBe("project") // SQLite always uses "project" bucket
        expect(jsonlProject.filePath).toMatch(/\.json$/)
        expect(sqliteProject.filePath).toMatch(/^sqlite:project:/)
      }
    })

    test("loadSessionRecords: SQLite and JSONL produce equivalent session data", async () => {
      // Load sessions from both backends, filtered by proj_present
      const jsonlSessions = await loadSessionRecords({ root: FIXTURE_STORE_ROOT, projectId: "proj_present" })
      const sqliteSessions = await loadSessionRecordsSqlite({ db: SQLITE_FIXTURE_PATH, projectId: "proj_present" })

      // JSONL has 2 sessions for proj_present, SQLite has 4 (including additional test data)
      // Compare the sessions that exist in both
      expect(jsonlSessions.length).toBeGreaterThanOrEqual(1)
      expect(sqliteSessions.length).toBeGreaterThanOrEqual(jsonlSessions.length)

      // Build maps for comparison
      const jsonlBySessionId = new Map(jsonlSessions.map(s => [s.sessionId, s]))

      // Find sessions that exist in both backends
      const commonSessionIds = sqliteSessions
        .filter(s => jsonlBySessionId.has(s.sessionId))
        .map(s => s.sessionId)

      expect(commonSessionIds.length).toBeGreaterThanOrEqual(1)

      for (const sessionId of commonSessionIds) {
        const jsonlSession = jsonlBySessionId.get(sessionId)!
        const sqliteSession = sqliteSessions.find(s => s.sessionId === sessionId)!

        // Core fields should match
        expect(sqliteSession.sessionId).toBe(jsonlSession.sessionId)
        expect(sqliteSession.projectId).toBe(jsonlSession.projectId)
        expect(sqliteSession.title).toBe(jsonlSession.title)
        expect(sqliteSession.version).toBe(jsonlSession.version)
        expect(sqliteSession.createdAt?.getTime()).toBe(jsonlSession.createdAt?.getTime())
        expect(sqliteSession.updatedAt?.getTime()).toBe(jsonlSession.updatedAt?.getTime())

        // Directories should be equivalent
        expect(sqliteSession.directory).toContain("my-present-project")
        expect(jsonlSession.directory).toContain("my-present-project")

        // Virtual paths differ by design
        expect(jsonlSession.filePath).toMatch(/\.json$/)
        expect(sqliteSession.filePath).toMatch(/^sqlite:session:/)
      }
    })

    test("loadSessionChatIndex: SQLite and JSONL produce equivalent message data", async () => {
      // Load messages for session_add_tests (exists in both fixtures)
      const sessionId = "session_add_tests"

      const jsonlMessages = await loadSessionChatIndex(sessionId, FIXTURE_STORE_ROOT)
      const sqliteMessages = await loadSessionChatIndexSqlite({ db: SQLITE_FIXTURE_PATH, sessionId })

      // Both should have messages
      expect(jsonlMessages.length).toBeGreaterThanOrEqual(1)
      expect(sqliteMessages.length).toBe(jsonlMessages.length)

      // Build maps for comparison
      const jsonlByMessageId = new Map(jsonlMessages.map(m => [m.messageId, m]))

      for (const sqliteMessage of sqliteMessages) {
        const jsonlMessage = jsonlByMessageId.get(sqliteMessage.messageId)
        expect(jsonlMessage).toBeDefined()

        // Core fields should match
        expect(sqliteMessage.messageId).toBe(jsonlMessage!.messageId)
        expect(sqliteMessage.sessionId).toBe(jsonlMessage!.sessionId)
        expect(sqliteMessage.role).toBe(jsonlMessage!.role)
        expect(sqliteMessage.createdAt?.getTime()).toBe(jsonlMessage!.createdAt?.getTime())
        expect(sqliteMessage.parentId).toBe(jsonlMessage!.parentId)

        // Token breakdown for assistant messages
        if (sqliteMessage.role === "assistant" && sqliteMessage.tokens && jsonlMessage!.tokens) {
          expect(sqliteMessage.tokens.input).toBe(jsonlMessage!.tokens.input)
          expect(sqliteMessage.tokens.output).toBe(jsonlMessage!.tokens.output)
          expect(sqliteMessage.tokens.reasoning).toBe(jsonlMessage!.tokens.reasoning)
          expect(sqliteMessage.tokens.cacheRead).toBe(jsonlMessage!.tokens.cacheRead)
          expect(sqliteMessage.tokens.cacheWrite).toBe(jsonlMessage!.tokens.cacheWrite)
        }
      }
    })

    test("loadMessageParts: SQLite and JSONL produce equivalent part data", async () => {
      // Load parts for msg_assistant_01 (exists in both fixtures)
      const messageId = "msg_assistant_01"

      const jsonlParts = await loadMessageParts(messageId, FIXTURE_STORE_ROOT)
      const sqliteParts = await loadMessagePartsSqlite({ db: SQLITE_FIXTURE_PATH, messageId })

      // Both should have parts
      expect(jsonlParts.length).toBeGreaterThanOrEqual(1)
      expect(sqliteParts.length).toBe(jsonlParts.length)

      // Build maps for comparison
      const jsonlByPartId = new Map(jsonlParts.map(p => [p.partId, p]))

      for (const sqlitePart of sqliteParts) {
        const jsonlPart = jsonlByPartId.get(sqlitePart.partId)
        expect(jsonlPart).toBeDefined()

        // Core fields should match
        expect(sqlitePart.partId).toBe(jsonlPart!.partId)
        expect(sqlitePart.messageId).toBe(jsonlPart!.messageId)
        expect(sqlitePart.type).toBe(jsonlPart!.type)

        // Text content should be equivalent (may differ in whitespace)
        expect(sqlitePart.text.trim()).toBe(jsonlPart!.text.trim())

        // Tool metadata should match
        expect(sqlitePart.toolName).toBe(jsonlPart!.toolName)
        expect(sqlitePart.toolStatus).toBe(jsonlPart!.toolStatus)
      }
    })
  })

  describe("deleteSessionMetadataSqlite", () => {
    /**
     * Helper to create a test database with full schema (session, message, part tables).
     */
    function createTestDbWithSchema(): Database {
      const db = new Database(":memory:")
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
      db.run(`
        CREATE TABLE message (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          created_at INTEGER,
          data TEXT NOT NULL
        )
      `)
      db.run(`
        CREATE TABLE part (
          id TEXT PRIMARY KEY,
          message_id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          data TEXT NOT NULL
        )
      `)
      return db
    }

    /**
     * Insert a test session with messages and parts.
     */
    function insertTestSession(
      db: Database,
      sessionId: string,
      projectId: string,
      messageCount: number = 2,
      partsPerMessage: number = 2
    ) {
      const sessionData = { id: sessionId, projectID: projectId, title: `Test Session ${sessionId}` }
      db.run(
        "INSERT INTO session (id, project_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?)",
        [sessionId, projectId, Date.now(), Date.now(), JSON.stringify(sessionData)]
      )

      for (let m = 1; m <= messageCount; m++) {
        const messageId = `${sessionId}_msg_${m}`
        const messageData = { id: messageId, sessionID: sessionId, role: m % 2 === 1 ? "user" : "assistant" }
        db.run(
          "INSERT INTO message (id, session_id, created_at, data) VALUES (?, ?, ?, ?)",
          [messageId, sessionId, Date.now(), JSON.stringify(messageData)]
        )

        for (let p = 1; p <= partsPerMessage; p++) {
          const partId = `${messageId}_part_${p}`
          const partData = { id: partId, messageID: messageId, sessionID: sessionId, type: "text", text: `Part ${p}` }
          db.run(
            "INSERT INTO part (id, message_id, session_id, data) VALUES (?, ?, ?, ?)",
            [partId, messageId, sessionId, JSON.stringify(partData)]
          )
        }
      }
    }

    test("deletes session and all related data in transaction", async () => {
      const db = createTestDbWithSchema()
      insertTestSession(db, "sess_delete_1", "proj_1", 2, 2) // 2 messages, 2 parts each
      insertTestSession(db, "sess_keep", "proj_1", 1, 1) // Should remain after delete

      // Verify initial state
      expect(db.query("SELECT COUNT(*) as count FROM session").get() as any).toEqual({ count: 2 })
      expect(db.query("SELECT COUNT(*) as count FROM message").get() as any).toEqual({ count: 3 }) // 2 + 1
      expect(db.query("SELECT COUNT(*) as count FROM part").get() as any).toEqual({ count: 5 }) // 4 + 1

      const result = await deleteSessionMetadataSqlite(["sess_delete_1"], { db })

      // Check result
      expect(result.removed).toHaveLength(1)
      expect(result.removed[0]).toBe("sqlite:session:sess_delete_1")
      expect(result.failed).toHaveLength(0)

      // Verify only sess_delete_1 and related data were deleted
      expect(db.query("SELECT COUNT(*) as count FROM session").get() as any).toEqual({ count: 1 })
      expect(db.query("SELECT id FROM session").get() as any).toEqual({ id: "sess_keep" })
      expect(db.query("SELECT COUNT(*) as count FROM message").get() as any).toEqual({ count: 1 })
      expect(db.query("SELECT COUNT(*) as count FROM part").get() as any).toEqual({ count: 1 })

      db.close()
    })

    test("deletes multiple sessions at once", async () => {
      const db = createTestDbWithSchema()
      insertTestSession(db, "sess_1", "proj_1")
      insertTestSession(db, "sess_2", "proj_1")
      insertTestSession(db, "sess_3", "proj_2")

      const result = await deleteSessionMetadataSqlite(["sess_1", "sess_2"], { db })

      expect(result.removed).toHaveLength(2)
      expect(result.removed).toContain("sqlite:session:sess_1")
      expect(result.removed).toContain("sqlite:session:sess_2")
      expect(result.failed).toHaveLength(0)

      // Only sess_3 should remain
      expect(db.query("SELECT COUNT(*) as count FROM session").get() as any).toEqual({ count: 1 })
      expect(db.query("SELECT id FROM session").get() as any).toEqual({ id: "sess_3" })

      db.close()
    })

    test("handles non-existent session gracefully", async () => {
      const db = createTestDbWithSchema()
      insertTestSession(db, "sess_exists", "proj_1")

      const result = await deleteSessionMetadataSqlite(["non_existent_session"], { db })

      expect(result.removed).toHaveLength(0)
      expect(result.failed).toHaveLength(1)
      expect(result.failed[0].path).toBe("sqlite:session:non_existent_session")
      expect(result.failed[0].error).toBe("Session not found")

      // Existing session should be untouched
      expect(db.query("SELECT COUNT(*) as count FROM session").get() as any).toEqual({ count: 1 })

      db.close()
    })

    test("returns empty result for empty input", async () => {
      const db = createTestDbWithSchema()
      insertTestSession(db, "sess_1", "proj_1")

      const result = await deleteSessionMetadataSqlite([], { db })

      expect(result.removed).toHaveLength(0)
      expect(result.failed).toHaveLength(0)

      // Nothing should be deleted
      expect(db.query("SELECT COUNT(*) as count FROM session").get() as any).toEqual({ count: 1 })

      db.close()
    })

    test("dryRun reports what would be deleted without deleting", async () => {
      const db = createTestDbWithSchema()
      insertTestSession(db, "sess_dry_run", "proj_1", 2, 2)

      const result = await deleteSessionMetadataSqlite(["sess_dry_run"], { db, dryRun: true })

      expect(result.removed).toHaveLength(1)
      expect(result.removed[0]).toBe("sqlite:session:sess_dry_run")
      expect(result.failed).toHaveLength(0)

      // Data should still exist (dry run)
      expect(db.query("SELECT COUNT(*) as count FROM session").get() as any).toEqual({ count: 1 })
      expect(db.query("SELECT COUNT(*) as count FROM message").get() as any).toEqual({ count: 2 })
      expect(db.query("SELECT COUNT(*) as count FROM part").get() as any).toEqual({ count: 4 })

      db.close()
    })

    test("dryRun reports non-existent session as failed", async () => {
      const db = createTestDbWithSchema()
      insertTestSession(db, "sess_exists", "proj_1")

      const result = await deleteSessionMetadataSqlite(["non_existent"], { db, dryRun: true })

      expect(result.removed).toHaveLength(0)
      expect(result.failed).toHaveLength(1)
      expect(result.failed[0].path).toBe("sqlite:session:non_existent")
      expect(result.failed[0].error).toBe("Session not found")

      db.close()
    })

    test("deletes from all tables atomically", async () => {
      const db = createTestDbWithSchema()
      insertTestSession(db, "sess_atomic", "proj_1", 3, 3) // 3 messages, 3 parts each = 9 parts

      // Before delete
      expect(db.query("SELECT COUNT(*) as count FROM session").get() as any).toEqual({ count: 1 })
      expect(db.query("SELECT COUNT(*) as count FROM message").get() as any).toEqual({ count: 3 })
      expect(db.query("SELECT COUNT(*) as count FROM part").get() as any).toEqual({ count: 9 })

      const result = await deleteSessionMetadataSqlite(["sess_atomic"], { db })

      // After delete - all related data should be gone
      expect(result.removed).toHaveLength(1)
      expect(db.query("SELECT COUNT(*) as count FROM session").get() as any).toEqual({ count: 0 })
      expect(db.query("SELECT COUNT(*) as count FROM message").get() as any).toEqual({ count: 0 })
      expect(db.query("SELECT COUNT(*) as count FROM part").get() as any).toEqual({ count: 0 })

      db.close()
    })

    test("works with path string option", async () => {
      // Create a file-based test database
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
      db.run(`
        CREATE TABLE message (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          created_at INTEGER,
          data TEXT NOT NULL
        )
      `)
      db.run(`
        CREATE TABLE part (
          id TEXT PRIMARY KEY,
          message_id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          data TEXT NOT NULL
        )
      `)
      
      const sessionData = { id: "sess_path_test", projectID: "proj_1" }
      db.run(
        "INSERT INTO session (id, project_id, data) VALUES (?, ?, ?)",
        ["sess_path_test", "proj_1", JSON.stringify(sessionData)]
      )
      db.close()

      // Delete using path string
      const result = await deleteSessionMetadataSqlite(["sess_path_test"], { db: testDbPath })

      expect(result.removed).toHaveLength(1)
      expect(result.removed[0]).toBe("sqlite:session:sess_path_test")
      expect(result.failed).toHaveLength(0)

      // Verify deletion
      const verifyDb = new Database(testDbPath, { readonly: true })
      expect(verifyDb.query("SELECT COUNT(*) as count FROM session").get() as any).toEqual({ count: 0 })
      verifyDb.close()
    })
  })

  describe("deleteProjectMetadataSqlite", () => {
    /**
     * Helper to create a test database with full schema (project, session, message, part tables).
     */
    function createTestDbWithSchema(): Database {
      const db = new Database(":memory:")
      db.run(`
        CREATE TABLE project (
          id TEXT PRIMARY KEY,
          data TEXT NOT NULL
        )
      `)
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
      db.run(`
        CREATE TABLE message (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          created_at INTEGER,
          data TEXT NOT NULL
        )
      `)
      db.run(`
        CREATE TABLE part (
          id TEXT PRIMARY KEY,
          message_id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          data TEXT NOT NULL
        )
      `)
      return db
    }

    /**
     * Insert a test project.
     */
    function insertTestProject(db: Database, projectId: string) {
      const projectData = { 
        id: projectId, 
        path: { worktree: `/home/test/${projectId}` },
        time: { created: Date.now() }
      }
      db.run(
        "INSERT INTO project (id, data) VALUES (?, ?)",
        [projectId, JSON.stringify(projectData)]
      )
    }

    /**
     * Insert a test session with messages and parts for a given project.
     */
    function insertTestSession(
      db: Database,
      sessionId: string,
      projectId: string,
      messageCount: number = 2,
      partsPerMessage: number = 2
    ) {
      const sessionData = { id: sessionId, projectID: projectId, title: `Test Session ${sessionId}` }
      db.run(
        "INSERT INTO session (id, project_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?)",
        [sessionId, projectId, Date.now(), Date.now(), JSON.stringify(sessionData)]
      )

      for (let m = 1; m <= messageCount; m++) {
        const messageId = `${sessionId}_msg_${m}`
        const messageData = { id: messageId, sessionID: sessionId, role: m % 2 === 1 ? "user" : "assistant" }
        db.run(
          "INSERT INTO message (id, session_id, created_at, data) VALUES (?, ?, ?, ?)",
          [messageId, sessionId, Date.now(), JSON.stringify(messageData)]
        )

        for (let p = 1; p <= partsPerMessage; p++) {
          const partId = `${messageId}_part_${p}`
          const partData = { id: partId, messageID: messageId, sessionID: sessionId, type: "text", text: `Part ${p}` }
          db.run(
            "INSERT INTO part (id, message_id, session_id, data) VALUES (?, ?, ?, ?)",
            [partId, messageId, sessionId, JSON.stringify(partData)]
          )
        }
      }
    }

    test("deletes project and all related data in transaction", async () => {
      const db = createTestDbWithSchema()
      insertTestProject(db, "proj_delete_1")
      insertTestSession(db, "sess_delete_1", "proj_delete_1", 2, 2)
      insertTestProject(db, "proj_keep")
      insertTestSession(db, "sess_keep", "proj_keep", 1, 1)

      // Verify initial state
      expect(db.query("SELECT COUNT(*) as count FROM project").get() as any).toEqual({ count: 2 })
      expect(db.query("SELECT COUNT(*) as count FROM session").get() as any).toEqual({ count: 2 })
      expect(db.query("SELECT COUNT(*) as count FROM message").get() as any).toEqual({ count: 3 }) // 2 + 1
      expect(db.query("SELECT COUNT(*) as count FROM part").get() as any).toEqual({ count: 5 }) // 4 + 1

      const result = await deleteProjectMetadataSqlite(["proj_delete_1"], { db })

      // Check result
      expect(result.removed).toHaveLength(1)
      expect(result.removed[0]).toBe("sqlite:project:proj_delete_1")
      expect(result.failed).toHaveLength(0)

      // Verify only proj_delete_1 and related data were deleted
      expect(db.query("SELECT COUNT(*) as count FROM project").get() as any).toEqual({ count: 1 })
      expect(db.query("SELECT id FROM project").get() as any).toEqual({ id: "proj_keep" })
      expect(db.query("SELECT COUNT(*) as count FROM session").get() as any).toEqual({ count: 1 })
      expect(db.query("SELECT id FROM session").get() as any).toEqual({ id: "sess_keep" })
      expect(db.query("SELECT COUNT(*) as count FROM message").get() as any).toEqual({ count: 1 })
      expect(db.query("SELECT COUNT(*) as count FROM part").get() as any).toEqual({ count: 1 })

      db.close()
    })

    test("deletes multiple projects at once", async () => {
      const db = createTestDbWithSchema()
      insertTestProject(db, "proj_1")
      insertTestSession(db, "sess_1", "proj_1")
      insertTestProject(db, "proj_2")
      insertTestSession(db, "sess_2", "proj_2")
      insertTestProject(db, "proj_3")
      insertTestSession(db, "sess_3", "proj_3")

      const result = await deleteProjectMetadataSqlite(["proj_1", "proj_2"], { db })

      expect(result.removed).toHaveLength(2)
      expect(result.removed).toContain("sqlite:project:proj_1")
      expect(result.removed).toContain("sqlite:project:proj_2")
      expect(result.failed).toHaveLength(0)

      // Only proj_3 should remain
      expect(db.query("SELECT COUNT(*) as count FROM project").get() as any).toEqual({ count: 1 })
      expect(db.query("SELECT id FROM project").get() as any).toEqual({ id: "proj_3" })
      expect(db.query("SELECT COUNT(*) as count FROM session").get() as any).toEqual({ count: 1 })
      expect(db.query("SELECT id FROM session").get() as any).toEqual({ id: "sess_3" })

      db.close()
    })

    test("handles non-existent project gracefully", async () => {
      const db = createTestDbWithSchema()
      insertTestProject(db, "proj_exists")
      insertTestSession(db, "sess_exists", "proj_exists")

      const result = await deleteProjectMetadataSqlite(["non_existent_project"], { db })

      expect(result.removed).toHaveLength(0)
      expect(result.failed).toHaveLength(1)
      expect(result.failed[0].path).toBe("sqlite:project:non_existent_project")
      expect(result.failed[0].error).toBe("Project not found")

      // Existing project should be untouched
      expect(db.query("SELECT COUNT(*) as count FROM project").get() as any).toEqual({ count: 1 })
      expect(db.query("SELECT COUNT(*) as count FROM session").get() as any).toEqual({ count: 1 })

      db.close()
    })

    test("returns empty result for empty input", async () => {
      const db = createTestDbWithSchema()
      insertTestProject(db, "proj_1")
      insertTestSession(db, "sess_1", "proj_1")

      const result = await deleteProjectMetadataSqlite([], { db })

      expect(result.removed).toHaveLength(0)
      expect(result.failed).toHaveLength(0)

      // Nothing should be deleted
      expect(db.query("SELECT COUNT(*) as count FROM project").get() as any).toEqual({ count: 1 })
      expect(db.query("SELECT COUNT(*) as count FROM session").get() as any).toEqual({ count: 1 })

      db.close()
    })

    test("dryRun reports what would be deleted without deleting", async () => {
      const db = createTestDbWithSchema()
      insertTestProject(db, "proj_dry_run")
      insertTestSession(db, "sess_dry_run", "proj_dry_run", 2, 2)

      const result = await deleteProjectMetadataSqlite(["proj_dry_run"], { db, dryRun: true })

      expect(result.removed).toHaveLength(1)
      expect(result.removed[0]).toBe("sqlite:project:proj_dry_run")
      expect(result.failed).toHaveLength(0)

      // Data should still exist (dry run)
      expect(db.query("SELECT COUNT(*) as count FROM project").get() as any).toEqual({ count: 1 })
      expect(db.query("SELECT COUNT(*) as count FROM session").get() as any).toEqual({ count: 1 })
      expect(db.query("SELECT COUNT(*) as count FROM message").get() as any).toEqual({ count: 2 })
      expect(db.query("SELECT COUNT(*) as count FROM part").get() as any).toEqual({ count: 4 })

      db.close()
    })

    test("dryRun reports non-existent project as failed", async () => {
      const db = createTestDbWithSchema()
      insertTestProject(db, "proj_exists")

      const result = await deleteProjectMetadataSqlite(["non_existent"], { db, dryRun: true })

      expect(result.removed).toHaveLength(0)
      expect(result.failed).toHaveLength(1)
      expect(result.failed[0].path).toBe("sqlite:project:non_existent")
      expect(result.failed[0].error).toBe("Project not found")

      db.close()
    })

    test("deletes from all tables atomically", async () => {
      const db = createTestDbWithSchema()
      insertTestProject(db, "proj_atomic")
      insertTestSession(db, "sess_atomic_1", "proj_atomic", 2, 3)
      insertTestSession(db, "sess_atomic_2", "proj_atomic", 3, 2)
      // sess_atomic_1: 2 messages * 3 parts = 6 parts
      // sess_atomic_2: 3 messages * 2 parts = 6 parts

      // Before delete
      expect(db.query("SELECT COUNT(*) as count FROM project").get() as any).toEqual({ count: 1 })
      expect(db.query("SELECT COUNT(*) as count FROM session").get() as any).toEqual({ count: 2 })
      expect(db.query("SELECT COUNT(*) as count FROM message").get() as any).toEqual({ count: 5 }) // 2 + 3
      expect(db.query("SELECT COUNT(*) as count FROM part").get() as any).toEqual({ count: 12 }) // 6 + 6

      const result = await deleteProjectMetadataSqlite(["proj_atomic"], { db })

      // After delete - all related data should be gone
      expect(result.removed).toHaveLength(1)
      expect(db.query("SELECT COUNT(*) as count FROM project").get() as any).toEqual({ count: 0 })
      expect(db.query("SELECT COUNT(*) as count FROM session").get() as any).toEqual({ count: 0 })
      expect(db.query("SELECT COUNT(*) as count FROM message").get() as any).toEqual({ count: 0 })
      expect(db.query("SELECT COUNT(*) as count FROM part").get() as any).toEqual({ count: 0 })

      db.close()
    })

    test("works with path string option", async () => {
      // Create a file-based test database
      const db = new Database(testDbPath)
      db.run(`
        CREATE TABLE project (
          id TEXT PRIMARY KEY,
          data TEXT NOT NULL
        )
      `)
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
      db.run(`
        CREATE TABLE message (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          created_at INTEGER,
          data TEXT NOT NULL
        )
      `)
      db.run(`
        CREATE TABLE part (
          id TEXT PRIMARY KEY,
          message_id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          data TEXT NOT NULL
        )
      `)
      
      const projectData = { id: "proj_path_test", path: { worktree: "/test" } }
      db.run(
        "INSERT INTO project (id, data) VALUES (?, ?)",
        ["proj_path_test", JSON.stringify(projectData)]
      )
      db.close()

      // Delete using path string
      const result = await deleteProjectMetadataSqlite(["proj_path_test"], { db: testDbPath })

      expect(result.removed).toHaveLength(1)
      expect(result.removed[0]).toBe("sqlite:project:proj_path_test")
      expect(result.failed).toHaveLength(0)

      // Verify deletion
      const verifyDb = new Database(testDbPath, { readonly: true })
      expect(verifyDb.query("SELECT COUNT(*) as count FROM project").get() as any).toEqual({ count: 0 })
      verifyDb.close()
    })
  })

  describe("updateSessionTitleSqlite", () => {

    /**
     * Helper to create a test database with session schema.
     */
    function createTestDbWithSchema(): Database {
      const db = new Database(":memory:")
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
      return db
    }

    /**
     * Insert a test session.
     */
    function insertTestSession(
      db: Database,
      sessionId: string,
      projectId: string,
      title: string
    ) {
      const now = Date.now()
      const sessionData = { 
        id: sessionId, 
        projectID: projectId, 
        title, 
        time: { created: now, updated: now }
      }
      db.run(
        "INSERT INTO session (id, project_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?)",
        [sessionId, projectId, now, now, JSON.stringify(sessionData)]
      )
    }

    test("updates title correctly", async () => {
      const db = createTestDbWithSchema()
      insertTestSession(db, "sess_title_test", "proj_1", "Original Title")

      await updateSessionTitleSqlite({
        db,
        sessionId: "sess_title_test",
        newTitle: "Updated Title"
      })

      // Verify the title was updated
      const row = db.query("SELECT data FROM session WHERE id = ?").get("sess_title_test") as { data: string }
      const data = JSON.parse(row.data)
      expect(data.title).toBe("Updated Title")

      db.close()
    })

    test("updates updated_at timestamp in both column and data", async () => {
      const db = createTestDbWithSchema()
      const originalTime = Date.now() - 10000 // 10 seconds ago
      const sessionData = { 
        id: "sess_timestamp_test", 
        projectID: "proj_1", 
        title: "Original",
        time: { created: originalTime, updated: originalTime }
      }
      db.run(
        "INSERT INTO session (id, project_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?)",
        ["sess_timestamp_test", "proj_1", originalTime, originalTime, JSON.stringify(sessionData)]
      )

      const beforeUpdate = Date.now()
      await updateSessionTitleSqlite({
        db,
        sessionId: "sess_timestamp_test",
        newTitle: "New Title"
      })
      const afterUpdate = Date.now()

      // Verify column timestamp was updated
      const row = db.query("SELECT updated_at, data FROM session WHERE id = ?").get("sess_timestamp_test") as { 
        updated_at: number
        data: string 
      }
      expect(row.updated_at).toBeGreaterThanOrEqual(beforeUpdate)
      expect(row.updated_at).toBeLessThanOrEqual(afterUpdate)

      // Verify data JSON timestamp was updated
      const data = JSON.parse(row.data)
      expect(data.time.updated).toBeGreaterThanOrEqual(beforeUpdate)
      expect(data.time.updated).toBeLessThanOrEqual(afterUpdate)

      db.close()
    })

    test("preserves other session data fields", async () => {
      const db = createTestDbWithSchema()
      const originalData = { 
        id: "sess_preserve_test", 
        projectID: "proj_1", 
        title: "Original Title",
        version: "1.0.0",
        directory: "/some/path",
        customField: "should be preserved",
        time: { created: Date.now(), updated: Date.now() }
      }
      db.run(
        "INSERT INTO session (id, project_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?)",
        ["sess_preserve_test", "proj_1", Date.now(), Date.now(), JSON.stringify(originalData)]
      )

      await updateSessionTitleSqlite({
        db,
        sessionId: "sess_preserve_test",
        newTitle: "New Title"
      })

      // Verify other fields are preserved
      const row = db.query("SELECT data FROM session WHERE id = ?").get("sess_preserve_test") as { data: string }
      const data = JSON.parse(row.data)
      expect(data.title).toBe("New Title")
      expect(data.version).toBe("1.0.0")
      expect(data.directory).toBe("/some/path")
      expect(data.customField).toBe("should be preserved")
      expect(data.id).toBe("sess_preserve_test")
      expect(data.projectID).toBe("proj_1")

      db.close()
    })

    test("throws error for non-existent session", async () => {
      const db = createTestDbWithSchema()

      await expect(updateSessionTitleSqlite({
        db,
        sessionId: "non_existent_session",
        newTitle: "New Title"
      })).rejects.toThrow("Session not found: non_existent_session")

      db.close()
    })

    test("handles session without existing time object", async () => {
      const db = createTestDbWithSchema()
      // Session data without time field
      const sessionData = { 
        id: "sess_no_time", 
        projectID: "proj_1", 
        title: "Original"
      }
      db.run(
        "INSERT INTO session (id, project_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?)",
        ["sess_no_time", "proj_1", Date.now(), Date.now(), JSON.stringify(sessionData)]
      )

      await updateSessionTitleSqlite({
        db,
        sessionId: "sess_no_time",
        newTitle: "New Title"
      })

      // Verify time.updated was created
      const row = db.query("SELECT data FROM session WHERE id = ?").get("sess_no_time") as { data: string }
      const data = JSON.parse(row.data)
      expect(data.title).toBe("New Title")
      expect(data.time).toBeDefined()
      expect(data.time.updated).toBeDefined()

      db.close()
    })

    test("works with path string option", async () => {
      // Create a file-based test database
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
      
      const sessionData = { id: "sess_path_test", projectID: "proj_1", title: "Original" }
      db.run(
        "INSERT INTO session (id, project_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?)",
        ["sess_path_test", "proj_1", Date.now(), Date.now(), JSON.stringify(sessionData)]
      )
      db.close()

      // Update using path string
      await updateSessionTitleSqlite({
        db: testDbPath,
        sessionId: "sess_path_test",
        newTitle: "Updated via Path"
      })

      // Verify update
      const verifyDb = new Database(testDbPath, { readonly: true })
      const row = verifyDb.query("SELECT data FROM session WHERE id = ?").get("sess_path_test") as { data: string }
      const data = JSON.parse(row.data)
      expect(data.title).toBe("Updated via Path")
      verifyDb.close()
    })
  })

  describe("moveSessionSqlite", () => {

    /**
     * Helper to create a test database with session schema.
     */
    function createTestDbWithSchema(): Database {
      const db = new Database(":memory:")
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
      return db
    }

    /**
     * Insert a test session.
     */
    function insertTestSession(
      db: Database,
      sessionId: string,
      projectId: string,
      title: string,
      directory: string = "/test/path"
    ) {
      const now = Date.now()
      const sessionData = { 
        id: sessionId, 
        projectID: projectId, 
        title, 
        directory,
        version: "1.0.0",
        time: { created: now, updated: now }
      }
      db.run(
        "INSERT INTO session (id, project_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?)",
        [sessionId, projectId, now, now, JSON.stringify(sessionData)]
      )
    }

    test("moves session to new project", async () => {
      const db = createTestDbWithSchema()
      insertTestSession(db, "sess_move_test", "proj_source", "My Session")

      const result = await moveSessionSqlite({
        db,
        sessionId: "sess_move_test",
        targetProjectId: "proj_target"
      })

      // Verify returned record has new project ID
      expect(result.sessionId).toBe("sess_move_test")
      expect(result.projectId).toBe("proj_target")
      expect(result.title).toBe("My Session")

      // Verify database was updated
      const row = db.query("SELECT project_id, data FROM session WHERE id = ?").get("sess_move_test") as { 
        project_id: string
        data: string 
      }
      expect(row.project_id).toBe("proj_target")
      
      const data = JSON.parse(row.data)
      expect(data.projectID).toBe("proj_target")

      db.close()
    })

    test("updates updated_at timestamp in both column and data", async () => {
      const db = createTestDbWithSchema()
      const originalTime = Date.now() - 10000 // 10 seconds ago
      const sessionData = { 
        id: "sess_move_ts_test", 
        projectID: "proj_source", 
        title: "Test Session",
        time: { created: originalTime, updated: originalTime }
      }
      db.run(
        "INSERT INTO session (id, project_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?)",
        ["sess_move_ts_test", "proj_source", originalTime, originalTime, JSON.stringify(sessionData)]
      )

      const beforeMove = Date.now()
      const result = await moveSessionSqlite({
        db,
        sessionId: "sess_move_ts_test",
        targetProjectId: "proj_target"
      })
      const afterMove = Date.now()

      // Verify returned record has new updatedAt
      expect(result.updatedAt).toBeInstanceOf(Date)
      expect(result.updatedAt!.getTime()).toBeGreaterThanOrEqual(beforeMove)
      expect(result.updatedAt!.getTime()).toBeLessThanOrEqual(afterMove)

      // Verify column timestamp was updated
      const row = db.query("SELECT updated_at, data FROM session WHERE id = ?").get("sess_move_ts_test") as { 
        updated_at: number
        data: string 
      }
      expect(row.updated_at).toBeGreaterThanOrEqual(beforeMove)
      expect(row.updated_at).toBeLessThanOrEqual(afterMove)

      // Verify data JSON timestamp was updated
      const data = JSON.parse(row.data)
      expect(data.time.updated).toBeGreaterThanOrEqual(beforeMove)
      expect(data.time.updated).toBeLessThanOrEqual(afterMove)

      db.close()
    })

    test("preserves other session data fields", async () => {
      const db = createTestDbWithSchema()
      const originalData = { 
        id: "sess_move_preserve", 
        projectID: "proj_source", 
        title: "Original Title",
        version: "2.1.0",
        directory: "/some/project/path",
        customField: "should be preserved",
        time: { created: Date.now(), updated: Date.now() }
      }
      db.run(
        "INSERT INTO session (id, project_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?)",
        ["sess_move_preserve", "proj_source", Date.now(), Date.now(), JSON.stringify(originalData)]
      )

      const result = await moveSessionSqlite({
        db,
        sessionId: "sess_move_preserve",
        targetProjectId: "proj_target"
      })

      // Verify returned record preserves fields
      expect(result.title).toBe("Original Title")
      expect(result.version).toBe("2.1.0")
      expect(result.directory).toBe("/some/project/path")

      // Verify other fields are preserved in database
      const row = db.query("SELECT data FROM session WHERE id = ?").get("sess_move_preserve") as { data: string }
      const data = JSON.parse(row.data)
      expect(data.title).toBe("Original Title")
      expect(data.version).toBe("2.1.0")
      expect(data.directory).toBe("/some/project/path")
      expect(data.customField).toBe("should be preserved")
      expect(data.id).toBe("sess_move_preserve")
      expect(data.projectID).toBe("proj_target") // This one should change

      db.close()
    })

    test("throws error for non-existent session", async () => {
      const db = createTestDbWithSchema()

      await expect(moveSessionSqlite({
        db,
        sessionId: "non_existent_session",
        targetProjectId: "proj_target"
      })).rejects.toThrow("Session not found: non_existent_session")

      db.close()
    })

    test("returns correct SessionRecord structure", async () => {
      const db = createTestDbWithSchema()
      insertTestSession(db, "sess_structure_test", "proj_source", "Structure Test", "/my/directory")

      const result = await moveSessionSqlite({
        db,
        sessionId: "sess_structure_test",
        targetProjectId: "proj_target"
      })

      // Verify all SessionRecord fields are present
      expect(result.index).toBe(1)
      expect(result.filePath).toBe("sqlite:session:sess_structure_test")
      expect(result.sessionId).toBe("sess_structure_test")
      expect(result.projectId).toBe("proj_target")
      expect(result.directory).toBe("/my/directory")
      expect(result.title).toBe("Structure Test")
      expect(result.version).toBe("1.0.0")
      expect(result.createdAt).toBeInstanceOf(Date)
      expect(result.updatedAt).toBeInstanceOf(Date)

      db.close()
    })

    test("handles session without existing time object", async () => {
      const db = createTestDbWithSchema()
      // Session data without time field
      const sessionData = { 
        id: "sess_move_no_time", 
        projectID: "proj_source", 
        title: "No Time"
      }
      db.run(
        "INSERT INTO session (id, project_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?)",
        ["sess_move_no_time", "proj_source", Date.now(), Date.now(), JSON.stringify(sessionData)]
      )

      const result = await moveSessionSqlite({
        db,
        sessionId: "sess_move_no_time",
        targetProjectId: "proj_target"
      })

      // Verify time.updated was created
      const row = db.query("SELECT data FROM session WHERE id = ?").get("sess_move_no_time") as { data: string }
      const data = JSON.parse(row.data)
      expect(data.projectID).toBe("proj_target")
      expect(data.time).toBeDefined()
      expect(data.time.updated).toBeDefined()

      // Verify updatedAt is set in returned record
      expect(result.updatedAt).toBeInstanceOf(Date)

      db.close()
    })

    test("works with path string option", async () => {
      // Create a file-based test database
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
      
      const sessionData = { id: "sess_move_path", projectID: "proj_source", title: "Path Test" }
      db.run(
        "INSERT INTO session (id, project_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?)",
        ["sess_move_path", "proj_source", Date.now(), Date.now(), JSON.stringify(sessionData)]
      )
      db.close()

      // Move using path string
      const result = await moveSessionSqlite({
        db: testDbPath,
        sessionId: "sess_move_path",
        targetProjectId: "proj_target"
      })

      expect(result.projectId).toBe("proj_target")

      // Verify update
      const verifyDb = new Database(testDbPath, { readonly: true })
      const row = verifyDb.query("SELECT project_id, data FROM session WHERE id = ?").get("sess_move_path") as { 
        project_id: string
        data: string 
      }
      expect(row.project_id).toBe("proj_target")
      
      const data = JSON.parse(row.data)
      expect(data.projectID).toBe("proj_target")
      verifyDb.close()
    })
  })

  describe("copySessionSqlite", () => {
    /**
     * Helper to create a test database with full schema.
     */
    function createTestDbWithSchema(): Database {
      const db = new Database(":memory:")
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
      db.run(`
        CREATE TABLE message (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          created_at INTEGER,
          data TEXT NOT NULL
        )
      `)
      db.run(`
        CREATE TABLE part (
          id TEXT PRIMARY KEY,
          message_id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          data TEXT NOT NULL
        )
      `)
      return db
    }

    /**
     * Insert a test session with messages and parts.
     */
    function insertTestSessionWithData(
      db: Database,
      sessionId: string,
      projectId: string,
      title: string,
      messageCount: number,
      partsPerMessage: number
    ) {
      const now = Date.now()
      const sessionData = {
        id: sessionId,
        projectID: projectId,
        title,
        directory: "/test/path",
        version: "1.0.0",
        time: { created: now, updated: now }
      }
      db.run(
        "INSERT INTO session (id, project_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?)",
        [sessionId, projectId, now, now, JSON.stringify(sessionData)]
      )

      // Insert messages
      for (let m = 0; m < messageCount; m++) {
        const msgId = `${sessionId}_msg_${m}`
        const msgData = {
          id: msgId,
          sessionID: sessionId,
          role: m % 2 === 0 ? "user" : "assistant",
          content: `Message ${m} content`
        }
        db.run(
          "INSERT INTO message (id, session_id, created_at, data) VALUES (?, ?, ?, ?)",
          [msgId, sessionId, now + m * 1000, JSON.stringify(msgData)]
        )

        // Insert parts for each message
        for (let p = 0; p < partsPerMessage; p++) {
          const partId = `${msgId}_part_${p}`
          const partData = {
            id: partId,
            messageID: msgId,
            sessionID: sessionId,
            type: "text",
            text: `Part ${p} of message ${m}`
          }
          db.run(
            "INSERT INTO part (id, message_id, session_id, data) VALUES (?, ?, ?, ?)",
            [partId, msgId, sessionId, JSON.stringify(partData)]
          )
        }
      }
    }

    test("copies session to new project with new ID", async () => {
      const db = createTestDbWithSchema()
      insertTestSessionWithData(db, "sess_copy_source", "proj_source", "Source Session", 2, 2)

      const result = await copySessionSqlite({
        db,
        sessionId: "sess_copy_source",
        targetProjectId: "proj_target"
      })

      // New session should have a different ID
      expect(result.sessionId).not.toBe("sess_copy_source")
      expect(result.sessionId).toMatch(/^session_\d+_[a-z0-9]+$/)
      expect(result.projectId).toBe("proj_target")
      expect(result.title).toBe("Source Session")
      expect(result.filePath).toMatch(/^sqlite:session:session_/)

      // Original session should still exist
      const originalExists = db.query("SELECT COUNT(*) as count FROM session WHERE id = ?").get("sess_copy_source") as any
      expect(originalExists.count).toBe(1)

      // New session should exist
      const newExists = db.query("SELECT COUNT(*) as count FROM session WHERE id = ?").get(result.sessionId) as any
      expect(newExists.count).toBe(1)

      db.close()
    })

    test("copies all messages with new IDs", async () => {
      const db = createTestDbWithSchema()
      insertTestSessionWithData(db, "sess_copy_msg", "proj_source", "Copy Msgs", 3, 1)

      const result = await copySessionSqlite({
        db,
        sessionId: "sess_copy_msg",
        targetProjectId: "proj_target"
      })

      // Original messages should still exist
      const originalMsgCount = db.query(
        "SELECT COUNT(*) as count FROM message WHERE session_id = ?"
      ).get("sess_copy_msg") as any
      expect(originalMsgCount.count).toBe(3)

      // New messages should exist with new session ID
      const newMsgCount = db.query(
        "SELECT COUNT(*) as count FROM message WHERE session_id = ?"
      ).get(result.sessionId) as any
      expect(newMsgCount.count).toBe(3)

      // New messages should have new IDs
      const newMessages = db.query(
        "SELECT id, data FROM message WHERE session_id = ?"
      ).all(result.sessionId) as { id: string; data: string }[]
      for (const msg of newMessages) {
        expect(msg.id).toMatch(/^msg_\d+_[a-z0-9]+$/)
        const data = JSON.parse(msg.data)
        expect(data.sessionID).toBe(result.sessionId)
      }

      db.close()
    })

    test("copies all parts with new IDs pointing to new messages", async () => {
      const db = createTestDbWithSchema()
      insertTestSessionWithData(db, "sess_copy_parts", "proj_source", "Copy Parts", 2, 3)

      const result = await copySessionSqlite({
        db,
        sessionId: "sess_copy_parts",
        targetProjectId: "proj_target"
      })

      // Original parts should still exist (2 messages * 3 parts = 6)
      const originalPartCount = db.query(
        "SELECT COUNT(*) as count FROM part WHERE session_id = ?"
      ).get("sess_copy_parts") as any
      expect(originalPartCount.count).toBe(6)

      // New parts should exist with new session ID
      const newPartCount = db.query(
        "SELECT COUNT(*) as count FROM part WHERE session_id = ?"
      ).get(result.sessionId) as any
      expect(newPartCount.count).toBe(6)

      // New parts should have new IDs and point to new messages
      const newParts = db.query(
        "SELECT id, message_id, data FROM part WHERE session_id = ?"
      ).all(result.sessionId) as { id: string; message_id: string; data: string }[]
      for (const part of newParts) {
        expect(part.id).toMatch(/^part_\d+_[a-z0-9]+$/)
        expect(part.message_id).toMatch(/^msg_\d+_[a-z0-9]+$/)
        const data = JSON.parse(part.data)
        expect(data.sessionID).toBe(result.sessionId)
        expect(data.messageID).toMatch(/^msg_\d+_[a-z0-9]+$/)
      }

      db.close()
    })

    test("generates unique IDs for all entities", async () => {
      const db = createTestDbWithSchema()
      insertTestSessionWithData(db, "sess_unique_test", "proj_source", "Unique IDs", 2, 2)

      // Copy the same session twice
      const result1 = await copySessionSqlite({
        db,
        sessionId: "sess_unique_test",
        targetProjectId: "proj_target1"
      })

      const result2 = await copySessionSqlite({
        db,
        sessionId: "sess_unique_test",
        targetProjectId: "proj_target2"
      })

      // Session IDs should be unique
      expect(result1.sessionId).not.toBe(result2.sessionId)
      expect(result1.sessionId).not.toBe("sess_unique_test")
      expect(result2.sessionId).not.toBe("sess_unique_test")

      // Total sessions should be 3 (original + 2 copies)
      const sessionCount = db.query("SELECT COUNT(*) as count FROM session").get() as any
      expect(sessionCount.count).toBe(3)

      // Total messages should be 6 (2 original + 2*2 copies)
      const messageCount = db.query("SELECT COUNT(*) as count FROM message").get() as any
      expect(messageCount.count).toBe(6)

      // Total parts should be 12 (4 original + 4*2 copies)
      const partCount = db.query("SELECT COUNT(*) as count FROM part").get() as any
      expect(partCount.count).toBe(12)

      db.close()
    })

    test("sets new timestamps on copied session", async () => {
      const db = createTestDbWithSchema()
      const oldTime = Date.now() - 60000 // 1 minute ago
      const sessionData = {
        id: "sess_old",
        projectID: "proj_source",
        title: "Old Session",
        time: { created: oldTime, updated: oldTime }
      }
      db.run(
        "INSERT INTO session (id, project_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?)",
        ["sess_old", "proj_source", oldTime, oldTime, JSON.stringify(sessionData)]
      )

      const beforeCopy = Date.now()
      const result = await copySessionSqlite({
        db,
        sessionId: "sess_old",
        targetProjectId: "proj_target"
      })
      const afterCopy = Date.now()

      // Verify new timestamps
      expect(result.createdAt).toBeInstanceOf(Date)
      expect(result.updatedAt).toBeInstanceOf(Date)
      expect(result.createdAt!.getTime()).toBeGreaterThanOrEqual(beforeCopy)
      expect(result.createdAt!.getTime()).toBeLessThanOrEqual(afterCopy)
      expect(result.updatedAt!.getTime()).toBeGreaterThanOrEqual(beforeCopy)
      expect(result.updatedAt!.getTime()).toBeLessThanOrEqual(afterCopy)

      // Verify in database
      const row = db.query("SELECT created_at, updated_at, data FROM session WHERE id = ?")
        .get(result.sessionId) as { created_at: number; updated_at: number; data: string }
      expect(row.created_at).toBeGreaterThanOrEqual(beforeCopy)
      expect(row.updated_at).toBeGreaterThanOrEqual(beforeCopy)

      const data = JSON.parse(row.data)
      expect(data.time.created).toBeGreaterThanOrEqual(beforeCopy)
      expect(data.time.updated).toBeGreaterThanOrEqual(beforeCopy)

      db.close()
    })

    test("preserves session data fields", async () => {
      const db = createTestDbWithSchema()
      const sessionData = {
        id: "sess_preserve",
        projectID: "proj_source",
        title: "Preserve Fields",
        directory: "/my/project/path",
        version: "2.5.0",
        customField: "should be preserved",
        time: { created: Date.now(), updated: Date.now() }
      }
      db.run(
        "INSERT INTO session (id, project_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?)",
        ["sess_preserve", "proj_source", Date.now(), Date.now(), JSON.stringify(sessionData)]
      )

      const result = await copySessionSqlite({
        db,
        sessionId: "sess_preserve",
        targetProjectId: "proj_target"
      })

      expect(result.title).toBe("Preserve Fields")
      expect(result.directory).toBe("/my/project/path")
      expect(result.version).toBe("2.5.0")

      // Check customField in database
      const row = db.query("SELECT data FROM session WHERE id = ?").get(result.sessionId) as { data: string }
      const data = JSON.parse(row.data)
      expect(data.customField).toBe("should be preserved")
      expect(data.projectID).toBe("proj_target") // This should be updated

      db.close()
    })

    test("throws error for non-existent session", async () => {
      const db = createTestDbWithSchema()

      await expect(copySessionSqlite({
        db,
        sessionId: "non_existent_session",
        targetProjectId: "proj_target"
      })).rejects.toThrow("Session not found: non_existent_session")

      db.close()
    })

    test("handles session without messages", async () => {
      const db = createTestDbWithSchema()
      const sessionData = {
        id: "sess_no_msgs",
        projectID: "proj_source",
        title: "No Messages"
      }
      db.run(
        "INSERT INTO session (id, project_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?)",
        ["sess_no_msgs", "proj_source", Date.now(), Date.now(), JSON.stringify(sessionData)]
      )

      const result = await copySessionSqlite({
        db,
        sessionId: "sess_no_msgs",
        targetProjectId: "proj_target"
      })

      expect(result.sessionId).not.toBe("sess_no_msgs")
      expect(result.title).toBe("No Messages")

      // No messages should be copied
      const msgCount = db.query("SELECT COUNT(*) as count FROM message WHERE session_id = ?")
        .get(result.sessionId) as any
      expect(msgCount.count).toBe(0)

      db.close()
    })

    test("uses transaction for atomicity", async () => {
      const db = createTestDbWithSchema()
      insertTestSessionWithData(db, "sess_atomic", "proj_source", "Atomic Test", 2, 2)

      // Verify initial state
      expect(db.query("SELECT COUNT(*) as count FROM session").get() as any).toEqual({ count: 1 })
      expect(db.query("SELECT COUNT(*) as count FROM message").get() as any).toEqual({ count: 2 })
      expect(db.query("SELECT COUNT(*) as count FROM part").get() as any).toEqual({ count: 4 })

      const result = await copySessionSqlite({
        db,
        sessionId: "sess_atomic",
        targetProjectId: "proj_target"
      })

      // All entities should be copied atomically
      expect(db.query("SELECT COUNT(*) as count FROM session").get() as any).toEqual({ count: 2 })
      expect(db.query("SELECT COUNT(*) as count FROM message").get() as any).toEqual({ count: 4 })
      expect(db.query("SELECT COUNT(*) as count FROM part").get() as any).toEqual({ count: 8 })

      db.close()
    })

    test("works with path string option", async () => {
      // Create a file-based test database
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
      db.run(`
        CREATE TABLE message (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          created_at INTEGER,
          data TEXT NOT NULL
        )
      `)
      db.run(`
        CREATE TABLE part (
          id TEXT PRIMARY KEY,
          message_id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          data TEXT NOT NULL
        )
      `)
      const sessionData = { id: "sess_path_copy", projectID: "proj_source", title: "Path Test" }
      db.run(
        "INSERT INTO session (id, project_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?)",
        ["sess_path_copy", "proj_source", Date.now(), Date.now(), JSON.stringify(sessionData)]
      )
      db.close()

      // Copy using path string
      const result = await copySessionSqlite({
        db: testDbPath,
        sessionId: "sess_path_copy",
        targetProjectId: "proj_target"
      })

      expect(result.sessionId).not.toBe("sess_path_copy")
      expect(result.projectId).toBe("proj_target")

      // Verify copy exists
      const verifyDb = new Database(testDbPath, { readonly: true })
      const sessionCount = verifyDb.query("SELECT COUNT(*) as count FROM session").get() as any
      expect(sessionCount.count).toBe(2) // Original + copy
      verifyDb.close()
    })
  })

  describe("SQLite lock handling", () => {
    test("write operations fail gracefully when DB is locked", async () => {
      const lockDbPath = join(testDir, "locked.db")
      const locker = new Database(lockDbPath)
      locker.run(`
        CREATE TABLE session (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          parent_id TEXT,
          created_at INTEGER,
          updated_at INTEGER,
          data TEXT NOT NULL
        )
      `)
      locker.run(`
        CREATE TABLE message (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          created_at INTEGER,
          data TEXT NOT NULL
        )
      `)
      locker.run(`
        CREATE TABLE part (
          id TEXT PRIMARY KEY,
          message_id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          data TEXT NOT NULL
        )
      `)
      locker.run(
        "INSERT INTO session (id, project_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?)",
        ["sess_locked", "proj_locked", Date.now(), Date.now(), JSON.stringify({ id: "sess_locked" })]
      )

      // Hold an exclusive lock to simulate OpenCode using the database.
      locker.run("BEGIN EXCLUSIVE")

      try {
        const result = await deleteSessionMetadataSqlite(["sess_locked"], { db: lockDbPath })

        expect(result.removed).toHaveLength(0)
        expect(result.failed).toHaveLength(1)
        expect(result.failed[0].error).toMatch(/locked/i)
        expect(result.failed[0].error).toContain("--force-write")
      } finally {
        locker.run("ROLLBACK")
        locker.close()
        if (existsSync(lockDbPath)) {
          unlinkSync(lockDbPath)
        }
      }
    })
  })
})
