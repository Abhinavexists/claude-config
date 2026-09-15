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

## Review before handing off
- For any change beyond a trivial/mechanical edit, run a **fresh-context** review
  (quality-reviewer subagent or `/code-review`) before telling me the work is ready,
  and fix what it finds. Reviewing my own work in the context that produced it
  reliably misses things — the reviewer only helps if it has its own context.
- Report what it found, including anything you disagreed with and why.
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
