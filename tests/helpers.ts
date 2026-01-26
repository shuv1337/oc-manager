/**
 * Test Helpers
 *
 * Utilities for resolving test fixture paths and common test setup.
 */

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Root of the tests directory.
 */
export const TESTS_ROOT = __dirname;

/**
 * Root of the fixtures directory.
 */
export const FIXTURES_ROOT = join(__dirname, "fixtures");

/**
 * Path to the simulated OpenCode store (equivalent to ~/.local/share/opencode).
 */
export const FIXTURE_STORE_ROOT = join(FIXTURES_ROOT, "store");

/**
 * Path to the SQLite test fixture database.
 */
export const FIXTURE_SQLITE_PATH = join(FIXTURES_ROOT, "test.db");

/**
 * Resolves a path relative to the fixtures directory.
 *
 * @param relativePath - Path relative to tests/fixtures/
 * @returns Absolute path to the fixture
 *
 * @example
 * ```ts
 * const projectPath = fixturesPath("store/storage/project/proj_present.json");
 * ```
 */
export function fixturesPath(...relativePath: string[]): string {
  return join(FIXTURES_ROOT, ...relativePath);
}

/**
 * Resolves a path relative to the fixture store directory.
 * Shorthand for `fixturesPath("store", ...relativePath)`.
 *
 * @param relativePath - Path relative to tests/fixtures/store/
 * @returns Absolute path within the fixture store
 *
 * @example
 * ```ts
 * const storageRoot = storePath("storage");
 * const projectFile = storePath("storage/project/proj_present.json");
 * ```
 */
export function storePath(...relativePath: string[]): string {
  return join(FIXTURE_STORE_ROOT, ...relativePath);
}
