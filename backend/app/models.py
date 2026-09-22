from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base

class ClothingItem(Base):
    __tablename__ = "clothing_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    color = Column(String, nullable=False)
    season = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    is_favorite = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Outfit(Base):
    __tablename__ = "outfits"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    top_id = Column(Integer, ForeignKey("clothing_items.id"), nullable=True)
    bottom_id = Column(Integer, ForeignKey("clothing_items.id"), nullable=True)
    dress_id = Column(Integer, ForeignKey("clothing_items.id"), nullable=True)
    outerwear_id = Column(Integer, ForeignKey("clothing_items.id"), nullable=True)
    shoes_id = Column(Integer, ForeignKey("clothing_items.id"), nullable=True)
    accessory_id = Column(Integer, ForeignKey("clothing_items.id"), nullable=True)
    bag_id = Column(Integer, ForeignKey("clothing_items.id"), nullable=True)
    outfit_image_url = Column(String, nullable=True)
    note = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    top = relationship("ClothingItem", foreign_keys=[top_id])
    bottom = relationship("ClothingItem", foreign_keys=[bottom_id])
    dress = relationship("ClothingItem", foreign_keys=[dress_id])
    outerwear = relationship("ClothingItem", foreign_keys=[outerwear_id])
    shoes = relationship("ClothingItem", foreign_keys=[shoes_id])
    accessory = relationship("ClothingItem", foreign_keys=[accessory_id])
    bag = relationship("ClothingItem", foreign_keys=[bag_id])


class MoodLog(Base):
    __tablename__ = "mood_logs"

    id = Column(Integer, primary_key=True, index=True)
    outfit_id = Column(Integer, ForeignKey("outfits.id"))
    mood = Column(String, nullable=False)
    ai_comment = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())