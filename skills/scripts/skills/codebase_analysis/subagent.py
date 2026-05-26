#!/usr/bin/env python3
"""
Codebase Analysis Explore - Focus-area exploration for codebase understanding.

Four-step workflow:
  1. ORIENT   - Identify entry points for focus area
  2. MAP      - Build structural understanding
  3. EXTRACT  - Capture specific knowledge
  4. REPORT   - Synthesize into structured output

Note: The focus area is NOT a CLI argument. The orchestrator provides focus
in the subagent's launching prompt. This script emits guidance that refers
to "the focus area" -- the agent knows what it is from its prompt context.
"""

import argparse
import sys

from skills.lib.workflow.prompts import format_step


# ============================================================================
# CONFIGURATION
# ============================================================================

MODULE_PATH = "skills.codebase_analysis.subagent"
TOTAL_STEPS = 4


# ============================================================================
# MESSAGE TEMPLATES
# ============================================================================

# --- STEP 1: ORIENT ---------------------------------------------------------

ORIENT_INSTRUCTIONS = (
    "ORIENT - Identify entry points for your focus area.\n"
    "\n"
    "Your focus area was specified in your launching prompt.\n"
    "\n"
    "ACTIONS:\n"
    "  1. Glob for patterns matching focus area keywords\n"
    "  2. Identify 3-8 candidate files as entry points\n"
    "  3. Note language/framework indicators\n"
    "\n"
    "EDGE CASE: If glob returns 0 matches, output empty entry points and proceed.\n"
    "\n"
    "OUTPUT FORMAT:\n"
    "```\n"
    "ORIENTATION:\n"
    "  Focus: [your focus area]\n"
    "  Entry Points:\n"
    "    - src/auth/login.py (main entry)\n"
    "    - [3-8 files, or \"No matches found\"]\n"
    "  Scope Estimate: N files\n"
    "```"
)

# --- STEP 2: MAP ------------------------------------------------------------

MAP_INSTRUCTIONS = (
    "MAP - Build structural understanding from entry points.\n"
    "\n"
    "INPUT: Use entry points from Step 1.\n"
    "\n"
    "ACTIONS:\n"
    "  1. Read key files identified in ORIENT\n"
    "  2. Trace imports, calls, data flow\n"
    "  3. Build component inventory\n"
    "  4. Identify relationships between components\n"
    "\n"
    "OUTPUT FORMAT:\n"
    "```\n"
    "STRUCTURE MAP:\n"
    "  Components:\n"
    "    - LoginHandler (src/auth/login.py) - entry point\n"
    "  Relationships:\n"
    "    - LoginHandler -> TokenService (calls)\n"
    "  Patterns:\n"
    "    - Repository pattern (3 occurrences)\n"
    "```"
)

# --- STEP 3: EXTRACT --------------------------------------------------------

EXTRACT_INSTRUCTIONS = (
    "EXTRACT - Capture specific knowledge from structure map.\n"
    "\n"
    "INPUT: Use structure map from Step 2.\n"
    "\n"
    "ACTIONS:\n"
    "  For each key component, answer:\n"
    "  - HOW does this work? (mechanism)\n"
    "  - WHY this approach? (design decision)\n"
    "\n"
    "  Also identify:\n"
    "  - Unclear areas needing further exploration\n"
    "  - Edge cases or non-obvious behavior\n"
    "\n"
    "OUTPUT FORMAT:\n"
    "```\n"
    "EXTRACTED KNOWLEDGE:\n"
    "  TokenService:\n"
    "    How: JWT-based with RSA signing, 1hr expiry\n"
    "    Why: Stateless auth for horizontal scaling\n"
    "  Decision (security): Refresh tokens stored in Redis\n"
    "  Unclear: Token revocation mechanism not evident\n"
    "```"
)

# --- STEP 4: REPORT ---------------------------------------------------------

REPORT_INSTRUCTIONS = (
    "REPORT - Synthesize findings into structured summary.\n"
    "\n"
    "INPUT: All prior step outputs (orientation, structure map, extracted knowledge).\n"
    "\n"
    "OUTPUT FORMAT (REQUIRED - all sections must be present):\n"
    "```\n"
    "EXPLORATION REPORT\n"
    "Focus: [your focus area]\n"
    "\n"
    "Summary: [1-2 sentence overview]\n"
    "\n"
    "Structure:\n"
    "  [Key components and their roles, or \"No clear component structure identified\"]\n"
    "\n"
    "Patterns:\n"
    "  [Observed architectural/code patterns, or \"No significant patterns observed\"]\n"
    "\n"
    "Flows:\n"
    "  [Data/request flow through the system, or \"Data flow not traced\"]\n"
    "\n"
    "Decisions:\n"
    "  [Technology/design choices with rationale, or \"No explicit design decisions found\"]\n"
    "\n"
    "Gaps:\n"
    "  [Areas that remain unclear, or \"Focus area may not exist in codebase\"]\n"
    "```\n"
    "\n"
    "COMPLETE - Return exploration report to orchestrator."
)


# ============================================================================
# MESSAGE BUILDERS
# ============================================================================


def build_next_command(step: int) -> str | None:
    """Build invoke command for next step."""
    if step >= TOTAL_STEPS:
        return None
    return f"python3 -m {MODULE_PATH} --step {step + 1}"


# ============================================================================
# STEP DEFINITIONS
# ============================================================================

STATIC_STEPS = {
    1: ("Orient", ORIENT_INSTRUCTIONS),
    2: ("Map", MAP_INSTRUCTIONS),
    3: ("Extract", EXTRACT_INSTRUCTIONS),
    4: ("Report", REPORT_INSTRUCTIONS),
}


# ============================================================================
# OUTPUT FORMATTING
# ============================================================================


def format_output(step: int) -> str:
    """Format output for given step."""
    if step not in STATIC_STEPS:
        return f"ERROR: Invalid step {step}"

    title, instructions = STATIC_STEPS[step]
    next_cmd = build_next_command(step)
    return format_step(instructions, next_cmd or "", title=f"CODEBASE EXPLORE - {title}")


# ============================================================================
# ENTRY POINT
# ============================================================================


def main():
    parser = argparse.ArgumentParser(
        description="Codebase Analysis Explore - Focus-area exploration",
    )
    parser.add_argument("--step", type=int, required=True)
    args = parser.parse_args()

    if args.step < 1 or args.step > TOTAL_STEPS:
        sys.exit(f"ERROR: --step must be 1-{TOTAL_STEPS}")

    print(format_output(args.step))


if __name__ == "__main__":
    main()
