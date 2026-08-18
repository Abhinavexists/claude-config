# Global working preferences

Apply these in every repository unless a project's own CLAUDE.md or an explicit
instruction overrides them.

## Commits
- Write a single-line commit subject only. Do not add a body/description unless
  I explicitly ask for one.

## Editing code
- Keep every diff minimal. Change only what the task requires — no incidental
  reformatting, reordering, renaming, or "while I'm here" edits. The diff should
  contain exactly the intended change and nothing more.

## Pull requests
- Never merge a PR automatically. Always get my explicit confirmation before
  merging — this covers `gh pr merge`, the GitHub MCP merge tools, and any
  `--auto`/auto-merge flag.

## On-demand cleanup passes
- `/clean-comments` — repo-wide comment & documentation signal-to-noise cleanup.
- `/readability` — repo-wide readability & maintainability improvement.
