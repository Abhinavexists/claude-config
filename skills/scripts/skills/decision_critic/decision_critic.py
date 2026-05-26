#!/usr/bin/env python3
"""
Decision Critic - Structured decision criticism workflow.

Seven-step workflow:
  1-2: DECOMPOSITION - Extract structure, classify verifiability
  3-4: VERIFICATION - Generate questions, factored verification
  5-6: CHALLENGE - Contrarian perspective, alternative framing
  7:   SYNTHESIS - Verdict and recommendation

Research grounding:
  - Chain-of-Verification (Dhuliawala et al., 2023)
  - Self-Consistency (Wang et al., 2023)
"""

import argparse
import sys

from skills.lib.workflow.prompts import format_step


# ============================================================================
# CONFIGURATION
# ============================================================================

MODULE_PATH = "skills.decision_critic.decision_critic"


# ============================================================================
# MESSAGE TEMPLATES
# ============================================================================

# --- STEP 1: EXTRACT_STRUCTURE ----------------------------------------------

EXTRACT_STRUCTURE_INSTRUCTIONS = (
    "Extract and assign stable IDs (persist through ALL steps):\n"
    "\n"
    "CLAIMS [C1, C2, ...] - Factual assertions (3-7)\n"
    "  What facts/cause-effect relationships are assumed?\n"
    "\n"
    "ASSUMPTIONS [A1, A2, ...] - Unstated beliefs (2-5)\n"
    "  What is implied but not stated?\n"
    "\n"
    "CONSTRAINTS [K1, K2, ...] - Hard boundaries (1-4)\n"
    "  Technical/organizational limitations?\n"
    "\n"
    "JUDGMENTS [J1, J2, ...] - Subjective tradeoffs (1-3)\n"
    "  Where are values weighed against each other?\n"
    "\n"
    "FORMAT: C1: <claim> | A1: <assumption> | K1: <constraint>"
)

# --- STEP 2: CLASSIFY_VERIFIABILITY -----------------------------------------

CLASSIFY_VERIFIABILITY_INSTRUCTIONS = (
    "Classify each item from Step 1:\n"
    "\n"
    "[V] VERIFIABLE - Can be checked against evidence\n"
    "[J] JUDGMENT - Subjective, no objective answer\n"
    "[C] CONSTRAINT - Given condition, accepted as fixed\n"
    "\n"
    "Edge case: prefer [V] over [J] over [C]\n"
    "\n"
    "FORMAT: C1 [V]: <claim> | A1 [J]: <assumption>\n"
    "COUNT: State how many [V] items need verification."
)

# --- STEP 3: GENERATE_QUESTIONS ---------------------------------------------

GENERATE_QUESTIONS_INSTRUCTIONS = (
    "For each [V] item, generate 1-3 verification questions:\n"
    "\n"
    "CRITERIA:\n"
    "  - Specific and independently answerable\n"
    "  - Designed to FALSIFY (not confirm)\n"
    "  - Each tests different aspect\n"
    "\n"
    "FORMAT:\n"
    "  C1 [V]: <claim>\n"
    "    Q1: <question>\n"
    "    Q2: <question>"
)

# --- STEP 4: FACTORED_VERIFICATION ------------------------------------------

FACTORED_VERIFICATION_INSTRUCTIONS = (
    "Answer each question INDEPENDENTLY (most important step).\n"
    "\n"
    "EPISTEMIC BOUNDARY:\n"
    "  Use ONLY: established knowledge, stated constraints, logical inference\n"
    "  Do NOT: assume decision is correct/incorrect and work backward\n"
    "\n"
    "SEPARATE answer from implication:\n"
    "  Answer: factual response (evidence-based)\n"
    "  Implication: what this means for claim\n"
    "\n"
    "Mark each [V] item:\n"
    "  VERIFIED - answers consistent with claim\n"
    "  FAILED - answers reveal inconsistency/error\n"
    "  UNCERTAIN - insufficient evidence"
)

# --- STEP 5: CONTRARIAN_PERSPECTIVE -----------------------------------------

CONTRARIAN_PERSPECTIVE_INSTRUCTIONS = (
    "Generate the STRONGEST argument AGAINST the decision.\n"
    "\n"
    "Start from verification results:\n"
    "  FAILED = direct ammunition\n"
    "  UNCERTAIN = attack vectors\n"
    "\n"
    "Steel-man the opposition (best case, not strawman):\n"
    "  - What could go wrong?\n"
    "  - What alternatives dismissed too quickly?\n"
    "  - What second-order effects missed?\n"
    "\n"
    "OUTPUT:\n"
    "  CONTRARIAN POSITION: <one sentence>\n"
    "  ARGUMENT: <2-3 paragraphs>\n"
    "  KEY RISKS: <bullet list>"
)

# --- STEP 6: ALTERNATIVE_FRAMING --------------------------------------------

ALTERNATIVE_FRAMING_INSTRUCTIONS = (
    "Challenge the PROBLEM STATEMENT (not solution).\n"
    "\n"
    "Set aside proposed solution and ask:\n"
    "  - Is this the right problem or a symptom?\n"
    "  - What would a different stakeholder prioritize?\n"
    "  - What if constraints were negotiable?\n"
    "  - Is there a simpler formulation?\n"
    "\n"
    "OUTPUT:\n"
    "  ALTERNATIVE FRAMING: <one sentence>\n"
    "  WHAT THIS EMPHASIZES: <paragraph>\n"
    "  HIDDEN ASSUMPTIONS REVEALED: <list>\n"
    "  IMPLICATION FOR DECISION: <paragraph>"
)

# --- STEP 7: SYNTHESIS ------------------------------------------------------

SYNTHESIS_INSTRUCTIONS = (
    "VERDICT RUBRIC:\n"
    "\n"
    "ESCALATE when:\n"
    "  - Any FAILED on safety/security/compliance\n"
    "  - Any critical UNCERTAIN that cannot be cheaply verified\n"
    "  - Alternative framing reveals problem itself is wrong\n"
    "\n"
    "REVISE when:\n"
    "  - Any FAILED on core claim\n"
    "  - Multiple UNCERTAIN on feasibility/effort/impact\n"
    "  - Challenge phase revealed unaddressed gaps\n"
    "\n"
    "STAND when:\n"
    "  - No FAILED on core claims\n"
    "  - UNCERTAIN items explicitly acknowledged as accepted risks\n"
    "  - Challenges addressable within current approach\n"
    "\n"
    "OUTPUT:\n"
    "  VERDICT: STAND | REVISE | ESCALATE\n"
    "  VERIFICATION SUMMARY: (Verified/Failed/Uncertain lists)\n"
    "  CHALLENGE ASSESSMENT: (strongest challenge, response)\n"
    "  RECOMMENDATION: (specific next action)"
)


# ============================================================================
# MESSAGE BUILDERS
# ============================================================================


def build_next_command(step: int) -> str | None:
    """Build invoke command for next step."""
    base = f'python3 -m {MODULE_PATH}'
    if step == 1:
        return f'{base} --step 2'
    elif step == 2:
        return f'{base} --step 3'
    elif step == 3:
        return f'{base} --step 4'
    elif step == 4:
        return f'{base} --step 5'
    elif step == 5:
        return f'{base} --step 6'
    elif step == 6:
        return f'{base} --step 7'
    elif step == 7:
        return None
    return None


# ============================================================================
# STEP DEFINITIONS
# ============================================================================

# Static steps 2-7: (title, instructions) tuples for steps with constant content
STATIC_STEPS = {
    2: ("Classify Verifiability", CLASSIFY_VERIFIABILITY_INSTRUCTIONS),
    3: ("Generate Verification Questions", GENERATE_QUESTIONS_INSTRUCTIONS),
    4: ("Factored Verification", FACTORED_VERIFICATION_INSTRUCTIONS),
    5: ("Contrarian Perspective", CONTRARIAN_PERSPECTIVE_INSTRUCTIONS),
    6: ("Alternative Framing", ALTERNATIVE_FRAMING_INSTRUCTIONS),
    7: ("Synthesis and Verdict", SYNTHESIS_INSTRUCTIONS),
}


def _format_step_1(decision: str) -> tuple[str, str]:
    """Step 1: Extract Structure - prepends decision context to body."""
    body = (
        f"DECISION UNDER REVIEW: {decision}\n"
        "\n"
        f"{EXTRACT_STRUCTURE_INSTRUCTIONS}"
    )
    return ("Extract Structure", body)


# Dynamic steps: functions that compute (title, instructions) based on parameters
DYNAMIC_STEPS = {
    1: _format_step_1,
}


# ============================================================================
# OUTPUT FORMATTING
# ============================================================================


def format_output(step: int, decision: str) -> str:
    """Format output for the given step.

    Uses callable dispatch: static steps lookup (title, instructions) from
    STATIC_STEPS dict; dynamic steps call formatter functions from DYNAMIC_STEPS.
    """
    if step in STATIC_STEPS:
        title, instructions = STATIC_STEPS[step]
    elif step in DYNAMIC_STEPS:
        formatter = DYNAMIC_STEPS[step]
        title, instructions = formatter(decision)
    else:
        return f"ERROR: Invalid step {step}"

    next_cmd = build_next_command(step)
    return format_step(instructions, next_cmd or "", title=f"DECISION CRITIC - {title}")


# ============================================================================
# ENTRY POINT
# ============================================================================


def main():
    """Entry point for decision-critic workflow."""
    parser = argparse.ArgumentParser(
        description="Decision Critic - Structured criticism workflow",
        epilog="Phases: decompose (1-2) -> verify (3-4) -> challenge (5-6) -> synthesize (7)",
    )
    parser.add_argument("--step", type=int, required=True)
    parser.add_argument("--decision", type=str, help="Decision to critique (step 1)")

    args = parser.parse_args()

    if args.step < 1 or args.step > 7:
        sys.exit("ERROR: --step must be 1-7")
    if args.step == 1 and not args.decision:
        sys.exit("ERROR: --decision required for step 1")

    print(format_output(args.step, args.decision or ""))


if __name__ == "__main__":
    main()
