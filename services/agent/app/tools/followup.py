"""Follow-up question tool — lets the agent pause and ask the user for more info.

Uses LangGraph's ``interrupt()`` to pause execution mid-tool-call and return
the question to the user. The frontend then calls ``/api/agent/chat/resume``
with the user's answer to continue the graph.
"""
from __future__ import annotations

from langchain_core.tools import tool


@tool
def ask_followup(question: str) -> str:
    """Ask the user a clarifying question before proceeding with the assessment.

    Use this when you need more information to make a confident triage. The
    question will be shown to the user, and their answer will be returned as
    a string. Do NOT call this for emergencies — handle those immediately.

    Args:
        question: The specific clarifying question to ask the user.
    """
    from langgraph.types import interrupt

    # This pauses the graph. The user's answer is returned as the tool result.
    answer = interrupt({"type": "followup", "question": question})
    return str(answer) if answer else "(no answer provided)"
