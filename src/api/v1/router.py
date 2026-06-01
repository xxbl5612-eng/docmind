"""V1 API router aggregator."""

from __future__ import annotations

from fastapi import APIRouter

from src.api.v1.auth import router as auth_router
from src.api.v1.users import router as users_router
from src.api.v1.documents import router as documents_router
from src.api.v1.processing import router as processing_router
from src.api.v1.versions import router as versions_router
from src.api.v1.collaboration import router as collaboration_router
from src.api.v1.operations import router as operations_router
from src.api.v1.admin import router as admin_router
from src.api.v1.oauth import router as oauth_router
from src.api.v1.github import router as github_router

v1_router = APIRouter(prefix="/api/v1")

v1_router.include_router(auth_router)
v1_router.include_router(oauth_router)
v1_router.include_router(github_router)
v1_router.include_router(users_router)
v1_router.include_router(documents_router)
v1_router.include_router(processing_router)
v1_router.include_router(versions_router)
v1_router.include_router(collaboration_router)
v1_router.include_router(operations_router)
v1_router.include_router(admin_router)
