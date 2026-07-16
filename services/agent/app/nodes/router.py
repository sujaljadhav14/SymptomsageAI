"""Intent router node — classifies the user's message to pick the right path."""
from __future__ import annotations

from langchain_core.messages import HumanMessage

from ..llm import get_llm
from ..prompts import INTENT_ROUTER_PROMPT
from ..state import AgentState

VALID = {"emergency", "vision", "triage", "general"}


async def intent_router(state: AgentState) -> dict:
    """Classify intent via a cheap LLM call; fall back to keyword rules on failure."""
    user_input = state.get("user_input", "").strip()
    intent = "general"

    try:
        llm = get_llm(temperature=0.0)
        resp = await llm.ainvoke([HumanMessage(content=INTENT_ROUTER_PROMPT.format(user_input=user_input))])
        text = (resp.content if hasattr(resp, "content") else str(resp)).strip().lower()
        # Take the first valid keyword the model emitted
        for word in text.split():
            if word in VALID:
                intent = word
                break
    except Exception:
        intent = _keyword_fallback(user_input)

    return {"intent": intent}


def _keyword_fallback(text: str) -> str:
    """Deterministic fallback if the LLM router fails — never block on classification."""
    lowered = text.lower()
    emergency_words = ["chest pain", "can't breathe", "unconscious", "seizure", "suicidal",
                       "overdose", "severe bleeding", "stroke", "choking"]
    if any(w in lowered for w in emergency_words):
        return "emergency"
    if any(w in lowered for w in ["image", "photo", "rash", "upload", "picture"]):
        return "vision"
    if any(w in lowered for w in ["symptom", "pain", "fever", "feel", "sick", "hurt", "nausea", "cough"]):
        return "triage"
    return "general"
