from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── Application ──
    app_env: Literal["development", "staging", "production"] = "development"
    app_debug: bool = True
    app_secret_key: SecretStr = SecretStr("change-me-to-a-random-256-bit-hex-string")
    api_v1_prefix: str = "/api/v1"
    use_dev_fallback: bool = False  # Use SQLite + local fs + in-memory cache (no external deps)

    # ── Database ──
    database_url: str = "postgresql+asyncpg://docmind:docmind@localhost:5432/docmind"
    database_url_sync: str = "postgresql://docmind:docmind@localhost:5432/docmind"
    sqlite_url: str = "sqlite+aiosqlite:///./docmind_dev.db"

    # ── Redis ──
    redis_cache_url: str = "redis://localhost:6379/0"
    redis_broker_url: str = "redis://localhost:6379/1"
    redis_result_backend: str = "redis://localhost:6379/2"

    # ── DeepSeek API ──
    deepseek_api_key: SecretStr = SecretStr("sk-your-deepseek-api-key")
    deepseek_base_url: str = "https://api.deepseek.com/v1"
    deepseek_default_model: str = "deepseek-chat"
    deepseek_reasoner_model: str = "deepseek-reasoner"
    deepseek_rate_limit_rpm: int = 60
    deepseek_rate_limit_burst: int = 10
    deepseek_request_timeout: float = 120.0
    deepseek_max_retries: int = 3
    deepseek_circuit_breaker_threshold: int = 10
    deepseek_circuit_breaker_window: int = 60
    deepseek_circuit_breaker_recovery: int = 30
    deepseek_daily_token_budget: int = 10_000_000

    # ── Storage ──
    storage_endpoint: str = "localhost:9000"
    storage_access_key: str = "minioadmin"
    storage_secret_key: SecretStr = SecretStr("minioadmin")
    storage_bucket: str = "docmind"
    storage_secure: bool = False

    # ── Celery ──
    celery_worker_concurrency: int = 4
    celery_task_soft_time_limit: int = 600
    celery_task_time_limit: int = 900

    # ── JWT ──
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 30
    jwt_algorithm: str = "HS256"

    # ── Document Processing ──
    doc_max_sync_chars: int = 20_000
    doc_chunk_size: int = 6_000
    doc_chunk_overlap: int = 300
    doc_max_upload_size_mb: int = 500

    # ── Cache ──
    l1_cache_max_entries: int = 1000
    l1_cache_max_size_mb: int = 256

    # ── GitHub OAuth ──
    github_oauth_client_id: str = ""
    github_oauth_client_secret: SecretStr = SecretStr("")
    github_oauth_redirect_uri: str = "http://localhost:5173/auth/github/callback"
    github_oauth_token_encryption_key: SecretStr = SecretStr("change-me-fernet-key-32-bytes-b64")

    # ── Collaboration ──
    collab_snapshot_edits: int = 50
    collab_snapshot_idle_seconds: int = 5

    @property
    def deepseek_api_key_value(self) -> str:
        return self.deepseek_api_key.get_secret_value()

    @property
    def storage_secret_key_value(self) -> str:
        return self.storage_secret_key.get_secret_value()

    @property
    def app_secret_key_value(self) -> str:
        return self.app_secret_key.get_secret_value()

    @property
    def github_oauth_client_secret_value(self) -> str:
        return self.github_oauth_client_secret.get_secret_value()

    @property
    def github_oauth_token_encryption_key_value(self) -> str:
        return self.github_oauth_token_encryption_key.get_secret_value()


settings = Settings()
