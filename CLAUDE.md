# CLAUDE.md

DocMind — Full-Scenario Intelligent Document Processing Assistant.

## Stack

- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2 (async), Celery 5, Redis, MinIO
- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS 4, React Router 7, TanStack Query 5
- **AI:** DeepSeek API (v1 endpoint)
- **Infra:** Docker Compose (PostgreSQL 16, Redis 7, MinIO)

## Quick Start

```bash
# Dev fallback mode (zero external deps needed — SQLite + local FS)
cp .env.example .env
# Edit .env: set USE_DEV_FALLBACK=true
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
cd frontend && npm run dev
```

## Project Structure

```
src/
  api/v1/       FastAPI routes (auth, documents, users, versions, processing, collaboration, admin, oauth, github)
  api/ws/        WebSocket handlers (collaboration)
  services/      Business logic (auth, document, ai, collaboration, oauth, github, user, version, parsing)
  models/        SQLAlchemy ORM models
  schemas/       Pydantic request/response schemas
  ai/            AI pipeline (DeepSeek client, chunker, cleaner, prompts, strategies/)
  workers/       Celery tasks (ai, document, export)
  core/          Infrastructure (cache, celery, events, security, storage, encryption)
  utils/         Utilities (file_utils, rate_limit, text_utils)
frontend/
  src/pages/     Route-level pages
  src/components/  Reusable components (ui/, layout/, github/, common/)
  src/lib/       API client, i18n, utils
  src/types/     TypeScript interfaces
  src/locales/   en.json, zh.json
```

## Conventions

- All API responses use `APIResponse[T]` envelope
- Services take `(db: AsyncSession, cache: CacheManager)` in constructor
- Auth: JWT (HS256) with Argon2 password hashing, Bearer token
- Dev fallback (`USE_DEV_FALLBACK=true`): SQLite + local FS + no Redis
- Python 120-char line length (ruff)
- Frontend: no external UI library, all components hand-built with Tailwind v4

## Testing

```bash
pytest tests/ -v
pytest tests/ -v --cov=src --cov-report=term
```

## Linting

```bash
ruff check src/ tests/
ruff format --check src/ tests/
mypy src/
```
