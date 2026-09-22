from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload
from .. import models, schemas
from ..auth import get_current_user_id
from ..database import get_db

router = APIRouter(prefix="/outfits", tags=["outfits"])

@router.get("/", response_model=list[schemas.OutfitDetailResponse])
def get_outfits(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    return (
        db.query(models.Outfit)
        .options(
            selectinload(models.Outfit.top),
            selectinload(models.Outfit.bottom),
            selectinload(models.Outfit.dress),
            selectinload(models.Outfit.outerwear),
            selectinload(models.Outfit.shoes),
            selectinload(models.Outfit.accessory),
            selectinload(models.Outfit.bag),
        )
        .filter(models.Outfit.user_id == user_id)
        .order_by(models.Outfit.created_at.desc())
        .all()
    )

@router.post("/", response_model=schemas.OutfitResponse)
def create_outfit(
    outfit: schemas.OutfitCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    item_ids = {
        item_id
        for item_id in (
            outfit.top_id,
            outfit.bottom_id,
            outfit.dress_id,
            outfit.outerwear_id,
            outfit.shoes_id,
            outfit.accessory_id,
            outfit.bag_id,
        )
        if item_id is not None
    }
    if item_ids:
        owned_item_ids = {
            item_id
            for item_id, in db.query(models.ClothingItem.id)
            .filter(
                models.ClothingItem.id.in_(item_ids),
                models.ClothingItem.user_id == user_id,
            )
            .all()
        }
        if owned_item_ids != item_ids:
            raise HTTPException(status_code=400, detail="Kombinde geçersiz bir kıyafet var")

    db_outfit = models.Outfit(**outfit.dict(), user_id=user_id)
    db.add(db_outfit)
    db.commit()
    db.refresh(db_outfit)
    return db_outfit

@router.patch("/{outfit_id}/image", response_model=schemas.OutfitResponse)
def update_outfit_image(
    outfit_id: int,
    payload: schemas.OutfitImageUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    outfit = db.query(models.Outfit).filter(
        models.Outfit.id == outfit_id,
        models.Outfit.user_id == user_id,
    ).first()
    if not outfit:
        raise HTTPException(status_code=404, detail="Kombin bulunamadı")
    outfit.outfit_image_url = payload.outfit_image_url
    db.commit()
    db.refresh(outfit)
    return outfit

@router.delete("/{outfit_id}")
def delete_outfit(
    outfit_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    outfit = db.query(models.Outfit).filter(
        models.Outfit.id == outfit_id,
        models.Outfit.user_id == user_id,
    ).first()
    if not outfit:
        raise HTTPException(status_code=404, detail="Kombin bulunamadı")
    db.delete(outfit)
    db.commit()
    return {"message": "Kombin silindi"}