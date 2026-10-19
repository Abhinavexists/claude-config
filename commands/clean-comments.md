---
description: Repo-wide comment & documentation pass — remove noise, rewrite the rest for high signal
argument-hint: "[optional path/scope]"
---

Follow this prompt directly — do not hand off to another skill (e.g. `refactor`,
`simplify`, `doc-sync`) or its script orchestration.

**The governing question is not "is this comment true?" but "does this comment make a reader stop and go check?"** A comment that restates the code forces the reader to diff prose against implementation to confirm they agree. That manual check is the cost this pass exists to remove — it is why redundant comments are worse than no comment, not merely useless.

**Read the file before judging any comment in it.** Open it, understand what it does, then decide. Never pattern-match a comment in isolation: the same sentence is noise above a self-evident assignment and load-bearing above a workaround.

**The unit is one line.** A comment is one line. A docstring is one line. Multi-line is an exception that must be earned, and in a clean repo it is rare — typically a module docstring (one summary line, blank line, two or three lines of orientation) or a signature whose tensor shapes or wire format genuinely need them. If you are writing a second paragraph on a function, the facts belong in a design doc with a pointer from the code, not in the docstring.

**Compress first; delete second.** The primary edit is collapsing a comment to its load-bearing line, not removing it. The highest-yield transform: a two- or three-line block comment above a statement becomes a short trailing comment on the statement itself.

```
-  # A request counts until the worker finishes or skips it, not until its
-  # client leaves: abandoned work still occupies the GPU.
+  self._pending = 0  # Counts work until the worker finishes, even if the client leaves.
```

Delete outright only when even one line would add nothing: a docstring restating the name or signature, a comment echoing the line beneath it, decorative banners and separators, redundant file headers, stale or meaningless TODO/FIXME, obvious type and behaviour notes.

**Point, do not restate.** When a fact has a home elsewhere — a design record, an ADR, a setup doc, a named function, a constant, a guard clause, an error message that computes its own limit — reference it or drop the prose. `(ADR-028)` beats a paragraph reproducing the decision, and it cannot drift. A fact the code states plainly may be dropped from prose entirely, including real behavioural contracts: if a function guards its own preconditions and raises, the docstring need not list them.

**Exception: surface consumed from outside.** For a published package, plugin interface, or wire contract, the caller reads the signature and the docs, never the guard. There the docstring *is* the fact's home — document the contract, parameters, return behaviour, exceptions and usage constraints, and cut only genuine restatement of the name.

**Do not rewrite for style.** Voice, capitalisation, punctuation and dash conventions are not defects. Mixed sentence case across a file is not a finding. Edit a comment because it is long, wrong, or redundant — never because it reads differently from its neighbour.

**The repo's own policy wins.** Read any `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md` or style guide in scope, root and nested, and extract its comment rules; they override the defaults above wherever the two conflict. Say in your summary which policy you applied and where it came from. Imposing this file's taste over a policy the author wrote down is a failed pass however clean the result looks.

Scope: if arguments are given, restrict to `$ARGUMENTS`; otherwise the whole repository. Enumerate the file list up front with `git ls-files` (respecting the scope) and write it to a ledger. Work in explicit batches, marking each path as you finish it; the reviewed count in your summary must come from diffing that ledger against `git ls-files`, never from memory. Do not sample, do not stop at the main source dirs, do not assume small files are fine. If the repo is too large for one pass, say how many files remain. Cover source, config, scripts, tests, utilities, examples and docs; skip generated, vendored, third-party, build and cache content.

**Verify claims; do not read them.** A comment whose claim is inverted, superseded, or describes a path that no longer exists is worse than no comment, and correcting it is the highest-value edit in the pass. Check the claim against the thing it asserts — every call site, every preset, the actual linter, a quick script — not against the five lines beneath it. A docstring asserting that two callers differ is falsified only by checking every caller. Architecture and design headers drift furthest and are what a newcomer trusts most. Check **placement** too: a comment must sit on the line it describes, since they strand when code is inserted above them.

**Lint and type suppressions are code, not commentary.** Never delete a `noqa`, `type: ignore`, `eslint-disable`, `#[allow]` or pragma because it looks unused — prove it with the tool (`ruff check --ignore-noqa`, `mypy --warn-unused-ignores`) and report rather than act. Their trailing justifications are ordinary prose and may be compressed.

**Before deleting a comment that looks stale or puzzling, find out why it exists.** `git log -S'<distinctive phrase>' -- <file>` or blame the line: one added alongside a bug fix, an incident or a dependency bump is load-bearing even when the surrounding code has changed, and its commit message usually says what the comment was too terse to.

**When that still leaves you uncertain, keep it and say so.** List it in the summary as left-unverified with the question you would ask. Deleting something whose purpose you did not understand is the worst outcome of this pass — worse than leaving noise.

**When a false comment exposes a real code defect** — a dead branch, a parameter nobody varies, a stale flag — fix the comment and *report* the defect. Do not fix it here. This pass changes no behaviour: no edits to control flow, APIs, types, signatures, imports or logic, and no refactoring to make comments easier to write.

Prove that rather than asserting it. Keep a copy of each file before editing, then compare: for Python, `ast.parse` both and check that the only `ast.Constant` string deltas are docstrings you meant to rewrite (docstrings live in the AST, so plain `ast.dump` equality holds only when no docstring changed). The fallback in any language is a diff filtered to non-comment lines — it must come back empty. Run it at the end of each batch; it also catches edits you did not make, such as an editor autofixing on save. A reflowed docstring can break indentation in a way that reads fine and parses wrong.

Language conventions differ: Python docstrings (PEP 257), TSDoc/JSDoc for TS/JS, Rust `///`/`//!`. For `.py`/`.ts`/`.js`/`.rs` also consult `~/.claude/conventions/languages/<lang>.md` — reference only, and subordinate to the repo's own policy.

Finish with a short summary: the policy applied and its source; reviewed-vs-total from the ledger; comments compressed, with the before/after line counts; comments deleted, by kind; facts repointed at their real home; stale or incorrect claims corrected and what falsified each; suppressions and code defects reported but untouched; comments left unverified and why; and the verification output showing behaviour unchanged.
