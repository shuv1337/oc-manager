/**
 * Tests for `projects` CLI commands output.
 *
 * Uses fixture store at tests/fixtures/store to verify command output formats.
 */

import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { $ } from "bun";
import { Database } from "bun:sqlite";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FIXTURE_STORE_ROOT, FIXTURE_SQLITE_PATH } from "../../helpers";

describe("projects list --format json", () => {
  it("outputs valid JSON with success envelope", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed).toHaveProperty("data");
    expect(parsed.data).toBeArray();
  });

  it("includes correct project count", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.length).toBe(2);
  });

  it("includes project fields in JSON output", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    for (const project of parsed.data) {
      expect(project).toHaveProperty("projectId");
      expect(project).toHaveProperty("worktree");
      expect(project).toHaveProperty("state");
      expect(project).toHaveProperty("index");
      expect(project).toHaveProperty("bucket");
      expect(project).toHaveProperty("filePath");
    }
  });

  it("serializes Date fields as ISO strings", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    for (const project of parsed.data) {
      if (project.createdAt) {
        // ISO date string format check
        expect(project.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      }
    }
  });

  it("includes meta with limit info", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("meta");
    expect(parsed.meta).toHaveProperty("limit");
  });

  it("respects --missing-only filter", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --root ${FIXTURE_STORE_ROOT} --format json --missing-only`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.length).toBe(1);
    expect(parsed.data[0].projectId).toBe("proj_missing");
    expect(parsed.data[0].state).toBe("missing");
  });

  it("respects --search filter", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --root ${FIXTURE_STORE_ROOT} --format json --search present`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.length).toBe(1);
    expect(parsed.data[0].projectId).toBe("proj_present");
  });

  it("respects --limit option", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --root ${FIXTURE_STORE_ROOT} --format json --limit 1`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.length).toBe(1);
  });
});

describe("projects list --format ndjson", () => {
  it("outputs valid NDJSON (one JSON object per line)", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --root ${FIXTURE_STORE_ROOT} --format ndjson`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    // Each line should be valid JSON
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  it("includes correct project count (one per line)", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --root ${FIXTURE_STORE_ROOT} --format ndjson`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    expect(lines.length).toBe(2);
  });

  it("includes project fields in each NDJSON line", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --root ${FIXTURE_STORE_ROOT} --format ndjson`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    for (const line of lines) {
      const project = JSON.parse(line);
      expect(project).toHaveProperty("projectId");
      expect(project).toHaveProperty("worktree");
      expect(project).toHaveProperty("state");
      expect(project).toHaveProperty("index");
      expect(project).toHaveProperty("bucket");
      expect(project).toHaveProperty("filePath");
    }
  });

  it("serializes Date fields as ISO strings", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --root ${FIXTURE_STORE_ROOT} --format ndjson`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    for (const line of lines) {
      const project = JSON.parse(line);
      if (project.createdAt) {
        // ISO date string format check
        expect(project.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      }
    }
  });

  it("does not include envelope wrapper (raw records only)", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --root ${FIXTURE_STORE_ROOT} --format ndjson`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    // First line should be a project, not an envelope
    const firstLine = JSON.parse(lines[0]);
    expect(firstLine).not.toHaveProperty("ok");
    expect(firstLine).not.toHaveProperty("data");
    expect(firstLine).toHaveProperty("projectId");
  });

  it("respects --missing-only filter", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --root ${FIXTURE_STORE_ROOT} --format ndjson --missing-only`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    expect(lines.length).toBe(1);
    const project = JSON.parse(lines[0]);
    expect(project.projectId).toBe("proj_missing");
    expect(project.state).toBe("missing");
  });

  it("respects --search filter", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --root ${FIXTURE_STORE_ROOT} --format ndjson --search present`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    expect(lines.length).toBe(1);
    const project = JSON.parse(lines[0]);
    expect(project.projectId).toBe("proj_present");
  });

  it("respects --limit option", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --root ${FIXTURE_STORE_ROOT} --format ndjson --limit 1`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    expect(lines.length).toBe(1);
  });
});

describe("projects list --format table", () => {
  it("outputs table with headers", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --root ${FIXTURE_STORE_ROOT} --format table`.quiet();
    const output = result.stdout.toString();

    // Should have header row
    expect(output).toContain("#");
    expect(output).toContain("State");
    expect(output).toContain("Path");
    expect(output).toContain("Project ID");
    expect(output).toContain("Created");
  });

  it("outputs table with header underline", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --root ${FIXTURE_STORE_ROOT} --format table`.quiet();
    const output = result.stdout.toString();
    const lines = output.split("\n");

    // Second line should be header underline (dashes)
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines[1]).toMatch(/^-+/);
  });

  it("includes project data rows", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --root ${FIXTURE_STORE_ROOT} --format table`.quiet();
    const output = result.stdout.toString();

    // Should include project IDs
    expect(output).toContain("proj_present");
    expect(output).toContain("proj_missing");
  });

  it("shows correct project count (header + underline + data rows)", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --root ${FIXTURE_STORE_ROOT} --format table`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    // 1 header + 1 underline + 2 data rows = 4 total lines
    expect(lines.length).toBe(4);
  });

  it("formats state column with visual indicators", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --root ${FIXTURE_STORE_ROOT} --format table`.quiet();
    const output = result.stdout.toString();

    // State indicators: checkmark for present, X for missing
    expect(output).toMatch(/✓|✗/);
  });

  it("respects --missing-only filter", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --root ${FIXTURE_STORE_ROOT} --format table --missing-only`.quiet();
    const output = result.stdout.toString();

    // Should only include missing project
    expect(output).toContain("proj_missing");
    expect(output).not.toContain("proj_present");
  });

  it("respects --search filter", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --root ${FIXTURE_STORE_ROOT} --format table --search present`.quiet();
    const output = result.stdout.toString();

    // Should only include present project
    expect(output).toContain("proj_present");
    expect(output).not.toContain("proj_missing");
  });

  it("respects --limit option", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --root ${FIXTURE_STORE_ROOT} --format table --limit 1`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    // 1 header + 1 underline + 1 data row = 3 total lines
    expect(lines.length).toBe(3);
  });
});

describe("projects delete --dry-run", () => {
  it("outputs dry-run JSON format with paths to delete", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_present --root ${FIXTURE_STORE_ROOT} --format json --dry-run`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    // JSON output is wrapped in success envelope
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed).toHaveProperty("data");
    expect(parsed.data).toHaveProperty("dryRun", true);
    expect(parsed.data).toHaveProperty("operation", "delete");
    expect(parsed.data).toHaveProperty("resourceType", "project");
    expect(parsed.data).toHaveProperty("count", 1);
    expect(parsed.data).toHaveProperty("paths");
    expect(parsed.data.paths).toBeArray();
    expect(parsed.data.paths.length).toBe(1);
  });

  it("includes correct file path in dry-run output", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_present --root ${FIXTURE_STORE_ROOT} --format json --dry-run`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.paths[0]).toContain("proj_present.json");
  });

  it("outputs dry-run table format with header", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_present --root ${FIXTURE_STORE_ROOT} --format table --dry-run`.quiet();
    const output = result.stdout.toString();

    expect(output).toContain("[DRY RUN]");
    expect(output).toContain("delete");
    expect(output).toContain("1 project");
  });

  it("does not actually delete the file", async () => {
    // Run dry-run delete
    await $`bun src/bin/opencode-manager.ts projects delete --id proj_present --root ${FIXTURE_STORE_ROOT} --format json --dry-run`.quiet();

    // Verify file still exists by running projects list
    const listResult = await $`bun src/bin/opencode-manager.ts projects list --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const parsed = JSON.parse(listResult.stdout.toString());
    const projectIds = parsed.data.map((p: { projectId: string }) => p.projectId);
    expect(projectIds).toContain("proj_present");
  });

  it("supports prefix matching in dry-run mode", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_pres --root ${FIXTURE_STORE_ROOT} --format json --dry-run`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.paths[0]).toContain("proj_present.json");
  });

  it("returns exit code 3 for non-existent project", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects delete --id nonexistent_project --root ${FIXTURE_STORE_ROOT} --format json --dry-run`.quiet().nothrow();
    
    expect(result.exitCode).toBe(3);
  });
});

describe("projects delete --backup-dir", () => {
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

  it("creates backup before deleting project", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_present --root ${tempRoot} --format json --yes --backup-dir ${tempBackupDir}`.quiet();
    
    expect(result.exitCode).toBe(0);

    // Verify backup directory was created (timestamped subdirectory)
    const backupContents = await fs.readdir(tempBackupDir);
    expect(backupContents.length).toBe(1);
    expect(backupContents[0]).toMatch(/^project_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/);
  });

  it("backup contains the project file", async () => {
    await $`bun src/bin/opencode-manager.ts projects delete --id proj_present --root ${tempRoot} --format json --yes --backup-dir ${tempBackupDir}`.quiet();

    // Find the backup subdirectory
    const backupContents = await fs.readdir(tempBackupDir);
    const backupSubdir = join(tempBackupDir, backupContents[0]);

    // The backup preserves structure, so look for the file in the relative path
    const backupFile = join(backupSubdir, "storage", "project", "proj_present.json");
    const exists = await fs.access(backupFile).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it("deletes the original file after backup", async () => {
    const originalFile = join(tempRoot, "storage", "project", "proj_present.json");
    
    // Verify file exists before delete
    const existsBefore = await fs.access(originalFile).then(() => true).catch(() => false);
    expect(existsBefore).toBe(true);

    await $`bun src/bin/opencode-manager.ts projects delete --id proj_present --root ${tempRoot} --format json --yes --backup-dir ${tempBackupDir}`.quiet();

    // Verify file is deleted after backup
    const existsAfter = await fs.access(originalFile).then(() => true).catch(() => false);
    expect(existsAfter).toBe(false);
  });

  it("outputs success message with project ID", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_present --root ${tempRoot} --format json --yes --quiet --backup-dir ${tempBackupDir}`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed.data).toHaveProperty("projectId", "proj_present");
  });

  it("backup preserves directory structure relative to root", async () => {
    await $`bun src/bin/opencode-manager.ts projects delete --id proj_present --root ${tempRoot} --format json --yes --backup-dir ${tempBackupDir}`.quiet();

    // Find the backup subdirectory
    const backupContents = await fs.readdir(tempBackupDir);
    const backupSubdir = join(tempBackupDir, backupContents[0]);

    // Verify the structure: should have storage/project/proj_present.json
    const storageDirExists = await fs.access(join(backupSubdir, "storage")).then(() => true).catch(() => false);
    const projectDirExists = await fs.access(join(backupSubdir, "storage", "project")).then(() => true).catch(() => false);
    
    expect(storageDirExists).toBe(true);
    expect(projectDirExists).toBe(true);
  });

  it("returns exit code 2 when --yes is not provided", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_present --root ${tempRoot} --format json --backup-dir ${tempBackupDir}`.quiet().nothrow();
    
    expect(result.exitCode).toBe(2);
  });
});

describe("projects delete requires --yes", () => {
  it("returns exit code 2 when --yes is missing", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_present --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow();
    
    expect(result.exitCode).toBe(2);
  });

  it("error message mentions --yes flag", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_present --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow();
    // Error output goes to stderr
    const output = result.stderr.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", false);
    expect(parsed.error).toContain("--yes");
  });

  it("suggests using --dry-run in error message", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_present --root ${FIXTURE_STORE_ROOT} --format json`.quiet().nothrow();
    // Error output goes to stderr
    const output = result.stderr.toString();

    const parsed = JSON.parse(output);
    expect(parsed.error).toContain("--dry-run");
  });
});

/**
 * Regression tests for DataProvider integration.
 *
 * These tests verify that the default JSONL backend continues to work
 * correctly after the DataProvider abstraction was introduced to support
 * both JSONL and SQLite backends.
 *
 * When no --experimental-sqlite or --db flags are provided, the CLI
 * should use the JSONL backend by default.
 */
describe("projects list - JSONL backend regression (default)", () => {
  it("uses JSONL backend by default (no SQLite flags)", async () => {
    // Run without any --experimental-sqlite or --db flags
    const result = await $`bun src/bin/opencode-manager.ts projects list --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed.data).toBeArray();
    expect(parsed.data.length).toBe(2);

    // Verify JSONL-specific filePath format (not SQLite virtual paths)
    for (const project of parsed.data) {
      expect(project.filePath).toContain(".json");
      expect(project.filePath).not.toContain("sqlite:");
    }
  });

  it("returns correct project data from JSONL files", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    const projectIds = parsed.data.map((p: { projectId: string }) => p.projectId);

    // These projects come from the JSONL fixture store
    expect(projectIds).toContain("proj_present");
    expect(projectIds).toContain("proj_missing");
  });

  it("JSONL backend produces correct state detection", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    const present = parsed.data.find((p: { projectId: string }) => p.projectId === "proj_present");
    const missing = parsed.data.find((p: { projectId: string }) => p.projectId === "proj_missing");

    // State detection should work correctly with JSONL backend
    expect(present.state).toBe("present");
    expect(missing.state).toBe("missing");
  });

  it("filters work correctly with JSONL backend (--missing-only)", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --root ${FIXTURE_STORE_ROOT} --format json --missing-only`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.length).toBe(1);
    expect(parsed.data[0].projectId).toBe("proj_missing");
  });

  it("search works correctly with JSONL backend (--search)", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --root ${FIXTURE_STORE_ROOT} --format json --search present`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.length).toBe(1);
    expect(parsed.data[0].projectId).toBe("proj_present");
  });
});

/**
 * Integration tests for SQLite backend.
 *
 * These tests verify that the `--experimental-sqlite` and `--db` flags
 * correctly switch to the SQLite backend for the projects list command.
 *
 * Test fixture: tests/fixtures/test.db (contains 2 projects: proj_present, proj_missing)
 */
describe("projects list --experimental-sqlite", () => {
  it("loads projects from SQLite database with --db flag", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --db ${FIXTURE_SQLITE_PATH} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed.data).toBeArray();
    expect(parsed.data.length).toBe(2);
  });

  it("returns correct project IDs from SQLite database", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --db ${FIXTURE_SQLITE_PATH} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    const projectIds = parsed.data.map((p: { projectId: string }) => p.projectId);

    expect(projectIds).toContain("proj_present");
    expect(projectIds).toContain("proj_missing");
  });

  it("produces correct state detection from SQLite data", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --db ${FIXTURE_SQLITE_PATH} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    const present = parsed.data.find((p: { projectId: string }) => p.projectId === "proj_present");
    const missing = parsed.data.find((p: { projectId: string }) => p.projectId === "proj_missing");

    // State detection should work correctly with SQLite backend
    expect(present.state).toBe("present");
    expect(missing.state).toBe("missing");
  });

  it("uses SQLite virtual filePath format (sqlite:project:{id})", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --db ${FIXTURE_SQLITE_PATH} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    for (const project of parsed.data) {
      // SQLite backend uses virtual path format
      expect(project.filePath).toContain("sqlite:project:");
      expect(project.filePath).not.toContain(".json");
    }
  });

  it("includes all expected project fields", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --db ${FIXTURE_SQLITE_PATH} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    for (const project of parsed.data) {
      expect(project).toHaveProperty("projectId");
      expect(project).toHaveProperty("worktree");
      expect(project).toHaveProperty("state");
      expect(project).toHaveProperty("index");
      expect(project).toHaveProperty("bucket");
      expect(project).toHaveProperty("filePath");
    }
  });

  it("respects --missing-only filter with SQLite backend", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --db ${FIXTURE_SQLITE_PATH} --format json --missing-only`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.length).toBe(1);
    expect(parsed.data[0].projectId).toBe("proj_missing");
    expect(parsed.data[0].state).toBe("missing");
  });

  it("respects --search filter with SQLite backend", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --db ${FIXTURE_SQLITE_PATH} --format json --search present`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.length).toBe(1);
    expect(parsed.data[0].projectId).toBe("proj_present");
  });

  it("respects --limit option with SQLite backend", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --db ${FIXTURE_SQLITE_PATH} --format json --limit 1`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.length).toBe(1);
  });

  it("works with table format output", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --db ${FIXTURE_SQLITE_PATH} --format table`.quiet();
    const output = result.stdout.toString();

    // Should have header row with expected columns
    expect(output).toContain("#");
    expect(output).toContain("State");
    expect(output).toContain("Path");
    expect(output).toContain("Project ID");
    expect(output).toContain("Created");

    // Should include project IDs
    expect(output).toContain("proj_present");
    expect(output).toContain("proj_missing");
  });

  it("works with ndjson format output", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --db ${FIXTURE_SQLITE_PATH} --format ndjson`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    expect(lines.length).toBe(2);

    // Each line should be valid JSON with project data
    for (const line of lines) {
      const project = JSON.parse(line);
      expect(project).toHaveProperty("projectId");
      expect(project).toHaveProperty("filePath");
      expect(project.filePath).toContain("sqlite:project:");
    }
  });

  it("returns error for non-existent database file", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects list --db /nonexistent/path/db.sqlite --format json`.quiet().nothrow();

    // Should fail with non-zero exit code
    expect(result.exitCode).not.toBe(0);

    // Error message should mention SQLite and the database path
    const stderr = result.stderr.toString();
    expect(stderr).toContain("SQLite database");
    expect(stderr).toContain("/nonexistent/path/db.sqlite");
  });

  it("returns partial results with warning when SQLite data is malformed", async () => {
    const tempDir = join(tmpdir(), `oc-manager-sqlite-malformed-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tempDir, { recursive: true });
    const tempDbPath = join(tempDir, "malformed.db");

    const db = new Database(tempDbPath);
    db.run("CREATE TABLE project (id TEXT PRIMARY KEY, data TEXT NOT NULL)");
    db.run(
      "INSERT INTO project (id, data) VALUES (?, ?)",
      ["proj_good", JSON.stringify({ id: "proj_good", worktree: "/tmp", time: { created: 1700000000000 } })]
    );
    db.run("INSERT INTO project (id, data) VALUES (?, ?)", ["proj_bad", "{not-json"]);
    db.close();

    const result = await $`bun src/bin/opencode-manager.ts projects list --db ${tempDbPath} --format json`.quiet().nothrow();
    expect(result.exitCode).toBe(0);

    const parsed = JSON.parse(result.stdout.toString());
    expect(parsed.ok).toBe(true);
    expect(parsed.data.length).toBe(1);

    const stderr = result.stderr.toString();
    expect(stderr).toContain("Malformed JSON");

    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("fails in strict mode when SQLite data is malformed", async () => {
    const tempDir = join(tmpdir(), `oc-manager-sqlite-strict-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tempDir, { recursive: true });
    const tempDbPath = join(tempDir, "strict.db");

    const db = new Database(tempDbPath);
    db.run("CREATE TABLE project (id TEXT PRIMARY KEY, data TEXT NOT NULL)");
    db.run("INSERT INTO project (id, data) VALUES (?, ?)", ["proj_bad", "{not-json"]);
    db.close();

    const result = await $`bun src/bin/opencode-manager.ts projects list --db ${tempDbPath} --format json --sqlite-strict`.quiet().nothrow();
    expect(result.exitCode).not.toBe(0);

    const combined = result.stdout.toString() + result.stderr.toString();
    expect(combined).toContain("Malformed JSON");

    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("fails with helpful error when schema is invalid and strict mode is enabled", async () => {
    const tempDir = join(tmpdir(), `oc-manager-sqlite-schema-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tempDir, { recursive: true });
    const tempDbPath = join(tempDir, "schema.db");

    const db = new Database(tempDbPath);
    // Deliberately omit the project table to trigger schema validation error
    db.run("CREATE TABLE session (id TEXT PRIMARY KEY, data TEXT NOT NULL)");
    db.close();

    const result = await $`bun src/bin/opencode-manager.ts projects list --db ${tempDbPath} --format json --sqlite-strict`.quiet().nothrow();
    expect(result.exitCode).not.toBe(0);

    const combined = result.stdout.toString() + result.stderr.toString();
    expect(combined).toContain("schema is invalid");
    expect(combined).toContain("project");

    await fs.rm(tempDir, { recursive: true, force: true });
  });
});

/**
 * Integration tests for SQLite backend for projects delete.
 *
 * These tests verify that the `--experimental-sqlite` and `--db` flags
 * correctly switch to the SQLite backend for the projects delete command.
 *
 * Test fixture: A temporary copy of tests/fixtures/test.db is used for
 * destructive tests to avoid modifying the shared fixture.
 */
describe("projects delete --experimental-sqlite", () => {
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

  it("deletes project from SQLite database with --db flag and --yes", async () => {
    // Verify project exists before deletion
    const listBefore = await $`bun src/bin/opencode-manager.ts projects list --db ${tempDbPath} --format json`.quiet();
    const parsedBefore = JSON.parse(listBefore.stdout.toString());
    const projectsBefore = parsedBefore.data.map((p: { projectId: string }) => p.projectId);
    expect(projectsBefore).toContain("proj_missing");

    // Delete the project
    const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_missing --db ${tempDbPath} --format json --yes`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed.data).toHaveProperty("projectId", "proj_missing");
    expect(parsed.data).toHaveProperty("deleted");
    expect(parsed.data.deleted).toBeArray();

    // Verify project is gone after deletion
    const listAfter = await $`bun src/bin/opencode-manager.ts projects list --db ${tempDbPath} --format json`.quiet();
    const parsedAfter = JSON.parse(listAfter.stdout.toString());
    const projectsAfter = parsedAfter.data.map((p: { projectId: string }) => p.projectId);
    expect(projectsAfter).not.toContain("proj_missing");
    // Other projects should still exist
    expect(projectsAfter).toContain("proj_present");
  });

  it("supports project ID prefix matching with SQLite", async () => {
    // Delete using prefix "proj_miss"
    const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_miss --db ${tempDbPath} --format json --yes`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", true);
    // Should resolve "proj_miss" to "proj_missing"
    expect(parsed.data).toHaveProperty("projectId", "proj_missing");

    // Verify project is deleted
    const listAfter = await $`bun src/bin/opencode-manager.ts projects list --db ${tempDbPath} --format json`.quiet();
    const parsedAfter = JSON.parse(listAfter.stdout.toString());
    const projectsAfter = parsedAfter.data.map((p: { projectId: string }) => p.projectId);
    expect(projectsAfter).not.toContain("proj_missing");
  });

  it("outputs dry-run result with SQLite backend", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_missing --db ${tempDbPath} --format json --dry-run`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed.data).toHaveProperty("dryRun", true);
    expect(parsed.data).toHaveProperty("operation", "delete");
    expect(parsed.data).toHaveProperty("resourceType", "project");
    expect(parsed.data).toHaveProperty("count", 1);
    expect(parsed.data).toHaveProperty("paths");
    // SQLite virtual paths have format sqlite:project:{id}
    expect(parsed.data.paths[0]).toContain("sqlite:project:proj_missing");

    // Verify project is NOT deleted (dry run)
    const listAfter = await $`bun src/bin/opencode-manager.ts projects list --db ${tempDbPath} --format json`.quiet();
    const parsedAfter = JSON.parse(listAfter.stdout.toString());
    const projectsAfter = parsedAfter.data.map((p: { projectId: string }) => p.projectId);
    expect(projectsAfter).toContain("proj_missing");
  });

  it("requires --yes flag for destructive operation (SQLite)", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_missing --db ${tempDbPath} --format json`.quiet().nothrow();

    expect(result.exitCode).toBe(2);

    // Project should still exist
    const listAfter = await $`bun src/bin/opencode-manager.ts projects list --db ${tempDbPath} --format json`.quiet();
    const parsedAfter = JSON.parse(listAfter.stdout.toString());
    const projectsAfter = parsedAfter.data.map((p: { projectId: string }) => p.projectId);
    expect(projectsAfter).toContain("proj_missing");
  });

  it("returns error for non-existent project ID with SQLite", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects delete --id nonexistent_project --db ${tempDbPath} --format json --yes`.quiet().nothrow();

    expect(result.exitCode).toBe(3);

    // JSON error output goes to stdout
    const output = result.stdout.toString().trim();
    if (output) {
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty("ok", false);
      expect(parsed).toHaveProperty("error");
      expect(parsed.error).toContain("nonexistent_project");
    } else {
      // Fallback: error might be in stderr
      const stderr = result.stderr.toString();
      expect(stderr).toContain("nonexistent_project");
    }
  });

  it("returns error for non-existent database file", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_missing --db /nonexistent/path/db.sqlite --format json --yes`.quiet().nothrow();

    expect(result.exitCode).not.toBe(0);

    // Error should mention the missing database
    const stderr = result.stderr.toString();
    expect(stderr).toContain("SQLite database");
    expect(stderr).toContain("/nonexistent/path/db.sqlite");
  });

  it("returns helpful error when database is locked", async () => {
    const locker = new Database(tempDbPath);
    // Hold a write lock but allow reads to proceed.
    locker.run("BEGIN IMMEDIATE");

    try {
      const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_missing --db ${tempDbPath} --format json --yes`.quiet().nothrow();

      expect(result.exitCode).not.toBe(0);
      const combined = result.stdout.toString() + result.stderr.toString();
      expect(combined).toContain("locked");
      expect(combined).toContain("--force-write");
    } finally {
      locker.run("ROLLBACK");
      locker.close();
    }
  });

  it("works with table format output (SQLite)", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_missing --db ${tempDbPath} --format table --yes`.quiet();
    const output = result.stdout.toString();

    // Table format should show success message
    expect(output).toContain("Deleted project");
    expect(output).toContain("proj_missing");
  });

  it("works with ndjson format output (SQLite)", async () => {
    const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_missing --db ${tempDbPath} --format ndjson --yes`.quiet();
    const output = result.stdout.toString().trim();

    // NDJSON format wraps output in success envelope for consistency
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed.data).toHaveProperty("projectId", "proj_missing");
    expect(parsed.data).toHaveProperty("deleted");
  });

  it("deletes project and all related sessions/messages/parts atomically", async () => {
    // Get initial counts by checking sessions
    const sessionsBefore = await $`bun src/bin/opencode-manager.ts sessions list --db ${tempDbPath} --format json`.quiet();
    const parsedSessionsBefore = JSON.parse(sessionsBefore.stdout.toString());
    // proj_present has 3 sessions: session_parser_fix, session_add_tests, session_refactor_api
    const sessionsInProject = parsedSessionsBefore.data.filter(
      (s: { projectId: string }) => s.projectId === "proj_present"
    );
    expect(sessionsInProject.length).toBeGreaterThan(0);

    // Delete the project
    await $`bun src/bin/opencode-manager.ts projects delete --id proj_present --db ${tempDbPath} --format json --yes`.quiet();

    // Verify project is gone
    const listAfter = await $`bun src/bin/opencode-manager.ts projects list --db ${tempDbPath} --format json`.quiet();
    const parsedAfter = JSON.parse(listAfter.stdout.toString());
    const projectsAfter = parsedAfter.data.map((p: { projectId: string }) => p.projectId);
    expect(projectsAfter).not.toContain("proj_present");

    // Verify sessions belonging to the project are also gone
    const sessionsAfter = await $`bun src/bin/opencode-manager.ts sessions list --db ${tempDbPath} --format json`.quiet();
    const parsedSessionsAfter = JSON.parse(sessionsAfter.stdout.toString());
    const sessionsInProjectAfter = parsedSessionsAfter.data.filter(
      (s: { projectId: string }) => s.projectId === "proj_present"
    );
    expect(sessionsInProjectAfter.length).toBe(0);
  });

  it("ignores --backup-dir flag with SQLite backend (virtual paths cannot be backed up)", async () => {
    // backup-dir is only meaningful for JSONL file backend
    // SQLite backend should ignore it and proceed with deletion
    const result = await $`bun src/bin/opencode-manager.ts projects delete --id proj_missing --db ${tempDbPath} --format json --yes --backup-dir ${tempDbDir}`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed.data).toHaveProperty("projectId", "proj_missing");

    // Project should be deleted
    const listAfter = await $`bun src/bin/opencode-manager.ts projects list --db ${tempDbPath} --format json`.quiet();
    const parsedAfter = JSON.parse(listAfter.stdout.toString());
    const projectsAfter = parsedAfter.data.map((p: { projectId: string }) => p.projectId);
    expect(projectsAfter).not.toContain("proj_missing");
  });
});
