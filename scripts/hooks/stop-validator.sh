#!/usr/bin/env bash
# Stop hook: verification gate before Claude declares a task done.
#
# Precedence:
#   1. If the project provides an executable .claude/verify.sh, run ONLY that
#      (it defines exactly what "done" means for the repo).
#   2. Otherwise run conservative, manifest-detected checks for the languages
#      present: compile/typecheck/lint, never the full test suite. Each check is
#      skipped when its tool is absent or when it times out — so the gate can
#      surface real breakage without trapping ad-hoc sessions.
#
# A failing check exits 2 with output, which is how a Stop hook tells Claude
# "not done yet". To customize or opt out, add a project .claude/verify.sh.

set -uo pipefail

input="$(cat)"
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty')

# Already inside a stop hook loop? Bail to avoid infinite bounce.
already=$(printf '%s' "$input" | jq -r '.stop_hook_active // false')
[[ "$already" == "true" ]] && exit 0

[[ -z "$cwd" ]] && exit 0
[[ -d "$cwd" ]] || exit 0
cd "$cwd" || exit 0

# Run a command with a hard timeout so a hung check can't trap Claude.
# Returns the command's exit code (124 on timeout).
run_timed() {
  if command -v timeout >/dev/null 2>&1; then
    timeout 60 "$@"
  elif command -v gtimeout >/dev/null 2>&1; then
    gtimeout 60 "$@"
  else
    "$@"
  fi
}

# --- 1. Project-defined verification takes precedence ------------------------
verify="$cwd/.claude/verify.sh"
if [[ -x "$verify" ]]; then
  if output=$(run_timed "$verify" 2>&1); then
    exit 0
  fi
  printf 'verify.sh failed — fix issues before declaring done:\n%s\n' "$output" >&2
  exit 2
fi

# --- 2. Manifest-aware default checks ----------------------------------------
failures=""

# Run a named check; record failure unless it passed or timed out (124 = skip).
check() {
  local name="$1"; shift
  local out rc
  out=$(run_timed "$@" 2>&1); rc=$?
  [[ $rc -eq 0 || $rc -eq 124 ]] && return 0
  failures+="[$name]"$'\n'"$out"$'\n\n'
}

# Rust: cargo check is the standard, objective compile gate for a Cargo project.
if [[ -f "$cwd/Cargo.toml" ]] && command -v cargo >/dev/null 2>&1; then
  check "cargo check" cargo check --quiet
fi

# TypeScript: typecheck with the project's own tsc, only when installed locally
# (avoids imposing a global compiler on repos that didn't opt in).
if [[ -f "$cwd/tsconfig.json" && -x "$cwd/node_modules/.bin/tsc" ]]; then
  check "tsc --noEmit" "$cwd/node_modules/.bin/tsc" --noEmit -p "$cwd"
fi

# Python: lint only when the project opted into ruff (config present + available).
py_ruff=""
if [[ -x "$cwd/.venv/bin/ruff" ]]; then
  py_ruff="$cwd/.venv/bin/ruff"
elif command -v ruff >/dev/null 2>&1; then
  py_ruff="ruff"
fi
if [[ -n "$py_ruff" ]] && { [[ -f "$cwd/.ruff.toml" || -f "$cwd/ruff.toml" ]] \
    || { [[ -f "$cwd/pyproject.toml" ]] && grep -q '^\[tool\.ruff' "$cwd/pyproject.toml" 2>/dev/null; }; }; then
  check "ruff check" "$py_ruff" check .
fi

[[ -z "$failures" ]] && exit 0

printf 'Verification failed — fix before declaring done (or add .claude/verify.sh to customize):\n\n%s' "$failures" >&2
exit 2
