"""All agent tools, gathered in one place for the graph to bind."""
from __future__ import annotations

from .redflag import check_red_flags
from .triage import generate_triage_report
from .memory import recall_patient_history, save_session_summary
from .vision import analyze_medical_image
from .places import find_nearby_facilities
from .email import email_report

# Ordered list — the LLM tool-calling layer iterates these.
ALL_TOOLS = [
    check_red_flags,
    generate_triage_report,
    recall_patient_history,
    save_session_summary,
    analyze_medical_image,
    find_nearby_facilities,
    email_report,
]

__all__ = [
    "ALL_TOOLS",
    "check_red_flags",
    "generate_triage_report",
    "recall_patient_history",
    "save_session_summary",
    "analyze_medical_image",
    "find_nearby_facilities",
    "email_report",
]
