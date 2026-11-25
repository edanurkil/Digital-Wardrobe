import os

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientConnectionError, PyJWKClientError

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
security = HTTPBearer(auto_error=False)
JWKS_CLIENT = (
    PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")
    if SUPABASE_URL
    else None
)
SUPPORTED_ALGORITHMS = ["ES256", "RS256", "EdDSA"]


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> str:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Giriş yapman gerekiyor.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if JWKS_CLIENT is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase kimlik doğrulama ayarları eksik.",
        )

    try:
        signing_key = JWKS_CLIENT.get_signing_key_from_jwt(credentials.credentials)
        payload = jwt.decode(
            credentials.credentials,
            signing_key.key,
            algorithms=SUPPORTED_ALGORITHMS,
            audience="authenticated",
            issuer=f"{SUPABASE_URL}/auth/v1",
        )
    except PyJWKClientConnectionError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase kimlik doğrulama servisine ulaşılamadı.",
        ) from error
    except (PyJWKClientError, jwt.InvalidTokenError) as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Oturum geçersiz veya süresi dolmuş.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Oturum kullanıcı bilgisi içermiyor.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return str(user_id)
