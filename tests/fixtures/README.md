# Test Fixtures

Minimal fixture store matching the OpenCode on-disk schema.

## Directory Layout

```
tests/fixtures/
├── store/                    # Simulated ~/.local/share/opencode (JSONL backend)
│   └── storage/
│       ├── project/          # Project metadata (primary bucket)
│       │   └── <projectId>.json
│       ├── sessions/         # Project metadata (secondary bucket)
│       │   └── <projectId>.json
│       ├── session/          # Session metadata per project
│       │   └── <projectId>/
│       │       └── <sessionId>.json
│       ├── message/          # Messages per session
│       │   └── <sessionId>/
│       │       └── <messageId>.json
│       └── part/             # Parts per message
│           └── <messageId>/
│               └── <partId>.json
├── test.db                   # SQLite database (SQLite backend)
├── create-test-db.ts         # Script to regenerate test.db
└── README.md
```

### Legacy Storage Paths

For backwards compatibility, the codebase also supports legacy storage layouts from older OpenCode versions:

```
storage/session/message/<sessionId>/<messageId>.json   # Legacy message path
storage/session/part/<messageId>/<partId>.json         # Legacy part path
```

The loader checks primary paths first, then falls back to legacy paths. Test fixtures use the current (primary) layout.

## Project File Schema

```json
{
  "id": "proj_abc123",
  "worktree": "~/repos/my-project",
  "vcs": "git",
  "time": {
    "created": 1704067200000
  }
}
```

- `id`: Project identifier (also used as filename without `.json`)
- `worktree`: Path to project directory (supports `~` expansion)
- `vcs`: Version control system (optional, typically "git")
- `time.created`: Unix timestamp in milliseconds

## Session File Schema

```json
{
  "id": "session_abc123",
  "projectID": "proj_abc123",
  "directory": "~/repos/my-project",
  "title": "Fix bug in parser",
  "version": "1.0.0",
  "time": {
    "created": 1704067200000,
    "updated": 1704153600000
  }
}
```

- `id`: Session identifier (also used as filename without `.json`)
- `projectID`: Parent project identifier
- `directory`: Working directory for this session
- `title`: Human-readable session title
- `version`: OpenCode version that created the session
- `time.created`: Creation timestamp (ms)
- `time.updated`: Last update timestamp (ms)

## Message File Schema

```json
{
  "id": "msg_abc123",
  "sessionID": "session_abc123",
  "role": "user" | "assistant",
  "time": {
    "created": 1704067200000
  },
  "parentID": "msg_parent123",
  "tokens": {
    "input": 100,
    "output": 50,
    "reasoning": 0,
    "cache": {
      "read": 0,
      "write": 0
    }
  }
}
```

- `id`: Message identifier
- `sessionID`: Parent session identifier
- `role`: "user" or "assistant"
- `time.created`: Creation timestamp (ms)
- `parentID`: Optional parent message ID for threading
- `tokens`: Token usage (only on assistant messages)

## Part File Schema

### Text Part

```json
{
  "id": "part_abc123",
  "type": "text",
  "text": "Hello, how can I help?"
}
```

### Tool Part

```json
{
  "id": "part_tool123",
  "type": "tool",
  "tool": "Read",
  "state": {
    "status": "completed",
    "input": { "path": "/path/to/file" },
    "output": "file contents here"
  }
}
```

### Subtask Part

```json
{
  "id": "part_sub123",
  "type": "subtask",
  "prompt": "Analyze codebase structure",
  "description": "Looking at project files"
}
```

## Test Fixtures Included

### JSONL Fixtures (store/)

1. **proj_present**: Project with existing worktree (state: "present")
2. **proj_missing**: Project with non-existent worktree (state: "missing")
3. Two sessions with distinct titles for search/filter testing
4. Chat messages covering text, tool, and subtask part types

### SQLite Fixture (test.db)

The SQLite fixture contains the same data as the JSONL fixtures, plus additional records for more comprehensive testing.

**Summary:**
- 2 projects (proj_present, proj_missing)
- 5 sessions (including a forked session with parent_id)
- 10 messages (across all sessions)
- 20 parts (text, tool, subtask types with various states)

**To regenerate test.db:**

```bash
bun run tests/fixtures/create-test-db.ts
```

**SQLite Schema:**

```sql
-- project table
CREATE TABLE project (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL    -- JSON blob with project metadata
);

-- session table
CREATE TABLE session (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  parent_id TEXT,       -- NULL for root sessions, set for forks
  created_at INTEGER,   -- Unix timestamp (ms)
  updated_at INTEGER,   -- Unix timestamp (ms)
  data TEXT NOT NULL    -- JSON blob with session metadata
);

-- message table
CREATE TABLE message (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  created_at INTEGER,   -- Unix timestamp (ms)
  data TEXT NOT NULL    -- JSON blob with message metadata
);

-- part table
CREATE TABLE part (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  data TEXT NOT NULL    -- JSON blob with part content
);
```

The `data` column in each table contains JSON with the same structure as the corresponding JSONL files.
