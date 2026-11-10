"""
Router — Casiers (CRUD gérant) + état LED virtuelle.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.security import get_gerant, get_utilisateur_courant
from app.models.casier import Casier
from app.schemas.casier import CasierSchema, CasierCreate, CasierUpdate, EtatLedSchema, AllumerCasierRequest
from app.services.led_guidance import LedGuidanceService, get_led_service

router = APIRouter()


@router.get("/", response_model=List[CasierSchema], summary="Liste des casiers")
def lister(db: Session = Depends(get_db), _=Depends(get_utilisateur_courant)):
    return db.query(Casier).filter(Casier.actif == True).all()


@router.post("/", response_model=CasierSchema, status_code=201, summary="Créer un casier")
def creer(payload: CasierCreate, db: Session = Depends(get_db), _=Depends(get_gerant)):
    if db.query(Casier).filter(Casier.code == payload.code).first():
        raise HTTPException(status_code=409, detail="Code casier déjà existant")
    casier = Casier(**payload.model_dump())
    db.add(casier)
    db.commit()
    db.refresh(casier)
    return casier


@router.get("/{casier_id}", response_model=CasierSchema, summary="Détail d'un casier")
def detail(casier_id: int, db: Session = Depends(get_db), _=Depends(get_utilisateur_courant)):
    casier = db.query(Casier).filter(Casier.id == casier_id).first()
    if not casier:
        raise HTTPException(status_code=404, detail="Casier introuvable")
    return casier


@router.patch("/{casier_id}", response_model=CasierSchema, summary="Modifier un casier")
def modifier(
    casier_id: int, payload: CasierUpdate,
    db: Session = Depends(get_db), _=Depends(get_gerant),
):
    casier = db.query(Casier).filter(Casier.id == casier_id).first()
    if not casier:
        raise HTTPException(status_code=404, detail="Casier introuvable")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(casier, field, value)
    db.commit()
    db.refresh(casier)
    return casier


# ── LED virtuelle ─────────────────────────────────────────────────────────────

@router.get("/{casier_id}/etat", response_model=EtatLedSchema, summary="État LED du casier")
def get_etat_led(
    casier_id: int,
    db: Session = Depends(get_db),
    led_service: LedGuidanceService = Depends(get_led_service),
    _=Depends(get_utilisateur_courant),
):
    """
    Retourne l'état de la LED (simulée en V1).
    Le frontend fait du polling sur cette route pour animer la grille de casiers.
    """
    return led_service.get_etat(casier_id, db)


@router.post("/{casier_id}/allumer", response_model=EtatLedSchema, summary="Allumer la LED du casier")
def allumer_led(
    casier_id: int,
    payload: AllumerCasierRequest,
    db: Session = Depends(get_db),
    led_service: LedGuidanceService = Depends(get_led_service),
    _=Depends(get_utilisateur_courant),
):
    casier = db.query(Casier).filter(Casier.id == casier_id).first()
    if not casier:
        raise HTTPException(status_code=404, detail="Casier introuvable")
    led_service.allumer_casier(casier_id, payload.duree_secondes, db)
    return led_service.get_etat(casier_id, db)


@router.post("/{casier_id}/eteindre", response_model=EtatLedSchema, summary="Éteindre la LED du casier")
def eteindre_led(
    casier_id: int,
    db: Session = Depends(get_db),
    led_service: LedGuidanceService = Depends(get_led_service),
    _=Depends(get_utilisateur_courant),
):
    casier = db.query(Casier).filter(Casier.id == casier_id).first()
    if not casier:
        raise HTTPException(status_code=404, detail="Casier introuvable")
    led_service.eteindre_casier(casier_id, db)
    return led_service.get_etat(casier_id, db)

