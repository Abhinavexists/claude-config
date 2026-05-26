"""CI script: validates get_convention() calls match REGISTRY.yaml"""

import ast
import sys
from pathlib import Path
from skills.lib.conventions import get_registry, validate_convention_access


def extract_convention_calls(script_path: Path) -> list[tuple[str, int]]:
    """Extract (convention_name, line_number) from get_convention() calls."""
    tree = ast.parse(script_path.read_text())
    calls = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name) and node.func.id == "get_convention":
                if node.args and isinstance(node.args[0], ast.Constant):
                    calls.append((node.args[0].value, node.lineno))
    return calls


def infer_role_from_path(script_path: Path) -> str:
    """Infer AgentRole from script location."""
    parts = script_path.parts
    if "qr" in parts:
        return "quality_reviewer"
    elif "dev" in parts:
        return "developer"
    elif "tw" in parts:
        return "technical_writer"
    elif "refactor" in parts:
        return "refactor"
    return "unknown"


def main():
    registry = get_registry()
    skills_dir = Path(__file__).parent / "skills"
    errors = []

    for script in skills_dir.rglob("*.py"):
        calls = extract_convention_calls(script)
        role = infer_role_from_path(script)

        for convention, lineno in calls:
            if not validate_convention_access(role, convention):
                errors.append(f"{script}:{lineno} - {role} accessing {convention} (not in registry)")

    if errors:
        print("Convention registry violations:")
        for e in errors:
            print(f"  {e}")
        sys.exit(1)

    print("Convention registry validation passed")


if __name__ == "__main__":
    main()
