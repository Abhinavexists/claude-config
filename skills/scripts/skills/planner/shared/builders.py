"""Shared string builders for planner output.

Constants for static text, functions for parameterized output.
"""


THINKING_EFFICIENCY = (
    "THINKING EFFICIENCY:\n"
    "  Max 5 words per step. Symbolic notation preferred.\n"
    "  -> for implies | for alternatives ; for sequence\n"
    '  Example: "QR failed -> route step 8 | iteration++"'
)

PEDANTIC_ENFORCEMENT = (
    "QR exists to catch problems BEFORE they reach production.\n"
    "ALL issues must be fixed before proceeding."
)

SCRIPT_MODE_RULES = (
    "SCRIPT-MODE DISPATCH RULES:\n"
    "\n"
    "Your Task prompt contains ONLY the exact invoke command.\n"
    "\n"
    "FORBIDDEN in Task prompt:\n"
    "  - Task descriptions or summaries\n"
    "  - Goals or objectives\n"
    "  - Context from conversation\n"
    "  - Explanations of what the sub-agent should do\n"
    "  - Environment variables or STATE_DIR values\n"
    "\n"
    "The script tells the sub-agent what to do. You just invoke it."
)


def format_forbidden(*items: str) -> str:
    """Forbidden block. Dynamic args because each gate has different items."""
    lines = "\n".join(f"  - {item}" for item in items)
    return f"FORBIDDEN:\n{lines}"


def format_gate_result(passed: bool) -> str:
    """Gate result banner.

    WHY no iteration count: Prevents LLM from rationalizing "small enough"
    issues after multiple fix cycles. Only pass/fail state matters.
    """
    return "GATE RESULT: PASS" if passed else "GATE RESULT: FAIL"
