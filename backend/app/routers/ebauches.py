"""
Router — Ébauches (CRUD stock, affectation casiers et photos de référence ML).
"""
import os
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.security import get_gerant, get_utilisateur_courant
from app.models.casier import Casier, Ebauche, EbauchePhoto
from app.models.modele import ModeleCle
from app.schemas.casier import (
    EbaucheCreate,
    EbauchePhotoSchema,
    EbauchePhotosUploadResponse,
    EbaucheSchema,
    EbaucheUpdate,
)
from app.services.dataset_service import (
    assurer_classe_yolo,
    sauvegarder_photos_ebauche,
    supprimer_photo_ebauche,
)
from app.utils.image_utils import generer_classe_yolo

router = APIRouter()


@router.get("/", response_model=List[EbaucheSchema], summary="Liste des ébauches")
def lister(
    modele_id: Optional[int] = Query(None),
    casier_id: Optional[int] = Query(None),
    statut: Optional[str] = Query(None, description="ok | alerte | epuise"),
    db: Session = Depends(get_db),
    _=Depends(get_utilisateur_courant),
):
    query = db.query(Ebauche).options(
        selectinload(Ebauche.photos),
        selectinload(Ebauche.modele).selectinload(ModeleCle.fabricant),
        selectinload(Ebauche.casier),
    )
    if modele_id:
        query = query.filter(Ebauche.modele_id == modele_id)
    if casier_id:
        query = query.filter(Ebauche.casier_id == casier_id)
    ebauches = query.all()

    if statut:
        ebauches = [e for e in ebauches if e.statut_stock == statut]
    return ebauches


@router.post("/", response_model=EbaucheSchema, status_code=201, summary="Créer / ajouter une ébauche au stock")
def creer(payload: EbaucheCreate, db: Session = Depends(get_db), _=Depends(get_utilisateur_courant)):
    modele = db.query(ModeleCle).filter(ModeleCle.id == payload.modele_id).first()
    if not modele:
        raise HTTPException(status_code=404, detail="Modèle de clé introuvable")

    casier = db.query(Casier).filter(Casier.id == payload.casier_id).first()
    if not casier:
        raise HTTPException(status_code=404, detail="Casier introuvable")

    classe_yolo = generer_classe_yolo(modele.yolo_label or modele.reference)
    if not modele.yolo_label:
        modele.yolo_label = classe_yolo

    # Si une ébauche existe déjà pour ce modèle dans ce casier, on incrémente la quantité
    existante = (
        db.query(Ebauche)
        .options(selectinload(Ebauche.photos))
        .filter(
            Ebauche.modele_id == payload.modele_id,
            Ebauche.casier_id == payload.casier_id,
        )
        .first()
    )

    if existante:
        existante.quantite += payload.quantite
        if payload.seuil_alerte:
            existante.seuil_alerte = payload.seuil_alerte
        if not existante.classe_yolo:
            existante.classe_yolo = classe_yolo
        db.commit()
        db.refresh(existante)
        return existante

    ebauche = Ebauche(**payload.model_dump(), classe_yolo=classe_yolo)
    db.add(ebauche)
    db.commit()
    db.refresh(ebauche)
    return ebauche


# ── Photos de référence (déclarer avant /{ebauche_id} par clarté) ─────────────

@router.delete("/photos/{photo_id}", summary="Supprimer une photo de référence")
def supprimer_photo(
    photo_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_gerant),
):
    supprimer_photo_ebauche(photo_id, db)
    return {"message": "Photo supprimée avec succès", "id": photo_id}


@router.get("/{ebauche_id}/photos", response_model=List[EbauchePhotoSchema], summary="Lister les photos d'une ébauche")
def lister_photos(
    ebauche_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_utilisateur_courant),
):
    ebauche = db.query(Ebauche).filter(Ebauche.id == ebauche_id).first()
    if not ebauche:
        raise HTTPException(status_code=404, detail="Ébauche introuvable")
    return (
        db.query(EbauchePhoto)
        .filter(EbauchePhoto.ebauche_id == ebauche_id)
        .order_by(EbauchePhoto.date_ajout.desc(), EbauchePhoto.id.desc())
        .all()
    )


@router.post(
    "/{ebauche_id}/photos",
    response_model=EbauchePhotosUploadResponse,
    status_code=201,
    summary="Ajouter plusieurs photos de référence (gérant)",
)
async def ajouter_photos(
    ebauche_id: int,
    photos: List[UploadFile] = File(..., description="Photos de la clé (jpg, jpeg, png, webp, max 5 Mo)"),
    source: str = Form("catalogue"),
    db: Session = Depends(get_db),
    _=Depends(get_gerant),
):
    ebauche = (
        db.query(Ebauche)
        .options(selectinload(Ebauche.modele), selectinload(Ebauche.photos))
        .filter(Ebauche.id == ebauche_id)
        .first()
    )
    if not ebauche:
        raise HTTPException(status_code=404, detail="Ébauche introuvable")

    creees = await sauvegarder_photos_ebauche(ebauche, photos, source, db)
    classe_yolo = assurer_classe_yolo(ebauche, db)
    total = db.query(EbauchePhoto).filter(EbauchePhoto.ebauche_id == ebauche_id).count()

    return EbauchePhotosUploadResponse(
        ebauche_id=ebauche.id,
        classe_yolo=classe_yolo,
        ajoutees=len(creees),
        total_photos=total,
        photos=[EbauchePhotoSchema.model_validate(p) for p in creees],
    )


# ── CRUD unitaire Ébauche ─────────────────────────────────────────────────────

@router.get("/{ebauche_id}", response_model=EbaucheSchema, summary="Détail d'une ébauche")
def detail(ebauche_id: int, db: Session = Depends(get_db), _=Depends(get_utilisateur_courant)):
    e = (
        db.query(Ebauche)
        .options(selectinload(Ebauche.photos))
        .filter(Ebauche.id == ebauche_id)
        .first()
    )
    if not e:
        raise HTTPException(status_code=404, detail="Ébauche introuvable")
    return e


@router.patch("/{ebauche_id}", response_model=EbaucheSchema, summary="Modifier une ébauche (position casier ou quantité)")
def modifier(
    ebauche_id: int,
    payload: EbaucheUpdate,
    db: Session = Depends(get_db),
    _=Depends(get_utilisateur_courant),
):
    e = (
        db.query(Ebauche)
        .options(selectinload(Ebauche.photos))
        .filter(Ebauche.id == ebauche_id)
        .first()
    )
    if not e:
        raise HTTPException(status_code=404, detail="Ébauche introuvable")

    data = payload.model_dump(exclude_none=True)
    if "casier_id" in data:
        casier = db.query(Casier).filter(Casier.id == data["casier_id"]).first()
        if not casier:
            raise HTTPException(status_code=404, detail="Nouveau casier introuvable")

    if "modele_id" in data:
        modele = db.query(ModeleCle).filter(ModeleCle.id == data["modele_id"]).first()
        if not modele:
            raise HTTPException(status_code=404, detail="Nouveau modèle introuvable")
        e.classe_yolo = generer_classe_yolo(modele.yolo_label or modele.reference)

    for field, value in data.items():
        setattr(e, field, value)

    db.commit()
    db.refresh(e)
    return e


@router.delete("/{ebauche_id}", status_code=204, summary="Supprimer une ébauche du stock")
def supprimer(ebauche_id: int, db: Session = Depends(get_db), _=Depends(get_utilisateur_courant)):
    e = (
        db.query(Ebauche)
        .options(selectinload(Ebauche.photos))
        .filter(Ebauche.id == ebauche_id)
        .first()
    )
    if not e:
        raise HTTPException(status_code=404, detail="Ébauche introuvable")

    chemins = [os.path.normpath(p.chemin_fichier) for p in (e.photos or [])]
    db.delete(e)
    db.commit()

    for chemin in chemins:
        if os.path.exists(chemin):
            try:
                os.remove(chemin)
            except OSError:
                pass
    return None
