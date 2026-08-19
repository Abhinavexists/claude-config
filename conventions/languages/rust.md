# Rust Conventions

Language-specific idioms and anti-patterns for Rust. Tier-3 defaults: project docs and
explicit user instruction override these. Entries are reported as `CONVENTION_VIOLATION`
(RULE 2, SHOULD unless the entry says COULD). Actual memory-unsafety (unsound `unsafe`) is
handled at write time by the implementing agent's RULE 0, not here. Applies to `.rs` files.

## Error handling

<default-conventions domain="rs-unwrap-in-lib">
**`unwrap`/`expect` in Library Code**: `.unwrap()` or `.expect()` on `Result`/`Option` in non-test, non-`main` code where `?` and a real error type belong
Severity: SHOULD
Exception: An invariant proven locally, with a `// PANIC:` why-comment; tests; prototypes
</default-conventions>

<default-conventions domain="rs-panic-in-lib">
**Panic in Library Path**: `panic!`/`unreachable!`/`todo!` reachable from a library API on ordinary input
Severity: SHOULD
</default-conventions>

<default-conventions domain="rs-error-modelling">
**Ad-hoc Error Types**: Stringly-typed errors where a library should expose an error enum (`thiserror`); binaries may use `anyhow`. Propagate with `?`
Severity: COULD
</default-conventions>

## Ownership & safety

<default-conventions domain="rs-unsafe-undocumented">
**Undocumented `unsafe`**: An `unsafe` block or fn without a `// SAFETY:` comment stating the invariants it upholds
Severity: SHOULD
</default-conventions>

<default-conventions domain="rs-needless-clone">
**Needless Clone**: `.clone()`/`.to_owned()` to dodge the borrow checker where a borrow works
Severity: COULD
</default-conventions>

<default-conventions domain="rs-owned-params">
**Owned Params Where Borrows Fit**: Taking `String`/`Vec<T>` by value when `&str`/`&[T]` suffices
Severity: COULD
</default-conventions>

## Idioms & constructs

<default-conventions domain="rs-manual-iteration">
**Non-idiomatic Iteration**: Index loops or manual accumulation where iterator adapters (`map`/`filter`/`collect`) read clearer
Severity: COULD
Exception: Performance-critical code where the adapter chain is measurably worse
</default-conventions>

<default-conventions domain="rs-verbose-control-flow">
**Verbose Control Flow**: Nested `match`/`if` where `if let`/`let else`/`?`/combinators (`map`/`and_then`/`unwrap_or`) express the intent
Severity: COULD
</default-conventions>

<default-conventions domain="rs-derive-over-impl">
**Hand-rolled Trait Impls**: Manually implementing `Debug`/`Clone`/`Default`/`PartialEq` where `#[derive]` is equivalent
Severity: COULD
</default-conventions>

<default-conventions domain="rs-newtype">
**Primitive Obsession**: Bare primitives for domain IDs or units where a newtype prevents mixups
Severity: COULD
Exception: Local or throwaway values
</default-conventions>

## API & docs

<default-conventions domain="rs-must-use">
**Missing `#[must_use]`**: Returning a value whose being-ignored is a bug (builders, guards) without `#[must_use]`
Severity: COULD
</default-conventions>

<default-conventions domain="rs-doc-panics">
**Undocumented Panics/Errors**: A public fn that can panic or error without a `/// # Panics` or `/// # Errors` note
Severity: COULD
</default-conventions>

## Testing

<default-conventions domain="rs-test-layout">
**Test Layout**: Unit tests outside `#[cfg(test)]` modules; integration behavior not placed under `tests/`
Severity: COULD
</default-conventions>

<default-conventions domain="rs-blocking-in-async">
**Blocking in Async**: Blocking I/O or `std::thread::sleep` inside an `async` context
Severity: SHOULD
</default-conventions>
