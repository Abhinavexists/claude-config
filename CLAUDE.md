# Global working preferences

Apply these in every repository unless a project's own CLAUDE.md or an explicit
instruction overrides them.

## Starting a task
- When I give you a new non-trivial task (not a quick question, a mechanical edit,
  or a follow-up within a task already under way), do this before any work: I want
  a deeper version of this task, not a bigger one. Before rewriting it: (1) say what
  a top professional in this field would do here that I'm not asking for; (2) name
  the rawest material they would start from instead of what has already been
  digested for me; (3) name the specific methods and tools they would use; (4) say
  what, other than you or me, would show the result is right. Then rewrite my prompt
  to ask for exactly that, and wait for me to confirm or edit it before starting.

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

## Comments
- **One line is the unit.** A comment is one line; a docstring is one line. Multi-line is
  earned, not default — a module docstring's two or three lines of orientation, or a
  signature whose tensor shapes or wire format need them. A second paragraph on a function
  means the facts belong in a design doc with a pointer from the code.
- **Don't write what the code says.** The test is whether a reader has to stop and check the
  prose against the implementation to confirm they agree. That manual check is the cost —
  it's why a redundant comment is worse than no comment, not merely useless.
- **Compress before deleting.** When a buried fact is real, collapse it to its load-bearing
  line rather than dropping it; a block comment above a statement usually becomes a short
  trailing comment on the statement itself.
- **Point, don't restate.** Reference the ADR, doc, named function or constant that already
  holds the fact. A fact the code states plainly — a guard that raises, an error message that
  computes its own limit — needs no prose, including real behavioural contracts.
- **Exception: surface consumed from outside.** For a published package, plugin interface or
  wire contract the caller reads the signature and docs, never the body, so document the
  contract, parameters, returns, exceptions and constraints there.
- Don't rewrite comments for style — voice, capitalisation and punctuation are not defects.
  When changing code, drop comments the change made obsolete; don't do unrelated cleanup.

## On-demand cleanup passes
- `/clean-comments` — repo-wide sweep applying the Comments rules above to existing code.
- `/readability` — repo-wide readability & maintainability improvement.
