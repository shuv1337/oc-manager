/**
 * Tests for table output formatter.
 */

import { describe, expect, it } from "bun:test"
import {
  truncate,
  pad,
  formatCell,
  formatRow,
  formatHeader,
  formatHeaderUnderline,
  formatTable,
  formatDateForTable,
  formatProjectState,
  formatProjectsTable,
  projectListColumns,
  type ColumnDefinition,
  type Alignment,
} from "../../../src/cli/formatters/table"
import type { ProjectRecord } from "../../../src/lib/opencode-data"

// ========================
// Helper Test Data
// ========================

interface TestRecord {
  id: number
  name: string
  status: string
}

const testColumns: ColumnDefinition<TestRecord>[] = [
  { header: "ID", width: 4, align: "right", accessor: (r) => r.id },
  { header: "Name", width: 10, align: "left", accessor: (r) => r.name },
  { header: "Status", width: 8, align: "center", accessor: (r) => r.status },
]

const testData: TestRecord[] = [
  { id: 1, name: "Alpha", status: "active" },
  { id: 2, name: "Beta", status: "pending" },
  { id: 123, name: "LongNameThatExceedsWidth", status: "done" },
]

// ========================
// truncate tests
// ========================

describe("truncate", () => {
  it("should return text unchanged if within width", () => {
    expect(truncate("hello", 10)).toBe("hello")
  })

  it("should return text unchanged if exactly at width", () => {
    expect(truncate("hello", 5)).toBe("hello")
  })

  it("should truncate and add suffix if text exceeds width", () => {
    expect(truncate("hello world", 8)).toBe("hello w…")
  })

  it("should use custom suffix", () => {
    expect(truncate("hello world", 8, "...")).toBe("hello...")
  })

  it("should handle width smaller than suffix", () => {
    expect(truncate("hello", 2, "...")).toBe("..")
  })

  it("should handle empty string", () => {
    expect(truncate("", 5)).toBe("")
  })
})

// ========================
// pad tests
// ========================

describe("pad", () => {
  it("should pad left-aligned text", () => {
    expect(pad("hi", 5, "left")).toBe("hi   ")
  })

  it("should pad right-aligned text", () => {
    expect(pad("hi", 5, "right")).toBe("   hi")
  })

  it("should pad center-aligned text", () => {
    expect(pad("hi", 6, "center")).toBe("  hi  ")
  })

  it("should handle odd padding for center alignment", () => {
    expect(pad("hi", 5, "center")).toBe(" hi  ")
  })

  it("should return text unchanged if at or over width", () => {
    expect(pad("hello", 5, "left")).toBe("hello")
    expect(pad("hello", 3, "left")).toBe("hello")
  })

  it("should default to left alignment", () => {
    expect(pad("hi", 5)).toBe("hi   ")
  })
})

// ========================
// formatCell tests
// ========================

describe("formatCell", () => {
  it("should format string value", () => {
    expect(formatCell("test", 6, "left")).toBe("test  ")
  })

  it("should format number value", () => {
    expect(formatCell(42, 5, "right")).toBe("   42")
  })

  it("should format null as empty string", () => {
    expect(formatCell(null, 5, "left")).toBe("     ")
  })

  it("should format undefined as empty string", () => {
    expect(formatCell(undefined, 5, "left")).toBe("     ")
  })

  it("should truncate and pad", () => {
    expect(formatCell("hello world", 8, "left")).toBe("hello w…")
  })
})

// ========================
// formatRow tests
// ========================

describe("formatRow", () => {
  it("should format a row with multiple columns", () => {
    const row: TestRecord = { id: 1, name: "Test", status: "ok" }
    const result = formatRow(row, testColumns)
    // ID (4, right) + sep (2) + Name (10, left) + sep (2) + Status (8, center="   ok   ")
    expect(result).toBe("   1  Test           ok   ")
  })

  it("should use custom separator", () => {
    const row: TestRecord = { id: 1, name: "Test", status: "ok" }
    const result = formatRow(row, testColumns, { separator: " | " })
    expect(result).toBe("   1 | Test       |    ok   ")
  })

  it("should truncate long values", () => {
    const row: TestRecord = { id: 999, name: "VeryLongName", status: "active" }
    const result = formatRow(row, testColumns)
    // Name should be truncated to 10 chars with "…"
    expect(result).toBe(" 999  VeryLongN…   active ")
  })
})

// ========================
// formatHeader tests
// ========================

describe("formatHeader", () => {
  it("should format header row", () => {
    const result = formatHeader(testColumns)
    // ID (4, right) + sep (2) + Name (10, left) + sep (2) + Status (8, center=" Status ")
    expect(result).toBe("  ID  Name         Status ")
  })

  it("should use custom separator", () => {
    const result = formatHeader(testColumns, { separator: " | " })
    expect(result).toBe("  ID | Name       |  Status ")
  })
})

// ========================
// formatHeaderUnderline tests
// ========================

describe("formatHeaderUnderline", () => {
  it("should create underline matching column widths", () => {
    const result = formatHeaderUnderline(testColumns)
    expect(result).toBe("----  ----------  --------")
  })

  it("should use custom underline character", () => {
    const result = formatHeaderUnderline(testColumns, { headerUnderline: "=" })
    expect(result).toBe("====  ==========  ========")
  })
})

// ========================
// formatTable tests
// ========================

describe("formatTable", () => {
  it("should format complete table with headers", () => {
    const result = formatTable(testData.slice(0, 2), testColumns)
    const lines = result.split("\n")
    expect(lines.length).toBe(4) // header + underline + 2 data rows
    expect(lines[0]).toBe("  ID  Name         Status ")
    expect(lines[1]).toBe("----  ----------  --------")
    expect(lines[2]).toBe("   1  Alpha        active ")
    expect(lines[3]).toBe("   2  Beta        pending ")
  })

  it("should format table without headers", () => {
    const result = formatTable(testData.slice(0, 1), testColumns, { showHeaders: false })
    const lines = result.split("\n")
    expect(lines.length).toBe(1)
    expect(lines[0]).toBe("   1  Alpha        active ")
  })

  it("should format table without underline", () => {
    const result = formatTable(testData.slice(0, 1), testColumns, { showUnderline: false })
    const lines = result.split("\n")
    expect(lines.length).toBe(2) // header + 1 data row
    expect(lines[0]).toBe("  ID  Name         Status ")
    expect(lines[1]).toBe("   1  Alpha        active ")
  })

  it("should format empty table", () => {
    const result = formatTable([], testColumns)
    const lines = result.split("\n")
    expect(lines.length).toBe(2) // header + underline only
  })
})

// ========================
// formatDateForTable tests
// ========================

describe("formatDateForTable", () => {
  it("should format date as YYYY-MM-DD HH:MM", () => {
    const date = new Date("2024-01-15T10:30:45.000Z")
    expect(formatDateForTable(date)).toBe("2024-01-15 10:30")
  })

  it("should return dash for null", () => {
    expect(formatDateForTable(null)).toBe("-")
  })

  it("should return dash for undefined", () => {
    expect(formatDateForTable(undefined)).toBe("-")
  })
})

// ========================
// formatProjectState tests
// ========================

describe("formatProjectState", () => {
  it("should format present state with checkmark", () => {
    expect(formatProjectState("present")).toBe("✓")
  })

  it("should format missing state with X", () => {
    expect(formatProjectState("missing")).toBe("✗")
  })

  it("should format unknown state with question mark", () => {
    expect(formatProjectState("unknown")).toBe("?")
  })
})

// ========================
// projectListColumns tests
// ========================

describe("projectListColumns", () => {
  const mockProject: ProjectRecord = {
    index: 1,
    bucket: "project",
    filePath: "/path/to/project.json",
    projectId: "proj-abc123",
    worktree: "/home/user/projects/my-project",
    vcs: "git",
    createdAt: new Date("2024-01-15T10:30:00.000Z"),
    state: "present",
  }

  it("should have correct column count", () => {
    expect(projectListColumns.length).toBe(5)
  })

  it("should have index column", () => {
    const col = projectListColumns.find((c) => c.header === "#")
    expect(col).toBeDefined()
    expect(col!.accessor(mockProject)).toBe(1)
    expect(col!.align).toBe("right")
  })

  it("should have state column with formatter", () => {
    const col = projectListColumns.find((c) => c.header === "State")
    expect(col).toBeDefined()
    expect(col!.format).toBeDefined()
    const state = col!.accessor(mockProject)
    expect(col!.format!(state)).toBe("✓")
  })

  it("should have path column", () => {
    const col = projectListColumns.find((c) => c.header === "Path")
    expect(col).toBeDefined()
    expect(col!.accessor(mockProject)).toBe("/home/user/projects/my-project")
  })

  it("should have projectId column", () => {
    const col = projectListColumns.find((c) => c.header === "Project ID")
    expect(col).toBeDefined()
    expect(col!.accessor(mockProject)).toBe("proj-abc123")
  })

  it("should have created column with date formatter", () => {
    const col = projectListColumns.find((c) => c.header === "Created")
    expect(col).toBeDefined()
    expect(col!.format).toBeDefined()
    const date = col!.accessor(mockProject)
    expect(col!.format!(date)).toBe("2024-01-15 10:30")
  })
})

// ========================
// formatProjectsTable tests
// ========================

describe("formatProjectsTable", () => {
  const mockProjects: ProjectRecord[] = [
    {
      index: 1,
      bucket: "project",
      filePath: "/path/to/project1.json",
      projectId: "proj-abc123",
      worktree: "/home/user/projects/my-project",
      vcs: "git",
      createdAt: new Date("2024-01-15T10:30:00.000Z"),
      state: "present",
    },
    {
      index: 2,
      bucket: "project",
      filePath: "/path/to/project2.json",
      projectId: "proj-def456",
      worktree: "/home/user/work/another-project",
      vcs: null,
      createdAt: null,
      state: "missing",
    },
  ]

  it("should format projects table with headers", () => {
    const result = formatProjectsTable(mockProjects)
    const lines = result.split("\n")
    expect(lines.length).toBe(4) // header + underline + 2 rows
    expect(lines[0]).toContain("#")
    expect(lines[0]).toContain("State")
    expect(lines[0]).toContain("Path")
  })

  it("should format projects with correct state symbols", () => {
    const result = formatProjectsTable(mockProjects)
    expect(result).toContain("✓") // present
    expect(result).toContain("✗") // missing
  })

  it("should use compact columns when specified", () => {
    const result = formatProjectsTable(mockProjects, { compact: true })
    const lines = result.split("\n")
    // Compact header should be shorter (no "Created" column)
    expect(lines[0]).not.toContain("Created")
  })

  it("should format empty projects list", () => {
    const result = formatProjectsTable([])
    const lines = result.split("\n")
    expect(lines.length).toBe(2) // header + underline only
  })
})
