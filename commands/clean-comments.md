---
description: Repo-wide comment & documentation pass — remove noise, rewrite the rest for high signal
argument-hint: "[optional path/scope]"
---

Follow this prompt directly — do not hand off to another skill (e.g. `refactor`,
`simplify`, `doc-sync`) or its script orchestration.

Scope: if arguments are given, restrict to `$ARGUMENTS`; otherwise the whole repository. Enumerate the file list up front with `git ls-files` (respecting the scope), then work through it in explicit batches. Inspect files individually — do not sample, do not stop at the main source dirs, do not assume small files are fine. Track and report reviewed-vs-total counts so the "every file" claim is verifiable rather than asserted; if the repo is too large for one pass, say how many files remain instead of silently sampling.

Clean up each file's comments and documentation. This is three verbs, not one: keep, remove, and **rewrite**. Deleting noise is the easy half — a comment that survives must also *read* well, and most of the value in a mature codebase is in improving the ones you keep, not in deleting the ones you don't.

Goal: high-signal, minimal comments. Every remaining comment must tell a competent engineer something they could not infer from the surrounding code, in as few words as that takes. Prefer *why* over *what*.

Cover source, config, scripts, tests, utilities, examples, and docs. Review inline comments, docstrings, file/section headers, JSDoc/XML docs, and TODO/FIXME. Skip generated, vendored, third-party, build, cache, and .git content unless it's clearly project-owned and maintained.

Keep comments explaining: non-obvious logic; why an approach was chosen;
constraints/invariants; edge cases; workarounds for external behavior;
performance/correctness considerations; anything not clear from the code.

Remove: comments restating the code; decorative banners/separators/ASCII headers;
redundant file headers; meaningless or stale TODO/FIXME; comments echoing a name;
obvious type/behavior notes; generated-looking or excessive JSDoc/docstrings.

Rewrite in place: comments that carry a real fact but bury it — rambling or repetitive prose, narrated history ("this used to…", "which is where the bug came from"), first-person "we/us", hedging, or a wall of text where two lines would do. Compress the prose, never the information: every number, API name, error string, invariant, and causal claim the original carried must survive. Name a block's load-bearing facts before editing it, then confirm the replacement still states each one — "improve readability" is the failure mode where information quietly disappears. While you are in there, normalize what is genuinely inconsistent across the file: declarative voice, one dash/punctuation style, no temporal words ("now", "currently", "recently") that will read as stale later.

Verify claims against the code, not just against style. A comment whose claim is inverted, superseded, or describes a path that no longer exists is worse than no comment, and correcting it is usually the highest-value edit in the pass — check architecture/design headers especially, since they drift furthest and are what a newcomer trusts most. Where the same fact is deliberately repeated at several call sites, tighten each; do not consolidate them into one site with pointers.

Docstrings: keep for public APIs where they add real API-level info (behavior, non-obvious params, return semantics, exceptions, side effects, constraints, edge cases). Remove docstrings that merely restate the name. Add a concise comment only where important, non-obvious logic is currently undocumented.

Language-specific doc conventions differ: Python docstrings (PEP 257), TSDoc/JSDoc for TS/JS, Rust `///`/`//!` doc comments. For `.py`/`.ts`/`.js`/`.rs` files, also consult `~/.claude/conventions/languages/<lang>.md` for that language's comment and doc norms — reference only; this stays a self-contained pass.

Do not change behavior: no edits to control flow, APIs, types, signatures, imports, or logic. Documentation only. Do not refactor to make comments easier to write.

Prove that rather than asserting it. Keep a copy of each file before editing, then compare the two with a parser: for Python, `ast.parse` both and check that the only `ast.Constant` string deltas are the docstrings you meant to rewrite (docstrings live in the AST, so plain `ast.dump` equality holds only when no docstring changed). The cheap fallback in any language is a diff filtered to non-comment lines — it must come back empty. Do this at the end of each batch; a reflowed docstring can break indentation in a way that reads fine and parses wrong.

Finish by confirming every eligible file was reviewed, then give a short summary:
files reviewed, kinds of comments removed, comments rewritten (and the facts preserved in them), stale or incorrect claims corrected, meaningful docs preserved, useful comments added, and the verification output showing behavior was unchanged.
