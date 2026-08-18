---
description: Repo-wide comment & documentation cleanup for high signal-to-noise
argument-hint: "[optional path/scope]"
---

Follow this prompt directly — do not hand off to another skill (e.g. `refactor`,
`simplify`, `doc-sync`) or its script orchestration.

Scope: if arguments are given, restrict to `$ARGUMENTS`; otherwise the whole
repository. Enumerate the file list up front with `git ls-files` (respecting the
scope), then work through it in explicit batches. Inspect files individually — do
not sample, do not stop at the main source dirs, do not assume small files are
fine. Track and report reviewed-vs-total counts so the "every file" claim is
verifiable rather than asserted; if the repo is too large for one pass, say how
many files remain instead of silently sampling.

Clean up each file's comments and documentation.

Goal: high-signal, minimal comments. Every remaining comment must tell a
competent engineer something they could not infer from the surrounding code.
Prefer *why* over *what*.

Cover source, config, scripts, tests, utilities, examples, and docs. Review
inline comments, docstrings, file/section headers, JSDoc/XML docs, and
TODO/FIXME. Skip generated, vendored, third-party, build, cache, and .git content
unless it's clearly project-owned and maintained.

Keep comments explaining: non-obvious logic; why an approach was chosen;
constraints/invariants; edge cases; workarounds for external behavior;
performance/correctness considerations; anything not clear from the code.

Remove: comments restating the code; decorative banners/separators/ASCII headers;
redundant file headers; meaningless or stale TODO/FIXME; comments echoing a name;
obvious type/behavior notes; generated-looking or excessive JSDoc/docstrings.

Docstrings: keep for public APIs where they add real API-level info (behavior,
non-obvious params, return semantics, exceptions, side effects, constraints, edge
cases). Remove docstrings that merely restate the name. Add a concise comment
only where important, non-obvious logic is currently undocumented.

Do not change behavior: no edits to control flow, APIs, types, signatures,
imports, or logic. Documentation only. Do not refactor to make comments easier to
write.

Finish by confirming every eligible file was reviewed, then give a short summary:
files reviewed, kinds of comments removed, meaningful docs preserved, useful
comments added, and confirmation that behavior was unchanged.
