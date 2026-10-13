from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .miembros import router as miembros_router

app = FastAPI(title="microApp Implementaciones")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(miembros_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
