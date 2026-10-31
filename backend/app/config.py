"""Environment settings. Keys live only in backend/.env."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash"
    # Tried in order when the main model is out of quota, overloaded or retired. Each has its own free-tier quota.
    gemini_fallback_models: str = "gemini-3.5-flash-lite,gemini-flash-lite-latest,gemini-2.5-flash"
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    cache_ttl_seconds: int = 600
    cache_dir: Path = BACKEND_DIR / ".cache"
    fetch_timeout: float = 12.0
    user_agent: str = "BlindspotBot/1.0 (student hackathon research tool; reads public pages once, respects robots.txt; contact: see project README)"

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def gemini_models(self) -> list[str]:
        chain = [self.gemini_model, *[m.strip() for m in self.gemini_fallback_models.split(",") if m.strip()]]
        return list(dict.fromkeys(chain))

    @property
    def llm_provider(self) -> str:
        if self.gemini_api_key:
            return "gemini"
        if self.groq_api_key:
            return "groq"
        return "none"


@lru_cache
def get_settings() -> Settings:
    return Settings()
