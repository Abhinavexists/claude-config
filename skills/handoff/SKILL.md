---
name: handoff
description: Write a session-resume note before /clear or before quitting, so the next session picks up where you left off. Captures what you were doing, where you stopped, the next concrete step, and any open questions. Invoke manually before /clear, or let Claude suggest it when context is getting tight.
when_to_use: Use when the user is about to /clear or end a session mid-task, when context usage exceeds 75%, or when the user says "I need to pause" / "let's pick this up tomorrow"
allowed-tools: Bash(git status), Bash(git status *), Bash(git diff *), Bash(git log *), Bash(git rev-parse *), Bash(mkdir -p *), Read, Write
argument-hint: [optional focus area / topic]
---

## Current session context

CWD: !`pwd`
Branch: !`git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "(not a git repo)"`
Working tree status:
!`git status --short 2>/dev/null | head -20 || echo "(not a git repo)"`

Recent local commits (in case any happened this session):
!`git log -5 --pretty=format:"%h %s" 2>/dev/null || echo "(no history)"`

Has project-level .claude/ directory? Used to decide handoff target path:
!`test -d "$(pwd)/.claude" && echo "yes — writing to .claude/handoff.md" || echo "no — writing to /tmp/handoff-${CLAUDE_SESSION_ID}.md"`

## Instructions

1. **Decide the target path.**
   - If `$(pwd)/.claude/` exists: write to `$(pwd)/.claude/handoff.md`.
   - Otherwise: write to `/tmp/handoff-${CLAUDE_SESSION_ID}.md`.
   - If the file already exists, append a new dated section rather than overwrite — handoffs are an append-only log.

2. **Draft the note.** Structure:
   ```markdown
   ## <YYYY-MM-DD HH:MM> — <one-line topic>

   ### What we were doing
   <2-3 sentences. Concrete, not abstract: "Adding rate-limit middleware to the
   /v2/embed endpoint" not "Working on backend stuff.">

   ### Where we stopped
   <Exact state — file + line, or "tests failing on X", or "decision pending on Y">

   ### Next concrete step
   <One sentence the next session can act on immediately. Not "continue work" —
   something like "Run the failing test in tests/embed/test_rate_limit.py:42 and
   read the assertion message; the fixture probably needs the new redis_url
   parameter.">

   ### Open questions
   <Bulleted list, or "none" if everything is decided>

   ### Files touched this session (uncommitted)
   <Output of git status --short>
   ```

3. **Pull the topic from `$ARGUMENTS`** if provided. Otherwise infer from the most recent ~10 turns of conversation — what was the load-bearing task?

4. **Be specific.** A handoff note that says "continue refactor" is useless. The bar: a fresh Claude session reading this note should be able to do exactly the next action without re-reading the codebase.

5. **Write the file.** Use the `Write` tool. If appending to an existing handoff, read the file first, then write with the new section appended.

6. **Report the path.** Print the absolute path so the user can open it themselves. Also surface the one-sentence "Next concrete step" inline — that's the thing they'll actually read tomorrow.

## What this skill does NOT do

- Does not write to user-level memory. Memory is for cross-session preferences; handoffs are for *this specific paused task*.
- Does not /clear for you. Writing the note is one action; choosing to clear is another.
- Does not push the note anywhere (Slack, Linear, etc.) — it's a file. If you want it elsewhere, pipe it yourself.
- Does not capture full conversation transcripts — that's noise. Distill to the four sections above.
