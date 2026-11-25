import os
from functools import lru_cache

from supabase import Client, create_client

BUCKET_NAME = os.getenv("SUPABASE_STORAGE_BUCKET", "clothing-images")


@lru_cache(maxsize=1)
def get_storage_client() -> Client:
    supabase_url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_KEY")
    if not supabase_url or not service_key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY must be configured on the backend."
        )
    return create_client(supabase_url, service_key)
