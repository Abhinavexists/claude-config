# Claude Code Config

A reusable Claude Code configuration with shared agents, skills, conventions,
hooks, and safety defaults.

This repo is meant to live at `~/.claude` and be shared across machines or with
other Claude Code users. It tracks only reusable configuration. Local state,
history, caches, secrets, and machine-specific overrides are intentionally left
out.

## What Is Included

- `settings.json`: shared Claude Code defaults, permissions, hooks, status
  line, and enabled plugins
- `agents/`: reusable sub-agent definitions for architecture, debugging,
  review, documentation, dependency audits, logs, tests, and diffs
- `skills/`: reusable Claude Code skills and their support code
- `conventions/`: review, documentation, and quality rules used by the agents
  and skills
- `output-styles/`: reusable response styles
- `scripts/`: status-line and hook helpers
- `.github/`: repository metadata and CI for skill support code

## What Is Not Included

This repo should not contain personal Claude session data or secrets.

Do not commit:

- `settings.local.json` or `.claude/settings.local.json`
- `history.jsonl`, `projects/`, `file-history/`, `tasks/`, `sessions/`,
  `ide/`, `paste-cache/`, and `shell-snapshots/`
- `cache/`, `backups/`, `stats-cache.json`, `policy-limits.json`,
  `telemetry/`, `session-env/`, and `downloads/`
- `plugins/cache/`, `plugins/marketplaces/`, installed-plugin state, or other
  generated plugin data
- API keys, tokens, `.env` files, SSH keys, cloud credentials, private project
  logs, or local absolute paths

The `.gitignore` uses a whitelist: everything is ignored by default, and only
known-shareable files are unignored.

## Requirements

- Claude Code
- `git`
- `bash`
- `jq` for the status line and hooks
- Optional formatters: `ruff`, `black`, `prettier`, `gofmt`, `rustfmt`,
  `clang-format`, and `shfmt`

On macOS, the hook scripts can use GNU `timeout` through `gtimeout` if
`coreutils` is installed. If no timeout command is available, the scripts still
run without a hard timeout.

## Install

New global install:

```bash
git clone https://github.com/Abhinavexists/claude-config.git ~/.claude
```

Existing `~/.claude`:

```bash
cd ~/.claude
git init
git remote add origin https://github.com/Abhinavexists/claude-config.git 2>/dev/null || \
  git remote set-url origin https://github.com/Abhinavexists/claude-config.git
git fetch origin
git merge origin/main --allow-unrelated-histories
```

If you already have local Claude settings, review merge conflicts carefully.
Keep machine-specific overrides in `settings.local.json`, which is ignored by
this repo.

## Configure

The defaults are intentionally opinionated. After installing, review
`settings.json` and adjust anything that does not match your account or
workflow:

- `model` and `advisorModel`
- `enabledPlugins`
- permission allow/ask/deny rules
- status-line command
- hook commands

The tracked hook and status-line commands assume this repo is installed at
`$HOME/.claude`.

For per-project use, copy only the reusable pieces you need into the project's
`.claude/` directory, such as `agents/`, `skills/`, `conventions/`,
`output-styles/`, and selected scripts. If you copy `settings.json` into a
project, update script paths accordingly.

## Usage

Use Claude Code normally for small edits. For larger changes, this config is
structured around a simple workflow:

1. Explore the codebase and problem.
2. Think through options when the solution is unclear.
3. Write a plan before making broad changes.
4. Clear context when the plan contains the needed details.
5. Execute the plan in reviewed milestones.

Example prompts:

```text
Use your codebase-analysis skill to explore this repository and summarize the
parts relevant to authentication.
```

```text
Use your deepthink skill to compare the implementation options for this change.
```

```text
Use your planner skill to write a plan to plans/my-feature.md.
```

```text
Use your planner skill to execute plans/my-feature.md.
```

## Included Skills

- `planner`: plan and execute larger changes through reviewed milestones
- `deepthink`: analyze ambiguous design, tradeoff, or strategy questions
- `codebase-analysis`: explore unfamiliar codebases and surfaces
- `problem-analysis`: investigate root causes
- `decision-critic`: stress-test a specific decision
- `refactor`: identify structural cleanup opportunities
- `prompt-engineer`: improve prompts and agent instructions
- `doc-sync`: audit and update Claude-oriented documentation
- `arxiv-to-md`, `cc-history`, `handoff`, `commit`, and `pr`: supporting
  workflow utilities

Most skill directories include their own `README.md` or `SKILL.md` with more
detail.

## Hooks And Status Line

`settings.json` enables:

- a status line from `scripts/statusline.sh`
- format-on-edit behavior from `scripts/hooks/format-on-edit.sh`
- an opt-in stop validator from `scripts/hooks/stop-validator.sh`

The stop validator only runs when the current project provides an executable
`.claude/verify.sh`. This lets individual projects define their own completion
checks without forcing every project to use the same test command.

## Before Pushing

Run these checks before publishing changes:

```bash
git status --short --ignored
git grep -n -I -E '/Users/|API_KEY|TOKEN|SECRET|PASSWORD|ghp_|github_pat_|sk-'
git check-ignore -v path/to/file
```

Useful expectations:

- `settings.json` should be tracked.
- `settings.local.json` should be ignored.
- session history, project logs, file history, plugin caches, and telemetry
  should be ignored.
- scripts should not contain personal absolute paths.

## Tests

Skill support code has a GitHub Actions workflow in
`.github/workflows/skills-test.yml`.

Run it locally with:

```bash
cd skills/scripts
PYTHONPATH=. pytest tests/ -v
```

Install test dependencies if needed:

```bash
pip install pytest hypothesis
```
