"""GitHub API client with rate limiting, pagination, and caching."""

from __future__ import annotations

import base64
import time
from typing import AsyncGenerator

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.cache import KEY_GITHUB_RATE_LIMIT, TTL_GITHUB_RATE_LIMIT, CacheManager
from src.core.encryption import decrypt_token
from src.models.oauth import OAuthAccount
from src.models.user import User

GITHUB_API_BASE = "https://api.github.com"


class GitHubRateLimitError(Exception):
    pass


class GitHubService:
    def __init__(self, access_token: str | None = None) -> None:
        self._token = access_token
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            headers = {
                "Accept": "application/vnd.github+json",
                "User-Agent": "DocMind/0.1.0",
            }
            if self._token:
                headers["Authorization"] = f"Bearer {self._token}"
            self._client = httpx.AsyncClient(base_url=GITHUB_API_BASE, headers=headers, timeout=30.0)
        return self._client

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    async def _request(self, method: str, path: str, **kwargs) -> dict:
        client = await self._get_client()
        resp = await client.request(method, path, **kwargs)

        remaining = int(resp.headers.get("X-RateLimit-Remaining", 999))
        if remaining == 0:
            reset_at = int(resp.headers.get("X-RateLimit-Reset", 0))
            wait = max(reset_at - int(time.time()), 0) + 1
            raise GitHubRateLimitError(f"GitHub API rate limit exceeded. Resets in {wait}s")

        resp.raise_for_status()
        return resp.json() if resp.content else {}

    async def _paginate(self, path: str, per_page: int = 100, **params) -> AsyncGenerator[dict, None]:
        page = 1
        while True:
            data = await self._request("GET", path, params={**params, "per_page": per_page, "page": page})
            if isinstance(data, list):
                if not data:
                    break
                for item in data:
                    yield item
                page += 1
            else:
                yield data
                break

    async def get_user_repos(self, visibility: str = "all", sort: str = "updated", per_page: int = 30) -> list[dict]:
        repos = []
        async for repo in self._paginate("/user/repos", per_page=per_page, visibility=visibility, sort=sort):
            if isinstance(repo, dict):
                repos.append(repo)
        return repos

    async def search_repos(self, query: str, per_page: int = 30) -> list[dict]:
        data = await self._request("GET", "/search/repositories", params={"q": query, "per_page": per_page})
        return data.get("items", [])

    async def get_repo_contents(self, owner: str, repo: str, path: str = "") -> list[dict]:
        contents = await self._request("GET", f"/repos/{owner}/{repo}/contents/{path}")
        if isinstance(contents, dict):
            return [contents]
        return contents or []

    async def get_file_content(self, owner: str, repo: str, path: str) -> dict:
        data = await self._request("GET", f"/repos/{owner}/{repo}/contents/{path}")
        content_str = ""
        if data.get("content"):
            content_str = base64.b64decode(data["content"]).decode("utf-8", errors="replace")
        return {"path": path, "content": content_str, "sha": data.get("sha", ""), "size": data.get("size", 0)}

    async def get_readme(self, owner: str, repo: str) -> dict | None:
        try:
            data = await self._request("GET", f"/repos/{owner}/{repo}/readme")
            content_str = base64.b64decode(data["content"]).decode("utf-8", errors="replace")
            return {"name": data.get("name", "README.md"), "path": data.get("path", ""), "content": content_str, "sha": data.get("sha", "")}
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def get_rate_limit(self) -> dict:
        data = await self._request("GET", "/rate_limit")
        core = data.get("resources", {}).get("core", {})
        return {"remaining": core.get("remaining", 0), "limit": core.get("limit", 5000), "reset": core.get("reset", 0)}


async def get_github_service_for_user(user: User, db: AsyncSession, cache: CacheManager) -> GitHubService:
    result = await db.execute(
        select(OAuthAccount).where(
            OAuthAccount.user_id == user.id,
            OAuthAccount.provider == "github",
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise ValueError("No GitHub account linked. Please link your GitHub account in Settings.")

    token = decrypt_token(account.access_token)
    svc = GitHubService(access_token=token)

    # Try cached rate limit first
    cached_rate = await cache.get(KEY_GITHUB_RATE_LIMIT.format(user_id=str(user.id)))
    if cached_rate and cached_rate.get("remaining", 0) == 0:
        reset_at = cached_rate.get("reset", 0)
        if time.time() < reset_at:
            svc.close()
            raise GitHubRateLimitError(f"GitHub API rate limit exhausted. Resets at {reset_at}")

    return svc
