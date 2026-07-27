"""FastAPI entry point for the SymptomSage multi-agent service.

Endpoints:
    GET  /api/agent/health           — health check
    POST /api/agent/chat             — one turn, JSON in / JSON out (multi-turn via session_id)
    POST /api/agent/chat/stream      — one turn, streamed as SSE events (per-tool + per-token)
    POST /api/agent/chat/resume      — resume after a follow-up interrupt (human-in-the-loop)

Multi-turn memory:
    Pass the same ``session_id`` across requests. The MemorySaver checkpointer
    keyed by thread_id keeps the conversation history between calls.

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


# ── Request / response models ────────────────────────────────────────────────

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


# ── Helpers ──────────────────────────────────────────────────────────────────

def _config(session_id: str) -> dict:
    """Build the LangGraph config that pins a session to one thread."""
    return {"configurable": {"thread_id": session_id}}


def _message_to_dict(m: Any) -> dict[str, Any]:
    """Flatten a LangChain message into a JSON-serialisable dict."""
    return {
        "role": getattr(m, "type", "unknown"),
        "content": getattr(m, "content", ""),
        "name": getattr(m, "name", None),
    }


def _sse(event: str, data: Any) -> dict:
    """Format an SSE event payload."""
    return {"event": event, "data": json.dumps(data, default=str)}


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/api/agent/health")
async def health():
    return {"status": "ok", "service": "symptomsage-agent", "version": "0.2.0"}


@app.post("/api/agent/chat")
async def chat(req: ChatRequest):
    """Run one turn through the multi-agent supervisor (multi-turn aware)."""
    from fastapi.responses import JSONResponse
    from langchain_core.messages import HumanMessage

    config = _config(req.session_id)
    inputs = {"messages": [HumanMessage(content=req.message)]}

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

    msgs = [_message_to_dict(m) for m in result.get("messages", [])]
    answer = ""
    for m in reversed(result.get("messages", [])):
        if getattr(m, "type", "") in ("ai", "assistant") and getattr(m, "content", "").strip():
            answer = m.content
            break

    return {"answer": answer, "session_id": req.session_id, "messages": msgs}


@app.post("/api/agent/chat/stream")
async def chat_stream(req: ChatRequest):
    """Stream one turn as SSE events.

    Emits:
      - ``token``    : incremental LLM text (for live chat rendering)
      - ``tool_start``: when a tool begins running {tool, args}
      - ``tool_end``  : when a tool finishes {tool, result}
      - ``node``      : when a graph node completes {node}
      - ``done``      : final event {session_id, messages}
    """
    from sse_starlette.sse import EventSourceResponse
    from langchain_core.messages import HumanMessage

    config = _config(req.session_id)
    inputs = {"messages": [HumanMessage(content=req.message)]}

    async def event_generator():
        try:
            # Combined streaming: per-token text + per-node updates.
            async for mode, chunk in sage_graph.astream(
                inputs,
                config=config,
                stream_mode=["messages", "updates"],
            ):
                if mode == "messages":
                    # chunk is (AIMessageChunk, metadata)
                    msg_chunk, meta = chunk
                    content = getattr(msg_chunk, "content", "")
                    if content:
                        node = meta.get("langgraph_node", "agent") if isinstance(meta, dict) else "agent"
                        yield _sse("token", {"text": content, "node": node})

                elif mode == "updates":
                    # chunk is {node_name: {fields...}}
                    for node_name, node_output in chunk.items():
                        tools_used = _extract_tool_events(node_name, node_output)
                        for te in tools_used:
                            yield _sse(te["event"], te["data"])
                        yield _sse("node", {"node": node_name})

            yield _sse("done", {"status": "complete", "session_id": req.session_id})
        except Exception as exc:
            yield _sse("error", {"message": str(exc)})

    return EventSourceResponse(event_generator())


@app.post("/api/agent/chat/resume")
async def chat_resume(req: ResumeRequest):
    """Resume a conversation that paused on a follow-up question.

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

    msgs = [_message_to_dict(m) for m in result.get("messages", [])]
    answer = ""
    for m in reversed(result.get("messages", [])):
        if getattr(m, "type", "") in ("ai", "assistant") and getattr(m, "content", "").strip():
            answer = m.content
            break

    return {"answer": answer, "session_id": req.session_id, "messages": msgs}


@app.get("/api/agent/session/{session_id}/history")
async def get_history(session_id: str):
    """Return the full message history for a session (for UI replay)."""
    config = _config(session_id)
    state = await sage_graph.aget_state(config)
    msgs = [_message_to_dict(m) for m in (state.values.get("messages") or [])]
    return {"session_id": session_id, "messages": msgs, "next": state.next}


# ── Streaming helpers ────────────────────────────────────────────────────────

def _extract_tool_events(node_name: str, node_output: dict) -> list[dict]:
    """Pull per-tool start/end events out of a node's update payload.

    LangGraph's ToolNode emits ToolMessages into ``messages``; the agent node
    emits AIMessages with ``tool_calls``. We synthesise tool_start/tool_end
    SSE events from these so the UI shows live tool progress.
    """
    events: list[dict] = []
    for m in (node_output or {}).get("messages", []):
        mtype = getattr(m, "type", "")
        # Agent emitting a tool call request
        if mtype == "ai":
            for tc in getattr(m, "tool_calls", []) or []:
                events.append({
                    "event": "tool_start",
                    "data": {"tool": tc.get("name"), "args": tc.get("args", {})},
                })
        # ToolNode emitting the result
        elif mtype == "tool":
            name = getattr(m, "name", None) or getattr(m, "tool_name", "tool")
            content = getattr(m, "content", "")
            events.append({
                "event": "tool_end",
                "data": {"tool": name, "result": content[:300]},
            })
    return events
