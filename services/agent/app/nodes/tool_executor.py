"""Tool-executor node — runs the tools the agent decided to call.

This is the workhorse of the graph. For an emergency path it short-circuits to
red-flag + places tools. For triage it orchestrates recall → report → save.
For vision it runs the image tool. Results are folded into ``tool_trace`` so the
synthesizer (and the user) can see the reasoning chain.
"""
from __future__ import annotations

from typing import Any

from langchain_core.messages import AIMessage

from ..state import AgentState
from ..tools import (
    check_red_flags,
    recall_patient_history,
    save_session_summary,
    generate_triage_report,
    analyze_medical_image,
    find_nearby_facilities,
)

MAX_LOOPS = 4


def _summarise(result: Any, limit: int = 240) -> str:
    """Coerce a tool result into a short string for the trace."""
    if isinstance(result, dict):
        # Keep only the most informative keys
        keep = {k: v for k, v in result.items() if k in
                ("is_emergency", "matched_flags", "summary", "severity", "assessment",
                 "count", "facilities", "history", "error", "sent")}
        s = str(keep)
    else:
        s = str(result)
    return s if len(s) <= limit else s[:limit] + "…"


async def tool_executor(state: AgentState) -> dict:
    """Dispatch the right tools based on intent + state. Enriches tool_trace."""
    intent = state.get("intent", "general")
    user_input = state.get("user_input", "")
    user_id = state.get("user_id", "anonymous")
    image = state.get("image_base64")
    loop_count = state.get("loop_count", 0) + 1

    new_trace = list(state.get("tool_trace", []))
    new_messages: list = []
    severity = state.get("severity", "low")
    is_emergency = state.get("is_emergency", False)

    # ---- EMERGENCY path: red flags first, then facilities ----
    rf = await check_red_flags.ainvoke({"symptom_text": user_input})
    new_trace.append({"name": "check_red_flags", "args": {"symptom_text": user_input[:120]},
                      "result_summary": _summarise(rf)})
    if rf.get("is_emergency"):
        is_emergency = True
        severity = "emergency"
        new_messages.append(AIMessage(content=(
            "🚨 EMERGENCY detected. Matched: " + ", ".join(rf.get("matched_flags", []))
        )))
        return {"tool_trace": new_trace, "is_emergency": is_emergency,
                "severity": severity, "loop_count": loop_count,
                "messages": new_messages}

    # ---- VISION path ----
    if intent == "vision" and image:
        vis = await analyze_medical_image.ainvoke({"image_base64": image, "note": user_input})
        new_trace.append({"name": "analyze_medical_image",
                          "args": {"note": user_input[:120]}, "result_summary": _summarise(vis)})

    # ---- TRIAGE path: recall → report → save ----
    if intent in ("triage", "vision", "general") and loop_count == 1:
        hist = await recall_patient_history.ainvoke({"user_id": user_id, "limit": 5})
        new_trace.append({"name": "recall_patient_history", "args": {"user_id": user_id},
                          "result_summary": _summarise(hist)})

    report = None
    if intent in ("triage", "vision"):
        ctx = ""  # could expand with recalled history text
        report = await generate_triage_report.ainvoke(
            {"symptom_text": user_input, "conversation_context": ctx}
        )
        new_trace.append({"name": "generate_triage_report", "args": {"symptom_text": user_input[:120]},
                          "result_summary": _summarise(report)})
        sev = str(report.get("severity", "low")).lower()
        if sev in ("low", "medium", "high", "emergency"):
            severity = sev
        if severity == "emergency":
            is_emergency = True

    # Persist summary if we produced a report (best-effort)
    if report is not None:
        saved = await save_session_summary.ainvoke({
            "user_id": user_id,
            "summary": report.get("summary", user_input[:200]),
            "severity": severity,
        })
        new_trace.append({"name": "save_session_summary",
                          "args": {"user_id": user_id, "severity": severity},
                          "result_summary": _summarise(saved)})

    return {"tool_trace": new_trace, "severity": severity, "is_emergency": is_emergency,
            "loop_count": loop_count, "messages": new_messages}


def should_continue(state: AgentState) -> str:
    """Conditional edge: stop after one executor pass (single-pass design)."""
    # Single-pass keeps the hackathon build predictable; MAX_LOOPS is a safety cap.
    if state.get("loop_count", 0) >= MAX_LOOPS:
        return "synthesize"
    return "synthesize"
