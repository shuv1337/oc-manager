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
import { FIXTURE_STORE_ROOT, FIXTURE_SQLITE_PATH } from "../../helpers";

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

// ========================
// tokens session --experimental-sqlite
// ========================

describe("tokens session --experimental-sqlite", () => {
  it("outputs valid JSON with success envelope using --db flag", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens session --session session_add_tests --db ${FIXTURE_SQLITE_PATH} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed).toHaveProperty("data");
  });

  it("includes token summary with kind 'known' for session with messages", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens session --session session_add_tests --db ${FIXTURE_SQLITE_PATH} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data).toHaveProperty("kind", "known");
    expect(parsed.data).toHaveProperty("tokens");
  });

  it("includes correct token breakdown values from SQLite", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens session --session session_add_tests --db ${FIXTURE_SQLITE_PATH} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    const tokens = parsed.data.tokens;
    // session_add_tests has: input=150, output=75, reasoning=10, cacheRead=50, cacheWrite=25
    expect(tokens).toHaveProperty("input", 150);
    expect(tokens).toHaveProperty("output", 75);
    expect(tokens).toHaveProperty("reasoning", 10);
    expect(tokens).toHaveProperty("cacheRead", 50);
    expect(tokens).toHaveProperty("cacheWrite", 25);
    expect(tokens).toHaveProperty("total", 310);
  });

  it("aggregates tokens from multiple messages in session", async () => {
    // session_parser_fix has 2 assistant messages with tokens
    const result = await $`bun src/bin/opencode-manager.ts tokens session --session session_parser_fix --db ${FIXTURE_SQLITE_PATH} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data).toHaveProperty("kind", "known");
    const tokens = parsed.data.tokens;
    // msg_parser_assistant_01: input=200, output=100, reasoning=0, cacheRead=0, cacheWrite=0
    // msg_parser_assistant_02: input=250, output=150, reasoning=5, cacheRead=30, cacheWrite=10
    // Totals: input=450, output=250, reasoning=5, cacheRead=30, cacheWrite=10, total=745
    expect(tokens).toHaveProperty("input", 450);
    expect(tokens).toHaveProperty("output", 250);
    expect(tokens).toHaveProperty("reasoning", 5);
    expect(tokens).toHaveProperty("cacheRead", 30);
    expect(tokens).toHaveProperty("cacheWrite", 10);
    expect(tokens).toHaveProperty("total", 745);
  });

  it("returns unknown summary for session without messages", async () => {
    // session_fork_parser has no messages in the SQLite fixture
    const result = await $`bun src/bin/opencode-manager.ts tokens session --session session_fork_parser --db ${FIXTURE_SQLITE_PATH} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data).toHaveProperty("kind", "unknown");
    expect(parsed.data).toHaveProperty("reason");
  });

  it("returns error for non-existent session", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens session --session nonexistent_session --db ${FIXTURE_SQLITE_PATH} --format json`.nothrow().quiet();
    const output = result.stderr.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", false);
    expect(parsed).toHaveProperty("error");
    expect(result.exitCode).toBe(3);
  });

  it("works with ndjson format", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens session --session session_add_tests --db ${FIXTURE_SQLITE_PATH} --format ndjson`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    expect(lines.length).toBe(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed).toHaveProperty("kind", "known");
    expect(parsed).toHaveProperty("tokens");
    expect(parsed.tokens).toHaveProperty("total", 310);
  });

  it("works with table format", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens session --session session_add_tests --db ${FIXTURE_SQLITE_PATH} --format table`.quiet();
    const output = result.stdout.toString();

    expect(output).toContain("Category");
    expect(output).toContain("Tokens");
    expect(output).toContain("Total");
    expect(output).toContain("310");
  });

  it("returns error for non-existent database file", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens session --session session_add_tests --db /nonexistent/path/to/db.sqlite --format json`.nothrow().quiet();

    expect(result.exitCode).toBe(1);
    const output = result.stderr.toString();
    expect(output).toContain("Failed to open SQLite database");
  });
});

// ========================
// tokens project --experimental-sqlite
// ========================

describe("tokens project --experimental-sqlite", () => {
  it("outputs valid JSON with success envelope using --db flag", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens project --project proj_present --db ${FIXTURE_SQLITE_PATH} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed).toHaveProperty("data");
  });

  it("includes aggregate token summary structure", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens project --project proj_present --db ${FIXTURE_SQLITE_PATH} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data).toHaveProperty("total");
    expect(parsed.data.total).toHaveProperty("kind");
    expect(parsed.data).toHaveProperty("unknownSessions");
  });

  it("aggregates tokens from all sessions in project", async () => {
    // proj_present has 4 sessions: session_parser_fix (745), session_add_tests (310),
    // session_refactor_api (970), session_fork_parser (0, no messages)
    // Total known = 745 + 310 + 970 = 2025
    const result = await $`bun src/bin/opencode-manager.ts tokens project --project proj_present --db ${FIXTURE_SQLITE_PATH} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data).toHaveProperty("knownOnly");
    expect(parsed.data.knownOnly).toHaveProperty("total", 2025);
  });

  it("tracks unknown sessions count correctly", async () => {
    // proj_present has session_fork_parser with no messages
    const result = await $`bun src/bin/opencode-manager.ts tokens project --project proj_present --db ${FIXTURE_SQLITE_PATH} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.unknownSessions).toBe(1);
  });

  it("computes tokens for project with single session", async () => {
    // proj_missing has 1 session: session_missing_proj_01 with tokens
    const result = await $`bun src/bin/opencode-manager.ts tokens project --project proj_missing --db ${FIXTURE_SQLITE_PATH} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data).toHaveProperty("knownOnly");
    // session_missing_proj_01: input=100, output=50, reasoning=0, cacheRead=0, cacheWrite=0, total=150
    expect(parsed.data.knownOnly).toHaveProperty("total", 150);
    expect(parsed.data.unknownSessions).toBe(0);
  });

  it("returns error for non-existent project", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens project --project nonexistent_project --db ${FIXTURE_SQLITE_PATH} --format json`.nothrow().quiet();
    const output = result.stderr.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", false);
    expect(parsed).toHaveProperty("error");
    expect(result.exitCode).toBe(3);
  });

  it("works with ndjson format", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens project --project proj_present --db ${FIXTURE_SQLITE_PATH} --format ndjson`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    expect(lines.length).toBe(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed).toHaveProperty("total");
    expect(parsed).toHaveProperty("knownOnly");
    expect(parsed).toHaveProperty("unknownSessions");
  });

  it("works with table format", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens project --project proj_present --db ${FIXTURE_SQLITE_PATH} --format table`.quiet();
    const output = result.stdout.toString();

    expect(output).toContain("Category");
    expect(output).toContain("Tokens");
    expect(output).toContain("proj_present");
  });

  it("returns error for non-existent database file", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens project --project proj_present --db /nonexistent/path/to/db.sqlite --format json`.nothrow().quiet();

    expect(result.exitCode).toBe(1);
    const output = result.stderr.toString();
    expect(output).toContain("Failed to open SQLite database");
  });
});

// ========================
// tokens global --experimental-sqlite
// ========================

describe("tokens global --experimental-sqlite", () => {
  it("outputs valid JSON with success envelope using --db flag", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens global --db ${FIXTURE_SQLITE_PATH} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("ok", true);
    expect(parsed).toHaveProperty("data");
  });

  it("includes aggregate token summary structure", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens global --db ${FIXTURE_SQLITE_PATH} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data).toHaveProperty("total");
    expect(parsed.data).toHaveProperty("unknownSessions");
  });

  it("aggregates tokens from all sessions globally", async () => {
    // All sessions: session_add_tests (310) + session_parser_fix (745) + 
    // session_refactor_api (970) + session_missing_proj_01 (150) + session_fork_parser (0)
    // Total known = 310 + 745 + 970 + 150 = 2175
    const result = await $`bun src/bin/opencode-manager.ts tokens global --db ${FIXTURE_SQLITE_PATH} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.knownOnly).toHaveProperty("total", 2175);
  });

  it("counts all unknown sessions globally", async () => {
    // session_fork_parser has no messages
    const result = await $`bun src/bin/opencode-manager.ts tokens global --db ${FIXTURE_SQLITE_PATH} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    expect(parsed.data.unknownSessions).toBe(1);
  });

  it("includes correct token breakdown values", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens global --db ${FIXTURE_SQLITE_PATH} --format json`.quiet();
    const output = result.stdout.toString();

    const parsed = JSON.parse(output);
    const tokens = parsed.data.knownOnly;
    // Aggregated from all sessions:
    // input: 150 + 450 + 500 + 100 = 1200
    // output: 75 + 250 + 300 + 50 = 675
    // reasoning: 10 + 5 + 20 + 0 = 35
    // cacheRead: 50 + 30 + 100 + 0 = 180
    // cacheWrite: 25 + 10 + 50 + 0 = 85
    expect(tokens).toHaveProperty("input", 1200);
    expect(tokens).toHaveProperty("output", 675);
    expect(tokens).toHaveProperty("reasoning", 35);
    expect(tokens).toHaveProperty("cacheRead", 180);
    expect(tokens).toHaveProperty("cacheWrite", 85);
  });

  it("works with ndjson format", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens global --db ${FIXTURE_SQLITE_PATH} --format ndjson`.quiet();
    const output = result.stdout.toString().trim();
    const lines = output.split("\n");

    expect(lines.length).toBe(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed).toHaveProperty("total");
    expect(parsed).toHaveProperty("unknownSessions");
  });

  it("works with table format", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens global --db ${FIXTURE_SQLITE_PATH} --format table`.quiet();
    const output = result.stdout.toString();

    expect(output).toContain("Category");
    expect(output).toContain("Tokens");
    expect(output).toContain("Global");
    expect(output).toContain("Total");
  });

  it("returns error for non-existent database file", async () => {
    const result = await $`bun src/bin/opencode-manager.ts tokens global --db /nonexistent/path/to/db.sqlite --format json`.nothrow().quiet();

    expect(result.exitCode).toBe(1);
    const output = result.stderr.toString();
    expect(output).toContain("Failed to open SQLite database");
  });
});
