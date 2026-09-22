"""
Migration script to add outfit_image_url column to outfits table
"""
from sqlalchemy import text
from app.database import engine

def migrate():
    with engine.connect() as connection:
        try:
            # Check if column already exists
            result = connection.execute(
                text("""
                SELECT column_name FROM information_schema.columns 
                WHERE table_name='outfits' AND column_name='outfit_image_url'
                """)
            )
            
            if result.fetchone():
                print("✓ outfit_image_url column already exists!")
                return
            
            # Add the column if it doesn't exist
            connection.execute(
                text("ALTER TABLE outfits ADD COLUMN outfit_image_url VARCHAR")
            )
            connection.commit()
            print("✓ Successfully added outfit_image_url column to outfits table!")
            
        except Exception as e:
            print(f"✗ Migration failed: {e}")
            connection.rollback()

if __name__ == "__main__":
    migrate()
