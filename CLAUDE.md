# CLAUDE.md

DocMind — Full-Scenario Intelligent Document Processing Assistant.

## Stack

- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2 (async), Celery 5, Redis, MinIO
- **Frontend:** Angular 19, TypeScript 5.7, Angular Material, Tailwind CSS, RxJS 7.8
- **AI:** DeepSeek API (v1 endpoint)
- **Infra:** Docker Compose (MySQL 8.4, Redis 7, MinIO)

## Quick Start

**Windows 一键启动：** 双击 `start.bat`（自动打开浏览器）

```bash
# 或手动启动 — Dev fallback mode (zero external deps needed)
cp .env.example .env          # 首次：编辑 .env 设置 USE_DEV_FALLBACK=true
python -m uvicorn src.main:app --host 0.0.0.0 --port 8000
cd frontend && npm start       # 前端: http://localhost:4200
```

**停止：** 双击 `stop.bat` 或关闭命令行窗口

**测试账号：** `test@docmind.com` / `test123456`

## Project Structure

```
src/
  api/v1/       FastAPI routes (auth, documents, users, versions, processing, collaboration, admin, oauth, github)
  api/ws/        WebSocket handlers (collaboration)
  services/      Business logic (auth, document, ai, collaboration, oauth, github, user, version, parsing)
  models/        SQLAlchemy ORM models (MySQL CHAR(36) UUID)
  schemas/       Pydantic request/response schemas
  ai/            AI pipeline (DeepSeek client, chunker, cleaner, prompts, strategies/)
  workers/       Celery tasks (ai, document, export)
  core/          Infrastructure (cache, celery, events, security, storage, encryption)
  utils/         Utilities (file_utils, rate_limit, text_utils)
frontend/
  src/app/pages/          Route-level pages (standalone, lazy-loaded)
  src/app/shared/components/  Reusable components (navbar, layout, file-icon, etc.)
  src/app/core/           Auth (interceptor, guard, service), HTTP, i18n
  src/app/viewers/        Document viewers (PDF, PPTX, Image, Text)
  src/app/shared/models/  TypeScript interfaces
  src/assets/locales/     en.json, zh.json
```

## Conventions

- All API responses use `APIResponse[T]` envelope
- Services take `(db: AsyncSession, cache: CacheManager)` in constructor
- Auth: JWT (HS256) with Argon2 password hashing, Bearer token
- Dev fallback (`USE_DEV_FALLBACK=true`): SQLite + local FS + no Redis
- Python 120-char line length (ruff)
- Frontend: Angular 19 standalone components, Angular Material + Tailwind CSS

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
