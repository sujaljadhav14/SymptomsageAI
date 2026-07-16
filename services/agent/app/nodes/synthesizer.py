"""Response synthesizer — turns tool results into the final user-facing answer."""
from __future__ import annotations

import json

from langchain_core.messages import AIMessage, HumanMessage

from ..llm import get_llm
from ..prompts import SYNTHESIS_PROMPT, SYSTEM_PROMPT
from ..state import AgentState


async def response_synthesizer(state: AgentState) -> dict:
    """Compose the natural-language answer from the tool trace + state."""
    severity = state.get("severity", "low")
    is_emergency = state.get("is_emergency", False)
    tool_trace = state.get("tool_trace", [])
    user_input = state.get("user_input", "")

    # Fast path for emergencies — no LLM call needed, instructions must be immediate.
    if is_emergency:
        flags = []
        for entry in tool_trace:
            if entry.get("name") == "check_red_flags":
                flags = entry.get("result_summary", "")
        answer = (
            "🚨 This sounds like an emergency. Please take this seriously:\n\n"
            "• Call emergency services now (911 / 112 / 108).\n"
            "• Do not drive yourself — get someone to take you or call an ambulance.\n"
            "• Follow the dispatcher's instructions and stay on the line.\n\n"
            f"Matched concerns: {flags}\n\n"
            "If you share your location I can find the nearest hospital. "
            "This is not a medical diagnosis — seek immediate professional care."
        )
        return {"final_answer": answer, "messages": [AIMessage(content=answer)]}

    try:
        llm = get_llm(temperature=0.4)
        prompt = SYNTHESIS_PROMPT.format(
            severity=severity,
            is_emergency=is_emergency,
            tool_trace=json.dumps(tool_trace, default=str)[:1500],
        )
        resp = await llm.ainvoke([
            HumanMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=user_input),
            HumanMessage(content=prompt),
        ])
        text = resp.content if hasattr(resp, "content") else str(resp)
        return {"final_answer": text, "messages": [AIMessage(content=text)]}
    except Exception as exc:
        # Degrade gracefully — always return something useful.
        fallback = (
            "I reviewed your symptoms but hit a problem finalising the response. "
            f"(error: {exc})\n\nPlease consult a healthcare professional, "
            "and if you feel this is an emergency, call emergency services immediately."
        )
        return {"final_answer": fallback, "messages": [AIMessage(content=fallback)]}
