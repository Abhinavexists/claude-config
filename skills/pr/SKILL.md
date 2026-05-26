---
name: pr
description: Push current branch and open a PR. Generates title + body from the full branch diff vs base. Optimized for squash-merge repos — PR title carries the load since individual commits get squashed away.
disable-model-invocation: true
allowed-tools: Bash(git rev-parse *), Bash(git status), Bash(git log *), Bash(git diff *), Bash(git push *), Bash(gh pr *), Bash(gh repo view *), Bash(gh auth status)
argument-hint: [optional title override]
---

## Current branch context

Repo: !`git rev-parse --show-toplevel 2>/dev/null || echo "(not a git repo)"`
Branch: !`git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?"`
Working tree: !`git status --short | head -10`
Default branch + merge strategy:
!`gh repo view --json defaultBranchRef,mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed 2>/dev/null || echo "(no gh / not authed / not a github repo)"`
Branch upstream tracking: !`git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo "(no upstream — will push with -u)"`

## Branch diff against base

Full diff stat vs default branch (assumes `main` — adjust if base is different):
!`git diff --stat origin/main...HEAD 2>/dev/null || git diff --stat $(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')...HEAD 2>/dev/null || echo "(can't resolve base)"`

Commit subjects on this branch:
!`git log origin/main..HEAD --pretty=format:"%s" 2>/dev/null | head -20`

## Instructions

1. **Bail-out checks.** Stop and report if:
   - Current branch is the default branch (`main`/`master`) — don't PR from default.
   - Working tree is not clean — staged or unstaged changes exist (push without committing).
   - `gh auth status` returns unauthenticated.

2. **Resolve the base branch.** Use `defaultBranchRef.name` from the `gh repo view` JSON above. If gh isn't available, default to `main`.

3. **Detect PR title style.** Re-use the convention-detection logic from `/commit` — examine the last 5 closed/merged PRs:
   ```bash
   gh pr list --state merged --limit 5 --json title --jq '.[].title'
   ```
   If most use Conventional Commits, write a Conventional title. Otherwise, write a clear imperative subject.

4. **Generate the title.**
   - If `$ARGUMENTS` is provided, use it verbatim.
   - Otherwise, summarize the *full branch diff* in one ≤72-char line. Since merges squash, this title becomes the final commit subject — make it count.

5. **Generate the body.** Use this template:
   ```markdown
   ## Summary
   - <2-4 bullet points of what changed and why>

   ## Test plan
   - [ ] <how to verify; ideally specific commands or paths>

   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   ```
   Pull the *why* from commit messages on the branch. Pull test steps from any test files touched in the diff.

6. **Push the branch.** If no upstream is set, `git push -u origin <branch>`; otherwise plain `git push`. If the push prompts for credentials, fail loudly — never bypass.

7. **Create the PR.** Use a heredoc for the body to preserve newlines:
   ```bash
   gh pr create --title "<title>" --body "$(cat <<'EOF'
   <body>
   EOF
   )"
   ```

8. **Report the PR URL** from `gh pr create`'s output so the user can click through.

## What this skill does NOT do

- Does not commit. Commit your changes via `/commit` first.
- Does not merge. PR creation only — review and merge are separate decisions.
- Does not force-push. The deny rules in settings.json already block `git push --force` to main/master regardless.
- Does not draft an `--draft` PR by default. If you want a draft PR, pass `--draft` as an argument (`/pr --draft`).
