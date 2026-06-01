"""GitHub repository browsing and document import endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_cache, get_current_active_user, get_db
from src.core.cache import (
    KEY_GITHUB_CONTENTS,
    KEY_GITHUB_RATE_LIMIT,
    KEY_GITHUB_REPOS,
    TTL_GITHUB_CONTENTS,
    TTL_GITHUB_RATE_LIMIT,
    TTL_GITHUB_REPOS,
    CacheManager,
)
from src.models.user import User
from src.schemas.common import APIResponse
from src.schemas.oauth import (
    GitHubContentResponse,
    GitHubRateLimitResponse,
    GitHubRepoResponse,
    ImportFromGitHubRequest,
)
from src.services.document_service import DocumentService
from src.services.github_service import (
    GitHubRateLimitError,
    GitHubService,
    get_github_service_for_user,
)

router = APIRouter(prefix="/github", tags=["github"])


@router.get("/repos", response_model=APIResponse[list[GitHubRepoResponse]])
async def list_repos(
    search: str | None = Query(None, description="Search query for repositories"),
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    try:
        svc = await get_github_service_for_user(current_user, db, cache)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    try:
        cache_key = KEY_GITHUB_REPOS.format(user_id=str(current_user.id))

        if search:
            repos = await svc.search_repos(search, per_page=page_size)
        else:
            async def _fetch():
                return await svc.get_user_repos(per_page=page_size)
            repos = await cache.get(cache_key, _fetch, ttl=TTL_GITHUB_REPOS) if not search else await _fetch()
            if repos is None:
                repos = await _fetch()

        data = [GitHubRepoResponse(**r) for r in repos[:page_size]]
        return APIResponse(success=True, data=data)
    except GitHubRateLimitError as e:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(e))
    finally:
        await svc.close()


@router.get("/repos/{owner}/{repo}/contents", response_model=APIResponse[list[GitHubContentResponse]])
async def get_repo_contents(
    owner: str,
    repo: str,
    path: str = Query("", description="Directory path within the repository"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    try:
        svc = await get_github_service_for_user(current_user, db, cache)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    try:
        cache_key = KEY_GITHUB_CONTENTS.format(user_id=str(current_user.id), owner=owner, repo=repo, path=path or "__root__")

        async def _fetch():
            return await svc.get_repo_contents(owner, repo, path)

        contents = await cache.get(cache_key, _fetch, ttl=TTL_GITHUB_CONTENTS)
        if contents is None:
            contents = await _fetch()

        data = [GitHubContentResponse(**c) for c in contents]
        return APIResponse(success=True, data=data)
    except GitHubRateLimitError as e:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(e))
    finally:
        await svc.close()


@router.get("/repos/{owner}/{repo}/file", response_model=APIResponse[dict])
async def get_file(
    owner: str,
    repo: str,
    path: str = Query(..., description="File path within the repository"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    try:
        svc = await get_github_service_for_user(current_user, db, cache)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    try:
        data = await svc.get_file_content(owner, repo, path)
        return APIResponse(success=True, data=data)
    except GitHubRateLimitError as e:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(e))
    finally:
        await svc.close()


@router.get("/repos/{owner}/{repo}/readme", response_model=APIResponse[dict])
async def get_readme(
    owner: str,
    repo: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    try:
        svc = await get_github_service_for_user(current_user, db, cache)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    try:
        data = await svc.get_readme(owner, repo)
        if data is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No README found in this repository")
        return APIResponse(success=True, data=data)
    except GitHubRateLimitError as e:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(e))
    finally:
        await svc.close()


@router.post("/import", response_model=APIResponse[dict], status_code=status.HTTP_201_CREATED)
async def import_from_github(
    body: ImportFromGitHubRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    try:
        svc = await get_github_service_for_user(current_user, db, cache)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    try:
        parts = body.repo_full_name.split("/")
        if len(parts) != 2:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid repo_full_name format. Use 'owner/repo'")
        owner, repo = parts

        file_data = await svc.get_file_content(owner, repo, body.file_path)
        doc_svc = DocumentService(db, cache)

        content_bytes = file_data["content"].encode("utf-8")
        filename = body.file_path.split("/")[-1]

        from io import BytesIO
        from src.services.parsing_service import parse_document

        input_format = filename.rsplit(".", 1)[-1] if "." in filename else "txt"
        if input_format not in ("md", "txt", "rst", "html", "adoc"):
            input_format = "md" if filename.endswith(".md") else "txt"

        doc = await doc_svc.upload(
            user_id=str(current_user.id),
            filename=filename,
            content=content_bytes,
            mime_type="text/plain",
            folder=body.folder,
        )

        parsed = parse_document(content_bytes, input_format)
        await doc_svc.save_parsed_content(doc.id, parsed)

        return APIResponse(
            success=True,
            data={"id": str(doc.id), "title": doc.title, "char_count": len(parsed)},
            message=f"Imported {filename} from {body.repo_full_name}",
        )
    except GitHubRateLimitError as e:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(e))
    finally:
        await svc.close()


@router.get("/rate-limit", response_model=APIResponse[GitHubRateLimitResponse])
async def rate_limit(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    cache: CacheManager = Depends(get_cache),
):
    try:
        svc = await get_github_service_for_user(current_user, db, cache)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    try:
        data = await svc.get_rate_limit()
        resp = GitHubRateLimitResponse(**data)
        await cache.set(KEY_GITHUB_RATE_LIMIT.format(user_id=str(current_user.id)), data, ttl=TTL_GITHUB_RATE_LIMIT)
        return APIResponse(success=True, data=resp)
    finally:
        await svc.close()
