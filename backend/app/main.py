"""
KeyLocator Backend - Point d'entrée principal FastAPI
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.core.config import settings
from app.core.database import engine, Base
from app.routers import auth, utilisateurs, modeles, fabricants, casiers, ebauches, scans, stock, alertes, stats, ml
from app.services.yolo_service import yolo_service

# Création des tables si elles n'existent pas (dev only)
# En production, utiliser Alembic
Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Charge le modèle YOLO une seule fois au démarrage (si YOLO_MODE=real)."""
    yolo_service.charger_modele()
    yield


app = FastAPI(
    title="KeyLocator API",
    description="API de gestion et de localisation d'ébauches de clés pour serrurier",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://localhost:3000", "http://127.0.0.1:4200"],
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Dataset-Excluded", "X-Dataset-Summary"],
)

# ── Dossier uploads (photos de scans & dataset) ───────────────────────────────
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router,         prefix="/api/auth",        tags=["Authentification"])
app.include_router(utilisateurs.router, prefix="/api/utilisateurs", tags=["Utilisateurs"])
app.include_router(fabricants.router,   prefix="/api/fabricants",   tags=["Fabricants"])
app.include_router(modeles.router,      prefix="/api/modeles",      tags=["Modèles de clés"])
app.include_router(casiers.router,      prefix="/api/casiers",      tags=["Casiers"])
app.include_router(ebauches.router,     prefix="/api/ebauches",     tags=["Ébauches"])
app.include_router(stock.router,        prefix="/api/stock",        tags=["Stock"])
app.include_router(scans.router,        prefix="/api/scans",        tags=["Scans"])
app.include_router(alertes.router,      prefix="/api/alertes",      tags=["Alertes"])
app.include_router(stats.router,        prefix="/api/stats",        tags=["Statistiques"])
app.include_router(ml.router,           prefix="/api/ml",           tags=["Dataset ML"])


@app.get("/", tags=["Santé"])
def racine():
    return {"message": "KeyLocator API v1.0.0", "docs": "/docs"}


@app.get("/api/health", tags=["Santé"])
def health_check():
    return {"status": "ok", "version": "1.0.0", "led_mode": settings.LED_MODE}

