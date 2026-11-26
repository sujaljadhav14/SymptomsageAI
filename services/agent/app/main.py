"""FastAPI entry point for the SymptomSage multi-agent service.

Endpoints:
    GET  /api/agent/health               — health check
    POST /api/agent/chat                 — one turn, JSON in / JSON out
    POST /api/agent/chat/stream          — one turn, SSE token/tool events
    POST /api/agent/chat/resume          — resume after a follow-up interrupt
    GET  /api/agent/session/{id}/history — replay full session history

Multi-turn memory:
    Pass the same ``session_id`` across requests. The MemorySaver checkpointer
    keyed by thread_id keeps conversation history between calls.

Run locally:
    uv run uvicorn app.main:app --reload --port 8000
"""
from __future__ import annotations

import json
import uuid
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .config import settings
from .graph import sage_graph

app = FastAPI(title="SymptomSage Agent", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / response models ─────────────────────────────────────────────────

class ChatRequest(BaseModel):
    user_id: str = Field(default="anonymous", description="Clerk userId")
    session_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Stable per-conversation id. Reuse it across turns for memory.",
    )
    message: str = Field(..., description="The user's message / symptom description")
    image_base64: str | None = Field(default=None, description="Optional base64 image")


class ChatResponse(BaseModel):
    answer: str
    session_id: str
    messages: list[dict[str, Any]] = Field(default_factory=list)


class ResumeRequest(BaseModel):
    session_id: str = Field(..., description="The session that was interrupted")
    answer: str = Field(..., description="The user's answer to the follow-up question")


# ── Helpers ───────────────────────────────────────────────────────────────────

# recursion_limit is raised because the full supervisor+specialist+tools loop
# can legitimately take 15-25 steps per turn:
#   supervisor route → handoff → pre_model_hook (2 msgs) → LLM plans
#   → tool call → tool result → LLM plans again → … → transfer back
#   → supervisor wraps up
_RECURSION_LIMIT = 60


def _config(session_id: str) -> dict:
    """Build the LangGraph config that pins a session to one thread."""
    return {
        "configurable": {"thread_id": session_id},
        "recursion_limit": _RECURSION_LIMIT,
    }


def _message_to_dict(m: Any) -> dict[str, Any]:
    """Flatten a LangChain message into a JSON-serialisable dict."""
    return {
        "role": getattr(m, "type", "unknown"),
        "content": getattr(m, "content", ""),
        "name": getattr(m, "name", None),
    }


def _extract_answer(messages: list) -> str:
    """Walk backwards through the message list to find the last non-empty
    AI response that was written by a specialist or the supervisor.

    We skip:
    - Messages with no content (tool-call-only messages)
    - System directive injections (start with "SYSTEM DIRECTIVE:")
    - Messages whose content is just a transfer phrase
    """
    skip_phrases = {
        "transferring back",
        "transfer back",
        "successfully transferred",
        "system directive",
    }
    for m in reversed(messages):
        msg_type = getattr(m, "type", "")
        if msg_type not in ("ai", "assistant"):
            continue
        content = (getattr(m, "content", "") or "").strip()
        if not content:
            continue
        low = content.lower()
        if any(phrase in low for phrase in skip_phrases):
            continue
        return content
    return ""


def _sse(event: str, data: Any) -> dict:
    """Format an SSE event payload."""
    return {"event": event, "data": json.dumps(data, default=str)}


def _build_input(req: ChatRequest) -> dict:
    """Build the graph input dict, including optional image data."""
    from langchain_core.messages import HumanMessage

    if req.image_base64:
        # Multimodal message — pass image alongside text
        content = [
            {"type": "text", "text": req.message},
            {
                "type": "image_url",
                "image_url": {
                    "url": (
                        req.image_base64
                        if req.image_base64.startswith("data:")
                        else f"data:image/jpeg;base64,{req.image_base64}"
                    )
                },
            },
        ]
        return {"messages": [HumanMessage(content=content)]}

    return {"messages": [HumanMessage(content=req.message)]}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/api/agent/health")
async def health():
    return {"status": "ok", "service": "symptomsage-agent", "version": "0.2.0"}


@app.post("/api/agent/chat")
async def chat(req: ChatRequest):
    """Run one turn through the multi-agent supervisor (multi-turn aware)."""
    from fastapi.responses import JSONResponse

    config = _config(req.session_id)
    inputs = _build_input(req)

    try:
        result = await sage_graph.ainvoke(inputs, config=config)
    except Exception as exc:
        return JSONResponse(
            status_code=502,
            content={
                "answer": f"Agent error: {exc}",
                "session_id": req.session_id,
                "messages": [],
                "error": str(exc),
            },
        )

    all_messages = result.get("messages", [])
    msgs = [_message_to_dict(m) for m in all_messages]
    answer = _extract_answer(all_messages)

    return {"answer": answer, "session_id": req.session_id, "messages": msgs}


@app.post("/api/agent/chat/stream")
async def chat_stream(req: ChatRequest):
    """Stream one turn as SSE events.

    Emits:
      - ``token``     : incremental LLM text (for live chat rendering)
      - ``tool_start``: when a tool begins running  {tool, args}
      - ``tool_end``  : when a tool finishes         {tool, result}
      - ``node``      : when a graph node completes  {node}
      - ``followup``  : agent asked a clarifying question (HITL interrupt)
      - ``done``      : final event {session_id, answer, messages}
      - ``error``     : on failure  {message}
    """
    from sse_starlette.sse import EventSourceResponse

    config = _config(req.session_id)
    inputs = _build_input(req)

    async def event_generator():
        collected_messages: list = []
        try:
            async for mode, chunk in sage_graph.astream(
                inputs,
                config=config,
                stream_mode=["messages", "updates"],
            ):
                if mode == "messages":
                    # chunk = (AIMessageChunk, metadata)
                    msg_chunk, meta = chunk
                    content = getattr(msg_chunk, "content", "")
                    if content and isinstance(content, str):
                        node = (
                            meta.get("langgraph_node", "agent")
                            if isinstance(meta, dict)
                            else "agent"
                        )
                        # Skip system directive injections from the pre_model_hook
                        if not content.startswith("SYSTEM DIRECTIVE:"):
                            yield _sse("token", {"text": content, "node": node})

                elif mode == "updates":
                    # chunk = {node_name: {fields...}}
                    for node_name, node_output in chunk.items():
                        tool_events = _extract_tool_events(node_name, node_output)
                        for te in tool_events:
                            yield _sse(te["event"], te["data"])

                        # Collect messages for the final done event
                        for m in (node_output or {}).get("messages", []):
                            collected_messages.append(m)

                        yield _sse("node", {"node": node_name})

            answer = _extract_answer(collected_messages)
            msgs = [_message_to_dict(m) for m in collected_messages]
            yield _sse("done", {
                "status": "complete",
                "session_id": req.session_id,
                "answer": answer,
                "messages": msgs,
            })

        except Exception as exc:
            # Check if this is a HITL interrupt (ask_followup tool fired)
            exc_str = str(exc)
            if "interrupt" in exc_str.lower() or "GraphInterrupt" in type(exc).__name__:
                # Extract the question from the interrupt value if possible
                question = exc_str
                try:
                    import json as _json
                    # LangGraph encodes interrupt as {"type":"followup","question":"..."}
                    data = getattr(exc, "value", None) or {}
                    if isinstance(data, (list, tuple)) and data:
                        data = data[0]
                    if isinstance(data, dict):
                        question = data.get("question", exc_str)
                except Exception:
                    pass
                yield _sse("followup", {
                    "question": question,
                    "session_id": req.session_id,
                })
            else:
                yield _sse("error", {"message": exc_str})

    return EventSourceResponse(event_generator())


@app.post("/api/agent/chat/resume")
async def chat_resume(req: ResumeRequest):
    """Resume a conversation that paused on a follow-up question (HITL).

    Used after the agent called ``ask_followup`` (an interrupt). The user's
    answer is fed back via ``Command(resume=...)`` and the graph continues.
    """
    from fastapi.responses import JSONResponse
    from langgraph.types import Command

    config = _config(req.session_id)
    try:
        result = await sage_graph.ainvoke(Command(resume=req.answer), config=config)
    except Exception as exc:
        return JSONResponse(
            status_code=502,
            content={
                "answer": f"Resume error: {exc}",
                "session_id": req.session_id,
                "messages": [],
                "error": str(exc),
            },
        )

    all_messages = result.get("messages", [])
    msgs = [_message_to_dict(m) for m in all_messages]
    answer = _extract_answer(all_messages)

    return {"answer": answer, "session_id": req.session_id, "messages": msgs}


@app.get("/api/agent/session/{session_id}/history")
async def get_history(session_id: str):
    """Return the full message history for a session (for UI replay)."""
    config = _config(session_id)
    state = await sage_graph.aget_state(config)
    msgs = [_message_to_dict(m) for m in (state.values.get("messages") or [])]
    return {"session_id": session_id, "messages": msgs, "next": state.next}


# ── Streaming helpers ─────────────────────────────────────────────────────────

def _extract_tool_events(node_name: str, node_output: dict) -> list[dict]:
    """Pull per-tool start/end events out of a node's update payload.

    LangGraph's ToolNode emits ToolMessages into ``messages``; the agent node
    emits AIMessages with ``tool_calls``. We synthesise tool_start/tool_end
    SSE events from these so the UI shows live tool progress.
    """
    events: list[dict] = []
    for m in (node_output or {}).get("messages", []):
        mtype = getattr(m, "type", "")
        # Agent requesting a tool call
        if mtype == "ai":
            for tc in getattr(m, "tool_calls", []) or []:
                # Don't surface the forced red-flag check as a visible tool event
                if tc.get("id") == "forced-redflag-check":
                    continue
                events.append({
                    "event": "tool_start",
                    "data": {
                        "tool": tc.get("name"),
                        "args": tc.get("args", {}),
                        "node": node_name,
                    },
                })
        # ToolNode emitting a result
        elif mtype == "tool":
            name = getattr(m, "name", None) or getattr(m, "tool_name", "tool")
            if getattr(m, "tool_call_id", "") == "forced-redflag-check":
                continue
            content = getattr(m, "content", "")
            events.append({
                "event": "tool_end",
                "data": {
                    "tool": name,
                    "result": content[:400] if isinstance(content, str) else str(content)[:400],
                    "node": node_name,
                },
            })
    return events
