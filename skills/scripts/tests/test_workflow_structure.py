"""Tests for workflow structural validity."""

import pytest

from skills.lib.workflow import discover_workflows

from conftest import EXCLUDED


def _registered_workflows():
    """Collect registered workflows as pytest params."""
    # discover_workflows handles import and discovery in one call
    registry = discover_workflows("skills")

    return [
        pytest.param(name, workflow, id=name)
        for name, workflow in sorted(registry.items())
        if name not in EXCLUDED
    ]


@pytest.mark.parametrize("name,workflow", _registered_workflows())
def test_workflow_validates(name, workflow):
    """Workflow passes internal validation (entry point exists, transitions valid)."""
    workflow._validate()


@pytest.mark.parametrize("name,workflow", _registered_workflows())
def test_workflow_has_steps(name, workflow):
    """Workflow has at least one step."""
    assert workflow.total_steps >= 1, f"{name} has no steps"


@pytest.mark.parametrize("name,workflow", _registered_workflows())
def test_workflow_step_order_matches_total(name, workflow):
    """Step order length matches total_steps."""
    assert len(workflow._step_order) == workflow.total_steps, (
        f"{name}: _step_order has {len(workflow._step_order)} entries, "
        f"but total_steps is {workflow.total_steps}"
    )


@pytest.mark.parametrize("name,workflow", _registered_workflows())
def test_workflow_has_entry_point(name, workflow):
    """Workflow has a defined entry point."""
    assert workflow.entry_point is not None, f"{name} has no entry point"
    assert workflow.entry_point in workflow.steps, (
        f"{name}: entry point '{workflow.entry_point}' not in steps"
    )
