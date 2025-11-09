# OpenCode Metadata Manager

Terminal UI for inspecting, filtering, and pruning OpenCode metadata stored on disk. The app is written in TypeScript, runs on Bun, and renders with [`@opentui/react`](https://github.com/open-tui/opentui).

## Screenshots

<p align="center">
  <img src="home-screen.png" alt="OpenCode Metadata Manager home screen showing projects and sessions" width="85%" />
  <br />
  <em>Main workspace with Projects (left) and Sessions (right) panels.</em>
</p>

<p align="center">
  <img src="help-screen.png" alt="OpenCode Metadata Manager help overlay" width="85%" />
  <br />
  <em>Contextual help overlay with key bindings and tips.</em>
</p>

## Features
- List both OpenCode projects and sessions from a local metadata root.
- Filter by “missing only”, bulk-select, and delete metadata safely.
- Jump from a project directly to its sessions and keep contextual filters.
- Global search bar (`/` to focus, `Enter` to apply, `Esc` or `X` to clear).
- Rich help overlay with live key hints (`?` or `H`).
- Zero-install via `bunx` so even CI shells can run it without cloning.

## Requirements
- [Bun](https://bun.sh) **1.1.0+** (developed/tested on 1.2.x).
- A node-compatible terminal (truecolor improves readability but is optional).

## Installation
```bash
# Clone the repo and install deps
git clone git@github.com:kcrommett/oc-manager.git
cd oc-manager
bun install

# Or run on demand without cloning
bunx opencode-manager --help
```

The repository ships with a focused `.gitignore`, keeping `node_modules/`, caches, and logs out of Git history.

## Usage
```bash
# Preferred: zero-install command
bunx opencode-manager --root ~/.local/share/opencode

# Local dev run (forwards extra args after --)
bun run tui -- --root ~/.local/share/opencode

# Legacy Python wrapper (still used by some automation)
./manage_opencode_projects.py --root ~/.local/share/opencode -- --help
```

Keyboard reference:
- **Global**: `Tab`/`1`/`2` switch tabs, `/` search, `X` clear search, `R` reload, `Q` quit, `?` help.
- **Projects**: `Space` toggle selection, `A` select all, `M` missing-only filter, `D` delete, `Enter` jump to Sessions.
- **Sessions**: `Space` select, `S` toggle updated/created sort, `D` delete, `C` clear project filter, `Enter` details.

## Development Workflow
1. Install dependencies with `bun install`.
2. Run the TUI via `bun run tui` (pass storage flags after `--`).
3. Use `bun run dev` for watch mode.
4. Type-check with `bun run typecheck` (`tsc --noEmit`).

### Project Structure
```
src/
  bin/opencode-manager.ts   # Bun-native CLI shim exposed as the bin entry
  opencode-tui.tsx          # Main TUI implementation (panels, search, help)
manage_opencode_projects.py # Legacy Python launcher for backwards compatibility
opencode-gen.sh             # Spec snapshot helper script
PROJECT-SUMMARY.md          # Extended design notes & roadmap
```

## Packaging & Publish
1. `bun install`
2. `bun run typecheck`
3. Update `version` in `package.json`
4. `npm publish` (package exposes the `opencode-manager` bin with public access)

## Troubleshooting
- **tmux failures**: Some sandboxed environments block tmux sockets under `/tmp`. Run `bun run tui` directly if tmux refuses to start.
- **Rendering glitches**: OpenTUI expects all textual content inside `<text>` nodes. When adding UI components, follow the existing helpers (e.g., `KeyChip`, `Bullet`).
- **Search won’t clear**: Press `Esc` while the search bar is focused, or hit `X` while in normal navigation.

## Contributing
Issues and pull requests are welcome. Please include reproduction steps for metadata edge cases and run `bun run typecheck` before submitting patches.

## License
MIT © OpenCode contributors. See [`LICENSE`](./LICENSE).
