"""Pytest configuration and shared utilities for skills tests."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest


# Skills excluded from testing (not in git or incompatible)
EXCLUDED = {
    "leon-writing-style",
    "prompt-engineer-improver",
}

# All skill modules to import for registry population
SKILL_MODULES = [
    "skills.decision_critic.decision_critic",
    "skills.leon_writing_style.writing_style",
    "skills.problem_analysis.analyze",
    "skills.codebase_analysis.analyze",
    "skills.deepthink.think",
    "skills.incoherence.incoherence",
    "skills.refactor.refactor",
    "skills.planner.orchestrator.planner",
    "skills.prompt_engineer.optimize",
]


def import_all_skills() -> list[tuple[str, Exception]]:
    """Import all skill modules to populate workflow registry.

    Returns list of (module_path, exception) for any import failures.
    """
    import importlib

    failures = []
    for module in SKILL_MODULES:
        try:
            importlib.import_module(module)
        except Exception as e:
            failures.append((module, e))
    return failures


def run_skill_invocation(workflow, inputs: dict[str, Any]) -> tuple[bool, str]:
    """Run skill with inputs via subprocess.

    Returns:
        (True, stdout) on success
        (False, error_message) on failure
    """
    # Build command: python -m module --step N ...
    module_path = workflow._module_path or f"skills.{workflow.name}.{workflow.name}"
    cmd = [sys.executable, "-m", module_path]
    for k, v in inputs.items():
        arg_name = k.replace("_", "-")
        if isinstance(v, bool):
            if v:
                cmd.append(f"--{arg_name}")
        elif v is not None:
            cmd.extend([f"--{arg_name}", str(v)])

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30,
            cwd=Path(__file__).parent.parent,  # skills/scripts/
        )
        if result.returncode == 0:
            return True, result.stdout[:200]
        return False, result.stderr[:200] or f"Exit code {result.returncode}"
    except subprocess.TimeoutExpired:
        return False, "Timeout (30s)"
    except Exception as e:
        return False, str(e)[:200]


@pytest.fixture(scope="session", autouse=True)
def populate_workflow_registry():
    """Import all skills to populate workflow registry before tests run."""
    failures = import_all_skills()
    # Filter expected failures - excluded skills may not be present
    unexpected = [
        (mod, exc)
        for mod, exc in failures
        if not any(excl in mod for excl in EXCLUDED)
    ]
    if unexpected:
        pytest.fail(f"Unexpected import failures: {unexpected}")
