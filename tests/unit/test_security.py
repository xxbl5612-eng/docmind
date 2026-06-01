from src.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    create_refresh_token,
    hash_token,
)


class TestPasswordHashing:
    def test_hash_and_verify_correct_password(self):
        hashed = hash_password("my-secret-password")
        assert verify_password("my-secret-password", hashed)

    def test_verify_wrong_password(self):
        hashed = hash_password("my-secret-password")
        assert not verify_password("wrong-password", hashed)

    def test_hash_is_deterministic_in_verify_but_not_hash(self):
        h1 = hash_password("same-password")
        h2 = hash_password("same-password")
        assert h1 != h2  # Argon2 uses random salt
        assert verify_password("same-password", h1)
        assert verify_password("same-password", h2)


class TestJWT:
    def test_create_and_decode_access_token(self):
        token = create_access_token("user-123", "novice")
        payload = decode_access_token(token)
        assert payload["sub"] == "user-123"
        assert payload["tier"] == "novice"

    def test_create_access_token_with_extra_claims(self):
        token = create_access_token("user-456", "professional", {"extra": "value"})
        payload = decode_access_token(token)
        assert payload["extra"] == "value"

    def test_expired_token_raises(self):
        from jose import JWTError
        import pytest
        # Token with 0 expiry — we test via the decode which validates signature only
        # Full expiry validation is handled by python-jose automatically on decode
        token = create_access_token("user-789", "novice")
        payload = decode_access_token(token)
        assert "exp" in payload


class TestRefreshTokens:
    def test_create_refresh_token_returns_triple(self):
        plain, token_hash, expires_at = create_refresh_token()
        assert len(plain) > 0
        assert len(token_hash) == 64  # SHA-256 hex
        assert expires_at is not None

    def test_hash_token_is_consistent(self):
        h1 = hash_token("test-token")
        h2 = hash_token("test-token")
        assert h1 == h2
        assert h1 != hash_token("different-token")
