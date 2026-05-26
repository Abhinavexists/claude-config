"""Unified gate output builder for planner and executor workflows.

Single implementation eliminates ~150 lines of duplicated gate logic.
Both planner.py and executor.py call this with their MODULE_PATH.
"""

from dataclasses import dataclass

from skills.lib.workflow.prompts.step import format_step
from skills.planner.shared.builders import (
    format_gate_result,
    format_forbidden,
    PEDANTIC_ENFORCEMENT,
)
from skills.planner.shared.qr.types import QRState, AgentRole


@dataclass
class GateResult:
    """Return type for build_gate_output.

    Why dataclass over plain str: callers distinguish terminal passes
    (workflow done, run translate) from non-terminal passes (proceed to
    next phase). terminal_pass carries pass_step=None without requiring
    callers to re-derive it.
    """
    output: str
    terminal_pass: bool


def build_gate_output(
    module_path: str,
    script_name: str,
    qr_name: str,
    qr: QRState,
    step: int,
    work_step: int,
    pass_step: int | None,
    pass_message: str,
    fix_target: AgentRole | None,
    state_dir: str) -> GateResult:
    """Build complete gate step output for QR gates.

    Gates route to either:
    - pass_step: QR passed, proceed to next workflow phase
    - work_step: QR failed, loop back to fix issues
    """
    parts = []
    parts.append(format_gate_result(passed=qr.passed))
    parts.append("")

    if qr.passed:
        parts.append(pass_message)
        parts.append("")
        parts.append(format_forbidden(
            "Asking the user whether to proceed - the workflow is deterministic",
            "Offering alternatives to the next step - all steps are mandatory",
            "Interpreting 'proceed' as optional - EXECUTE immediately",
        ))
    else:
        parts.append(PEDANTIC_ENFORCEMENT)
        parts.append("")
        target_name = fix_target.value if fix_target else "developer"
        parts.append(
            f"NEXT ACTION:\n"
            f"  Invoke the next step command.\n"
            f"  The next step will dispatch {target_name} with fix guidance."
        )
        parts.append("")
        parts.append(format_forbidden(
            "Fixing issues directly from this gate step",
            "Spawning agents directly from this gate step",
            "Using Edit/Write tools yourself",
            "Proceeding without invoking the next step",
            "Interpreting 'minor issues' as skippable",
            "Claiming 'diminishing returns' or 'comprehensive enough'",
            "Proceeding to next phase without QR PASS",
        ))

    body = "\n".join(parts)
    title = f"{qr_name} Gate"
    terminal_pass = qr.passed and pass_step is None

    if terminal_pass:
        return GateResult(output=format_step(body, title=title), terminal_pass=True)

    if qr.passed:
        next_cmd = f"python3 -m {module_path} --step {pass_step}"
        if state_dir:
            next_cmd += f" --state-dir {state_dir}"
    else:
        next_cmd = f"python3 -m {module_path} --step {work_step} --state-dir {state_dir}"

    return GateResult(
        output=format_step(body, next_cmd, title=title),
        terminal_pass=False,
    )
