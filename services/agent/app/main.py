"""FastAPI entry point for the SymptomSage agent service.

Endpoints:
    GET  /api/agent/health     — health check
    POST /api/agent/chat       — run one consultation turn (JSON in, JSON out)
    POST /api/agent/chat/stream — same, streamed as SSE events

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
from .state import initial_state

app = FastAPI(title="SymptomSage Agent", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    user_id: str = Field(default="anonymous", description="Clerk userId")
    message: str = Field(..., description="The user's symptom message / question")
    image_base64: str | None = Field(default=None, description="Optional base64 image")


class ChatResponse(BaseModel):
    answer: str
    severity: str
    is_emergency: bool
    intent: str
    tool_trace: list[dict[str, Any]]
    request_id: str


@app.get("/api/agent/health")
async def health():
    return {"status": "ok", "service": "symptomsage-agent"}


@app.post("/api/agent/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """Run one consultation turn through the Sage agent graph."""
    request_id = str(uuid.uuid4())
    state = initial_state(
        user_id=req.user_id,
        user_input=req.message,
        image_base64=req.image_base64,
    )
    result = await sage_graph.ainvoke(state)
    return ChatResponse(
        answer=result.get("final_answer", ""),
        severity=result.get("severity", "low"),
        is_emergency=result.get("is_emergency", False),
        intent=result.get("intent", "unknown"),
        tool_trace=result.get("tool_trace", []),
        request_id=request_id,
    )


@app.post("/api/agent/chat/stream")
async def chat_stream(req: ChatRequest):
    """Stream a consultation turn as Server-Sent Events.

    Emits one JSON event per graph node completion, then a final ``done`` event.
    Compatible with the frontend's existing EventSource-style consumption.
    """
    from sse_starlette.sse import EventSourceResponse

    state = initial_state(
        user_id=req.user_id,
        user_input=req.message,
        image_base64=req.image_base64,
    )

    async def event_generator():
        # Stream node updates as they complete.
        async for chunk in sage_graph.astream(state, stream_mode="updates"):
            for node_name, node_output in chunk.items():
                yield {
                    "event": node_name,
                    "data": json.dumps(node_output, default=str),
                }
        yield {"event": "done", "data": json.dumps({"status": "complete"})}

    return EventSourceResponse(event_generator())
