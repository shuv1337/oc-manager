/**
 * CLI Smoke Tests
 *
 * Verifies that the CLI boots correctly and produces expected help output.
 * Note: The main entry point routes to TUI by default; CLI subcommands
 * are accessed via `projects`, `sessions`, `chat`, `tokens` subcommands.
 */

import { describe, expect, it } from "bun:test";
import { $ } from "bun";
import { parseGlobalOptions, DEFAULT_OPTIONS } from "../../src/cli/index";

describe("CLI smoke tests", () => {
  it("displays projects subcommand help", async () => {
    const result =
      await $`bun src/bin/opencode-manager.ts projects --help`.quiet();
    const output = result.stdout.toString();

    expect(output).toContain("projects");
    expect(output).toContain("list");
    expect(output).toContain("delete");
    expect(output).toContain("--experimental-sqlite");
    expect(output).toContain("--db");
    expect(output).toContain("--sqlite-strict");
    expect(output).toContain("--force-write");
    expect(output).toContain("Examples");
  });

  it("displays sessions subcommand help", async () => {
    const result =
      await $`bun src/bin/opencode-manager.ts sessions --help`.quiet();
    const output = result.stdout.toString();

    expect(output).toContain("sessions");
    expect(output).toContain("list");
    expect(output).toContain("delete");
    expect(output).toContain("rename");
    expect(output).toContain("move");
    expect(output).toContain("copy");
  });

  it("displays chat subcommand help", async () => {
    const result =
      await $`bun src/bin/opencode-manager.ts chat --help`.quiet();
    const output = result.stdout.toString();

    expect(output).toContain("chat");
    expect(output).toContain("list");
    expect(output).toContain("show");
    expect(output).toContain("search");
  });

  it("displays tokens subcommand help", async () => {
    const result =
      await $`bun src/bin/opencode-manager.ts tokens --help`.quiet();
    const output = result.stdout.toString();

    expect(output).toContain("tokens");
    expect(output).toContain("session");
    expect(output).toContain("project");
    expect(output).toContain("global");
  });

  it("displays nested subcommand help for projects list", async () => {
    const result =
      await $`bun src/bin/opencode-manager.ts projects list --help`.quiet();
    const output = result.stdout.toString();

    expect(output).toContain("list");
    expect(output).toContain("--missing-only");
    expect(output).toContain("--search");
  });

  it("displays nested subcommand help for sessions list", async () => {
    const result =
      await $`bun src/bin/opencode-manager.ts sessions list --help`.quiet();
    const output = result.stdout.toString();

    expect(output).toContain("list");
    expect(output).toContain("--project");
    expect(output).toContain("--search");
  });

  it("displays nested subcommand help for chat show", async () => {
    const result =
      await $`bun src/bin/opencode-manager.ts chat show --help`.quiet();
    const output = result.stdout.toString();

    expect(output).toContain("show");
    expect(output).toContain("--session");
    expect(output).toContain("--message");
    expect(output).toContain("--index");
  });

  it("displays nested subcommand help for tokens session", async () => {
    const result =
      await $`bun src/bin/opencode-manager.ts tokens session --help`.quiet();
    const output = result.stdout.toString();

    expect(output).toContain("session");
    expect(output).toContain("--session");
  });
});

describe("parseGlobalOptions SQLite flags", () => {
  it("--experimental-sqlite flag is parsed correctly", () => {
    const opts = parseGlobalOptions({
      experimentalSqlite: true,
    });

    expect(opts.experimentalSqlite).toBe(true);
    expect(opts.dbPath).toBeUndefined();
  });

  it("defaults experimentalSqlite to false when not provided", () => {
    const opts = parseGlobalOptions({});

    expect(opts.experimentalSqlite).toBe(false);
    expect(opts.dbPath).toBeUndefined();
  });

  it("--db path sets both dbPath and experimentalSqlite", () => {
    const opts = parseGlobalOptions({
      db: "/path/to/db.sqlite",
    });

    expect(opts.experimentalSqlite).toBe(true);
    expect(opts.dbPath).toContain("db.sqlite");
  });

  it("--db resolves relative paths to absolute", () => {
    const opts = parseGlobalOptions({
      db: "relative/path/db.sqlite",
    });

    expect(opts.dbPath).toMatch(/^\//);  // Absolute path starts with /
    expect(opts.dbPath).toContain("relative/path/db.sqlite");
  });

  it("--db without --experimental-sqlite still enables experimentalSqlite", () => {
    const opts = parseGlobalOptions({
      db: "/custom/path/opencode.db",
      experimentalSqlite: false,  // explicitly false, but --db overrides
    });

    expect(opts.experimentalSqlite).toBe(true);
    expect(opts.dbPath).toBe("/custom/path/opencode.db");
  });

  it("--sqlite-strict flag is parsed correctly", () => {
    const opts = parseGlobalOptions({
      sqliteStrict: true,
    });

    expect(opts.sqliteStrict).toBe(true);
  });

  it("--force-write flag is parsed correctly", () => {
    const opts = parseGlobalOptions({
      forceWrite: true,
    });

    expect(opts.forceWrite).toBe(true);
  });

  it("existing commands work without SQLite flags (regression)", () => {
    const opts = parseGlobalOptions({
      root: "/custom/root",
      format: "json",
      limit: "50",
      sort: "created",
    });

    expect(opts.root).toContain("custom/root");
    expect(opts.format).toBe("json");
    expect(opts.limit).toBe(50);
    expect(opts.sort).toBe("created");
    expect(opts.experimentalSqlite).toBe(false);
    expect(opts.dbPath).toBeUndefined();
    expect(opts.sqliteStrict).toBe(false);
    expect(opts.forceWrite).toBe(false);
  });

  it("DEFAULT_OPTIONS has correct SQLite defaults", () => {
    expect(DEFAULT_OPTIONS.experimentalSqlite).toBe(false);
    expect(DEFAULT_OPTIONS.dbPath).toBeUndefined();
    expect(DEFAULT_OPTIONS.sqliteStrict).toBe(false);
    expect(DEFAULT_OPTIONS.forceWrite).toBe(false);
  });
});
