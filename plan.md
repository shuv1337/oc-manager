# CLI Feature Parity Backlog (Chronological)

## Phase 0 - Baseline and Test Infra
- [x] Review `src/bin/opencode-manager.ts` to confirm current entrypoint behavior.
- [x] Review `src/opencode-tui.tsx` to locate `parseArgs()` and TUI boot path.
      - `parseArgs()`: lines 2111-2129, parses `--root` and `--help` flags
      - Boot path: `bootstrap()` at lines 2180-2184 calls `parseArgs()`, creates renderer via `createCliRenderer()`, renders `<App root={root} />`
      - Uses `@opentui/core` + `@opentui/react` for TUI framework
      - Fuzzy search: `fast-fuzzy` Searcher class (line 47, used at line 594)
      - Clipboard: `copyToClipboard()` at lines 141-151 uses `pbcopy`/`xclip`
- [x] Review `src/lib/opencode-data.ts` to list required data APIs for CLI parity.
      - **Types**: ProjectState, TokenBreakdown, TokenSummary, AggregateTokenSummary, PartType, ChatPart, ChatRole, ChatMessage, ProjectRecord, SessionRecord, LoadOptions, SessionLoadOptions, DeleteOptions, DeleteResult, BatchOperationResult, ChatSearchResult
      - **Project APIs**: `loadProjectRecords()`, `deleteProjectMetadata()`, `filterProjectsByState()`, `filterProjectsByIds()`, `filterProjectsByIndexes()`, `describeProject()`
      - **Session APIs**: `loadSessionRecords()`, `deleteSessionMetadata()`, `filterSessionsByIndexes()`, `updateSessionTitle()`, `copySession()`, `moveSession()`, `copySessions()`, `moveSessions()`, `describeSession()`
      - **Token APIs**: `computeSessionTokenSummary()`, `computeProjectTokenSummary()`, `computeGlobalTokenSummary()`, `clearTokenCache()`
      - **Chat APIs**: `loadSessionChatIndex()`, `loadMessageParts()`, `hydrateChatMessageParts()`, `searchSessionsChat()`
      - **Utilities**: `formatDisplayPath()`, `formatDate()`, `ensureDirectory()`, `loadSessionMessagePaths()`, `loadMessagePartPaths()`
      - **Constants**: `DEFAULT_ROOT`
- [x] Locate TUI fuzzy search usage and identify exact extraction boundaries.
      - **Import**: Line 47 - `import { Searcher } from "fast-fuzzy"`
      - **Usage in SessionsPanel** (lines 578-638):
        - `searchCandidates` memo (lines 579-591): builds array of `{session, searchText, updatedMs, createdMs}`
        - `searcher` memo (lines 594-598): instantiates `Searcher` with `keySelector: (c) => c.searchText`
        - `visibleRecords` memo (lines 600-638): calls `searcher.search(q, { returnMatchData: true })`, sorts by score/time/id
      - **Note**: ProjectsPanel (lines 276-285) uses simple tokenized substring matching, NOT fast-fuzzy
      - **Extraction target**: lines 578-638 contain the core fuzzy search logic for sessions
- [x] Locate TUI clipboard usage and identify exact extraction boundaries.
      - **Function**: `copyToClipboard(text: string): void` at lines 141-151
      - **Import**: `exec` from `node:child_process` (line 14)
      - **Logic**: Uses `pbcopy` on macOS, `xclip -selection clipboard` on Linux
      - **Usages**:
        - Line 915: Copy session ID to clipboard (`y` key in SessionsPanel)
        - Line 1644: Copy message content to clipboard (`Y` key in ChatPanel)
      - **Extraction target**: lines 141-151 (self-contained function, no external deps beyond `exec`)
- [x] Create `tests/` directory at repo root.
- [x] Create `tests/fixtures/` directory for metadata stores.
- [x] Design a minimal fixture store layout matching the on-disk schema.
- [x] Add fixture project metadata for at least two projects (one missing).
- [x] Add fixture session metadata for at least two sessions with distinct titles.
- [x] Add fixture chat message data covering text/tool/subtask parts.
- [x] Add a small test helper to resolve fixture root paths.
- [x] Add `"test": "bun test"` script to `package.json`.
- [x] Add `tests/lib/opencode-data.test.ts` to verify `loadProjectRecords` with fixtures.
- [x] Add assertion for missing project detection in `tests/lib/opencode-data.test.ts`.
- [x] Run `bun test` and fix any fixture or path issues.

## Phase 1 - TUI Refactor and CLI Skeleton
- [x] Create `src/tui/index.ts` exporting `launchTUI(args)`.
      - Created `src/tui/index.tsx` with `launchTUI()`, `parseArgs()`, `printUsage()`, and `bootstrap()` exports
      - Added `export` to `App` component in `src/opencode-tui.tsx` to allow import from tui module
      - Uses `.tsx` extension for JSX support
- [x] Move `src/opencode-tui.tsx` to `src/tui/app.tsx`.
      - Moved file and updated imports in `src/tui/index.tsx`, `src/bin/opencode-manager.ts`
      - Updated import path in app.tsx from `./lib/opencode-data` to `../lib/opencode-data`
      - Updated `package.json` scripts to point to new location
- [x] Update all imports to use `src/tui/app.tsx` path.
      - Code imports already updated in prior task
      - Updated documentation: README.md, PROJECT-SUMMARY.md, manage_opencode_projects.py
- [x] Extract `parseArgs()` into `src/tui/args.ts` (or inline in `launchTUI`).
      - Created `src/tui/args.ts` with `parseArgs()`, `printUsage()`, and `TUIOptions` type
      - Updated `src/tui/index.tsx` to import from `args.ts` and re-export for external consumers
      - Removed duplicate parseArgs/printUsage/bootstrap from `src/tui/app.tsx`
      - Cleaned up unused imports in `app.tsx` (createRoot, createCliRenderer, resolve, DEFAULT_ROOT)
      - Updated `src/bin/opencode-manager.ts` to import from `index` instead of `app`
      - Updated package.json scripts to use `src/tui/index.tsx` as entry point
- [x] Update `launchTUI` to call `parseArgs()` and pass options to TUI.
      - Already implemented: `bootstrap()` calls `parseArgs()` and passes result to `launchTUI(options)`
      - `launchTUI()` accepts `Partial<TUIOptions>` and uses `options?.root ?? DEFAULT_ROOT`
- [x] Ensure `bun run tui` uses the new TUI entrypoint.
      - Already configured: `package.json` has `"tui": "bun src/tui/index.tsx"`
      - Verified `bun run tui --help` works and displays usage/keybindings
- [x] Update `src/bin/opencode-manager.ts` to route CLI vs TUI via dynamic imports.
      - Routes based on first argument: CLI subcommands (projects, sessions, chat, tokens) vs TUI
      - Uses dynamic imports for lazy loading of CLI/TUI modules
      - CLI subcommands show "not implemented" until CLI module is created
      - "tui" subcommand strips itself before passing args to TUI bootstrap
- [x] Confirm TUI default path triggers when no subcommand is provided.
      - Verified: `bun src/bin/opencode-manager.ts` (no args) launches TUI
      - Verified: `bun src/bin/opencode-manager.ts --help` shows TUI help
      - Verified: `bun src/bin/opencode-manager.ts --root /tmp/test` launches TUI with custom root
- [x] Add `commander@^12.0.0` to `package.json` dependencies.
- [x] Create `src/cli/index.ts` with Commander program and `runCLI(args)`.
      - Created CLI module with global options (--root, --format, --limit, --sort, --yes, --dry-run, --quiet, --clipboard, --backup-dir)
      - Added placeholder subcommands for projects, sessions, chat, tokens
      - Added `tui` subcommand to launch TUI from CLI
      - Exports `runCLI(args)`, `GlobalOptions`, `parseGlobalOptions()`
- [x] Wire CLI global options (`--root`, `--format`, `--limit`, `--sort`, `--yes`, `--dry-run`, `--quiet`, `--clipboard`, `--backup-dir`).
      - Added `collectOptions()` helper to traverse parent commands and merge options
      - Updated all subcommand actions to use `function (this: Command)` pattern
      - Each action calls `parseGlobalOptions(collectOptions(this))` to get typed options
      - Updated TUI subcommand to use `launchTUI({ root })` directly instead of bootstrap
- [x] Create `src/cli/commands/projects.ts` with placeholder subcommands.
      - Created `src/cli/commands/projects.ts` with `registerProjectsCommands()` function
      - Added `ProjectsListOptions` (--missing-only, --search) and `ProjectsDeleteOptions` (--id) interfaces
      - Updated `src/cli/index.ts` to import and use the new module
      - Moved projects subcommands from inline definitions to separate file
- [x] Create `src/cli/commands/sessions.ts` with placeholder subcommands.
      - Created `src/cli/commands/sessions.ts` with `registerSessionsCommands()` function
      - Added interfaces: `SessionsListOptions` (--project, --search), `SessionsDeleteOptions` (--session),
        `SessionsRenameOptions` (--session, --title), `SessionsMoveOptions` (--session, --to),
        `SessionsCopyOptions` (--session, --to)
      - Updated `src/cli/index.ts` to import and use the new module
      - Moved sessions subcommands from inline definitions to separate file
- [x] Create `src/cli/commands/chat.ts` with placeholder subcommands.
      - Created `src/cli/commands/chat.ts` with `registerChatCommands()` function
      - Added interfaces: `ChatListOptions` (--session, --include-parts), `ChatShowOptions` (--session, --message, --index),
        `ChatSearchOptions` (--query, --project)
      - Updated `src/cli/index.ts` to import and use the new module
      - Moved chat subcommands from inline definitions to separate file
- [x] Create `src/cli/commands/tokens.ts` with placeholder subcommands.
      - Created `src/cli/commands/tokens.ts` with `registerTokensCommands()` function
      - Added interfaces: `TokensSessionOptions` (--session), `TokensProjectOptions` (--project)
      - Updated `src/cli/index.ts` to import and use the new module
      - Moved tokens subcommands from inline definitions to separate file
- [x] Create `src/cli/commands/tui.ts` to launch TUI from CLI.
      - Created `src/cli/commands/tui.ts` with `registerTUICommand()` function
      - Updated `src/cli/index.ts` to import and use the new module
      - Moved inline TUI subcommand definition to separate file following existing pattern
- [x] Register all command modules from `src/cli/index.ts`.
      - All 5 modules (projects, sessions, chat, tokens, tui) imported and registered
      - Verified via `--help` output for each subcommand
- [x] Create `src/lib/clipboard.ts` and move TUI clipboard helper into it.
      - Created `src/lib/clipboard.ts` with `copyToClipboard()` (Promise-based) and `copyToClipboardSync()` (fire-and-forget)
      - Uses `pbcopy` on macOS, `xclip -selection clipboard` on Linux
- [x] Update TUI code to call `src/lib/clipboard.ts`.
      - Updated `src/tui/app.tsx` to import `copyToClipboardSync` from `../lib/clipboard`
      - Removed inline `copyToClipboard` function from app.tsx
      - Removed `exec` import from `node:child_process` (no longer needed)
- [x] Update `manage_opencode_projects.py` to detect CLI subcommands and route.
      - Refactored to shell out to `src/bin/opencode-manager.ts` which handles all routing
      - Detects CLI subcommands (projects, sessions, chat, tokens) vs TUI mode
      - Preserved --bun option for specifying custom bun path
      - Removed argparse in favor of simple arg parsing (wrapper only needs --bun)
- [x] Add a minimal CLI smoke test (help output) to ensure CLI boots.
      - Created `tests/cli/index.test.ts` with 8 smoke tests
      - Tests verify help output for projects, sessions, chat, tokens subcommands
      - Tests verify nested subcommand help (projects list, sessions list, chat show, tokens session)

## Phase 2 - Output Formatting and Read-Only Commands
- [x] Create `src/cli/formatters/json.ts` with standard JSON output helpers.
      - Created formatter with `formatJson()`, `formatJsonArray()` for basic output
      - Added response envelope helpers: `formatJsonSuccess()`, `formatJsonArraySuccess()`, `formatJsonError()`
      - Includes `JsonResponse<T>` type with ok/data/error/meta structure
      - Auto-detects TTY for pretty printing, handles Date serialization to ISO strings
      - Added corresponding `print*` functions for stdout output
      - Added tests in `tests/cli/formatters/json.test.ts` (20 tests)
- [x] Create `src/cli/formatters/ndjson.ts` for streaming record arrays.
      - Created formatter with `formatNdjsonLine()`, `formatNdjson()`, `streamNdjson()` for streaming
      - Added `printNdjson()` and `streamPrintNdjson()` for stdout output
      - Handles Date serialization to ISO strings (matching JSON formatter)
      - Added tests in `tests/cli/formatters/ndjson.test.ts` (14 tests)
- [x] Create `src/cli/formatters/table.ts` with column definitions for `projects list`.
      - Created table formatter with `truncate()`, `pad()`, `formatCell()`, `formatRow()`, `formatTable()` utilities
      - Added `ColumnDefinition<T>` type with header, width, align, accessor, format properties
      - Added `projectListColumns` and `projectListColumnsCompact` column definitions for projects
      - Added `formatProjectsTable()` and `printProjectsTable()` convenience functions
      - Added `formatDateForTable()` and `formatProjectState()` helper formatters
      - Added comprehensive tests in `tests/cli/formatters/table.test.ts` (44 tests)
- [x] Extend table formatter for `sessions list` columns and truncation.
      - Added `sessionListColumns` (6 columns: #, Title, SessionID, ProjectID, Updated, Created)
      - Added `sessionListColumnsCompact` (4 columns: #, Title, SessionID, Updated)
      - Added `formatSessionsTable()` and `printSessionsTable()` convenience functions
      - Added comprehensive tests (18 new tests across 3 describe blocks)
- [x] Extend table formatter for `chat list` columns and truncation.
      - Added `formatChatRole()` and `formatTokenCount()` helper formatters
      - Added `chatListColumns` (6 columns: #, Role, MessageID, Preview, Tokens, Created)
      - Added `chatListColumnsCompact` (4 columns: #, R, Preview, Tokens)
      - Added `formatChatTable()` and `printChatTable()` convenience functions
      - Added comprehensive tests (26 new tests across 5 describe blocks)
- [x] Extend table formatter for `tokens` summary formatting.
      - Added `TokenBreakdownRow` type for token table rows
      - Added `tokenBreakdownToRows()` to convert TokenBreakdown to table rows
      - Added `formatPercentage()` and `formatLargeNumber()` helper formatters
      - Added `tokenBreakdownColumns` column definitions (Category, Tokens, %)
      - Added `formatTokenBreakdownTable()` and `printTokenBreakdownTable()`
      - Added `formatTokenSummary()` and `printTokenSummary()` for TokenSummary handling
      - Added `AggregateTokenRow` type and `formatAggregateTokenSummary()` for aggregate summaries
      - Added comprehensive tests (32 new tests across 7 describe blocks)
- [ ] Create `src/cli/output.ts` to select formatter by `--format`.
- [ ] Add shared error/exit helpers for codes 1-4 in CLI layer.
- [ ] Extract fuzzy search into `src/lib/search.ts` (use fast-fuzzy).
- [ ] Update TUI search to call `src/lib/search.ts`.
- [ ] Add tests for `src/lib/search.ts` basic ordering with fixtures.

### Projects list
- [ ] Add `projects list` options (`--missing-only`, `--search`, `--limit`, `--format`).
- [ ] Implement loading project records from `opencode-data`.
- [ ] Implement missing-only filter for projects.
- [ ] Implement project tokenized search behavior (match TUI semantics).
- [ ] Implement `--limit` cap (default 200) for projects list.
- [ ] Wire `projects list` output through `output.ts`.
- [ ] Add JSON output test for `projects list`.
- [ ] Add NDJSON output test for `projects list`.
- [ ] Add table output test for `projects list`.

### Sessions list
- [ ] Add `sessions list` options (`--project`, `--search`, `--sort`, `--limit`).
- [ ] Implement loading session records for all projects.
- [ ] Implement project filter for sessions list.
- [ ] Implement fuzzy session search using `src/lib/search.ts`.
- [ ] Implement `--sort` by updated/created for sessions list.
- [ ] Implement `--limit` cap (default 200) for sessions list.
- [ ] Wire `sessions list` output through `output.ts`.
- [ ] Add JSON output test for `sessions list`.
- [ ] Add NDJSON output test for `sessions list`.
- [ ] Add table output test for `sessions list`.
- [ ] Add test to ensure session list order matches TUI for a given search query.

### Tokens
- [ ] Add `tokens session` subcommand with `--session`.
- [ ] Add `tokens project` subcommand with `--project`.
- [ ] Add `tokens global` subcommand with no args.
- [ ] Implement session token summary using existing token helpers.
- [ ] Implement project token summary using existing token helpers.
- [ ] Implement global token summary using existing token helpers.
- [ ] Wire tokens output through `output.ts` (json/table).
- [ ] Add JSON output tests for tokens session/project/global.
- [ ] Add table output tests for tokens session/project/global.

## Phase 3 - Mutating Commands
- [ ] Add CLI helper to resolve session IDs to session records.
- [ ] Add CLI helper to resolve project IDs to project records.
- [ ] Add CLI helper to validate `--yes` for destructive operations.
- [ ] Add CLI helper to emit `--dry-run` planned changes.
- [ ] Add CLI helper to copy files to `--backup-dir` before delete.
- [ ] Add tests for ID resolution helper error cases.

### Projects delete
- [ ] Add `projects delete` options (`--id`, `--yes`, `--dry-run`, `--backup-dir`).
- [ ] Implement dry-run path listing for project deletion.
- [ ] Implement backup copy for project deletion.
- [ ] Implement deletion using opencode-data layer.
- [ ] Return exit code 2 when `--yes` is missing.
- [ ] Return exit code 3 when project id is invalid.
- [ ] Add test for `projects delete --dry-run`.
- [ ] Add test for `projects delete --backup-dir`.
- [ ] Add test for `projects delete` requires `--yes`.

### Sessions delete
- [ ] Add `sessions delete` options (`--session`, `--yes`, `--dry-run`, `--backup-dir`).
- [ ] Implement dry-run path listing for session deletion.
- [ ] Implement backup copy for session deletion.
- [ ] Implement deletion using opencode-data layer.
- [ ] Return exit code 2 when `--yes` is missing.
- [ ] Return exit code 3 when session id is invalid.
- [ ] Add test for `sessions delete --dry-run`.
- [ ] Add test for `sessions delete --backup-dir`.
- [ ] Add test for `sessions delete` requires `--yes`.

### Sessions rename
- [ ] Add `sessions rename` options (`--session`, `--title`).
- [ ] Validate non-empty title before mutation.
- [ ] Implement rename using `updateSessionTitle`.
- [ ] Return exit code 3 when session id is invalid.
- [ ] Add tests for rename success and validation failure.

### Sessions move
- [ ] Add `sessions move` options (`--session`, `--to`).
- [ ] Validate target project exists before mutation.
- [ ] Implement move using `moveSessions`.
- [ ] Return exit code 3 when session id or target project is invalid.
- [ ] Add tests for move success and invalid target.

### Sessions copy
- [ ] Add `sessions copy` options (`--session`, `--to`).
- [ ] Validate target project exists before mutation.
- [ ] Implement copy using `copySessions`.
- [ ] Return exit code 3 when session id or target project is invalid.
- [ ] Add tests for copy success and invalid target.

### Exit codes
- [ ] Add tests for usage errors returning exit code 2.
- [ ] Add tests for missing resources returning exit code 3.
- [ ] Add tests for file operation failures returning exit code 4.

## Phase 4 - Chat Commands
- [ ] Add `chat list` options (`--session`, `--include-parts`, `--format`).
- [ ] Implement chat list to return message index data only.
- [ ] Implement `--include-parts` to include parts in list output.
- [ ] Ensure chat list ordering matches TUI (createdAt ascending).
- [ ] Add tests for chat list ordering and index numbering.
- [ ] Add `chat show` options (`--session`, `--message`, `--index`, `--clipboard`).
- [ ] Implement chat show by `--message` id.
- [ ] Implement chat show by `--index` (1-based).
- [ ] Return exit code 3 when message id or index is invalid.
- [ ] Add tests for chat show by message and by index.
- [ ] Add test for chat show output includes combined full text.
- [ ] Add `chat search` options (`--query`, `--project`, `--limit`, `--format`).
- [ ] Implement chat search using `searchSessionsChat`.
- [ ] Apply project filter and limit to chat search results.
- [ ] Add tests for chat search matches and ordering.
- [ ] Add `--clipboard` support for chat show output.

## Phase 5 - Docs and Validation
- [ ] Add CLI usage section to `README.md` (commands and global flags).
- [ ] Add CLI examples for json/ndjson/table outputs to `README.md`.
- [ ] Document clipboard support limitations (Linux/macOS).
- [ ] Update `PROJECT-SUMMARY.md` with new CLI/TUI architecture.
- [ ] Add integration tests covering projects/sessions/tokens commands.
- [ ] Add integration tests covering delete/rename/move/copy with dry-run.
- [ ] Add integration tests covering chat list/show/search.
- [ ] Add integration tests verifying exit codes (2/3/4).
- [ ] Run `bun test` and ensure all tests pass.
- [ ] Verify `bunx opencode-manager` still opens TUI by default.
- [ ] Verify `bunx opencode-manager tui --help` shows TUI help text.
- [ ] Verify `manage_opencode_projects.py` routes CLI subcommands.
- [ ] Review open questions (completion, templates, json-lines alias).
- [ ] If approved, add follow-up tasks for open questions.
