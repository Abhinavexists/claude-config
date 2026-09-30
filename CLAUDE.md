# Global working preferences

Apply these in every repository unless a project's own CLAUDE.md or an explicit
instruction overrides them.

## Commits
- Never run `git commit` until I explicitly ask for it. Finish the work, leave it
  in the working tree, and tell me it's ready for review — do not commit it
  "to be safe", to checkpoint, or as the natural end of a task. This covers
  `--amend` too.
- Write a single-line commit subject only. Do not add a body/description unless
  I explicitly ask for one.
- Every commit subject AND every PR title uses semantic commit format:
  `<type>(<scope>): <subject>` — scope optional, subject lowercase, present tense,
  no trailing period (e.g. `fix(ocr): stop retrying permanent 4xx errors`).
  Types: `feat` (user-facing feature), `fix` (user-facing bug fix), `docs`
  (documentation and code comments only), `style` (formatting, no logic change),
  `refactor` (production code change with no new feature or fix, incl. removing
  dead code), `test` (tests only), `chore` (build, deps, tooling, config; no
  production code). One type per commit: if a change spans types, split it into
  separate commits rather than picking one type for all of it. This applies to
  every subject I propose, not just the ones I commit.
- Whenever you finish a set of changes, propose the commit subject alongside the
  summary, without being asked — so I can sanity-check it against the diff before
  I commit. Describe what the change ends up doing, not the route taken to get
  there: if a later revision replaced an earlier approach, the subject names the
  final behaviour. If the changes are genuinely unrelated, say so and propose one
  subject per commit rather than a single subject covering all of them.

## Editing code
- Keep every diff minimal. Change only what the task requires — no incidental
  reformatting, reordering, renaming, or "while I'm here" edits. The diff should
  contain exactly the intended change and nothing more.

## Pull requests
- Never merge a PR automatically. Always get my explicit confirmation before
  merging — this covers `gh pr merge`, the GitHub MCP merge tools, and any
  `--auto`/auto-merge flag.

## Before handing off
- Don't run a review pass (`/code-review`, quality-reviewer subagent, etc.) unless I
  ask for one.
- Three checks that apply whatever the stack:
  - **Move the dependents too.** Anything that stores, mirrors or replays the old
    behaviour — caches, migrations, fixtures, snapshots, generated files, docs —
    has to change with the code, or it keeps serving the old behaviour.
  - **Reconcile, don't append.** Fold a change into what is already there instead of
    adding a parallel path beside it. Parallel paths drift and contradict.
  - **Verify, don't reason.** Run it, probe it, measure it. "It should work" is not a
    check, and neither is a passing test that doesn't exercise the change.

## On-demand cleanup passes
- `/clean-comments` — repo-wide comment & documentation signal-to-noise cleanup.
- `/readability` — repo-wide readability & maintainability improvement.
