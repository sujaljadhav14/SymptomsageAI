"""Triage tool — produces a structured ClinicalReport via the LLM.

This is the LLM-powered version of what ``server/index.js`` → ``/api/chat/summarize``
does, but exposed as a callable tool so the agent decides *when* to summarise.
"""
from __future__ import annotations

import json
import re

from langchain_core.tools import tool
from pydantic import BaseModel, Field

from ..llm import get_llm
from ..prompts import TRIAGE_REPORT_PROMPT


class ClinicalReport(BaseModel):
    """Structured triage report — mirrors the frontend ``ClinicalReport`` type."""
    summary: str = Field(description="2-sentence overview of symptoms and severity.")
    precautions: list[str] = Field(default_factory=list)
    severity: str = Field(description="One of: low, medium, high, emergency.")
    recommended_tests: list[str] = Field(default_factory=list)
    differentiation: str = Field(description="What makes this case notable.")


def _extract_json(text: str) -> dict:
    """Pull the first JSON object out of an LLM response (handles ```json fences)."""
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    raw = fence.group(1) if fence else text
    # Grab from first { to last }
    start, end = raw.find("{"), raw.rfind("}")
    if start == -1 or end == -1:
        return {}
    return json.loads(raw[start : end + 1])


@tool
def generate_triage_report(symptom_text: str, conversation_context: str = "") -> dict:
    """Analyse reported symptoms and produce a structured clinical triage report.

    Use this after the agent has gathered enough information from the user.
    Returns a JSON object with summary, precautions, severity, recommended_tests,
    and differentiation. Call this once per consultation, not repeatedly.

    Args:
        symptom_text: The user's reported symptoms, in their own words.
        conversation_context: Optional earlier exchanges for continuity.
    """
    llm = get_llm(temperature=0.2)
    prompt = TRIAGE_REPORT_PROMPT.format(
        symptoms=symptom_text, context=conversation_context or "(none)"
    )
    resp = llm.invoke(prompt)
    text = resp.content if hasattr(resp, "content") else str(resp)

    try:
        data = _extract_json(text)
        # Validate shape
        report = ClinicalReport(
            summary=data.get("summary", text[:200]),
            precautions=data.get("precautions", []),
            severity=str(data.get("severity", "low")).lower(),
            recommended_tests=data.get("recommendedTests", data.get("recommended_tests", [])),
            differentiation=data.get("differentiation", ""),
        )
        return report.model_dump()
    except Exception as exc:
        # Degrade gracefully — never crash a health query on parse failure.
        return {
            "summary": text[:300],
            "precautions": ["Consult a healthcare professional for an accurate assessment."],
            "severity": "low",
            "recommended_tests": [],
            "differentiation": f"(LLM output could not be parsed: {exc})",
        }
