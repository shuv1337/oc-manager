import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Database } from "bun:sqlite"
import { existsSync, unlinkSync } from "node:fs"

describe("bun:sqlite availability", () => {
  const testDbPath = "/tmp/oc-manager-sqlite-test.db"

  afterEach(() => {
    // Clean up test database after each test
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath)
    }
  })

  test("Database class is importable from bun:sqlite", () => {
    expect(Database).toBeDefined()
    expect(typeof Database).toBe("function")
  })

  test("can create an in-memory database", () => {
    const db = new Database(":memory:")
    expect(db).toBeDefined()
    db.close()
  })

  test("can create a file-based database", () => {
    const db = new Database(testDbPath)
    expect(db).toBeDefined()
    expect(existsSync(testDbPath)).toBe(true)
    db.close()
  })

  test("can create tables and insert data", () => {
    const db = new Database(":memory:")

    db.run(`
      CREATE TABLE test_table (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        data TEXT
      )
    `)

    const insert = db.prepare("INSERT INTO test_table (name, data) VALUES (?, ?)")
    insert.run("test_name", JSON.stringify({ foo: "bar" }))

    const rows = db.query("SELECT * FROM test_table").all()
    expect(rows).toHaveLength(1)
    expect((rows[0] as any).name).toBe("test_name")
    expect(JSON.parse((rows[0] as any).data)).toEqual({ foo: "bar" })

    db.close()
  })

  test("can open database in readonly mode", () => {
    // First create a database with some data
    const db = new Database(testDbPath)
    db.run("CREATE TABLE test (id INTEGER PRIMARY KEY)")
    db.run("INSERT INTO test (id) VALUES (1)")
    db.close()

    // Now open it in readonly mode
    const readonlyDb = new Database(testDbPath, { readonly: true })
    const rows = readonlyDb.query("SELECT * FROM test").all()
    expect(rows).toHaveLength(1)

    // Verify writes fail in readonly mode
    expect(() => {
      readonlyDb.run("INSERT INTO test (id) VALUES (2)")
    }).toThrow()

    readonlyDb.close()
  })

  test("transactions work correctly", () => {
    const db = new Database(":memory:")
    db.run("CREATE TABLE test (id INTEGER PRIMARY KEY, value INTEGER)")

    // Use transaction
    const insertMany = db.transaction((values: number[]) => {
      const insert = db.prepare("INSERT INTO test (value) VALUES (?)")
      for (const value of values) {
        insert.run(value)
      }
      return values.length
    })

    const count = insertMany([1, 2, 3, 4, 5])
    expect(count).toBe(5)

    const rows = db.query("SELECT * FROM test").all()
    expect(rows).toHaveLength(5)

    db.close()
  })

  test("prepared statements work correctly", () => {
    const db = new Database(":memory:")
    db.run("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)")

    const insert = db.prepare("INSERT INTO test (name) VALUES (?)")
    const select = db.prepare("SELECT * FROM test WHERE name = ?")

    insert.run("alice")
    insert.run("bob")

    const alice = select.get("alice") as any
    expect(alice).toBeDefined()
    expect(alice.name).toBe("alice")

    const bob = select.get("bob") as any
    expect(bob).toBeDefined()
    expect(bob.name).toBe("bob")

    db.close()
  })

  test("handles NULL values correctly", () => {
    const db = new Database(":memory:")
    db.run("CREATE TABLE test (id INTEGER PRIMARY KEY, nullable_col TEXT)")

    db.run("INSERT INTO test (nullable_col) VALUES (NULL)")
    db.run("INSERT INTO test (nullable_col) VALUES ('not null')")

    const rows = db.query("SELECT * FROM test ORDER BY id").all() as any[]
    expect(rows[0].nullable_col).toBeNull()
    expect(rows[1].nullable_col).toBe("not null")

    db.close()
  })
})
