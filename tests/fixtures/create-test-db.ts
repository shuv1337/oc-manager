/**
 * Script to create the SQLite test fixture database.
 *
 * Run with: bun run tests/fixtures/create-test-db.ts
 *
 * This generates tests/fixtures/test.db with the same data as the JSONL fixtures,
 * enabling integration tests that compare both backends.
 */
import { Database } from "bun:sqlite"
import { join } from "node:path"
import { existsSync, unlinkSync } from "node:fs"

const DB_PATH = join(import.meta.dirname, "test.db")

// Remove existing database if present
if (existsSync(DB_PATH)) {
  unlinkSync(DB_PATH)
  console.log("Removed existing test.db")
}

const db = new Database(DB_PATH)

// Create tables matching OpenCode's SQLite schema
db.run(`
  CREATE TABLE project (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  )
`)

db.run(`
  CREATE TABLE session (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    parent_id TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    data TEXT NOT NULL
  )
`)

db.run(`
  CREATE TABLE message (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    created_at INTEGER,
    data TEXT NOT NULL
  )
`)

db.run(`
  CREATE TABLE part (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    data TEXT NOT NULL
  )
`)

console.log("Created tables: project, session, message, part")

// ========================
// Insert Projects (2 projects)
// ========================

const projects = [
  {
    id: "proj_present",
    data: JSON.stringify({
      id: "proj_present",
      worktree: "tests/fixtures/worktrees/my-present-project",
      vcs: "git",
      time: { created: 1704067200000 }, // 2024-01-01T00:00:00.000Z
    }),
  },
  {
    id: "proj_missing",
    data: JSON.stringify({
      id: "proj_missing",
      worktree: "tests/fixtures/worktrees/nonexistent-project",
      vcs: "git",
      time: { created: 1704153600000 }, // 2024-01-02T00:00:00.000Z
    }),
  },
]

const insertProject = db.prepare("INSERT INTO project (id, data) VALUES (?, ?)")
for (const project of projects) {
  insertProject.run(project.id, project.data)
}
console.log(`Inserted ${projects.length} projects`)

// ========================
// Insert Sessions (5 sessions across 2 projects)
// ========================

const sessions = [
  // proj_present sessions
  {
    id: "session_parser_fix",
    project_id: "proj_present",
    parent_id: null,
    created_at: 1704067200000,
    updated_at: 1704153600000,
    data: JSON.stringify({
      id: "session_parser_fix",
      projectID: "proj_present",
      directory: "tests/fixtures/worktrees/my-present-project",
      title: "Fix bug in parser",
      version: "1.0.0",
      time: { created: 1704067200000, updated: 1704153600000 },
    }),
  },
  {
    id: "session_add_tests",
    project_id: "proj_present",
    parent_id: null,
    created_at: 1704240000000,
    updated_at: 1704326400000,
    data: JSON.stringify({
      id: "session_add_tests",
      projectID: "proj_present",
      directory: "tests/fixtures/worktrees/my-present-project",
      title: "Add unit tests for utils",
      version: "1.0.0",
      time: { created: 1704240000000, updated: 1704326400000 },
    }),
  },
  {
    id: "session_refactor_api",
    project_id: "proj_present",
    parent_id: null,
    created_at: 1704412800000,
    updated_at: 1704499200000,
    data: JSON.stringify({
      id: "session_refactor_api",
      projectID: "proj_present",
      directory: "tests/fixtures/worktrees/my-present-project",
      title: "Refactor API endpoints",
      version: "1.0.0",
      time: { created: 1704412800000, updated: 1704499200000 },
    }),
  },
  // proj_missing sessions
  {
    id: "session_missing_proj_01",
    project_id: "proj_missing",
    parent_id: null,
    created_at: 1704585600000,
    updated_at: 1704672000000,
    data: JSON.stringify({
      id: "session_missing_proj_01",
      projectID: "proj_missing",
      directory: "tests/fixtures/worktrees/nonexistent-project",
      title: "Setup project structure",
      version: "1.0.0",
      time: { created: 1704585600000, updated: 1704672000000 },
    }),
  },
  // Forked session (has parent_id)
  {
    id: "session_fork_parser",
    project_id: "proj_present",
    parent_id: "session_parser_fix",
    created_at: 1704758400000,
    updated_at: 1704844800000,
    data: JSON.stringify({
      id: "session_fork_parser",
      projectID: "proj_present",
      parentID: "session_parser_fix",
      directory: "tests/fixtures/worktrees/my-present-project",
      title: "Fork: Alternative parser approach",
      version: "1.0.0",
      time: { created: 1704758400000, updated: 1704844800000 },
    }),
  },
]

const insertSession = db.prepare(
  "INSERT INTO session (id, project_id, parent_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?, ?)"
)
for (const session of sessions) {
  insertSession.run(
    session.id,
    session.project_id,
    session.parent_id,
    session.created_at,
    session.updated_at,
    session.data
  )
}
console.log(`Inserted ${sessions.length} sessions`)

// ========================
// Insert Messages (10 messages across sessions)
// ========================

const messages = [
  // session_add_tests messages (matching JSONL fixtures)
  {
    id: "msg_user_01",
    session_id: "session_add_tests",
    created_at: 1704240100000,
    data: JSON.stringify({
      id: "msg_user_01",
      sessionID: "session_add_tests",
      role: "user",
      time: { created: 1704240100000 },
    }),
  },
  {
    id: "msg_assistant_01",
    session_id: "session_add_tests",
    created_at: 1704240200000,
    data: JSON.stringify({
      id: "msg_assistant_01",
      sessionID: "session_add_tests",
      role: "assistant",
      time: { created: 1704240200000 },
      parentID: "msg_user_01",
      tokens: {
        input: 150,
        output: 75,
        reasoning: 10,
        cache: { read: 50, write: 25 },
      },
    }),
  },
  // session_parser_fix messages
  {
    id: "msg_parser_user_01",
    session_id: "session_parser_fix",
    created_at: 1704067300000,
    data: JSON.stringify({
      id: "msg_parser_user_01",
      sessionID: "session_parser_fix",
      role: "user",
      time: { created: 1704067300000 },
    }),
  },
  {
    id: "msg_parser_assistant_01",
    session_id: "session_parser_fix",
    created_at: 1704067400000,
    data: JSON.stringify({
      id: "msg_parser_assistant_01",
      sessionID: "session_parser_fix",
      role: "assistant",
      time: { created: 1704067400000 },
      parentID: "msg_parser_user_01",
      tokens: {
        input: 200,
        output: 100,
        reasoning: 0,
        cache: { read: 0, write: 0 },
      },
    }),
  },
  {
    id: "msg_parser_user_02",
    session_id: "session_parser_fix",
    created_at: 1704067500000,
    data: JSON.stringify({
      id: "msg_parser_user_02",
      sessionID: "session_parser_fix",
      role: "user",
      time: { created: 1704067500000 },
    }),
  },
  {
    id: "msg_parser_assistant_02",
    session_id: "session_parser_fix",
    created_at: 1704067600000,
    data: JSON.stringify({
      id: "msg_parser_assistant_02",
      sessionID: "session_parser_fix",
      role: "assistant",
      time: { created: 1704067600000 },
      parentID: "msg_parser_user_02",
      tokens: {
        input: 250,
        output: 150,
        reasoning: 5,
        cache: { read: 30, write: 10 },
      },
    }),
  },
  // session_refactor_api messages
  {
    id: "msg_api_user_01",
    session_id: "session_refactor_api",
    created_at: 1704412900000,
    data: JSON.stringify({
      id: "msg_api_user_01",
      sessionID: "session_refactor_api",
      role: "user",
      time: { created: 1704412900000 },
    }),
  },
  {
    id: "msg_api_assistant_01",
    session_id: "session_refactor_api",
    created_at: 1704413000000,
    data: JSON.stringify({
      id: "msg_api_assistant_01",
      sessionID: "session_refactor_api",
      role: "assistant",
      time: { created: 1704413000000 },
      parentID: "msg_api_user_01",
      tokens: {
        input: 500,
        output: 300,
        reasoning: 20,
        cache: { read: 100, write: 50 },
      },
    }),
  },
  // session_missing_proj_01 messages
  {
    id: "msg_missing_user_01",
    session_id: "session_missing_proj_01",
    created_at: 1704585700000,
    data: JSON.stringify({
      id: "msg_missing_user_01",
      sessionID: "session_missing_proj_01",
      role: "user",
      time: { created: 1704585700000 },
    }),
  },
  {
    id: "msg_missing_assistant_01",
    session_id: "session_missing_proj_01",
    created_at: 1704585800000,
    data: JSON.stringify({
      id: "msg_missing_assistant_01",
      sessionID: "session_missing_proj_01",
      role: "assistant",
      time: { created: 1704585800000 },
      parentID: "msg_missing_user_01",
      tokens: {
        input: 100,
        output: 50,
        reasoning: 0,
        cache: { read: 0, write: 0 },
      },
    }),
  },
]

const insertMessage = db.prepare(
  "INSERT INTO message (id, session_id, created_at, data) VALUES (?, ?, ?, ?)"
)
for (const message of messages) {
  insertMessage.run(message.id, message.session_id, message.created_at, message.data)
}
console.log(`Inserted ${messages.length} messages`)

// ========================
// Insert Parts (20 parts across messages)
// ========================

const parts = [
  // msg_user_01 parts (matching JSONL fixtures)
  {
    id: "part_text_01",
    message_id: "msg_user_01",
    session_id: "session_add_tests",
    data: JSON.stringify({
      id: "part_text_01",
      type: "text",
      text: "Can you help me add unit tests for the utils module?",
    }),
  },
  // msg_assistant_01 parts (matching JSONL fixtures)
  {
    id: "part_text_02",
    message_id: "msg_assistant_01",
    session_id: "session_add_tests",
    data: JSON.stringify({
      id: "part_text_02",
      type: "text",
      text: "I'll help you add unit tests for the utils module. Let me first read the existing code.",
    }),
  },
  {
    id: "part_tool_01",
    message_id: "msg_assistant_01",
    session_id: "session_add_tests",
    data: JSON.stringify({
      id: "part_tool_01",
      type: "tool",
      tool: "Read",
      state: {
        status: "completed",
        input: { path: "src/utils.ts" },
        output: "export function formatDate(d: Date): string { return d.toISOString() }",
      },
    }),
  },
  {
    id: "part_subtask_01",
    message_id: "msg_assistant_01",
    session_id: "session_add_tests",
    data: JSON.stringify({
      id: "part_subtask_01",
      type: "subtask",
      prompt: "Analyze test coverage for utils module",
      description: "Examining existing test files",
    }),
  },
  // msg_parser_user_01 parts
  {
    id: "part_parser_text_01",
    message_id: "msg_parser_user_01",
    session_id: "session_parser_fix",
    data: JSON.stringify({
      id: "part_parser_text_01",
      type: "text",
      text: "There's a bug in the parser when handling nested arrays. Can you fix it?",
    }),
  },
  // msg_parser_assistant_01 parts
  {
    id: "part_parser_text_02",
    message_id: "msg_parser_assistant_01",
    session_id: "session_parser_fix",
    data: JSON.stringify({
      id: "part_parser_text_02",
      type: "text",
      text: "I'll investigate the parser issue with nested arrays. Let me look at the code.",
    }),
  },
  {
    id: "part_parser_tool_01",
    message_id: "msg_parser_assistant_01",
    session_id: "session_parser_fix",
    data: JSON.stringify({
      id: "part_parser_tool_01",
      type: "tool",
      tool: "Read",
      state: {
        status: "completed",
        input: { path: "src/parser.ts" },
        output: "export function parse(input: string): any { /* parser code */ }",
      },
    }),
  },
  // msg_parser_user_02 parts
  {
    id: "part_parser_text_03",
    message_id: "msg_parser_user_02",
    session_id: "session_parser_fix",
    data: JSON.stringify({
      id: "part_parser_text_03",
      type: "text",
      text: "The fix looks good but can we also add error handling?",
    }),
  },
  // msg_parser_assistant_02 parts
  {
    id: "part_parser_text_04",
    message_id: "msg_parser_assistant_02",
    session_id: "session_parser_fix",
    data: JSON.stringify({
      id: "part_parser_text_04",
      type: "text",
      text: "Sure, I'll add proper error handling to the parser.",
    }),
  },
  {
    id: "part_parser_tool_02",
    message_id: "msg_parser_assistant_02",
    session_id: "session_parser_fix",
    data: JSON.stringify({
      id: "part_parser_tool_02",
      type: "tool",
      tool: "Edit",
      state: {
        status: "completed",
        input: { path: "src/parser.ts", oldText: "function parse", newText: "function safeParse" },
        output: "Edited src/parser.ts",
      },
    }),
  },
  // msg_api_user_01 parts
  {
    id: "part_api_text_01",
    message_id: "msg_api_user_01",
    session_id: "session_refactor_api",
    data: JSON.stringify({
      id: "part_api_text_01",
      type: "text",
      text: "Can you refactor the API endpoints to use async/await instead of callbacks?",
    }),
  },
  // msg_api_assistant_01 parts
  {
    id: "part_api_text_02",
    message_id: "msg_api_assistant_01",
    session_id: "session_refactor_api",
    data: JSON.stringify({
      id: "part_api_text_02",
      type: "text",
      text: "I'll refactor all API endpoints to use async/await. Let me start by examining the current code.",
    }),
  },
  {
    id: "part_api_tool_01",
    message_id: "msg_api_assistant_01",
    session_id: "session_refactor_api",
    data: JSON.stringify({
      id: "part_api_tool_01",
      type: "tool",
      tool: "Glob",
      state: {
        status: "completed",
        input: { pattern: "src/api/**/*.ts" },
        output: "src/api/users.ts\nsrc/api/posts.ts\nsrc/api/comments.ts",
      },
    }),
  },
  {
    id: "part_api_tool_02",
    message_id: "msg_api_assistant_01",
    session_id: "session_refactor_api",
    data: JSON.stringify({
      id: "part_api_tool_02",
      type: "tool",
      tool: "Read",
      state: {
        status: "completed",
        input: { path: "src/api/users.ts" },
        output: "export const getUsers = (cb) => { /* callback-based code */ }",
      },
    }),
  },
  {
    id: "part_api_subtask_01",
    message_id: "msg_api_assistant_01",
    session_id: "session_refactor_api",
    data: JSON.stringify({
      id: "part_api_subtask_01",
      type: "subtask",
      prompt: "Convert callback patterns to async/await",
      description: "Analyzing API files for refactoring",
    }),
  },
  // msg_missing_user_01 parts
  {
    id: "part_missing_text_01",
    message_id: "msg_missing_user_01",
    session_id: "session_missing_proj_01",
    data: JSON.stringify({
      id: "part_missing_text_01",
      type: "text",
      text: "Help me set up the project structure for a new React app.",
    }),
  },
  // msg_missing_assistant_01 parts
  {
    id: "part_missing_text_02",
    message_id: "msg_missing_assistant_01",
    session_id: "session_missing_proj_01",
    data: JSON.stringify({
      id: "part_missing_text_02",
      type: "text",
      text: "I'll help you set up a React project structure. Let me create the necessary directories.",
    }),
  },
  {
    id: "part_missing_tool_01",
    message_id: "msg_missing_assistant_01",
    session_id: "session_missing_proj_01",
    data: JSON.stringify({
      id: "part_missing_tool_01",
      type: "tool",
      tool: "Bash",
      state: {
        status: "completed",
        input: { command: "mkdir -p src/components src/hooks src/utils" },
        output: "",
      },
    }),
  },
  // Additional parts for variety (tool with pending status)
  {
    id: "part_api_tool_03",
    message_id: "msg_api_assistant_01",
    session_id: "session_refactor_api",
    data: JSON.stringify({
      id: "part_api_tool_03",
      type: "tool",
      tool: "Write",
      state: {
        status: "pending",
        input: { path: "src/api/users.ts" },
      },
    }),
  },
  // Part without tool output (to test fallback to input)
  {
    id: "part_parser_tool_03",
    message_id: "msg_parser_assistant_02",
    session_id: "session_parser_fix",
    data: JSON.stringify({
      id: "part_parser_tool_03",
      type: "tool",
      tool: "Grep",
      state: {
        status: "running",
        input: { prompt: "Searching for error patterns..." },
      },
    }),
  },
]

const insertPart = db.prepare(
  "INSERT INTO part (id, message_id, session_id, data) VALUES (?, ?, ?, ?)"
)
for (const part of parts) {
  insertPart.run(part.id, part.message_id, part.session_id, part.data)
}
console.log(`Inserted ${parts.length} parts`)

// Create indexes for better query performance
db.run("CREATE INDEX idx_session_project_id ON session(project_id)")
db.run("CREATE INDEX idx_message_session_id ON message(session_id)")
db.run("CREATE INDEX idx_part_message_id ON part(message_id)")
db.run("CREATE INDEX idx_part_session_id ON part(session_id)")
console.log("Created indexes")

db.close()
console.log(`\nDatabase created successfully: ${DB_PATH}`)
console.log(`
Summary:
  - ${projects.length} projects
  - ${sessions.length} sessions
  - ${messages.length} messages  
  - ${parts.length} parts
`)
