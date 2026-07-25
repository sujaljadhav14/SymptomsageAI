"""All agent tools, organized by specialist agent."""
from __future__ import annotations

from .redflag import check_red_flags
from .triage import generate_triage_report
from .memory import recall_patient_history, save_session_summary
from .vision import analyze_medical_image
from .places import find_nearby_facilities
from .email import email_report
from .followup import ask_followup

# ── Tool sets per specialist agent ────────────────────────────────────────────

# Emergency: red flags + hospital finder (fast, no triage report)
EMERGENCY_TOOLS = [check_red_flags, find_nearby_facilities, email_report]

# Triage: full assessment pipeline + follow-up questions
TRIAGE_TOOLS = [
    check_red_flags,
    recall_patient_history,
    ask_followup,
    generate_triage_report,
    save_session_summary,
    email_report,
]

# Vision: image analysis + optional triage report
VISION_TOOLS = [check_red_flags, analyze_medical_image, generate_triage_report, email_report]

# General: no tools needed, pure LLM chat
GENERAL_TOOLS: list = []

# Everything
ALL_TOOLS = [
    check_red_flags,
    generate_triage_report,
    recall_patient_history,
    save_session_summary,
    analyze_medical_image,
    find_nearby_facilities,
    email_report,
    ask_followup,
]

__all__ = [
    "ALL_TOOLS",
    "EMERGENCY_TOOLS",
    "TRIAGE_TOOLS",
    "VISION_TOOLS",
    "GENERAL_TOOLS",
    "check_red_flags",
    "generate_triage_report",
    "recall_patient_history",
    "save_session_summary",
    "analyze_medical_image",
    "find_nearby_facilities",
    "email_report",
    "ask_followup",
]
