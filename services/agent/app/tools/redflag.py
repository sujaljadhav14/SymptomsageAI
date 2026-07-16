"""Red-flag (emergency) detection tool.

This is the FIRST thing the agent checks on any triage turn. Mirrors the logic in
``utils/assessmentEngine.ts`` → ``checkRedFlags`` but as a self-contained tool so
the agent can call it independently.
"""
from __future__ import annotations

from langchain_core.tools import tool

# Mirror of data/redflags.json keywords. Kept inline so the agent service is
# standalone and does not depend on the TS data files at runtime.
RED_FLAG_KEYWORDS: dict[str, list[str]] = {
    "chest_pain": ["chest pain", "pain in chest", "chest pressure", "chest tightness", "crushing chest"],
    "difficulty_breathing": ["can't breathe", "cant breathe", "unable to breathe", "shortness of breath", "gasping", "choking"],
    "severe_bleeding": ["severe bleeding", "uncontrolled bleeding", "bleeding heavily", "bleeding won't stop"],
    "loss_of_consciousness": ["fainted", "passed out", "unconscious", "blackout", "loss of consciousness"],
    "stroke_signs": ["face drooping", "arm weakness", "slurred speech", "can't speak", "one side weak", "stroke"],
    "seizure": ["seizure", "convulsion", "fitting", "convulsing"],
    "severe_allergic": ["anaphylaxis", "throat closing", "swollen throat", "severe allergic reaction"],
    "suicidal": ["suicidal", "kill myself", "end my life", "want to die"],
    "severe_burn": ["severe burn", "large burn", "electrical burn"],
    "overdose": ["overdose", "took too many pills", "poisoning"],
}

EMERGENCY_INSTRUCTIONS = [
    "Call emergency services (911 / 112 / 108) immediately.",
    "Do not drive yourself — have someone take you or call an ambulance.",
    "Stay on the line with emergency services and follow their instructions.",
    "If the person becomes unresponsive, begin CPR if trained to do so.",
]


@tool
def check_red_flags(symptom_text: str) -> dict:
    """Check free-text symptoms for emergency red-flag conditions.

    Call this FIRST on any triage request. Returns whether an emergency was
    detected and which flags matched. If is_emergency is true, the agent must
    surface emergency instructions and nearby hospitals immediately — do NOT
    continue normal triage.

    Args:
        symptom_text: The user's raw symptom description in plain English.
    """
    lowered = symptom_text.lower()
    matched: list[str] = []
    for flag, keywords in RED_FLAG_KEYWORDS.items():
        if any(kw in lowered for kw in keywords):
            matched.append(flag.replace("_", " "))

    return {
        "is_emergency": len(matched) > 0,
        "matched_flags": matched,
        "instructions": EMERGENCY_INSTRUCTIONS if matched else [],
    }
