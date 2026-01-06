/**
 * Tests for CLI output module.
 *
 * Verifies that the output module correctly routes data to the appropriate
 * formatter based on the --format option.
 */

import { describe, expect, it } from "bun:test"
import {
  createDryRunResult,
  formatChatOutput,
  formatDryRunOutput,
  formatErrorOutput,
  formatProjectsOutput,
  formatSessionsOutput,
  formatSuccessOutput,
  formatTokensOutput,
  formatAggregateTokensOutput,
  getOutputOptions,
  type DryRunResult,
  type IndexedChatMessage,
} from "../../src/cli/output"
import type {
  AggregateTokenSummary,
  ProjectRecord,
  SessionRecord,
  TokenSummary,
} from "../../src/lib/opencode-data"
import type { GlobalOptions } from "../../src/cli/index"

// ========================
// Test Data Fixtures
// ========================

const mockProject: ProjectRecord = {
  index: 1,
  projectId: "proj-123",
  worktree: "/home/user/project",
  state: "present",
  createdAt: new Date("2024-01-01T10:00:00Z"),
  bucket: "project",
  filePath: "/home/user/.opencode/storage/project/proj-123.json",
  vcs: "git",
}

const mockSession: SessionRecord = {
  index: 1,
  sessionId: "sess-456",
  projectId: "proj-123",
  title: "Test Session",
  createdAt: new Date("2024-01-01T10:00:00Z"),
  updatedAt: new Date("2024-01-15T10:00:00Z"),
  directory: "/home/user/.opencode/sessions/sess-456",
  filePath: "/home/user/.opencode/sessions/sess-456/session.json",
  version: "1",
}

const mockChatMessage: IndexedChatMessage = {
  index: 1,
  messageId: "msg-789",
  sessionId: "sess-456",
  role: "user",
  previewText: "Hello, world!",
  createdAt: new Date("2024-01-01T10:00:00Z"),
  tokens: { total: 10, input: 8, output: 2, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
  parts: [],
  totalChars: 13,
}

const mockTokenSummary: TokenSummary = {
  kind: "known",
  tokens: {
    total: 1000,
    input: 600,
    output: 300,
    reasoning: 50,
    cacheRead: 30,
    cacheWrite: 20,
  },
}

const mockAggregateTokenSummary: AggregateTokenSummary = {
  total: {
    kind: "known",
    tokens: {
      total: 5000,
      input: 3000,
      output: 1500,
      reasoning: 250,
      cacheRead: 150,
      cacheWrite: 100,
    },
  },
  unknownSessions: 1,
}

const mockGlobalOptions: GlobalOptions = {
  root: "/home/user/.opencode",
  format: "table",
  limit: 200,
  sort: "updated",
  yes: false,
  dryRun: false,
  quiet: false,
  clipboard: false,
  backupDir: undefined,
}

// ========================
// getOutputOptions Tests
// ========================

describe("getOutputOptions", () => {
  it("extracts format from global options", () => {
    const opts = getOutputOptions({ ...mockGlobalOptions, format: "json" })
    expect(opts.format).toBe("json")
  })

  it("extracts quiet from global options", () => {
    const opts = getOutputOptions({ ...mockGlobalOptions, quiet: true })
    expect(opts.quiet).toBe(true)
  })

  it("extracts limit into meta", () => {
    const opts = getOutputOptions({ ...mockGlobalOptions, limit: 50 })
    expect(opts.meta?.limit).toBe(50)
  })
})

// ========================
// Projects Output Tests
// ========================

describe("formatProjectsOutput", () => {
  const projects = [mockProject]

  describe("json format", () => {
    it("returns JSON with ok and data fields", () => {
      const output = formatProjectsOutput(projects, { format: "json" })
      const parsed = JSON.parse(output)
      expect(parsed.ok).toBe(true)
      expect(parsed.data).toHaveLength(1)
      expect(parsed.data[0].projectId).toBe("proj-123")
    })

    it("includes meta.count in response", () => {
      const output = formatProjectsOutput(projects, { format: "json" })
      const parsed = JSON.parse(output)
      expect(parsed.meta.count).toBe(1)
    })

    it("includes meta.limit when provided", () => {
      const output = formatProjectsOutput(projects, {
        format: "json",
        meta: { limit: 100 },
      })
      const parsed = JSON.parse(output)
      expect(parsed.meta.limit).toBe(100)
    })
  })

  describe("ndjson format", () => {
    it("returns one JSON object per line", () => {
      const output = formatProjectsOutput(projects, { format: "ndjson" })
      const lines = output.split("\n").filter((l) => l.trim())
      expect(lines).toHaveLength(1)
      const parsed = JSON.parse(lines[0])
      expect(parsed.projectId).toBe("proj-123")
    })

    it("handles multiple projects", () => {
      const multipleProjects = [
        mockProject,
        { ...mockProject, index: 2, projectId: "proj-456" },
      ]
      const output = formatProjectsOutput(multipleProjects, { format: "ndjson" })
      const lines = output.split("\n").filter((l) => l.trim())
      expect(lines).toHaveLength(2)
    })
  })

  describe("table format", () => {
    it("returns table with headers", () => {
      const output = formatProjectsOutput(projects, { format: "table" })
      expect(output).toContain("#")
      expect(output).toContain("State")
      expect(output).toContain("Path")
    })

    it("includes project data in rows", () => {
      const output = formatProjectsOutput(projects, { format: "table" })
      expect(output).toContain("proj-123")
      expect(output).toContain("/home/user/project")
    })
  })
})

// ========================
// Sessions Output Tests
// ========================

describe("formatSessionsOutput", () => {
  const sessions = [mockSession]

  describe("json format", () => {
    it("returns JSON with session data", () => {
      const output = formatSessionsOutput(sessions, { format: "json" })
      const parsed = JSON.parse(output)
      expect(parsed.ok).toBe(true)
      expect(parsed.data[0].sessionId).toBe("sess-456")
      expect(parsed.data[0].title).toBe("Test Session")
    })
  })

  describe("ndjson format", () => {
    it("returns one JSON object per line", () => {
      const output = formatSessionsOutput(sessions, { format: "ndjson" })
      const parsed = JSON.parse(output)
      expect(parsed.sessionId).toBe("sess-456")
    })
  })

  describe("table format", () => {
    it("returns table with session columns", () => {
      const output = formatSessionsOutput(sessions, { format: "table" })
      expect(output).toContain("Title")
      expect(output).toContain("Session ID")
      expect(output).toContain("Test Session")
    })
  })
})

// ========================
// Chat Output Tests
// ========================

describe("formatChatOutput", () => {
  const messages = [mockChatMessage]

  describe("json format", () => {
    it("returns JSON with message data", () => {
      const output = formatChatOutput(messages, { format: "json" })
      const parsed = JSON.parse(output)
      expect(parsed.ok).toBe(true)
      expect(parsed.data[0].messageId).toBe("msg-789")
      expect(parsed.data[0].role).toBe("user")
    })
  })

  describe("ndjson format", () => {
    it("returns one JSON object per line", () => {
      const output = formatChatOutput(messages, { format: "ndjson" })
      const parsed = JSON.parse(output)
      expect(parsed.messageId).toBe("msg-789")
    })
  })

  describe("table format", () => {
    it("returns table with chat columns", () => {
      const output = formatChatOutput(messages, { format: "table" })
      expect(output).toContain("Role")
      expect(output).toContain("Message ID")
      expect(output).toContain("Hello, world!")
    })
  })
})

// ========================
// Tokens Output Tests
// ========================

describe("formatTokensOutput", () => {
  describe("json format", () => {
    it("returns JSON with token data", () => {
      const output = formatTokensOutput(mockTokenSummary, "json")
      const parsed = JSON.parse(output)
      expect(parsed.ok).toBe(true)
      expect(parsed.data.kind).toBe("known")
      expect(parsed.data.tokens.total).toBe(1000)
    })

    it("handles unknown token summary", () => {
      const unknownSummary: TokenSummary = { kind: "unknown", reason: "missing" }
      const output = formatTokensOutput(unknownSummary, "json")
      const parsed = JSON.parse(output)
      expect(parsed.data.kind).toBe("unknown")
      expect(parsed.data.reason).toBe("missing")
    })
  })

  describe("ndjson format", () => {
    it("returns JSON object", () => {
      const output = formatTokensOutput(mockTokenSummary, "ndjson")
      const parsed = JSON.parse(output)
      expect(parsed.tokens.total).toBe(1000)
    })
  })

  describe("table format", () => {
    it("returns token breakdown table", () => {
      const output = formatTokensOutput(mockTokenSummary, "table")
      expect(output).toContain("Category")
      expect(output).toContain("Tokens")
      expect(output).toContain("Input")
      expect(output).toContain("Output")
    })

    it("returns message for unknown summary", () => {
      const unknownSummary: TokenSummary = { kind: "unknown", reason: "missing" }
      const output = formatTokensOutput(unknownSummary, "table")
      expect(output).toContain("unavailable")
    })
  })
})

describe("formatAggregateTokensOutput", () => {
  describe("json format", () => {
    it("returns JSON with aggregate data", () => {
      const output = formatAggregateTokensOutput(mockAggregateTokenSummary, "json")
      const parsed = JSON.parse(output)
      expect(parsed.ok).toBe(true)
      expect(parsed.data.total.tokens.total).toBe(5000)
      expect(parsed.data.unknownSessions).toBe(1)
    })
  })

  describe("table format", () => {
    it("includes session count info", () => {
      const output = formatAggregateTokensOutput(mockAggregateTokenSummary, "table")
      expect(output).toContain("Token Summary")
      expect(output).toContain("1 session(s) with unavailable")
    })

    it("uses custom label when provided", () => {
      const output = formatAggregateTokensOutput(
        mockAggregateTokenSummary,
        "table",
        "Project Tokens"
      )
      expect(output).toContain("Project Tokens")
    })
  })
})

// ========================
// Error Output Tests
// ========================

describe("formatErrorOutput", () => {
  describe("json format", () => {
    it("returns JSON error response", () => {
      const output = formatErrorOutput("Something went wrong", "json")
      const parsed = JSON.parse(output)
      expect(parsed.ok).toBe(false)
      expect(parsed.error).toBe("Something went wrong")
    })

    it("handles Error objects", () => {
      const output = formatErrorOutput(new Error("Test error"), "json")
      const parsed = JSON.parse(output)
      expect(parsed.error).toBe("Test error")
    })
  })

  describe("ndjson format", () => {
    it("returns JSON error response", () => {
      const output = formatErrorOutput("Something went wrong", "ndjson")
      const parsed = JSON.parse(output)
      expect(parsed.ok).toBe(false)
    })
  })

  describe("table format", () => {
    it("returns plain error message", () => {
      const output = formatErrorOutput("Something went wrong", "table")
      expect(output).toBe("Error: Something went wrong")
    })
  })
})

// ========================
// Success Output Tests
// ========================

describe("formatSuccessOutput", () => {
  describe("json format", () => {
    it("returns JSON success response with message", () => {
      const output = formatSuccessOutput("Operation completed", undefined, "json")
      const parsed = JSON.parse(output)
      expect(parsed.ok).toBe(true)
      expect(parsed.data.message).toBe("Operation completed")
    })

    it("includes custom data when provided", () => {
      const output = formatSuccessOutput(
        "Deleted 3 sessions",
        { deleted: 3, ids: ["a", "b", "c"] },
        "json"
      )
      const parsed = JSON.parse(output)
      expect(parsed.data.deleted).toBe(3)
      expect(parsed.data.ids).toEqual(["a", "b", "c"])
    })
  })

  describe("table format", () => {
    it("returns plain message", () => {
      const output = formatSuccessOutput("Operation completed", undefined, "table")
      expect(output).toBe("Operation completed")
    })
  })
})

// ========================
// Dry-Run Output Tests
// ========================

describe("createDryRunResult", () => {
  it("creates result with correct fields", () => {
    const paths = ["/path/to/file1.json", "/path/to/file2.json"]
    const result = createDryRunResult(paths, "delete", "project")

    expect(result.paths).toEqual(paths)
    expect(result.operation).toBe("delete")
    expect(result.resourceType).toBe("project")
    expect(result.count).toBe(2)
  })

  it("handles empty paths array", () => {
    const result = createDryRunResult([], "delete", "session")

    expect(result.paths).toEqual([])
    expect(result.count).toBe(0)
  })

  it("supports all operation types", () => {
    const operations: DryRunResult["operation"][] = ["delete", "backup", "move", "copy"]
    for (const op of operations) {
      const result = createDryRunResult(["/path"], op, "session")
      expect(result.operation).toBe(op)
    }
  })

  it("supports all resource types", () => {
    const resourceTypes: DryRunResult["resourceType"][] = ["project", "session"]
    for (const rt of resourceTypes) {
      const result = createDryRunResult(["/path"], "delete", rt)
      expect(result.resourceType).toBe(rt)
    }
  })
})

describe("formatDryRunOutput", () => {
  const mockResult: DryRunResult = {
    paths: [
      "/home/user/.opencode/storage/project/proj-123.json",
      "/home/user/.opencode/storage/project/proj-456.json",
    ],
    operation: "delete",
    resourceType: "project",
    count: 2,
  }

  describe("json format", () => {
    it("returns JSON with dryRun flag", () => {
      const output = formatDryRunOutput(mockResult, "json")
      const parsed = JSON.parse(output)

      expect(parsed.ok).toBe(true)
      expect(parsed.data.dryRun).toBe(true)
    })

    it("includes operation and resource type", () => {
      const output = formatDryRunOutput(mockResult, "json")
      const parsed = JSON.parse(output)

      expect(parsed.data.operation).toBe("delete")
      expect(parsed.data.resourceType).toBe("project")
    })

    it("includes count and paths", () => {
      const output = formatDryRunOutput(mockResult, "json")
      const parsed = JSON.parse(output)

      expect(parsed.data.count).toBe(2)
      expect(parsed.data.paths).toHaveLength(2)
      expect(parsed.data.paths[0]).toContain("proj-123.json")
    })
  })

  describe("ndjson format", () => {
    it("returns one line per path", () => {
      const output = formatDryRunOutput(mockResult, "ndjson")
      const lines = output.split("\n").filter((l) => l.trim())

      expect(lines).toHaveLength(2)
    })

    it("each line contains dryRun flag", () => {
      const output = formatDryRunOutput(mockResult, "ndjson")
      const lines = output.split("\n").filter((l) => l.trim())

      for (const line of lines) {
        const parsed = JSON.parse(line)
        expect(parsed.dryRun).toBe(true)
        expect(parsed.operation).toBe("delete")
        expect(parsed.resourceType).toBe("project")
        expect(parsed.path).toBeDefined()
      }
    })

    it("handles empty paths", () => {
      const emptyResult = createDryRunResult([], "delete", "session")
      const output = formatDryRunOutput(emptyResult, "ndjson")

      expect(output.trim()).toBe("")
    })
  })

  describe("table format", () => {
    it("includes DRY RUN header", () => {
      const output = formatDryRunOutput(mockResult, "table")

      expect(output).toContain("[DRY RUN]")
    })

    it("includes operation and count description", () => {
      const output = formatDryRunOutput(mockResult, "table")

      expect(output).toContain("delete")
      expect(output).toContain("2")
      expect(output).toContain("project(s)")
    })

    it("lists all paths", () => {
      const output = formatDryRunOutput(mockResult, "table")

      expect(output).toContain("proj-123.json")
      expect(output).toContain("proj-456.json")
    })

    it("handles single item", () => {
      const singleResult = createDryRunResult(
        ["/path/to/session.json"],
        "backup",
        "session"
      )
      const output = formatDryRunOutput(singleResult, "table")

      expect(output).toContain("backup")
      expect(output).toContain("1 session(s)")
      expect(output).toContain("session.json")
    })

    it("handles empty paths", () => {
      const emptyResult = createDryRunResult([], "move", "session")
      const output = formatDryRunOutput(emptyResult, "table")

      expect(output).toContain("[DRY RUN]")
      expect(output).toContain("0 session(s)")
    })
  })
})
