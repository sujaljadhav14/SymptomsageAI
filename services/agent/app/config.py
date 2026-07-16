"""Configuration loaded from environment variables."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from dotenv import load_dotenv

# Load from services/agent/.env (or root .env.local fallback)
_HERE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_HERE, "..", ".env"))
load_dotenv(os.path.join(_HERE, "..", "..", "..", ".env.local"))


def _get(key: str, default: str = "") -> str:
    return os.getenv(key, default)


@dataclass(frozen=True)
class Settings:
    # LLM
    gemini_api_key: str = field(default_factory=lambda: _get("GEMINI_API_KEY"))
    gemini_model: str = field(default_factory=lambda: _get("GEMINI_MODEL", "gemini-2.0-flash-exp"))
    ollama_base_url: str = field(default_factory=lambda: _get("OLLAMA_BASE_URL", "http://localhost:11434"))
    ollama_model: str = field(default_factory=lambda: _get("OLLAMA_MODEL", "llama3.1"))
    llm_provider: str = field(default_factory=lambda: _get("LLM_PROVIDER", "gemini"))

    # External services
    node_backend_url: str = field(default_factory=lambda: _get("NODE_BACKEND_URL", "http://localhost:3001"))
    supabase_url: str = field(default_factory=lambda: _get("SUPABASE_URL"))
    supabase_anon_key: str = field(default_factory=lambda: _get("SUPABASE_ANON_KEY"))
    google_maps_api_key: str = field(default_factory=lambda: _get("GOOGLE_MAPS_API_KEY"))

    # Server
    host: str = field(default_factory=lambda: _get("AGENT_HOST", "0.0.0.0"))
    port: int = field(default_factory=lambda: int(_get("AGENT_PORT", "8000")))
    cors_origins: list[str] = field(
        default_factory=lambda: [
            o.strip() for o in _get("AGENT_CORS_ORIGINS", "http://localhost:5173").split(",")
            if o.strip()
        ]
    )


settings = Settings()
