#!/usr/bin/env python3
"""
Problem Analysis Skill - Root cause identification workflow.

Five-step workflow:
  1. Gate        - Validate input, establish single testable problem
  2. Hypothesize - Generate testable candidate explanations
  3. Investigate - Iterative evidence gathering (up to 5 iterations)
  4. Formulate   - Synthesize findings into validated root cause
  5. Output      - Produce structured report for downstream consumption

This skill identifies root causes, NOT solutions. It ends when the root cause
is identified with supporting evidence. Solution discovery is downstream.
"""

import argparse
import sys

from skills.lib.workflow.prompts import format_step


# ============================================================================
# CONFIGURATION
# ============================================================================

MODULE_PATH = "skills.problem_analysis.analyze"
MAX_ITERATIONS = 5
TOTAL_STEPS = 5


# ============================================================================
# MESSAGE TEMPLATES
# ============================================================================

# --- STEP 1: GATE -----------------------------------------------------------

GATE_INSTRUCTIONS = (
    "CHECK FOR MULTIPLE PROBLEMS:\n"
    "  Scan input for signs of multiple distinct issues:\n"
    "  - Multiple symptoms described ('X AND Y')\n"
    "  - Problems in unrelated components\n"
    "  - Symptoms with independent causes\n"
    "\n"
    "  If multiple problems -> STOP. Use AskUserQuestion to ask user\n"
    "  to isolate ONE problem. Do not proceed until single problem.\n"
    "\n"
    "CHECK FOR SUFFICIENT INFORMATION:\n"
    "  A problem statement must include:\n"
    "  - What component or behavior is affected\n"
    "  - What the expected behavior is\n"
    "  - What the actual observed behavior is\n"
    "\n"
    "  If missing or vague -> Use AskUserQuestion to clarify.\n"
    "\n"
    "RESTATE THE PROBLEM:\n"
    "  Reframe in observable terms:\n"
    "  'When [conditions], [component] exhibits [observed behavior]\n"
    "   instead of [expected behavior]'\n"
    "\n"
    "SEPARATE KNOWN FROM ASSUMED:\n"
    "  KNOWN: From user report or visible context\n"
    "  ASSUMED: Things investigation must verify\n"
    "\n"
    "OUTPUT FORMAT:\n"
    "```\n"
    "VALIDATION: [PASS / BLOCKED: reason]\n"
    "\n"
    "REFINED PROBLEM STATEMENT:\n"
    "When [conditions], [component] exhibits [observed behavior]\n"
    "instead of [expected behavior]\n"
    "\n"
    "KNOWN FACTS:\n"
    "- [fact 1]\n"
    "- [fact 2]\n"
    "\n"
    "ASSUMPTIONS TO VERIFY:\n"
    "- [assumption 1]\n"
    "- [assumption 2]\n"
    "```"
)

# --- STEP 2: HYPOTHESIZE ----------------------------------------------------

HYPOTHESIZE_INSTRUCTIONS = (
    "GENERATE 2-4 DISTINCT HYPOTHESES:\n"
    "  Each hypothesis must:\n"
    "  - Differ on mechanism or location (not just phrasing)\n"
    "  - Be framed as a CONDITION THAT EXISTS, not an absence\n"
    "  - Predict something examinable (where to look, what to find)\n"
    "\n"
    "FRAMING RULES (critical):\n"
    "  WRONG: 'The validation is missing'\n"
    "  RIGHT: 'User input reaches the database query without sanitization'\n"
    "\n"
    "  WRONG: 'There's no error handling'\n"
    "  RIGHT: 'Exceptions in the payment callback propagate uncaught,\n"
    "          terminating the request without rollback'\n"
    "\n"
    "RANK BY PLAUSIBILITY:\n"
    "  Order hypotheses by likelihood given available context.\n"
    "  This guides investigation order but doesn't preclude alternatives.\n"
    "\n"
    "OUTPUT FORMAT:\n"
    "```\n"
    "HYPOTHESES:\n"
    "\n"
    "H1 (highest priority): [name]\n"
    "    Mechanism: [how this would cause the symptom]\n"
    "    Testable by: [what to examine, what you'd expect to find]\n"
    "\n"
    "H2: [name]\n"
    "    Mechanism: [how this would cause the symptom]\n"
    "    Testable by: [what to examine, what you'd expect to find]\n"
    "\n"
    "[H3, H4 if generated]\n"
    "\n"
    "INVESTIGATION PLAN:\n"
    "Will examine H1 first because [reason], then H2 if H1 doesn't hold.\n"
    "```"
)

# --- STEP 3: INVESTIGATE ----------------------------------------------------

INVESTIGATE_INSTRUCTIONS = (
    "SELECT what to examine:\n"
    "  - Highest-priority OPEN hypothesis, OR\n"
    "  - Deepen a SUPPORTED hypothesis (ask 'why does this exist?'), OR\n"
    "  - Examine an unexplored aspect of the problem\n"
    "\n"
    "EXAMINE specific code, configuration, or documentation.\n"
    "  Note exact files and line numbers. This creates an audit trail.\n"
    "\n"
    "ASSESS findings:\n"
    "  Does evidence SUPPORT, CONTRADICT, or NEITHER?\n"
    "  Be specific: 'Line 47 of auth.py contains X which would cause Y'\n"
    "  Not: 'This looks problematic'\n"
    "\n"
    "UPDATE hypothesis status:\n"
    "  - SUPPORTED: Evidence confirms this hypothesis\n"
    "  - CONTRADICTED: Evidence rules this out\n"
    "  - OPEN: Not yet examined or inconclusive\n"
    "\n"
    "ANSWER READINESS QUESTIONS:\n"
    "\n"
    "Q1 EVIDENCE: Can you cite specific code/config/docs supporting root cause?\n"
    "   [YES / PARTIAL / NO]\n"
    "\n"
    "Q2 ALTERNATIVES: Did you examine evidence for at least one alternative?\n"
    "   [YES / PARTIAL / NO]\n"
    "\n"
    "Q3 EXPLANATION: Does root cause fully explain the symptom?\n"
    "   [YES / PARTIAL / NO]\n"
    "\n"
    "Q4 FRAMING: Is root cause a positive condition (not absence)?\n"
    "   [YES / NO]\n"
    "\n"
    "COMPUTE CONFIDENCE:\n"
    "  - 4 points = HIGH (ready to proceed)\n"
    "  - 3-3.5 = MEDIUM\n"
    "  - 2-2.5 = LOW\n"
    "  - <2 = INSUFFICIENT (keep investigating)\n"
    "\n"
    "OUTPUT FORMAT:\n"
    "```\n"
    "ITERATION FINDINGS:\n"
    "\n"
    "Examined: [which hypothesis or aspect]\n"
    "Evidence sought: [what you looked for]\n"
    "Evidence found: [what you found, with file:line references]\n"
    "Assessment: [SUPPORTS / CONTRADICTS / INCONCLUSIVE] because [reason]\n"
    "\n"
    "HYPOTHESIS STATUS:\n"
    "- H1: [SUPPORTED / CONTRADICTED / OPEN] - [brief reason]\n"
    "- H2: [SUPPORTED / CONTRADICTED / OPEN] - [brief reason]\n"
    "\n"
    "READINESS CHECK:\n"
    "- Q1 Evidence: [YES/PARTIAL/NO]\n"
    "- Q2 Alternatives: [YES/PARTIAL/NO]\n"
    "- Q3 Explanation: [YES/PARTIAL/NO]\n"
    "- Q4 Framing: [YES/NO]\n"
    "\n"
    "CONFIDENCE: [exploring/low/medium/high/certain]\n"
    "```"
)

# --- STEP 4: FORMULATE ------------------------------------------------------

FORMULATE_INSTRUCTIONS = (
    "STATE THE ROOT CAUSE:\n"
    "  Template: 'The system exhibits [symptom] because [condition exists]'\n"
    "\n"
    "  The condition must be:\n"
    "  - Specific enough to locate (points to code/config)\n"
    "  - General enough to allow multiple remediation approaches\n"
    "\n"
    "TRACE THE CAUSAL CHAIN:\n"
    "  [root cause] -> [intermediate] -> [intermediate] -> [symptom]\n"
    "  Each link should follow logically. Note any gaps as uncertainties.\n"
    "\n"
    "VALIDATE FRAMING (critical):\n"
    "\n"
    "  CHECK 1 - Positive framing:\n"
    "  Does root cause contain 'lack of', 'missing', 'no X', 'doesn't have'?\n"
    "  If YES -> REFRAME before proceeding.\n"
    "\n"
    "  WRONG: 'The system lacks input validation'\n"
    "  RIGHT: 'User input flows directly to SQL query without sanitization'\n"
    "\n"
    "  CHECK 2 - Solution independence:\n"
    "  Does root cause implicitly prescribe exactly one solution?\n"
    "  If YES -> REFRAME to be more general.\n"
    "\n"
    "  WRONG: 'The retry count is set to 0' (prescribes: set it higher)\n"
    "  RIGHT: 'Failed API calls terminate immediately without retry,\n"
    "          causing transient failures to surface as errors'\n"
    "\n"
    "DOCUMENT UNCERTAINTIES:\n"
    "  What wasn't verified? What would require runtime info to confirm?\n"
    "\n"
    "OUTPUT FORMAT:\n"
    "```\n"
    "ROOT CAUSE:\n"
    "[validated statement - must pass both framing checks]\n"
    "\n"
    "CAUSAL CHAIN:\n"
    "[root cause]\n"
    "  -> [intermediate 1]\n"
    "  -> [intermediate 2]\n"
    "  -> [observed symptom]\n"
    "\n"
    "FRAMING VALIDATION:\n"
    "- Positive framing (no absences): [PASS/FAIL - if fail, show reframed]\n"
    "- Solution independence: [PASS/FAIL - if fail, show reframed]\n"
    "\n"
    "REMAINING UNCERTAINTIES:\n"
    "- [what wasn't verified]\n"
    "- [what assumptions remain]\n"
    "```"
)

# --- STEP 5: OUTPUT ----------------------------------------------------------

OUTPUT_INSTRUCTIONS = (
    "Compile final analysis report using all findings from previous steps.\n"
    "\n"
    "OUTPUT FORMAT:\n"
    "```\n"
    "================================================================================\n"
    "                         PROBLEM ANALYSIS REPORT\n"
    "================================================================================\n"
    "\n"
    "ORIGINAL PROBLEM:\n"
    "[verbatim from user]\n"
    "\n"
    "REFINED PROBLEM:\n"
    "[observable-framed version from Step 1]\n"
    "\n"
    "--------------------------------------------------------------------------------\n"
    "\n"
    "ROOT CAUSE:\n"
    "[validated statement from Step 4]\n"
    "\n"
    "CAUSAL CHAIN:\n"
    "[root cause]\n"
    "  -> [intermediate cause 1]\n"
    "  -> [intermediate cause 2]\n"
    "  -> [observed symptom]\n"
    "\n"
    "--------------------------------------------------------------------------------\n"
    "\n"
    "SUPPORTING EVIDENCE:\n"
    "- [file:line] -- [what it shows]\n"
    "- [file:line] -- [what it shows]\n"
    "\n"
    "--------------------------------------------------------------------------------\n"
    "\n"
    "CONFIDENCE: [HIGH / MEDIUM / LOW / INSUFFICIENT]\n"
    "\n"
    "  Evidence (specific citations exist):      [YES / PARTIAL / NO]\n"
    "  Alternatives (others considered):         [YES / PARTIAL / NO]\n"
    "  Explanation (fully accounts for symptom): [YES / PARTIAL / NO]\n"
    "  Framing (positive, solution-independent): [YES / NO]\n"
    "\n"
    "--------------------------------------------------------------------------------\n"
    "\n"
    "REMAINING UNCERTAINTIES:\n"
    "- [what wasn't verified]\n"
    "- [what assumptions remain]\n"
    "\n"
    "--------------------------------------------------------------------------------\n"
    "\n"
    "INVESTIGATION LOG:\n"
    "[Include key findings from each Step 3 iteration]\n"
    "\n"
    "================================================================================\n"
    "```\n"
    "\n"
    "This completes the problem analysis. The root cause and supporting\n"
    "evidence can now be used as input for solution discovery."
)


# ============================================================================
# MESSAGE BUILDERS
# ============================================================================


def build_next_command(step: int, confidence: str, iteration: int) -> str | None:
    """Build invoke command for next step."""
    base = f'python3 -m {MODULE_PATH}'
    if step == 1:
        return f'{base} --step 2'
    if step == 2:
        return f'{base} --step 3 --confidence exploring --iteration 1'
    if step == 3:
        if confidence in ("high", "certain") or iteration >= MAX_ITERATIONS:
            return f'{base} --step 4'
        return f'{base} --step 3 --confidence {{exploring|low|medium|high|certain}} --iteration {iteration + 1}'
    if step == 4:
        return f'{base} --step 5'
    return None


# ============================================================================
# STEP DEFINITIONS
# ============================================================================

STATIC_STEPS = {
    1: ("Gate", GATE_INSTRUCTIONS),
    2: ("Hypothesize", HYPOTHESIZE_INSTRUCTIONS),
    4: ("Formulate", FORMULATE_INSTRUCTIONS),
    5: ("Output", OUTPUT_INSTRUCTIONS),
}


def _format_step_3(confidence: str, iteration: int) -> tuple[str, str]:
    """Dynamic formatter for step 3 (Investigate) -- handles iteration/exit logic."""
    if confidence in ("high", "certain"):
        return (
            "Investigate Complete",
            "Investigation reached HIGH confidence. Proceeding to root cause formulation.\n\n"
            "Review accumulated findings from iterations above, then proceed.",
        )
    if iteration >= MAX_ITERATIONS:
        return (
            "Investigate Complete",
            f"Investigation reached iteration cap ({MAX_ITERATIONS}). "
            f"Proceeding with current findings. Final confidence: {confidence}\n\n"
            "Review accumulated findings from iterations above, then proceed.",
        )
    return (f"Investigate (Iteration {iteration} of {MAX_ITERATIONS})", INVESTIGATE_INSTRUCTIONS)


DYNAMIC_STEPS = {
    3: _format_step_3,
}


# ============================================================================
# OUTPUT FORMATTING
# ============================================================================


def format_output(step: int, confidence: str, iteration: int) -> str:
    """Format output for the given step."""
    if step in STATIC_STEPS:
        title, instructions = STATIC_STEPS[step]
    elif step in DYNAMIC_STEPS:
        title, instructions = DYNAMIC_STEPS[step](confidence, iteration)
    else:
        return f"ERROR: Invalid step {step}"

    next_cmd = build_next_command(step, confidence, iteration)
    return format_step(instructions, next_cmd or "", title=f"PROBLEM ANALYSIS - {title}")


# ============================================================================
# ENTRY POINT
# ============================================================================


def main():
    parser = argparse.ArgumentParser(
        description="Problem Analysis - Root cause identification workflow",
        epilog="Steps: gate (1) -> hypothesize (2) -> investigate (3) -> formulate (4) -> output (5)",
    )
    parser.add_argument("--step", type=int, required=True)
    parser.add_argument(
        "--confidence",
        type=str,
        choices=["exploring", "low", "medium", "high", "certain"],
        default="exploring",
        help="Confidence level from previous iteration (Step 3 only)",
    )
    parser.add_argument(
        "--iteration",
        type=int,
        default=1,
        help="Current iteration within Step 3 (1-5)",
    )
    args = parser.parse_args()

    if args.step < 1 or args.step > TOTAL_STEPS:
        sys.exit(f"ERROR: --step must be 1-{TOTAL_STEPS}")

    print(format_output(args.step, args.confidence, args.iteration))


if __name__ == "__main__":
    main()
