"""Test input generation for workflow exhaustive testing.

Extracts parameter schemas from Workflow ASTs and generates Cartesian products
of valid input combinations for pytest parametrization.

## Design Decision: Exhaustive Enumeration

This module generates ALL valid parameter combinations (exhaustive enumeration)
rather than sampling. Domain sizes are small (typically 5 iterations x 5
confidences x 2 modes = ~50 combinations per iterating step), making exhaustive
testing tractable (~300-500 total test cases across all workflows). Exhaustive
coverage catches all corner cases; sampling would miss edge combinations that
could trigger failures.
"""

from __future__ import annotations

import itertools

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from skills.lib.workflow.core import Workflow

from skills.lib.workflow.types import BoundedInt, ChoiceSet, Confidence, Constant


# Hardcoded iterating step indices per workflow
# These were previously detected via Outcome.ITERATE in step.next
ITERATING_STEPS = {
    "deepthink": {13},  # iterative_refinement step
    "problem-analysis": {3},  # investigate step
    "codebase-analysis": {1, 2, 3, 4},  # all steps can iterate
}


def synthetic_value(pname: str, pspec: dict | None = None) -> str:
    """Return synthetic test value for required parameter.

    Provides hardcoded test strings for common workflow parameters
    that require non-empty values for CLI invocability testing.
    Content is irrelevant: tests verify step machinery, not param validation.

    If pspec is provided and has choices, returns first valid choice.
    """
    # If choices exist, use first valid choice
    if pspec and pspec.get("choices"):
        return pspec["choices"][0]

    mappings = {
        "decision": "Test decision for validation",
        "question": "Test question for validation",
        "prompt": "Test prompt for validation",
        "problem": "Test problem for validation",
    }
    return mappings.get(pname, f"Test {pname}")


def get_iterating_step_indices(workflow: Workflow) -> set[int]:
    """Return set of step indices (1-based) that have iteration capability."""
    return ITERATING_STEPS.get(workflow.name, set())


def get_mode_gated_steps(workflow: Workflow) -> dict[str, frozenset[int]]:
    """Return mapping of mode values to step indices (1-based) skipped in that mode.

    Currently hardcoded for deepthink: quick mode skips steps 6-11.
    frozenset enables set membership tests in tight loop (generate_inputs).
    Only deepthink workflow has mode-gated steps (quick mode skips steps 6-11).
    """
    if workflow.name == "deepthink":
        return {"quick": frozenset(range(6, 12))}
    return {}


def _extract_global_params(workflow: Workflow) -> dict:
    """Extract global parameters applicable to all steps.

    Returns dict with step and optionally mode domains.
    """
    global_params = {
        "step": BoundedInt(1, workflow.total_steps),
    }

    # Detect mode param (deepthink workflow only)
    if workflow._params:
        first_step_params = next(iter(workflow._params.values()), [])
        for pspec in first_step_params:
            if pspec["name"] == "mode" and pspec.get("choices"):
                global_params["mode"] = ChoiceSet(tuple(pspec["choices"]))
                break

    return global_params


def _extract_conditional_params(workflow: Workflow, iterating_steps: set[int]) -> dict:
    """Extract conditional parameters that apply only to certain steps.

    Returns dict mapping param names to (Domain, applicable_step_indices) tuples.
    """
    conditional = {}

    # Iteration param for iterating steps
    if iterating_steps:
        # Upper bound matches QR_ITERATION_LIMIT (5) in constants.py.
        conditional["iteration"] = (BoundedInt(1, 5), iterating_steps)

    # Confidence param - scan all steps to find where it applies
    confidence_steps = set()
    for idx, step_id in enumerate(workflow._step_order, start=1):
        if step_id in workflow._params:
            for pspec in workflow._params[step_id]:
                if pspec["name"] == "confidence" and pspec.get("choices"):
                    confidence_steps.add(idx)
    if confidence_steps:
        conditional["confidence"] = (
            ChoiceSet(tuple(c.value for c in Confidence)),
            confidence_steps,
        )

    return conditional


def _extract_step_params(workflow: Workflow) -> dict:
    """Extract step-specific required parameters.

    Returns dict mapping step indices to {param_name: synthetic_value}.
    """
    step_params = {}
    for idx, step_id in enumerate(workflow._step_order, start=1):
        if step_id in workflow._params:
            step_required = {}
            for pspec in workflow._params[step_id]:
                pname = pspec["name"]
                # Skip global and conditional params
                if pname in ("step", "mode", "iteration", "confidence"):
                    continue
                # Required params get synthetic values
                if pspec["required"]:
                    # Derive scope from workflow name if possible
                    # e.g. prompt-engineer-ecosystem -> scope=ecosystem
                    if pname == "scope" and pspec.get("choices"):
                        matched = next(
                            (c for c in pspec["choices"] if workflow.name.endswith(f"-{c}")),
                            None,
                        )
                        step_required[pname] = matched if matched else pspec["choices"][0]
                    else:
                        step_required[pname] = synthetic_value(pname, pspec)
            if step_required:
                step_params[idx] = step_required
    return step_params


def extract_schema(workflow: Workflow) -> dict:
    """Extract parameter schema from Workflow for test generation.

    Returns dict with:
        global: {param_name: Domain} - params applicable to all steps
        conditional: {param_name: (Domain, applicable_step_indices)} - conditional params
        step_params: {step_idx: {param_name: value}} - step-specific required params
        mode_skip: {mode_value: frozenset[int]} - steps to skip per mode
    """
    # Validation: _step_order must exist and match total_steps.
    # Without this, step_id -> index mapping would be undefined, breaking CLI invocation.
    if not hasattr(workflow, "_step_order"):
        raise ValueError(f"Workflow {workflow.name} missing _step_order")
    if len(workflow._step_order) != workflow.total_steps:
        raise ValueError(
            f"Workflow {workflow.name}: _step_order length {len(workflow._step_order)} "
            f"!= total_steps {workflow.total_steps}"
        )

    iterating_steps = get_iterating_step_indices(workflow)

    return {
        "global": _extract_global_params(workflow),
        "conditional": _extract_conditional_params(workflow, iterating_steps),
        "step_params": _extract_step_params(workflow),
        "mode_skip": get_mode_gated_steps(workflow),
    }


def generate_inputs(workflow: Workflow):
    """Generate all valid (step, param) combinations for workflow testing.

    Yields dicts with step and applicable params.
    Filters out mode-gated steps and applies conditional params only at applicable steps.
    """
    schema = extract_schema(workflow)

    # Get mode domain if it exists
    mode_domain = schema["global"].get("mode")
    modes = list(mode_domain) if mode_domain else [None]

    # Get step domain
    step_domain = schema["global"]["step"]

    # Iterate over all steps
    for step in step_domain:
        # Iterate over modes
        for mode in modes:
            # Skip if this step is gated in this mode
            if mode and step in schema["mode_skip"].get(mode, frozenset()):
                continue

            # Build base params
            base = {
                "step": step,
            }
            if mode is not None:
                base["mode"] = mode

            # Add step-specific required params
            if step in schema["step_params"]:
                base.update(schema["step_params"][step])

            # Collect applicable conditional params
            conditional_domains = {}
            for pname, (domain, applicable_steps) in schema["conditional"].items():
                if step in applicable_steps:
                    conditional_domains[pname] = list(domain)

            # Generate Cartesian product
            if conditional_domains:
                param_names = sorted(conditional_domains.keys())
                param_values = [conditional_domains[n] for n in param_names]
                for combo in itertools.product(*param_values):
                    params = dict(base)
                    params.update(zip(param_names, combo))
                    yield params
            else:
                # No conditional params for this step
                yield base
