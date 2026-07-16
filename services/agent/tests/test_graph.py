"""End-to-end tests for the Sage agent graph.

These run WITHOUT network (Ollama fallback / mocked LLM paths) so they're fast
and deterministic. The emergency regression test is the most important — it must
NEVER silently downgrade a red-flag case.
"""
import pytest

from app.state import initial_state
from app.graph import build_graph
from app.tools.redflag import check_red_flags


@pytest.fixture(scope="module")
def graph():
    return build_graph()


# ---------------------------------------------------------------------------
# Red-flag tool (deterministic, no LLM)
# ---------------------------------------------------------------------------
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


# ---------------------------------------------------------------------------
# Router — keyword fallback path (no LLM needed)
# ---------------------------------------------------------------------------
def test_router_keyword_fallback_emergency():
    from app.nodes.router import _keyword_fallback
    assert _keyword_fallback("chest pain and can't breathe") == "emergency"
    assert _keyword_fallback("look at this rash photo") == "vision"
    assert _keyword_fallback("I have a fever and cough") == "triage"
    assert _keyword_fallback("hello there") == "general"


# ---------------------------------------------------------------------------
# Graph smoke test — emergency path must set is_emergency + severity=emergency
# This is the critical safety regression.
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_graph_emergency_path_sets_flags(graph):
    state = initial_state(user_id="test-user", user_input="severe chest pain, can't breathe")
    result = await graph.ainvoke(state)
    assert result["is_emergency"] is True
    assert result["severity"] == "emergency"
    # Emergency synthesizer path emits a deterministic prefix
    assert "🚨" in result["final_answer"]
    # And the tool trace must show the red-flag check ran
    tool_names = [t["name"] for t in result["tool_trace"]]
    assert "check_red_flags" in tool_names
