# conventions/languages/

Per-language idioms, anti-patterns, and norms — the language layer on top of the
language-agnostic conventions. Read the file matching the code under review.

## Files

| File            | What                                 | When to read                          |
| --------------- | ------------------------------------ | ------------------------------------- |
| `python.md`     | Python idioms & anti-patterns        | Reviewing/writing `.py`               |
| `typescript.md` | TypeScript & JavaScript idioms       | Reviewing/writing `.ts/.tsx/.js/.jsx` |
| `rust.md`       | Rust idioms, ownership & error norms | Reviewing/writing `.rs`               |

## Language selection

- **File-level passes** (comment cleanup, readability, per-file review findings): select by
  **file extension** — `.py` → python.md; `.ts/.tsx/.js/.jsx/.mjs/.cjs` → typescript.md;
  `.rs` → rust.md.
- **Toolchain decisions** (format/lint/test/build): select by **manifest** —
  `pyproject.toml`/`uv.lock`, `package.json`/lockfile, `Cargo.toml`.
- **Monorepos**: match each file to its own language; there is no single repo language.

## Precedence & reporting

Tier 3 (baseline defaults) — overridden by project docs (Tier 2) and explicit user
instruction (Tier 1); see `../structural.md` and the agent-base Convention Hierarchy. Idiom
violations are reported as `CONVENTION_VIOLATION` (RULE 2, SHOULD unless an entry says COULD).
Security/memory-safety prohibitions are handled at write time by the implementing agents'
RULE 0, not by these review-time docs.
