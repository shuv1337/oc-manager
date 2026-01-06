# Test Fixtures

Minimal fixture store matching the OpenCode on-disk schema.

## Directory Layout

```
tests/fixtures/
├── store/                    # Simulated ~/.local/share/opencode
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
└── README.md
```

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

1. **proj_present**: Project with existing worktree (state: "present")
2. **proj_missing**: Project with non-existent worktree (state: "missing")
3. Two sessions with distinct titles for search/filter testing
4. Chat messages covering text, tool, and subtask part types
