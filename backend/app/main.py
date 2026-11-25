import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from .routers import upload

app = FastAPI(title="Kombin API")

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:8081,http://localhost:8082,http://localhost:8083,http://localhost:8084,http://localhost:19006",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)

@app.get("/")
def root():
    return {"message": "Kombin API çalışıyor"}


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}

