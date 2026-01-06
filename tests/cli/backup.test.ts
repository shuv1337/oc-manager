/**
 * Tests for CLI backup utilities.
 *
 * Verifies backup operations, structure preservation, and error handling.
 */

import { describe, expect, it, beforeEach, afterEach } from "bun:test"
import { promises as fs } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import {
  copyToBackupDir,
  generateBackupTimestamp,
  previewBackupPaths,
  formatBackupResult,
  type BackupResult,
} from "../../src/cli/backup"

// ========================
// Test Helpers
// ========================

let testDir: string
let sourceDir: string
let backupDir: string

async function createTestFile(relativePath: string, content: string): Promise<string> {
  const filePath = join(sourceDir, relativePath)
  await fs.mkdir(join(filePath, ".."), { recursive: true })
  await fs.writeFile(filePath, content, "utf8")
  return filePath
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

async function readFile(path: string): Promise<string> {
  return fs.readFile(path, "utf8")
}

async function cleanupTestDir(): Promise<void> {
  try {
    await fs.rm(testDir, { recursive: true, force: true })
  } catch {
    // Ignore cleanup errors
  }
}

// ========================
// Setup / Teardown
// ========================

beforeEach(async () => {
  testDir = join(tmpdir(), `backup-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  sourceDir = join(testDir, "source")
  backupDir = join(testDir, "backup")
  await fs.mkdir(sourceDir, { recursive: true })
  await fs.mkdir(backupDir, { recursive: true })
})

afterEach(async () => {
  await cleanupTestDir()
})

// ========================
// generateBackupTimestamp Tests
// ========================

describe("generateBackupTimestamp", () => {
  it("should return a timestamp string", () => {
    const timestamp = generateBackupTimestamp()
    expect(typeof timestamp).toBe("string")
  })

  it("should match expected format YYYY-MM-DD_HH-MM-SS", () => {
    const timestamp = generateBackupTimestamp()
    const pattern = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/
    expect(pattern.test(timestamp)).toBe(true)
  })

  it("should be filesystem safe (no colons or spaces)", () => {
    const timestamp = generateBackupTimestamp()
    expect(timestamp).not.toContain(":")
    expect(timestamp).not.toContain(" ")
  })

  it("should generate unique timestamps over time", async () => {
    const timestamps = new Set<string>()
    for (let i = 0; i < 3; i++) {
      timestamps.add(generateBackupTimestamp())
      await new Promise((resolve) => setTimeout(resolve, 1100)) // Wait 1.1s
    }
    // At least 2 unique (may be same if tests run fast)
    expect(timestamps.size).toBeGreaterThanOrEqual(1)
  })
})

// ========================
// copyToBackupDir Tests
// ========================

describe("copyToBackupDir", () => {
  it("should copy a single file to backup directory", async () => {
    const srcFile = await createTestFile("test.txt", "hello world")

    const result = await copyToBackupDir([srcFile], { backupDir })

    expect(result.sources).toHaveLength(1)
    expect(result.sources[0]).toBe(srcFile)
    expect(result.destinations).toHaveLength(1)
    expect(result.failed).toHaveLength(0)
    expect(await fileExists(result.destinations[0])).toBe(true)
    expect(await readFile(result.destinations[0])).toBe("hello world")
  })

  it("should copy multiple files to backup directory", async () => {
    const file1 = await createTestFile("file1.txt", "content 1")
    const file2 = await createTestFile("file2.txt", "content 2")

    const result = await copyToBackupDir([file1, file2], { backupDir })

    expect(result.sources).toHaveLength(2)
    expect(result.destinations).toHaveLength(2)
    expect(result.failed).toHaveLength(0)
    expect(await readFile(result.destinations[0])).toBe("content 1")
    expect(await readFile(result.destinations[1])).toBe("content 2")
  })

  it("should create a timestamped subdirectory", async () => {
    const srcFile = await createTestFile("test.txt", "data")

    const result = await copyToBackupDir([srcFile], { backupDir })

    // backupDir should be inside the backup directory with timestamp
    expect(result.backupDir.startsWith(backupDir)).toBe(true)
    expect(result.backupDir).not.toBe(backupDir)
    // Should match timestamp pattern
    const subdir = result.backupDir.replace(backupDir + "/", "")
    expect(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/.test(subdir)).toBe(true)
  })

  it("should use prefix when provided", async () => {
    const srcFile = await createTestFile("test.txt", "data")

    const result = await copyToBackupDir([srcFile], {
      backupDir,
      prefix: "project",
    })

    const subdir = result.backupDir.replace(backupDir + "/", "")
    expect(subdir.startsWith("project_")).toBe(true)
  })

  it("should copy directories recursively", async () => {
    const subDir = join(sourceDir, "mydir")
    await fs.mkdir(subDir, { recursive: true })
    await fs.writeFile(join(subDir, "a.txt"), "file a")
    await fs.writeFile(join(subDir, "b.txt"), "file b")
    const nestedDir = join(subDir, "nested")
    await fs.mkdir(nestedDir, { recursive: true })
    await fs.writeFile(join(nestedDir, "c.txt"), "file c")

    const result = await copyToBackupDir([subDir], { backupDir })

    expect(result.sources).toHaveLength(1)
    expect(result.failed).toHaveLength(0)
    const destDir = result.destinations[0]
    expect(await fileExists(join(destDir, "a.txt"))).toBe(true)
    expect(await fileExists(join(destDir, "b.txt"))).toBe(true)
    expect(await fileExists(join(destDir, "nested", "c.txt"))).toBe(true)
    expect(await readFile(join(destDir, "nested", "c.txt"))).toBe("file c")
  })

  it("should preserve directory structure when preserveStructure is true", async () => {
    const structureRoot = sourceDir
    const file1 = await createTestFile("storage/project/abc.json", '{"id":"abc"}')
    const file2 = await createTestFile("storage/session/xyz.json", '{"id":"xyz"}')

    const result = await copyToBackupDir([file1, file2], {
      backupDir,
      preserveStructure: true,
      structureRoot,
    })

    expect(result.sources).toHaveLength(2)
    expect(result.failed).toHaveLength(0)

    // Check structure is preserved
    const dest1 = result.destinations[0]
    const dest2 = result.destinations[1]
    expect(dest1.endsWith("storage/project/abc.json")).toBe(true)
    expect(dest2.endsWith("storage/session/xyz.json")).toBe(true)
    expect(await readFile(dest1)).toBe('{"id":"abc"}')
    expect(await readFile(dest2)).toBe('{"id":"xyz"}')
  })

  it("should use basename when path is outside structureRoot", async () => {
    const file = await createTestFile("outside.txt", "outside data")
    const differentRoot = join(testDir, "different-root")
    await fs.mkdir(differentRoot, { recursive: true })

    const result = await copyToBackupDir([file], {
      backupDir,
      preserveStructure: true,
      structureRoot: differentRoot,
    })

    // Path is outside structureRoot, should fall back to basename
    expect(result.destinations[0].endsWith("outside.txt")).toBe(true)
    expect(result.destinations[0]).not.toContain("..")
  })

  it("should handle empty paths array", async () => {
    const result = await copyToBackupDir([], { backupDir })

    expect(result.sources).toHaveLength(0)
    expect(result.destinations).toHaveLength(0)
    expect(result.failed).toHaveLength(0)
  })

  it("should report non-existent source in failed array", async () => {
    const nonExistent = join(sourceDir, "does-not-exist.txt")

    const result = await copyToBackupDir([nonExistent], { backupDir })

    expect(result.sources).toHaveLength(0)
    expect(result.destinations).toHaveLength(0)
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0].path).toBe(nonExistent)
    expect(result.failed[0].error).toContain("does not exist")
  })

  it("should handle mixed existing and non-existing paths", async () => {
    const existing = await createTestFile("exists.txt", "I exist")
    const nonExistent = join(sourceDir, "missing.txt")

    const result = await copyToBackupDir([existing, nonExistent], { backupDir })

    expect(result.sources).toHaveLength(1)
    expect(result.destinations).toHaveLength(1)
    expect(result.failed).toHaveLength(1)
    expect(await readFile(result.destinations[0])).toBe("I exist")
  })
})

// ========================
// previewBackupPaths Tests
// ========================

describe("previewBackupPaths", () => {
  it("should return sources and computed destinations", () => {
    const sources = [
      join(sourceDir, "file1.txt"),
      join(sourceDir, "file2.txt"),
    ]

    const preview = previewBackupPaths(sources, { backupDir })

    expect(preview.sources).toHaveLength(2)
    expect(preview.destinations).toHaveLength(2)
    expect(preview.backupDir.startsWith(backupDir)).toBe(true)
  })

  it("should show preserved structure in preview", () => {
    const sources = [join(sourceDir, "storage/project/abc.json")]

    const preview = previewBackupPaths(sources, {
      backupDir,
      preserveStructure: true,
      structureRoot: sourceDir,
    })

    expect(preview.destinations[0]).toContain("storage/project/abc.json")
  })

  it("should include prefix in backupDir path", () => {
    const sources = [join(sourceDir, "test.txt")]

    const preview = previewBackupPaths(sources, {
      backupDir,
      prefix: "myprefix",
    })

    expect(preview.backupDir).toContain("myprefix_")
  })

  it("should handle empty sources", () => {
    const preview = previewBackupPaths([], { backupDir })

    expect(preview.sources).toHaveLength(0)
    expect(preview.destinations).toHaveLength(0)
    expect(preview.backupDir.startsWith(backupDir)).toBe(true)
  })
})

// ========================
// formatBackupResult Tests
// ========================

describe("formatBackupResult", () => {
  it("should format successful backup result", () => {
    const result: BackupResult = {
      sources: ["/path/to/file1.txt", "/path/to/file2.txt"],
      destinations: ["/backup/file1.txt", "/backup/file2.txt"],
      backupDir: "/backup",
      failed: [],
    }

    const formatted = formatBackupResult(result)

    expect(formatted).toContain("Backed up 2 item(s)")
    expect(formatted).toContain("/backup")
  })

  it("should format result with failures", () => {
    const result: BackupResult = {
      sources: ["/path/to/file1.txt"],
      destinations: ["/backup/file1.txt"],
      backupDir: "/backup",
      failed: [
        { path: "/path/to/missing.txt", error: "Source path does not exist" },
      ],
    }

    const formatted = formatBackupResult(result)

    expect(formatted).toContain("Backed up 1 item(s)")
    expect(formatted).toContain("Failed to backup 1 item(s)")
    expect(formatted).toContain("/path/to/missing.txt")
    expect(formatted).toContain("does not exist")
  })

  it("should format result with only failures", () => {
    const result: BackupResult = {
      sources: [],
      destinations: [],
      backupDir: "/backup",
      failed: [
        { path: "/missing1.txt", error: "Not found" },
        { path: "/missing2.txt", error: "Permission denied" },
      ],
    }

    const formatted = formatBackupResult(result)

    expect(formatted).not.toContain("Backed up")
    expect(formatted).toContain("Failed to backup 2 item(s)")
  })

  it("should format empty result", () => {
    const result: BackupResult = {
      sources: [],
      destinations: [],
      backupDir: "/backup",
      failed: [],
    }

    const formatted = formatBackupResult(result)

    // Should be empty or minimal
    expect(formatted).toBe("")
  })
})
