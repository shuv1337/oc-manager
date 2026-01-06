/**
 * Tests for NDJSON output formatter.
 */

import { describe, expect, it } from "bun:test"
import {
  formatNdjsonLine,
  formatNdjson,
  streamNdjson,
} from "../../../src/cli/formatters/ndjson"

describe("formatNdjsonLine", () => {
  it("should format a simple object as compact JSON", () => {
    const data = { name: "test", value: 42 }
    const result = formatNdjsonLine(data)
    expect(result).toBe('{"name":"test","value":42}')
  })

  it("should convert Date objects to ISO strings", () => {
    const date = new Date("2024-01-15T10:30:00.000Z")
    const data = { createdAt: date }
    const result = formatNdjsonLine(data)
    expect(result).toBe('{"createdAt":"2024-01-15T10:30:00.000Z"}')
  })

  it("should handle null values", () => {
    const data = { value: null }
    const result = formatNdjsonLine(data)
    expect(result).toBe('{"value":null}')
  })

  it("should handle nested objects", () => {
    const data = { outer: { inner: "value" } }
    const result = formatNdjsonLine(data)
    expect(result).toBe('{"outer":{"inner":"value"}}')
  })

  it("should handle arrays in objects", () => {
    const data = { items: [1, 2, 3] }
    const result = formatNdjsonLine(data)
    expect(result).toBe('{"items":[1,2,3]}')
  })

  it("should not include newlines in single line output", () => {
    const data = { name: "test" }
    const result = formatNdjsonLine(data)
    expect(result).not.toContain("\n")
  })
})

describe("formatNdjson", () => {
  it("should format an array as newline-delimited JSON", () => {
    const data = [{ id: 1 }, { id: 2 }, { id: 3 }]
    const result = formatNdjson(data)
    expect(result).toBe('{"id":1}\n{"id":2}\n{"id":3}')
  })

  it("should return empty string for empty array", () => {
    const result = formatNdjson([])
    expect(result).toBe("")
  })

  it("should format single item without trailing newline", () => {
    const data = [{ name: "only" }]
    const result = formatNdjson(data)
    expect(result).toBe('{"name":"only"}')
    expect(result).not.toContain("\n")
  })

  it("should handle complex records", () => {
    const data = [
      { id: 1, name: "first", tags: ["a", "b"] },
      { id: 2, name: "second", tags: [] },
    ]
    const result = formatNdjson(data)
    const lines = result.split("\n")
    expect(lines).toHaveLength(2)
    expect(JSON.parse(lines[0])).toEqual({ id: 1, name: "first", tags: ["a", "b"] })
    expect(JSON.parse(lines[1])).toEqual({ id: 2, name: "second", tags: [] })
  })

  it("should convert Date objects in all records", () => {
    const date1 = new Date("2024-01-10T08:00:00.000Z")
    const date2 = new Date("2024-01-15T10:30:00.000Z")
    const data = [{ createdAt: date1 }, { createdAt: date2 }]
    const result = formatNdjson(data)
    const lines = result.split("\n")
    expect(JSON.parse(lines[0]).createdAt).toBe("2024-01-10T08:00:00.000Z")
    expect(JSON.parse(lines[1]).createdAt).toBe("2024-01-15T10:30:00.000Z")
  })
})

describe("streamNdjson", () => {
  it("should yield each record as a separate line", () => {
    const data = [{ id: 1 }, { id: 2 }, { id: 3 }]
    const lines = [...streamNdjson(data)]
    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe('{"id":1}')
    expect(lines[1]).toBe('{"id":2}')
    expect(lines[2]).toBe('{"id":3}')
  })

  it("should handle empty iterable", () => {
    const lines = [...streamNdjson([])]
    expect(lines).toHaveLength(0)
  })

  it("should work with generator input", () => {
    function* generateData() {
      yield { value: 1 }
      yield { value: 2 }
    }
    const lines = [...streamNdjson(generateData())]
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe('{"value":1}')
    expect(lines[1]).toBe('{"value":2}')
  })

  it("should handle Date objects", () => {
    const date = new Date("2024-01-15T10:30:00.000Z")
    const data = [{ createdAt: date }]
    const lines = [...streamNdjson(data)]
    expect(lines[0]).toBe('{"createdAt":"2024-01-15T10:30:00.000Z"}')
  })
})

describe("ProjectRecord NDJSON formatting", () => {
  it("should format ProjectRecord-like objects", () => {
    const projects = [
      {
        index: 1,
        bucket: "project",
        filePath: "/home/user/.local/share/opencode/project/abc123.json",
        projectId: "abc123",
        worktree: "/home/user/projects/my-app",
        vcs: "git",
        createdAt: new Date("2024-01-10T08:00:00.000Z"),
        state: "present",
      },
      {
        index: 2,
        bucket: "project",
        filePath: "/home/user/.local/share/opencode/project/def456.json",
        projectId: "def456",
        worktree: "/home/user/projects/other-app",
        vcs: "git",
        createdAt: new Date("2024-01-12T09:00:00.000Z"),
        state: "missing",
      },
    ]
    const result = formatNdjson(projects)
    const lines = result.split("\n")
    expect(lines).toHaveLength(2)

    const parsed1 = JSON.parse(lines[0])
    expect(parsed1.projectId).toBe("abc123")
    expect(parsed1.state).toBe("present")
    expect(parsed1.createdAt).toBe("2024-01-10T08:00:00.000Z")

    const parsed2 = JSON.parse(lines[1])
    expect(parsed2.projectId).toBe("def456")
    expect(parsed2.state).toBe("missing")
  })
})

describe("SessionRecord NDJSON formatting", () => {
  it("should format SessionRecord-like objects", () => {
    const sessions = [
      {
        index: 0,
        filePath: "/home/user/.local/share/opencode/sessions/abc123/def456.json",
        sessionId: "def456",
        projectId: "abc123",
        directory: "/home/user/projects/my-app",
        title: "Implement feature X",
        version: "1.0.0",
        createdAt: new Date("2024-01-15T09:00:00.000Z"),
        updatedAt: new Date("2024-01-15T10:30:00.000Z"),
      },
      {
        index: 1,
        filePath: "/home/user/.local/share/opencode/sessions/abc123/ghi789.json",
        sessionId: "ghi789",
        projectId: "abc123",
        directory: "/home/user/projects/my-app",
        title: "Fix bug Y",
        version: "1.0.0",
        createdAt: new Date("2024-01-16T11:00:00.000Z"),
        updatedAt: new Date("2024-01-16T12:00:00.000Z"),
      },
    ]
    const result = formatNdjson(sessions)
    const lines = result.split("\n")
    expect(lines).toHaveLength(2)

    const parsed1 = JSON.parse(lines[0])
    expect(parsed1.sessionId).toBe("def456")
    expect(parsed1.title).toBe("Implement feature X")

    const parsed2 = JSON.parse(lines[1])
    expect(parsed2.sessionId).toBe("ghi789")
    expect(parsed2.title).toBe("Fix bug Y")
  })
})
