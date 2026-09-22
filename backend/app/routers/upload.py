import os
import uuid
import base64
import io
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from PIL import Image
from rembg import remove
from supabase import create_client
from dotenv import load_dotenv
from ..auth import get_current_user_id

load_dotenv()

router = APIRouter(prefix="/upload", tags=["upload"])

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
BUCKET_NAME = "clothing-images"

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


class Base64ImageUpload(BaseModel):
    image_base64: str = Field(..., min_length=1, max_length=16_000_000)
    file_ext: str = "jpg"


def _trim_transparent_edges(image: Image.Image) -> Image.Image:
    if image.mode != "RGBA":
        image = image.convert("RGBA")

    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        return image

    return image.crop(bbox)


def _process_clothing_image(image_bytes: bytes) -> bytes:
    with Image.open(io.BytesIO(image_bytes)) as image:
        image = image.convert("RGBA")
        image.thumbnail((1280, 1280), Image.Resampling.LANCZOS)

        processed = remove(image)
        if processed.mode != "RGBA":
            processed = processed.convert("RGBA")

        cropped = _trim_transparent_edges(processed)

        output = io.BytesIO()
        cropped.save(output, format="PNG")
        return output.getvalue()


@router.post("/image-base64")
def upload_image_base64(payload: Base64ImageUpload, user_id: str = Depends(get_current_user_id)):
    try:
        image_bytes = base64.b64decode(payload.image_base64, validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail="Geçersiz base64 verisi")

    if len(image_bytes) > 12_000_000:
        raise HTTPException(status_code=413, detail="Fotoğraf çok büyük (maksimum 12 MB)")

    try:
        with Image.open(io.BytesIO(image_bytes)) as image:
            source_format = (image.format or "JPEG").upper()
            image.verify()
    except Exception:
        raise HTTPException(status_code=400, detail="Geçersiz veya desteklenmeyen fotoğraf")

    try:
        processed_bytes = _process_clothing_image(image_bytes)
        file_ext = "png"
        file_name = f"{uuid.uuid4()}.{file_ext}"
        content_type = "image/png"
    except Exception:
        processed_bytes = image_bytes
        fallback_formats = {
            "JPEG": ("jpg", "image/jpeg"),
            "PNG": ("png", "image/png"),
            "WEBP": ("webp", "image/webp"),
            "GIF": ("gif", "image/gif"),
        }
        file_ext, content_type = fallback_formats.get(source_format, ("bin", "application/octet-stream"))
        file_name = f"{uuid.uuid4()}.{file_ext}"

    try:
        supabase.storage.from_(BUCKET_NAME).upload(
            file_name,
            processed_bytes,
            {"content-type": content_type},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Yükleme hatası: {str(e)}")

    public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(file_name)

    return {"url": public_url}