import io
import json
import unittest
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from backend.app import auth
from jwt.exceptions import PyJWKClientConnectionError


class SupabaseAuthFallbackTests(unittest.TestCase):
    @patch.dict("os.environ", {"SUPABASE_SERVICE_KEY": "test-key"})
    @patch("backend.app.auth.urlopen")
    def test_reads_user_id_from_auth_api(self, mock_urlopen):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = json.dumps(
            {"id": "user-123"}
        ).encode()
        mock_urlopen.return_value = response

        with patch.object(auth, "SUPABASE_URL", "https://example.test"):
            user_id = auth._get_user_id_from_auth_api("access-token")

        self.assertEqual(user_id, "user-123")
        request = mock_urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "https://example.test/auth/v1/user")
        self.assertEqual(request.get_header("Apikey"), "test-key")
        self.assertEqual(request.get_header("Authorization"), "Bearer access-token")

    @patch.dict("os.environ", {"SUPABASE_SERVICE_KEY": "test-key"})
    @patch(
        "backend.app.auth.urlopen",
        side_effect=HTTPError(
            "https://example.test/auth/v1/user", 401, "Invalid token", {}, io.BytesIO()
        ),
    )
    def test_rejects_invalid_token(self, _mock_urlopen):
        with patch.object(auth, "SUPABASE_URL", "https://example.test"):
            with self.assertRaises(HTTPException) as raised:
                auth._get_user_id_from_auth_api("invalid-token")

        self.assertEqual(raised.exception.status_code, 401)

    @patch.dict("os.environ", {"SUPABASE_SERVICE_KEY": "test-key"})
    def test_uses_auth_api_when_jwks_is_unavailable(self):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'{"id":"user-123"}'
        jwks_client = MagicMock()
        jwks_client.get_signing_key_from_jwt.side_effect = PyJWKClientConnectionError(
            "JWKS unavailable"
        )
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials="access-token",
        )

        with (
            patch.object(auth, "SUPABASE_URL", "https://example.test"),
            patch.object(auth, "JWKS_CLIENT", jwks_client),
            patch("backend.app.auth.urlopen", return_value=response),
        ):
            user_id = auth.get_current_user_id(credentials)

        self.assertEqual(user_id, "user-123")


if __name__ == "__main__":
    unittest.main()
