"""Tests that skill modules import successfully."""

import importlib

import pytest

from conftest import EXCLUDED, SKILL_MODULES


def _skill_name_from_module(module_path: str) -> str:
    """Extract skill name from module path for test ID."""
    # skills.decision_critic.decision_critic -> decision-critic
    parts = module_path.split(".")
    return parts[1].replace("_", "-") if len(parts) > 1 else module_path


# Build parametrized test cases, excluding non-git skills
_import_cases = [
    pytest.param(mod, id=_skill_name_from_module(mod))
    for mod in SKILL_MODULES
    if not any(excl.replace("-", "_") in mod for excl in EXCLUDED)
]


@pytest.mark.parametrize("module_path", _import_cases)
def test_skill_imports(module_path):
    """Skill module imports without error."""
    importlib.import_module(module_path)
