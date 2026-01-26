# SQLite Support Implementation Backlog

Implementation backlog for adding experimental SQLite support to oc-manager.
Reference: `CONTEXT/PLAN-sqlite-support.md`

---

## Phase 1: Foundation

### 1.1 Verify bun:sqlite Support
- [ ] Create test file to verify `import { Database } from "bun:sqlite"` works
- [ ] Run `bun test` to confirm bun:sqlite is available in test environment
- [ ] Delete test file after verification

### 1.2 Create SQLite Module Skeleton
- [ ] Create `src/lib/opencode-data-sqlite.ts` with module exports
- [ ] Define `SqliteLoadOptions` interface with `db: Database | string`
- [ ] Define `DEFAULT_SQLITE_PATH` constant (`~/.local/share/opencode/opencode.db`)
- [ ] Add helper function `openDatabase(pathOrDb: Database | string): Database`
- [ ] Add helper function `closeIfOwned(db: Database, pathOrDb: Database | string): void`
- [ ] Unit test: `openDatabase` opens DB from path string
- [ ] Unit test: `openDatabase` returns existing Database instance unchanged
- [ ] Unit test: `openDatabase` throws clear error for missing file

### 1.3 Implement Project Loading from SQLite
- [ ] Add `loadProjectRecordsSqlite(options: SqliteLoadOptions): Promise<ProjectRecord[]>`
- [ ] Query `SELECT id, data FROM project`
- [ ] Parse JSON from `data` column into project fields
- [ ] Map SQLite row to `ProjectRecord` type matching JSONL output
- [ ] Handle null/missing fields gracefully with defaults
- [ ] Unit test: `loadProjectRecordsSqlite` returns empty array for empty DB
- [ ] Unit test: `loadProjectRecordsSqlite` parses single project correctly
- [ ] Unit test: `loadProjectRecordsSqlite` parses multiple projects
- [ ] Unit test: `loadProjectRecordsSqlite` handles malformed JSON in data column
- [ ] Integration test: compare SQLite output with JSONL output for same project

### 1.4 Implement Session Loading from SQLite
- [ ] Add `loadSessionRecordsSqlite(options: SqliteLoadOptions): Promise<SessionRecord[]>`
- [ ] Query `SELECT id, project_id, parent_id, created_at, updated_at, data FROM session`
- [ ] Parse JSON from `data` column into session fields
- [ ] Use `created_at`/`updated_at` columns (epoch ms) for timestamps
- [ ] Map SQLite row to `SessionRecord` type matching JSONL output
- [ ] Handle null parent_id for root sessions
- [ ] Unit test: `loadSessionRecordsSqlite` returns empty array for empty DB
- [ ] Unit test: `loadSessionRecordsSqlite` parses single session correctly
- [ ] Unit test: `loadSessionRecordsSqlite` parses session with parent_id
- [ ] Unit test: `loadSessionRecordsSqlite` handles timestamps correctly
- [ ] Unit test: `loadSessionRecordsSqlite` handles malformed JSON in data column
- [ ] Integration test: compare SQLite output with JSONL output for same session

### 1.5 Implement Message Loading from SQLite
- [ ] Add `loadSessionChatIndexSqlite(sessionId: string, db: Database): Promise<ChatMessage[]>`
- [ ] Query `SELECT id, session_id, created_at, data FROM message WHERE session_id = ?`
- [ ] Order by `created_at ASC`
- [ ] Parse JSON from `data` column into message fields
- [ ] Map SQLite row to `ChatMessage` type matching JSONL output
- [ ] Unit test: `loadSessionChatIndexSqlite` returns empty array for unknown session
- [ ] Unit test: `loadSessionChatIndexSqlite` parses single message correctly
- [ ] Unit test: `loadSessionChatIndexSqlite` returns messages in chronological order
- [ ] Unit test: `loadSessionChatIndexSqlite` handles malformed JSON
- [ ] Integration test: compare SQLite output with JSONL output for same session

### 1.6 Implement Part Loading from SQLite
- [ ] Add `loadMessagePartsSqlite(messageId: string, db: Database): Promise<ChatPart[]>`
- [ ] Query `SELECT id, message_id, session_id, data FROM part WHERE message_id = ?`
- [ ] Parse JSON from `data` column into part fields
- [ ] Map SQLite row to `ChatPart` type matching JSONL output
- [ ] Unit test: `loadMessagePartsSqlite` returns empty array for unknown message
- [ ] Unit test: `loadMessagePartsSqlite` parses single part correctly
- [ ] Unit test: `loadMessagePartsSqlite` parses multiple parts
- [ ] Unit test: `loadMessagePartsSqlite` handles malformed JSON
- [ ] Integration test: compare SQLite output with JSONL output for same message

### 1.7 Create Test Fixtures
- [ ] Create `tests/fixtures/` directory if not exists
- [ ] Create `tests/fixtures/test.db` with sample schema
- [ ] Insert 2-3 test projects into fixture DB
- [ ] Insert 5-10 test sessions into fixture DB
- [ ] Insert 10-20 test messages into fixture DB
- [ ] Insert 20-40 test parts into fixture DB
- [ ] Document fixture data in `tests/fixtures/README.md`

---

## Phase 2: CLI Integration

### 2.1 Add CLI Flags
- [ ] Add `experimentalSqlite: boolean` to `GlobalOptions` interface in `src/cli/index.ts`
- [ ] Add `dbPath?: string` to `GlobalOptions` interface
- [ ] Add `.option("--experimental-sqlite", "Use SQLite database instead of JSONL files", false)`
- [ ] Add `.option("--db <path>", "Path to SQLite database (implies --experimental-sqlite)")`
- [ ] Set `experimentalSqlite = true` when `--db` is provided
- [ ] Unit test: `--experimental-sqlite` flag is parsed correctly
- [ ] Unit test: `--db /path/to/db` sets both dbPath and experimentalSqlite
- [ ] Unit test: `--db` without path shows error
- [ ] Regression test: existing commands work without new flags

### 2.2 Create Provider Interface
- [ ] Create `src/lib/opencode-data-provider.ts`
- [ ] Define `StorageBackend = "jsonl" | "sqlite"` type
- [ ] Define `DataProviderOptions` interface
- [ ] Define `DataProvider` interface with all data operation signatures
- [ ] Unit test: `DataProvider` interface matches JSONL function signatures

### 2.3 Implement Provider Factory
- [ ] Add `createProvider(options: DataProviderOptions): DataProvider` function
- [ ] Implement JSONL provider branch (wraps existing functions)
- [ ] Implement SQLite provider branch (wraps new SQLite functions)
- [ ] Add validation for required options (root for JSONL, dbPath for SQLite)
- [ ] Unit test: `createProvider` returns JSONL provider by default
- [ ] Unit test: `createProvider` returns SQLite provider when backend="sqlite"
- [ ] Unit test: `createProvider` throws on missing dbPath for SQLite
- [ ] Unit test: `createProvider` throws on missing root for JSONL

### 2.4 Update Projects Command
- [ ] Import `createProvider` in `src/cli/commands/projects.ts`
- [ ] Create provider from global options at command start
- [ ] Replace `loadProjectRecords()` call with `provider.loadProjectRecords()`
- [ ] Pass provider to any helper functions that need data access
- [ ] Regression test: `projects list` works with JSONL (default)
- [ ] Integration test: `projects list --experimental-sqlite` works
- [ ] Integration test: `projects list --db /path/to/test.db` works

### 2.5 Update Sessions Command
- [ ] Import `createProvider` in `src/cli/commands/sessions.ts`
- [ ] Create provider from global options at command start
- [ ] Replace `loadSessionRecords()` call with `provider.loadSessionRecords()`
- [ ] Replace `loadProjectRecords()` call with `provider.loadProjectRecords()`
- [ ] Pass provider to any helper functions that need data access
- [ ] Regression test: `sessions list` works with JSONL (default)
- [ ] Integration test: `sessions list --experimental-sqlite` works
- [ ] Integration test: `sessions list --project X --experimental-sqlite` works

### 2.6 Update Chat Command
- [ ] Import `createProvider` in `src/cli/commands/chat.ts`
- [ ] Create provider from global options at command start
- [ ] Replace `loadSessionChatIndex()` call with `provider.loadSessionChatIndex()`
- [ ] Replace `loadMessageParts()` call with `provider.loadMessageParts()`
- [ ] Pass provider to any helper functions that need data access
- [ ] Regression test: `chat list` works with JSONL (default)
- [ ] Integration test: `chat list --session X --experimental-sqlite` works
- [ ] Integration test: `chat show --message X --experimental-sqlite` works

### 2.7 Update Tokens Command
- [ ] Import `createProvider` in `src/cli/commands/tokens.ts`
- [ ] Create provider from global options at command start
- [ ] Replace data loading calls with provider methods
- [ ] Pass provider to token computation functions
- [ ] Regression test: `tokens` commands work with JSONL (default)
- [ ] Integration test: `tokens --experimental-sqlite` works

---

## Phase 3: Write Operations

### 3.1 Implement Delete Session (SQLite)
- [ ] Add `deleteSessionMetadataSqlite(sessionIds: string[], db: Database): Promise<DeleteResult>`
- [ ] Delete from `part` table where session_id IN (...)
- [ ] Delete from `message` table where session_id IN (...)
- [ ] Delete from `session` table where id IN (...)
- [ ] Use transaction for atomicity
- [ ] Return count of deleted rows
- [ ] Unit test: `deleteSessionMetadataSqlite` deletes session and related data
- [ ] Unit test: `deleteSessionMetadataSqlite` handles non-existent session
- [ ] Unit test: `deleteSessionMetadataSqlite` rolls back on error
- [ ] Integration test: `sessions delete --session X --experimental-sqlite` works

### 3.2 Implement Delete Project (SQLite)
- [ ] Add `deleteProjectMetadataSqlite(projectIds: string[], db: Database): Promise<DeleteResult>`
- [ ] Get all session IDs for projects
- [ ] Delete related parts, messages, sessions (reuse deleteSessionMetadataSqlite)
- [ ] Delete from `project` table where id IN (...)
- [ ] Use transaction for atomicity
- [ ] Return count of deleted rows
- [ ] Unit test: `deleteProjectMetadataSqlite` deletes project and all related data
- [ ] Unit test: `deleteProjectMetadataSqlite` handles non-existent project
- [ ] Unit test: `deleteProjectMetadataSqlite` rolls back on error
- [ ] Integration test: `projects delete --project X --experimental-sqlite` works

### 3.3 Implement Update Session Title (SQLite)
- [ ] Add `updateSessionTitleSqlite(sessionId: string, title: string, db: Database): Promise<void>`
- [ ] Load existing `data` JSON from session row
- [ ] Update title field in parsed JSON
- [ ] Update `data` column and `updated_at` timestamp
- [ ] Unit test: `updateSessionTitleSqlite` updates title correctly
- [ ] Unit test: `updateSessionTitleSqlite` updates timestamp
- [ ] Unit test: `updateSessionTitleSqlite` handles non-existent session
- [ ] Integration test: `sessions rename --session X --experimental-sqlite` works

### 3.4 Implement Move Session (SQLite)
- [ ] Add `moveSessionSqlite(sessionId: string, targetProjectId: string, db: Database): Promise<SessionRecord>`
- [ ] Update `project_id` column in session row
- [ ] Update `data` JSON with new project_id
- [ ] Update `updated_at` timestamp
- [ ] Return updated session record
- [ ] Unit test: `moveSessionSqlite` moves session to new project
- [ ] Unit test: `moveSessionSqlite` updates all relevant fields
- [ ] Unit test: `moveSessionSqlite` handles non-existent session
- [ ] Unit test: `moveSessionSqlite` handles non-existent target project
- [ ] Integration test: `sessions move --session X --to-project Y --experimental-sqlite` works

### 3.5 Implement Copy Session (SQLite)
- [ ] Add `copySessionSqlite(sessionId: string, targetProjectId: string, db: Database): Promise<SessionRecord>`
- [ ] Generate new session ID (UUID)
- [ ] Copy session row with new ID and target project_id
- [ ] Copy all messages with new IDs, pointing to new session
- [ ] Copy all parts with new IDs, pointing to new messages
- [ ] Use transaction for atomicity
- [ ] Return new session record
- [ ] Unit test: `copySessionSqlite` creates new session in target project
- [ ] Unit test: `copySessionSqlite` copies all messages and parts
- [ ] Unit test: `copySessionSqlite` generates unique IDs
- [ ] Unit test: `copySessionSqlite` handles non-existent session
- [ ] Unit test: `copySessionSqlite` rolls back on error
- [ ] Integration test: `sessions copy --session X --to-project Y --experimental-sqlite` works

### 3.6 Add Write Operations to Provider
- [ ] Add `deleteSessionMetadata` to `DataProvider` interface
- [ ] Add `deleteProjectMetadata` to `DataProvider` interface
- [ ] Add `updateSessionTitle` to `DataProvider` interface
- [ ] Add `moveSession` to `DataProvider` interface
- [ ] Add `copySession` to `DataProvider` interface
- [ ] Update JSONL provider to expose existing functions
- [ ] Update SQLite provider to expose new SQLite functions
- [ ] Unit test: provider interface includes all write operations

---

## Phase 4: Search Operations

### 4.1 Implement Chat Search (SQLite)
- [ ] Add `searchSessionsChatSqlite(sessionIds: string[], query: string, db: Database, options?): Promise<ChatSearchResult[]>`
- [ ] Query messages for given sessions
- [ ] Load parts for each message
- [ ] Filter parts containing query string (case-insensitive)
- [ ] Build search results with context
- [ ] Unit test: `searchSessionsChatSqlite` finds matching messages
- [ ] Unit test: `searchSessionsChatSqlite` returns empty for no matches
- [ ] Unit test: `searchSessionsChatSqlite` is case-insensitive
- [ ] Unit test: `searchSessionsChatSqlite` respects session filter
- [ ] Integration test: `chat search --query X --experimental-sqlite` works

### 4.2 Implement Token Computation (SQLite)
- [ ] Add `computeSessionTokenSummarySqlite(sessionId: string, db: Database): Promise<TokenSummary>`
- [ ] Load messages and parts for session
- [ ] Extract token counts from part data
- [ ] Aggregate into summary
- [ ] Add `computeProjectTokenSummarySqlite` function
- [ ] Add `computeGlobalTokenSummarySqlite` function
- [ ] Unit test: `computeSessionTokenSummarySqlite` calculates correctly
- [ ] Unit test: `computeProjectTokenSummarySqlite` aggregates sessions
- [ ] Unit test: `computeGlobalTokenSummarySqlite` aggregates all
- [ ] Integration test: `tokens session --session X --experimental-sqlite` works

### 4.3 Add Search/Token Operations to Provider
- [ ] Add `searchSessionsChat` to `DataProvider` interface
- [ ] Add `computeSessionTokenSummary` to `DataProvider` interface
- [ ] Add `computeProjectTokenSummary` to `DataProvider` interface
- [ ] Add `computeGlobalTokenSummary` to `DataProvider` interface
- [ ] Update JSONL provider implementation
- [ ] Update SQLite provider implementation
- [ ] Unit test: provider interface includes search operations
- [ ] Unit test: provider interface includes token operations

---

## Phase 5: Error Handling & Edge Cases

### 5.1 Database Locking
- [ ] Add `openDatabaseReadOnly(path: string): Database` helper
- [ ] Open DB with `readonly: true` mode by default for read operations
- [ ] Detect SQLITE_BUSY error and provide helpful message
- [ ] Add `--force-write` flag for write operations that need exclusive access
- [ ] Unit test: read operations work with readonly mode
- [ ] Unit test: write operations fail gracefully when DB is locked
- [ ] Unit test: helpful error message shown on SQLITE_BUSY

### 5.2 Schema Validation
- [ ] Add `validateSchema(db: Database): boolean` function
- [ ] Check for required tables (project, session, message, part)
- [ ] Check for required columns in each table
- [ ] Warn on missing tables/columns instead of crashing
- [ ] Unit test: `validateSchema` returns true for valid schema
- [ ] Unit test: `validateSchema` returns false for missing table
- [ ] Unit test: `validateSchema` returns false for missing column
- [ ] Integration test: helpful error when schema is invalid

### 5.3 Graceful Degradation
- [ ] Add `--sqlite-strict` flag to fail on any SQLite error
- [ ] Default behavior: warn and continue when possible
- [ ] Log warnings for malformed data but continue processing
- [ ] Return partial results with warning when some rows fail
- [ ] Unit test: malformed JSON logs warning but continues
- [ ] Unit test: strict mode fails on malformed JSON
- [ ] Integration test: partial results returned with warning

---

## Phase 6: Testing & Validation

### 6.1 Full Regression Test Suite
- [ ] Run all existing tests: `bun test`
- [ ] Verify no test failures
- [ ] Verify no new warnings
- [ ] Document any test changes needed

### 6.2 JSONL vs SQLite Comparison Tests
- [ ] Create test that loads same data from both backends
- [ ] Compare `loadProjectRecords` output field-by-field
- [ ] Compare `loadSessionRecords` output field-by-field
- [ ] Compare `loadSessionChatIndex` output field-by-field
- [ ] Compare `loadMessageParts` output field-by-field
- [ ] Compare `searchSessionsChat` output field-by-field
- [ ] Compare token computation output field-by-field
- [ ] Document any expected differences

### 6.3 CLI Integration Tests
- [ ] Test `projects list --experimental-sqlite` output format
- [ ] Test `projects list --db /path/to/db` output format
- [ ] Test `sessions list --experimental-sqlite` output format
- [ ] Test `chat list --experimental-sqlite` output format
- [ ] Test `chat search --experimental-sqlite` output format
- [ ] Test error messages for missing DB file
- [ ] Test error messages for invalid DB file
- [ ] Test error messages for locked DB

### 6.4 Performance Benchmarks
- [ ] Create benchmark script `scripts/benchmark-sqlite.ts`
- [ ] Benchmark `loadProjectRecords` (JSONL vs SQLite)
- [ ] Benchmark `loadSessionRecords` (JSONL vs SQLite)
- [ ] Benchmark `loadSessionChatIndex` (JSONL vs SQLite)
- [ ] Benchmark `searchSessionsChat` (JSONL vs SQLite)
- [ ] Document results in `CONTEXT/BENCHMARK-sqlite.md`
- [ ] Note any significant performance differences

---

## Phase 7: Documentation

### 7.1 Update README
- [ ] Add "Experimental SQLite Support" section
- [ ] Document `--experimental-sqlite` flag usage
- [ ] Document `--db <path>` flag usage
- [ ] Explain when to use SQLite vs JSONL
- [ ] Add example commands with SQLite
- [ ] Document known limitations

### 7.2 CLI Help Text
- [ ] Update `--experimental-sqlite` help text with warning
- [ ] Update `--db` help text with default path info
- [ ] Add examples to help output
- [ ] Test help output renders correctly

### 7.3 Developer Documentation
- [ ] Document provider pattern in code comments
- [ ] Document how to add new storage backends
- [ ] Document SQLite schema assumptions
- [ ] Update CONTRIBUTING.md if exists

---

## Success Criteria Verification

- [ ] `oc-manager projects list --experimental-sqlite` lists projects
- [ ] `oc-manager sessions list --experimental-sqlite` lists sessions
- [ ] `oc-manager chat list --session X --experimental-sqlite` shows messages
- [ ] All existing tests pass (JSONL path unchanged)
- [ ] All new SQLite tests pass
- [ ] No breaking changes to default (JSONL) behavior
- [ ] Documentation is complete and accurate
