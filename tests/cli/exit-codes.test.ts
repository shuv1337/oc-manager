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
