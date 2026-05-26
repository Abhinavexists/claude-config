---
name: commit
description: Stage-aware git commit. Detects this repo's commit-message style from the last 5 commits and matches it. Commits only what's already staged — never auto-stages. Appends the configured Co-Authored-By trailer.
disable-model-invocation: true
allowed-tools: Bash(git status), Bash(git status *), Bash(git diff --cached *), Bash(git diff --staged *), Bash(git log *), Bash(git commit *), Bash(git rev-parse *)
argument-hint: [optional message override]
---

## Current staged context

Repo: !`git rev-parse --show-toplevel 2>/dev/null || echo "(not a git repo)"`
Branch: !`git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?"`

Staged file stats:
!`git diff --cached --stat`

Staged diff (truncated to 400 lines for context budget):
!`git diff --cached | head -400`

Last 5 commits in this repo (use to detect message style):
!`git log -5 --pretty=format:"%s" 2>/dev/null || echo "(no history)"`

## Instructions

1. **Bail-out check.** If the staged stats above are empty, stop and tell the user: "Nothing staged. Run `git add <files>` first." Do not run `git add` for them.

2. **Detect commit style from the 5-commit sample.** Two patterns:
   - **Conventional**: starts with `type(scope): subject` or `type: subject` (e.g., `fix(auth): …`, `chore(formatting): …`)
   - **Terse imperative**: short subject only, no type prefix (e.g., `Cleanup`, `Refactor / rewrite`)

   If >=3 of 5 are Conventional, use Conventional. Otherwise use terse imperative. If history is empty, default to terse.

3. **Write the message.**
   - If `$ARGUMENTS` is provided, treat it as the user's override — use it verbatim as the subject, but still append the Co-Authored-By trailer.
   - Otherwise, summarize the staged diff in one short subject line (≤72 chars) in the detected style.
   - Add a body **only if** the diff is non-obvious (e.g., touches >5 files across unrelated concerns, or changes public API). For routine edits, subject-only.
   - The body, when present, explains *why*, not *what* — the diff already shows what.

4. **Commit.** Use a heredoc to preserve newlines:
   ```bash
   git commit -m "$(cat <<'EOF'
   <subject>

   <body, if any>

   Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
   EOF
   )"
   ```

5. **Verify.** Run `git status` after the commit. Report the new HEAD short-SHA.

## What this skill does NOT do

- Does not `git add`. If you wanted unstaged files in, you forgot to stage them.
- Does not push. Use `/pr` for that.
- Does not amend. New commits only; if you want to amend, do it yourself.
- Does not commit `.env` or other denied paths — the permissions deny rules already block reading those.
