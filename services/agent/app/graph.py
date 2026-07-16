"""The Sage agent LangGraph definition.

Flow:
    START → intent_router → tool_executor → response_synthesizer → END

Single-pass design (router → execute → synthesise) keeps the hackathon build
predictable and debuggable. The ``should_continue`` conditional edge is the seam
where a multi-step ReAct loop could be slotted in later.
"""
from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from .nodes import intent_router, response_synthesizer, should_continue, tool_executor
from .state import AgentState


def build_graph():
    """Compile and return the Sage agent graph."""
    graph = StateGraph(AgentState)

    graph.add_node("intent_router", intent_router)
    graph.add_node("tool_executor", tool_executor)
    graph.add_node("response_synthesizer", response_synthesizer)

    graph.add_edge(START, "intent_router")
    graph.add_edge("intent_router", "tool_executor")
    graph.add_conditional_edges(
        "tool_executor",
        should_continue,
        {"synthesize": "response_synthesizer"},
    )
    graph.add_edge("response_synthesizer", END)

    return graph.compile()


# Compiled once at import so the FastAPI app can reuse it.
sage_graph = build_graph()
