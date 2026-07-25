"""The Sage multi-agent graph — supervisor + 4 specialist sub-agents.

Architecture:
    user → supervisor → ┌─ emergency_agent  (red flags + hospitals)
                        ├─ triage_agent     (full assessment + follow-ups)
                        ├─ vision_agent     (image analysis)
                        └─ general_agent    (FAQ / help)

Each specialist is a `create_react_agent` with its OWN tool set and a REAL
ReAct loop — the LLM dynamically decides which tools to call. The supervisor
treats each specialist as a "handoff" tool.

Multi-turn memory is enabled by the MemorySaver checkpointer (keyed by
`thread_id` = session_id at runtime).
"""
from __future__ import annotations

from langchain_core.language_models.chat_models import BaseChatModel
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import create_react_agent
from langgraph_supervisor import create_supervisor

from .llm import get_llm
from .prompts import (
    EMERGENCY_PROMPT,
    FOLLOWUP_HINTS,
    GENERAL_PROMPT,
    SUPERVISOR_PROMPT,
    TRIAGE_PROMPT,
    VISION_PROMPT,
)
from .state import AgentState
from .tools import (
    EMERGENCY_TOOLS,
    GENERAL_TOOLS,
    TRIAGE_TOOLS,
    VISION_TOOLS,
)


def _build_specialists(llm: BaseChatModel) -> dict:
    """Build the four specialist agents. Each gets its own tools + prompt."""
    triage_prompt = TRIAGE_PROMPT + "\n\n" + FOLLOWUP_HINTS

    return {
        "emergency": create_react_agent(
            llm,
            EMERGENCY_TOOLS,
            name="emergency_agent",
            prompt=EMERGENCY_PROMPT,
        ),
        "triage": create_react_agent(
            llm,
            TRIAGE_TOOLS,
            name="triage_agent",
            prompt=triage_prompt,
        ),
        "vision": create_react_agent(
            llm,
            VISION_TOOLS,
            name="vision_agent",
            prompt=VISION_PROMPT,
        ),
        "general": create_react_agent(
            llm,
            GENERAL_TOOLS,
            name="general_agent",
            prompt=GENERAL_PROMPT,
        ),
    }


def build_graph(checkpointer=None):
    """Build and compile the supervisor + specialists graph.

    Args:
        checkpointer: A LangGraph checkpointer (e.g. MemorySaver). Required for
            multi-turn conversations and human-in-the-loop interrupts. If None,
            no persistence (single-shot only).
    """
    llm = get_llm(temperature=0.3)
    specialists = _build_specialists(llm)

    supervisor = create_supervisor(
        model=llm,
        agents=list(specialists.values()),
        prompt=SUPERVISOR_PROMPT,
        # full_history = the final state contains the whole conversation,
        # which is what we want for multi-turn + traceability.
        output_mode="full_history",
        supervisor_name="sage_supervisor",
    )

    return supervisor.compile(checkpointer=checkpointer)


def build_default_graph():
    """Build the graph with an in-memory checkpointer (dev default).

    Note: a single module-level MemorySaver is used. For production you'd want
    Redis/Postgres so memory survives restarts. Callers pass their own
    ``thread_id`` via config so each session is isolated.
    """
    return build_graph(checkpointer=MemorySaver())


# Compiled at import for the FastAPI app. The checkpointer is shared; isolation
# is by thread_id (session_id) in the request config.
sage_graph = build_default_graph()
