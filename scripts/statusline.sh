#!/usr/bin/env bash
# Statusline: model | ctx% | branch[*]
# Reads Claude Code session JSON on stdin.

set -uo pipefail

input="$(cat)"

model=$(printf '%s' "$input" | jq -r '.model.display_name // .model.id // "?"')
ctx=$(printf '%s' "$input" | jq -r '.context_window.used_percentage // empty')
cwd=$(printf '%s' "$input" | jq -r '.workspace.current_dir // .cwd // empty')

# Color codes (8-color, no truecolor — works in any terminal)
RESET=$'\033[0m'; DIM=$'\033[2m'; BOLD=$'\033[1m'
CYAN=$'\033[36m'; YELLOW=$'\033[33m'; GREEN=$'\033[32m'; RED=$'\033[31m'

# Context % with severity color
ctx_str=""
if [[ -n "$ctx" ]]; then
  ctx_int=${ctx%.*}
  if   (( ctx_int >= 85 )); then ctx_color="$RED"
  elif (( ctx_int >= 60 )); then ctx_color="$YELLOW"
  else                            ctx_color="$GREEN"; fi
  ctx_str=" ${DIM}|${RESET} ${ctx_color}${ctx_int}%${RESET}"
fi

# Git branch + dirty marker
branch_str=""
if [[ -n "$cwd" ]] && [[ -d "$cwd" ]]; then
  branch=$(git -C "$cwd" symbolic-ref --short HEAD 2>/dev/null || \
           git -C "$cwd" rev-parse --short HEAD 2>/dev/null)
  if [[ -n "$branch" ]]; then
    dirty=""
    if ! git -C "$cwd" diff --quiet --ignore-submodules 2>/dev/null || \
       ! git -C "$cwd" diff --cached --quiet --ignore-submodules 2>/dev/null; then
      dirty="${YELLOW}*${RESET}"
    fi
    branch_str=" ${DIM}|${RESET} ${CYAN}${branch}${RESET}${dirty}"
  fi
fi

printf '%s%s%s%s%s\n' "${BOLD}" "${model}" "${RESET}" "${ctx_str}" "${branch_str}"
