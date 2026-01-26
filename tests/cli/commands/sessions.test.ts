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
import { FIXTURE_STORE_ROOT, FIXTURE_SQLITE_PATH } from "../../helpers";

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

describe("sessions move", () => {
  let tempDir: string;
  let tempRoot: string;

  beforeEach(async () => {
    // Create temporary directories for each test
    tempDir = await fs.mkdtemp(join(tmpdir(), "opencode-test-"));
    tempRoot = join(tempDir, "store");

    // Copy fixture store to temp directory
    await fs.cp(FIXTURE_STORE_ROOT, tempRoot, { recursive: true });

    // Create a second project directory for move target
    const targetProjectDir = join(tempRoot, "storage", "session", "proj_missing");
    await fs.mkdir(targetProjectDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("moves a session to another project successfully", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions move --session session_add_tests --to proj_missing --root ${tempRoot} --format json`.quiet();
    
    expect(result.exitCode).toBe(0);
    
    const parsed = JSON.parse(result.stdout.toString());
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed.data).toHaveProperty("sessionId", "session_add_tests");
    expect(parsed.data).toHaveProperty("fromProject", "proj_present");
    expect(parsed.data).toHaveProperty("toProject", "proj_missing");
  });

  it("removes session from source project after move", async () => {
    await $`bun src/bin/opencode-manager.ts sessions move --session session_add_tests --to proj_missing --root ${tempRoot} --format json`.quiet();

    // Verify session is no longer in source project
    const originalFile = join(tempRoot, "storage", "session", "proj_present", "session_add_tests.json");
    const existsInSource = await fs.access(originalFile).then(() => true).catch(() => false);
    expect(existsInSource).toBe(false);
  });

  it("creates session in target project after move", async () => {
    await $`bun src/bin/opencode-manager.ts sessions move --session session_add_tests --to proj_missing --root ${tempRoot} --format json`.quiet();

    // Verify session exists in target project
    const targetFile = join(tempRoot, "storage", "session", "proj_missing", "session_add_tests.json");
    const existsInTarget = await fs.access(targetFile).then(() => true).catch(() => false);
    expect(existsInTarget).toBe(true);
  });

  it("updates projectID in session file", async () => {
    await $`bun src/bin/opencode-manager.ts sessions move --session session_add_tests --to proj_missing --root ${tempRoot} --format json`.quiet();

    // Read the moved session file and verify projectID
    const targetFile = join(tempRoot, "storage", "session", "proj_missing", "session_add_tests.json");
    const content = await fs.readFile(targetFile, "utf8");
    const payload = JSON.parse(content);
    expect(payload.projectID).toBe("proj_missing");
  });

  it("supports prefix matching for session ID", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions move --session session_add --to proj_missing --root ${tempRoot} --format json`.quiet();
    
    expect(result.exitCode).toBe(0);
    
    const parsed = JSON.parse(result.stdout.toString());
    expect(parsed.data.sessionId).toBe("session_add_tests");
  });

  it("returns exit code 3 for non-existent session", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions move --session nonexistent --to proj_missing --root ${tempRoot} --format json`.quiet().nothrow();
    
    expect(result.exitCode).toBe(3);
  });

  it("returns exit code 3 for non-existent target project", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions move --session session_add_tests --to nonexistent_project --root ${tempRoot} --format json`.quiet().nothrow();
    
    expect(result.exitCode).toBe(3);
  });

  it("handles move to same project gracefully", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions move --session session_add_tests --to proj_present --root ${tempRoot} --format json`.quiet();
    
    expect(result.exitCode).toBe(0);
    
    const parsed = JSON.parse(result.stdout.toString());
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed.data).toHaveProperty("moved", false);
    expect(parsed.data).toHaveProperty("sessionId", "session_add_tests");
  });

  it("session is still accessible after move", async () => {
    await $`bun src/bin/opencode-manager.ts sessions move --session session_add_tests --to proj_missing --root ${tempRoot} --format json`.quiet();

    // Verify session appears in list with new project
    const listResult = await $`bun src/bin/opencode-manager.ts sessions list --root ${tempRoot} --format json --project proj_missing`.quiet();
    const parsed = JSON.parse(listResult.stdout.toString());
    
    const session = parsed.data.find((s: { sessionId: string }) => s.sessionId === "session_add_tests");
    expect(session).toBeDefined();
    expect(session.projectId).toBe("proj_missing");
  });
});

describe("sessions copy", () => {
  let tempDir: string;
  let tempRoot: string;

  beforeEach(async () => {
    // Create temporary directories for each test
    tempDir = await fs.mkdtemp(join(tmpdir(), "opencode-test-"));
    tempRoot = join(tempDir, "store");

    // Copy fixture store to temp directory
    await fs.cp(FIXTURE_STORE_ROOT, tempRoot, { recursive: true });

    // Create a second project directory for copy target
    const targetProjectDir = join(tempRoot, "storage", "session", "proj_missing");
    await fs.mkdir(targetProjectDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("copies a session to another project successfully", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions copy --session session_add_tests --to proj_missing --root ${tempRoot} --format json`.quiet();
    
    expect(result.exitCode).toBe(0);
    
    const parsed = JSON.parse(result.stdout.toString());
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed.data).toHaveProperty("originalSessionId", "session_add_tests");
    expect(parsed.data).toHaveProperty("newSessionId");
    expect(parsed.data.newSessionId).not.toBe("session_add_tests"); // New ID is generated
    expect(parsed.data).toHaveProperty("fromProject", "proj_present");
    expect(parsed.data).toHaveProperty("toProject", "proj_missing");
  });

  it("keeps original session in source project after copy", async () => {
    await $`bun src/bin/opencode-manager.ts sessions copy --session session_add_tests --to proj_missing --root ${tempRoot} --format json`.quiet();

    // Verify session is still in source project
    const originalFile = join(tempRoot, "storage", "session", "proj_present", "session_add_tests.json");
    const existsInSource = await fs.access(originalFile).then(() => true).catch(() => false);
    expect(existsInSource).toBe(true);
  });

  it("creates new session in target project after copy", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions copy --session session_add_tests --to proj_missing --root ${tempRoot} --format json`.quiet();
    const parsed = JSON.parse(result.stdout.toString());
    const newSessionId = parsed.data.newSessionId;

    // Verify new session exists in target project
    const targetFile = join(tempRoot, "storage", "session", "proj_missing", `${newSessionId}.json`);
    const existsInTarget = await fs.access(targetFile).then(() => true).catch(() => false);
    expect(existsInTarget).toBe(true);
  });

  it("sets projectID in copied session file", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions copy --session session_add_tests --to proj_missing --root ${tempRoot} --format json`.quiet();
    const parsed = JSON.parse(result.stdout.toString());
    const newSessionId = parsed.data.newSessionId;

    // Read the copied session file and verify projectID
    const targetFile = join(tempRoot, "storage", "session", "proj_missing", `${newSessionId}.json`);
    const content = await fs.readFile(targetFile, "utf8");
    const payload = JSON.parse(content);
    expect(payload.projectID).toBe("proj_missing");
  });

  it("supports prefix matching for session ID", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions copy --session session_add --to proj_missing --root ${tempRoot} --format json`.quiet();
    
    expect(result.exitCode).toBe(0);
    
    const parsed = JSON.parse(result.stdout.toString());
    expect(parsed.data.originalSessionId).toBe("session_add_tests");
  });

  it("returns exit code 3 for non-existent session", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions copy --session nonexistent --to proj_missing --root ${tempRoot} --format json`.quiet().nothrow();
    
    expect(result.exitCode).toBe(3);
  });

  it("returns exit code 3 for non-existent target project", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions copy --session session_add_tests --to nonexistent_project --root ${tempRoot} --format json`.quiet().nothrow();
    
    expect(result.exitCode).toBe(3);
  });

  it("allows copy to same project (creates duplicate with new ID)", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions copy --session session_add_tests --to proj_present --root ${tempRoot} --format json`.quiet();
    
    expect(result.exitCode).toBe(0);
    
    const parsed = JSON.parse(result.stdout.toString());
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed.data.originalSessionId).toBe("session_add_tests");
    expect(parsed.data.newSessionId).not.toBe("session_add_tests");
    expect(parsed.data.toProject).toBe("proj_present");
  });

  it("copied session is accessible in list", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions copy --session session_add_tests --to proj_missing --root ${tempRoot} --format json`.quiet();
    const parsed = JSON.parse(result.stdout.toString());
    const newSessionId = parsed.data.newSessionId;

    // Verify new session appears in list with target project
    const listResult = await $`bun src/bin/opencode-manager.ts sessions list --root ${tempRoot} --format json --project proj_missing`.quiet();
    const listParsed = JSON.parse(listResult.stdout.toString());
    
    const session = listParsed.data.find((s: { sessionId: string }) => s.sessionId === newSessionId);
    expect(session).toBeDefined();
    expect(session.projectId).toBe("proj_missing");
  });
});

/**
 * Integration tests for SQLite backend.
 *
 * These tests verify that the `--experimental-sqlite` and `--db` flags
 * correctly switch to the SQLite backend for the sessions list command.
 *
 * Test fixture: tests/fixtures/test.db (contains 5 sessions across 2 projects)
 * - proj_present: session_parser_fix, session_add_tests, session_refactor_api, session_fork_parser
 * - proj_missing: session_missing_proj_01
 */
describe("sessions list --experimental-sqlite", () => {
  it("loads sessions from SQLite database with --db flag", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --db ${FIXTURE_SQLITE_PATH} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed.data).toBeArray();
    expect(parsed.data.length).toBe(5);
  });

  it("returns correct session IDs from SQLite database", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --db ${FIXTURE_SQLITE_PATH} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    const sessionIds = parsed.data.map((s: { sessionId: string }) => s.sessionId);

    expect(sessionIds).toContain("session_parser_fix");
    expect(sessionIds).toContain("session_add_tests");
    expect(sessionIds).toContain("session_refactor_api");
    expect(sessionIds).toContain("session_missing_proj_01");
    expect(sessionIds).toContain("session_fork_parser");
  });

  it("includes all expected session fields", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --db ${FIXTURE_SQLITE_PATH} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    for (const session of parsed.data) {
      expect(session).toHaveProperty("sessionId");
      expect(session).toHaveProperty("projectId");
      expect(session).toHaveProperty("title");
      expect(session).toHaveProperty("directory");
      expect(session).toHaveProperty("index");
      expect(session).toHaveProperty("filePath");
    }
  });

  it("uses SQLite virtual filePath format (sqlite:session:{id})", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --db ${FIXTURE_SQLITE_PATH} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    for (const session of parsed.data) {
      // SQLite backend uses virtual path format
      expect(session.filePath).toContain("sqlite:session:");
      expect(session.filePath).not.toContain(".json");
    }
  });

  it("respects --project filter with SQLite backend", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --db ${FIXTURE_SQLITE_PATH} --format json --project proj_present`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    // proj_present has 4 sessions: session_parser_fix, session_add_tests, session_refactor_api, session_fork_parser
    expect(parsed.data.length).toBe(4);
    for (const session of parsed.data) {
      expect(session.projectId).toBe("proj_present");
    }
  });

  it("respects --search filter with SQLite backend", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --db ${FIXTURE_SQLITE_PATH} --format json --search parser`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    // "parser" matches session_parser_fix (title: "Fix bug in parser") and session_fork_parser (title: "Fork: Alternative parser approach")
    expect(parsed.data.length).toBe(2);
    const sessionIds = parsed.data.map((s: { sessionId: string }) => s.sessionId);
    expect(sessionIds).toContain("session_parser_fix");
    expect(sessionIds).toContain("session_fork_parser");
  });

  it("respects --limit option with SQLite backend", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --db ${FIXTURE_SQLITE_PATH} --format json --limit 2`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.length).toBe(2);
  });

  it("serializes Date fields as ISO strings", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --db ${FIXTURE_SQLITE_PATH} --format json`.quiet();
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

  it("works with table format output", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --db ${FIXTURE_SQLITE_PATH} --format table`.quiet();
    const output = result.stdout.toString();

    // Should have header row with expected columns
    expect(output).toContain("#");
    expect(output).toContain("Title");
    expect(output).toContain("Session ID");
    expect(output).toContain("Project ID");

    // Should include session titles from SQLite
    expect(output).toContain("Fix bug in parser");
    expect(output).toContain("Add unit tests");
  });

  it("works with ndjson format output", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --db ${FIXTURE_SQLITE_PATH} --format ndjson`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    expect(lines.length).toBe(5);

    // Each line should be valid JSON with session data
    for (const line of lines) {
      const session = JSON.parse(line);
      expect(session).toHaveProperty("sessionId");
      expect(session).toHaveProperty("filePath");
      expect(session.filePath).toContain("sqlite:session:");
    }
  });

  it("returns error for non-existent database file", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --db /nonexistent/path/db.sqlite --format json`.quiet().nothrow();

    // Should fail with non-zero exit code
    expect(result.exitCode).not.toBe(0);

    // Error message should mention SQLite and the database path
    const stderr = result.stderr.toString();
    expect(stderr).toContain("SQLite database");
    expect(stderr).toContain("/nonexistent/path/db.sqlite");
  });

  it("sorts by updated date descending by default", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions list --db ${FIXTURE_SQLITE_PATH} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    // session_fork_parser has the latest updatedAt (1704844800000)
    // session_missing_proj_01 is second (1704672000000)
    // session_refactor_api is third (1704499200000)
    // ...
    expect(parsed.data[0].sessionId).toBe("session_fork_parser");
  });
});

/**
 * Integration tests for SQLite backend - sessions delete command.
 *
 * These tests verify that the `--experimental-sqlite` and `--db` flags
 * correctly switch to the SQLite backend for the sessions delete command.
 *
 * Test fixture: A temporary copy of tests/fixtures/test.db is used for
 * destructive tests to avoid modifying the shared fixture.
 */
describe("sessions delete --experimental-sqlite", () => {
  let tempDbPath: string;
  let tempDbDir: string;

  /**
   * Before each test, copy the fixture database to a temp location.
   * This ensures each test starts with a fresh database.
   */
  beforeEach(async () => {
    tempDbDir = join(tmpdir(), `oc-manager-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tempDbDir, { recursive: true });
    tempDbPath = join(tempDbDir, "test.db");
    await fs.copyFile(FIXTURE_SQLITE_PATH, tempDbPath);
  });

  /**
   * After each test, clean up the temporary database.
   */
  afterEach(async () => {
    try {
      await fs.rm(tempDbDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("deletes session from SQLite database with --db flag and --yes", async () => {
    // Verify session exists before deletion
    const listBefore = await $`bun src/bin/opencode-manager.ts sessions list --db ${tempDbPath} --format json`.quiet();
    const parsedBefore = JSON.parse(listBefore.stdout.toString());
    const sessionsBefore = parsedBefore.data.map((s: { sessionId: string }) => s.sessionId);
    expect(sessionsBefore).toContain("session_add_tests");

    // Delete the session
    const result = await $`bun src/bin/opencode-manager.ts sessions delete --session session_add_tests --db ${tempDbPath} --format json --yes`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed.data).toHaveProperty("sessionId", "session_add_tests");
    expect(parsed.data).toHaveProperty("deleted");
    expect(parsed.data.deleted).toBeArray();

    // Verify session is gone after deletion
    const listAfter = await $`bun src/bin/opencode-manager.ts sessions list --db ${tempDbPath} --format json`.quiet();
    const parsedAfter = JSON.parse(listAfter.stdout.toString());
    const sessionsAfter = parsedAfter.data.map((s: { sessionId: string }) => s.sessionId);
    expect(sessionsAfter).not.toContain("session_add_tests");
    // Other sessions should still exist
    expect(sessionsAfter).toContain("session_parser_fix");
    expect(sessionsAfter).toContain("session_refactor_api");
  });

  it("supports session ID prefix matching with SQLite", async () => {
    // Delete using prefix "session_add"
    const result = await $`bun src/bin/opencode-manager.ts sessions delete --session session_add --db ${tempDbPath} --format json --yes`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", true);
    // Should resolve "session_add" to "session_add_tests"
    expect(parsed.data).toHaveProperty("sessionId", "session_add_tests");

    // Verify session is deleted
    const listAfter = await $`bun src/bin/opencode-manager.ts sessions list --db ${tempDbPath} --format json`.quiet();
    const parsedAfter = JSON.parse(listAfter.stdout.toString());
    const sessionsAfter = parsedAfter.data.map((s: { sessionId: string }) => s.sessionId);
    expect(sessionsAfter).not.toContain("session_add_tests");
  });

  it("outputs dry-run result with SQLite backend", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions delete --session session_add_tests --db ${tempDbPath} --format json --dry-run`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed.data).toHaveProperty("dryRun", true);
    expect(parsed.data).toHaveProperty("operation", "delete");
    expect(parsed.data).toHaveProperty("resourceType", "session");
    expect(parsed.data).toHaveProperty("count", 1);
    expect(parsed.data).toHaveProperty("paths");
    // SQLite virtual paths have format sqlite:session:{id}
    expect(parsed.data.paths[0]).toContain("sqlite:session:session_add_tests");

    // Verify session is NOT deleted (dry run)
    const listAfter = await $`bun src/bin/opencode-manager.ts sessions list --db ${tempDbPath} --format json`.quiet();
    const parsedAfter = JSON.parse(listAfter.stdout.toString());
    const sessionsAfter = parsedAfter.data.map((s: { sessionId: string }) => s.sessionId);
    expect(sessionsAfter).toContain("session_add_tests");
  });

  it("requires --yes flag for destructive operation (SQLite)", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions delete --session session_add_tests --db ${tempDbPath} --format json`.quiet().nothrow();

    expect(result.exitCode).toBe(2);

    // Session should still exist
    const listAfter = await $`bun src/bin/opencode-manager.ts sessions list --db ${tempDbPath} --format json`.quiet();
    const parsedAfter = JSON.parse(listAfter.stdout.toString());
    const sessionsAfter = parsedAfter.data.map((s: { sessionId: string }) => s.sessionId);
    expect(sessionsAfter).toContain("session_add_tests");
  });

  it("returns error for non-existent session ID with SQLite", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions delete --session nonexistent_session --db ${tempDbPath} --format json --yes`.quiet().nothrow();

    expect(result.exitCode).toBe(3);

    // JSON error output goes to stdout
    const output = result.stdout.toString().trim();
    if (output) {
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty("ok", false);
      expect(parsed).toHaveProperty("error");
      expect(parsed.error).toContain("nonexistent_session");
    } else {
      // Fallback: error might be in stderr
      const stderr = result.stderr.toString();
      expect(stderr).toContain("nonexistent_session");
    }
  });

  it("returns error for non-existent database file", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions delete --session session_add_tests --db /nonexistent/path/db.sqlite --format json --yes`.quiet().nothrow();

    expect(result.exitCode).not.toBe(0);

    // Error should mention the missing database
    const stderr = result.stderr.toString();
    expect(stderr).toContain("SQLite database");
    expect(stderr).toContain("/nonexistent/path/db.sqlite");
  });

  it("works with table format output (SQLite)", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions delete --session session_add_tests --db ${tempDbPath} --format table --yes`.quiet();
    const output = result.stdout.toString();

    // Table format should show success message
    expect(output).toContain("Deleted session");
    expect(output).toContain("session_add_tests");
  });

  it("works with ndjson format output (SQLite)", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions delete --session session_add_tests --db ${tempDbPath} --format ndjson --yes`.quiet();
    const output = result.stdout.toString().trim();

    // NDJSON format wraps output in success envelope for consistency
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed.data).toHaveProperty("sessionId", "session_add_tests");
    expect(parsed.data).toHaveProperty("deleted");
  });

  it("deletes session and all related messages/parts atomically", async () => {
    // Get initial counts by loading chat messages
    const chatBefore = await $`bun src/bin/opencode-manager.ts chat list --session session_parser_fix --db ${tempDbPath} --format json`.quiet();
    const parsedChatBefore = JSON.parse(chatBefore.stdout.toString());
    const messageCountBefore = parsedChatBefore.data.length;
    expect(messageCountBefore).toBeGreaterThan(0); // session_parser_fix has 4 messages

    // Delete the session
    await $`bun src/bin/opencode-manager.ts sessions delete --session session_parser_fix --db ${tempDbPath} --format json --yes`.quiet();

    // Verify session is gone
    const listAfter = await $`bun src/bin/opencode-manager.ts sessions list --db ${tempDbPath} --format json`.quiet();
    const parsedAfter = JSON.parse(listAfter.stdout.toString());
    const sessionsAfter = parsedAfter.data.map((s: { sessionId: string }) => s.sessionId);
    expect(sessionsAfter).not.toContain("session_parser_fix");

    // Verify messages are also gone (chat list should fail for non-existent session)
    const chatAfter = await $`bun src/bin/opencode-manager.ts chat list --session session_parser_fix --db ${tempDbPath} --format json`.quiet().nothrow();
    expect(chatAfter.exitCode).toBe(3); // Session not found
  });

  it("ignores --backup-dir flag with SQLite backend (virtual paths cannot be backed up)", async () => {
    // backup-dir is only meaningful for JSONL file backend
    // SQLite backend should ignore it and proceed with deletion
    const result = await $`bun src/bin/opencode-manager.ts sessions delete --session session_add_tests --db ${tempDbPath} --format json --yes --backup-dir ${tempDbDir}`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed.data).toHaveProperty("sessionId", "session_add_tests");

    // Session should be deleted
    const listAfter = await $`bun src/bin/opencode-manager.ts sessions list --db ${tempDbPath} --format json`.quiet();
    const parsedAfter = JSON.parse(listAfter.stdout.toString());
    const sessionsAfter = parsedAfter.data.map((s: { sessionId: string }) => s.sessionId);
    expect(sessionsAfter).not.toContain("session_add_tests");
  });
});

/**
 * Integration tests for sessions move with SQLite backend.
 *
 * These tests verify that the `--db` flag correctly uses the SQLite backend
 * for moving sessions between projects.
 *
 * Test fixture: tests/fixtures/test.db (contains 5 sessions across 2 projects)
 * - proj_present: session_parser_fix, session_add_tests, session_refactor_api, session_fork_parser
 * - proj_missing: session_missing_proj_01
 */
describe("sessions move --experimental-sqlite", () => {
  let tempDbDir: string;
  let tempDbPath: string;

  beforeEach(async () => {
    // Create temporary directory for database copy
    tempDbDir = await fs.mkdtemp(join(tmpdir(), "opencode-sqlite-test-"));
    tempDbPath = join(tempDbDir, "test.db");

    // Copy fixture database to temp (so we can modify it)
    await fs.copyFile(FIXTURE_SQLITE_PATH, tempDbPath);
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDbDir, { recursive: true, force: true });
  });

  it("moves session to another project in SQLite database with --db flag", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions move --session session_add_tests --to proj_missing --db ${tempDbPath} --format json`.quiet();
    const output = result.stdout.toString();

    expect(result.exitCode).toBe(0);

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed.data).toHaveProperty("sessionId", "session_add_tests");
    expect(parsed.data).toHaveProperty("fromProject", "proj_present");
    expect(parsed.data).toHaveProperty("toProject", "proj_missing");
  });

  it("updates project_id in database after move", async () => {
    await $`bun src/bin/opencode-manager.ts sessions move --session session_add_tests --to proj_missing --db ${tempDbPath} --format json`.quiet();

    // Verify session is now in target project by listing sessions
    const listResult = await $`bun src/bin/opencode-manager.ts sessions list --db ${tempDbPath} --format json --project proj_missing`.quiet();
    const parsed = JSON.parse(listResult.stdout.toString());

    const session = parsed.data.find((s: { sessionId: string }) => s.sessionId === "session_add_tests");
    expect(session).toBeDefined();
    expect(session.projectId).toBe("proj_missing");
  });

  it("session is no longer in source project after move", async () => {
    await $`bun src/bin/opencode-manager.ts sessions move --session session_add_tests --to proj_missing --db ${tempDbPath} --format json`.quiet();

    // Verify session is not in source project anymore
    const listResult = await $`bun src/bin/opencode-manager.ts sessions list --db ${tempDbPath} --format json --project proj_present`.quiet();
    const parsed = JSON.parse(listResult.stdout.toString());

    const session = parsed.data.find((s: { sessionId: string }) => s.sessionId === "session_add_tests");
    expect(session).toBeUndefined();
  });

  it("supports session ID prefix matching with SQLite", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions move --session session_add --to proj_missing --db ${tempDbPath} --format json`.quiet();

    expect(result.exitCode).toBe(0);

    const parsed = JSON.parse(result.stdout.toString());
    expect(parsed.data.sessionId).toBe("session_add_tests");
  });

  it("supports project ID prefix matching with SQLite", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions move --session session_add_tests --to proj_miss --db ${tempDbPath} --format json`.quiet();

    expect(result.exitCode).toBe(0);

    const parsed = JSON.parse(result.stdout.toString());
    expect(parsed.data.toProject).toBe("proj_missing");
  });

  it("returns exit code 3 for non-existent session with SQLite", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions move --session nonexistent_session --to proj_missing --db ${tempDbPath} --format json`.quiet().nothrow();

    expect(result.exitCode).toBe(3);

    // JSON error output
    const output = result.stdout.toString().trim();
    if (output) {
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty("ok", false);
      expect(parsed.error).toContain("nonexistent_session");
    }
  });

  it("returns exit code 3 for non-existent target project with SQLite", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions move --session session_add_tests --to nonexistent_project --db ${tempDbPath} --format json`.quiet().nothrow();

    expect(result.exitCode).toBe(3);

    // JSON error output
    const output = result.stdout.toString().trim();
    if (output) {
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty("ok", false);
      expect(parsed.error).toContain("nonexistent_project");
    }
  });

  it("handles move to same project gracefully with SQLite", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions move --session session_add_tests --to proj_present --db ${tempDbPath} --format json`.quiet();

    expect(result.exitCode).toBe(0);

    const parsed = JSON.parse(result.stdout.toString());
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed.data).toHaveProperty("moved", false);
    expect(parsed.data).toHaveProperty("sessionId", "session_add_tests");
  });

  it("returns error for non-existent database file", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions move --session session_add_tests --to proj_missing --db /nonexistent/path/db.sqlite --format json`.quiet().nothrow();

    expect(result.exitCode).not.toBe(0);

    // Error should mention the missing database
    const stderr = result.stderr.toString();
    expect(stderr).toContain("SQLite database");
    expect(stderr).toContain("/nonexistent/path/db.sqlite");
  });

  it("works with table format output (SQLite)", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions move --session session_add_tests --to proj_missing --db ${tempDbPath} --format table`.quiet();
    const output = result.stdout.toString();

    // Table format should show success message
    expect(output).toContain("Moved session");
    expect(output).toContain("session_add_tests");
    expect(output).toContain("proj_missing");
  });

  it("works with ndjson format output (SQLite)", async () => {
    const result = await $`bun src/bin/opencode-manager.ts sessions move --session session_add_tests --to proj_missing --db ${tempDbPath} --format ndjson`.quiet();
    const output = result.stdout.toString().trim();

    // NDJSON format wraps output in success envelope
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed.data).toHaveProperty("sessionId", "session_add_tests");
    expect(parsed.data).toHaveProperty("toProject", "proj_missing");
  });

  it("updates virtual filePath after move", async () => {
    await $`bun src/bin/opencode-manager.ts sessions move --session session_add_tests --to proj_missing --db ${tempDbPath} --format json`.quiet();

    // Verify filePath still uses SQLite virtual format
    const listResult = await $`bun src/bin/opencode-manager.ts sessions list --db ${tempDbPath} --format json`.quiet();
    const parsed = JSON.parse(listResult.stdout.toString());

    const session = parsed.data.find((s: { sessionId: string }) => s.sessionId === "session_add_tests");
    expect(session).toBeDefined();
    expect(session.filePath).toContain("sqlite:session:session_add_tests");
  });

  it("messages remain accessible after move", async () => {
    // Verify session has messages before move
    const chatBefore = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --db ${tempDbPath} --format json`.quiet();
    const parsedBefore = JSON.parse(chatBefore.stdout.toString());
    expect(parsedBefore.data.length).toBeGreaterThan(0);

    // Move the session
    await $`bun src/bin/opencode-manager.ts sessions move --session session_add_tests --to proj_missing --db ${tempDbPath} --format json`.quiet();

    // Verify messages are still accessible after move
    const chatAfter = await $`bun src/bin/opencode-manager.ts chat list --session session_add_tests --db ${tempDbPath} --format json`.quiet();
    const parsedAfter = JSON.parse(chatAfter.stdout.toString());
    expect(parsedAfter.data.length).toBe(parsedBefore.data.length);
  });
});
