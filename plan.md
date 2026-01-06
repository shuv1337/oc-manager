# Documentation Refresh Backlog

> **Status**: Active implementation backlog  
> **Created**: 2026-01-06  
> **Goal**: Align all documentation with current codebase behavior

## Source-of-Truth Priority

When documentation and code conflict, resolve using this priority:
1. Current runtime behavior (what the code actually does)
2. Code comments (inline documentation)
3. CLI/TUI help text (`.description()` strings, `printUsage()`)
4. README.md (user-facing docs)
5. PROJECT-SUMMARY.md (architecture notes)

---

## Phase 0: Decision Checkpoints

- [ ] **DECISION-001**: Should `opencode-manager --help` show CLI subcommand overview in addition to TUI keys?
  - Option A: Keep current behavior (TUI help only), document it clearly
  - Option B: Append CLI subcommand list to TUI help output
  - Option C: Change routing so root `--help` shows Commander help
- [ ] **DECISION-002**: Should `opencode-manager tui --help` show Commander help or TUI help?
  - Current: Shows TUI help (same as root `--help`)
- [ ] **DECISION-003**: Should the root Commander description (`src/cli/index.ts:79`) be updated even though it's never shown?
  - Keep for future-proofing vs remove dead code

---

## Phase 1: Audit and Gap Analysis

### 1.1 Version and Requirements Audit
- [x] Read `package.json` and note current version number
  - **Finding**: Version is `0.3.1`
- [x] Read `package.json` engines field and note Bun requirement (>=1.3.0)
  - **Finding**: `package.json:9` specifies `"bun": ">=1.3.0"`
- [x] Read `README.md` line 61 and note stated Bun version (currently says 1.1.0+)
  - **Finding**: README.md:61 states `Bun **1.1.0+**`
- [x] Document mismatch: README says "1.1.0+" but package.json requires ">=1.3.0"
  - **Finding**: Confirmed mismatch - README says "1.1.0+" but package.json:9 requires ">=1.3.0"

### 1.2 CLI Global Options Audit
- [x] Read `src/cli/index.ts` and extract all global options
  - **Finding**: 9 global options defined in `src/cli/index.ts:82-110`
- [x] List global options: `--root`, `--format`, `--limit`, `--sort`, `--yes`, `--dry-run`, `--quiet`, `--clipboard`, `--backup-dir`
  - **Finding**: All 9 options confirmed with short flags: `-r`, `-f`, `-l`, (none), `-y`, `-n`, `-q`, `-c`, (none)
- [x] Compare against README.md CLI documentation section
  - **Finding**: README.md:107-119 documents all 9 options correctly
- [x] Document any missing or outdated options in README
  - **Finding**: No discrepancies - README CLI Global Options section is accurate and complete

### 1.3 Projects Command Audit
- [x] Read `src/cli/commands/projects.ts` lines 70-130
  - **Finding**: Command definitions at lines 70-110
- [x] Extract `projects list` flags: `--missing-only`, `--search`
  - **Finding**: `--missing-only` (default: false), `-s, --search <query>` confirmed at lines 76-77
- [x] Extract `projects delete` flags: `--id`, `--yes`, `--dry-run`, `--backup-dir`
  - **Finding**: `--id <projectId>` (required), `--yes`, `--dry-run`, `--backup-dir <dir>` confirmed at lines 91-94
- [x] Compare against README.md projects section
  - **Finding**: README.md:126-127 documents both commands correctly with all flags
- [x] Document any discrepancies
  - **Finding**: No discrepancies - README accurately documents all projects command flags

### 1.4 Sessions Command Audit
- [x] Read `src/cli/commands/sessions.ts` lines 100-200
  - **Finding**: Command definitions at lines 107-198
- [x] Extract `sessions list` flags: `--project`, `--search`
  - **Finding**: `-p, --project <projectId>`, `-s, --search <query>` confirmed at lines 110-111
- [x] Extract `sessions delete` flags: `--session`, `--yes`, `--dry-run`, `--backup-dir`
  - **Finding**: `--session <sessionId>` (required), `--yes`, `--dry-run`, `--backup-dir <dir>` confirmed at lines 125-128
- [x] Extract `sessions rename` flags: `--session`, `--title`
  - **Finding**: `--session <sessionId>` (required), `-t, --title <title>` (required) confirmed at lines 148-149
- [x] Extract `sessions move` flags: `--session`, `--to`
  - **Finding**: `--session <sessionId>` (required), `--to <projectId>` (required) confirmed at lines 166-167
- [x] Extract `sessions copy` flags: `--session`, `--to`
  - **Finding**: `--session <sessionId>` (required), `--to <projectId>` (required) confirmed at lines 184-185
- [x] Compare against README.md sessions section
  - **Finding**: README.md:128-133 documents all commands correctly with all flags
- [x] Document any discrepancies
  - **Finding**: No discrepancies - README accurately documents all sessions command flags

### 1.5 Chat Command Audit
- [x] Read `src/cli/commands/chat.ts` lines 80-150
  - **Finding**: Command definitions at lines 86-143
- [x] Extract `chat list` flags: `--session`, `--include-parts`
  - **Finding**: `--session <sessionId>` (required), `--include-parts` (default: false) confirmed at lines 89-90
- [x] Extract `chat show` flags: `--session`, `--message`, `--index`, uses global `--clipboard`
  - **Finding**: `--session <sessionId>` (required), `-m, --message <messageId>`, `-i, --index <number>`, uses global `--clipboard` confirmed at lines 107-119
- [x] Extract `chat search` flags: `--query`, `--project`
  - **Finding**: `-q, --query <query>` (required), `-p, --project <projectId>` confirmed at lines 130-131
- [x] Compare against README.md chat section
  - **Finding**: README.md:134-137 documents all commands correctly with all flags
- [x] Document any discrepancies
  - **Finding**: No discrepancies - README accurately documents all chat command flags

### 1.6 Tokens Command Audit
- [x] Read `src/cli/commands/tokens.ts` lines 55-100
  - **Finding**: Command definitions at lines 55-103
- [x] Extract `tokens session` flags: `--session`
  - **Finding**: `--session <sessionId>` (required) confirmed at line 62
- [x] Extract `tokens project` flags: `--project`
  - **Finding**: `--project <projectId>` (required) confirmed at line 79
- [x] Extract `tokens global` flags: (none)
  - **Finding**: No flags, confirmed at lines 93-103
- [x] Compare against README.md tokens section
  - **Finding**: README.md:138-141 documents all three commands correctly with all flags
- [x] Document any discrepancies
  - **Finding**: No discrepancies - README accurately documents all tokens command flags

### 1.7 TUI Command Audit
- [x] Read `src/cli/commands/tui.ts` line 30
  - **Finding**: Line 30 contains `.description("Launch the Terminal UI")`
- [x] Note the `tui` subcommand description
  - **Finding**: The description is `"Launch the Terminal UI"`
- [x] Verify TUI help routing behavior
  - **Finding**: Verified via Help Routing Audit below

### 1.8 Help Routing Audit
- [x] Run `bun run src/bin/opencode-manager.ts --help` and capture output
  - **Finding**: Shows TUI help with key bindings (not Commander help)
- [x] Confirm it shows TUI help (not Commander help)
  - **Finding**: Confirmed - displays "OpenCode Metadata TUI" header with key bindings
- [x] Run `bun run src/bin/opencode-manager.ts projects --help` and capture output
  - **Finding**: Shows Commander CLI help with list/delete subcommands
- [x] Confirm it shows Commander CLI help
  - **Finding**: Confirmed - displays "Usage: opencode-manager projects [options] [command]"
- [x] Run `bun run src/bin/opencode-manager.ts tui --help` and capture output
  - **Finding**: Shows TUI help (same as root --help)
- [x] Confirm it shows TUI help
  - **Finding**: Confirmed - routes to TUI help, not Commander help for the tui subcommand
- [x] Document the dual help system behavior
  - **Finding**: Root/TUI subcommand → TUI help (key bindings); CLI subcommands (projects, sessions, chat, tokens) → Commander help

### 1.9 TUI Key Bindings Audit
- [x] Read `src/tui/args.ts` lines 18-64 (printUsage function)
  - **Finding**: printUsage() at lines 18-65 defines all TUI key bindings
- [x] Extract all documented key bindings
  - **Finding**: Global: Tab/1/2 switch, / search, X clear, ?/H help, R reload, Q quit
  - **Finding**: Projects: Space select, A select all, M missing-only, D delete, Enter sessions, Esc clear
  - **Finding**: Sessions: Space select, S sort, V view chat, F search chats, Shift+R rename, M move, P copy, Y copy ID, C clear filter, D delete, Enter details, Esc clear
  - **Finding**: Chat search: Type query, Enter search/open, Up/Down navigate, Esc close
  - **Finding**: Chat viewer: Esc close, Up/Down navigate, PgUp/PgDn jump 10, Home/End first/last, Y copy message
- [x] Read `src/tui/app.tsx` and verify key bindings match actual behavior
  - **Finding**: All documented keys verified in handleKey implementations (ProjectsPanel: lines 415-464, SessionsPanel: lines 838-993, handleGlobalKey: lines 1731-1918)
  - **Finding**: Sessions `A` key (select all) exists in code at line 891 but MISSING from args.ts help text
- [x] Compare against README.md TUI section
  - **Finding**: README.md:96-101 documents keyboard reference
  - **Finding**: README Global mentions only `?` for help, not `H` alternative
  - **Finding**: README Projects missing `Esc` (clear selection)
  - **Finding**: README Sessions missing `A` (select all), `Enter` (show details), `Esc` (clear selection)
- [x] Document any discrepancies
  - **DISCREPANCY-001**: Sessions `A` key (select all) implemented but undocumented in args.ts:38-50
  - **DISCREPANCY-002**: README missing `H` as help toggle alternative
  - **DISCREPANCY-003**: README missing `Esc` for Projects (clear selection)
  - **DISCREPANCY-004**: README missing `A`, `Enter`, `Esc` for Sessions view

### 1.10 Data Model Audit
- [x] Read `src/lib/opencode-data.ts` storage layout section
  - **Finding**: Storage layout defined in `src/lib/opencode-data.ts:86-88` (DEFAULT_ROOT, PROJECT_BUCKETS)
- [x] Document storage paths:
  - `storage/project/<projectId>.json` (primary bucket)
  - `storage/sessions/<projectId>.json` (secondary bucket)
  - `storage/session/<projectId>/<sessionId>.json`
  - `storage/message/<sessionId>/<messageId>.json`
  - `storage/part/<messageId>/<partId>.json`
  - **Finding**: Paths confirmed in `loadProjectRecords()` (line 189), `loadSessionRecords()` (line 236), `loadSessionMessagePaths()` (line 604), `loadMessagePartPaths()` (line 781)
- [x] Document legacy fallback paths:
  - `storage/session/message/<sessionId>/<messageId>.json`
  - `storage/session/part/<messageId>/<partId>.json`
  - **Finding**: Legacy paths confirmed in `loadSessionMessagePaths()` (line 617) and `loadMessagePartPaths()` (line 794)
- [x] Extract project schema fields: `id`, `worktree`, `vcs`, `time.created`
  - **Finding**: Fields confirmed in `loadProjectRecords()` lines 203-214
- [x] Extract session schema fields: `id`, `projectID`, `directory`, `title`, `version`, `time.created`, `time.updated`
  - **Finding**: Fields confirmed in `loadSessionRecords()` lines 271-284
- [x] Extract message schema fields: `id`, `sessionID`, `role`, `time.created`, `parentID`, `tokens.*`
  - **Finding**: Fields confirmed in `RawMessagePayload` interface (lines 867-874) and `loadSessionChatIndex()` (lines 900-926)
- [x] Extract part schema fields: `text`, `tool`, `subtask` parts
  - **Finding**: Part types defined in `PartType` (line 34) and extraction logic in `extractPartContent()` (lines 835-865)
- [x] Compare against `tests/fixtures/README.md`
  - **Finding**: `tests/fixtures/README.md` accurately documents all schemas and storage layouts
- [x] Document any discrepancies
  - **Finding**: No discrepancies - `tests/fixtures/README.md` is fully consistent with `src/lib/opencode-data.ts`

### 1.11 Exit Codes Audit
- [x] Read `src/cli/errors.ts`
  - **Finding**: Exit codes defined in `ExitCode` const at lines 24-35
- [x] Extract exit codes: 0 success, 1 general error, 2 usage error, 3 not found, 4 file operation failure
  - **Finding**: Confirmed - SUCCESS(0), ERROR(1), USAGE_ERROR(2), NOT_FOUND(3), FILE_ERROR(4)
- [x] Check if README.md documents exit codes
  - **Finding**: README.md:219-227 has an Exit Codes section with all 5 codes documented
- [x] Document gap if missing
  - **Finding**: No gap - README exit codes section matches `src/cli/errors.ts` exactly

### 1.12 Output Format Audit
- [x] Read `src/cli/output.ts` for format semantics
  - **Finding**: Three formats defined in `OutputFormat` type at line 59: `json`, `ndjson`, `table`
  - **Finding**: Format routing via switch statements in domain-specific output functions
  - **Finding**: JSON auto-detects TTY for pretty-printing (line 103-105)
- [x] Read `src/cli/formatters/json.ts` for JSON envelope structure
  - **Finding**: `JsonResponse<T>` interface at lines 21-37 defines envelope structure
- [x] Document output formats: `json`, `ndjson`, `table`
  - **Finding**: `json` - Full envelope with `ok`, `data`, `error`, `meta` fields; pretty-prints for TTY
  - **Finding**: `ndjson` - One JSON object per line, no envelope, compact format
  - **Finding**: `table` - Human-readable columnar output, default format
- [x] Document JSON envelope structure and list metadata
  - **Finding**: Envelope fields: `ok` (boolean), `data` (T), `error` (string), `meta` (object)
  - **Finding**: Meta fields: `count` (auto-populated for arrays), `limit`, `truncated`
- [x] Compare against README.md output format section
  - **Finding**: README.md:147-217 documents all three formats with examples
  - **Finding**: README shows JSON envelope with `ok`, `data`, `meta.count`
  - **Finding**: README NDJSON example shows raw records without envelope
- [x] Document any discrepancies
  - **DISCREPANCY-005**: README.md doesn't document `meta.limit` or `meta.truncated` fields
  - **DISCREPANCY-006**: README.md doesn't mention JSON auto-pretty-prints for TTY, compact for pipes

### 1.13 ID Resolution Behavior Audit
- [x] Review projects commands for prefix matching behavior
  - **Finding**: `projects delete` uses `resolveProjectId` with `allowPrefix: true` (src/cli/commands/projects.ts:164-167)
  - **Finding**: Supports exact match first, then unique prefix matching; ambiguous prefixes throw error
- [x] Review sessions commands for prefix matching behavior
  - **Finding**: All session commands use `resolveSessionId` with `allowPrefix: true`:
    - `sessions delete` (src/cli/commands/sessions.ts:295)
    - `sessions rename` (src/cli/commands/sessions.ts:378)
    - `sessions move` (src/cli/commands/sessions.ts:412)
    - `sessions copy` (src/cli/commands/sessions.ts:468)
  - **Finding**: `sessions move --to` and `sessions copy --to` use `resolveProjectId` with `allowPrefix: true` (lines 419, 475)
- [x] Review chat commands for prefix/index matching behavior
  - **Finding**: `chat list` and `chat show` use `resolveSessionId` with `allowPrefix: true` (src/cli/commands/chat.ts:157, 211)
  - **Finding**: `chat show --message` supports exact match first, then prefix matching (src/cli/commands/chat.ts:229-250)
  - **Finding**: `chat show --index` accepts 1-based index (src/cli/commands/chat.ts:252-261)
- [x] Review tokens commands for exact ID requirement
  - **Finding**: `tokens session` uses `findSessionById` - exact match only, NO prefix matching (src/cli/commands/tokens.ts:117)
  - **Finding**: `tokens project` uses `findProjectById` - exact match only, NO prefix matching (src/cli/commands/tokens.ts:138)
- [x] Document: `chat show` accepts message ID prefix or 1-based index
  - **Finding**: Confirmed - either `--message <id|prefix>` or `--index <1-based>`, but not both
- [x] Check if README documents ID resolution behavior
  - **Finding**: README does NOT document ID resolution/prefix matching behavior
  - **DISCREPANCY-007**: README missing documentation of prefix matching for projects/sessions/messages
  - **DISCREPANCY-008**: README missing documentation that `tokens` commands require exact IDs (no prefix matching)

### 1.14 Clipboard Audit
- [x] Read `src/lib/clipboard.ts`
  - **Finding**: `src/lib/clipboard.ts:10-24` implements `copyToClipboard()` function
  - **Finding**: Uses `pbcopy` on macOS (`process.platform === "darwin"`)
  - **Finding**: Uses `xclip -selection clipboard` on Linux (all other platforms)
  - **Finding**: No Windows-specific handling (falls through to xclip which won't work)
- [x] Document: `pbcopy` (macOS), `xclip` (Linux), no Windows support
  - **Finding**: Confirmed - macOS uses built-in `pbcopy`, Linux requires `xclip`, Windows not supported
- [x] Compare against README.md clipboard section
  - **Finding**: README.md:229-239 documents clipboard support accurately
  - **Finding**: Platform table correctly shows macOS (pbcopy), Linux (xclip required), Windows (not supported)
  - **Finding**: README correctly notes "clipboard operations will fail silently in the TUI or show an error message in the CLI"
  - **Finding**: No discrepancies - README clipboard documentation is complete and accurate

### 1.15 Screenshots Audit
- [x] View `home-screen.png` and note what it shows
  - **Finding**: Shows two-panel layout (Projects left, Sessions right), header with Global Tokens display, tab indicators, filter stats, and details pane
- [x] View `help-screen.png` and note what it shows
  - **Finding**: Shows help overlay modal with four sections (Global, Projects, Sessions, Tips), lists keyboard shortcuts with cyan/yellow highlights
- [x] Compare against current TUI appearance
  - **Finding**: Screenshots match current TUI appearance - same layout, styling, key bindings, and overall design
- [x] Document if screenshots need updating
  - **Finding**: Screenshots are UP-TO-DATE - no updates needed

### 1.16 PROJECT-SUMMARY.md Audit
- [x] Read `PROJECT-SUMMARY.md` architecture section
  - **Finding**: PROJECT-SUMMARY.md documents architecture in lines 11-48
- [x] Compare file structure against actual `src/` directory
  - **Finding**: All 20 source files match exactly - no missing or extra files
  - Entry point: `src/bin/opencode-manager.ts` ✓
  - CLI: `src/cli/index.ts`, 5 commands, 3 formatters, output.ts, errors.ts, resolvers.ts, backup.ts ✓
  - TUI: `src/tui/app.tsx`, `index.tsx`, `args.ts` ✓
  - Shared: `src/lib/opencode-data.ts`, `search.ts`, `clipboard.ts` ✓
- [x] Document any missing or renamed modules
  - **Finding**: No discrepancies - file structure is fully accurate
- [x] Compare feature summaries against actual CLI/TUI behavior
  - **Finding**: Packaging section (line 163) says "Bun v1.1+ only" but package.json requires ">=1.3.0"
  - **Finding**: TUI Keys section (lines 154-156) is incomplete vs args.ts and actual implementation
- [x] Document any discrepancies
  - **DISCREPANCY-009**: PROJECT-SUMMARY.md:163 says "Bun v1.1+ only" but package.json:9 requires ">=1.3.0"
  - **DISCREPANCY-010**: PROJECT-SUMMARY.md:154 missing `H` as help alternative (args.ts shows `?/H`)
  - **DISCREPANCY-011**: PROJECT-SUMMARY.md:155 Projects keys missing `Esc` (clear selection)
  - **DISCREPANCY-012**: PROJECT-SUMMARY.md:156 Sessions keys missing `A` (select all - implemented but undocumented everywhere), `V` (view chat), `F` (search chats), `Enter` (show details), `Esc` (clear selection)

### 1.17 tests/fixtures/README.md Audit
- [x] Read `tests/fixtures/README.md`
  - **Finding**: Comprehensive schema documentation covering directory layout, project/session/message/part schemas
- [x] Compare schema details against `src/lib/opencode-data.ts`
  - **Finding**: All primary storage paths documented correctly
  - **Finding**: Project schema fields match: `id`, `worktree`, `vcs`, `time.created`
  - **Finding**: Session schema fields match: `id`, `projectID`, `directory`, `title`, `version`, `time.created`, `time.updated`
  - **Finding**: Message schema fields match: `id`, `sessionID`, `role`, `time.created`, `parentID`, `tokens.*`
  - **Finding**: Part schemas match for text, tool, subtask types
- [x] Document any discrepancies in schema or layout
  - **DISCREPANCY-013**: Legacy fallback paths not documented in tests/fixtures/README.md:
    - `storage/session/message/<sessionId>/<messageId>.json` (line 617 in opencode-data.ts)
    - `storage/session/part/<messageId>/<partId>.json` (line 794 in opencode-data.ts)
  - **Note**: This is minor - fixtures document current layout; legacy is for backwards compatibility only

### 1.18 Legacy Wrapper Audit
- [x] Read `manage_opencode_projects.py` usage section
  - **Finding**: Docstring (lines 2-14) documents usage:
    - `manage_opencode_projects.py` → Launch TUI (default)
    - `manage_opencode_projects.py projects list` → CLI: list projects
    - `manage_opencode_projects.py sessions list` → CLI: list sessions
    - `manage_opencode_projects.py -- --help` → Show TUI help
  - **Finding**: Wrapper-only option is `--bun` to specify bun executable path
  - **Finding**: All other args forwarded to TypeScript entrypoint
- [x] Check if README references the wrapper
  - **Finding**: README.md:93 shows example: `./manage_opencode_projects.py --root ~/.local/share/opencode -- --help`
  - **Finding**: README.md:254 lists it in project structure as "Legacy Python launcher for backwards compatibility"
- [x] Document if wrapper docs need updating
  - **Finding**: Wrapper documentation is ACCURATE - no updates needed
  - **Note**: `--root` works because it's forwarded to TypeScript entrypoint (not a wrapper option)

### 1.19 Create Gap Summary Document
- [x] Compile all discrepancies found into a single checklist
- [x] Prioritize by user impact (requirements > commands > examples > details)

---

## Gap Summary (Discrepancies Found in Phase 1)

### Priority 1: Requirements Mismatch (User Impact: HIGH)
| ID | Location | Issue | Fix |
|----|----------|-------|-----|
| REQ-001 | README.md:61 | Says "Bun 1.1.0+" but package.json:9 requires ">=1.3.0" | Update to "1.3.0+" |
| REQ-002 | PROJECT-SUMMARY.md:163 | Says "Bun v1.1+ only" but package.json:9 requires ">=1.3.0" | Update to "1.3.0+" |

### Priority 2: Missing Documentation (User Impact: MEDIUM)
| ID | Location | Issue | Fix |
|----|----------|-------|-----|
| ~~DOC-001~~ | ~~README.md TUI section~~ | ~~Missing `H` as help toggle alternative (only shows `?`)~~ | ~~Add `?/H`~~ ✅ DONE |
| ~~DOC-002~~ | ~~README.md TUI section~~ | ~~Projects view missing `Esc` (clear selection)~~ | ~~Add key binding~~ ✅ DONE |
| ~~DOC-003~~ | ~~README.md TUI section~~ | ~~Sessions view missing `A` (select all), `Enter` (details), `Esc` (clear)~~ | ~~Add key bindings~~ ✅ DONE |
| DOC-004 | README.md | Missing ID prefix matching behavior docs | Add section |
| DOC-005 | README.md | Missing note that `tokens` commands require exact IDs | Add to tokens section |
| DOC-006 | README.md Output section | Missing `meta.limit` and `meta.truncated` fields | Add to JSON envelope docs |
| DOC-007 | README.md Output section | Missing TTY auto-pretty-print behavior | Add note |

### Priority 3: Help Text Gaps (User Impact: MEDIUM)
| ID | Location | Issue | Fix |
|----|----------|-------|-----|
| HELP-001 | src/tui/args.ts:38-50 | Sessions `A` key (select all) implemented but undocumented | Add to printUsage() |
| ~~HELP-002~~ | ~~PROJECT-SUMMARY.md:154~~ | ~~Missing `H` as help alternative~~ | ~~Add `?/H`~~ ✅ DONE |
| ~~HELP-003~~ | ~~PROJECT-SUMMARY.md:155~~ | ~~Projects keys missing `Esc`~~ | ~~Add key binding~~ ✅ DONE |
| ~~HELP-004~~ | ~~PROJECT-SUMMARY.md:156~~ | ~~Sessions keys missing `A`, `V`, `F`, `Enter`, `Esc`~~ | ~~Add key bindings~~ ✅ DONE |

### Priority 4: Minor Documentation Gaps (User Impact: LOW)
| ID | Location | Issue | Fix |
|----|----------|-------|-----|
| MINOR-001 | tests/fixtures/README.md | Legacy fallback paths not documented | Add legacy paths section (optional) |

### Summary Statistics
- **Total Discrepancies**: 14 (8 fixed)
- **Priority 1 (Requirements)**: 2 (2 fixed)
- **Priority 2 (Missing Docs)**: 7 (3 fixed)
- **Priority 3 (Help Text)**: 4 (3 fixed)
- **Priority 4 (Minor)**: 1 (0 fixed)

---

## Phase 2: Update Core Documentation

### 2.1 README.md Requirements Section
- [x] Update Bun version from "1.1.0+" to "1.3.0+" (FIX PRE-EXISTING BUG)
- [x] Verify installation commands match package.json scripts
  - **Finding**: All commands match - `bun run tui`, `bun run dev`, `bun run typecheck` correctly documented
- [x] Update any other version/requirement references
  - **Finding**: Updated PROJECT-SUMMARY.md:163 from "Bun v1.1+ only" to "Bun v1.3+ only" (REQ-002 fix)

### 2.2 README.md Features Section
- [x] Verify feature list matches current CLI capabilities
  - **Finding**: All 12 features in README.md:22-34 accurately match current CLI/TUI capabilities
  - **Finding**: TUI features (fuzzy search, chat viewer, session operations) all implemented and documented
  - **Finding**: CLI commands (projects, sessions, chat, tokens) all documented with correct flags
- [x] Add any missing features (e.g., chat search, token summaries)
  - **Finding**: No missing features - all 12 features already documented (chat search at line 28, token counting at line 34)
- [x] Remove any deprecated features
  - **Finding**: No deprecated features found - all documented features are actively implemented
- [x] Verify TUI feature descriptions match current behavior
  - **Finding**: All TUI features (fuzzy search `/`, chat viewer `V`, chat search `F`, rename `Shift+R`, move `M`, copy `P`, help `?/H`) documented with correct key bindings

### 2.3 README.md CLI Global Options
- [ ] Document `--root` option with default value
- [ ] Document `--format` option with values: json, ndjson, table
- [ ] Document `--limit` option
- [ ] Document `--sort` option
- [ ] Document `--yes` option
- [ ] Document `--dry-run` option
- [ ] Document `--quiet` option
- [ ] Document `--clipboard` option
- [ ] Document `--backup-dir` option

### 2.4 README.md Projects Commands
- [ ] Document `projects list` command
- [ ] Document `projects list --missing-only` flag
- [ ] Document `projects list --search` flag
- [ ] Document `projects delete` command
- [ ] Document `projects delete --id` flag
- [ ] Document `projects delete --yes` flag
- [ ] Document `projects delete --dry-run` flag
- [ ] Document `projects delete --backup-dir` flag

### 2.5 README.md Sessions Commands
- [ ] Document `sessions list` command
- [ ] Document `sessions list --project` flag
- [ ] Document `sessions list --search` flag
- [ ] Document `sessions delete` command
- [ ] Document `sessions delete --session` flag
- [ ] Document `sessions delete --yes` flag
- [ ] Document `sessions delete --dry-run` flag
- [ ] Document `sessions delete --backup-dir` flag
- [ ] Document `sessions rename` command
- [ ] Document `sessions rename --session` flag
- [ ] Document `sessions rename --title` flag
- [ ] Document `sessions move` command
- [ ] Document `sessions move --session` flag
- [ ] Document `sessions move --to` flag
- [ ] Document `sessions copy` command
- [ ] Document `sessions copy --session` flag
- [ ] Document `sessions copy --to` flag

### 2.6 README.md Chat Commands
- [ ] Document `chat list` command
- [ ] Document `chat list --session` flag
- [ ] Document `chat list --include-parts` flag
- [ ] Document `chat show` command
- [ ] Document `chat show --session` flag
- [ ] Document `chat show --message` flag
- [ ] Document `chat show --index` flag
- [ ] Document `chat show` clipboard behavior (uses global `--clipboard`)
- [ ] Document `chat search` command
- [ ] Document `chat search --query` flag
- [ ] Document `chat search --project` flag

### 2.7 README.md Tokens Commands
- [ ] Document `tokens session` command
- [ ] Document `tokens session --session` flag
- [ ] Document `tokens project` command
- [ ] Document `tokens project --project` flag
- [ ] Document `tokens global` command
- [ ] Document token summary output format
- [ ] Document `kind` field (known/unknown)
- [ ] Document `reason` field (when unknown)
- [ ] Document aggregate fields: `knownOnly`, `unknownSessions`

### 2.8 README.md TUI Command
- [ ] Document `tui` subcommand to launch TUI explicitly

### 2.9 README.md Help Routing
- [ ] Add section explaining dual help system
- [ ] Document `opencode-manager --help` shows TUI help
- [ ] Document `opencode-manager -h` shows TUI help
- [ ] Document `opencode-manager <cmd> --help` shows CLI help
- [ ] Document `opencode-manager tui --help` shows TUI help

### 2.10 README.md Output Formats
- [ ] Document `json` format with envelope structure
- [ ] Document `ndjson` format
- [ ] Document `table` format
- [ ] Document list metadata in JSON output

### 2.11 README.md ID Resolution
- [ ] Document prefix matching for projects
- [ ] Document prefix matching for sessions
- [ ] Document prefix matching for chat messages
- [ ] Document exact ID requirement for tokens
- [ ] Document 1-based index option for `chat show`

### 2.12 README.md Exit Codes
- [ ] Add exit codes section
- [ ] Document exit code 0: success
- [ ] Document exit code 1: general error
- [ ] Document exit code 2: usage error
- [ ] Document exit code 3: not found
- [ ] Document exit code 4: file operation failure

### 2.13 README.md Delete Semantics
- [ ] Document that delete removes metadata only
- [ ] Document that session delete leaves message files
- [ ] Document confirmation requirement (--yes flag)
- [ ] Document dry-run behavior

### 2.14 README.md Clipboard
- [ ] Document `pbcopy` requirement on macOS
- [ ] Document `xclip` requirement on Linux
- [ ] Document no Windows support

### 2.15 README.md Troubleshooting
- [ ] Verify tmux note is accurate
- [ ] Verify clipboard behavior notes are accurate
- [ ] Add any new known issues

### 2.16 README.md TUI Key Bindings
- [ ] Update global key bindings section
- [ ] Update Projects view key bindings
- [ ] Update Sessions view key bindings
- [ ] Update Chat search key bindings
- [ ] Update Chat viewer key bindings
- [ ] Document confirmation workflow keys

### 2.17 README.md Examples
- [ ] Verify `projects list` example output matches current format
- [ ] Verify `sessions list` example output matches current format
- [ ] Verify `chat list` example output matches current format
- [ ] Verify `chat show` example output matches current format
- [ ] Verify `tokens` example output matches current format
- [ ] Update any outdated flag names in examples

### 2.18 PROJECT-SUMMARY.md Architecture
- [ ] Update file tree to match current `src/` structure
- [ ] Add any new modules to the list
- [ ] Remove any deleted modules
- [ ] Update module descriptions

### 2.19 PROJECT-SUMMARY.md Features
- [ ] Update CLI feature summary
- [ ] Update TUI feature summary
- [ ] Update data layer feature summary
- [ ] Add token handling description
- [ ] Add search behavior description

---

## Phase 2a: Update CLI Help Text

### 2a.1 Root Program Description
- [ ] Review `src/cli/index.ts:79` description
- [ ] Decide: update for future-proofing or leave as-is (per DECISION-003)

### 2a.2 Projects Command Descriptions
- [ ] Review `src/cli/commands/projects.ts:71` - "Manage OpenCode projects"
- [ ] Review `src/cli/commands/projects.ts:75` - "List projects"
- [ ] Review `src/cli/commands/projects.ts:90` - "Delete a project's metadata file"

### 2a.3 Sessions Command Descriptions
- [ ] Review `src/cli/commands/sessions.ts:105` - "Manage OpenCode sessions"
- [ ] Review `src/cli/commands/sessions.ts:109` - "List sessions"
- [ ] Review `src/cli/commands/sessions.ts:124` - "Delete a session's metadata file"
- [ ] Review `src/cli/commands/sessions.ts:147` - "Rename a session"
- [ ] Review `src/cli/commands/sessions.ts:165` - "Move a session to another project"
- [ ] Review `src/cli/commands/sessions.ts:182` - "Copy a session to another project"

### 2a.4 Chat Command Descriptions
- [ ] Review `src/cli/commands/chat.ts:84` - "View and search chat messages"
- [ ] Review `src/cli/commands/chat.ts:88` - "List messages in a session"
- [ ] Review `src/cli/commands/chat.ts:106` - "Show a specific message"
- [ ] Review `src/cli/commands/chat.ts:129` - "Search chat content across sessions"

### 2a.5 Tokens Command Descriptions
- [ ] Review `src/cli/commands/tokens.ts:57` - "View token usage statistics"
- [ ] Review `src/cli/commands/tokens.ts:61` - "Show token usage for a session"
- [ ] Review `src/cli/commands/tokens.ts:78` - "Show token usage for a project"
- [ ] Review `src/cli/commands/tokens.ts:95` - "Show global token usage"

### 2a.6 TUI Command Description
- [ ] Review `src/cli/commands/tui.ts:30` - "Launch the Terminal UI"
- [ ] Consider adding more detail about TUI features

### 2a.7 Option Help Strings
- [ ] Review all `--root` option descriptions across commands
- [ ] Review all `--format` option descriptions
- [ ] Review all `--limit` option descriptions
- [ ] Review all `--sort` option descriptions
- [ ] Review all `--yes` option descriptions
- [ ] Review all `--dry-run` option descriptions
- [ ] Review all `--quiet` option descriptions
- [ ] Review all `--clipboard` option descriptions
- [ ] Review all `--backup-dir` option descriptions
- [ ] Ensure consistency across all commands

---

## Phase 2b: Update TUI Help Text

### 2b.1 TUI Help Output
- [ ] Read `src/tui/args.ts:printUsage()` function
- [ ] Verify all key bindings listed match actual behavior
- [x] Add any missing key bindings
  - **Fixed**: Added `A` key (select all) to Sessions view in `src/tui/args.ts:40` (HELP-001)
- [ ] Remove any outdated key bindings
- [ ] Verify formatting and spacing

### 2b.2 TUI In-App Help
- [ ] Locate help overlay in `src/tui/app.tsx`
- [ ] Verify it matches `src/tui/args.ts` help text
- [ ] Update if discrepancies found

### 2b.3 Optional: Add CLI Overview to TUI Help
- [ ] If DECISION-001 approves Option B:
  - [ ] Add CLI subcommand list to `printUsage()`
  - [ ] Format: "CLI subcommands (use <cmd> --help for details):"
  - [ ] List: projects, sessions, chat, tokens

---

## Phase 3: Update Supplemental Documentation

### 3.1 tests/fixtures/README.md
- [ ] Update project schema documentation
- [ ] Update session schema documentation
- [ ] Update message schema documentation
- [ ] Update part schema documentation
- [ ] Add token fields documentation
- [ ] Document legacy storage paths
- [ ] Verify example JSON matches schema

### 3.2 plan.md Status
- [ ] Add header marking this as active backlog
- [ ] Add creation date
- [ ] Add completion tracking

### 3.3 Legacy Wrapper Documentation
- [ ] Check `manage_opencode_projects.py` header comments
- [ ] Update if wrapper behavior has changed
- [ ] Verify README references (if any) are accurate

### 3.4 Screenshots
- [ ] Compare `home-screen.png` to current TUI
- [ ] If outdated: capture new screenshot
- [ ] Compare `help-screen.png` to current TUI help
- [ ] If outdated: capture new screenshot
- [ ] Update README captions if screenshots change

---

## Phase 4: External Reference Checks

### 4.1 OpenTUI Reference
- [ ] Verify OpenTUI GitHub URL is correct
- [ ] Verify usage description matches actual dependency usage

### 4.2 Bun Reference
- [ ] Verify Bun GitHub URL is correct
- [ ] Verify version requirement language is standard

### 4.3 Commander.js Reference
- [ ] If documented: verify GitHub URL is correct
- [ ] Verify any usage notes are accurate

### 4.4 fast-fuzzy Reference
- [ ] If documented: verify GitHub URL is correct
- [ ] Verify search behavior description matches library semantics

---

## Phase 5: Validation and Final Review

### 5a: Version and Requirements Validation
- [ ] Run `bun run src/bin/opencode-manager.ts --version`
- [ ] Verify output matches `package.json` version
- [ ] Read `src/cli/index.ts:80` and verify `.version()` call uses package version
- [ ] Read README.md and verify Bun version requirement says "1.3.0+"
- [ ] Read `package.json` engines and confirm ">=1.3.0"

### 5b: Help Output Validation - Root
- [ ] Run `bun run src/bin/opencode-manager.ts --help`
- [ ] Verify shows TUI help (key bindings)
- [ ] Run `bun run src/bin/opencode-manager.ts -h`
- [ ] Verify shows same TUI help

### 5b: Help Output Validation - Projects
- [ ] Run `bun run src/bin/opencode-manager.ts projects --help`
- [ ] Verify shows Commander help with list/delete subcommands
- [ ] Run `bun run src/bin/opencode-manager.ts projects list --help`
- [ ] Verify shows list options
- [ ] Run `bun run src/bin/opencode-manager.ts projects delete --help`
- [ ] Verify shows delete options

### 5b: Help Output Validation - Sessions
- [ ] Run `bun run src/bin/opencode-manager.ts sessions --help`
- [ ] Verify shows Commander help with all subcommands
- [ ] Run `bun run src/bin/opencode-manager.ts sessions list --help`
- [ ] Verify shows list options
- [ ] Run `bun run src/bin/opencode-manager.ts sessions delete --help`
- [ ] Verify shows delete options
- [ ] Run `bun run src/bin/opencode-manager.ts sessions rename --help`
- [ ] Verify shows rename options
- [ ] Run `bun run src/bin/opencode-manager.ts sessions move --help`
- [ ] Verify shows move options
- [ ] Run `bun run src/bin/opencode-manager.ts sessions copy --help`
- [ ] Verify shows copy options

### 5b: Help Output Validation - Chat
- [ ] Run `bun run src/bin/opencode-manager.ts chat --help`
- [ ] Verify shows Commander help with all subcommands
- [ ] Run `bun run src/bin/opencode-manager.ts chat list --help`
- [ ] Verify shows list options
- [ ] Run `bun run src/bin/opencode-manager.ts chat show --help`
- [ ] Verify shows show options
- [ ] Run `bun run src/bin/opencode-manager.ts chat search --help`
- [ ] Verify shows search options

### 5b: Help Output Validation - Tokens
- [ ] Run `bun run src/bin/opencode-manager.ts tokens --help`
- [ ] Verify shows Commander help with all subcommands
- [ ] Run `bun run src/bin/opencode-manager.ts tokens session --help`
- [ ] Verify shows session options
- [ ] Run `bun run src/bin/opencode-manager.ts tokens project --help`
- [ ] Verify shows project options
- [ ] Run `bun run src/bin/opencode-manager.ts tokens global --help`
- [ ] Verify shows global options (none expected)

### 5b: Help Output Validation - TUI
- [ ] Run `bun run src/bin/opencode-manager.ts tui --help`
- [ ] Verify shows TUI help (not Commander help)
- [ ] Document this routing behavior in README

### 5c: Example Command Validation
- [ ] Run `bun run src/bin/opencode-manager.ts projects list --format json`
- [ ] Verify output structure matches documentation
- [ ] Run `bun run src/bin/opencode-manager.ts tokens global --format json`
- [ ] Verify token summary structure matches documentation

### 5c: Documentation Consistency Check
- [ ] Search README for all file paths and verify they exist
- [ ] Search README for all script names and verify they work
- [ ] Search README for all version numbers and verify accuracy
- [ ] Verify help routing is documented correctly

### 5c: Final Checklist
- [ ] Every CLI flag documented matches source code
- [ ] All 19 `.description()` strings reviewed
- [ ] CLI help output matches docs for each subcommand
- [ ] TUI key bindings match `src/tui/args.ts`
- [ ] Data model matches `src/lib/opencode-data.ts`
- [ ] Token summary docs include `kind`/`reason`/`unknownSessions`
- [ ] CLI exit codes match `src/cli/errors.ts`
- [ ] CLI version matches `package.json`
- [ ] Requirements match `package.json`
- [ ] Screenshots match current UI

---

## Completion Tracking

| Phase | Tasks | Completed | Progress |
|-------|-------|-----------|----------|
| Phase 0 | 3 | 0 | 0% |
| Phase 1 | 59 | 59 | 100% |
| Phase 2 | 78 | 6 | 8% |
| Phase 2a | 28 | 0 | 0% |
| Phase 2b | 7 | 1 | 14% |
| Phase 3 | 11 | 0 | 0% |
| Phase 4 | 6 | 0 | 0% |
| Phase 5 | 40 | 0 | 0% |
| **Total** | **232** | **66** | **28.4%** |
