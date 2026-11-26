"""Tests for the multi-agent (supervisor + specialists) architecture.

The red-flag tool tests are fully deterministic (no LLM). The graph-level tests
verify structure and wiring without requiring a live LLM — they're fast and
run in CI. Full end-to-end (with Gemini/Ollama) is verified manually via the
health + chat endpoints (see services/agent/README.md).
"""
import pytest

from app.graph import build_graph, build_default_graph, sage_graph
from app.state import AgentState, ToolInvocation
from app.tools.redflag import check_red_flags
from app.tools import (
    ALL_TOOLS,
    EMERGENCY_TOOLS,
    TRIAGE_TOOLS,
    VISION_TOOLS,
    GENERAL_TOOLS,
    ask_followup,
)


# ── Red-flag tool (deterministic, no LLM) ────────────────────────────────────

@pytest.mark.parametrize("text", [
    "I have severe chest pain and my arm is numb",
    "I can't breathe properly",
    "I think I'm having a stroke, my face is drooping",
    "I want to end my life",
])
def test_red_flag_tool_detects_emergencies(text):
    result = check_red_flags.invoke({"symptom_text": text})
    assert result["is_emergency"] is True
    assert len(result["matched_flags"]) > 0
    assert len(result["instructions"]) > 0


@pytest.mark.parametrize("text", [
    "I have a mild headache",
    "I feel a bit tired lately",
    "What does this app do?",
])
def test_red_flag_tool_clears_non_emergencies(text):
    result = check_red_flags.invoke({"symptom_text": text})
    assert result["is_emergency"] is False
    assert result["matched_flags"] == []


# ── Tool set organization (specialist assignments) ───────────────────────────

def test_emergency_agent_has_critical_tools():
    names = {t.name for t in EMERGENCY_TOOLS}
    assert "check_red_flags" in names
    assert "find_nearby_facilities" in names


def test_triage_agent_has_full_pipeline():
    names = {t.name for t in TRIAGE_TOOLS}
    # Must include the follow-up tool (enables clarifying questions)
    assert "ask_followup" in names
    assert "generate_triage_report" in names
    assert "recall_patient_history" in names
    assert "save_session_summary" in names


def test_vision_agent_has_image_tool():
    names = {t.name for t in VISION_TOOLS}
    assert "analyze_medical_image" in names


def test_general_agent_has_no_tools():
    assert GENERAL_TOOLS == []


def test_all_tools_superset_of_specialists():
    all_names = {t.name for t in ALL_TOOLS}
    for subset in (EMERGENCY_TOOLS, TRIAGE_TOOLS, VISION_TOOLS):
        assert {t.name for t in subset}.issubset(all_names)


# ── Follow-up tool wiring ────────────────────────────────────────────────────

def test_ask_followup_is_registered():
    assert ask_followup.name == "ask_followup"
    assert "Ask" in ask_followup.description


# ── Graph structure ──────────────────────────────────────────────────────────

def test_default_graph_compiles_with_checkpointer():
    """The module-level sage_graph must be ready to serve multi-turn requests."""
    assert sage_graph is not None


def test_graph_contains_all_specialists():
    """All four specialist agents must be wired into the supervisor graph."""
    g = sage_graph.get_graph()
    node_ids = set(g.nodes.keys())
    assert "sage_supervisor" in node_ids
    assert "emergency_agent" in node_ids
    assert "triage_agent" in node_ids
    assert "vision_agent" in node_ids
    assert "general_agent" in node_ids


def test_build_graph_accepts_custom_checkpointer():
    """Callers must be able to supply their own checkpointer (e.g. Redis)."""
    from langgraph.checkpoint.memory import MemorySaver

    custom = build_graph(checkpointer=MemorySaver())
    assert custom is not None


# ── State schema ─────────────────────────────────────────────────────────────

def test_state_has_messages_field():
    """AgentState must expose `messages` (the multi-turn accumulator)."""
    assert "messages" in AgentState.__annotations__
    assert "user_id" in AgentState.__annotations__
    assert "session_id" in AgentState.__annotations__


def test_tool_invocation_schema():
    ti: ToolInvocation = {"name": "check_red_flags", "args": {}, "result_summary": "ok"}
    assert ti["name"] == "check_red_flags"
