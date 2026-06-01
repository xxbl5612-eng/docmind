"""Fernet encryption for sensitive tokens at rest."""

from cryptography.fernet import Fernet

from src.config import settings


def _get_fernet() -> Fernet:
    return Fernet(settings.github_oauth_token_encryption_key_value.encode())


def encrypt_token(plain: str) -> str:
    return _get_fernet().encrypt(plain.encode()).decode()


def decrypt_token(cipher: str) -> str:
    return _get_fernet().decrypt(cipher.encode()).decode()
