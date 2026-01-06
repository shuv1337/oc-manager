/**
 * Tests for opencode-data.ts
 *
 * Uses fixture store at tests/fixtures/store to verify data loading functions.
 */

import { describe, expect, it } from "bun:test";
import { FIXTURE_STORE_ROOT } from "../helpers";
import {
  loadProjectRecords,
  filterProjectsByState,
  type ProjectRecord,
} from "../../src/lib/opencode-data";

describe("loadProjectRecords", () => {
  it("loads project records from fixture store", async () => {
    const records = await loadProjectRecords({ root: FIXTURE_STORE_ROOT });

    expect(records).toBeArray();
    expect(records.length).toBe(2);
  });

  it("returns records with correct structure", async () => {
    const records = await loadProjectRecords({ root: FIXTURE_STORE_ROOT });

    for (const record of records) {
      expect(record).toHaveProperty("index");
      expect(record).toHaveProperty("bucket");
      expect(record).toHaveProperty("filePath");
      expect(record).toHaveProperty("projectId");
      expect(record).toHaveProperty("worktree");
      expect(record).toHaveProperty("vcs");
      expect(record).toHaveProperty("createdAt");
      expect(record).toHaveProperty("state");
    }
  });

  it("assigns sequential 1-based indexes", async () => {
    const records = await loadProjectRecords({ root: FIXTURE_STORE_ROOT });

    const indexes = records.map((r) => r.index);
    expect(indexes).toEqual([1, 2]);
  });

  it("parses project metadata correctly", async () => {
    const records = await loadProjectRecords({ root: FIXTURE_STORE_ROOT });

    // Find proj_present
    const present = records.find((r) => r.projectId === "proj_present");
    expect(present).toBeDefined();
    expect(present!.bucket).toBe("project");
    expect(present!.vcs).toBe("git");
    expect(present!.createdAt).toBeInstanceOf(Date);
    expect(present!.createdAt!.getTime()).toBe(1704067200000);

    // Find proj_missing
    const missing = records.find((r) => r.projectId === "proj_missing");
    expect(missing).toBeDefined();
    expect(missing!.bucket).toBe("project");
    expect(missing!.vcs).toBe("git");
    expect(missing!.createdAt).toBeInstanceOf(Date);
    expect(missing!.createdAt!.getTime()).toBe(1704153600000);
  });

  it("sorts by createdAt descending (newest first)", async () => {
    const records = await loadProjectRecords({ root: FIXTURE_STORE_ROOT });

    // proj_missing has later timestamp (1704153600000) than proj_present (1704067200000)
    expect(records[0].projectId).toBe("proj_missing");
    expect(records[1].projectId).toBe("proj_present");
  });

  it("detects worktree state correctly", async () => {
    const records = await loadProjectRecords({ root: FIXTURE_STORE_ROOT });

    // proj_present has worktree at tests/fixtures/worktrees/my-present-project (exists)
    const present = records.find((r) => r.projectId === "proj_present");
    expect(present).toBeDefined();
    expect(present!.state).toBe("present");

    // proj_missing has worktree at tests/fixtures/worktrees/nonexistent-project (doesn't exist)
    const missing = records.find((r) => r.projectId === "proj_missing");
    expect(missing).toBeDefined();
    expect(missing!.state).toBe("missing");
  });

  it("returns empty array for non-existent root", async () => {
    const records = await loadProjectRecords({
      root: "/tmp/nonexistent-opencode-store-12345",
    });

    expect(records).toBeArray();
    expect(records.length).toBe(0);
  });

  it("includes filePath with full path to JSON file", async () => {
    const records = await loadProjectRecords({ root: FIXTURE_STORE_ROOT });

    for (const record of records) {
      expect(record.filePath).toMatch(/\.json$/);
      expect(record.filePath).toContain(FIXTURE_STORE_ROOT);
      expect(record.filePath).toContain(record.projectId);
    }
  });
});

describe("filterProjectsByState", () => {
  it("filters projects with missing worktrees", async () => {
    const records = await loadProjectRecords({ root: FIXTURE_STORE_ROOT });
    const missing = filterProjectsByState(records, "missing");

    expect(missing).toBeArray();
    expect(missing.length).toBe(1);
    expect(missing[0].projectId).toBe("proj_missing");
    expect(missing[0].state).toBe("missing");
  });

  it("filters projects with present worktrees", async () => {
    const records = await loadProjectRecords({ root: FIXTURE_STORE_ROOT });
    const present = filterProjectsByState(records, "present");

    expect(present).toBeArray();
    expect(present.length).toBe(1);
    expect(present[0].projectId).toBe("proj_present");
    expect(present[0].state).toBe("present");
  });

  it("returns empty array when no projects match state", async () => {
    const records = await loadProjectRecords({ root: FIXTURE_STORE_ROOT });
    const unknown = filterProjectsByState(records, "unknown");

    expect(unknown).toBeArray();
    expect(unknown.length).toBe(0);
  });
});
