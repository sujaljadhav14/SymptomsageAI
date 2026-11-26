"""Typed state schema for the Sage agent (multi-turn, multi-agent).

The ``messages`` field uses ``add_messages`` as a reducer so the LangGraph
checkpointer can append across turns without overwriting history.
"""
from __future__ import annotations

from typing import Annotated, Any, Literal, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


Severity = Literal["low", "medium", "high", "emergency"]


class ToolInvocation(TypedDict):
    """A record of a tool the agent called, kept for the explainability trace."""
    name: str
    args: dict[str, Any]
    result_summary: str


class AgentState(TypedDict):
    """State that flows through the supervisor and all specialist sub-agents.

    ``messages`` is the only field that accumulates across turns (via the
    ``add_messages`` reducer). Everything else is snapshot-per-invoke.
    """
    messages: Annotated[list[BaseMessage], add_messages]
    user_id: str
    session_id: str
    tool_trace: list[ToolInvocation]
    severity: Severity
    is_emergency: bool
