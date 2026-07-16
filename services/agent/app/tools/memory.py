"""Memory tools — recall + save patient history in Supabase.

Wraps the same tables (``chats`` / ``summaries``) that the frontend uses via
``utils/storage.ts``, so the agent shares one source of truth per user.
"""
from __future__ import annotations

from langchain_core.tools import tool

from ..config import settings


def _client():
    """Lazily build a Supabase client. Raises a clear error if unconfigured."""
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise RuntimeError("Supabase not configured (SUPABASE_URL / SUPABASE_ANON_KEY).")
    from supabase import create_client  # type: ignore

    return create_client(settings.supabase_url, settings.supabase_anon_key)


@tool
def recall_patient_history(user_id: str, limit: int = 5) -> dict:
    """Fetch the user's recent clinical report summaries for personalisation.

    Use this at the START of a consultation so the agent can reference prior
    conditions, allergies, or ongoing issues. Returns up to ``limit`` summaries,
    newest first.

    Args:
        user_id: The Clerk userId of the current user.
        limit: How many past summaries to fetch (default 5).
    """
    try:
        sb = _client()
        rows = (
            sb.table("summaries")
            .select("summary, severity, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
            .data
        )
        return {"history": rows or [], "count": len(rows or [])}
    except Exception as exc:
        # Memory is best-effort — never block a triage on it.
        return {"history": [], "count": 0, "error": str(exc)}


@tool
def save_session_summary(user_id: str, summary: str, severity: str) -> dict:
    """Persist a new session summary so future consultations stay personalised.

    Call this at the END of a consultation, after the report is produced.

    Args:
        user_id: The Clerk userId of the current user.
        summary: A concise summary of this session's findings.
        severity: One of low / medium / high / emergency.
    """
    try:
        sb = _client()
        row = (
            sb.table("summaries")
            .insert({"user_id": user_id, "summary": summary, "severity": severity})
            .execute()
            .data
        )
        return {"saved": True, "row": row}
    except Exception as exc:
        return {"saved": False, "error": str(exc)}
