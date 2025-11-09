OpenCode Metadata Manager — Project Summary
==========================================

Overview
--------
- Purpose: Inspect, filter, and clean OpenCode metadata stored on disk.
- Scope: Lists projects and sessions from local storage; supports filtering, search, interactive selection and deletion, and quick navigation between views.
- UI: Terminal UI built with @opentui/react.

Architecture
------------
- Entry: `opencode/src/opencode-tui.tsx` — main TUI app and panels.
- Data layer: `opencode/src/lib/opencode-data.ts` — reads/writes metadata JSON, computes derived fields, formatting helpers.
- Scripts: `opencode/package.json` → `bun run tui` runs the app.
- CLI wrapper: `opencode/manage_opencode_projects.py` preserves the legacy entry point, resolves Bun (`--bun` overrides PATH), sets `--root` (defaults to `~/.local/share/opencode`), and forwards any extra args after `--` directly to the TUI.
- Spec diff script: `opencode/opencode-gen.sh` shells out to `opencode generate`, saves the JSON spec under `~/repos/research/opencode/opencode-<version>-spec.json`, and diffs it against the previous snapshot (prefers `delta`, falls back to `diff`).

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
  - Sort toggle (S) between “updated” and “created”.
  - Each row shows a timestamp snippet for the active sort (created/updated).
  - Details pane includes title, project ID, updated time, and directory.
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
- Switched Projects list labels to show path instead of project ID; kept ID in the details panel.
- Sessions list uses session title prominently; added title to details; updated onSelect/Enter status lines to show title and ID.
- Redesigned Help screen into two columns with color-coded sections and key chips; removed wall-of-text effect.
- Added a small color palette and helper components (Section, Row, Bullet, Columns, KeyChip) to simplify consistent styling.
- Implemented a global Search bar and input mode:
  - “/” to start, Enter to apply, Esc or “X” to clear.
  - Projects: search `projectId` and `worktree`; Sessions: search `title`, `sessionId`, `directory`, `projectId`.
- Sessions sorting & context:
  - “S” toggles sort by `updated`/`created`.
  - Show per-row description with the relevant timestamp.
- Fixed OpenTUI text rendering error by filtering whitespace-only raw text in layout helpers and by removing nested `<text>` nodes around key chips.
- Verified via `bun run tui` (tmux socket creation is blocked in this environment, but direct run works).

How To Run
----------
- Zero-install via npm: `bunx opencode-manager [--root /path/to/storage]` (preferred).
- Local dev: `bun run tui [-- --root /path/to/storage]`.
- Legacy launcher: `./manage_opencode_projects.py [--root PATH] [--bun /path/to/bun] [-- ...extra TUI args]` keeps older automation working while delegating to Bun.
- Keys:
  - Global: `Tab`/`1`/`2` switch tabs, `/` search, `X` clear search, `R` reload, `Q` quit, `?` help
  - Projects: `Space` select, `A` select all, `M` toggle missing, `D` delete, `Enter` view sessions
  - Sessions: `Space` select, `S` sort, `D` delete, `C` clear project filter, `Enter` details
- Optional tmux usage (when permitted): `tmux new -s opencode-tui 'bun run tui'`
- CLI help: `bun run tui -- --help` (or `bunx opencode-manager -- --help`, or `manage_opencode_projects.py -- --help`) prints the built-in usage block with key bindings.

Packaging & Publish Checklist
-----------------------------
1. Install dependencies with `bun install` (Bun v1.1+ only).
2. Type-check via `bun run typecheck` (runs `tsc --noEmit`).
3. Update the version in `package.json` as needed.
4. Run `npm publish` (package exposes the Bun-native `opencode-manager` bin with public access).

Outstanding Recommendations (Not Yet Implemented)
-------------------------------------------------
- UI polish
  - Colorize project state in list labels (e.g., green for present, red for missing, gray for unknown).
  - Show a small timestamp snippet for Projects rows (created).
  - Add tiny icons or color accents to distinguish created vs updated descriptions in Sessions.
  - Add per-view mini legends with colored key chips under the panels (Projects/Sessions), consistent with the Help styling.
  - Show filtered counts (e.g., “Showing X of Y”).
- Search enhancements
  - Optional fuzzy matching; toggle to include/exclude `directory` in Sessions/Projects search for more control.
  - Persist search and sort preferences per tab (and optionally per project filter) during the app run.
  - Save last-used search/sort to a small state file and restore on next launch.
- Accessibility & layout
  - Ensure all active/inactive/focused states have adequate contrast and consistent highlight styles.
  - Provide a monochrome theme option for minimal terminals.
- Performance
  - Debounce UI reactions to large search queries; short-circuit expensive filters when query is empty.
- Testing
  - Add unit coverage for opencode-data helpers (formatting, parsing, sorting).
  - Add basic snapshot/E2E tests for rendering key panels and Help using a headless renderer (if available for @opentui).
- Packaging/Docs
  - Add a README section specific to the TUI tool, with a short demo, common actions, and troubleshooting.

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
