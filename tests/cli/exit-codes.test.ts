/**
 * Tests for CLI exit codes.
 *
 * This file provides comprehensive tests for exit code behavior across
 * all CLI commands, organized by exit code type:
 *
 * - Exit code 2: Usage errors (missing --yes, invalid arguments)
 * - Exit code 3: Missing resources (invalid project/session IDs) - see separate file
 * - Exit code 4: File operation failures (backup/delete failed) - see separate file
 *
 * Uses fixture store at tests/fixtures/store.
 */

import { describe, expect, it, beforeEach, afterEach } from "bun:test"
import { $ } from "bun"
import { promises as fs } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { FIXTURE_STORE_ROOT } from "../helpers"

// ========================
// Exit Code 2: Usage Errors
// ========================

describe("Exit Code 2: Usage Errors", () => {
  describe("projects delete without --yes", () => {
    it("returns exit code 2", async () => {
      const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_present --root ${FIXTURE_STORE_ROOT}`.quiet().nothrow()
      expect(result.exitCode).toBe(2)
    })

    it("returns exit code 2 with --format json", async () => {
      const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_present --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow()
      expect(result.exitCode).toBe(2)
    })

    it("outputs error mentioning --yes flag", async () => {
      const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_present --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow()
      const output = result.stderr.toString()
      const parsed = JSON.parse(output)
      expect(parsed).toHaveProperty("ok", false)
      expect(parsed.error).toContain("--yes")
    })

    it("suggests --dry-run in error message", async () => {
      const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_present --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow()
      const output = result.stderr.toString()
      const parsed = JSON.parse(output)
      expect(parsed.error).toContain("--dry-run")
    })

    it("does not delete the file", async () => {
      // Run delete without --yes
      await $`bun src/bin/opencode-manager.ts projects delete --id proj_present --root ${FIXTURE_STORE_ROOT}`.quiet().nothrow()

      // Verify file still exists
      const filePath = join(FIXTURE_STORE_ROOT, "storage", "project", "proj_present.json")
      const exists = await fs.access(filePath).then(() => true).catch(() => false)
      expect(exists).toBe(true)
    })
  })

  describe("sessions delete without --yes", () => {
    it("returns exit code 2", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions delete --session session_parser_fix --root ${FIXTURE_STORE_ROOT}`.quiet().nothrow()
      expect(result.exitCode).toBe(2)
    })

    it("returns exit code 2 with --format json", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions delete --session session_parser_fix --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow()
      expect(result.exitCode).toBe(2)
    })

    it("outputs error mentioning --yes flag", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions delete --session session_parser_fix --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow()
      const output = result.stderr.toString()
      const parsed = JSON.parse(output)
      expect(parsed).toHaveProperty("ok", false)
      expect(parsed.error).toContain("--yes")
    })

    it("suggests --dry-run in error message", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions delete --session session_parser_fix --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow()
      const output = result.stderr.toString()
      const parsed = JSON.parse(output)
      expect(parsed.error).toContain("--dry-run")
    })

    it("does not delete the file", async () => {
      // Run delete without --yes
      await $`bun src/bin/opencode-manager.ts sessions delete --session session_parser_fix --root ${FIXTURE_STORE_ROOT}`.quiet().nothrow()

      // Verify file still exists
      const filePath = join(FIXTURE_STORE_ROOT, "storage", "session", "proj_present", "session_parser_fix.json")
      const exists = await fs.access(filePath).then(() => true).catch(() => false)
      expect(exists).toBe(true)
    })
  })

  describe("sessions rename with empty title", () => {
    // Note: Empty string "" in bun shell becomes a missing argument (exit code 1 from commander)
    // We test with whitespace-only titles which trigger our UsageError validation (exit code 2)
    it("returns exit code 2 for whitespace-only title", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions rename --session session_parser_fix --title "   " --root ${FIXTURE_STORE_ROOT}`.quiet().nothrow()
      expect(result.exitCode).toBe(2)
    })

    it("returns exit code 2 for tabs-only title", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions rename --session session_parser_fix --title "		" --root ${FIXTURE_STORE_ROOT}`.quiet().nothrow()
      expect(result.exitCode).toBe(2)
    })

    it("outputs error about empty title in JSON format", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions rename --session session_parser_fix --title "   " --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow()
      const output = result.stderr.toString()
      const parsed = JSON.parse(output)
      expect(parsed).toHaveProperty("ok", false)
      expect(parsed.error.toLowerCase()).toContain("empty")
    })

    it("does not modify the session file", async () => {
      // Read original content
      const filePath = join(FIXTURE_STORE_ROOT, "storage", "session", "proj_present", "session_parser_fix.json")
      const originalContent = await fs.readFile(filePath, "utf-8")
      const originalParsed = JSON.parse(originalContent)

      // Attempt rename with whitespace-only title
      await $`bun src/bin/opencode-manager.ts sessions rename --session session_parser_fix --title "   " --root ${FIXTURE_STORE_ROOT}`.quiet().nothrow()

      // Verify content unchanged
      const newContent = await fs.readFile(filePath, "utf-8")
      const newParsed = JSON.parse(newContent)
      expect(newParsed.title).toBe(originalParsed.title)
    })
  })

  describe("table format output for usage errors", () => {
    it("projects delete outputs readable error in table format", async () => {
      const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_present --root ${FIXTURE_STORE_ROOT} --format table`.quiet().nothrow()
      expect(result.exitCode).toBe(2)
      const output = result.stderr.toString()
      expect(output).toContain("--yes")
      expect(output).toContain("Error")
    })

    it("sessions delete outputs readable error in table format", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions delete --session session_parser_fix --root ${FIXTURE_STORE_ROOT} --format table`.quiet().nothrow()
      expect(result.exitCode).toBe(2)
      const output = result.stderr.toString()
      expect(output).toContain("--yes")
      expect(output).toContain("Error")
    })

    it("sessions rename outputs readable error in table format", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions rename --session session_parser_fix --title "   " --root ${FIXTURE_STORE_ROOT} --format table`.quiet().nothrow()
      expect(result.exitCode).toBe(2)
      const output = result.stderr.toString()
      expect(output).toContain("Error")
    })
  })

  describe("ndjson format output for usage errors", () => {
    it("projects delete outputs error in ndjson format", async () => {
      const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_present --root ${FIXTURE_STORE_ROOT} --format ndjson`.quiet().nothrow()
      expect(result.exitCode).toBe(2)
      const output = result.stderr.toString().trim()
      const parsed = JSON.parse(output)
      expect(parsed).toHaveProperty("ok", false)
      expect(parsed.error).toContain("--yes")
    })

    it("sessions delete outputs error in ndjson format", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions delete --session session_parser_fix --root ${FIXTURE_STORE_ROOT} --format ndjson`.quiet().nothrow()
      expect(result.exitCode).toBe(2)
      const output = result.stderr.toString().trim()
      const parsed = JSON.parse(output)
      expect(parsed).toHaveProperty("ok", false)
      expect(parsed.error).toContain("--yes")
    })

    it("sessions rename outputs error in ndjson format", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions rename --session session_parser_fix --title "   " --root ${FIXTURE_STORE_ROOT} --format ndjson`.quiet().nothrow()
      expect(result.exitCode).toBe(2)
      const output = result.stderr.toString().trim()
      const parsed = JSON.parse(output)
      expect(parsed).toHaveProperty("ok", false)
    })
  })

  describe("usage error with --dry-run still requires valid session/project", () => {
    // --dry-run should bypass --yes requirement but still validate the resource exists
    it("projects delete --dry-run succeeds without --yes", async () => {
      const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_present --root ${FIXTURE_STORE_ROOT} --dry-run`.quiet().nothrow()
      expect(result.exitCode).toBe(0)
    })

    it("sessions delete --dry-run succeeds without --yes", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions delete --session session_parser_fix --root ${FIXTURE_STORE_ROOT} --dry-run`.quiet().nothrow()
      expect(result.exitCode).toBe(0)
    })
  })
})

// ========================
// Exit Code 3: Missing Resources
// ========================

describe("Exit Code 3: Missing Resources", () => {
  describe("projects delete with non-existent ID", () => {
    it("returns exit code 3", async () => {
      const result = await $`bun src/bin/opencode-manager.ts projects delete --id nonexistent_project --yes --root ${FIXTURE_STORE_ROOT}`.quiet().nothrow()
      expect(result.exitCode).toBe(3)
    })

    it("returns exit code 3 with --format json", async () => {
      const result = await $`bun src/bin/opencode-manager.ts projects delete --id nonexistent_project --yes --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow()
      expect(result.exitCode).toBe(3)
    })

    it("outputs error mentioning project not found in JSON", async () => {
      const result = await $`bun src/bin/opencode-manager.ts projects delete --id nonexistent_project --yes --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow()
      const output = result.stderr.toString()
      const parsed = JSON.parse(output)
      expect(parsed).toHaveProperty("ok", false)
      expect(parsed.error.toLowerCase()).toMatch(/project.*not found|not found.*project/)
    })

    it("returns exit code 3 with --dry-run", async () => {
      const result = await $`bun src/bin/opencode-manager.ts projects delete --id nonexistent_project --root ${FIXTURE_STORE_ROOT} --dry-run`.quiet().nothrow()
      expect(result.exitCode).toBe(3)
    })
  })

  describe("sessions delete with non-existent ID", () => {
    it("returns exit code 3", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions delete --session nonexistent_session --yes --root ${FIXTURE_STORE_ROOT}`.quiet().nothrow()
      expect(result.exitCode).toBe(3)
    })

    it("returns exit code 3 with --format json", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions delete --session nonexistent_session --yes --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow()
      expect(result.exitCode).toBe(3)
    })

    it("outputs error mentioning session not found in JSON", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions delete --session nonexistent_session --yes --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow()
      const output = result.stderr.toString()
      const parsed = JSON.parse(output)
      expect(parsed).toHaveProperty("ok", false)
      expect(parsed.error.toLowerCase()).toMatch(/session.*not found|not found.*session/)
    })

    it("returns exit code 3 with --dry-run", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions delete --session nonexistent_session --root ${FIXTURE_STORE_ROOT} --dry-run`.quiet().nothrow()
      expect(result.exitCode).toBe(3)
    })
  })

  describe("sessions rename with non-existent ID", () => {
    it("returns exit code 3", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions rename --session nonexistent_session --title "New Title" --root ${FIXTURE_STORE_ROOT}`.quiet().nothrow()
      expect(result.exitCode).toBe(3)
    })

    it("returns exit code 3 with --format json", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions rename --session nonexistent_session --title "New Title" --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow()
      expect(result.exitCode).toBe(3)
    })

    it("outputs error mentioning session not found in JSON", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions rename --session nonexistent_session --title "New Title" --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow()
      const output = result.stderr.toString()
      const parsed = JSON.parse(output)
      expect(parsed).toHaveProperty("ok", false)
      expect(parsed.error.toLowerCase()).toMatch(/session.*not found|not found.*session/)
    })
  })

  describe("sessions move with non-existent session ID", () => {
    it("returns exit code 3", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions move --session nonexistent_session --to proj_present --root ${FIXTURE_STORE_ROOT}`.quiet().nothrow()
      expect(result.exitCode).toBe(3)
    })

    it("outputs error mentioning session not found in JSON", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions move --session nonexistent_session --to proj_present --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow()
      const output = result.stderr.toString()
      const parsed = JSON.parse(output)
      expect(parsed).toHaveProperty("ok", false)
      expect(parsed.error.toLowerCase()).toMatch(/session.*not found|not found.*session/)
    })
  })

  describe("sessions move with non-existent project ID", () => {
    it("returns exit code 3", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions move --session session_parser_fix --to nonexistent_project --root ${FIXTURE_STORE_ROOT}`.quiet().nothrow()
      expect(result.exitCode).toBe(3)
    })

    it("outputs error mentioning project not found in JSON", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions move --session session_parser_fix --to nonexistent_project --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow()
      const output = result.stderr.toString()
      const parsed = JSON.parse(output)
      expect(parsed).toHaveProperty("ok", false)
      expect(parsed.error.toLowerCase()).toMatch(/project.*not found|not found.*project/)
    })
  })

  describe("sessions copy with non-existent session ID", () => {
    it("returns exit code 3", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions copy --session nonexistent_session --to proj_present --root ${FIXTURE_STORE_ROOT}`.quiet().nothrow()
      expect(result.exitCode).toBe(3)
    })

    it("outputs error mentioning session not found in JSON", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions copy --session nonexistent_session --to proj_present --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow()
      const output = result.stderr.toString()
      const parsed = JSON.parse(output)
      expect(parsed).toHaveProperty("ok", false)
      expect(parsed.error.toLowerCase()).toMatch(/session.*not found|not found.*session/)
    })
  })

  describe("sessions copy with non-existent project ID", () => {
    it("returns exit code 3", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions copy --session session_parser_fix --to nonexistent_project --root ${FIXTURE_STORE_ROOT}`.quiet().nothrow()
      expect(result.exitCode).toBe(3)
    })

    it("outputs error mentioning project not found in JSON", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions copy --session session_parser_fix --to nonexistent_project --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow()
      const output = result.stderr.toString()
      const parsed = JSON.parse(output)
      expect(parsed).toHaveProperty("ok", false)
      expect(parsed.error.toLowerCase()).toMatch(/project.*not found|not found.*project/)
    })
  })

  describe("tokens session with non-existent session ID", () => {
    it("returns exit code 3", async () => {
      const result = await $`bun src/bin/opencode-manager.ts tokens session --session nonexistent_session --root ${FIXTURE_STORE_ROOT}`.quiet().nothrow()
      expect(result.exitCode).toBe(3)
    })

    it("returns exit code 3 with --format json", async () => {
      const result = await $`bun src/bin/opencode-manager.ts tokens session --session nonexistent_session --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow()
      expect(result.exitCode).toBe(3)
    })

    it("outputs error mentioning session not found in JSON", async () => {
      const result = await $`bun src/bin/opencode-manager.ts tokens session --session nonexistent_session --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow()
      const output = result.stderr.toString()
      const parsed = JSON.parse(output)
      expect(parsed).toHaveProperty("ok", false)
      expect(parsed.error.toLowerCase()).toMatch(/session.*not found|not found.*session/)
    })
  })

  describe("tokens project with non-existent project ID", () => {
    it("returns exit code 3", async () => {
      const result = await $`bun src/bin/opencode-manager.ts tokens project --project nonexistent_project --root ${FIXTURE_STORE_ROOT}`.quiet().nothrow()
      expect(result.exitCode).toBe(3)
    })

    it("returns exit code 3 with --format json", async () => {
      const result = await $`bun src/bin/opencode-manager.ts tokens project --project nonexistent_project --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow()
      expect(result.exitCode).toBe(3)
    })

    it("outputs error mentioning project not found in JSON", async () => {
      const result = await $`bun src/bin/opencode-manager.ts tokens project --project nonexistent_project --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow()
      const output = result.stderr.toString()
      const parsed = JSON.parse(output)
      expect(parsed).toHaveProperty("ok", false)
      expect(parsed.error.toLowerCase()).toMatch(/project.*not found|not found.*project/)
    })
  })

  describe("table format output for missing resources", () => {
    it("projects delete outputs readable error in table format", async () => {
      const result = await $`bun src/bin/opencode-manager.ts projects delete --id nonexistent_project --yes --root ${FIXTURE_STORE_ROOT} --format table`.quiet().nothrow()
      expect(result.exitCode).toBe(3)
      const output = result.stderr.toString()
      expect(output).toContain("Error")
    })

    it("sessions delete outputs readable error in table format", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions delete --session nonexistent_session --yes --root ${FIXTURE_STORE_ROOT} --format table`.quiet().nothrow()
      expect(result.exitCode).toBe(3)
      const output = result.stderr.toString()
      expect(output).toContain("Error")
    })

    it("tokens session outputs readable error in table format", async () => {
      const result = await $`bun src/bin/opencode-manager.ts tokens session --session nonexistent_session --root ${FIXTURE_STORE_ROOT} --format table`.quiet().nothrow()
      expect(result.exitCode).toBe(3)
      const output = result.stderr.toString()
      expect(output).toContain("Error")
    })

    it("tokens project outputs readable error in table format", async () => {
      const result = await $`bun src/bin/opencode-manager.ts tokens project --project nonexistent_project --root ${FIXTURE_STORE_ROOT} --format table`.quiet().nothrow()
      expect(result.exitCode).toBe(3)
      const output = result.stderr.toString()
      expect(output).toContain("Error")
    })
  })

  describe("ndjson format output for missing resources", () => {
    it("projects delete outputs error in ndjson format", async () => {
      const result = await $`bun src/bin/opencode-manager.ts projects delete --id nonexistent_project --yes --root ${FIXTURE_STORE_ROOT} --format ndjson`.quiet().nothrow()
      expect(result.exitCode).toBe(3)
      const output = result.stderr.toString().trim()
      const parsed = JSON.parse(output)
      expect(parsed).toHaveProperty("ok", false)
    })

    it("sessions delete outputs error in ndjson format", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions delete --session nonexistent_session --yes --root ${FIXTURE_STORE_ROOT} --format ndjson`.quiet().nothrow()
      expect(result.exitCode).toBe(3)
      const output = result.stderr.toString().trim()
      const parsed = JSON.parse(output)
      expect(parsed).toHaveProperty("ok", false)
    })

    it("tokens session outputs error in ndjson format", async () => {
      const result = await $`bun src/bin/opencode-manager.ts tokens session --session nonexistent_session --root ${FIXTURE_STORE_ROOT} --format ndjson`.quiet().nothrow()
      expect(result.exitCode).toBe(3)
      const output = result.stderr.toString().trim()
      const parsed = JSON.parse(output)
      expect(parsed).toHaveProperty("ok", false)
    })

    it("tokens project outputs error in ndjson format", async () => {
      const result = await $`bun src/bin/opencode-manager.ts tokens project --project nonexistent_project --root ${FIXTURE_STORE_ROOT} --format ndjson`.quiet().nothrow()
      expect(result.exitCode).toBe(3)
      const output = result.stderr.toString().trim()
      const parsed = JSON.parse(output)
      expect(parsed).toHaveProperty("ok", false)
    })
  })
})

// ========================
// Exit Code 4: File Operation Failures
// ========================

describe("Exit Code 4: File Operation Failures", () => {
  let tempRoot: string

  // Create a temp copy of fixture store to test file operation failures
  beforeEach(async () => {
    tempRoot = join(tmpdir(), `oc-test-exit4-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await fs.mkdir(tempRoot, { recursive: true })
    
    // Copy fixture structure to temp
    await fs.mkdir(join(tempRoot, "storage", "project"), { recursive: true })
    await fs.mkdir(join(tempRoot, "storage", "session", "proj_deletable"), { recursive: true })
    
    // Create a deletable project
    await fs.writeFile(
      join(tempRoot, "storage", "project", "proj_deletable.json"),
      JSON.stringify({
        id: "proj_deletable",
        worktree: "/tmp/deletable-project",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      })
    )
    
    // Create a deletable session
    await fs.writeFile(
      join(tempRoot, "storage", "session", "proj_deletable", "session_deletable.json"),
      JSON.stringify({
        id: "session_deletable",
        projectID: "proj_deletable",
        title: "Deletable Session",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      })
    )
  })

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempRoot, { recursive: true, force: true })
  })

  describe("backup to non-writable directory", () => {
    let readOnlyBackupDir: string

    beforeEach(async () => {
      // Create a read-only backup directory
      readOnlyBackupDir = join(tempRoot, "readonly-backup")
      await fs.mkdir(readOnlyBackupDir)
      await fs.chmod(readOnlyBackupDir, 0o444) // read-only
    })

    afterEach(async () => {
      // Restore permissions for cleanup
      await fs.chmod(readOnlyBackupDir, 0o755).catch(() => {})
    })

    it("projects delete with --backup-dir to read-only dir returns exit code 4", async () => {
      const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_deletable --yes --backup-dir ${readOnlyBackupDir} --root ${tempRoot}`.quiet().nothrow()
      expect(result.exitCode).toBe(4)
    })

    it("projects delete outputs error mentioning backup failure in JSON", async () => {
      const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_deletable --yes --backup-dir ${readOnlyBackupDir} --root ${tempRoot} --format json`.quiet().nothrow()
      expect(result.exitCode).toBe(4)
      const output = result.stderr.toString()
      const parsed = JSON.parse(output)
      expect(parsed).toHaveProperty("ok", false)
      expect(parsed.error.toLowerCase()).toMatch(/backup|failed|permission|denied|create/)
    })

    it("sessions delete with --backup-dir to read-only dir returns exit code 4", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions delete --session session_deletable --yes --backup-dir ${readOnlyBackupDir} --root ${tempRoot}`.quiet().nothrow()
      expect(result.exitCode).toBe(4)
    })

    it("sessions delete outputs error mentioning backup failure in JSON", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions delete --session session_deletable --yes --backup-dir ${readOnlyBackupDir} --root ${tempRoot} --format json`.quiet().nothrow()
      expect(result.exitCode).toBe(4)
      const output = result.stderr.toString()
      const parsed = JSON.parse(output)
      expect(parsed).toHaveProperty("ok", false)
      expect(parsed.error.toLowerCase()).toMatch(/backup|failed|permission|denied|create/)
    })
  })

  describe("delete of file with removed permissions", () => {
    beforeEach(async () => {
      // Remove write permissions from the project directory
      // Use 555 (r-xr-xr-x) to allow listing/reading but not writing/deleting
      await fs.chmod(join(tempRoot, "storage", "project"), 0o555)
    })

    afterEach(async () => {
      // Restore permissions for cleanup
      await fs.chmod(join(tempRoot, "storage", "project"), 0o755).catch(() => {})
    })

    it("projects delete of file in read-only directory returns exit code 4", async () => {
      const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_deletable --yes --root ${tempRoot}`.quiet().nothrow()
      expect(result.exitCode).toBe(4)
    })

    it("projects delete outputs error mentioning delete failure in JSON", async () => {
      const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_deletable --yes --root ${tempRoot} --format json`.quiet().nothrow()
      expect(result.exitCode).toBe(4)
      const output = result.stderr.toString()
      const parsed = JSON.parse(output)
      expect(parsed).toHaveProperty("ok", false)
      expect(parsed.error.toLowerCase()).toMatch(/fail|delete|permission/)
    })
  })

  describe("delete of session file with removed permissions", () => {
    beforeEach(async () => {
      // Remove write permissions from the session directory
      // Use 555 (r-xr-xr-x) to allow listing/reading but not writing/deleting
      await fs.chmod(join(tempRoot, "storage", "session", "proj_deletable"), 0o555)
    })

    afterEach(async () => {
      // Restore permissions for cleanup
      await fs.chmod(join(tempRoot, "storage", "session", "proj_deletable"), 0o755).catch(() => {})
    })

    it("sessions delete of file in read-only directory returns exit code 4", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions delete --session session_deletable --yes --root ${tempRoot}`.quiet().nothrow()
      expect(result.exitCode).toBe(4)
    })

    it("sessions delete outputs error mentioning delete failure in JSON", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions delete --session session_deletable --yes --root ${tempRoot} --format json`.quiet().nothrow()
      expect(result.exitCode).toBe(4)
      const output = result.stderr.toString()
      const parsed = JSON.parse(output)
      expect(parsed).toHaveProperty("ok", false)
      expect(parsed.error.toLowerCase()).toMatch(/fail|delete|permission/)
    })
  })

  describe("table format output for file operation failures", () => {
    let readOnlyBackupDir: string

    beforeEach(async () => {
      readOnlyBackupDir = join(tempRoot, "readonly-backup")
      await fs.mkdir(readOnlyBackupDir)
      await fs.chmod(readOnlyBackupDir, 0o444)
    })

    afterEach(async () => {
      await fs.chmod(readOnlyBackupDir, 0o755).catch(() => {})
    })

    it("projects delete outputs readable error in table format", async () => {
      const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_deletable --yes --backup-dir ${readOnlyBackupDir} --root ${tempRoot} --format table`.quiet().nothrow()
      expect(result.exitCode).toBe(4)
      const output = result.stderr.toString()
      expect(output).toContain("Error")
    })

    it("sessions delete outputs readable error in table format", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions delete --session session_deletable --yes --backup-dir ${readOnlyBackupDir} --root ${tempRoot} --format table`.quiet().nothrow()
      expect(result.exitCode).toBe(4)
      const output = result.stderr.toString()
      expect(output).toContain("Error")
    })
  })

  describe("ndjson format output for file operation failures", () => {
    let readOnlyBackupDir: string

    beforeEach(async () => {
      readOnlyBackupDir = join(tempRoot, "readonly-backup")
      await fs.mkdir(readOnlyBackupDir)
      await fs.chmod(readOnlyBackupDir, 0o444)
    })

    afterEach(async () => {
      await fs.chmod(readOnlyBackupDir, 0o755).catch(() => {})
    })

    it("projects delete outputs error in ndjson format", async () => {
      const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_deletable --yes --backup-dir ${readOnlyBackupDir} --root ${tempRoot} --format ndjson`.quiet().nothrow()
      expect(result.exitCode).toBe(4)
      const output = result.stderr.toString().trim()
      const parsed = JSON.parse(output)
      expect(parsed).toHaveProperty("ok", false)
    })

    it("sessions delete outputs error in ndjson format", async () => {
      const result = await $`bun src/bin/opencode-manager.ts sessions delete --session session_deletable --yes --backup-dir ${readOnlyBackupDir} --root ${tempRoot} --format ndjson`.quiet().nothrow()
      expect(result.exitCode).toBe(4)
      const output = result.stderr.toString().trim()
      const parsed = JSON.parse(output)
      expect(parsed).toHaveProperty("ok", false)
    })
  })

  describe("file not deleted on backup failure", () => {
    let readOnlyBackupDir: string

    beforeEach(async () => {
      readOnlyBackupDir = join(tempRoot, "readonly-backup")
      await fs.mkdir(readOnlyBackupDir)
      await fs.chmod(readOnlyBackupDir, 0o444)
    })

    afterEach(async () => {
      await fs.chmod(readOnlyBackupDir, 0o755).catch(() => {})
    })

    it("projects delete does not delete file when backup fails", async () => {
      const filePath = join(tempRoot, "storage", "project", "proj_deletable.json")
      
      // Verify file exists before
      const existsBefore = await fs.access(filePath).then(() => true).catch(() => false)
      expect(existsBefore).toBe(true)
      
      // Attempt delete with failing backup
      await $`bun src/bin/opencode-manager.ts projects delete --id proj_deletable --yes --backup-dir ${readOnlyBackupDir} --root ${tempRoot}`.quiet().nothrow()
      
      // Verify file still exists after
      const existsAfter = await fs.access(filePath).then(() => true).catch(() => false)
      expect(existsAfter).toBe(true)
    })

    it("sessions delete does not delete file when backup fails", async () => {
      const filePath = join(tempRoot, "storage", "session", "proj_deletable", "session_deletable.json")
      
      // Verify file exists before
      const existsBefore = await fs.access(filePath).then(() => true).catch(() => false)
      expect(existsBefore).toBe(true)
      
      // Attempt delete with failing backup
      await $`bun src/bin/opencode-manager.ts sessions delete --session session_deletable --yes --backup-dir ${readOnlyBackupDir} --root ${tempRoot}`.quiet().nothrow()
      
      // Verify file still exists after
      const existsAfter = await fs.access(filePath).then(() => true).catch(() => false)
      expect(existsAfter).toBe(true)
    })
  })
})
