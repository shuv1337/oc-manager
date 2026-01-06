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
  projectListColumns,
  projectListColumnsCompact,
  formatProjectsTable,
  sessionListColumns,
  sessionListColumnsCompact,
  formatSessionsTable,
  formatChatRole,
  formatTokenCount,
  chatListColumns,
  chatListColumnsCompact,
  formatChatTable,
  tokenBreakdownToRows,
  formatPercentage,
  formatLargeNumber,
  tokenBreakdownColumns,
  formatTokenBreakdownTable,
  formatTokenSummary,
  formatAggregateTokenSummary,
  type ColumnDefinition,
  type TokenBreakdownRow,
} from "../../../src/cli/formatters/table"
import type { AggregateTokenSummary, ChatMessage, ProjectRecord, SessionRecord, TokenBreakdown, TokenSummary } from "../../../src/lib/opencode-data"

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

// ========================
// sessionListColumns tests
// ========================

describe("sessionListColumns", () => {
  const mockSession: SessionRecord = {
    index: 1,
    filePath: "/path/to/session.json",
    sessionId: "sess-abc123",
    projectId: "proj-xyz789",
    directory: "/home/user/projects/my-project",
    title: "Implement feature X",
    version: "1.0.0",
    createdAt: new Date("2024-01-15T10:30:00.000Z"),
    updatedAt: new Date("2024-01-16T14:45:00.000Z"),
  }

  it("should have correct column count", () => {
    expect(sessionListColumns.length).toBe(6)
  })

  it("should have index column", () => {
    const col = sessionListColumns.find((c) => c.header === "#")
    expect(col).toBeDefined()
    expect(col!.accessor(mockSession)).toBe(1)
    expect(col!.align).toBe("right")
  })

  it("should have title column", () => {
    const col = sessionListColumns.find((c) => c.header === "Title")
    expect(col).toBeDefined()
    expect(col!.accessor(mockSession)).toBe("Implement feature X")
    expect(col!.width).toBe(40)
  })

  it("should have sessionId column", () => {
    const col = sessionListColumns.find((c) => c.header === "Session ID")
    expect(col).toBeDefined()
    expect(col!.accessor(mockSession)).toBe("sess-abc123")
  })

  it("should have projectId column", () => {
    const col = sessionListColumns.find((c) => c.header === "Project ID")
    expect(col).toBeDefined()
    expect(col!.accessor(mockSession)).toBe("proj-xyz789")
  })

  it("should have updated column with date formatter", () => {
    const col = sessionListColumns.find((c) => c.header === "Updated")
    expect(col).toBeDefined()
    expect(col!.format).toBeDefined()
    const date = col!.accessor(mockSession)
    expect(col!.format!(date)).toBe("2024-01-16 14:45")
  })

  it("should have created column with date formatter", () => {
    const col = sessionListColumns.find((c) => c.header === "Created")
    expect(col).toBeDefined()
    expect(col!.format).toBeDefined()
    const date = col!.accessor(mockSession)
    expect(col!.format!(date)).toBe("2024-01-15 10:30")
  })
})

// ========================
// sessionListColumnsCompact tests
// ========================

describe("sessionListColumnsCompact", () => {
  const mockSession: SessionRecord = {
    index: 2,
    filePath: "/path/to/session.json",
    sessionId: "sess-def456",
    projectId: "proj-abc123",
    directory: "/home/user/work/another-project",
    title: "Fix bug in authentication",
    version: "1.0.0",
    createdAt: new Date("2024-01-10T08:00:00.000Z"),
    updatedAt: new Date("2024-01-12T16:30:00.000Z"),
  }

  it("should have fewer columns than full version", () => {
    expect(sessionListColumnsCompact.length).toBeLessThan(sessionListColumns.length)
    expect(sessionListColumnsCompact.length).toBe(4)
  })

  it("should not have projectId column", () => {
    const col = sessionListColumnsCompact.find((c) => c.header === "Project ID")
    expect(col).toBeUndefined()
  })

  it("should not have created column", () => {
    const col = sessionListColumnsCompact.find((c) => c.header === "Created")
    expect(col).toBeUndefined()
  })

  it("should have narrower title column", () => {
    const col = sessionListColumnsCompact.find((c) => c.header === "Title")
    expect(col).toBeDefined()
    expect(col!.width).toBe(30)
  })

  it("should have narrower sessionId column", () => {
    const col = sessionListColumnsCompact.find((c) => c.header === "Session ID")
    expect(col).toBeDefined()
    expect(col!.width).toBe(20)
  })
})

// ========================
// formatSessionsTable tests
// ========================

describe("formatSessionsTable", () => {
  const mockSessions: SessionRecord[] = [
    {
      index: 1,
      filePath: "/path/to/session1.json",
      sessionId: "sess-abc123",
      projectId: "proj-xyz789",
      directory: "/home/user/projects/my-project",
      title: "Implement feature X",
      version: "1.0.0",
      createdAt: new Date("2024-01-15T10:30:00.000Z"),
      updatedAt: new Date("2024-01-16T14:45:00.000Z"),
    },
    {
      index: 2,
      filePath: "/path/to/session2.json",
      sessionId: "sess-def456",
      projectId: "proj-abc123",
      directory: "/home/user/work/another-project",
      title: "Fix critical bug in authentication module",
      version: "1.0.0",
      createdAt: new Date("2024-01-10T08:00:00.000Z"),
      updatedAt: null,
    },
  ]

  it("should format sessions table with headers", () => {
    const result = formatSessionsTable(mockSessions)
    const lines = result.split("\n")
    expect(lines.length).toBe(4) // header + underline + 2 rows
    expect(lines[0]).toContain("#")
    expect(lines[0]).toContain("Title")
    expect(lines[0]).toContain("Session ID")
    expect(lines[0]).toContain("Project ID")
    expect(lines[0]).toContain("Updated")
    expect(lines[0]).toContain("Created")
  })

  it("should truncate long titles", () => {
    const result = formatSessionsTable(mockSessions)
    // Second session has a long title that should be truncated (40 char column width)
    // "Fix critical bug in authentication module" is 41 chars, gets truncated
    expect(result).toContain("Fix critical bug in authentication modu…")
  })

  it("should format null dates as dash", () => {
    const result = formatSessionsTable(mockSessions)
    // Second session has null updatedAt
    expect(result).toContain("-")
  })

  it("should use compact columns when specified", () => {
    const result = formatSessionsTable(mockSessions, { compact: true })
    const lines = result.split("\n")
    // Compact header should not have "Project ID" or "Created" columns
    expect(lines[0]).not.toContain("Project ID")
    expect(lines[0]).not.toContain("Created")
    expect(lines[0]).toContain("Title")
    expect(lines[0]).toContain("Session ID")
    expect(lines[0]).toContain("Updated")
  })

  it("should format empty sessions list", () => {
    const result = formatSessionsTable([])
    const lines = result.split("\n")
    expect(lines.length).toBe(2) // header + underline only
  })

  it("should handle custom separator", () => {
    const result = formatSessionsTable(mockSessions, { separator: " | " })
    expect(result).toContain(" | ")
  })
})

// ========================
// formatChatRole tests
// ========================

describe("formatChatRole", () => {
  it("should format user role as U", () => {
    expect(formatChatRole("user")).toBe("U")
  })

  it("should format assistant role as A", () => {
    expect(formatChatRole("assistant")).toBe("A")
  })

  it("should format unknown role as ?", () => {
    expect(formatChatRole("unknown")).toBe("?")
  })
})

// ========================
// formatTokenCount tests
// ========================

describe("formatTokenCount", () => {
  it("should format null as dash", () => {
    expect(formatTokenCount(null)).toBe("-")
  })

  it("should format undefined as dash", () => {
    expect(formatTokenCount(undefined)).toBe("-")
  })

  it("should format zero as dash", () => {
    expect(formatTokenCount(0)).toBe("-")
  })

  it("should format small numbers as-is", () => {
    expect(formatTokenCount(123)).toBe("123")
    expect(formatTokenCount(999)).toBe("999")
  })

  it("should format thousands with K suffix", () => {
    expect(formatTokenCount(1000)).toBe("1.0K")
    expect(formatTokenCount(1500)).toBe("1.5K")
    expect(formatTokenCount(12345)).toBe("12.3K")
  })
})

// ========================
// chatListColumns tests
// ========================

describe("chatListColumns", () => {
  const mockMessage: ChatMessage & { index: number } = {
    index: 1,
    sessionId: "sess-abc123",
    messageId: "msg-xyz789",
    role: "assistant",
    createdAt: new Date("2024-01-15T10:30:00.000Z"),
    parentId: "msg-parent",
    tokens: {
      input: 1000,
      output: 500,
      reasoning: 200,
      cacheRead: 100,
      cacheWrite: 50,
      total: 1850,
    },
    parts: null,
    previewText: "Here is the implementation...",
    totalChars: null,
  }

  it("should have correct column count", () => {
    expect(chatListColumns.length).toBe(6)
  })

  it("should have index column", () => {
    const col = chatListColumns.find((c) => c.header === "#")
    expect(col).toBeDefined()
    expect(col!.accessor(mockMessage)).toBe(1)
    expect(col!.align).toBe("right")
  })

  it("should have role column with formatter", () => {
    const col = chatListColumns.find((c) => c.header === "Role")
    expect(col).toBeDefined()
    expect(col!.format).toBeDefined()
    const role = col!.accessor(mockMessage)
    expect(col!.format!(role)).toBe("A")
  })

  it("should have messageId column", () => {
    const col = chatListColumns.find((c) => c.header === "Message ID")
    expect(col).toBeDefined()
    expect(col!.accessor(mockMessage)).toBe("msg-xyz789")
  })

  it("should have preview column", () => {
    const col = chatListColumns.find((c) => c.header === "Preview")
    expect(col).toBeDefined()
    expect(col!.accessor(mockMessage)).toBe("Here is the implementation...")
    expect(col!.width).toBe(40)
  })

  it("should have tokens column with formatter", () => {
    const col = chatListColumns.find((c) => c.header === "Tokens")
    expect(col).toBeDefined()
    expect(col!.format).toBeDefined()
    expect(col!.align).toBe("right")
    const tokens = col!.accessor(mockMessage)
    expect(col!.format!(tokens)).toBe("1.9K")
  })

  it("should have created column with date formatter", () => {
    const col = chatListColumns.find((c) => c.header === "Created")
    expect(col).toBeDefined()
    expect(col!.format).toBeDefined()
    const date = col!.accessor(mockMessage)
    expect(col!.format!(date)).toBe("2024-01-15 10:30")
  })

  it("should handle user messages without tokens", () => {
    const userMessage: ChatMessage & { index: number } = {
      ...mockMessage,
      index: 2,
      role: "user",
      tokens: undefined,
    }
    const roleCol = chatListColumns.find((c) => c.header === "Role")
    const tokensCol = chatListColumns.find((c) => c.header === "Tokens")
    expect(roleCol!.format!(roleCol!.accessor(userMessage))).toBe("U")
    expect(tokensCol!.format!(tokensCol!.accessor(userMessage))).toBe("-")
  })
})

// ========================
// chatListColumnsCompact tests
// ========================

describe("chatListColumnsCompact", () => {
  const mockMessage: ChatMessage & { index: number } = {
    index: 3,
    sessionId: "sess-abc123",
    messageId: "msg-def456",
    role: "user",
    createdAt: new Date("2024-01-15T09:00:00.000Z"),
    tokens: undefined,
    parts: null,
    previewText: "Can you help me with this code?",
    totalChars: null,
  }

  it("should have fewer columns than full version", () => {
    expect(chatListColumnsCompact.length).toBeLessThan(chatListColumns.length)
    expect(chatListColumnsCompact.length).toBe(4)
  })

  it("should not have messageId column", () => {
    const col = chatListColumnsCompact.find((c) => c.header === "Message ID")
    expect(col).toBeUndefined()
  })

  it("should not have created column", () => {
    const col = chatListColumnsCompact.find((c) => c.header === "Created")
    expect(col).toBeUndefined()
  })

  it("should have narrower role column (R)", () => {
    const col = chatListColumnsCompact.find((c) => c.header === "R")
    expect(col).toBeDefined()
    expect(col!.width).toBe(1)
  })

  it("should have wider preview column", () => {
    const col = chatListColumnsCompact.find((c) => c.header === "Preview")
    expect(col).toBeDefined()
    expect(col!.width).toBe(50)
  })
})

// ========================
// formatChatTable tests
// ========================

describe("formatChatTable", () => {
  const mockMessages: (ChatMessage & { index: number })[] = [
    {
      index: 1,
      sessionId: "sess-abc123",
      messageId: "msg-001",
      role: "user",
      createdAt: new Date("2024-01-15T10:00:00.000Z"),
      tokens: undefined,
      parts: null,
      previewText: "How do I implement a REST API?",
      totalChars: null,
    },
    {
      index: 2,
      sessionId: "sess-abc123",
      messageId: "msg-002",
      role: "assistant",
      createdAt: new Date("2024-01-15T10:01:00.000Z"),
      tokens: {
        input: 500,
        output: 1200,
        reasoning: 300,
        cacheRead: 0,
        cacheWrite: 0,
        total: 2000,
      },
      parts: null,
      previewText: "I can help you implement a REST API. Here are the steps...",
      totalChars: null,
    },
  ]

  it("should format chat table with headers", () => {
    const result = formatChatTable(mockMessages)
    const lines = result.split("\n")
    expect(lines.length).toBe(4) // header + underline + 2 rows
    expect(lines[0]).toContain("#")
    expect(lines[0]).toContain("Role")
    expect(lines[0]).toContain("Message ID")
    expect(lines[0]).toContain("Preview")
    expect(lines[0]).toContain("Tokens")
    expect(lines[0]).toContain("Created")
  })

  it("should format roles correctly", () => {
    const result = formatChatTable(mockMessages)
    expect(result).toContain(" U ") // user role
    expect(result).toContain(" A ") // assistant role
  })

  it("should format tokens correctly", () => {
    const result = formatChatTable(mockMessages)
    expect(result).toContain("2.0K") // assistant tokens
    expect(result).toContain("-") // user has no tokens
  })

  it("should truncate long previews", () => {
    const result = formatChatTable(mockMessages)
    // Second message has a long preview that should be truncated (40 char column width)
    // "I can help you implement a REST API. Here are the steps..." is 58 chars
    expect(result).toContain("I can help you implement a REST API. He…")
  })

  it("should use compact columns when specified", () => {
    const result = formatChatTable(mockMessages, { compact: true })
    const lines = result.split("\n")
    // Compact header should not have "Message ID" or "Created" columns
    expect(lines[0]).not.toContain("Message ID")
    expect(lines[0]).not.toContain("Created")
    expect(lines[0]).toContain("Preview")
    expect(lines[0]).toContain("Tokens")
  })

  it("should format empty chat list", () => {
    const result = formatChatTable([])
    const lines = result.split("\n")
    expect(lines.length).toBe(2) // header + underline only
  })

  it("should handle custom separator", () => {
    const result = formatChatTable(mockMessages, { separator: " | " })
    expect(result).toContain(" | ")
  })
})

// ========================
// tokenBreakdownToRows tests
// ========================

describe("tokenBreakdownToRows", () => {
  const mockBreakdown: TokenBreakdown = {
    input: 1000,
    output: 500,
    reasoning: 200,
    cacheRead: 100,
    cacheWrite: 50,
    total: 1850,
  }

  it("should create correct number of rows", () => {
    const rows = tokenBreakdownToRows(mockBreakdown)
    expect(rows.length).toBe(6)
  })

  it("should have correct categories", () => {
    const rows = tokenBreakdownToRows(mockBreakdown)
    expect(rows[0].category).toBe("Input")
    expect(rows[1].category).toBe("Output")
    expect(rows[2].category).toBe("Reasoning")
    expect(rows[3].category).toBe("Cache Read")
    expect(rows[4].category).toBe("Cache Write")
    expect(rows[5].category).toBe("Total")
  })

  it("should have correct counts", () => {
    const rows = tokenBreakdownToRows(mockBreakdown)
    expect(rows[0].count).toBe(1000)
    expect(rows[1].count).toBe(500)
    expect(rows[5].count).toBe(1850)
  })

  it("should calculate percentages correctly", () => {
    const rows = tokenBreakdownToRows(mockBreakdown)
    // Input: 1000/1850 = ~54.05%
    expect(rows[0].percentage).toBeCloseTo(54.05, 1)
    // Output: 500/1850 = ~27.03%
    expect(rows[1].percentage).toBeCloseTo(27.03, 1)
    // Total should be 100%
    expect(rows[5].percentage).toBe(100)
  })

  it("should handle zero total without division by zero", () => {
    const zeroBreakdown: TokenBreakdown = {
      input: 0,
      output: 0,
      reasoning: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0,
    }
    const rows = tokenBreakdownToRows(zeroBreakdown)
    // Should not throw and all percentages should be 0
    expect(rows[0].percentage).toBe(0)
    expect(rows[5].percentage).toBe(100) // Total row always shows 100%
  })
})

// ========================
// formatPercentage tests
// ========================

describe("formatPercentage", () => {
  it("should format zero as dash", () => {
    expect(formatPercentage(0)).toBe("-")
  })

  it("should format 100 as 100%", () => {
    expect(formatPercentage(100)).toBe("100%")
  })

  it("should format decimals with one decimal place", () => {
    expect(formatPercentage(54.054)).toBe("54.1%")
    expect(formatPercentage(27.027)).toBe("27.0%")
    expect(formatPercentage(0.5)).toBe("0.5%")
  })
})

// ========================
// formatLargeNumber tests
// ========================

describe("formatLargeNumber", () => {
  it("should format zero as 0", () => {
    expect(formatLargeNumber(0)).toBe("0")
  })

  it("should format small numbers without suffix", () => {
    expect(formatLargeNumber(1)).toBe("1")
    expect(formatLargeNumber(999)).toBe("999")
  })

  it("should format thousands with K suffix", () => {
    expect(formatLargeNumber(1000)).toBe("1.0K")
    expect(formatLargeNumber(1500)).toBe("1.5K")
    expect(formatLargeNumber(12345)).toBe("12.3K")
    expect(formatLargeNumber(999999)).toBe("1000.0K")
  })

  it("should format millions with M suffix", () => {
    expect(formatLargeNumber(1000000)).toBe("1.00M")
    expect(formatLargeNumber(1500000)).toBe("1.50M")
    expect(formatLargeNumber(12345678)).toBe("12.35M")
  })
})

// ========================
// tokenBreakdownColumns tests
// ========================

describe("tokenBreakdownColumns", () => {
  const mockRow: TokenBreakdownRow = {
    category: "Input",
    count: 12345,
    percentage: 54.05,
  }

  it("should have correct column count", () => {
    expect(tokenBreakdownColumns.length).toBe(3)
  })

  it("should have category column", () => {
    const col = tokenBreakdownColumns.find((c) => c.header === "Category")
    expect(col).toBeDefined()
    expect(col!.accessor(mockRow)).toBe("Input")
    expect(col!.align).toBe("left")
  })

  it("should have tokens column with formatter", () => {
    const col = tokenBreakdownColumns.find((c) => c.header === "Tokens")
    expect(col).toBeDefined()
    expect(col!.format).toBeDefined()
    const val = col!.accessor(mockRow)
    expect(col!.format!(val)).toBe("12.3K")
    expect(col!.align).toBe("right")
  })

  it("should have percentage column with formatter", () => {
    const col = tokenBreakdownColumns.find((c) => c.header === "%")
    expect(col).toBeDefined()
    expect(col!.format).toBeDefined()
    const val = col!.accessor(mockRow)
    expect(col!.format!(val)).toBe("54.0%")
    expect(col!.align).toBe("right")
  })
})

// ========================
// formatTokenBreakdownTable tests
// ========================

describe("formatTokenBreakdownTable", () => {
  const mockBreakdown: TokenBreakdown = {
    input: 10000,
    output: 5000,
    reasoning: 2000,
    cacheRead: 1000,
    cacheWrite: 500,
    total: 18500,
  }

  it("should format breakdown as table with headers", () => {
    const result = formatTokenBreakdownTable(mockBreakdown)
    const lines = result.split("\n")
    expect(lines.length).toBe(8) // header + underline + 6 rows
    expect(lines[0]).toContain("Category")
    expect(lines[0]).toContain("Tokens")
    expect(lines[0]).toContain("%")
  })

  it("should include all categories", () => {
    const result = formatTokenBreakdownTable(mockBreakdown)
    expect(result).toContain("Input")
    expect(result).toContain("Output")
    expect(result).toContain("Reasoning")
    expect(result).toContain("Cache Read")
    expect(result).toContain("Cache Write")
    expect(result).toContain("Total")
  })

  it("should format token counts with K suffix", () => {
    const result = formatTokenBreakdownTable(mockBreakdown)
    expect(result).toContain("10.0K") // input
    expect(result).toContain("5.0K") // output
    expect(result).toContain("18.5K") // total
  })

  it("should include percentages", () => {
    const result = formatTokenBreakdownTable(mockBreakdown)
    expect(result).toContain("%")
    expect(result).toContain("100%") // total row
  })
})

// ========================
// formatTokenSummary tests
// ========================

describe("formatTokenSummary", () => {
  it("should format known summary as table", () => {
    const summary: TokenSummary = {
      kind: "known",
      tokens: {
        input: 1000,
        output: 500,
        reasoning: 200,
        cacheRead: 100,
        cacheWrite: 50,
        total: 1850,
      },
    }
    const result = formatTokenSummary(summary)
    expect(result).toContain("Category")
    expect(result).toContain("Input")
    expect(result).toContain("Total")
  })

  it("should format unknown summary with missing reason", () => {
    const summary: TokenSummary = { kind: "unknown", reason: "missing" }
    const result = formatTokenSummary(summary)
    expect(result).toBe("[Token data unavailable]")
  })

  it("should format unknown summary with parse_error reason", () => {
    const summary: TokenSummary = { kind: "unknown", reason: "parse_error" }
    const result = formatTokenSummary(summary)
    expect(result).toBe("[Token data parse error]")
  })

  it("should format unknown summary with no_messages reason", () => {
    const summary: TokenSummary = { kind: "unknown", reason: "no_messages" }
    const result = formatTokenSummary(summary)
    expect(result).toBe("[No messages found]")
  })
})

// ========================
// formatAggregateTokenSummary tests
// ========================

describe("formatAggregateTokenSummary", () => {
  const mockAggregate: AggregateTokenSummary = {
    total: {
      kind: "known",
      tokens: {
        input: 50000,
        output: 25000,
        reasoning: 10000,
        cacheRead: 5000,
        cacheWrite: 2500,
        total: 92500,
      },
    },
    knownOnly: {
      input: 50000,
      output: 25000,
      reasoning: 10000,
      cacheRead: 5000,
      cacheWrite: 2500,
      total: 92500,
    },
    unknownSessions: 3,
  }

  it("should include label and header", () => {
    const result = formatAggregateTokenSummary(mockAggregate)
    expect(result).toContain("Token Summary")
    expect(result).toContain("=============")
  })

  it("should include custom label when provided", () => {
    const result = formatAggregateTokenSummary(mockAggregate, { label: "Project Tokens" })
    expect(result).toContain("Project Tokens")
    expect(result).toContain("==============")
  })

  it("should include breakdown table", () => {
    const result = formatAggregateTokenSummary(mockAggregate)
    expect(result).toContain("Category")
    expect(result).toContain("Tokens")
    expect(result).toContain("Input")
    expect(result).toContain("Total")
  })

  it("should include unknown sessions note", () => {
    const result = formatAggregateTokenSummary(mockAggregate)
    expect(result).toContain("Note: 3 session(s) with unavailable token data")
  })

  it("should not include unknown sessions note when zero", () => {
    const noUnknown: AggregateTokenSummary = {
      ...mockAggregate,
      unknownSessions: 0,
    }
    const result = formatAggregateTokenSummary(noUnknown)
    expect(result).not.toContain("Note:")
    expect(result).not.toContain("unavailable")
  })

  it("should handle unknown total summary", () => {
    const unknownTotal: AggregateTokenSummary = {
      total: { kind: "unknown", reason: "missing" },
      unknownSessions: 5,
    }
    const result = formatAggregateTokenSummary(unknownTotal)
    expect(result).toContain("Token Summary")
    expect(result).toContain("[Token data unavailable]")
    expect(result).toContain("Note: 5 session(s) with unavailable token data")
  })
})
