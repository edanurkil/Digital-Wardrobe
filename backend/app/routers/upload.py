import base64
import binascii
import io
import logging
import os
import uuid
from functools import lru_cache

from fastapi import APIRouter, Depends, HTTPException
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field
from rembg import new_session, remove

from ..auth import get_current_user_id
from ..storage import BUCKET_NAME, get_storage_client

logger = logging.getLogger(__name__)
REMBG_MODEL = os.getenv("REMBG_MODEL", "u2net")
router = APIRouter(prefix="/upload", tags=["upload"])


class Base64ImageUpload(BaseModel):
    image_base64: str = Field(..., min_length=1, max_length=16_000_000)
    file_ext: str = "jpg"


@lru_cache(maxsize=1)
def _get_rembg_session():
    return new_session(REMBG_MODEL)


def _trim_transparent_edges(image: Image.Image) -> Image.Image:
    if image.mode != "RGBA":
        image = image.convert("RGBA")

    bbox = image.getchannel("A").getbbox()
    return image.crop(bbox) if bbox else image


def _process_clothing_image(image_bytes: bytes) -> bytes:
    with Image.open(io.BytesIO(image_bytes)) as image:
        image = image.convert("RGBA")
        image.thumbnail((1280, 1280), Image.Resampling.LANCZOS)

        processed = remove(image, session=_get_rembg_session())
        if processed.mode != "RGBA":
            processed = processed.convert("RGBA")

        output = io.BytesIO()
        _trim_transparent_edges(processed).save(output, format="PNG")
        return output.getvalue()


@router.post("/image-base64")
def upload_image_base64(
    payload: Base64ImageUpload,
    user_id: str = Depends(get_current_user_id),
):
    try:
        image_bytes = base64.b64decode(payload.image_base64, validate=True)
    except (binascii.Error, ValueError) as error:
        raise HTTPException(status_code=400, detail="Geçersiz base64 verisi") from error

    if len(image_bytes) > 12_000_000:
        raise HTTPException(status_code=413, detail="Fotoğraf çok büyük (maksimum 12 MB)")

    try:
        with Image.open(io.BytesIO(image_bytes)) as image:
            source_format = (image.format or "JPEG").upper()
            image.verify()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as error:
        raise HTTPException(
            status_code=400,
            detail="Geçersiz veya desteklenmeyen fotoğraf",
        ) from error

    source_formats = {
        "JPEG": ("jpg", "image/jpeg"),
        "PNG": ("png", "image/png"),
        "WEBP": ("webp", "image/webp"),
        "GIF": ("gif", "image/gif"),
    }
    if source_format not in source_formats:
        raise HTTPException(status_code=400, detail="Desteklenmeyen fotoğraf biçimi")

    try:
        processed_bytes = _process_clothing_image(image_bytes)
        file_ext, content_type = "png", "image/png"
        background_removed = True
    except Exception:
        logger.exception("Background removal failed; storing the original photo.")
        processed_bytes = image_bytes
        file_ext, content_type = source_formats[source_format]
        background_removed = False

    object_path = f"{user_id}/{uuid.uuid4()}.{file_ext}"
    try:
        get_storage_client().storage.from_(BUCKET_NAME).upload(
            object_path,
            processed_bytes,
            {"content-type": content_type},
        )
    except Exception as error:
        logger.exception("Supabase Storage upload failed.")
        raise HTTPException(
            status_code=502,
            detail="Fotoğraf Supabase Storage'a yüklenemedi.",
        ) from error

    return {"path": object_path, "background_removed": background_removed}
