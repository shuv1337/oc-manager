## Context and Goals
- Request: produce a comprehensive plan to update all documentation so it matches the current app behavior and codebase.
- Constraint: plan only; no implementation or doc edits in this task.
- Scope focus: repo-local documentation (`README.md`, `PROJECT-SUMMARY.md`, `plan.md`, `tests/fixtures/README.md`) plus any embedded usage text (e.g., CLI/TUI help, wrapper usage) that documentation references.

## Decisions and Rationale
- Source-of-truth is the current codebase, not prior docs, to avoid repeating outdated behavior.
- Include the CLI/TUI surface as “API” specs since there are no network endpoints; this is what users integrate with.
- Only use external sources if a doc claim depends on third-party behavior or upstream schema details.
- Preserve the project’s community-maintained disclaimer in `README.md` while updating the rest of the content.

## Issue Integration
- No GitHub issue provided; plan assumes “align documentation with current app state” is the sole requirement.

## Documentation Inventory (Targets to Update)
| Doc Path | Purpose | Notes for Update |
| --- | --- | --- |
| `README.md` | Primary user-facing doc (features, usage, CLI/TUI keys) | Likely needs version/requirements + command parity verification |
| `PROJECT-SUMMARY.md` | Architecture + design notes | Must match current file structure and feature set |
| `plan.md` | Historical backlog | Mark as historical or update headers to avoid misleading readers |
| `tests/fixtures/README.md` | Fixture schema + layout | Ensure schema details match current data layer expectations |

## Internal Source-of-Truth References
| Path | What It Defines |
| --- | --- |
| `package.json` | Version, Bun engine requirement, scripts |
| `src/bin/opencode-manager.ts` | CLI/TUI routing behavior |
| `src/cli/index.ts` | Global CLI options + defaults |
| `src/cli/commands/projects.ts` | `projects` subcommands + flags |
| `src/cli/commands/sessions.ts` | `sessions` subcommands + flags |
| `src/cli/commands/chat.ts` | `chat` subcommands + flags |
| `src/cli/commands/tokens.ts` | `tokens` subcommands + flags |
| `src/cli/output.ts` | Output format semantics |
| `src/cli/formatters/json.ts` | JSON envelope/metadata |
| `src/lib/opencode-data.ts` | Storage layout, data models, token logic, chat search |
| `src/lib/search.ts` | Search behavior (tokenized + fuzzy) |
| `src/lib/clipboard.ts` | Clipboard requirements (pbcopy/xclip) |
| `src/tui/args.ts` | TUI help text + key bindings |
| `src/tui/app.tsx` | TUI feature behavior (tokens, chat viewer/search, rename/move/copy) |
| `manage_opencode_projects.py` | Legacy wrapper usage + routing |
| `home-screen.png` | Main UI screenshot |
| `help-screen.png` | Help UI screenshot |

## External References (Use Only If Needed)
| Git URL | Why It Might Be Needed | Notes |
| --- | --- | --- |
| `https://github.com/open-tui/opentui` | Confirm UI library name/usage phrasing | Referenced in README |
| `https://github.com/oven-sh/bun` | Confirm Bun version requirements language | Aligns with `package.json` engines |
| `https://github.com/commander-js/commander.js` | If documenting CLI framework usage | Optional |
| `https://github.com/mattyork/fast-fuzzy` | If documenting fuzzy search behavior | Optional |

## Technical Specifications to Capture in Docs
### CLI Interface (Primary “API”)
- Global options (from `src/cli/index.ts`): `--root`, `--format`, `--limit`, `--sort`, `--yes`, `--dry-run`, `--quiet`, `--clipboard`, `--backup-dir`.
- Subcommands and flags:
  - `projects list` (`--missing-only`, `--search`)
  - `projects delete` (`--id`, `--yes`, `--dry-run`, `--backup-dir`)
  - `sessions list` (`--project`, `--search`)
  - `sessions delete` (`--session`, `--yes`, `--dry-run`, `--backup-dir`)
  - `sessions rename` (`--session`, `--title`)
  - `sessions move` (`--session`, `--to`)
  - `sessions copy` (`--session`, `--to`)
  - `chat list` (`--session`, `--include-parts`)
  - `chat show` (`--session`, `--message` or `--index`, uses global `--clipboard`)
  - `chat search` (`--query`, `--project`)
  - `tokens session` (`--session`)
  - `tokens project` (`--project`)
  - `tokens global` (no flags)
  - `tui` (launch TUI explicitly)
- Output formats (`json`, `ndjson`, `table`) including JSON envelope structure and list metadata.
- ID resolution behavior (exact match, optional prefix matching in CLI).

### TUI Behavior
- Key bindings from `src/tui/args.ts` including global actions, Projects view, Sessions view, chat search, and chat viewer.
- Features to describe: search modes, rename/move/copy, chat viewer, chat search, token summaries, confirmation workflows.

### Data Model and Storage Layout
```text
<root>/storage/
  project/<projectId>.json
  sessions/<projectId>.json
  session/<projectId>/<sessionId>.json
  message/<sessionId>/<messageId>.json
  part/<messageId>/<partId>.json
```
- Project schema: `id`, `worktree`, `vcs`, `time.created`.
- Session schema: `id`, `projectID`, `directory`, `title`, `version`, `time.created`, `time.updated`.
- Message schema: `id`, `sessionID`, `role`, `time.created`, `parentID`, `tokens.{input,output,reasoning,cache.read,cache.write}`.
- Part schema: `text`, `tool`, `subtask` parts plus tool status fields.
- Token summary fields used in UI/CLI: input/output/reasoning/cacheRead/cacheWrite/total.

### Configuration and Integration Points
| Item | Value/Behavior | Source |
| --- | --- | --- |
| Default root | `~/.local/share/opencode` | `src/lib/opencode-data.ts` |
| Bun requirement | `>=1.3.0` (package engine) | `package.json` |
| Clipboard | `pbcopy` (macOS), `xclip` (Linux), no Windows support | `src/lib/clipboard.ts`, `README.md` |
| Entry points | `src/bin/opencode-manager.ts`, `manage_opencode_projects.py` | Code + README |

## Implementation Plan (Milestones and Tasks)
### Milestone 1: Audit and Gap Analysis
- [ ] Inventory all doc claims in `README.md` and `PROJECT-SUMMARY.md` and map each claim to a source file.
- [ ] Compare Bun/version requirements in docs vs `package.json`.
- [ ] Diff CLI commands/options in docs vs `src/cli/**` (global options, subcommands, flags).
- [ ] Diff TUI key bindings in docs vs `src/tui/args.ts` and `src/tui/app.tsx`.
- [ ] Verify data model/storage layout in docs vs `src/lib/opencode-data.ts` and `tests/fixtures/README.md`.
- [ ] Identify any stale references (file paths, script names, module names).
- [ ] Record gaps and mismatches as a checklist for doc updates.

### Milestone 2: Update Core Documentation
- [ ] Update `README.md` requirements (Bun version) and installation commands to match `package.json`.
- [ ] Refresh `README.md` feature list to reflect current CLI + TUI behaviors (search, chat viewer, tokens, rename/move/copy).
- [ ] Update `README.md` CLI section with exact subcommands, global options, and output formats.
- [ ] Re-validate `README.md` examples to match current flags and output envelope details.
- [ ] Update `README.md` troubleshooting to match current known constraints (tmux note, clipboard behavior).
- [ ] Update `PROJECT-SUMMARY.md` architecture tree and module list to match current `src/` layout.
- [ ] Update `PROJECT-SUMMARY.md` feature summaries to align with actual CLI/TUI behavior and token handling.

### Milestone 3: Update Supplemental Documentation
- [ ] Update `tests/fixtures/README.md` to reflect the current message/part token schema and fields.
- [ ] Review `plan.md` for outdated statements; label as historical or update the intro to clarify its status.
- [ ] Update `manage_opencode_projects.py` usage references in docs (if any) to match wrapper behavior.
- [ ] Replace or annotate `home-screen.png` and `help-screen.png` if UI no longer matches descriptions.

### Milestone 4: External Reference Checks (If Needed)
- [ ] Use GitHub code search to confirm any third-party behaviors that docs describe (OpenTUI usage, fast-fuzzy semantics) and capture Git URLs in docs or footnotes.
- [ ] Ensure all third-party links point to canonical GitHub repos (for reproducible tooling).

### Milestone 5: Validation and Final Review
- [ ] Validate CLI help output vs documentation (`opencode-manager --help`, subcommand help).
- [ ] Validate TUI help text vs documentation (`bun run tui -- --help`).
- [ ] Spot-check command examples against fixture data or a real store to ensure correctness.
- [ ] Run a final doc consistency pass for file paths, script names, and version numbers.

## Validation Criteria
- [ ] Every CLI flag and subcommand documented matches `src/cli/**`.
- [ ] TUI key bindings match `src/tui/args.ts` and help overlay in `src/tui/app.tsx`.
- [ ] Data model and storage layout match `src/lib/opencode-data.ts` and fixtures.
- [ ] Requirements and scripts match `package.json`.
- [ ] Screenshot captions and descriptions match the current UI.

## Open Questions / Assumptions
- Are `home-screen.png` / `help-screen.png` up to date or should new screenshots be captured?
- Should `plan.md` remain as a historical log or be updated to a current roadmap?
- Are there any non-markdown docs outside this repo scope that should be included?
