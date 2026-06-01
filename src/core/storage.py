"""File storage abstraction over MinIO (S3-compatible) with local filesystem fallback."""

from __future__ import annotations

import io
import os
import uuid
from datetime import timedelta
from pathlib import Path

from src.config import settings

# Local storage root for dev fallback mode
_LOCAL_ROOT = Path("_storage")


def _ensure_local_dir(path: str) -> None:
    full = _LOCAL_ROOT / path
    full.parent.mkdir(parents=True, exist_ok=True)


def _use_local() -> bool:
    return settings.use_dev_fallback


def generate_object_path(user_id: str, filename: str, folder: str = "") -> str:
    """Generate a unique object path in storage."""
    ext = filename.rsplit(".", 1)[-1] if "." in filename else "dat"
    uid = uuid.uuid4().hex
    if folder:
        return f"users/{user_id}/{folder}/{uid}.{ext}"
    return f"users/{user_id}/{uid}.{ext}"


def upload_file(data: bytes, object_path: str, content_type: str = "application/octet-stream") -> str:
    if _use_local():
        _ensure_local_dir(object_path)
        (_LOCAL_ROOT / object_path).write_bytes(data)
        return object_path

    from minio import Minio
    client = _get_minio_client()
    client.put_object(
        bucket_name=settings.storage_bucket,
        object_name=object_path,
        data=io.BytesIO(data),
        length=len(data),
        content_type=content_type,
    )
    return object_path


def upload_text(content: str, object_path: str) -> str:
    data = content.encode("utf-8")
    return upload_file(data, object_path, "text/plain; charset=utf-8")


def download_file(object_path: str) -> bytes:
    if _use_local():
        return (_LOCAL_ROOT / object_path).read_bytes()

    from minio import Minio
    client = _get_minio_client()
    try:
        response = client.get_object(settings.storage_bucket, object_path)
        return response.read()
    finally:
        if "response" in locals():
            response.close()
            response.release_conn()


def download_text(object_path: str) -> str:
    return download_file(object_path).decode("utf-8")


def delete_file(object_path: str) -> None:
    if _use_local():
        p = _LOCAL_ROOT / object_path
        if p.exists():
            p.unlink()
        return

    from minio import Minio
    from minio.error import S3Error
    client = _get_minio_client()
    try:
        client.remove_object(settings.storage_bucket, object_path)
    except S3Error:
        pass


def get_presigned_url(object_path: str, expires: int = 3600) -> str:
    if _use_local():
        return f"/local-storage/{object_path}"

    from minio import Minio
    client = _get_minio_client()
    return client.presigned_get_object(
        settings.storage_bucket,
        object_path,
        expires=timedelta(seconds=expires),
    )


def file_exists(object_path: str) -> bool:
    if _use_local():
        return (_LOCAL_ROOT / object_path).exists()

    from minio import Minio
    from minio.error import S3Error
    client = _get_minio_client()
    try:
        client.stat_object(settings.storage_bucket, object_path)
        return True
    except S3Error:
        return False


# ── MinIO client (lazy) ──

_client = None


def _get_minio_client():
    global _client
    if _client is None:
        from minio import Minio
        _client = Minio(
            endpoint=settings.storage_endpoint,
            access_key=settings.storage_access_key,
            secret_key=settings.storage_secret_key_value,
            secure=settings.storage_secure,
        )
        _ensure_bucket(_client)
    return _client


def _ensure_bucket(client) -> None:
    bucket = settings.storage_bucket
    found = client.bucket_exists(bucket)
    if not found:
        client.make_bucket(bucket)
