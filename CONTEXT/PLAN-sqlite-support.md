# Plan: Add Experimental SQLite Support to oc-manager

## Overview

OpenCode is experimenting with moving session data from JSONL files to SQLite. This plan adds an experimental flag to oc-manager to support reading/writing session data from the SQLite database at `~/.local/share/opencode/opencode.db`.

## Current State

### JSONL Storage Layout
```
~/.local/share/opencode/
├── storage/
│   ├── project/           # Project metadata files
│   │   └── <projectId>.json
│   ├── sessions/          # Legacy project bucket
│   │   └── <projectId>.json  
│   ├── session/           # Session files organized by project
│   │   └── <projectId>/
│   │       └── <sessionId>.json
│   ├── message/           # Message files organized by session
│   │   └── <sessionId>/
│   │       └── <messageId>.json
│   └── part/              # Part files organized by message
│       └── <messageId>/
│           └── <partId>.json
```

### SQLite Schema
```sql
-- Core tables
project (id TEXT PK, data TEXT)           -- JSON blob with full project payload
session (id TEXT PK, project_id TEXT, parent_id TEXT, created_at INT, updated_at INT, data TEXT)
message (id TEXT PK, session_id TEXT, created_at INT, data TEXT)
part (id TEXT PK, message_id TEXT, session_id TEXT, data TEXT)

-- Auxiliary tables (future consideration)
permission (project_id TEXT PK, data TEXT)
session_diff (session_id TEXT PK, data TEXT)
todo (session_id TEXT PK, data TEXT)
session_share (session_id TEXT PK, data TEXT)
share (session_id TEXT PK, data TEXT)
```

### Database Stats
- ~2GB database file
- 42 projects
- 2,540 sessions  
- 51,011 messages
- 208,382 parts

## Architecture

### Current Data Layer Interface

The current `src/lib/opencode-data.ts` exports these key functions:

**Project Operations:**
- `loadProjectRecords(options)` → `ProjectRecord[]`
- `deleteProjectMetadata(records, options)` → `DeleteResult`
- `filterProjectsByState/Ids/Indexes()`

**Session Operations:**
- `loadSessionRecords(options)` → `SessionRecord[]`
- `deleteSessionMetadata(records, options)` → `DeleteResult`
- `updateSessionTitle(filePath, title)`
- `copySession(session, targetProjectId, root)` → `SessionRecord`
- `moveSession(session, targetProjectId, root)` → `SessionRecord`
- `copySessions/moveSessions()` → batch operations

**Message/Chat Operations:**
- `loadSessionMessagePaths(sessionId, root)` → `string[]`
- `loadSessionChatIndex(sessionId, root)` → `ChatMessage[]`
- `loadMessageParts(messageId, root)` → `ChatPart[]`
- `hydrateChatMessageParts(message, root)` → `ChatMessage`
- `searchSessionsChat(sessions, query, root, options)` → `ChatSearchResult[]`

**Token Operations:**
- `computeSessionTokenSummary(session, root)` → `TokenSummary`
- `computeProjectTokenSummary(projectId, sessions, root)` → `AggregateTokenSummary`
- `computeGlobalTokenSummary(sessions, root)` → `AggregateTokenSummary`

### Proposed Architecture

```
src/lib/
├── opencode-data.ts              # Existing JSONL implementation (unchanged)
├── opencode-data-sqlite.ts       # NEW: SQLite implementation
├── opencode-data-provider.ts     # NEW: Provider abstraction + factory
└── types.ts                      # NEW: Shared type definitions (optional refactor)
```

**Key Design Decisions:**

1. **Provider Pattern**: Create a `DataProvider` interface that both implementations satisfy
2. **Factory Function**: `createDataProvider(options)` returns either JSONL or SQLite provider
3. **Zero Breaking Changes**: Existing JSONL code path remains default and unchanged
4. **Experimental Flag**: `--experimental-sqlite` or `--db <path>` enables SQLite mode

## Implementation Plan

### Phase 1: Foundation (SQLite Module + Types)

#### Task 1.1: Add bun:sqlite dependency
- Bun has built-in SQLite support via `bun:sqlite`
- No external dependencies needed
- Verify with: `import { Database } from "bun:sqlite"`

#### Task 1.2: Create SQLite data provider
Create `src/lib/opencode-data-sqlite.ts`:

```typescript
import { Database } from "bun:sqlite"

export interface SqliteLoadOptions {
  db: Database | string  // Database instance or path
}

// Implement parallel functions to opencode-data.ts:
export async function loadProjectRecordsSqlite(options: SqliteLoadOptions): Promise<ProjectRecord[]>
export async function loadSessionRecordsSqlite(options: SqliteLoadOptions): Promise<SessionRecord[]>
export async function loadSessionChatIndexSqlite(sessionId: string, db: Database): Promise<ChatMessage[]>
export async function loadMessagePartsSqlite(messageId: string, db: Database): Promise<ChatPart[]>
// ... etc
```

#### Task 1.3: Parse JSON `data` column
The SQLite tables store full payloads in `data` TEXT columns. Need to:
- Parse JSON from `data` column
- Extract same fields as JSONL parser
- Handle timestamps: SQLite has `created_at`/`updated_at` columns (epoch ms)

### Phase 2: CLI Integration

#### Task 2.1: Add experimental flag to CLI
Modify `src/cli/index.ts`:

```typescript
export interface GlobalOptions {
  // ... existing options
  experimentalSqlite: boolean      // NEW
  dbPath?: string                  // NEW: custom DB path
}

// In createProgram():
.option("--experimental-sqlite", "Use SQLite database instead of JSONL files", false)
.option("--db <path>", "Path to SQLite database (implies --experimental-sqlite)")
```

#### Task 2.2: Create provider factory
Create `src/lib/opencode-data-provider.ts`:

```typescript
import * as jsonl from "./opencode-data"
import * as sqlite from "./opencode-data-sqlite"

export type StorageBackend = "jsonl" | "sqlite"

export interface DataProviderOptions {
  backend: StorageBackend
  root?: string        // For JSONL
  dbPath?: string      // For SQLite
}

export function createProvider(options: DataProviderOptions) {
  if (options.backend === "sqlite") {
    return {
      loadProjectRecords: () => sqlite.loadProjectRecordsSqlite({ db: options.dbPath! }),
      loadSessionRecords: () => sqlite.loadSessionRecordsSqlite({ db: options.dbPath! }),
      // ... etc
    }
  }
  return {
    loadProjectRecords: () => jsonl.loadProjectRecords({ root: options.root }),
    // ... etc
  }
}
```

#### Task 2.3: Update command handlers
Modify each command handler to use provider:

```typescript
// Before:
const sessions = await loadSessionRecords({ root: globalOpts.root })

// After:
const provider = createProvider({
  backend: globalOpts.experimentalSqlite ? "sqlite" : "jsonl",
  root: globalOpts.root,
  dbPath: globalOpts.dbPath ?? DEFAULT_SQLITE_PATH,
})
const sessions = await provider.loadSessionRecords()
```

### Phase 3: Full Feature Parity

#### Task 3.1: Implement read operations
Priority order (most used first):
1. `loadProjectRecords` - list projects
2. `loadSessionRecords` - list sessions  
3. `loadSessionChatIndex` - list messages in session
4. `loadMessageParts` - get message content
5. Token computation functions

#### Task 3.2: Implement write operations
1. `deleteProjectMetadata` - delete project records
2. `deleteSessionMetadata` - delete session records
3. `updateSessionTitle` - update session title
4. `moveSession` - move session to different project
5. `copySession` - duplicate session to different project

**SQLite Specifics:**
- DELETE operations are single SQL statements (much faster than file deletion)
- UPDATE operations modify `data` JSON and `updated_at` column
- COPY operations INSERT new rows with new IDs

#### Task 3.3: Implement search operations
- `searchSessionsChat` - full-text search across chat content
- Consider using SQLite FTS5 for better performance (future enhancement)
- Initial implementation: query all messages, filter in JS (matches JSONL behavior)

### Phase 4: Testing & Validation

#### Task 4.1: Unit tests for SQLite module
Create `tests/lib/opencode-data-sqlite.test.ts`:
- Test against fixture DB or in-memory SQLite
- Verify output matches JSONL functions for same data

#### Task 4.2: Integration tests
- Test CLI with `--experimental-sqlite` flag
- Compare output between JSONL and SQLite backends
- Test error handling (missing DB, corrupt data, etc.)

#### Task 4.3: Performance comparison
- Benchmark list operations (projects, sessions, messages)
- Benchmark search operations
- Document performance differences

### Phase 5: Documentation & Polish

#### Task 5.1: Update README
- Document `--experimental-sqlite` flag
- Explain when to use SQLite vs JSONL
- Add troubleshooting section

#### Task 5.2: Add CLI help text
- Clear description of experimental nature
- Warning about potential data format changes

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `src/lib/opencode-data-sqlite.ts` | NEW | SQLite data provider implementation |
| `src/lib/opencode-data-provider.ts` | NEW | Provider abstraction + factory |
| `src/cli/index.ts` | MODIFY | Add `--experimental-sqlite` and `--db` flags |
| `src/cli/commands/projects.ts` | MODIFY | Use provider pattern |
| `src/cli/commands/sessions.ts` | MODIFY | Use provider pattern |
| `src/cli/commands/chat.ts` | MODIFY | Use provider pattern |
| `src/cli/commands/tokens.ts` | MODIFY | Use provider pattern |
| `tests/lib/opencode-data-sqlite.test.ts` | NEW | SQLite module tests |
| `README.md` | MODIFY | Document experimental flag |

## Risks & Considerations

1. **Database Locking**: SQLite may be locked by running OpenCode instance
   - Mitigation: Open DB in read-only mode by default, warn user on lock

2. **Schema Changes**: OpenCode may change SQLite schema
   - Mitigation: Version detection, graceful degradation

3. **Data Consistency**: JSONL and SQLite may drift out of sync
   - Mitigation: Document that SQLite is experimental, not primary source

4. **Performance**: 2GB DB may have different perf characteristics than files
   - Mitigation: Benchmark, optimize queries, consider indexes

## Success Criteria

- [ ] `opencode-manager projects list --experimental-sqlite` lists all 42 projects
- [ ] `opencode-manager sessions list --experimental-sqlite` lists sessions with correct metadata
- [ ] `opencode-manager chat list --session X --experimental-sqlite` shows messages
- [ ] All existing tests pass (JSONL path unchanged)
- [ ] New SQLite tests pass
- [ ] No breaking changes to default (JSONL) behavior

## Timeline Estimate

- Phase 1: 2-3 hours (foundation)
- Phase 2: 2-3 hours (CLI integration)  
- Phase 3: 4-6 hours (full feature parity)
- Phase 4: 2-3 hours (testing)
- Phase 5: 1-2 hours (documentation)

**Total: ~12-17 hours**

## Next Steps

1. Start with Phase 1.2 - create basic SQLite read operations
2. Verify data parsing matches JSONL output
3. Incrementally add features, testing each
