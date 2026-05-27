#!/usr/bin/env bash
# Stop hook: opt-in per-project verification gate.
# Only fires when the current project provides .claude/verify.sh.
# Otherwise no-op — keeps ad-hoc sessions unaffected.

set -uo pipefail

input="$(cat)"
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty')

# Already inside a stop hook loop? Bail to avoid infinite bounce.
already=$(printf '%s' "$input" | jq -r '.stop_hook_active // false')
[[ "$already" == "true" ]] && exit 0

[[ -z "$cwd" ]] && exit 0

verify="$cwd/.claude/verify.sh"
[[ ! -x "$verify" ]] && exit 0

# Run with hard timeout so a hung check can't trap Claude forever.
run_verify() {
  if command -v timeout >/dev/null 2>&1; then
    timeout 60 "$verify"
  elif command -v gtimeout >/dev/null 2>&1; then
    gtimeout 60 "$verify"
  else
    "$verify"
  fi
}

if output=$(run_verify 2>&1); then
  exit 0
fi

# Failure → block Claude from declaring done and surface the output.
# Exit code 2 + stderr is how Stop hooks signal "not done yet".
printf 'verify.sh failed — fix issues before declaring done:\n%s\n' "$output" >&2
exit 2
