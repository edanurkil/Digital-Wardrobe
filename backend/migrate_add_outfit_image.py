from sqlalchemy import inspect, text
from app.database import engine


def migrate():
    columns = {column["name"] for column in inspect(engine).get_columns("outfits")}
    if "outfit_image_url" in columns:
        print("outfit_image_url column already exists")
        return

    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE outfits ADD COLUMN outfit_image_url VARCHAR")
        )
    print("Added outfit_image_url column")

if __name__ == "__main__":
    migrate()
