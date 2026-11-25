from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()

BACKEND_DIR = Path(__file__).resolve().parents[1]
DATABASE_PATH = Path(
    os.getenv("WARDROBE_DB_PATH", str(BACKEND_DIR / "data" / "wardrobe.db"))
)
if not DATABASE_PATH.is_absolute():
    DATABASE_PATH = BACKEND_DIR / DATABASE_PATH
DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    f"sqlite:///{DATABASE_PATH.as_posix()}",
    connect_args={"check_same_thread": False},
    pool_pre_ping=True,
)


@event.listens_for(engine, "connect")
def enable_sqlite_foreign_keys(connection, _):
    cursor = connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()