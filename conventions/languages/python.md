# Python Conventions

Language-specific idioms and anti-patterns for Python. Tier-3 defaults: project docs
(CLAUDE.md/README.md) and explicit user instruction override these. Entries are reported as
`CONVENTION_VIOLATION` (RULE 2, SHOULD unless the entry says COULD). Security prohibitions
(e.g. `eval`/`exec`/`shell=True` on untrusted input) are handled at write time by the
implementing agents' RULE 0, not here. Applies to `.py` files.

## Typing & interfaces

<default-conventions domain="py-type-hints">
**Missing Type Hints**: Public function signatures or public attributes without type hints
Severity: SHOULD
Exception: Test helpers, throwaway scripts, or a project documented as untyped
</default-conventions>

<default-conventions domain="py-any-escape">
**`Any` Escape Hatch**: `Any` (or an untyped container) used to silence the type checker rather than model the value
Severity: SHOULD
Exception: Genuine dynamic boundaries (plugin loaders, deserialization) with a why-comment
</default-conventions>

## Error handling

<default-conventions domain="py-swallowed-errors">
**Swallowed Errors**: `except: pass`, bare `except`, or catching `Exception` and discarding it
Severity: SHOULD
Exception: Documented best-effort cleanup with a why-comment
</default-conventions>

<default-conventions domain="py-lost-context">
**Lost Exception Context**: Raising a new exception inside `except` without `raise ... from` (use `from None` when the chain is deliberately suppressed)
Severity: SHOULD
</default-conventions>

<default-conventions domain="py-sentinel-returns">
**Sentinel Returns**: Signalling failure with sentinels (`None`/`-1`/`False`) where an exception is clearer for callers
Severity: COULD
Exception: Hot paths, or an API whose contract documents the sentinel
</default-conventions>

## Idioms & constructs

<default-conventions domain="py-manual-iteration">
**Non-idiomatic Iteration**: Manual index loops or accumulation where a comprehension, generator, `enumerate`, or `zip` reads clearer
Severity: COULD
Exception: The loop has side effects or early exits that resist an expression form
</default-conventions>

<default-conventions domain="py-resource-mgmt">
**Unmanaged Resources**: Files, locks, or connections opened without a context manager (`with`)
Severity: SHOULD
</default-conventions>

<default-conventions domain="py-stdlib-idioms">
**Legacy stdlib Usage**: `os.path` string juggling over `pathlib`; `%`/`.format()` over f-strings; manual parsing where a stdlib helper exists
Severity: COULD
</default-conventions>

## Anti-patterns

<default-conventions domain="py-mutable-default">
**Mutable Default Argument**: `def f(x=[])` or `={}` — the default is shared across calls
Severity: SHOULD
</default-conventions>

<default-conventions domain="py-star-import">
**Star Import**: `from module import *` outside `__init__.py` re-exports
Severity: COULD
</default-conventions>

## Testing

<default-conventions domain="py-test-idioms">
**Non-idiomatic Tests**: `unittest` setUp/tearDown boilerplate or duplicated test bodies where `pytest` fixtures / `parametrize` fit; asserting on implementation detail rather than behavior
Severity: SHOULD
Exception: Project standardizes on `unittest`
</default-conventions>
