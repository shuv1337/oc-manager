# Project Plan: CLI Feature Parity with TUI

Date: 2026-01-05
Revised: 2026-01-05 (post-review)

## Problem Statement / Context
OpenCode Metadata Manager is currently a Bun + TypeScript TUI that can inspect, search, and modify OpenCode metadata stored on disk. The current CLI entry (`opencode-manager`) only launches the TUI and supports `--root` and `--help` via a minimal argument parser inside the TUI. We need full CLI functionality so the tool can be used programmatically, with feature parity to the TUI.

Additional context from this conversation:
- The CLI must cover all TUI capabilities (listing, search, delete, rename, move/copy, chat viewing/search, token summaries, etc.).
- Tests are required for new features and must live under `tests/` at the project root.
- No GitHub issue was provided for this plan.

## Goals
- Provide a non-interactive CLI with full feature parity with the TUI.
- Support programmatic consumption via JSON/NDJSON/table output and stable exit codes.
- Preserve existing TUI workflows and entrypoints (`bunx opencode-manager`, `bun run tui`, `manage_opencode_projects.py`).
- Reuse the existing data layer so TUI and CLI stay consistent.

## Non-Goals
- No changes to the on-disk OpenCode metadata schema.
- No network APIs or external services.
- No redesign of the TUI or key bindings.

## Current State (Baseline)
### TUI feature inventory
From `src/opencode-tui.tsx` and `README.md`:
- List projects and sessions under a metadata root.
- Filter projects by missing-only; select all or individual items.
- Fuzzy search sessions (fast-fuzzy) and tokenized search for projects.
- Delete project/session metadata with confirmation.
- Jump from project to sessions with a project filter.
- Sort sessions by updated/created.
- Rename sessions, move sessions, copy sessions (batch support).
- View session chat history; search across chat content.
- Token summaries per session, per project, and globally.
- Copy session IDs and message content to clipboard (TUI convenience).

### Existing CLI/entrypoints
- `src/bin/opencode-manager.ts` is a 5-line shim that imports `../opencode-tui` directly.
- `src/opencode-tui.tsx` contains `parseArgs()` (around line 2010) supporting `--root` and `--help` only.
- `manage_opencode_projects.py` is a legacy launcher that forwards args to `bun run tui`.

### Internal code references
- `src/opencode-tui.tsx` (TUI UI, keyboard handling, search, overlays, parseArgs)
- `src/lib/opencode-data.ts` (filesystem reads/writes, tokens, chat indexing/search)
- `src/bin/opencode-manager.ts` (bin entrypoint - currently just imports TUI)
- `manage_opencode_projects.py` (legacy wrapper)
- `package.json` (bin, scripts, dependencies)
- `README.md` (usage and features)
- `PROJECT-SUMMARY.md` (architecture summary)
- `tests/` (test location - to be created)

## External References (Code Search)
These references were gathered via code search to guide CLI structure and patterns:

| Purpose | Git URL |
| --- | --- |
| Commander CLI patterns and subcommands | https://github.com/tj/commander.js |
| TypeScript + Commander starter layout | https://github.com/lukasbach/cli-ts-commander-starter |
| Alternative CLI framework (oclif example) | https://github.com/oclif/example-plugin-ts |

## Decisions & Rationale
| Decision | Rationale |
| --- | --- |
| Use Commander ^12.0.0 for CLI parsing and subcommands | Multiple commands and shared options benefit from a mature, structured parser. Commander is widely used and works with Bun ESM. |
| Keep `opencode-manager` default to TUI when no subcommand is provided | Preserves existing usage (`bunx opencode-manager --root ...`) while adding CLI functionality. |
| Provide JSON/NDJSON/table output for all read operations | Enables programmatic consumption and stable automation. Table format for human readability. |
| Mirror TUI search semantics (fast-fuzzy for sessions) | Ensures true feature parity and consistent results across UI and CLI. |
| Require `--yes` (or `--force`) for destructive actions | Prevents accidental data loss in non-interactive contexts; `--dry-run` remains safe. |
| Support `OPENCODE_ROOT` environment variable | Common pattern for CLI tools; simplifies scripting and CI usage. |
| Refactor TUI to be importable as a function | Current bin entry imports TUI module which immediately executes; need deferred execution for CLI routing. |
| Extract shared utilities to `src/lib/` | Search logic, clipboard, output formatting should be reusable by both TUI and CLI. |

## Technical Specifications

### Exit Codes
| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | General error (unexpected failure) |
| `2` | Invalid arguments or usage error |
| `3` | Resource not found (session ID, project ID, message ID) |
| `4` | Permission denied or file operation failed |

### CLI command layout (parity mapping)

| TUI feature | CLI command | Notes |
| --- | --- | --- |
| List projects | `opencode-manager projects list` | Supports `--missing-only`, `--search`, `--format` |
| List sessions | `opencode-manager sessions list` | Supports `--project`, `--search`, `--sort`, `--limit` |
| Delete projects | `opencode-manager projects delete` | Requires `--yes`; supports `--dry-run`, `--backup-dir` |
| Delete sessions | `opencode-manager sessions delete` | Requires `--yes`; supports `--dry-run`, `--backup-dir` |
| Rename session | `opencode-manager sessions rename` | By session id; validates non-empty title |
| Move sessions | `opencode-manager sessions move` | By session id(s); preserves ids |
| Copy sessions | `opencode-manager sessions copy` | By session id(s); new ids created |
| View chat history | `opencode-manager chat list --session <id>` | Returns message index; `--include-parts` optional |
| View message content | `opencode-manager chat show` | By `--message <id>` or `--index <n>`; returns parts and full text |
| Search chat content | `opencode-manager chat search` | Uses `searchSessionsChat` + limits |
| Token summaries | `opencode-manager tokens session\|project\|global` | Uses existing token helpers |
| Copy session id / message text | `--clipboard` optional flag | Defaults to stdout; clipboard remains opt-in |
| TUI help | `opencode-manager tui --help` | Keeps existing text and behavior |

### Global flags and configuration

| Flag | Env Variable | Description | Default |
| --- | --- | --- | --- |
| `--root <path>` | `OPENCODE_ROOT` | Metadata root directory | `~/.local/share/opencode` |
| `--format <json\|ndjson\|table>` | - | Output format | `json` |
| `--limit <n>` | - | Maximum results for list/search | `200` (match TUI cap) |
| `--sort <updated\|created>` | - | Sort order for sessions | `updated` |
| `--yes` / `--force` | - | Skip confirmations for destructive ops | `false` |
| `--dry-run` | - | Show planned changes without writing | `false` |
| `--quiet` | - | Suppress non-essential output | `false` |
| `--clipboard` | - | Copy output to clipboard when relevant | `false` |
| `--backup-dir <path>` | - | Copy files to backup dir before deletion | (none) |

### Output schemas (JSON)
All dates are ISO strings or null. Paths are absolute, resolved paths.

```ts
type ProjectRecordOut = {
  index: number
  bucket: "project" | "sessions"
  projectId: string
  worktree: string
  vcs: string | null
  createdAt: string | null
  state: "present" | "missing" | "unknown"
  filePath: string
}

type SessionRecordOut = {
  index: number
  sessionId: string
  projectId: string
  directory: string
  title: string
  version: string
  createdAt: string | null
  updatedAt: string | null
  filePath: string
}

type TokenSummaryOut = {
  kind: "known" | "unknown"
  reason?: "missing" | "parse_error" | "no_messages"
  tokens?: {
    input: number
    output: number
    reasoning: number
    cacheRead: number
    cacheWrite: number
    total: number
  }
}

type ChatMessageOut = {
  index: number              // 1-based index for --index lookups
  sessionId: string
  messageId: string
  role: "user" | "assistant" | "unknown"
  createdAt: string | null
  parentId?: string
  tokens?: TokenSummaryOut["tokens"]
  previewText: string
  totalChars: number | null
}

type ChatPartOut = {
  partId: string
  messageId: string
  type: "text" | "subtask" | "tool" | "unknown"
  text: string
  toolName?: string
  toolStatus?: string
}

type ChatSearchResultOut = {
  sessionId: string
  sessionTitle: string
  projectId: string
  messageId: string
  role: "user" | "assistant" | "unknown"
  matchedText: string
  fullText: string
  partType: "text" | "subtask" | "tool" | "unknown"
  createdAt: string | null
}
```

### Table output format specification

Table output uses fixed-width columns with the following rules:
- **Truncation**: Values exceeding column width are truncated with `...`
- **Alignment**: Text left-aligned, numbers right-aligned
- **Headers**: Column names in UPPERCASE, separated by `|`
- **Separator**: Dashed line below headers

#### `projects list` table format
```
INDEX | STATE   | PROJECT_ID          | WORKTREE                          | CREATED
------|---------|---------------------|-----------------------------------|-------------------
1     | present | proj_abc123         | ~/work/my-app                     | 2025-11-08 12:41
2     | missing | proj_def456         | ~/work/old-project                | 2025-10-15 09:22
```
Column widths: INDEX(5), STATE(7), PROJECT_ID(20), WORKTREE(35), CREATED(19)

#### `sessions list` table format
```
INDEX | SESSION_ID          | PROJECT_ID          | TITLE                    | UPDATED
------|---------------------|---------------------|--------------------------|-------------------
1     | sess_abc123         | proj_xyz            | Fix OAuth callback       | 2025-11-08 14:02
2     | sess_def456         | proj_xyz            | Improve login UX         | 2025-11-08 13:21
```
Column widths: INDEX(5), SESSION_ID(20), PROJECT_ID(20), TITLE(25), UPDATED(19)

#### `chat list` table format
```
INDEX | ROLE      | MESSAGE_ID          | CREATED             | PREVIEW
------|-----------|---------------------|---------------------|---------------------------
1     | user      | msg_abc123          | 2025-11-08 14:02    | Help me fix this bug...
2     | assistant | msg_def456          | 2025-11-08 14:03    | I'll help you debug...
```
Column widths: INDEX(5), ROLE(9), MESSAGE_ID(20), CREATED(19), PREVIEW(30)

#### `tokens` table format
```
METRIC        | VALUE
--------------|------------
Input         | 125.4k
Output        | 45.2k
Reasoning     | 12.1k
Cache Read    | 89.3k
Cache Write   | 15.0k
Total         | 287.0k
```

### Entrypoint architecture (revised)

The current bin entry immediately imports the TUI which auto-executes. The new architecture:

```
src/
  bin/
    opencode-manager.ts    # CLI router - parses args BEFORE any imports
  cli/
    index.ts               # Commander program setup
    commands/
      projects.ts          # projects list, delete
      sessions.ts          # sessions list, delete, rename, move, copy
      chat.ts              # chat list, show, search
      tokens.ts            # tokens session, project, global
      tui.ts               # tui subcommand (launches TUI)
    formatters/
      json.ts              # JSON output
      ndjson.ts            # NDJSON streaming output
      table.ts             # Table output
  lib/
    opencode-data.ts       # Existing data layer (unchanged)
    search.ts              # NEW: Extract fuzzy search logic from TUI
    clipboard.ts           # NEW: Extract clipboard logic from TUI
    output.ts              # NEW: Shared output formatting
  tui/
    index.ts               # NEW: Export TUI as launchTUI(options) function
    app.tsx                # Renamed from opencode-tui.tsx, refactored
tests/
  fixtures/                # Test metadata stores
  cli/
    projects.test.ts
    sessions.test.ts
    chat.test.ts
    tokens.test.ts
  lib/
    search.test.ts
    opencode-data.test.ts
```

The key change: `src/bin/opencode-manager.ts` will:
1. Parse `process.argv` to detect subcommands BEFORE importing anything
2. If no subcommand or `tui` subcommand: dynamically import and launch TUI
3. If CLI subcommand: dynamically import and run CLI

```ts
#!/usr/bin/env bun
// src/bin/opencode-manager.ts - CLI router
const args = process.argv.slice(2)
const firstArg = args[0]

// TUI-only flags that should launch TUI directly
const tuiOnlyFlags = ['--help', '-h', '--root']
const isCliSubcommand = firstArg && !firstArg.startsWith('-') && firstArg !== 'tui'

if (isCliSubcommand) {
  // Dynamically import CLI to avoid loading TUI
  const { runCLI } = await import('../cli/index.js')
  await runCLI(args)
} else {
  // Launch TUI (default behavior preserved)
  const { launchTUI } = await import('../tui/index.js')
  await launchTUI(args)
}
```

### Integration points
- Reuse existing functions in `src/lib/opencode-data.ts` for loading and mutations.
- Extract fuzzy search from TUI into `src/lib/search.ts` for shared use.
- Extract clipboard from TUI into `src/lib/clipboard.ts` for shared use.
- Add CLI-only helpers (formatting, output) in `src/cli/formatters/`.
- Update `src/bin/opencode-manager.ts` to route to CLI or TUI via dynamic imports.
- Update `manage_opencode_projects.py` to support CLI subcommands (see below).

### Legacy Python wrapper updates

The `manage_opencode_projects.py` wrapper will be updated to pass subcommands through:

```python
# Current behavior (preserved):
#   manage_opencode_projects.py --root /path
#   -> bun run tui -- --root /path

# New behavior (added):
#   manage_opencode_projects.py projects list --root /path
#   -> bun src/bin/opencode-manager.ts projects list --root /path

# Detection: if first positional arg is a known subcommand, use CLI mode
CLI_SUBCOMMANDS = {'projects', 'sessions', 'chat', 'tokens'}
```

## Implementation Plan

### Milestone 0: Test infrastructure setup
- [ ] Create `tests/` directory at project root.
- [ ] Create `tests/fixtures/` with sample metadata stores for testing.
- [ ] Add `"test": "bun test"` script to `package.json`.
- [ ] Add basic test for existing `loadProjectRecords` to verify setup.

Validation criteria:
- [ ] `bun test` runs and passes with at least one test.
- [ ] Fixture data is loadable by test code.

### Milestone 1: CLI foundation (entrypoint + command skeleton)
- [ ] Refactor TUI into `src/tui/index.ts` exporting `launchTUI(args)` function.
- [ ] Move `src/opencode-tui.tsx` to `src/tui/app.tsx` and update imports.
- [ ] Extract `parseArgs()` from TUI into shared location or inline in `launchTUI`.
- [ ] Create `src/cli/index.ts` with Commander setup and shared global options.
- [ ] Add `commander@^12.0.0` to `package.json` dependencies.
- [ ] Create command stubs: `projects`, `sessions`, `chat`, `tokens`, `tui`.
- [ ] Rewrite `src/bin/opencode-manager.ts` as CLI router (see architecture above).
- [ ] Extract `copyToClipboard` from TUI to `src/lib/clipboard.ts`.
- [ ] Update `manage_opencode_projects.py` to detect and pass CLI subcommands.

Validation criteria:
- [ ] `bunx opencode-manager` still opens the TUI (backward compatible).
- [ ] `bunx opencode-manager tui --help` prints the existing TUI help text.
- [ ] `bunx opencode-manager projects list --help` shows CLI help and exits 0.
- [ ] `bunx opencode-manager --version` prints version from package.json.
- [ ] `OPENCODE_ROOT=/tmp/test bunx opencode-manager projects list` uses env var.

### Milestone 2: Read-only commands (projects/sessions/tokens)
- [ ] Extract fuzzy search logic from TUI to `src/lib/search.ts`.
- [ ] Implement `projects list` with filters (`--missing-only`, `--search`, `--limit`).
- [ ] Implement `sessions list` with `--project`, `--search` (fast-fuzzy), `--sort`, and `--limit`.
- [ ] Implement `tokens session --session <id>`, `tokens project --project <id>`, and `tokens global`.
- [ ] Implement JSON formatter in `src/cli/formatters/json.ts`.
- [ ] Implement NDJSON formatter in `src/cli/formatters/ndjson.ts`.
- [ ] Implement table formatter in `src/cli/formatters/table.ts` per specification.

Validation criteria:
- [ ] CLI list output matches the same records visible in the TUI for a fixture store.
- [ ] Fuzzy search results in CLI match TUI ordering for identical queries.
- [ ] Token summaries match TUI values for the same session/project/root.
- [ ] `--format table` produces human-readable output per spec.
- [ ] `--format ndjson` streams one record per line.

### Milestone 3: Mutating commands (delete/rename/move/copy)
- [ ] Implement `projects delete --id <id...>` with `--yes`, `--dry-run`, `--backup-dir`.
- [ ] Implement `sessions delete --session <id...>` with `--yes`, `--dry-run`, `--backup-dir`.
- [ ] Implement `sessions rename --session <id> --title <title>` using `updateSessionTitle`.
- [ ] Implement `sessions move --session <id...> --to <projectId>` using `moveSessions`.
- [ ] Implement `sessions copy --session <id...> --to <projectId>` using `copySessions`.
- [ ] Add ID-to-record resolution helpers that mirror TUI selection logic.
- [ ] Implement backup functionality: copy files to `--backup-dir` before deletion.

Validation criteria:
- [ ] `--dry-run` outputs the exact file paths that would be modified (exit 0).
- [ ] `--backup-dir` creates copies before deletion.
- [ ] Mutations update the on-disk JSON and are reflected in subsequent `sessions list` calls.
- [ ] CLI exits with code 3 on invalid IDs or missing targets.
- [ ] CLI exits with code 2 if `--yes` not provided for destructive operations.

### Milestone 4: Chat history + chat search commands
- [ ] Implement `chat list --session <id>` returning message index data (no parts by default).
- [ ] Implement `chat show --session <id> --message <msgId>` returning full content and parts.
- [ ] Implement `chat show --session <id> --index <n>` as alternative to `--message`.
- [ ] Implement `chat search --query <q> [--project <id>] [--limit <n>]` using `searchSessionsChat`.
- [ ] Add `--clipboard` flag support for `chat show` to copy message text.
- [ ] Add `--include-parts` flag for `chat list` to include part details.

Validation criteria:
- [ ] `chat list` ordering matches the TUI viewer (createdAt ascending).
- [ ] `chat show --index 1` returns the first message (1-based indexing).
- [ ] `chat show` includes the same combined text as the TUI preview/full view.
- [ ] `chat search` returns the same matched snippets as the TUI search overlay.
- [ ] `--clipboard` copies to system clipboard (Linux/macOS).

### Milestone 5: Docs and tests
- [ ] Add CLI usage documentation to `README.md` (commands, examples, output formats).
- [ ] Update `PROJECT-SUMMARY.md` to include the new CLI architecture.
- [ ] Add unit tests for `src/lib/search.ts` (fuzzy search ordering).
- [ ] Add unit tests for `src/lib/opencode-data.ts` helpers.
- [ ] Add integration tests for CLI commands against fixture stores.
- [ ] Add tests for:
  - [ ] Listing projects/sessions (all formats)
  - [ ] Fuzzy search ordering matches TUI
  - [ ] Token summaries
  - [ ] Rename/move/copy/delete behavior with `--dry-run`
  - [ ] Chat list/show/search output
  - [ ] Exit codes for error conditions

Validation criteria:
- [ ] All tests in `tests/` pass via `bun test`.
- [ ] README examples can be run verbatim against fixtures.
- [ ] Code coverage includes all CLI commands.

## Implementation Order / Dependencies

```
Milestone 0 (test infra)
    |
    v
Milestone 1 (CLI foundation) ──────────────────┐
    |                                          |
    v                                          v
Milestone 2 (read-only)              Milestone 3 (mutations)
    |                                          |
    └──────────────┬───────────────────────────┘
                   |
                   v
            Milestone 4 (chat)
                   |
                   v
            Milestone 5 (docs/tests)
```

1. Milestone 0 (test infra) should be done first to enable TDD.
2. Milestone 1 (CLI foundation) must land before any CLI command work.
3. Milestones 2 and 3 can be worked in parallel after Milestone 1.
4. Milestone 4 (chat) depends on shared output formatting from Milestone 2.
5. Milestone 5 (docs/tests) wraps up validation and documentation.

## Risks and Mitigations
| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Breaking TUI entrypoint by changing bin behavior | Medium | High | Preserve default TUI path when no subcommand; comprehensive backward-compat tests |
| CLI output mismatches TUI results (search ordering) | Medium | Medium | Extract search logic to shared module; add comparison tests |
| Large stores cause slow CLI searches | Low | Medium | Preserve TUI result cap (200); add `--limit` with sensible defaults |
| Dynamic imports fail in some Bun versions | Low | High | Pin Bun version in engines; test on CI with target version |
| Table output formatting edge cases | Low | Low | Comprehensive test fixtures with edge cases (long titles, null values) |

## Resolved Questions (from review)
| Question | Decision | Rationale |
| --- | --- | --- |
| CLI default output format when interactive? | `json` always | Predictable for scripting; users can add `--format table` explicitly |
| Environment variable for root? | Yes, `OPENCODE_ROOT` | Standard CLI pattern; simplifies CI and scripting |
| Clipboard support platforms? | Linux/macOS only | Windows would require additional dependency; document limitation |
| Test directory location? | `tests/` at project root | No `packages/` directory exists; flat project structure |

## Open Questions / Follow-ups
- Should we add shell completion scripts (bash/zsh/fish) for CLI commands?
- Should `--format` support custom templates (e.g., `--format "{{.sessionId}}: {{.title}}"`)?
- Should we add a `--json-lines` alias for `--format ndjson` for discoverability?
