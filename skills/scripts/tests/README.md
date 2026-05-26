# Workflow Test Framework

## Overview

Data-driven test framework that exhaustively tests all steps of all workflow-based skills with all valid parameter combinations. Uses typed domain abstractions (BoundedInt, ChoiceSet, Constant) to represent parameter spaces, extracts schemas from Workflow ASTs, generates Cartesian products of valid inputs, and integrates with pytest via parametrize.

## Architecture

```
Workflow AST          Domain Types           Test Generation
     |                     |                       |
     v                     v                       v
+----------+        +-------------+         +--------------+
| Workflow |  --->  | BoundedInt  |  --->   | generate_    |
| _params  |        | ChoiceSet   |         | test_inputs  |
| _step_   |        | Constant    |         +--------------+
|  order   |        +-------------+                |
+----------+                                       v
                                           +-------------+
                                           | pytest      |
                                           | parametrize |
                                           +-------------+
```

## Data Flow

1. Import skills -> Workflow objects registered
2. extract_schema(workflow) -> {step: {param: Domain}}
3. generate_inputs(workflow) -> Iterator[dict] (Cartesian product)
4. pytest.parametrize -> test cases with IDs
5. run_skill_invocation(workflow, params) -> subprocess exit code

## Why This Structure

Domain types are separate from generation logic because:

- Domains are reusable (could drive fuzzing, documentation generation, etc.)
- Generation logic depends on workflow structure, not domain semantics
- Test file depends on both but adds pytest-specific concerns

This separation enables:

- Testing the test framework itself (domain types can be unit tested)
- Reusing domain abstractions for other purposes
- Clear boundaries between concerns (FP composability)

## Design Decisions

### Exhaustive vs Sampling

Chose exhaustive enumeration because domain sizes are small. Current workflows generate ~300-500 test cases total (5 iterations x 5 confidences x 2 modes per iterating step). Exhaustive testing is tractable and catches all corner cases. Sampling would miss edge combinations where specific parameter values interact to cause failures.

Cost: More test cases to run
Gain: Complete coverage of valid input space

### Hardcoded vs Introspected Mode-Gating

Chose hardcoding for mode-gated steps (currently only deepthink has quick mode that skips steps 6-11). Introspecting handler bytecode to detect mode-gating would add complexity not justified for a single workflow.

Cost: Manual update if more workflows add mode-gating
Gain: Clear, maintainable code

### Domain Types in types.py

Domain types (BoundedInt, ChoiceSet, Constant) live in workflow/types.py alongside Arg, QRStatus, Confidence. This maintains cohesion - domain types are type system extensions. Alternative would create import fragmentation.

### Iteration Bound Hardcoded to 5

BoundedInt(1, 5) for iteration domain matches QR_ITERATION_LIMIT constant. Hardcoded to avoid import coupling to config constants. Current value (5) is standard across all iterating workflows.

## Invariants

- Each test case has unique ID (workflow-step-params combination)
- Conditional params only apply to applicable steps (iteration only at iterating steps)
- Mode-gated steps skipped when mode value gates them out
- step param always present (1 to workflow.total_steps)
- Workflow.\_step_order provides authoritative step index mapping: len(\_step_order) == workflow.total_steps and indices correspond to CLI --step values

## Constraints

- Python 3.10+ (dataclass, match statements)
- pytest available
- run_skill_invocation() in conftest.py handles subprocess execution
- MAX_ITERATIONS = 5 standard across workflows
- Excluded skills: leon-writing-style, prompt-engineer-improver (not in git)
