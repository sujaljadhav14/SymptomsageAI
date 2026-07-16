"""Email tool — delegate report delivery to the existing Node backend.

Rather than reimplementing SMTP here, the agent calls the existing
``POST /api/send-report`` endpoint in ``server/index.js``. One mailer, one place.
"""
from __future__ import annotations

from langchain_core.tools import tool

from ..config import settings


@tool
def email_report(email: str, report_text: str, user_name: str = "User") -> dict:
    """Email a clinical report to the user (or their doctor).

    Delegates to the Node/Express backend which already has the SMTP
    transporter configured. Use this when the user explicitly asks to receive
    their report by email.

    Args:
        email: Recipient email address.
        report_text: The full clinical report text to send.
        user_name: Recipient display name.
    """
    try:
        import httpx

        resp = httpx.post(
            f"{settings.node_backend_url}/api/send-report",
            json={"email": email, "reportText": report_text, "userName": user_name},
            timeout=15.0,
        )
        if resp.status_code == 200:
            return {"sent": True}
        return {"sent": False, "status": resp.status_code, "detail": resp.text}
    except Exception as exc:
        return {"sent": False, "error": str(exc)}
