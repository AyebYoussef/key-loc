"""
Router — Scan : point central du flux photo -> netteté -> YOLO -> casier -> LED.

Diagramme de séquence :
  Serrurier -> Mobile / Web -> POST /api/scans/ (Backend)
    -> verifierPhoto() [netteté]
    -> yolo_service.predire()
    -> verifierModele() [ebauches.classe_yolo]
    -> led_service.allumer_casier()
    <- ScanResultat (statut, casier, ebauche, equivalences, top3)
"""
from typing import List

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_utilisateur_courant
from app.models.casier import Scan
from app.schemas.casier import ScanResultat, ScanSchema
from app.services.led_guidance import LedGuidanceService, get_led_service
from app.services.scan_service import traiter_scan_cle

router = APIRouter()


@router.post("/", response_model=ScanResultat, summary="Scanner une clé (photo -> YOLO -> casier)")
async def scanner_cle(
    photo: UploadFile = File(..., description="Photo de la clé (JPEG/PNG)"),
    db: Session = Depends(get_db),
    utilisateur=Depends(get_utilisateur_courant),
    led_service: LedGuidanceService = Depends(get_led_service),
):
    """
    Pipeline complet :
    1. Sauvegarde la photo
    2. Vérifie la netteté (variance du Laplacien >= BLUR_THRESHOLD)
    3. Prédit la classe YOLO et son top3
    4. Vérifie la correspondance dans la table ebauches (classe_yolo)
    5. Allume le guidage LED (si stock disponible) et journalise dans scans
    """
    return await traiter_scan_cle(photo=photo, db=db, utilisateur=utilisateur, led_service=led_service)


@router.get("/", response_model=List[ScanSchema], summary="Historique des scans")
def historique(
    db: Session = Depends(get_db),
    _=Depends(get_utilisateur_courant),
):
    return db.query(Scan).order_by(Scan.created_at.desc()).limit(100).all()
