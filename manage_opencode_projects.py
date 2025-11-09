#!/usr/bin/env python3
"""Launch the OpenCode metadata TUI built with OpenTUI.

This wrapper keeps the previous entry point name but simply shells out to the
new Bun-powered React TUI located under ``src/opencode-tui.tsx``. Use
``manage_opencode_projects.py -- --help`` to see the TUI's runtime help text.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Sequence

DEFAULT_ROOT = Path.home() / ".local" / "share" / "opencode"
PROJECT_DIR = Path(__file__).resolve().parent


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Open the interactive OpenCode metadata manager TUI",
        epilog=(
            "Examples:\n"
            "  manage_opencode_projects.py\n"
            "    Launch the TUI using the default metadata root.\n\n"
            "  manage_opencode_projects.py --root /tmp/opencode\n"
            "    Launch the TUI against a different storage directory.\n\n"
            "  manage_opencode_projects.py -- --help\n"
            "    Show the TUI's built-in CLI help output.\n"
        ),
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=DEFAULT_ROOT,
        help="Metadata root to inspect (defaults to ~/.local/share/opencode)",
    )
    parser.add_argument(
        "--bun",
        type=Path,
        default=None,
        help="Optional path to the bun executable if it's not on PATH",
    )
    parser.add_argument(
        "tui_args",
        nargs=argparse.REMAINDER,
        help=(
            "Additional arguments forwarded to the TUI after '--'. For example: "
            "manage_opencode_projects.py -- --help"
        ),
    )
    return parser.parse_args(argv)


def find_bun(explicit: Path | None) -> str:
    if explicit:
        return str(explicit)
    bun_path = shutil.which("bun")
    if bun_path:
        return bun_path
    raise SystemExit("bun executable not found. Please install Bun to run the TUI.")


def launch_tui(root: Path, bun_exe: str, extra_args: Sequence[str]) -> int:
    # Normalize passthrough args: drop leading "--" if present
    if extra_args and len(extra_args) > 0 and extra_args[0] == "--":
        extra_args = extra_args[1:]
    cmd = [
        bun_exe,
        "run",
        "tui",
        "--",
        "--root",
        str(root.expanduser()),
    ]
    if extra_args:
        cmd.extend(extra_args)

    process = subprocess.run(cmd, cwd=PROJECT_DIR)
    return process.returncode


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    bun_exe = find_bun(args.bun)
    extra_args = list(args.tui_args or [])
    return launch_tui(args.root, bun_exe, extra_args)


if __name__ == "__main__":
    sys.exit(main())
