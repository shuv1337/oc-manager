#!/usr/bin/env bash
set -euo pipefail

version="$(opencode --version)"
out="$HOME/repos/research/opencode/opencode-${version}-spec.json"

opencode generate > "$out"

prev_spec="$(ls -1t "$HOME/repos/research/opencode"/opencode-*-spec.json 2>/dev/null | grep -v "$out" | head -n 1 || true)"
if [[ -n "${prev_spec:-}" ]]; then
  echo "Diff vs previous spec ($prev_spec):"
  if command -v delta >/dev/null 2>&1; then
    delta "$prev_spec" "$out" || true
  else
    diff -u "$prev_spec" "$out" || true
  fi
else
  echo "No previous spec found to diff against"
fi

echo "Generated opencode spec v${version}"
echo "File: $out"
