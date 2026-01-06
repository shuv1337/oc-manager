/**
 * Tests for `tokens` CLI subcommands.
 *
 * Uses fixture store at tests/fixtures/store to verify command output formats.
 *
 * Fixture data:
 * - session_add_tests: Has token data (input: 150, output: 75, reasoning: 10, cacheRead: 50, cacheWrite: 25)
 * - session_parser_fix: No messages, so no token data
 */

import { describe, expect, it } from "bun:test";
import { $ } from "bun";
import { FIXTURE_STORE_ROOT } from "../../helpers";

// ========================
// tokens session
// ========================

describe("tokens session --format json", () => {
  it("outputs valid JSON with success envelope", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens session --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed).toHaveProperty("data");
  });

  it("includes token summary with kind 'known' for session with messages", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens session --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data).toHaveProperty("kind", "known");
    expect(parsed.data).toHaveProperty("tokens");
  });

  it("includes correct token breakdown values", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens session --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    const tokens = parsed.data.tokens;
    expect(tokens).toHaveProperty("input", 150);
    expect(tokens).toHaveProperty("output", 75);
    expect(tokens).toHaveProperty("reasoning", 10);
    expect(tokens).toHaveProperty("cacheRead", 50);
    expect(tokens).toHaveProperty("cacheWrite", 25);
    expect(tokens).toHaveProperty("total", 310);
  });

  it("returns unknown summary for session without messages", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens session --session session_parser_fix --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data).toHaveProperty("kind", "unknown");
    expect(parsed.data).toHaveProperty("reason");
  });

  it("returns error for non-existent session", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens session --session nonexistent_session --root ${FIXTURE_STORE_ROOT} --format json`.nothrow().quiet();
    // Error output goes to stderr
    const output = result.stderr.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", false);
    expect(parsed).toHaveProperty("error");
    expect(result.exitCode).toBe(3);
  });
});

describe("tokens session --format ndjson", () => {
  it("outputs valid NDJSON (single line)", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens session --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format ndjson`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    expect(lines.length).toBe(1);
    expect(() => JSON.parse(lines[0])).not.toThrow();
  });

  it("includes token summary in NDJSON line", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens session --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format ndjson`.quiet();
    const output = result.stdout.toString().trim();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("kind", "known");
    expect(parsed).toHaveProperty("tokens");
    expect(parsed.tokens).toHaveProperty("total", 310);
  });

  it("does not include envelope wrapper", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens session --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format ndjson`.quiet();
    const output = result.stdout.toString().trim();

    const parsed = JSON.parse(output);
    expect(parsed).not.toHaveProperty("ok");
    expect(parsed).not.toHaveProperty("data");
  });
});

describe("tokens session --format table", () => {
  it("outputs formatted table with headers", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens session --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format table`.quiet();
    const output = result.stdout.toString();

    expect(output).toContain("Category");
    expect(output).toContain("Tokens");
    expect(output).toContain("%");
  });

  it("includes token category rows", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens session --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format table`.quiet();
    const output = result.stdout.toString();

    expect(output).toContain("Input");
    expect(output).toContain("Output");
    expect(output).toContain("Reasoning");
  });

  it("includes total row", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens session --session session_add_tests --root ${FIXTURE_STORE_ROOT} --format table`.quiet();
    const output = result.stdout.toString();

    expect(output).toContain("Total");
    expect(output).toContain("310");
  });
});

// ========================
// tokens project
// ========================

describe("tokens project --format json", () => {
  it("outputs valid JSON with success envelope", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens project --project proj_present --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed).toHaveProperty("data");
  });

  it("includes aggregate token summary structure", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens project --project proj_present --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data).toHaveProperty("total");
    expect(parsed.data.total).toHaveProperty("kind");
    expect(parsed.data).toHaveProperty("unknownSessions");
  });

  it("includes knownOnly breakdown when tokens are known", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens project --project proj_present --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data).toHaveProperty("knownOnly");
    expect(parsed.data.knownOnly).toHaveProperty("input", 150);
    expect(parsed.data.knownOnly).toHaveProperty("total", 310);
  });

  it("tracks unknown sessions count", async () => {
    // proj_present has 2 sessions: session_add_tests (with tokens) and session_parser_fix (without)
    const result = await $`bun src/bin/opencode-manager.ts tokens project --project proj_present --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.unknownSessions).toBe(1);
  });

  it("returns error for non-existent project", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens project --project nonexistent_project --root ${FIXTURE_STORE_ROOT} --format json`.nothrow().quiet();
    // Error output goes to stderr
    const output = result.stderr.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", false);
    expect(parsed).toHaveProperty("error");
    expect(result.exitCode).toBe(3);
  });
});

describe("tokens project --format ndjson", () => {
  it("outputs valid NDJSON (single line)", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens project --project proj_present --root ${FIXTURE_STORE_ROOT} --format ndjson`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    expect(lines.length).toBe(1);
    expect(() => JSON.parse(lines[0])).not.toThrow();
  });

  it("includes aggregate summary fields", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens project --project proj_present --root ${FIXTURE_STORE_ROOT} --format ndjson`.quiet();
    const output = result.stdout.toString().trim();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("total");
    expect(parsed).toHaveProperty("knownOnly");
    expect(parsed).toHaveProperty("unknownSessions");
  });
});

describe("tokens project --format table", () => {
  it("outputs formatted table with headers", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens project --project proj_present --root ${FIXTURE_STORE_ROOT} --format table`.quiet();
    const output = result.stdout.toString();

    expect(output).toContain("Category");
    expect(output).toContain("Tokens");
  });

  it("includes project label", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens project --project proj_present --root ${FIXTURE_STORE_ROOT} --format table`.quiet();
    const output = result.stdout.toString();

    expect(output).toContain("proj_present");
  });
});

// ========================
// tokens global
// ========================

describe("tokens global --format json", () => {
  it("outputs valid JSON with success envelope", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens global --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed).toHaveProperty("data");
  });

  it("includes aggregate token summary structure", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens global --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data).toHaveProperty("total");
    expect(parsed.data).toHaveProperty("unknownSessions");
  });

  it("aggregates tokens from all sessions", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens global --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    // Should have tokens from session_add_tests (310 total)
    expect(parsed.data.knownOnly).toHaveProperty("total", 310);
  });

  it("counts all unknown sessions globally", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens global --root ${FIXTURE_STORE_ROOT} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    // session_parser_fix has no messages, so it's unknown
    expect(parsed.data.unknownSessions).toBe(1);
  });
});

describe("tokens global --format ndjson", () => {
  it("outputs valid NDJSON (single line)", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens global --root ${FIXTURE_STORE_ROOT} --format ndjson`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    expect(lines.length).toBe(1);
    expect(() => JSON.parse(lines[0])).not.toThrow();
  });

  it("includes aggregate summary fields", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens global --root ${FIXTURE_STORE_ROOT} --format ndjson`.quiet();
    const output = result.stdout.toString().trim();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("total");
    expect(parsed).toHaveProperty("unknownSessions");
  });
});

describe("tokens global --format table", () => {
  it("outputs formatted table with headers", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens global --root ${FIXTURE_STORE_ROOT} --format table`.quiet();
    const output = result.stdout.toString();

    expect(output).toContain("Category");
    expect(output).toContain("Tokens");
  });

  it("includes global label", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens global --root ${FIXTURE_STORE_ROOT} --format table`.quiet();
    const output = result.stdout.toString();

    expect(output).toContain("Global");
  });

  it("includes total tokens row", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens global --root ${FIXTURE_STORE_ROOT} --format table`.quiet();
    const output = result.stdout.toString();

    expect(output).toContain("Total");
    expect(output).toContain("310");
  });
});
