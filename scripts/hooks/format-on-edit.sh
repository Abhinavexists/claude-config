#!/usr/bin/env bash
# PostToolUse hook (Edit|Write): format the file Claude just touched.
# Silent skip when formatter is missing or file is unrecognized.
# Prefers project-local formatters (.venv, node_modules). Global formatters run
# only for repos that opted into a style (config present); gofmt/rustfmt always run.

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

# Walk up from the edited file looking for a project formatter config. Global
# formatters run only when a repo opted into a style — otherwise reformatting a
# whole file after a one-line edit produces churn that isn't the intended change.
has_config() {
  local cur="$dir" pat
  while [[ "$cur" != "/" && "$cur" != "." ]]; do
    for pat in "$@"; do
      compgen -G "$cur/$pat" >/dev/null 2>&1 && return 0
    done
    cur="$(dirname "$cur")"
  done
  return 1
}

# Prettier also honors a "prettier" key in package.json, not just rc files.
has_prettier_config() {
  has_config .prettierrc '.prettierrc.*' 'prettier.config.*' && return 0
  local cur="$dir"
  while [[ "$cur" != "/" && "$cur" != "." ]]; do
    [[ -f "$cur/package.json" ]] && jq -e 'has("prettier")' "$cur/package.json" >/dev/null 2>&1 && return 0
    cur="$(dirname "$cur")"
  done
  return 1
}

# Python: ruff/black only read pyproject.toml's [tool.*] tables (or ruff's own rc
# file), so a bare pyproject.toml full of packaging metadata is not opt-in.
has_py_formatter_config() {
  has_config .ruff.toml ruff.toml && return 0
  local cur="$dir"
  while [[ "$cur" != "/" && "$cur" != "." ]]; do
    [[ -f "$cur/pyproject.toml" ]] && grep -Eq '^\[tool\.(ruff|black)' "$cur/pyproject.toml" && return 0
    cur="$(dirname "$cur")"
  done
  return 1
}

# shfmt: a generic indent-only .editorconfig isn't opt-in; require shell intent.
has_shfmt_config() {
  local cur="$dir"
  while [[ "$cur" != "/" && "$cur" != "." ]]; do
    [[ -f "$cur/.editorconfig" ]] && grep -Eq '(\[\*\.(sh|bash)|switch_case_indent|binary_next_line|shell_variant|space_redirects|keep_padding|function_next_line)' "$cur/.editorconfig" && return 0
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
    elif has_py_formatter_config; then
      if   command -v ruff  >/dev/null 2>&1; then run ruff format "$file"
      elif command -v black >/dev/null 2>&1; then run black -q "$file"
      fi
    fi
    ;;
  go)
    command -v gofmt >/dev/null 2>&1 && run gofmt -w "$file"
    ;;
  rs)
    command -v rustfmt >/dev/null 2>&1 && run rustfmt --edition 2021 "$file"
    ;;
  c|cc|cpp|cxx|h|hh|hpp)
    if has_config .clang-format _clang-format; then
      command -v clang-format >/dev/null 2>&1 && run clang-format -i "$file"
    fi
    ;;
  js|jsx|ts|tsx|json|md|mdx|css|scss|html|yml|yaml)
    if   local_p=$(find_local "node_modules/.bin/prettier"); then run "$local_p" --write "$file"
    elif has_prettier_config && command -v prettier >/dev/null 2>&1; then run prettier --write "$file"
    fi
    ;;
  sh|bash)
    if has_shfmt_config; then
      command -v shfmt >/dev/null 2>&1 && run shfmt -w "$file"
    fi
    ;;
esac

exit 0
