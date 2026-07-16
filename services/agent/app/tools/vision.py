"""Vision tool — analyse a medical image via Gemini Vision.

Mirrors ``server/index.js`` → ``/api/analyze-image`` but runs inline so the agent
doesn't need a round-trip to the Node backend for multimodal input.
"""
from __future__ import annotations

from langchain_core.tools import tool

from ..llm import get_llm

VISION_PROMPT = """You are a medical AI assistant. Analyse this medical image and provide:
1. A brief description of what you observe
2. Potential medical concerns or symptoms visible
3. Recommended immediate actions or precautions
4. Whether the person should seek immediate medical attention

IMPORTANT: Always include a disclaimer that this is not a professional medical
diagnosis and the user should consult a healthcare provider.

Be professional, empathetic, and clear."""


@tool
def analyze_medical_image(image_base64: str, note: str = "") -> dict:
    """Analyse an uploaded medical image (rash, wound, skin condition, eye, etc.).

    Use this when the user attaches a photo. Returns a structured visual
    assessment. The image is processed by Gemini Vision and never stored.

    Args:
        image_base64: Base64-encoded image data (with or without the data: prefix).
        note: Optional user-supplied context about the image (e.g. "rash on arm, 3 days").
    """
    if not image_base64:
        return {"error": "No image provided."}

    raw = image_base64.split("base64,")[-1] if "base64," in image_base64 else image_base64

    try:
        from langchain_core.messages import HumanMessage

        llm = get_llm(temperature=0.2)
        msg = HumanMessage(
            content=[
                {"type": "text", "text": f"{VISION_PROMPT}\n\nAdditional context: {note or '(none)'}"},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{raw}"},
                },
            ]
        )
        resp = llm.invoke([msg])
        text = resp.content if hasattr(resp, "content") else str(resp)
        return {"assessment": text}
    except Exception as exc:
        return {"error": f"Vision analysis failed: {exc}"}
