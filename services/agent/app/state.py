"""Typed state schema that flows through the LangGraph.

This is the single mutable object that every node reads from and writes to.
"""
from __future__ import annotations

from typing import Annotated, Literal, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


Severity = Literal["low", "medium", "high", "emergency"]


class ToolInvocation(TypedDict):
    """A record of a tool the agent decided to call, kept for the reasoning trace."""
    name: str
    args: dict
    result_summary: str


class AgentState(TypedDict):
    """The Sage agent's working memory across one consultation turn.

    Using ``Annotated[..., add_messages]`` makes LangGraph append new messages
    rather than overwriting — the standard chat-pattern reducer.
    """
    # The conversation so far (user + assistant + tool messages).
    messages: Annotated[list[BaseMessage], add_messages]
    # Stable identity of the current user (Clerk userId) — used for memory tools.
    user_id: str
    # Free-text the user supplied this turn (symptoms, image caption, etc.).
    user_input: str
    # Optional base64 image attached this turn (for vision tool).
    image_base64: str | None
    # Where the router decided this turn should go.
    intent: Literal["triage", "emergency", "vision", "general", "unknown"]
    # Running list of tool calls + terse result summaries — powers "explainable AI".
    tool_trace: list[ToolInvocation]
    # Final severity verdict (filled by the synthesizer).
    severity: Severity
    # Whether an emergency/red-flag condition was detected.
    is_emergency: bool
    # The final natural-language answer streamed back to the user.
    final_answer: str
    # Number of tool-call loops executed (guard against infinite loops).
    loop_count: int


def initial_state(user_id: str, user_input: str, image_base64: str | None = None) -> AgentState:
    return AgentState(
        messages=[],
        user_id=user_id,
        user_input=user_input,
        image_base64=image_base64,
        intent="unknown",
        tool_trace=[],
        severity="low",
        is_emergency=False,
        final_answer="",
        loop_count=0,
    )
