---
description: Repo-wide readability & maintainability improvement (behavior-preserving)
argument-hint: "[optional path/scope]"
---

Follow this prompt directly — do not hand off to another skill (e.g. `refactor`,
`simplify`) or its script orchestration.

Improve the code for readability, maintainability, and developer ergonomics. Not shorter or cleverer — easier for another experienced developer to read, modify, debug, and extend. Prefer clarity over cleverness.

Scope: if arguments are given, restrict to `$ARGUMENTS`; otherwise the whole repository — source, tests, utilities, scripts, config, examples, project-owned code only. Skip generated/vendored/dependency/build/cache/third-party code. Enumerate the file list up front with `git ls-files` (respecting the scope) and work through it in explicit batches, reporting reviewed-vs-total counts; don't sample silently. Apply the same standard everywhere.

Change something only when it concretely improves one or more of: readability,maintainability, correctness clarity, debuggability, ergonomics, consistency, or reduced complexity. Do not refactor for personal style or stylistic churn.

For `.py`/`.ts`/`.js`/`.rs` files, also apply the language idioms in `~/.claude/conventions/languages/<lang>.md` (e.g. Pythonic constructs and exception handling; TS type-narrowing and no floating promises; Rust `Result`/`?` over `unwrap` and iterator adapters) — reference only; this stays a self-contained pass.

Improve:
- Naming: replace vague/abbreviated/misleading/over-generic names with
  intent-revealing ones. Do NOT rename public APIs, exported symbols, config
  keys, DB fields, or externally consumed identifiers without a clearly safe
  reason.
- Control flow: prefer early returns, shallow nesting, clear branching; avoid
  needless else-after-return, clever one-liners, convoluted boolean/ternary
  expressions. Use judgment, not blind rules.
- Abstraction: remove trivial wrappers, redundant classes, single-use
  indirection, unnecessary inheritance — but keep abstractions that give real
  separation, reuse, extensibility, or domain clarity.
- Functions: one clear responsibility, understandable in/out, few params, no
  surprising side effects. Split a long function only when it genuinely aids
  comprehension.
- Data flow: make transformations explicit; add intermediates only when they
  clarify; keep return values predictable and mutable-state ownership clear.
- Error handling: fix swallowed exceptions, over-broad catches,
  misleading/inconsistent messages, lost context. Failures should say what
  failed, why, and whether it's expected. Don't add defensive checks where
  guarantees already exist.
- Consistency: align naming, structure, error handling, return conventions,
  config access, logging, async patterns, and validation across similar code.
- Organization: move misplaced helpers, split unrelated responsibilities, remove
  duplication — only when the result is clearly easier to follow. No wholesale
  repo reorg.
- Comments: fix confusing code via naming/flow/structure first; add a short *why*
  comment only when code can't express it. No "what" comments.
- Code smells: remove dead/unreachable code, duplicated logic, redundant
  vars/conversions, and magic values — only once you've established they're
  genuinely unnecessary.

Tests are production code: improve names, structure, setup/teardown, duplicated logic, unclear assertions, and confusing fixtures so each reads as "given X, when Y, expect Z." Never weaken or drop coverage to shorten tests.

Preserve behavior and contracts: no changes to public APIs, external behavior, business logic, data formats, config contracts, persistence, or concurrency semantics; no perf-sensitive changes without strong justification; no new framework/dependency/pattern for style alone.

Before finishing verify: every eligible file reviewed; public APIs and external contracts intact; behavior unchanged; result is genuinely more readable (not just different); no new inconsistencies or needless abstraction introduced. Then give a short summary: files reviewed, major readability wins, significant refactors, complexity removed, naming/structure improvements, and confirmation that behavior and external APIs were preserved.
