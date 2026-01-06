/**
 * CLI backup utilities module.
 *
 * Provides helpers for backing up files and directories before
 * destructive operations like delete.
 */

import { promises as fs } from "node:fs"
import { basename, dirname, join, relative, resolve } from "node:path"
import { FileOperationError } from "./errors"

// ========================
// Types
// ========================

/**
 * Options for backup operations.
 */
export interface BackupOptions {
  /** Base directory for backups. Files are copied here with structure preserved. */
  backupDir: string
  /** Optional prefix for backup directory name (defaults to timestamp). */
  prefix?: string
  /** Whether to preserve the original directory structure relative to a root. */
  preserveStructure?: boolean
  /** Root directory for preserving structure (paths are relative to this). */
  structureRoot?: string
}

/**
 * Result of a backup operation.
 */
export interface BackupResult {
  /** Source paths that were backed up. */
  sources: string[]
  /** Destination paths where backups were created. */
  destinations: string[]
  /** The backup directory used (may include timestamp subdirectory). */
  backupDir: string
  /** Any paths that failed to backup. */
  failed: Array<{ path: string; error: string }>
}

// ========================
// Helpers
// ========================

/**
 * Generate a timestamp string for backup directory names.
 *
 * @returns ISO-like timestamp without colons (filesystem safe)
 */
export function generateBackupTimestamp(): string {
  const now = new Date()
  // Format: YYYY-MM-DD_HH-MM-SS
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  const hours = String(now.getHours()).padStart(2, "0")
  const minutes = String(now.getMinutes()).padStart(2, "0")
  const seconds = String(now.getSeconds()).padStart(2, "0")
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`
}

/**
 * Ensure a directory exists, creating it if necessary.
 *
 * @param dir - Directory path to ensure
 */
async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
}

/**
 * Check if a path exists.
 *
 * @param path - Path to check
 * @returns true if exists, false otherwise
 */
async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

/**
 * Check if a path is a directory.
 *
 * @param path - Path to check
 * @returns true if directory, false otherwise
 */
async function isDirectory(path: string): Promise<boolean> {
  try {
    const stat = await fs.stat(path)
    return stat.isDirectory()
  } catch {
    return false
  }
}

/**
 * Recursively copy a directory.
 *
 * @param src - Source directory
 * @param dest - Destination directory
 */
async function copyDir(src: string, dest: string): Promise<void> {
  await ensureDir(dest)
  const entries = await fs.readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath)
    } else {
      await fs.copyFile(srcPath, destPath)
    }
  }
}

/**
 * Copy a file or directory to a destination.
 *
 * @param src - Source path (file or directory)
 * @param dest - Destination path
 */
async function copyPath(src: string, dest: string): Promise<void> {
  if (await isDirectory(src)) {
    await copyDir(src, dest)
  } else {
    // Ensure parent directory exists
    await ensureDir(dirname(dest))
    await fs.copyFile(src, dest)
  }
}

// ========================
// Main Backup Functions
// ========================

/**
 * Copy files to a backup directory before deletion.
 *
 * Creates a timestamped subdirectory within backupDir to store the backups.
 * Preserves directory structure relative to structureRoot if specified.
 *
 * @param paths - Array of file/directory paths to backup
 * @param options - Backup options
 * @returns BackupResult with details of the operation
 *
 * @example
 * ```ts
 * // Simple backup
 * const result = await copyToBackupDir(
 *   ["/path/to/project.json", "/path/to/session/data"],
 *   { backupDir: "/backups" }
 * )
 * // Files are copied to /backups/2024-01-15_12-30-45/...
 *
 * // Preserve structure
 * const result = await copyToBackupDir(
 *   ["/data/storage/project/abc.json"],
 *   {
 *     backupDir: "/backups",
 *     preserveStructure: true,
 *     structureRoot: "/data"
 *   }
 * )
 * // File is copied to /backups/2024-01-15_12-30-45/storage/project/abc.json
 * ```
 */
export async function copyToBackupDir(
  paths: string[],
  options: BackupOptions
): Promise<BackupResult> {
  const { backupDir, prefix, preserveStructure, structureRoot } = options

  // Validate backup directory
  const resolvedBackupDir = resolve(backupDir)

  // Create timestamped subdirectory
  const timestamp = generateBackupTimestamp()
  const backupSubdir = prefix
    ? `${prefix}_${timestamp}`
    : timestamp
  const targetBackupDir = join(resolvedBackupDir, backupSubdir)

  const result: BackupResult = {
    sources: [],
    destinations: [],
    backupDir: targetBackupDir,
    failed: [],
  }

  // If no paths, return early
  if (paths.length === 0) {
    return result
  }

  // Ensure backup directory exists
  try {
    await ensureDir(targetBackupDir)
  } catch (error) {
    throw new FileOperationError(
      `Failed to create backup directory: ${targetBackupDir}`,
      "backup"
    )
  }

  // Copy each path
  for (const srcPath of paths) {
    const resolvedSrc = resolve(srcPath)

    // Check if source exists
    if (!(await pathExists(resolvedSrc))) {
      result.failed.push({
        path: resolvedSrc,
        error: "Source path does not exist",
      })
      continue
    }

    // Determine destination path
    let destPath: string
    if (preserveStructure && structureRoot) {
      // Preserve directory structure relative to root
      const relativePath = relative(resolve(structureRoot), resolvedSrc)
      if (relativePath.startsWith("..")) {
        // Path is outside structureRoot, use basename
        destPath = join(targetBackupDir, basename(resolvedSrc))
      } else {
        destPath = join(targetBackupDir, relativePath)
      }
    } else {
      // Just use the basename
      destPath = join(targetBackupDir, basename(resolvedSrc))
    }

    // Copy the file/directory
    try {
      await copyPath(resolvedSrc, destPath)
      result.sources.push(resolvedSrc)
      result.destinations.push(destPath)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      result.failed.push({
        path: resolvedSrc,
        error: errorMessage,
      })
    }
  }

  return result
}

/**
 * Get the paths that would be backed up (for dry-run display).
 *
 * @param paths - Source paths to backup
 * @param options - Backup options
 * @returns Object with source and computed destination paths
 */
export function previewBackupPaths(
  paths: string[],
  options: BackupOptions
): { sources: string[]; destinations: string[]; backupDir: string } {
  const { backupDir, prefix, preserveStructure, structureRoot } = options

  const resolvedBackupDir = resolve(backupDir)
  const timestamp = generateBackupTimestamp()
  const backupSubdir = prefix ? `${prefix}_${timestamp}` : timestamp
  const targetBackupDir = join(resolvedBackupDir, backupSubdir)

  const sources: string[] = []
  const destinations: string[] = []

  for (const srcPath of paths) {
    const resolvedSrc = resolve(srcPath)
    sources.push(resolvedSrc)

    let destPath: string
    if (preserveStructure && structureRoot) {
      const relativePath = relative(resolve(structureRoot), resolvedSrc)
      if (relativePath.startsWith("..")) {
        destPath = join(targetBackupDir, basename(resolvedSrc))
      } else {
        destPath = join(targetBackupDir, relativePath)
      }
    } else {
      destPath = join(targetBackupDir, basename(resolvedSrc))
    }
    destinations.push(destPath)
  }

  return { sources, destinations, backupDir: targetBackupDir }
}

/**
 * Format backup result for display.
 *
 * @param result - Backup result to format
 * @returns Human-readable summary string
 */
export function formatBackupResult(result: BackupResult): string {
  const lines: string[] = []

  if (result.sources.length > 0) {
    lines.push(`Backed up ${result.sources.length} item(s) to: ${result.backupDir}`)
  }

  if (result.failed.length > 0) {
    lines.push(`Failed to backup ${result.failed.length} item(s):`)
    for (const { path, error } of result.failed) {
      lines.push(`  ${path}: ${error}`)
    }
  }

  return lines.join("\n")
}
