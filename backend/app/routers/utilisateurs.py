"""
Router — Gestion des utilisateurs (admin gérant).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.security import get_gerant, hacher_mot_de_passe
from app.models.utilisateur import Utilisateur
from app.schemas.utilisateur import UtilisateurPublic, UtilisateurCreate, UtilisateurUpdate

router = APIRouter()


@router.get("/", response_model=List[UtilisateurPublic], summary="Liste des utilisateurs")
def lister(db: Session = Depends(get_db), _=Depends(get_gerant)):
    return db.query(Utilisateur).all()


@router.post("/", response_model=UtilisateurPublic, status_code=201, summary="Créer un utilisateur")
def creer(payload: UtilisateurCreate, db: Session = Depends(get_db), _=Depends(get_gerant)):
    if db.query(Utilisateur).filter(Utilisateur.email == payload.email).first():
        raise HTTPException(status_code=409, detail="Email déjà utilisé")
    user = Utilisateur(
        nom=payload.nom,
        prenom=payload.prenom,
        email=payload.email,
        mot_de_passe=hacher_mot_de_passe(payload.mot_de_passe),
        role_id=payload.role_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/{user_id}", response_model=UtilisateurPublic, summary="Détail utilisateur")
def detail(user_id: int, db: Session = Depends(get_db), _=Depends(get_gerant)):
    user = db.query(Utilisateur).filter(Utilisateur.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    return user


@router.patch("/{user_id}", response_model=UtilisateurPublic, summary="Modifier un utilisateur")
def modifier(
    user_id: int,
    payload: UtilisateurUpdate,
    db: Session = Depends(get_db),
    _=Depends(get_gerant),
):
    user = db.query(Utilisateur).filter(Utilisateur.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204, summary="Désactiver un utilisateur")
def desactiver(user_id: int, db: Session = Depends(get_db), _=Depends(get_gerant)):
    user = db.query(Utilisateur).filter(Utilisateur.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    user.actif = False
    db.commit()

