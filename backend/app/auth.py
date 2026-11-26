import json
import os
from urllib.error import HTTPError
from urllib.request import Request, urlopen

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


def _get_user_id_from_auth_api(access_token: str) -> str:
    api_key = os.getenv("SUPABASE_SERVICE_KEY", "")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase kimlik doğrulama ayarları eksik.",
        )

    request = Request(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={
            "apikey": api_key,
            "Authorization": f"Bearer {access_token}",
        },
    )
    try:
        with urlopen(request, timeout=10) as response:
            user = json.loads(response.read())
    except HTTPError as error:
        if error.code in (401, 403):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Oturum geçersiz veya süresi dolmuş.",
                headers={"WWW-Authenticate": "Bearer"},
            ) from error
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase kimlik doğrulama servisine ulaşılamadı.",
        ) from error
    except (OSError, json.JSONDecodeError) as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase kimlik doğrulama servisine ulaşılamadı.",
        ) from error

    user_id = user.get("id") if isinstance(user, dict) else None
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase kimlik doğrulama servisi geçersiz yanıt verdi.",
        )
    return user_id


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
        try:
            return _get_user_id_from_auth_api(credentials.credentials)
        except HTTPException as fallback_error:
            raise fallback_error from error
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
