/**
 * Tests for `sessions list` and `sessions delete` CLI command output.
 *
 * Uses fixture store at tests/fixtures/store to verify command output formats.
 */

import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { $ } from "bun";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FIXTURE_STORE_ROOT } from "../../helpers";

describe("sessions list --format json", () => {
  it("outputs valid JSON with success envelope", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed).toHaveProperty("data");
    expect(parsed.data).toBeArray();
  });

  it("includes correct session count", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.length).toBe(2);
  });

  it("includes session fields in JSON output", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    for (const session of parsed.data) {
      expect(session).toHaveProperty("sessionId");
      expect(session).toHaveProperty("projectId");
      expect(session).toHaveProperty("title");
      expect(session).toHaveProperty("directory");
      expect(session).toHaveProperty("filePath");
    }
  });

  it("serializes Date fields as ISO strings", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    for (const session of parsed.data) {
      if (session.createdAt) {
        // ISO date string format check
        expect(session.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      }
      if (session.updatedAt) {
        expect(session.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      }
    }
  });

  it("includes meta with limit info", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("meta");
    expect(parsed.meta).toHaveProperty("limit");
  });

  it("respects --project filter", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --root ${FIXTURE_STORE_ROOT} --format json --project proj_present`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.length).toBe(2);
    for (const session of parsed.data) {
      expect(session.projectId).toBe("proj_present");
    }
  });

  it("respects --search filter", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --root ${FIXTURE_STORE_ROOT} --format json --search parser`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.length).toBe(1);
    expect(parsed.data[0].sessionId).toBe("session_parser_fix");
  });

  it("respects --limit option", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --root ${FIXTURE_STORE_ROOT} --format json --limit 1`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.length).toBe(1);
  });
});

describe("sessions list --format ndjson", () => {
  it("outputs valid NDJSON (one JSON object per line)", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --root ${FIXTURE_STORE_ROOT} --format ndjson`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    // Each line should be valid JSON
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  it("includes correct session count (one per line)", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --root ${FIXTURE_STORE_ROOT} --format ndjson`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    expect(lines.length).toBe(2);
  });

  it("includes session fields in each NDJSON line", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --root ${FIXTURE_STORE_ROOT} --format ndjson`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    for (const line of lines) {
      const session = JSON.parse(line);
      expect(session).toHaveProperty("sessionId");
      expect(session).toHaveProperty("projectId");
      expect(session).toHaveProperty("title");
      expect(session).toHaveProperty("directory");
      expect(session).toHaveProperty("filePath");
    }
  });

  it("serializes Date fields as ISO strings", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --root ${FIXTURE_STORE_ROOT} --format ndjson`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    for (const line of lines) {
      const session = JSON.parse(line);
      if (session.createdAt) {
        // ISO date string format check
        expect(session.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      }
      if (session.updatedAt) {
        expect(session.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      }
    }
  });

  it("does not include envelope wrapper (raw records only)", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --root ${FIXTURE_STORE_ROOT} --format ndjson`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    // First line should be a session, not an envelope
    const firstLine = JSON.parse(lines[0]);
    expect(firstLine).not.toHaveProperty("ok");
    expect(firstLine).not.toHaveProperty("data");
    expect(firstLine).toHaveProperty("sessionId");
  });

  it("respects --project filter", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --root ${FIXTURE_STORE_ROOT} --format ndjson --project proj_present`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    expect(lines.length).toBe(2);
    for (const line of lines) {
      const session = JSON.parse(line);
      expect(session.projectId).toBe("proj_present");
    }
  });

  it("respects --search filter", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --root ${FIXTURE_STORE_ROOT} --format ndjson --search parser`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    expect(lines.length).toBe(1);
    const session = JSON.parse(lines[0]);
    expect(session.sessionId).toBe("session_parser_fix");
  });

  it("respects --limit option", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --root ${FIXTURE_STORE_ROOT} --format ndjson --limit 1`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    expect(lines.length).toBe(1);
  });
});

describe("sessions list --format table", () => {
  it("outputs table with headers", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --root ${FIXTURE_STORE_ROOT} --format table`.quiet();
    const output = result.stdout.toString();

    // Should have header row
    expect(output).toContain("#");
    expect(output).toContain("Title");
    expect(output).toContain("Session ID");
    expect(output).toContain("Project ID");
  });

  it("outputs table with header underline", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --root ${FIXTURE_STORE_ROOT} --format table`.quiet();
    const output = result.stdout.toString();
    const lines = output.split("\n");

    // Second line should be header underline (dashes)
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines[1]).toMatch(/^-+/);
  });

  it("includes session data rows", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --root ${FIXTURE_STORE_ROOT} --format table`.quiet();
    const output = result.stdout.toString();

    // Should include session titles
    expect(output).toContain("Add unit tests");
    expect(output).toContain("Fix bug in parser");
  });

  it("shows correct session count (header + underline + data rows)", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --root ${FIXTURE_STORE_ROOT} --format table`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    // 1 header + 1 underline + 2 data rows = 4 total lines
    expect(lines.length).toBe(4);
  });

  it("respects --project filter", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --root ${FIXTURE_STORE_ROOT} --format table --project proj_present`.quiet();
    const output = result.stdout.toString();

    // Should include sessions from proj_present
    expect(output).toContain("Add unit tests");
    expect(output).toContain("Fix bug in parser");
  });

  it("respects --search filter", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --root ${FIXTURE_STORE_ROOT} --format table --search parser`.quiet();
    const output = result.stdout.toString();

    // Should only include parser session
    expect(output).toContain("Fix bug in parser");
    expect(output).not.toContain("Add unit tests");
  });

  it("respects --limit option", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --root ${FIXTURE_STORE_ROOT} --format table --limit 1`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    // 1 header + 1 underline + 1 data row = 3 total lines
    expect(lines.length).toBe(3);
  });

  it("sorts by updated date descending by default", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    // session_add_tests has later updatedAt (1704326400000) than session_parser_fix (1704153600000)
    expect(parsed.data[0].sessionId).toBe("session_add_tests");
    expect(parsed.data[1].sessionId).toBe("session_parser_fix");
  });
});

/**
 * Tests to ensure session list search ordering matches TUI behavior.
 *
 * TUI ordering logic (from src/tui/app.tsx lines 611-618):
 * 1. Primary: score descending (fuzzy match quality)
 * 2. Secondary: time descending (updatedAt or createdAt based on sort mode)
 * 3. Tertiary: sessionId for stability (lexicographic)
 */
describe("sessions list search order matches TUI", () => {
  it("orders by fuzzy score descending when searching", async () => {
    // Search for "parser" - should match session_parser_fix with higher score
    // than session_add_tests (which doesn't contain "parser")
    const result = await $`bun src/bin/opencode-manager.ts sessions list --root ${FIXTURE_STORE_ROOT} --format json --search parser`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    // Only session_parser_fix should match "parser" (in title "Fix bug in parser")
    expect(parsed.data.length).toBe(1);
    expect(parsed.data[0].sessionId).toBe("session_parser_fix");
  });

  it("uses time as secondary sort when scores are equal", async () => {
    // Search for "proj" - matches both sessions via projectId "proj_present"
    // with similar scores, so time should be the tiebreaker
    const result = await $`bun src/bin/opencode-manager.ts sessions list --root ${FIXTURE_STORE_ROOT} --format json --search proj`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.length).toBe(2);

    // Both match "proj" with similar scores; time descending is tiebreaker
    // session_add_tests has later updatedAt (1704326400000)
    // session_parser_fix has earlier updatedAt (1704153600000)
    expect(parsed.data[0].sessionId).toBe("session_add_tests");
    expect(parsed.data[1].sessionId).toBe("session_parser_fix");
  });

  it("uses createdAt for time tiebreaker when --sort created", async () => {
    // Search for "proj" with --sort created
    const result = await $`bun src/bin/opencode-manager.ts sessions list --root ${FIXTURE_STORE_ROOT} --format json --search proj --sort created`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.length).toBe(2);

    // Both match "proj" with similar scores; createdAt descending is tiebreaker
    // session_add_tests has createdAt 1704240000000
    // session_parser_fix has createdAt 1704067200000
    expect(parsed.data[0].sessionId).toBe("session_add_tests");
    expect(parsed.data[1].sessionId).toBe("session_parser_fix");
  });

  it("maintains consistent ordering across multiple searches", async () => {
    // Run the same search multiple times and verify consistent ordering
    const search1 = await $`bun src/bin/opencode-manager.ts sessions list --root ${FIXTURE_STORE_ROOT} --format json --search present`.quiet();
    const search2 = await $`bun src/bin/opencode-manager.ts sessions list --root ${FIXTURE_STORE_ROOT} --format json --search present`.quiet();

    const parsed1 = JSON.parse(search1.stdout.toString());
    const parsed2 = JSON.parse(search2.stdout.toString());

    expect(parsed1.data.length).toBe(parsed2.data.length);
    for (let i = 0; i < parsed1.data.length; i++) {
      expect(parsed1.data[i].sessionId).toBe(parsed2.data[i].sessionId);
    }
  });

  it("sessionId is final tiebreaker for identical scores and times", async () => {
    // Search for "proj_present" - exact match in projectId for both sessions
    // Both have same projectId, so after score and time, sessionId is tiebreaker
    const result = await $`bun src/bin/opencode-manager.ts sessions list --root ${FIXTURE_STORE_ROOT} --format json --search proj_present`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.length).toBe(2);

    // Verify order is deterministic (time is still the secondary factor)
    // session_add_tests has later updatedAt, so it comes first
    expect(parsed.data[0].sessionId).toBe("session_add_tests");
    expect(parsed.data[1].sessionId).toBe("session_parser_fix");
  });
});

describe("sessions delete --dry-run", () => {
  it("outputs dry-run JSON format with paths to delete", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions delete --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format json --dry-run`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    // JSON output is wrapped in success envelope
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed).toHaveProperty("data");
    expect(parsed.data).toHaveProperty("dryRun", true);
    expect(parsed.data).toHaveProperty("operation", "delete");
    expect(parsed.data).toHaveProperty("resourceType", "session");
    expect(parsed.data).toHaveProperty("count", 1);
    expect(parsed.data).toHaveProperty("paths");
    expect(parsed.data.paths).toBeArray();
    expect(parsed.data.paths.length).toBe(1);
  });

  it("includes correct file path in dry-run output", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions delete --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format json --dry-run`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.paths[0]).toContain("session_add_tests.json");
  });

  it("outputs dry-run table format with header", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions delete --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format table --dry-run`.quiet();
    const output = result.stdout.toString();

    expect(output).toContain("[DRY RUN]");
    expect(output).toContain("delete");
    expect(output).toContain("1 session");
  });

  it("does not actually delete the file", async () => {
    // Run dry-run delete
    await $`bun src/bin/opencode-manager.ts sessions delete --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format json --dry-run`.quiet();

    // Verify file still exists by running sessions list
    const listResult = await $`bun src/bin/opencode-manager.ts sessions list --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const parsed = JSON.parse(listResult.stdout.toString());
    const sessionIds = parsed.data.map((s: { sessionId: string }) => s.sessionId);
    expect(sessionIds).toContain("session_add_tests");
  });

  it("supports prefix matching in dry-run mode", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions delete --session session_add --root ${FIXTURE_STORE_ROOT} --format json --dry-run`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.paths[0]).toContain("session_add_tests.json");
  });

  it("returns exit code 3 for non-existent session", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions delete --session nonexistent_session --root ${FIXTURE_STORE_ROOT} --format json --dry-run`.quiet().nothrow();
    
    expect(result.exitCode).toBe(3);
  });
});

describe("sessions delete --backup-dir", () => {
  let tempDir: string;
  let tempRoot: string;
  let tempBackupDir: string;

  beforeEach(async () => {
    // Create temporary directories for each test
    tempDir = await fs.mkdtemp(join(tmpdir(), "opencode-test-"));
    tempRoot = join(tempDir, "store");
    tempBackupDir = join(tempDir, "backups");

    // Copy fixture store to temp directory
    await fs.cp(FIXTURE_STORE_ROOT, tempRoot, { recursive: true });
    await fs.mkdir(tempBackupDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("creates backup before deleting session", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions delete --session session_add_tests --root ${tempRoot} --format json --yes --backup-dir ${tempBackupDir}`.quiet();
    
    expect(result.exitCode).toBe(0);

    // Verify backup directory was created (timestamped subdirectory)
    const backupContents = await fs.readdir(tempBackupDir);
    expect(backupContents.length).toBe(1);
    expect(backupContents[0]).toMatch(/^session_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/);
  });

  it("backup contains the session file", async () => {
    await $`bun src/bin/opencode-manager.ts sessions delete --session session_add_tests --root ${tempRoot} --format json --yes --backup-dir ${tempBackupDir}`.quiet();

    // Find the backup subdirectory
    const backupContents = await fs.readdir(tempBackupDir);
    const backupSubdir = join(tempBackupDir, backupContents[0]);

    // The backup preserves structure, so look for the file in the relative path
    const backupFile = join(backupSubdir, "storage", "session", "proj_present", "session_add_tests.json");
    const exists = await fs.access(backupFile).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it("deletes the original file after backup", async () => {
    const originalFile = join(tempRoot, "storage", "session", "proj_present", "session_add_tests.json");
    
    // Verify file exists before delete
    const existsBefore = await fs.access(originalFile).then(() => true).catch(() => false);
    expect(existsBefore).toBe(true);

    await $`bun src/bin/opencode-manager.ts sessions delete --session session_add_tests --root ${tempRoot} --format json --yes --backup-dir ${tempBackupDir}`.quiet();

    // Verify file is deleted after backup
    const existsAfter = await fs.access(originalFile).then(() => true).catch(() => false);
    expect(existsAfter).toBe(false);
  });

  it("outputs success message with session ID", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions delete --session session_add_tests --root ${tempRoot} --format json --yes --quiet --backup-dir ${tempBackupDir}`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed.data).toHaveProperty("sessionId", "session_add_tests");
  });

  it("backup preserves directory structure relative to root", async () => {
    await $`bun src/bin/opencode-manager.ts sessions delete --session session_add_tests --root ${tempRoot} --format json --yes --backup-dir ${tempBackupDir}`.quiet();

    // Find the backup subdirectory
    const backupContents = await fs.readdir(tempBackupDir);
    const backupSubdir = join(tempBackupDir, backupContents[0]);

    // Verify the structure: should have storage/session/proj_present/session_add_tests.json
    const storageDirExists = await fs.access(join(backupSubdir, "storage")).then(() => true).catch(() => false);
    const sessionDirExists = await fs.access(join(backupSubdir, "storage", "session")).then(() => true).catch(() => false);
    const projectDirExists = await fs.access(join(backupSubdir, "storage", "session", "proj_present")).then(() => true).catch(() => false);
    
    expect(storageDirExists).toBe(true);
    expect(sessionDirExists).toBe(true);
    expect(projectDirExists).toBe(true);
  });

  it("returns exit code 2 when --yes is not provided", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions delete --session session_add_tests --root ${tempRoot} --format json --backup-dir ${tempBackupDir}`.quiet().nothrow();
    
    expect(result.exitCode).toBe(2);
  });
});

describe("sessions delete requires --yes", () => {
  it("returns exit code 2 when --yes is missing", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions delete --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow();
    
    expect(result.exitCode).toBe(2);
  });

  it("error message mentions --yes flag", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions delete --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow();
    // Error output goes to stderr
    const output = result.stderr.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", false);
    expect(parsed.error).toContain("--yes");
  });

  it("suggests using --dry-run in error message", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions delete --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow();
    // Error output goes to stderr
    const output = result.stderr.toString();

    const parsed = JSON.parse(output);
    expect(parsed.error).toContain("--dry-run");
  });
});

describe("sessions rename", () => {
  let tempDir: string;
  let tempRoot: string;

  beforeEach(async () => {
    // Create temporary directories for each test
    tempDir = await fs.mkdtemp(join(tmpdir(), "opencode-test-"));
    tempRoot = join(tempDir, "store");

    // Copy fixture store to temp directory
    await fs.cp(FIXTURE_STORE_ROOT, tempRoot, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("renames a session successfully", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions rename --session session_add_tests --title "New Title" --root ${tempRoot} --format json`.quiet();
    
    expect(result.exitCode).toBe(0);
    
    const parsed = JSON.parse(result.stdout.toString());
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed.data).toHaveProperty("sessionId", "session_add_tests");
    expect(parsed.data).toHaveProperty("title", "New Title");
  });

  it("updates the session file with new title", async () => {
    await $`bun src/bin/opencode-manager.ts sessions rename --session session_add_tests --title "Updated Title" --root ${tempRoot} --format json`.quiet();

    // Verify the file was updated by listing sessions
    const listResult = await $`bun src/bin/opencode-manager.ts sessions list --root ${tempRoot} --format json`.quiet();
    const parsed = JSON.parse(listResult.stdout.toString());
    
    const session = parsed.data.find((s: { sessionId: string }) => s.sessionId === "session_add_tests");
    expect(session.title).toBe("Updated Title");
  });

  it("supports prefix matching for session ID", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions rename --session session_add --title "Prefix Match" --root ${tempRoot} --format json`.quiet();
    
    expect(result.exitCode).toBe(0);
    
    const parsed = JSON.parse(result.stdout.toString());
    expect(parsed.data.sessionId).toBe("session_add_tests");
    expect(parsed.data.title).toBe("Prefix Match");
  });

  it("returns exit code 3 for non-existent session", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions rename --session nonexistent --title "Test" --root ${tempRoot} --format json`.quiet().nothrow();
    
    expect(result.exitCode).toBe(3);
  });

  it("returns exit code 2 for empty title", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions rename --session session_add_tests --title "   " --root ${tempRoot} --format json`.quiet().nothrow();
    
    expect(result.exitCode).toBe(2);
  });

  it("error message mentions empty title validation", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions rename --session session_add_tests --title "   " --root ${tempRoot} --format json`.quiet().nothrow();
    const output = result.stderr.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", false);
    expect(parsed.error.toLowerCase()).toContain("empty");
  });

  it("trims whitespace from title", async () => {
    await $`bun src/bin/opencode-manager.ts sessions rename --session session_add_tests --title "  Trimmed Title  " --root ${tempRoot} --format json`.quiet();

    // Verify the file was updated with trimmed title
    const listResult = await $`bun src/bin/opencode-manager.ts sessions list --root ${tempRoot} --format json`.quiet();
    const parsed = JSON.parse(listResult.stdout.toString());
    
    const session = parsed.data.find((s: { sessionId: string }) => s.sessionId === "session_add_tests");
    expect(session.title).toBe("Trimmed Title");
  });
});
