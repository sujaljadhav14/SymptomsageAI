"""Deterministic pre-model hooks for the specialist agents.

These run BEFORE the LLM thinks, guaranteeing critical safety tools fire
regardless of whether the model chooses to call them. This makes the emergency
red-flag check bulletproof — it's not dependent on the model calling it.

Multi-turn safety: we only inject the red-flag check once per *new* human
message. We detect "already checked this turn" by looking at whether a
check_red_flags ToolMessage appears AFTER the last HumanMessage in the history,
not just anywhere in the full history.
"""
from __future__ import annotations

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from .tools.redflag import check_red_flags


def _latest_user_text(messages: list) -> str:
    """Extract the most recent human message text."""
    for msg in reversed(messages):
        if isinstance(msg, HumanMessage) or getattr(msg, "type", "") == "human":
            return getattr(msg, "content", "") or ""
    return ""


def _already_checked_this_turn(messages: list) -> bool:
    """Return True if check_red_flags was already called AFTER the latest
    HumanMessage in the message list (i.e. it happened in this turn, not a
    prior one). This prevents double-injection on multi-turn conversations.
    """
    # Walk backwards from the end. Stop as soon as we hit a HumanMessage.
    for msg in reversed(messages):
        msg_type = getattr(msg, "type", "")
        if msg_type == "human" or isinstance(msg, HumanMessage):
            # We've reached the turn boundary — red-flag not found in this turn.
            return False
        if (
            msg_type == "tool"
            and getattr(msg, "name", "") == "check_red_flags"
        ):
            return True
    return False


def red_flag_pre_hook(state: dict):
    """Force check_red_flags to run before the specialist LLM thinks.

    This guarantees the red-flag safety check ALWAYS happens, no matter what
    the model does. If an emergency is detected, we also inject an explicit
    directive so the model leads with it.

    The hook is idempotent per turn: it won't double-inject on multi-turn
    conversations where check_red_flags was already called for this message.
    """
    messages = state.get("messages", [])

    # Skip if we already ran check_red_flags for the current turn.
    if _already_checked_this_turn(messages):
        return None

    text = _latest_user_text(messages)
    if not text.strip():
        return None

    # Invoke the deterministic tool directly (NOT via the LLM).
    result = check_red_flags.invoke({"symptom_text": text})

    # Build a synthetic message pair the LLM will see:
    #   AIMessage(tool_calls=[check_red_flags(...)])  → ToolMessage(result)
    # This makes it look to the model like IT called the tool, so it naturally
    # builds on the result instead of re-deriving an answer.
    ai_msg = AIMessage(
        content="",
        tool_calls=[{
            "name": "check_red_flags",
            "args": {"symptom_text": text[:500]},
            "id": "forced-redflag-check",
        }],
    )
    tool_msg = ToolMessage(
        content=str(result),
        tool_call_id="forced-redflag-check",
        name="check_red_flags",
    )

    # If it's an emergency, prepend an explicit directive so the model leads
    # with the emergency instructions rather than a generic response.
    extra: list = []
    if result.get("is_emergency"):
        flags = ", ".join(result.get("matched_flags", []))
        extra = [AIMessage(
            content=(
                f"SYSTEM DIRECTIVE: check_red_flags detected an EMERGENCY ({flags}). "
                "You MUST start your response with 🚨 and immediately instruct the "
                "user to call 112 (national emergency) or 108 (ambulance). Include all emergency instructions. "
                "Then proceed with STEP 2 (find_nearby_facilities) before transferring back."
            )
        )]

    return {"messages": [ai_msg, tool_msg, *extra]}
