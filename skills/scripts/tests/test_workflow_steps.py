"""Exhaustive step tests for all workflow-based skills.

Tests every step of every workflow with all valid parameter combinations.
Uses domain types (BoundedInt, ChoiceSet, Constant) to generate Cartesian products.
"""

import pytest

from skills.lib.workflow import discover_workflows

from test_generation import generate_inputs

from conftest import EXCLUDED, run_skill_invocation


def _collect_test_cases():
    """Collect all test cases from registered workflows.

    Returns list of pytest.param with (workflow_name, workflow, params) and test IDs.
    """
    # discover_workflows handles import and discovery in one call
    registry = discover_workflows("skills")
    test_cases = []

    for name, workflow in sorted(registry.items()):
        if name in EXCLUDED:
            continue

        for params in generate_inputs(workflow):
            # Build readable test ID: workflow-sN-param1-param2
            # 's' prefix distinguishes step from iteration 'i' in pytest output.
            step = params["step"]
            id_parts = [name, f"s{step}"]

            # Add param variants in alphabetical order (excluding step)
            for key in sorted(params.keys()):
                if key not in ("step",):
                    value = params[key]
                    # Shorten mode values: full/quick
                    if key == "mode":
                        id_parts.append(value)
                    # Iteration: i1, i2, etc
                    elif key == "iteration":
                        id_parts.append(f"i{value}")
                    # Confidence: first letter
                    elif key == "confidence":
                        id_parts.append(value[0])
                    # Other params: key=value (truncate long values)
                    else:
                        val_str = str(value)[:20]
                        id_parts.append(f"{key}={val_str}")

            test_id = "-".join(id_parts)
            test_cases.append(pytest.param(name, workflow, params, id=test_id))

    return test_cases


@pytest.mark.parametrize(
    "workflow_name,workflow,params",
    _collect_test_cases(),
)
def test_workflow_step(workflow_name, workflow, params):
    """Test that workflow step is invocable with given params."""
    ok, msg = run_skill_invocation(workflow, params)
    assert ok, f"Step {params['step']} failed: {msg}"
