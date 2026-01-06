/**
 * Tests for `projects list` CLI command output.
 *
 * Uses fixture store at tests/fixtures/store to verify command output formats.
 */

import { describe, expect, it } from "bun:test";
import { $ } from "bun";
import { FIXTURE_STORE_ROOT } from "../../helpers";

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
