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
- [ ] Read `package.json` engines field and note Bun requirement (>=1.3.0)
- [ ] Read `README.md` line 61 and note stated Bun version (currently says 1.1.0+)
- [ ] Document mismatch: README says "1.1.0+" but package.json requires ">=1.3.0"

### 1.2 CLI Global Options Audit
- [ ] Read `src/cli/index.ts` and extract all global options
- [ ] List global options: `--root`, `--format`, `--limit`, `--sort`, `--yes`, `--dry-run`, `--quiet`, `--clipboard`, `--backup-dir`
- [ ] Compare against README.md CLI documentation section
- [ ] Document any missing or outdated options in README

### 1.3 Projects Command Audit
- [ ] Read `src/cli/commands/projects.ts` lines 70-130
- [ ] Extract `projects list` flags: `--missing-only`, `--search`
- [ ] Extract `projects delete` flags: `--id`, `--yes`, `--dry-run`, `--backup-dir`
- [ ] Compare against README.md projects section
- [ ] Document any discrepancies

### 1.4 Sessions Command Audit
- [ ] Read `src/cli/commands/sessions.ts` lines 100-200
- [ ] Extract `sessions list` flags: `--project`, `--search`
- [ ] Extract `sessions delete` flags: `--session`, `--yes`, `--dry-run`, `--backup-dir`
- [ ] Extract `sessions rename` flags: `--session`, `--title`
- [ ] Extract `sessions move` flags: `--session`, `--to`
- [ ] Extract `sessions copy` flags: `--session`, `--to`
- [ ] Compare against README.md sessions section
- [ ] Document any discrepancies

### 1.5 Chat Command Audit
- [ ] Read `src/cli/commands/chat.ts` lines 80-150
- [ ] Extract `chat list` flags: `--session`, `--include-parts`
- [ ] Extract `chat show` flags: `--session`, `--message`, `--index`, uses global `--clipboard`
- [ ] Extract `chat search` flags: `--query`, `--project`
- [ ] Compare against README.md chat section
- [ ] Document any discrepancies

### 1.6 Tokens Command Audit
- [ ] Read `src/cli/commands/tokens.ts` lines 55-100
- [ ] Extract `tokens session` flags: `--session`
- [ ] Extract `tokens project` flags: `--project`
- [ ] Extract `tokens global` flags: (none)
- [ ] Compare against README.md tokens section
- [ ] Document any discrepancies

### 1.7 TUI Command Audit
- [ ] Read `src/cli/commands/tui.ts` line 30
- [ ] Note the `tui` subcommand description
- [ ] Verify TUI help routing behavior

### 1.8 Help Routing Audit
- [ ] Run `bun run src/bin/opencode-manager.ts --help` and capture output
- [ ] Confirm it shows TUI help (not Commander help)
- [ ] Run `bun run src/bin/opencode-manager.ts projects --help` and capture output
- [ ] Confirm it shows Commander CLI help
- [ ] Run `bun run src/bin/opencode-manager.ts tui --help` and capture output
- [ ] Confirm it shows TUI help
- [ ] Document the dual help system behavior

### 1.9 TUI Key Bindings Audit
- [ ] Read `src/tui/args.ts` lines 18-64 (printUsage function)
- [ ] Extract all documented key bindings
- [ ] Read `src/tui/app.tsx` and verify key bindings match actual behavior
- [ ] Compare against README.md TUI section
- [ ] Document any discrepancies

### 1.10 Data Model Audit
- [ ] Read `src/lib/opencode-data.ts` storage layout section
- [ ] Document storage paths:
  - `project/<projectId>.json`
  - `sessions/<projectId>.json`
  - `session/<projectId>/<sessionId>.json`
  - `message/<sessionId>/<messageId>.json`
  - `part/<messageId>/<partId>.json`
- [ ] Document legacy fallback paths:
  - `session/message/<sessionId>/<messageId>.json`
  - `session/part/<messageId>/<partId>.json`
- [ ] Extract project schema fields: `id`, `worktree`, `vcs`, `time.created`
- [ ] Extract session schema fields: `id`, `projectID`, `directory`, `title`, `version`, `time.created`, `time.updated`
- [ ] Extract message schema fields: `id`, `sessionID`, `role`, `time.created`, `parentID`, `tokens.*`
- [ ] Extract part schema fields: `text`, `tool`, `subtask` parts
- [ ] Compare against `tests/fixtures/README.md`
- [ ] Document any discrepancies

### 1.11 Exit Codes Audit
- [ ] Read `src/cli/errors.ts`
- [ ] Extract exit codes: 0 success, 1 general error, 2 usage error, 3 not found, 4 file operation failure
- [ ] Check if README.md documents exit codes
- [ ] Document gap if missing

### 1.12 Output Format Audit
- [ ] Read `src/cli/output.ts` for format semantics
- [ ] Read `src/cli/formatters/json.ts` for JSON envelope structure
- [ ] Document output formats: `json`, `ndjson`, `table`
- [ ] Document JSON envelope structure and list metadata
- [ ] Compare against README.md output format section
- [ ] Document any discrepancies

### 1.13 ID Resolution Behavior Audit
- [ ] Review projects commands for prefix matching behavior
- [ ] Review sessions commands for prefix matching behavior
- [ ] Review chat commands for prefix/index matching behavior
- [ ] Review tokens commands for exact ID requirement
- [ ] Document: `chat show` accepts message ID prefix or 1-based index
- [ ] Check if README documents ID resolution behavior

### 1.14 Clipboard Audit
- [ ] Read `src/lib/clipboard.ts`
- [ ] Document: `pbcopy` (macOS), `xclip` (Linux), no Windows support
- [ ] Compare against README.md clipboard section

### 1.15 Screenshots Audit
- [ ] View `home-screen.png` and note what it shows
- [ ] View `help-screen.png` and note what it shows
- [ ] Compare against current TUI appearance
- [ ] Document if screenshots need updating

### 1.16 PROJECT-SUMMARY.md Audit
- [ ] Read `PROJECT-SUMMARY.md` architecture section
- [ ] Compare file structure against actual `src/` directory
- [ ] Document any missing or renamed modules
- [ ] Compare feature summaries against actual CLI/TUI behavior
- [ ] Document any discrepancies

### 1.17 tests/fixtures/README.md Audit
- [ ] Read `tests/fixtures/README.md`
- [ ] Compare schema details against `src/lib/opencode-data.ts`
- [ ] Document any discrepancies in schema or layout

### 1.18 Legacy Wrapper Audit
- [ ] Read `manage_opencode_projects.py` usage section
- [ ] Check if README references the wrapper
- [ ] Document if wrapper docs need updating

### 1.19 Create Gap Summary Document
- [ ] Compile all discrepancies found into a single checklist
- [ ] Prioritize by user impact (requirements > commands > examples > details)

---

## Phase 2: Update Core Documentation

### 2.1 README.md Requirements Section
- [ ] Update Bun version from "1.1.0+" to "1.3.0+" (FIX PRE-EXISTING BUG)
- [ ] Verify installation commands match package.json scripts
- [ ] Update any other version/requirement references

### 2.2 README.md Features Section
- [ ] Verify feature list matches current CLI capabilities
- [ ] Add any missing features (e.g., chat search, token summaries)
- [ ] Remove any deprecated features
- [ ] Verify TUI feature descriptions match current behavior

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
- [ ] Add any missing key bindings
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
| Phase 1 | 54 | 1 | 2% |
| Phase 2 | 78 | 0 | 0% |
| Phase 2a | 28 | 0 | 0% |
| Phase 2b | 7 | 0 | 0% |
| Phase 3 | 11 | 0 | 0% |
| Phase 4 | 6 | 0 | 0% |
| Phase 5 | 40 | 0 | 0% |
| **Total** | **227** | **1** | **0.4%** |
