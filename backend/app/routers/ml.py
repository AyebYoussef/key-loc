"""
Router — Machine Learning : administration du modèle YOLO (status, reload, coherence)
et gestion du dataset d'entraînement (status, export ZIP).
"""
import json
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_gerant, get_utilisateur_courant
from app.models.casier import Ebauche
from app.schemas.casier import (
    DatasetStatusResponse,
    MlCoherenceBaseItem,
    MlCoherenceResponse,
    MlReloadResponse,
    MlStatusResponse,
)
from app.services.dataset_service import generer_zip_dataset, get_dataset_status
from app.services.yolo_service import yolo_service
from app.utils.image_utils import generer_classe_yolo

router = APIRouter()


def _build_ml_status() -> MlStatusResponse:
    classes = yolo_service.get_classes()
    return MlStatusResponse(
        mode=yolo_service.mode,
        modele_charge=yolo_service.model_loaded,
        chemin_modele=str(yolo_service.resolve_model_path()),
        erreur_chargement=yolo_service.load_error,
        classes=classes,
        nb_classes=len(classes),
        date_modele=yolo_service.model_mtime,
        seuil_confiance=settings.YOLO_CONFIDENCE_THRESHOLD,
        seuil_nettete=settings.BLUR_THRESHOLD,
    )


@router.get("/status", response_model=MlStatusResponse, summary="État du modèle YOLO (gérant)")
def ml_status(_=Depends(get_gerant)):
    """
    Retourne le mode actuel (mock/real), l'état de chargement de best.pt,
    la liste des classes du modèle, sa date de modification et les seuils.
    """
    return _build_ml_status()


@router.post("/reload", response_model=MlReloadResponse, summary="Recharger best.pt à chaud (gérant)")
def ml_reload(_=Depends(get_gerant)):
    """Recharge le fichier best.pt en mémoire sans redémarrer le serveur."""
    succes, message = yolo_service.recharger_modele()
    if not succes:
        raise HTTPException(status_code=503, detail=message)
    return MlReloadResponse(
        succes=True,
        message=message,
        status=_build_ml_status(),
    )


@router.get("/coherence", response_model=MlCoherenceResponse, summary="Cohérence entre classes du modèle YOLO et base de données (gérant)")
def ml_coherence(
    db: Session = Depends(get_db),
    _=Depends(get_gerant),
):
    """
    Compare les classes connues du modèle YOLO avec les classe_yolo de la table ebauches.
    Signale :
    - classes_modele_absentes_base : reconnues par YOLO mais absentes du stock (ebauches)
    - modeles_base_absents_modele : en stock mais absents du modèle YOLO (impossibles à reconnaître)
    """
    classes_modele = sorted(set(yolo_service.get_classes()))
    set_modele = set(classes_modele)

    ebauches = db.query(Ebauche).options(selectinload(Ebauche.modele)).all()
    classes_base_set = set()
    base_items_map = {}

    for eb in ebauches:
        classe = eb.classe_yolo or generer_classe_yolo(eb.modele.reference if eb.modele else f"ebauche_{eb.id}")
        classes_base_set.add(classe)
        if classe not in base_items_map:
            base_items_map[classe] = MlCoherenceBaseItem(
                ebauche_id=eb.id,
                reference=eb.modele.reference if eb.modele else classe,
                classe_yolo=classe,
            )

    classes_base = sorted(classes_base_set)
    classes_communes = sorted(set_modele & classes_base_set)
    absentes_base = sorted(set_modele - classes_base_set)
    absents_modele = [
        base_items_map[c] for c in sorted(classes_base_set - set_modele)
    ]

    return MlCoherenceResponse(
        mode=yolo_service.mode,
        modele_charge=yolo_service.model_loaded,
        coherent=(len(absentes_base) == 0 and len(absents_modele) == 0),
        classes_modele=classes_modele,
        classes_base=classes_base,
        classes_communes=classes_communes,
        classes_modele_absentes_base=absentes_base,
        modeles_base_absents_modele=absents_modele,
    )


@router.get("/dataset/status", response_model=DatasetStatusResponse, summary="Statut du dataset d'entraînement YOLO")
def dataset_status(
    seuil: int = Query(settings.ML_DATASET_MIN_PHOTOS, ge=1, le=1000, description="Nombre minimum de photos par classe"),
    db: Session = Depends(get_db),
    _=Depends(get_utilisateur_courant),
):
    """
    Retourne pour chaque modèle/ébauche le nombre de photos de référence
    et indique s'il atteint le seuil pour l'entraînement.
    """
    return get_dataset_status(db, seuil=seuil)


@router.get("/dataset/export", summary="Exporter le dataset au format ZIP YOLO classification (gérant)")
def dataset_export(
    seed: int = Query(42, description="Graine aléatoire fixe pour une répartition train/val reproductible"),
    train_ratio: float = Query(0.8, ge=0.5, le=0.95, description="Proportion d'images dans train/ (défaut 0.8)"),
    db: Session = Depends(get_db),
    _=Depends(get_gerant),
):
    """
    Génère et renvoie un fichier ZIP structuré pour YOLO classification :
      dataset/train/<classe_yolo>/*.jpg
      dataset/val/<classe_yolo>/*.jpg
    Les modèles ayant moins de 2 photos sont exclus et signalés dans l'en-tête X-Dataset-Excluded.
    """
    zip_bytes, summary = generer_zip_dataset(db, seed=seed, train_ratio=train_ratio)

    headers = {
        "Content-Disposition": 'attachment; filename="keylocator_yolo_dataset.zip"',
        "X-Dataset-Excluded": quote(json.dumps(summary["modeles_exclus"], ensure_ascii=False)),
        "X-Dataset-Summary": quote(json.dumps({
            "classes_incluses": summary["classes_incluses"],
            "total_images": summary["total_images"],
            "train_images": summary["train_images"],
            "val_images": summary["val_images"],
        }, ensure_ascii=False)),
    }

    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers=headers,
    )
