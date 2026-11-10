"""
Router — Ébauches (CRUD gérant, lecture tous).
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.core.security import get_gerant, get_utilisateur_courant
from app.models.casier import Ebauche
from app.schemas.casier import EbaucheSchema, EbaucheCreate, EbaucheUpdate

router = APIRouter()


@router.get("/", response_model=List[EbaucheSchema], summary="Liste des ébauches")
def lister(
    modele_id: Optional[int] = Query(None),
    casier_id: Optional[int] = Query(None),
    statut: Optional[str] = Query(None, description="ok | alerte | epuise"),
    db: Session = Depends(get_db),
    _=Depends(get_utilisateur_courant),
):
    query = db.query(Ebauche)
    if modele_id:
        query = query.filter(Ebauche.modele_id == modele_id)
    if casier_id:
        query = query.filter(Ebauche.casier_id == casier_id)
    ebauches = query.all()

    if statut:
        ebauches = [e for e in ebauches if e.statut_stock == statut]
    return ebauches


@router.post("/", response_model=EbaucheSchema, status_code=201, summary="Créer une ébauche")
def creer(payload: EbaucheCreate, db: Session = Depends(get_db), _=Depends(get_gerant)):
    ebauche = Ebauche(**payload.model_dump())
    db.add(ebauche)
    db.commit()
    db.refresh(ebauche)
    return ebauche


@router.get("/{ebauche_id}", response_model=EbaucheSchema, summary="Détail d'une ébauche")
def detail(ebauche_id: int, db: Session = Depends(get_db), _=Depends(get_utilisateur_courant)):
    e = db.query(Ebauche).filter(Ebauche.id == ebauche_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Ébauche introuvable")
    return e


@router.patch("/{ebauche_id}", response_model=EbaucheSchema, summary="Modifier une ébauche")
def modifier(
    ebauche_id: int, payload: EbaucheUpdate,
    db: Session = Depends(get_db), _=Depends(get_gerant),
):
    e = db.query(Ebauche).filter(Ebauche.id == ebauche_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Ébauche introuvable")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(e, field, value)
    db.commit()
    db.refresh(e)
    return e

