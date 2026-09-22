from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..auth import get_current_user_id
from ..database import get_db


router = APIRouter(prefix="/items", tags=["items"])

@router.get("/", response_model=list[schemas.ClothingItemResponse])
def get_items(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    return db.query(models.ClothingItem).filter(models.ClothingItem.user_id == user_id).all()

@router.post("/", response_model=schemas.ClothingItemResponse)
def create_item(
    item: schemas.ClothingItemCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    db_item = models.ClothingItem(**item.dict(), user_id=user_id)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.patch("/{item_id}/favorite", response_model=schemas.ClothingItemResponse)
def set_favorite(
    item_id: int,
    payload: schemas.ClothingItemFavoriteUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    item = db.query(models.ClothingItem).filter(
        models.ClothingItem.id == item_id,
        models.ClothingItem.user_id == user_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Kıyafet bulunamadı")
    item.is_favorite = payload.is_favorite
    db.commit()
    db.refresh(item)
    return item

@router.delete("/{item_id}")
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    item = db.query(models.ClothingItem).filter(
        models.ClothingItem.id == item_id,
        models.ClothingItem.user_id == user_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Kıyafet bulunamadı")
    used_by_outfit = db.query(models.Outfit.id).filter(
        models.Outfit.user_id == user_id,
        models.Outfit.top_id == item_id,
    ).first() or db.query(models.Outfit.id).filter(
        models.Outfit.user_id == user_id,
        models.Outfit.bottom_id == item_id,
    ).first() or db.query(models.Outfit.id).filter(
        models.Outfit.user_id == user_id,
        models.Outfit.dress_id == item_id,
    ).first() or db.query(models.Outfit.id).filter(
        models.Outfit.user_id == user_id,
        models.Outfit.outerwear_id == item_id,
    ).first() or db.query(models.Outfit.id).filter(
        models.Outfit.user_id == user_id,
        models.Outfit.shoes_id == item_id,
    ).first() or db.query(models.Outfit.id).filter(
        models.Outfit.user_id == user_id,
        models.Outfit.accessory_id == item_id,
    ).first() or db.query(models.Outfit.id).filter(
        models.Outfit.user_id == user_id,
        models.Outfit.bag_id == item_id,
    ).first()
    if used_by_outfit:
        raise HTTPException(status_code=409, detail="Bu kıyafet kayıtlı kombinlerde kullanılıyor")
    db.delete(item)
    db.commit()
    return {"message": "Kıyafet silindi"}