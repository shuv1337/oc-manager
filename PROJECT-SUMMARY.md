OpenCode Metadata Manager — Project Summary
==========================================

Overview
--------
- Purpose: Inspect, filter, and clean OpenCode metadata stored on disk.
- Scope: Lists projects and sessions from local storage; supports filtering, search, interactive selection and deletion, and quick navigation between views.
- Dual interface: Terminal UI (TUI) built with @opentui/react for interactive use, plus a Commander-based CLI for scripting and automation.

Architecture
------------
The codebase follows a dual-mode architecture with shared libraries:

### Entry Points
- `src/bin/opencode-manager.ts` — Main entrypoint; routes to CLI or TUI based on subcommand.
  - CLI subcommands: `projects`, `sessions`, `chat`, `tokens` → dynamic import of CLI module
  - TUI mode: no subcommand, or explicit `tui` subcommand → dynamic import of TUI module

### CLI Module (`src/cli/`)
- `index.ts` — Commander program with global options (`--root`, `--format`, `--limit`, `--sort`, `--yes`, `--dry-run`, `--quiet`, `--clipboard`, `--backup-dir`); exports `runCLI(args)`.
- `commands/` — Subcommand implementations:
  - `projects.ts` — `list`, `delete` with dry-run/backup support
  - `sessions.ts` — `list`, `delete`, `rename`, `move`, `copy` 
  - `chat.ts` — `list`, `show`, `search` with clipboard support
  - `tokens.ts` — `session`, `project`, `global` token summaries
  - `tui.ts` — Launches TUI from CLI context
- `formatters/` — Output formatters:
  - `json.ts` — JSON with envelope (`{ok, data, meta}`)
  - `ndjson.ts` — Newline-delimited JSON for streaming
  - `table.ts` — Column-aligned tables with truncation
- `output.ts` — Format selector routing by `--format` flag
- `errors.ts` — Exit codes (0-4), error classes, validation helpers
- `resolvers.ts` — ID resolution with exact/prefix matching
- `backup.ts` — Pre-deletion backup to timestamped directories

### TUI Module (`src/tui/`)
- `app.tsx` — Main TUI app with Projects, Sessions, Chat panels
- `index.tsx` — Exports `launchTUI(options)`, `bootstrap(args)`
- `args.ts` — TUI-specific arg parsing (`--root`, `--help`)

### Shared Libraries (`src/lib/`)
- `opencode-data.ts` — Data layer: load/save metadata, compute tokens, filtering, formatting
- `search.ts` — Fuzzy search via fast-fuzzy (sessions) and tokenized search (projects)
- `clipboard.ts` — Cross-platform clipboard (`pbcopy`/`xclip`)

### Other Files
- `manage_opencode_projects.py` — Legacy wrapper; routes CLI/TUI via `src/bin/opencode-manager.ts`
- `opencode-gen.sh` — Spec diff script for OpenCode JSON specs

Metadata Layout & Helpers
-------------------------
- Storage root: `DEFAULT_ROOT` is `~/.local/share/opencode`; CLI `--root` values are resolved via `path.resolve` so relative paths and `~` are accepted.
- Projects: metadata files live under `storage/project` and `storage/sessions`. `loadProjectRecords` walks both buckets, parses timestamps, expands `~`-style worktree paths, and determines `state` by stat-ing the directory so missing projects are surfaced inline.
- Sessions: JSON files live under `storage/session/<projectId>/`. Records capture `title`, `version`, and both `createdAt`/`updatedAt` stamps; the loader can filter by `projectId` (used by the Sessions tab) and sorts primarily by the active timestamp (updated when available, else created).
- Formatting/utilities: `formatDisplayPath` shortens paths back to `~`, `formatDate` handles null-safe rendering, and `describeProject`/`describeSession` feed human-readable previews to confirm dialogs.
- Destructive actions: `deleteProjectMetadata`/`deleteSessionMetadata` accept optional `dryRun` flags, record successes/failures per file, and `ensureDirectory` is available for future write paths.

Key Features
------------
- Projects panel
  - Shows project path in the list (more human-friendly than IDs).
  - Details pane shows project ID, VCS, created time, and full path.
  - Missing-only toggle and bulk selection.
- Sessions panel
  - Shows session title (or falls back to ID) in the list.
  - Sort toggle (S) between "updated" and "created".
  - Each row shows a timestamp snippet for the active sort (created/updated).
  - Details pane includes title, project ID, updated time, and directory.
  - Rename sessions inline (Shift+R) with validation.
  - Move sessions to another project (M) with project selector.
  - Copy sessions to another project (P) with new session ID generation.
- Projects ↔ Sessions workflow
  - Pressing Enter on a project jumps to the Sessions tab with the project filter set; status text confirms the active filter.
  - `C` clears the filter (and notifies the user) so global searches go back to all sessions.
- Global search (for current tab)
  - Search box (/) captures input without conflicting with shortcuts; Enter applies, Esc clears, X also clears when not in search mode.
  - Projects: matches project ID or directory path.
  - Sessions: matches title, session ID, directory path, or project ID.
- Help screen
  - Two-column, color-coded quick reference with “key chips”.
  - Clear grouping by Global, Projects, Sessions, Tips.
- Status & confirmation bars
  - Status bar tint reflects `info` vs `error` states so reload/deletion feedback is obvious.
  - Confirmation bar shows up to five pending records (project/session descriptors) and states “Y/Enter confirm, N/Esc cancel” while disabling panel shortcuts until resolved.

Work Completed
--------------
### TUI Features
- Switched Projects list labels to show path instead of project ID; kept ID in the details panel.
- Sessions list uses session title prominently; added title to details; updated onSelect/Enter status lines to show title and ID.
- Redesigned Help screen into two columns with color-coded sections and key chips; removed wall-of-text effect.
- Added a small color palette and helper components (Section, Row, Bullet, Columns, KeyChip) to simplify consistent styling.
- Implemented a global Search bar and input mode:
  - "/" to start, Enter to apply, Esc or "X" to clear.
  - Projects: search `projectId` and `worktree`; Sessions: search `title`, `sessionId`, `directory`, `projectId`.
- Sessions sorting & context:
  - "S" toggles sort by `updated`/`created`.
  - Show per-row description with the relevant timestamp.
- Fixed OpenTUI text rendering error by filtering whitespace-only raw text in layout helpers and by removing nested `<text>` nodes around key chips.
- Verified via `bun run tui` (tmux socket creation is blocked in this environment, but direct run works).
- Added session rename feature (Shift+R): inline text input with validation, updates JSON file, refreshes list.
- Added session move feature (M): select target project, relocate session JSON, update projectID field.
- Added session copy feature (P): select target project, create new session with generated ID, preserve original.

### CLI Implementation (Phase 1-4)
- Created Commander-based CLI with global options and subcommand routing.
- Refactored entrypoint to route CLI vs TUI via dynamic imports.
- Extracted shared libraries (`clipboard.ts`, `search.ts`) from TUI for CLI reuse.
- Implemented output formatters: JSON with envelope, NDJSON for streaming, table with truncation.
- Projects commands: `list` (with `--missing-only`, `--search`), `delete` (with `--dry-run`, `--backup-dir`).
- Sessions commands: `list` (with `--project`, `--search`, fuzzy matching), `delete`, `rename`, `move`, `copy`.
- Chat commands: `list` (with `--include-parts`), `show` (by `--message` or `--index`, with `--clipboard`), `search`.
- Tokens commands: `session`, `project`, `global` summaries with breakdown tables.
- Error handling with typed exit codes (0-4) and consistent error formatting.
- ID resolution helpers with exact and prefix matching.
- Pre-deletion backup to timestamped directories.
- Comprehensive test suite: 350+ tests covering formatters, commands, resolvers, errors, exit codes.

How To Run
----------
### TUI Mode (Interactive)
- Zero-install: `bunx opencode-manager [--root /path/to/storage]` (preferred)
- Local dev: `bun run tui [-- --root /path/to/storage]`
- Legacy launcher: `./manage_opencode_projects.py [--bun /path/to/bun]`
- TUI help: `bunx opencode-manager --help` shows key bindings

### CLI Mode (Scripting)
- Projects: `bunx opencode-manager projects list --format json`
- Sessions: `bunx opencode-manager sessions list --project <id> --limit 10`
- Chat: `bunx opencode-manager chat search --query "fix bug" --format ndjson`
- Tokens: `bunx opencode-manager tokens global --format table`
- Delete with backup: `bunx opencode-manager sessions delete --session <id> --yes --backup-dir ./backups`
- Dry run: `bunx opencode-manager projects delete --id <id> --dry-run`

### Global CLI Options
- `--root <path>` — Metadata store root (default: `~/.local/share/opencode`)
- `--format <json|ndjson|table>` — Output format (default: `table`)
- `--limit <n>` — Max records (default: 200)
- `--sort <updated|created>` — Sort order (default: `updated`)
- `--yes` — Skip confirmation for destructive ops
- `--dry-run` — Preview changes without executing
- `--quiet` — Suppress non-essential output
- `--clipboard` — Copy output to clipboard
- `--backup-dir <path>` — Backup before deletion

### Exit Codes
- 0: Success
- 1: Internal error
- 2: Usage/validation error (missing `--yes`, bad args)
- 3: Resource not found (invalid project/session/message ID)
- 4: File operation error (backup/delete failure)

### TUI Keys
- Global: `Tab`/`1`/`2` switch tabs, `/` search, `X` clear search, `R` reload, `Q` quit, `?` help
- Projects: `Space` select, `A` select all, `M` toggle missing, `D` delete, `Enter` view sessions
- Sessions: `Space` select, `S` sort, `D` delete, `Y` copy ID, `Shift+R` rename, `M` move, `P` copy, `C` clear filter

### Optional
- tmux: `tmux new -s opencode-manager 'bun run tui'`

Packaging & Publish Checklist
-----------------------------
1. Install dependencies with `bun install` (Bun v1.1+ only).
2. Type-check via `bun run typecheck` (runs `tsc --noEmit`).
3. Update the version in `package.json` as needed.
4. Run `npm publish` (package exposes the Bun-native `opencode-manager` bin with public access).

Outstanding Recommendations (Not Yet Implemented)
-------------------------------------------------
- TUI polish
  - Colorize project state in list labels (e.g., green for present, red for missing, gray for unknown).
  - Show a small timestamp snippet for Projects rows (created).
  - Add tiny icons or color accents to distinguish created vs updated descriptions in Sessions.
  - Add per-view mini legends with colored key chips under the panels (Projects/Sessions), consistent with the Help styling.
  - Show filtered counts (e.g., "Showing X of Y").
- Search enhancements
  - Optional fuzzy matching toggle in TUI; persist search and sort preferences per tab.
  - Save last-used search/sort to a small state file and restore on next launch.
- Accessibility & layout
  - Ensure all active/inactive/focused states have adequate contrast and consistent highlight styles.
  - Provide a monochrome theme option for minimal terminals.
- Performance
  - Debounce UI reactions to large search queries; short-circuit expensive filters when query is empty.
- Testing
  - Add integration tests for CLI commands with real fixture data.
  - Add basic snapshot/E2E tests for TUI rendering (if headless renderer available for @opentui).
- CLI enhancements
  - Shell completion scripts (bash/zsh/fish).
  - `--json-lines` alias for `--format ndjson` compatibility.
  - Template/profile support for common option combinations.

Notes
-----
- The TUI uses the OpenTUI renderer’s constraint that all textual content must be inside a `<text>` node; helpers now filter whitespace-only string children to avoid runtime errors.
- The environment here blocks tmux sockets under `/tmp`; running directly with `bun run tui` is fine. In normal shells, tmux can be used for convenience.

ASCII Snapshots
---------------
The following mockups illustrate the current UI layout and labels. Colors are omitted in ASCII; key chips like `[Q]` or `[Enter]` are literal.

Projects (path-first labels, details on the right)
```
 Tabs: [1] Projects [2] Sessions | Active: projects | Global: Tab switch, / search, X clear, R reload, Q quit, ? help

 ┌──────────────────────────────── Projects ────────────────────────────────┐
 │ Filter: all                                                             │
 │ Total: 12 | Missing: 1 | Selected: 2                                    │
 │ Keys: Space select, A select all, M toggle missing, D delete, Enter...  │
 │                                                                          │
 │  [*] #1 ~/work/app                                                      │
 │  [ ] #2 ~/work/tools/opencode                                           │
 │  [ ] #3 ~/work/svc/auth                                                 │
 │  [ ] #4 ~/work/svc/payments (missing)                                   │
 │  ...                                                                     │
 │                                                                          │
 │  ┌────────────── Details ───────────────┐                                │
 │  │ Project: app         State: present │                                │
 │  │ Bucket: project      VCS: git       │                                │
 │  │ Created: 2025-11-08 12:41           │                                │
 │  │ Path:                                 │                              │
 │  │   /home/user/work/app                 │                              │
 │  └──────────────────────────────────────┘                                │
 └──────────────────────────────────────────────────────────────────────────┘
```

Sessions (title-first labels, sort snippet per row, search + filter header)
```
 Tabs: [1] Projects [2] Sessions | Active: sessions | Global: Tab switch, / search, X clear, R reload, Q quit, ? help

 Search (sessions): /fix oauth                         — Enter apply • Esc clear

 ┌──────────────────────────────── Sessions ───────────────────────────────┐
 │ Filter: project app | Sort: updated | Search: fix oauth | Selected: 0   │
 │ Keys: Space select, S sort, D delete, C clear filter, Enter details...   │
 │                                                                          │
 │  [ ] #1 Fix OAuth callback handling (v1.3.0)            updated: 2025-11-08 14:02 │
 │  [ ] #2 Improve login UX (v1.2.9)                       updated: 2025-11-08 13:21 │
 │  [ ] #3 Add metrics to auth (v1.2.8)                    updated: 2025-11-07 19:44 │
 │  ...                                                                     │
 │                                                                          │
 │  ┌────────────── Details ───────────────┐                                │
 │  │ Session: sess_2   Version: v1.2.9   │                                │
 │  │ Title: Improve login UX             │                                │
 │  │ Project: app                        │                                │
 │  │ Updated: 2025-11-08 13:21           │                                │
 │  │ Directory:                          │                                │
 │  │   /home/user/work/app               │                                │
 │  └──────────────────────────────────────┘                                │
 └──────────────────────────────────────────────────────────────────────────┘
```

Help Screen (two columns with key chips, reduced wall-of-text)
```
 ┌────────────────────────────── Help ─────────────────────────────────────┐
 │ Quick reference for keys and actions                                    │
 │                                                                          │
 │  ┌─Global──────────────────────────┐  ┌─Sessions──────────────────────┐  │
 │  │ • [Tab]/[1]/[2] — Switch tabs    │  │ • Move: [Up]/[Down]           │  │
 │  │ • [/] — start search, [X] clear │  │ • Select: [Space]              │  │
 │  │ • [R] — Reload active view      │  │ • Sort: [S] (updated/created)  │  │
 │  │ • [?]/[H] — Toggle help         │  │ • Delete: [D] (confirm)        │  │
 │  │ • Quit: [Q]                     │  │ • Details: [Enter]             │  │
 │  └─────────────────────────────────┘  └────────────────────────────────┘  │
 │  ┌─Projects────────────────────────┐  ┌─Tips───────────────────────────┐  │
 │  │ • Move: [Up]/[Down]             │  │ • Use [M] to isolate missing   │  │
 │  │ • Select: [Space] / [A] all     │  │ • Press [R] to refresh         │  │
 │  │ • Filter missing: [M]           │  │ • Dismiss help: [Enter]/[Esc]  │  │
 │  │ • Delete: [D] (confirm)         │  └────────────────────────────────┘  │
 │  │ • Open sessions: [Enter]        │                                     │
 │  └─────────────────────────────────┘                                     │
 └──────────────────────────────────────────────────────────────────────────┘
```
