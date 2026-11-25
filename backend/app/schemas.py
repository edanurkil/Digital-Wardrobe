from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class ClothingItemBase(BaseModel):
    name: str
    category: str
    color: str
    season: Optional[str] = None
    image_url: Optional[str] = None
    is_favorite: bool = False

class ClothingItemCreate(ClothingItemBase):
    pass

class ClothingItemResponse(ClothingItemBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class OutfitCreate(BaseModel):
    top_id: Optional[int] = None
    bottom_id: Optional[int] = None
    dress_id: Optional[int] = None
    outerwear_id: Optional[int] = None
    shoes_id: Optional[int] = None
    accessory_id: Optional[int] = None
    bag_id: Optional[int] = None
    note: Optional[str] = None

class OutfitResponse(BaseModel):
    id: int
    note: Optional[str] = None
    outfit_image_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class OutfitDetailResponse(BaseModel):
    id: int
    note: Optional[str] = None
    outfit_image_url: Optional[str] = None
    created_at: datetime
    top: Optional[ClothingItemResponse] = None
    bottom: Optional[ClothingItemResponse] = None
    dress: Optional[ClothingItemResponse] = None
    outerwear: Optional[ClothingItemResponse] = None
    shoes: Optional[ClothingItemResponse] = None
    accessory: Optional[ClothingItemResponse] = None
    bag: Optional[ClothingItemResponse] = None

    class Config:
        from_attributes = True

class OutfitImageUpdate(BaseModel):
    outfit_image_url: str

class ClothingItemFavoriteUpdate(BaseModel):
    is_favorite: bool