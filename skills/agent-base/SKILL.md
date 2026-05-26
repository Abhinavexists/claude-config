---
name: agent-base
description: Internal scaffolding preloaded by custom subagents via the skills frontmatter field. Provides the orchestration-script protocol and the convention-hierarchy precedence table that every custom agent in this user directory inherits. Loaded automatically by agents that list it; not intended for direct user invocation.
---

# Agent Base Scaffolding

Shared instructions consumed by custom agents that list this skill in their `skills` frontmatter field. Each agent inherits the script-invocation protocol and convention-hierarchy precedence table below. Single source of truth — update here to update every agent.

## Script Invocation

If your opening prompt includes a python3 command:

1. Execute it immediately as your first action
2. Read output, follow DO section literally
3. When NEXT contains a python3 command, invoke it after completing DO
4. Continue until workflow signals completion

The script orchestrates your work. Follow it literally.

## Convention Hierarchy

When sources conflict, follow this precedence (higher overrides lower):

| Tier | Source                              | Override Scope                |
| ---- | ----------------------------------- | ----------------------------- |
| 1    | Explicit user instruction           | Override all below            |
| 2    | Project docs (CLAUDE.md, README.md) | Override conventions/defaults |
| 3    | .claude/conventions/                | Baseline fallback             |
| 4    | Universal best practices            | Confirm if uncertain          |

**Conflict resolution**: Lower tier numbers win. Subdirectory docs override root docs for that subtree.
