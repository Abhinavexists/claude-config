# TypeScript & JavaScript Conventions

Language-specific idioms and anti-patterns for TypeScript and JavaScript. Tier-3 defaults:
project docs and explicit user instruction override these. Entries are reported as
`CONVENTION_VIOLATION` (RULE 2, SHOULD unless the entry says COULD). Security prohibitions
(e.g. `eval`/`new Function`, injection) are handled at write time by the implementing agents'
RULE 0, not here. Applies to `.ts/.tsx/.js/.jsx/.mjs/.cjs`. **JS deltas** note where the
absence of a compiler changes the rule.

## Type discipline

<default-conventions domain="ts-any-escape">
**`any` Escape Hatch**: `any` (implicit or explicit) or an `as` cast used to silence the compiler instead of modelling the value; prefer `unknown` at untrusted boundaries
Severity: SHOULD
Exception: Interop with untyped libraries, with a why-comment
JS delta: no compiler — annotate public functions with JSDoc `@param`/`@returns` and validate inputs at boundaries instead
</default-conventions>

<default-conventions domain="ts-suppression">
**Unexplained Suppression**: `// @ts-ignore` or `@ts-expect-error` without an adjacent reason
Severity: SHOULD
</default-conventions>

<default-conventions domain="ts-nonnull-assert">
**Unjustified Non-null Assertion**: `!` non-null assertion where narrowing or a type guard would prove non-null
Severity: SHOULD
</default-conventions>

<default-conventions domain="ts-illegal-states">
**Unmodelled State**: Boolean/optional soup where a discriminated union would make illegal states unrepresentable; missing type guards for narrowing
Severity: COULD
Exception: Trivial state — don't reach for unions or branded types reflexively
</default-conventions>

## Idioms & constructs

<default-conventions domain="ts-loose-bindings">
**Loose Bindings**: `var`, or `let` where `const` suffices
Severity: COULD
</default-conventions>

<default-conventions domain="ts-verbose-null">
**Verbose Null Handling**: Manual `x !== null && x !== undefined` or `x && x.y` where `??` and `?.` read clearer
Severity: COULD
</default-conventions>

<default-conventions domain="ts-loose-equality">
**Loose Equality**: `==`/`!=` instead of `===`/`!==`
Severity: SHOULD
Exception: A deliberate `== null` check for null-or-undefined, with a why-comment
</default-conventions>

## Error handling

<default-conventions domain="ts-floating-promise">
**Floating Promise**: A promise neither awaited, returned, nor `.catch`-handled
Severity: SHOULD
</default-conventions>

<default-conventions domain="ts-swallowed-errors">
**Swallowed Errors**: `catch {}` that discards the error, or `catch (e)` that neither handles nor rethrows
Severity: SHOULD
</default-conventions>

## Anti-patterns

<default-conventions domain="ts-shared-mutation">
**Shared Mutable State**: Mutating exported/module-level objects, or arguments callers still hold
Severity: SHOULD
</default-conventions>

## Testing

<default-conventions domain="ts-over-mock">
**Over-mocking**: Mocking owned modules instead of exercising them; asserting on calls rather than observable behavior
Severity: SHOULD
Exception: Slow or external dependencies at a real boundary
</default-conventions>
