"""Reusable constraint strings for planner orchestration.

Constants for static constraints, functions for parameterized output.
"""


ORCHESTRATOR_CONSTRAINT = (
    "You are the ORCHESTRATOR. You delegate, you never implement.\n"
    "Your agents are highly capable. Trust them with ANY issue.\n"
    "PROHIBITED: Read, Edit, Write tools. REQUIRED: Task tool dispatch only."
)

ORCHESTRATOR_CONSTRAINT_EXTENDED = (
    ORCHESTRATOR_CONSTRAINT + "\n"
    "\n"
    "THINKING EFFICIENCY: Before dispatch, max 5 words internal reasoning.\n"
    'Example thinking: "step 7 -> developer dispatch -> invoke"\n'
    "\n"
    "SCRIPT-MODE DISPATCH: Pass ONLY the invoke command and context var values.\n"
    "DO NOT add task descriptions, goals, or any other text.\n"
    "The script provides all instructions to the sub-agent."
)


def format_state_banner(checkpoint: str, iteration: int, mode: str) -> str:
    """QR state context banner.

    WHY needed: Fix/review steps need workflow position context. LLM sees
    which phase, iteration count (for convergence tracking), and mode.
    """
    return f"STATE: {checkpoint} | iteration={iteration} | mode={mode}"
