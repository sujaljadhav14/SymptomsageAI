"""LLM factory — picks Gemini or Ollama based on settings, with graceful fallback."""
from __future__ import annotations

from langchain_core.language_models.chat_models import BaseChatModel

from .config import settings


def get_llm(temperature: float = 0.3) -> BaseChatModel:
    """Return the configured chat model.

    Provider chosen via ``LLM_PROVIDER``. If Gemini is selected but no API key
    is present, we fall back to Ollama so local/offline dev always works.
    """
    provider = settings.llm_provider.lower()

    if provider == "gemini" and settings.gemini_api_key:
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI

            return ChatGoogleGenerativeAI(
                model=settings.gemini_model,
                temperature=temperature,
                google_api_key=settings.gemini_api_key,
            )
        except Exception as exc:  # pragma: no cover - config-dependent
            print(f"[llm] Gemini init failed ({exc}); falling back to Ollama")

    # Ollama (local) — last-resort and explicit choice
    try:
        from langchain_ollama import ChatOllama

        return ChatOllama(
            base_url=settings.ollama_base_url,
            model=settings.ollama_model,
            temperature=temperature,
        )
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(
            "No LLM available: set GEMINI_API_KEY, or run Ollama locally "
            f"(OLLAMA_BASE_URL={settings.ollama_base_url}). Last error: {exc}"
        ) from exc
