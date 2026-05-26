"""File content embedding for workflow prompts.

format_file_content() uses 4-backtick fences, which safely wraps content
containing triple-backtick code blocks (common in markdown reference files).
"""


def format_file_content(path: str, content: str) -> str:
    """Embed file content in a prompt with path label and fenced content."""
    return f"File: {path}\n````\n{content}\n````"
