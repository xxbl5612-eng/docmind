from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class GitHubOAuthCallbackRequest(BaseModel):
    code: str
    state: str


class GitHubLinkRequest(BaseModel):
    code: str
    state: str


class OAuthAccountResponse(BaseModel):
    provider: str
    provider_login: str | None
    provider_email: str | None
    linked_at: datetime

    model_config = {"from_attributes": True}


class GitHubRepoResponse(BaseModel):
    id: int
    name: str
    full_name: str
    description: str | None
    private: bool
    html_url: str
    default_branch: str


class GitHubContentResponse(BaseModel):
    name: str
    path: str
    type: str
    sha: str
    size: int
    html_url: str


class ImportFromGitHubRequest(BaseModel):
    repo_full_name: str
    file_path: str
    folder: str | None = None


class GitHubRateLimitResponse(BaseModel):
    remaining: int
    limit: int
    reset: int
