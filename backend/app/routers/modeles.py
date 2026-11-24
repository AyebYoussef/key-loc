"""
Router — Modèles de clés + équivalences (CRUD gérant, lecture tous).
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.core.security import get_gerant, get_utilisateur_courant
from app.models.modele import ModeleCle, Equivalence
from app.schemas.modele import (
    ModeleSchema, ModeleCreate, ModeleUpdate,
    ModeleAvecEquivalences, EquivalenceCreate, EquivalenceSchema,
)

router = APIRouter()


@router.get("/", response_model=List[ModeleSchema], summary="Liste des modèles de clés")
def lister(
    q: Optional[str] = Query(None, description="Recherche dans référence ou libellé"),
    fabricant_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(get_utilisateur_courant),
):
    query = db.query(ModeleCle)
    if q:
        filtre = f"%{q}%"
        query = query.filter(
            (ModeleCle.reference.ilike(filtre)) | (ModeleCle.libelle.ilike(filtre))
        )
    if fabricant_id:
        query = query.filter(ModeleCle.fabricant_id == fabricant_id)
    return query.all()


@router.post("/", response_model=ModeleSchema, status_code=201, summary="Créer un modèle")
def creer(payload: ModeleCreate, db: Session = Depends(get_db), _=Depends(get_utilisateur_courant)):
    if db.query(ModeleCle).filter(ModeleCle.reference == payload.reference).first():
        raise HTTPException(status_code=409, detail="Référence déjà existante")
    modele = ModeleCle(**payload.model_dump())
    db.add(modele)
    db.commit()
    db.refresh(modele)
    return modele


@router.get("/{modele_id}", response_model=ModeleAvecEquivalences, summary="Détail + équivalences")
def detail(modele_id: int, db: Session = Depends(get_db), _=Depends(get_utilisateur_courant)):
    modele = db.query(ModeleCle).filter(ModeleCle.id == modele_id).first()
    if not modele:
        raise HTTPException(status_code=404, detail="Modèle introuvable")

    # Construire la liste d'équivalences
    equivs = db.query(Equivalence).filter(Equivalence.modele_source_id == modele_id).all()
    result = ModeleAvecEquivalences.model_validate(modele)
    result.equivalences = [ModeleSchema.model_validate(e.modele_equiv) for e in equivs]
    return result


@router.patch("/{modele_id}", response_model=ModeleSchema, summary="Modifier un modèle")
def modifier(
    modele_id: int, payload: ModeleUpdate,
    db: Session = Depends(get_db), _=Depends(get_gerant),
):
    modele = db.query(ModeleCle).filter(ModeleCle.id == modele_id).first()
    if not modele:
        raise HTTPException(status_code=404, detail="Modèle introuvable")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(modele, field, value)
    db.commit()
    db.refresh(modele)
    return modele


@router.delete("/{modele_id}", status_code=204, summary="Supprimer un modèle")
def supprimer(modele_id: int, db: Session = Depends(get_db), _=Depends(get_gerant)):
    modele = db.query(ModeleCle).filter(ModeleCle.id == modele_id).first()
    if not modele:
        raise HTTPException(status_code=404, detail="Modèle introuvable")
    db.delete(modele)
    db.commit()


# ── Équivalences ──────────────────────────────────────────────────────────────

@router.post("/{modele_id}/equivalences", response_model=EquivalenceSchema, status_code=201)
def ajouter_equivalence(
    modele_id: int, payload: EquivalenceCreate,
    db: Session = Depends(get_db), _=Depends(get_gerant),
):
    if payload.modele_source_id != modele_id:
        raise HTTPException(status_code=400, detail="modele_source_id ne correspond pas à l'URL")
    if payload.modele_source_id == payload.modele_equiv_id:
        raise HTTPException(status_code=400, detail="Un modèle ne peut pas être son propre équivalent")
    eq = Equivalence(**payload.model_dump())
    db.add(eq)
    db.commit()
    db.refresh(eq)
    return eq


@router.delete("/{modele_id}/equivalences/{equiv_id}", status_code=204)
def supprimer_equivalence(
    modele_id: int, equiv_id: int,
    db: Session = Depends(get_db), _=Depends(get_gerant),
):
    eq = db.query(Equivalence).filter(
        Equivalence.id == equiv_id,
        Equivalence.modele_source_id == modele_id,
    ).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Équivalence introuvable")
    db.delete(eq)
    db.commit()

