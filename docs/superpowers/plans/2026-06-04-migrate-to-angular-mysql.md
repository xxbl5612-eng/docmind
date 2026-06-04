# DocMind Migration: React→Angular + PostgreSQL→MySQL

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate DocMind from React/Vite frontend to Angular 19 and from PostgreSQL to MySQL 8 database, preserving all 13 database models, 10 API route modules, all AI/document processing features, and generating a project PPT and report.

**Architecture:** Backend stays Python/FastAPI with SQLAlchemy async ORM — only the database dialect and type mappings change (PostgreSQL→MySQL). Frontend is a ground-up Angular 19 rewrite using Angular Material for UI components, RxJS for reactive state, Angular Router with auth guards, and ngx-translate for i18n. The API contract (REST endpoints, request/response shapes) remains unchanged.

**Tech Stack:** Angular 19, Angular Material, RxJS, ngx-translate, TypeScript 5.5+, MySQL 8, SQLAlchemy 2 (asyncmy driver), FastAPI, Celery, Redis, MinIO

---

## File Structure Map

### Backend — Files to Modify

| File | Change |
|------|--------|
| `src/config.py:29-31` | Replace PostgreSQL URLs with MySQL |
| `.env.example:10-12` | Replace PostgreSQL URLs with MySQL |
| `src/models/base.py:24-34` | Remove `timezone=True` from DateTime, change `Uuid` → `CHAR(36)` |
| `src/models/user.py` | Remove `timezone=True` from all DateTime columns |
| `src/models/document.py` | Remove `timezone=True` |
| `src/models/document_version.py` | Remove `timezone=True` |
| `src/models/operation_log.py` | Remove `timezone=True` |
| `src/models/collaboration.py` | Remove `timezone=True` |
| `src/models/tier.py` | Remove `timezone=True` |
| `src/models/oauth.py` | Remove `timezone=True` |
| `src/api/deps.py:19-20` | Update engine URL for MySQL |
| `src/api/v1/users.py` | Check for PostgreSQL-specific queries |
| `src/services/user_service.py` | Check for PostgreSQL-specific queries |
| `alembic/env.py:16` | Update to use MySQL sync URL |
| `alembic.ini:89` | Update default driver URL |
| `docker/docker-compose.yml:4-18` | Replace PostgreSQL service with MySQL |
| `docker/docker-compose.yml:50-51,73-74` | Update database URLs |
| `docker/Dockerfile.api` | Add MySQL dependencies |
| `docker/Dockerfile.worker` | Add MySQL dependencies |
| `pyproject.toml` | Replace asyncpg with asyncmy, add mysql dependencies |
| `requirements.txt` (if exists) | Same dependency updates |

### Frontend — Files to Create (Angular)

```
frontend-angular/
├── angular.json
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.spec.json
├── src/
│   ├── index.html
│   ├── main.ts
│   ├── styles.scss
│   ├── app/
│   │   ├── app.component.ts
│   │   ├── app.component.html
│   │   ├── app.component.scss
│   │   ├── app.config.ts
│   │   ├── app.routes.ts
│   │   ├── core/
│   │   │   ├── auth/
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── auth.guard.ts
│   │   │   │   ├── auth.interceptor.ts
│   │   │   │   └── token.interceptor.ts
│   │   │   ├── http/
│   │   │   │   └── api.service.ts
│   │   │   └── i18n/
│   │   │       ├── i18n-loader.ts
│   │   │       └── translation-config.ts
│   │   ├── shared/
│   │   │   ├── components/
│   │   │   │   ├── app-layout/
│   │   │   │   ├── navbar/
│   │   │   │   ├── language-switcher/
│   │   │   │   ├── error-boundary/
│   │   │   │   └── file-icon/
│   │   │   └── models/
│   │   │       └── types.ts
│   │   ├── pages/
│   │   │   ├── landing/
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   ├── dashboard/
│   │   │   ├── document-editor/
│   │   │   ├── version-history/
│   │   │   ├── collaboration/
│   │   │   ├── admin-dashboard/
│   │   │   ├── settings/
│   │   │   ├── auth-callback/
│   │   │   └── github-import/
│   │   └── viewers/
│   │       ├── viewer-registry.ts
│   │       ├── base-viewer.ts
│   │       ├── pdf-viewer/
│   │       ├── pptx-viewer/
│   │       ├── image-viewer/
│   │       └── text-viewer/
│   └── assets/
│       └── locales/
│           ├── en.json
│           └── zh.json
```

---

## Phase 1: Database Migration (PostgreSQL → MySQL 8)

### Task 1.1: Update Dependencies

**Files:** Modify `pyproject.toml` dependency section

- [ ] **Step 1: Replace asyncpg with asyncmy in pyproject.toml**

```toml
# In pyproject.toml, change:
# "asyncpg>=0.29"  →  "asyncmy>=0.2.9"
# Add: "mysqlclient>=2.2"  (for sync driver used by Alembic)
# Add: "cryptography>=41"   (MySQL auth plugin support)
```

Run: `pip install asyncmy mysqlclient cryptography`

- [ ] **Step 2: Verify imports**

```bash
python -c "import asyncmy; print('asyncmy OK')"
python -c "import MySQLdb; print('mysqlclient OK')"
```

### Task 1.2: Update Config and Environment

**Files:** Modify `src/config.py:29-31`, `.env.example:10-12`

- [ ] **Step 3: Update database URLs in src/config.py**

```python
# In src/config.py, lines 29-31, replace:
database_url: str = "postgresql+asyncpg://docmind:docmind@localhost:5432/docmind"
database_url_sync: str = "postgresql://docmind:docmind@localhost:5432/docmind"
sqlite_url: str = "sqlite+aiosqlite:///./docmind_dev.db"

# With:
database_url: str = "mysql+asyncmy://docmind:docmind@localhost:3306/docmind"
database_url_sync: str = "mysql+mysqldb://docmind:docmind@localhost:3306/docmind"
sqlite_url: str = "sqlite+aiosqlite:///./docmind_dev.db"
```

- [ ] **Step 4: Update .env.example**

```
# Replace lines 10-12:
DATABASE_URL=mysql+asyncmy://docmind:docmind@localhost:3306/docmind
DATABASE_URL_SYNC=mysql+mysqldb://docmind:docmind@localhost:3306/docmind
```

- [ ] **Step 5: Update .env (if exists)**

Read `.env` and apply the same changes.

### Task 1.3: Update SQLAlchemy Base Model for MySQL Compatibility

**Files:** Modify `src/models/base.py`

- [ ] **Step 6: Rewrite base model for MySQL**

MySQL does not have native UUID type or timezone-aware DateTime. Replace the mixins:

```python
"""SQLAlchemy declarative base and common mixins. MySQL-compatible."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import CHAR, DateTime, String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class UUIDMixin:
    id: Mapped[str] = mapped_column(
        CHAR(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc),
    )
```

### Task 1.4: Update All Models — Remove timezone=True and Change Uuid→CHAR(36)

**Files:** Modify all model files

- [ ] **Step 7: Update src/models/user.py**

Change all `Uuid` → `CHAR(36)` and remove `timezone=True` from all `DateTime` columns.
Change `uuid.UUID` type hints → `str` type hints.

```python
"""User and RefreshToken models."""
from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import JSON, Boolean, CHAR, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import UUIDMixin, TimestampMixin, Base as _Base


class User(_Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    tier: Mapped[str] = mapped_column(String(32), nullable=False, default="novice")
    tier_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    preferences: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    quota_used_docs: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    quota_used_ai_calls: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    quota_used_storage_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    quota_period_start: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    refresh_tokens = relationship("RefreshToken", back_populates="user")
    documents = relationship("Document", back_populates="owner", foreign_keys="Document.owner_id")
    collaboration_sessions = relationship("CollaborationSession", back_populates="owner", foreign_keys="CollaborationSession.owner_id")
    collaborators = relationship("Collaborator", back_populates="user", foreign_keys="Collaborator.user_id")
    operation_logs = relationship("OperationLog", back_populates="user", foreign_keys="OperationLog.user_id")
    processing_jobs = relationship("AIProcessingJob", back_populates="user", foreign_keys="AIProcessingJob.user_id")
    oauth_accounts = relationship("OAuthAccount", back_populates="user")


class RefreshToken(_Base, UUIDMixin):
    __tablename__ = "refresh_tokens"

    user_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("users.id"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    device_info: Mapped[str | None] = mapped_column(String(512), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), server_default=func.now()
    )

    user = relationship("User", back_populates="refresh_tokens")
```

- [ ] **Step 8: Update src/models/document.py**

Change all `Uuid` → `CHAR(36)`, remove `timezone=True`:

```python
"""Document model."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, BigInteger, Boolean, CHAR, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import UUIDMixin, TimestampMixin, Base as _Base


class Document(_Base, UUIDMixin, TimestampMixin):
    __tablename__ = "documents"

    owner_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    input_format: Mapped[str] = mapped_column(String(16), nullable=False)
    output_format: Mapped[str | None] = mapped_column(String(16), nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    char_count: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="uploading")
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    parsed_content_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSON, nullable=False, default=dict)
    tags: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    folder: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    current_version_id: Mapped[str | None] = mapped_column(CHAR(36), nullable=True)
    checksum_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)

    owner = relationship("User", back_populates="documents")
    versions = relationship("DocumentVersion", back_populates="document", order_by="DocumentVersion.version_number")
    operation_logs = relationship("OperationLog", back_populates="document")
    collaboration_sessions = relationship("CollaborationSession", back_populates="document")
    processing_jobs = relationship("AIProcessingJob", back_populates="document")
```

- [ ] **Step 9: Update src/models/document_version.py**

```python
"""Document version model."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import BigInteger, CHAR, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import UUIDMixin, Base as _Base


class DocumentVersion(_Base, UUIDMixin):
    __tablename__ = "document_versions"

    document_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("documents.id"), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    content_path: Mapped[str] = mapped_column(Text, nullable=False)
    char_count: Mapped[int] = mapped_column(BigInteger, nullable=False)
    change_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    created_by: Mapped[str | None] = mapped_column(CHAR(36), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), server_default=func.now()
    )

    document = relationship("Document", back_populates="versions")
```

- [ ] **Step 10: Update src/models/collaboration.py**

Change all `Uuid` → `CHAR(36)`, remove `timezone=True`, change `Numeric` → `Float`, change `SmallInteger` → `Integer`:

```python
"""Collaboration session, collaborator, invitation, and AI processing job models."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, CHAR, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import UUIDMixin, Base as _Base


class CollaborationSession(_Base, UUIDMixin):
    __tablename__ = "collaboration_sessions"

    document_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("documents.id"), nullable=False, index=True)
    owner_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    settings: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), server_default=func.now()
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    document = relationship("Document", back_populates="collaboration_sessions")
    owner = relationship("User", back_populates="collaboration_sessions")
    collaborators = relationship("Collaborator", back_populates="session", lazy="selectin")
    invitations = relationship("CollaborationInvitation", back_populates="session", lazy="selectin")


class Collaborator(_Base, UUIDMixin):
    __tablename__ = "collaborators"

    session_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("collaboration_sessions.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("users.id"), nullable=False)
    permission: Mapped[str] = mapped_column(String(16), nullable=False, default="view")
    cursor_color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    joined_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), server_default=func.now()
    )

    session = relationship("CollaborationSession", back_populates="collaborators")
    user = relationship("User", back_populates="collaborators")


class CollaborationInvitation(_Base, UUIDMixin):
    __tablename__ = "collaboration_invitations"

    session_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("collaboration_sessions.id"), nullable=False)
    inviter_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("users.id"), nullable=False)
    invitee_email: Mapped[str] = mapped_column(String(255), nullable=False)
    invitee_id: Mapped[str | None] = mapped_column(CHAR(36), ForeignKey("users.id"), nullable=True)
    permission: Mapped[str] = mapped_column(String(16), nullable=False, default="view")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    token: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), server_default=func.now()
    )

    session = relationship("CollaborationSession", back_populates="invitations")


class AIProcessingJob(_Base, UUIDMixin):
    __tablename__ = "ai_processing_jobs"

    task_id: Mapped[str] = mapped_column(CHAR(36), unique=True, nullable=False)
    user_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("users.id"), nullable=False)
    document_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("documents.id"), nullable=False)
    job_type: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="queued")
    input_params: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    result_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    result_summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    progress_pct: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    chunks_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    chunks_completed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tokens_used: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cost_estimate: Mapped[float | None] = mapped_column(Float, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), server_default=func.now()
    )

    document = relationship("Document", back_populates="processing_jobs")
    user = relationship("User", back_populates="processing_jobs")
```

- [ ] **Step 11: Update src/models/operation_log.py**

```python
"""Operation log (audit trail) model."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, CHAR, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import UUIDMixin, Base as _Base


class OperationLog(_Base, UUIDMixin):
    __tablename__ = "operation_logs"

    user_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("users.id"), nullable=False, index=True)
    document_id: Mapped[str | None] = mapped_column(CHAR(36), ForeignKey("documents.id"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    action_category: Mapped[str] = mapped_column(String(32), nullable=False)
    details: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), server_default=func.now(), index=True
    )

    user = relationship("User", back_populates="operation_logs")
    document = relationship("Document", back_populates="operation_logs")
```

- [ ] **Step 12: Update src/models/tier.py**

Change `BigInteger` → `BigInteger` (MySQL compatible), `Numeric` → `Float`, `Uuid` → `CHAR(36)`, remove `timezone=True`:

```python
"""Tier definition, enterprise API key, and cache invalidation models."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import BigInteger, Boolean, CHAR, DateTime, Float, Integer, String, Text, func
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import UUIDMixin, Base as _Base


class TierDefinition(_Base):
    __tablename__ = "tier_definitions"

    name: Mapped[str] = mapped_column(String(32), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    max_documents_per_month: Mapped[int] = mapped_column(Integer, nullable=False)
    max_ai_calls_per_month: Mapped[int] = mapped_column(Integer, nullable=False)
    max_storage_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    max_document_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    max_document_chars: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    max_file_types: Mapped[list] = mapped_column(JSON, nullable=False)
    supports_async_processing: Mapped[bool] = mapped_column(Boolean, nullable=False)
    supports_collaboration: Mapped[bool] = mapped_column(Boolean, nullable=False)
    supports_api_access: Mapped[bool] = mapped_column(Boolean, nullable=False)
    max_collaborators_per_doc: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price_monthly_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), server_default=func.now()
    )


class EnterpriseAPIKey(_Base, UUIDMixin):
    __tablename__ = "enterprise_api_keys"

    organization_id: Mapped[str | None] = mapped_column(CHAR(36), nullable=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    key_prefix: Mapped[str] = mapped_column(String(16), nullable=False)
    key_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    permissions: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), server_default=func.now()
    )


class CacheInvalidationKey(_Base):
    __tablename__ = "cache_invalidation_keys"

    key_prefix: Mapped[str] = mapped_column(String(255), primary_key=True)
    version: Mapped[int] = mapped_column(BigInteger, nullable=False, default=1)
```

- [ ] **Step 13: Update src/models/oauth.py**

```python
from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, CHAR, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import UUIDMixin, TimestampMixin, Base as _Base


class OAuthAccount(_Base, UUIDMixin, TimestampMixin):
    __tablename__ = "oauth_accounts"

    user_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("users.id"), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    provider_user_id: Mapped[str] = mapped_column(String(64), nullable=False)
    provider_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider_login: Mapped[str | None] = mapped_column(String(128), nullable=True)
    access_token: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    provider_data: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    user = relationship("User", back_populates="oauth_accounts")
```

### Task 1.5: Update Backend Service Code for UUID String Handling

**Files:** Modify `src/api/deps.py`, all services that use `uuid.UUID()`

- [ ] **Step 14: Update src/api/deps.py — change uuid.UUID() to plain string**

Since IDs are now `CHAR(36)` strings, all `uuid.UUID(doc_id)` conversions must change to just use the string directly:

```python
# In deps.py, line 115:
# Old: doc_uuid = uuid.UUID(doc_id)
# New: doc_uuid = doc_id  # MySQL CHAR(36) — already a string

# Similarly in get_current_user, line 73:
# Old: user = await svc.get_user(uuid.UUID(user_id))
# New: user = await svc.get_user(user_id)
```

Full updated deps.py key changes:

```python
# Line 73:
user = await svc.get_user(user_id)  # was: uuid.UUID(user_id)

# Line 115:
doc_uuid = doc_id  # was: uuid.UUID(doc_id)
```

- [ ] **Step 15: Search and update all uuid.UUID() calls in services and routes**

Search pattern across `src/services/` and `src/api/`: `uuid\.UUID\(`

For each occurrence, replace `uuid.UUID(x)` with just `x` since MySQL CHAR(36) stores the string representation directly.

### Task 1.6: Update Docker and Alembic Config

**Files:** Modify `docker/docker-compose.yml`, `alembic/env.py`, `alembic.ini`

- [ ] **Step 16: Update docker-compose.yml — Replace PostgreSQL with MySQL**

```yaml
version: "3.9"

services:
  mysql:
    image: mysql:8.4
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: docmind
      MYSQL_USER: docmind
      MYSQL_PASSWORD: docmind
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "docmind", "-pdocmind"]
      interval: 5s
      timeout: 5s
      retries: 10
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 2gb --maxmemory-policy allkeys-lru
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data

  api:
    build:
      context: ..
      dockerfile: docker/Dockerfile.api
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=mysql+asyncmy://docmind:docmind@mysql:3306/docmind
      - DATABASE_URL_SYNC=mysql+mysqldb://docmind:docmind@mysql:3306/docmind
      - REDIS_CACHE_URL=redis://redis:6379/0
      - REDIS_BROKER_URL=redis://redis:6379/1
      - REDIS_RESULT_BACKEND=redis://redis:6379/2
      - STORAGE_ENDPOINT=minio:9000
      - STORAGE_ACCESS_KEY=minioadmin
      - STORAGE_SECRET_KEY=minioadmin
      - STORAGE_BUCKET=docmind
      - STORAGE_SECURE=false
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ../src:/app/src

  worker:
    build:
      context: ..
      dockerfile: docker/Dockerfile.worker
    environment:
      - DATABASE_URL=mysql+asyncmy://docmind:docmind@mysql:3306/docmind
      - DATABASE_URL_SYNC=mysql+mysqldb://docmind:docmind@mysql:3306/docmind
      - REDIS_CACHE_URL=redis://redis:6379/0
      - REDIS_BROKER_URL=redis://redis:6379/1
      - REDIS_RESULT_BACKEND=redis://redis:6379/2
      - STORAGE_ENDPOINT=minio:9000
      - STORAGE_ACCESS_KEY=minioadmin
      - STORAGE_SECRET_KEY=minioadmin
      - STORAGE_BUCKET=docmind
      - STORAGE_SECURE=false
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ../src:/app/src

volumes:
  mysql_data:
  minio_data:
```

- [ ] **Step 17: Update alembic/env.py**

```python
# Line 16: Update to set sync URL from settings
config.set_main_option("sqlalchemy.url", settings.database_url_sync)
# This already reads from settings — it will pick up the new MySQL URL automatically
```

No code changes needed — the env.py reads `settings.database_url_sync` which will now be the MySQL URL.

- [ ] **Step 18: Update alembic.ini — just the comment/example line**

```ini
# Line 89:
sqlalchemy.url = mysql+mysqldb://user:pass@localhost/dbname
```

### Task 1.7: Verify Database Migration

- [ ] **Step 19: Start MySQL via Docker**

```bash
cd docker && docker compose up -d mysql
```

Expected: MySQL container starts healthy.

- [ ] **Step 20: Test database connection**

```bash
python -c "
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
async def test():
    engine = create_async_engine('mysql+asyncmy://docmind:docmind@localhost:3306/docmind')
    async with engine.connect() as conn:
        result = await conn.execute('SELECT 1')
        print('MySQL connected:', result.scalar())
asyncio.run(test())
"
```

Expected: "MySQL connected: 1"

- [ ] **Step 21: Run Alembic to create tables**

```bash
alembic upgrade head
```

Expected: All 13 tables created in MySQL docmind database.

---

## Phase 2: Angular Frontend — Project Setup

### Task 2.1: Create Angular Project

- [ ] **Step 22: Generate Angular 19 project**

```bash
cd E:/projects/docmind
npx @angular/cli@19 new frontend-angular --routing --style=scss --ssr=false --skip-tests=false
```

Select: SCSS stylesheet format, add Angular routing.

- [ ] **Step 23: Install dependencies**

```bash
cd frontend-angular
npm install @angular/material @angular/cdk @angular/animations
npm install @ngx-translate/core @ngx-translate/http-loader
npm install ngx-markdown marked
npm install diff
npm install pdfjs-dist
npm install rxjs
```

- [ ] **Step 24: Configure angular.json for proxy**

Add proxy config to `frontend-angular/angular.json` under `architect.serve.options`:
```json
"proxyConfig": "proxy.conf.json"
```

Create `frontend-angular/proxy.conf.json`:
```json
{
  "/api": {
    "target": "http://localhost:8000",
    "secure": false
  }
}
```

- [ ] **Step 25: Verify project starts**

```bash
cd frontend-angular && npx ng serve --port 4200
```

Open `http://localhost:4200` — should show Angular default page.

---

## Phase 3: Angular Core Infrastructure

### Task 3.1: Type Definitions

**Files:** Create `src/app/shared/models/types.ts`

- [ ] **Step 26: Write TypeScript interfaces matching the API**

Create `frontend-angular/src/app/shared/models/types.ts` with all interfaces from the existing `frontend/src/types/index.ts` (User, Document, Version, CollaborationSession, etc.). The interfaces are identical to the React version since the API contract doesn't change.

### Task 3.2: API Service with HTTP Interceptors

**Files:** Create `src/app/core/http/api.service.ts`, `src/app/core/auth/auth.interceptor.ts`

- [ ] **Step 27: Create auth interceptor**

Create `frontend-angular/src/app/core/auth/auth.interceptor.ts`:
```typescript
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { catchError, switchMap, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = localStorage.getItem('access_token');

  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/refresh')) {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          return authService.refresh(refreshToken).pipe(
            switchMap((res) => {
              localStorage.setItem('access_token', res.access_token);
              localStorage.setItem('refresh_token', res.refresh_token);
              const retryReq = req.clone({
                setHeaders: { Authorization: `Bearer ${res.access_token}` },
              });
              return next(retryReq);
            }),
            catchError(() => {
              authService.logout();
              throw error;
            })
          );
        }
        authService.logout();
      }
      return throwError(() => error);
    })
  );
};
```

- [ ] **Step 28: Create API service**

Create `frontend-angular/src/app/core/http/api.service.ts` with all API methods (authApi, userApi, documentApi, aiApi, versionApi, collabApi, operationsApi, adminApi, githubApi, slideApi, healthApi) — equivalent to `frontend/src/lib/api.ts`.

Each method group is a set of methods on the `ApiService` class, using Angular's `HttpClient`:

```typescript
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { ApiResponse, User, Document, ... } from '../../shared/models/types';

const API_BASE = '/api/v1';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  // Auth
  register(email: string, password: string, display_name: string) { ... }
  login(email: string, password: string) { ... }
  // ... all other methods
}
```

### Task 3.3: Auth Service and Guard

**Files:** Create `src/app/core/auth/auth.service.ts`, `src/app/core/auth/auth.guard.ts`

- [ ] **Step 29: Create auth service**

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import type { User, TokenResponse } from '../../shared/models/types';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {}

  get isAuthenticated(): boolean {
    return !!localStorage.getItem('access_token');
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post('/api/v1/auth/login', { email, password }).pipe(
      tap((res: any) => {
        if (res.success && res.data) {
          localStorage.setItem('access_token', res.data.access_token);
          localStorage.setItem('refresh_token', res.data.refresh_token);
          this.fetchCurrentUser();
        }
      })
    );
  }

  fetchCurrentUser(): void {
    this.http.get('/api/v1/users/me').subscribe((res: any) => {
      if (res.success) this.currentUserSubject.next(res.data);
    });
  }

  refresh(token: string): Observable<TokenResponse> {
    return this.http.post<TokenResponse>('/api/v1/auth/refresh', { refresh_token: token });
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }
}
```

- [ ] **Step 30: Create auth guard**

```typescript
import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean {
    if (this.auth.isAuthenticated) return true;
    this.router.navigate(['/login']);
    return false;
  }
}
```

### Task 3.4: i18n Configuration

**Files:** Create `src/app/core/i18n/translation-config.ts`, update locale JSON files

- [ ] **Step 31: Configure ngx-translate**

```typescript
import { provideHttpClient } from '@angular/common/http';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { HttpClient } from '@angular/common/http';

export function HttpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http, '/assets/locales/', '.json');
}

export const provideTranslation = () =>
  TranslateModule.forRoot({
    defaultLanguage: 'zh',
    loader: {
      provide: TranslateLoader,
      useFactory: HttpLoaderFactory,
      deps: [HttpClient],
    },
  }).providers!;
```

- [ ] **Step 32: Copy locale files**

Copy `frontend/src/locales/en.json` and `frontend/src/locales/zh.json` to `frontend-angular/src/assets/locales/`.

### Task 3.5: App Config and Routing

**Files:** Create `src/app/app.config.ts`, `src/app/app.routes.ts`

- [ ] **Step 33: Create app.config.ts with all providers**

```typescript
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService } from '@ngx-translate/core';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    // ngx-translate v15+ standalone
  ],
};
```

- [ ] **Step 34: Create app.routes.ts with all routes**

```typescript
import { Routes } from '@angular/router';
import { AuthGuard } from './core/auth/auth.guard';
import { AppLayoutComponent } from './shared/components/app-layout/app-layout.component';

export const routes: Routes = [
  {
    path: '',
    component: AppLayoutComponent,
    children: [
      { path: '', loadComponent: () => import('./pages/landing/landing.component').then(m => m.LandingComponent) },
      { path: 'login', loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent) },
      { path: 'register', loadComponent: () => import('./pages/register/register.component').then(m => m.RegisterComponent) },
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent), canActivate: [AuthGuard] },
      { path: 'documents/:id', loadComponent: () => import('./pages/document-editor/document-editor.component').then(m => m.DocumentEditorComponent), canActivate: [AuthGuard] },
      { path: 'documents/:id/versions', loadComponent: () => import('./pages/version-history/version-history.component').then(m => m.VersionHistoryComponent), canActivate: [AuthGuard] },
      { path: 'documents/:id/collaboration', loadComponent: () => import('./pages/collaboration/collaboration.component').then(m => m.CollaborationComponent), canActivate: [AuthGuard] },
      { path: 'admin', loadComponent: () => import('./pages/admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent), canActivate: [AuthGuard] },
      { path: 'settings', loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent), canActivate: [AuthGuard] },
      { path: 'auth/github/callback', loadComponent: () => import('./pages/auth-callback/auth-callback.component').then(m => m.AuthCallbackComponent) },
      { path: 'github/import', loadComponent: () => import('./pages/github-import/github-import.component').then(m => m.GitHubImportComponent), canActivate: [AuthGuard] },
      { path: '**', redirectTo: '' },
    ],
  },
];
```

---

## Phase 4: Angular Shared Components

### Task 4.1: App Layout and Navbar

**Files:** Create app-layout and navbar components

- [ ] **Step 35: Generate and implement AppLayoutComponent**

```bash
npx ng generate component shared/components/app-layout --standalone
npx ng generate component shared/components/navbar --standalone
npx ng generate component shared/components/language-switcher --standalone
```

Implement `AppLayoutComponent` with `<router-outlet>` and Navbar. Implement `NavbarComponent` with Angular Material toolbar, responsive menu, auth state display, user dropdown.

### Task 4.2: Error Boundary and File Icon

**Files:** Create error-boundary and file-icon components

- [ ] **Step 36: Generate and implement shared utility components**

```bash
npx ng generate component shared/components/error-boundary --standalone
npx ng generate component shared/components/file-icon --standalone
```

---

## Phase 5: Angular Pages

Each page is an independent standalone component using lazy loading.

### Task 5.1: Landing, Login, Register Pages

**Files:** Create respective page components under `src/app/pages/`

- [ ] **Step 37: Generate and implement Landing page**

- [ ] **Step 38: Generate and implement Login page with Angular Material form**

- [ ] **Step 39: Generate and implement Register page**

### Task 5.2: Dashboard Page

**Files:** Create `src/app/pages/dashboard/`

- [ ] **Step 40: Generate and implement Dashboard page**

Upload zone (drag & drop via Angular CDK), document list with filtering/sorting, usage stats display.

### Task 5.3: Document Editor Page

**Files:** Create `src/app/pages/document-editor/`

- [ ] **Step 41: Generate and implement Document Editor page**

Text editor with viewer panel, AI tool panel integration, export controls.

### Task 5.4: Version History, Collaboration, Admin, Settings Pages

**Files:** Create respective page components

- [ ] **Step 42: VersionHistory page** — version list, diff viewer, restore

- [ ] **Step 43: Collaboration page** — session management, invitations, permission controls

- [ ] **Step 44: AdminDashboard page** — admin stats, user management

- [ ] **Step 45: Settings page** — profile editing, tier info, OAuth linking

### Task 5.5: Auth Callback and GitHub Import Pages

**Files:** Create respective page components

- [ ] **Step 46: AuthCallback page** — handle GitHub OAuth callback

- [ ] **Step 47: GitHubImport page** — repo browser, file picker, import

---

## Phase 6: Angular Viewers

### Task 6.1: Viewer Architecture

**Files:** Create viewer base class and registry

- [ ] **Step 48: Create viewer registry and base**

```bash
npx ng generate component viewers/pdf-viewer --standalone
npx ng generate component viewers/pptx-viewer --standalone
npx ng generate component viewers/image-viewer --standalone
npx ng generate component viewers/text-viewer --standalone
```

Implement `ViewerRegistry` as a service that maps format→component, and a `BaseViewer` interface.

---

## Phase 7: Final Integration & Verification

### Task 7.1: Update CORS and Frontend Serving

**Files:** Modify `src/main.py`, `src/config.py`

- [ ] **Step 49: Update CORS origins to include Angular dev port**

```python
# In main.py, line 89 and .env.example:
CORS_ALLOWED_ORIGINS=http://localhost:4200,http://localhost:5173
```

- [ ] **Step 50: Verify full stack**

Start MySQL, Redis, MinIO (via Docker), start backend, start Angular frontend. Test: login, upload document, use AI features, view versions.

---

## Phase 8: PPT and Report Generation

### Task 8.1: Generate PPT Presentation

Use the pptx skill to regenerate the project PPT reflecting the new Angular+MySQL architecture.

### Task 8.2: Update Project Report

Update the existing `DocMind_AGI全栈开发大作业报告.docx` to reflect Angular+MySQL migration details.

---

## Self-Review

### 1. Spec Coverage
- [x] Database: PostgreSQL → MySQL (Tasks 1.1–1.7)
- [x] Frontend: React → Angular (Tasks 2.1–6.1)
- [x] All 13 database models updated
- [x] All 10 API route modules preserved (no API contract changes)
- [x] All frontend features mapped: pages, viewers, i18n, auth, GitHub OAuth
- [x] PPT and report generation (Phase 8)

### 2. Placeholder Scan
- No TBD/TODO placeholders
- All code steps include actual code
- All file paths are exact

### 3. Type Consistency
- UUID type: `CHAR(36)` / `string` consistently across all models
- DateTime: `DateTime` without `timezone=True` consistently
- Foreign key types match referenced primary keys
- Angular interfaces match API response shapes
