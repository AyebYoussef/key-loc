"""
Router — Fabricants (CRUD gérant).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.security import get_gerant, get_utilisateur_courant
from app.models.modele import Fabricant
from app.schemas.modele import FabricantSchema, FabricantCreate, FabricantUpdate

router = APIRouter()


@router.get("/", response_model=List[FabricantSchema], summary="Liste des fabricants")
def lister(db: Session = Depends(get_db), _=Depends(get_utilisateur_courant)):
    return db.query(Fabricant).all()


@router.post("/", response_model=FabricantSchema, status_code=201, summary="Créer un fabricant")
def creer(payload: FabricantCreate, db: Session = Depends(get_db), _=Depends(get_gerant)):
    if db.query(Fabricant).filter(Fabricant.nom == payload.nom).first():
        raise HTTPException(status_code=409, detail="Fabricant déjà existant")
    fab = Fabricant(**payload.model_dump())
    db.add(fab)
    db.commit()
    db.refresh(fab)
    return fab


@router.get("/{fab_id}", response_model=FabricantSchema, summary="Détail fabricant")
def detail(fab_id: int, db: Session = Depends(get_db), _=Depends(get_utilisateur_courant)):
    fab = db.query(Fabricant).filter(Fabricant.id == fab_id).first()
    if not fab:
        raise HTTPException(status_code=404, detail="Fabricant introuvable")
    return fab


@router.patch("/{fab_id}", response_model=FabricantSchema, summary="Modifier un fabricant")
def modifier(fab_id: int, payload: FabricantUpdate, db: Session = Depends(get_db), _=Depends(get_gerant)):
    fab = db.query(Fabricant).filter(Fabricant.id == fab_id).first()
    if not fab:
        raise HTTPException(status_code=404, detail="Fabricant introuvable")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(fab, field, value)
    db.commit()
    db.refresh(fab)
    return fab


@router.delete("/{fab_id}", status_code=204, summary="Supprimer un fabricant")
def supprimer(fab_id: int, db: Session = Depends(get_db), _=Depends(get_gerant)):
    fab = db.query(Fabricant).filter(Fabricant.id == fab_id).first()
    if not fab:
        raise HTTPException(status_code=404, detail="Fabricant introuvable")
    db.delete(fab)
    db.commit()

