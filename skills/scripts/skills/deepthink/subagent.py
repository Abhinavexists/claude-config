#!/usr/bin/env python3
"""
DeepThink Sub-Agent Workflow - Perspective-specific analysis.

Eight-step workflow:
  1. Context Grounding   - Re-read context, step-back to principles
  2. Analogical Generation - Self-generate relevant examples
  3. Planning            - Explicit analysis plan before execution
  4. Analysis            - Execute plan with evidence grounding
  5. Self-Verification   - Factored verification of claims
  6. Perspective Contrast - Steel-man opposing view
  7. Failure Modes       - Actionable failure analysis
  8. Output Synthesis    - Structured output for parent aggregation
"""

import argparse
import sys

from skills.lib.workflow.prompts import format_step


# ============================================================================
# CONFIGURATION
# ============================================================================

MODULE_PATH = "skills.deepthink.subagent"
TOTAL_STEPS = 8


# ============================================================================
# MESSAGE TEMPLATES
# ============================================================================

# --- STEP 1: CONTEXT_GROUNDING -----------------------------------------------

CONTEXT_GROUNDING_INSTRUCTIONS = (
    "Before beginning analysis, ground yourself in the shared context.\n"
    "\n"
    "PART A - RE-READ SHARED CONTEXT:\n"
    "  Read the shared context again. Restate each element:\n"
    "  - CLARIFIED QUESTION: [restate in your own words]\n"
    "  - DOMAIN: [from shared context]\n"
    "  - FIRST PRINCIPLES: [list from shared context]\n"
    "  - QUESTION TYPE: [from shared context]\n"
    "  - EVALUATION CRITERIA: [from shared context]\n"
    "  - KEY ANALOGIES: [from shared context]\n"
    "\n"
    "PART B - STEP BACK (perspective-specific):\n"
    "  From YOUR assigned perspective, which 2-3 first principles\n"
    "  are MOST relevant? Why do these matter more than others\n"
    "  for your analytical lens?\n"
    "\n"
    "PART C - TASK UNDERSTANDING:\n"
    "  Review your task definition:\n"
    "  - Name: [from dispatch]\n"
    "  - Strategy: [from dispatch]\n"
    "  - Task: [from dispatch]\n"
    "  - Sub-Questions: [from dispatch]\n"
    "  - Unique Value: [from dispatch]\n"
    "\n"
    "  Restate your task in your own words.\n"
    "  What unique contribution will you provide that others won't?\n"
    "\n"
    "OUTPUT FORMAT:\n"
    "```\n"
    "RESTATED CONTEXT:\n"
    "- Question: [your restatement]\n"
    "- Domain: [domain]\n"
    "- Key principles for MY perspective: [2-3 most relevant]\n"
    "\n"
    "MY TASK:\n"
    "[restatement in own words]\n"
    "\n"
    "MY UNIQUE CONTRIBUTION:\n"
    "[what I will provide that others likely won't]\n"
    "```"
)

# --- STEP 2: ANALOGICAL_GENERATION -------------------------------------------

ANALOGICAL_GENERATION_INSTRUCTIONS = (
    "Before analyzing, recall relevant precedents from YOUR analytical lens.\n"
    "\n"
    "Generate 2-3 examples of similar problems approached from your\n"
    "perspective. These should be:\n"
    "  - Relevant to the current question\n"
    "  - Distinct from each other\n"
    "  - Drawn from your assigned domain/perspective\n"
    "\n"
    "For each example:\n"
    "  - Describe the problem briefly\n"
    "  - Explain how it was approached from your perspective\n"
    "  - State what insight transfers to the current question\n"
    "\n"
    "If the shared context already contains highly relevant analogies,\n"
    "you may reference those and add 1-2 perspective-specific ones.\n"
    "\n"
    "OUTPUT FORMAT:\n"
    "```\n"
    "SELF-GENERATED ANALOGIES:\n"
    "\n"
    "1. [Problem]: [brief description]\n"
    "   Approach: [how your perspective handled it]\n"
    "   Transfer: [what applies to current question]\n"
    "\n"
    "2. [Problem]: [brief description]\n"
    "   Approach: [how addressed]\n"
    "   Transfer: [applicable insight]\n"
    "```"
)

# --- STEP 3: PLANNING --------------------------------------------------------

PLANNING_INSTRUCTIONS = (
    "Before analyzing, devise a plan for approaching this from your\n"
    "perspective.\n"
    "\n"
    "Let's first understand the problem and devise a plan to solve it.\n"
    "Then we will carry out the plan step by step.\n"
    "\n"
    "PART A - APPROACH OUTLINE:\n"
    "  What specific aspects will you examine?\n"
    "  In what order should they be addressed?\n"
    "  What intermediate conclusions do you need to reach?\n"
    "\n"
    "PART B - EVIDENCE SOURCES:\n"
    "  What evidence will you draw on?\n"
    "  - First principles from Step 1\n"
    "  - Analogies from Step 2\n"
    "  - Domain knowledge\n"
    "  - Assigned sub-questions\n"
    "\n"
    "PART C - SUCCESS CRITERIA:\n"
    "  What would a complete analysis from your perspective include?\n"
    "  How will you know when you've done enough?\n"
    "\n"
    "OUTPUT FORMAT:\n"
    "```\n"
    "ANALYSIS PLAN:\n"
    "1. [First aspect to examine]\n"
    "2. [Second aspect]\n"
    "3. [Third aspect]\n"
    "...\n"
    "\n"
    "EVIDENCE I WILL USE:\n"
    "- [source 1]\n"
    "- [source 2]\n"
    "\n"
    "SUCCESS CRITERIA:\n"
    "- [criterion 1]\n"
    "- [criterion 2]\n"
    "```"
)

# --- STEP 4: ANALYSIS --------------------------------------------------------

ANALYSIS_INSTRUCTIONS = (
    "Execute your analysis plan from Step 3.\n"
    "Work through each aspect step by step.\n"
    "\n"
    "EXPLORATION OPTION:\n"
    "  If your analysis requires concrete evidence not in the shared context:\n"
    "  - Use Read/Glob/Grep to examine specific files or patterns\n"
    "  - Keep exploration targeted -- only what your perspective needs\n"
    "  - Cite evidence from exploration with file:line references\n"
    "  If shared context is sufficient, proceed without exploration.\n"
    "\n"
    "REQUIREMENTS:\n"
    "  - Follow your plan systematically\n"
    "  - Ground each claim in evidence (cite source)\n"
    "  - Mark confidence on each major claim: HIGH / MEDIUM / LOW\n"
    "  - Address your assigned sub-questions explicitly\n"
    "\n"
    "CONFIDENCE MARKERS:\n"
    "  - HIGH: Strong reasoning, multiple sources, well-supported\n"
    "  - MEDIUM: Reasonable but could be contested, single source\n"
    "  - LOW: Speculative, limited evidence, tentative\n"
    "\n"
    "EVIDENCE GROUNDING:\n"
    "  For each major claim, cite source:\n"
    "  - (FP): First principle from shared context\n"
    "  - (AN): Analogy from Step 2\n"
    "  - (DK): Domain knowledge\n"
    "  - (UN): Ungrounded - flag explicitly\n"
    "\n"
    "OUTPUT FORMAT:\n"
    "```\n"
    "ANALYSIS:\n"
    "\n"
    "[Aspect 1 from plan]\n"
    "[Your reasoning] (source) [CONFIDENCE]\n"
    "\n"
    "[Aspect 2 from plan]\n"
    "[Your reasoning] (source) [CONFIDENCE]\n"
    "\n"
    "...\n"
    "\n"
    "PROPOSALS/POSITIONS:\n"
    "\n"
    "1. [Proposal] [HIGH/MEDIUM/LOW]\n"
    "   Reasoning: [why]\n"
    "   Evidence: [sources]\n"
    "\n"
    "2. [Proposal] [CONFIDENCE]\n"
    "   Reasoning: [why]\n"
    "   Evidence: [sources]\n"
    "\n"
    "SUB-QUESTION RESPONSES:\n"
    "- [Q1]: [response] [CONFIDENCE]\n"
    "- [Q2]: [response] [CONFIDENCE]\n"
    "```"
)

# --- STEP 5: SELF_VERIFICATION -----------------------------------------------

SELF_VERIFICATION_INSTRUCTIONS = (
    "Verify your analysis through independent questioning.\n"
    "\n"
    "PART A - VERIFICATION QUESTIONS:\n"
    "  Generate 3-5 questions that would test your key claims.\n"
    "\n"
    "  Use OPEN questions (What is...? Where does...? How would...?)\n"
    "  NOT yes/no questions.\n"
    "  Yes/no questions bias toward agreement regardless of correctness.\n"
    "\n"
    "  Focus on:\n"
    "  - Claims marked MEDIUM or LOW confidence\n"
    "  - Claims critical to your main conclusions\n"
    "  - Assumptions that could be wrong\n"
    "\n"
    "PART B - INDEPENDENT ANSWERS:\n"
    "  For each question, answer based ONLY on:\n"
    "  - First principles from shared context\n"
    "  - Your analogies from Step 2\n"
    "  - Domain knowledge\n"
    "\n"
    "  CRITICAL: Do NOT look at your Step 4 analysis while answering.\n"
    "  Answer based on evidence, not what your analysis claims.\n"
    "\n"
    "PART C - DISCREPANCY CHECK:\n"
    "  Compare verification answers against your Step 4 analysis.\n"
    "  Where do they differ? List each discrepancy.\n"
    "  For significant discrepancies, note how to resolve.\n"
    "\n"
    "OUTPUT FORMAT:\n"
    "```\n"
    "VERIFICATION QUESTIONS:\n"
    "1. [open question about key claim]\n"
    "2. [open question]\n"
    "3. [open question]\n"
    "\n"
    "INDEPENDENT ANSWERS (without consulting analysis):\n"
    "1. [answer]\n"
    "2. [answer]\n"
    "3. [answer]\n"
    "\n"
    "DISCREPANCIES:\n"
    "- [claim from analysis] vs [verification answer]: [resolution]\n"
    "- Or: 'No significant discrepancies found'\n"
    "\n"
    "ANALYSIS UPDATES (if any):\n"
    "- [what to revise based on verification]\n"
    "```"
)

# --- STEP 6: PERSPECTIVE_CONTRAST --------------------------------------------

PERSPECTIVE_CONTRAST_INSTRUCTIONS = (
    "Before finalizing, consider the strongest opposing perspective.\n"
    "\n"
    "PART A - OPPOSING POSITION:\n"
    "  What is the strongest argument AGAINST your main conclusions?\n"
    "  Steel-man this position - make it as compelling as possible.\n"
    "  Who would hold this view and why?\n"
    "\n"
    "PART B - CONFLICT ANALYSIS:\n"
    "  Where specifically does the opposing view conflict with yours?\n"
    "  What evidence does the opposition have that you lack?\n"
    "  What evidence do you have that they would dismiss?\n"
    "\n"
    "PART C - WHAT WOULD CHANGE YOUR MIND:\n"
    "  What specific evidence or argument would cause you to revise?\n"
    "  What assumptions are you making that could be wrong?\n"
    "\n"
    "This step strengthens your analysis by pre-emptively addressing\n"
    "the strongest counterarguments. If you cannot articulate a strong\n"
    "opposing view, your confidence should increase.\n"
    "\n"
    "OUTPUT FORMAT:\n"
    "```\n"
    "STRONGEST COUNTER-POSITION:\n"
    "[Steel-manned opposing view - make it compelling]\n"
    "\n"
    "WHO HOLDS THIS VIEW:\n"
    "[type of person/perspective that would argue this]\n"
    "\n"
    "KEY CONFLICTS:\n"
    "- My position: [X] vs Opposition: [Y]\n"
    "- My position: [A] vs Opposition: [B]\n"
    "\n"
    "WHAT WOULD CHANGE MY CONCLUSION:\n"
    "- [specific evidence that would cause revision]\n"
    "- [assumption that if wrong would change conclusion]\n"
    "```"
)

# --- STEP 7: FAILURE_MODES ---------------------------------------------------

FAILURE_MODES_INSTRUCTIONS = (
    "For each proposal from your analysis, provide actionable failure modes.\n"
    "\n"
    "Each failure mode MUST include all three elements:\n"
    "  1. ELEMENT: The specific proposal or claim\n"
    "  2. PROBLEM: What could go wrong or be invalid\n"
    "  3. ACTION: What would mitigate this risk or test this assumption\n"
    "\n"
    "Feedback missing any element is too vague to be useful.\n"
    "\n"
    "GOOD: 'ELEMENT: Claim X. PROBLEM: Assumes Y which may not hold.\n"
    "       ACTION: Verify Y by checking Z.'\n"
    "BAD:  'This proposal has risks.' (no specific element/problem/action)\n"
    "\n"
    "This step is CRITICAL.\n"
    "Analysis without actionable failure modes is incomplete.\n"
    "The quality gate will filter outputs without meaningful failure modes.\n"
    "\n"
    "OUTPUT FORMAT:\n"
    "```\n"
    "FAILURE MODES:\n"
    "\n"
    "For Proposal 1 ([name]):\n"
    "- ELEMENT: [specific claim]\n"
    "  PROBLEM: [what could go wrong]\n"
    "  ACTION: [mitigation or test]\n"
    "\n"
    "- ELEMENT: [another aspect]\n"
    "  PROBLEM: [risk]\n"
    "  ACTION: [mitigation]\n"
    "\n"
    "For Proposal 2 ([name]):\n"
    "- ELEMENT: [claim]\n"
    "  PROBLEM: [risk]\n"
    "  ACTION: [mitigation]\n"
    "\n"
    "[etc.]\n"
    "```"
)

# --- STEP 8: OUTPUT_SYNTHESIS ------------------------------------------------

OUTPUT_SYNTHESIS_INSTRUCTIONS = (
    "Synthesize your analysis into structured output for aggregation.\n"
    "\n"
    "The parent workflow will extract specific sections from your output.\n"
    "Use the EXACT format below for clean parsing.\n"
    "\n"
    "OUTPUT FORMAT:\n"
    "```\n"
    "## Core Findings\n"
    "\n"
    "Confidence: [HIGH|MEDIUM|LOW]\n"
    "\n"
    "[Your main conclusions from this perspective - 2-3 sentences]\n"
    "\n"
    "## Proposals\n"
    "\n"
    "1. [Proposal] [HIGH/MEDIUM/LOW]\n"
    "   Evidence: [key supporting reasoning]\n"
    "\n"
    "2. [Proposal] [CONFIDENCE]\n"
    "   Evidence: [key supporting reasoning]\n"
    "\n"
    "## Sub-Question Responses\n"
    "\n"
    "Q: [assigned sub-question 1]\n"
    "A: [your response]\n"
    "\n"
    "Q: [assigned sub-question 2]\n"
    "A: [your response]\n"
    "\n"
    "## Evidence Chains\n"
    "\n"
    "[Key reasoning chains that led to your conclusions]\n"
    "[Include intermediate insights even if conclusions changed]\n"
    "[These are valuable for synthesis even if final conclusion differs]\n"
    "\n"
    "## Failure Modes\n"
    "\n"
    "Proposal 1:\n"
    "- ELEMENT: [x] | PROBLEM: [y] | ACTION: [z]\n"
    "\n"
    "Proposal 2:\n"
    "- ELEMENT: [x] | PROBLEM: [y] | ACTION: [z]\n"
    "\n"
    "## Perspective Gaps\n"
    "\n"
    "[What your perspective likely misses or undervalues]\n"
    "[What other sub-agents should cover]\n"
    "[Where to weight your analysis less]\n"
    "\n"
    "## Opposing View\n"
    "\n"
    "[Steel-manned counter-position from Step 6]\n"
    "[What would change your conclusion]\n"
    "```\n"
    "\n"
    "This completes your sub-agent analysis.\n"
    "Your output will be collected for aggregation and synthesis."
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
    1: ("Context Grounding", CONTEXT_GROUNDING_INSTRUCTIONS),
    2: ("Analogical Generation", ANALOGICAL_GENERATION_INSTRUCTIONS),
    3: ("Planning", PLANNING_INSTRUCTIONS),
    4: ("Analysis", ANALYSIS_INSTRUCTIONS),
    5: ("Self-Verification", SELF_VERIFICATION_INSTRUCTIONS),
    6: ("Perspective Contrast", PERSPECTIVE_CONTRAST_INSTRUCTIONS),
    7: ("Failure Modes", FAILURE_MODES_INSTRUCTIONS),
    8: ("Output Synthesis", OUTPUT_SYNTHESIS_INSTRUCTIONS),
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
    return format_step(instructions, next_cmd or "", title=f"DEEPTHINK SUB-AGENT - {title}")


# ============================================================================
# ENTRY POINT
# ============================================================================


def main():
    parser = argparse.ArgumentParser(
        description="DeepThink Sub-Agent - Perspective-specific analysis workflow",
        epilog="Steps: 1-8 (grounding -> analogies -> planning -> analysis -> "
        "verification -> contrast -> failure modes -> synthesis)",
    )
    parser.add_argument("--step", type=int, required=True)
    args = parser.parse_args()

    if args.step < 1 or args.step > TOTAL_STEPS:
        sys.exit(f"ERROR: --step must be 1-{TOTAL_STEPS}")

    print(format_output(args.step))


if __name__ == "__main__":
    main()
