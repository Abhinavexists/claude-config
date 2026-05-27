#!/usr/bin/env bash
# PostToolUse hook (Edit|Write): format the file Claude just touched.
# Silent skip when formatter is missing or file is unrecognized.
# Prefers project-local formatters (.venv, node_modules) over global.

set -uo pipefail

# Always succeed — never block Claude on a formatting failure.
trap 'exit 0' ERR

input="$(cat)"
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')

[[ -z "$file" ]] && exit 0
[[ ! -f "$file" ]] && exit 0

ext="${file##*.}"
dir="$(dirname "$file")"

# Walk up looking for project-local tooling.
find_local() {
  local name="$1" cur="$dir"
  while [[ "$cur" != "/" && "$cur" != "." ]]; do
    [[ -x "$cur/$name" ]] && { printf '%s' "$cur/$name"; return 0; }
    cur="$(dirname "$cur")"
  done
  return 1
}

run() {
  # Run quietly with a hard time cap so a slow formatter can't stall Claude.
  if command -v timeout >/dev/null 2>&1; then
    timeout 10 "$@" >/dev/null 2>&1 || true
  elif command -v gtimeout >/dev/null 2>&1; then
    gtimeout 10 "$@" >/dev/null 2>&1 || true
  else
    "$@" >/dev/null 2>&1 || true
  fi
}

case "$ext" in
  py)
    if   local_ruff=$(find_local ".venv/bin/ruff"); then run "$local_ruff" format "$file"
    elif command -v ruff  >/dev/null 2>&1; then         run ruff format "$file"
    elif command -v black >/dev/null 2>&1; then         run black -q "$file"
    fi
    ;;
  go)
    command -v gofmt >/dev/null 2>&1 && run gofmt -w "$file"
    ;;
  rs)
    command -v rustfmt >/dev/null 2>&1 && run rustfmt --edition 2021 "$file"
    ;;
  c|cc|cpp|cxx|h|hh|hpp)
    command -v clang-format >/dev/null 2>&1 && run clang-format -i "$file"
    ;;
  js|jsx|ts|tsx|json|md|mdx|css|scss|html|yml|yaml)
    if   local_p=$(find_local "node_modules/.bin/prettier"); then run "$local_p" --write "$file"
    elif command -v prettier >/dev/null 2>&1; then               run prettier --write "$file"
    fi
    ;;
  sh|bash)
    command -v shfmt >/dev/null 2>&1 && run shfmt -w "$file"
    ;;
esac

exit 0
