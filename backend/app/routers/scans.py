"""
Router — Scan : point central du flux photo → YOLO → casier → LED.

Diagramme de séquence (MVC) :
  Serrurier → Mobile → POST /api/scans/ (Backend)
    → verifierPhoto() [netteté]
    → yolo_service.predire()
    → chercher modele + ebauche en base
    → led_service.allumer_casier()
    ← ScanResultat (casier, guidage, équivalences)
"""
import os
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_utilisateur_courant
from app.models.casier import Scan, Ebauche
from app.models.modele import ModeleCle, Equivalence
from app.schemas.casier import ScanResultat, ScanSchema
from app.schemas.modele import ModeleSchema
from app.services.led_guidance import LedGuidanceService, get_led_service
from app.services.yolo_service import yolo_service
from app.utils.image_utils import est_floue

router = APIRouter()

UPLOAD_DIR = "uploads"


@router.post("/", response_model=ScanResultat, summary="Scanner une clé (photo → YOLO → casier)")
async def scanner_cle(
    photo: UploadFile = File(..., description="Photo de la clé (JPEG/PNG)"),
    db: Session = Depends(get_db),
    utilisateur=Depends(get_utilisateur_courant),
    led_service: LedGuidanceService = Depends(get_led_service),
):
    """
    Flux complet :
    1. Enregistre la photo
    2. Vérifie la netteté (Laplacien)
    3. Prédit le label YOLO
    4. Cherche le modèle + ébauche en base
    5. Allume le guidage LED (simulé)
    6. Retourne le résultat au mobile / frontend
    """
    # 1. Sauvegarder la photo
    extension = photo.filename.rsplit(".", 1)[-1].lower() if "." in photo.filename else "jpg"
    nom_fichier = f"{uuid.uuid4()}.{extension}"
    chemin = os.path.join(UPLOAD_DIR, nom_fichier)
    with open(chemin, "wb") as f:
        contenu = await photo.read()
        f.write(contenu)

    # 2. Vérification de la netteté
    floue, score_laplacien = est_floue(chemin)
    if floue:
        scan = Scan(
            utilisateur_id=utilisateur.id,
            image_path=chemin,
            statut="photo_floue",
        )
        db.add(scan)
        db.commit()
        return ScanResultat(
            statut="photo_floue",
            message="L'image est trop floue. Veuillez prendre une nouvelle photo.",
            scan_id=scan.id,
        )

    # 3. Prédiction YOLO
    label_detecte, score_confiance = yolo_service.predire(chemin)

    # 3a. Aucune détection
    if label_detecte is None:
        scan = Scan(
            utilisateur_id=utilisateur.id,
            image_path=chemin,
            statut="echec_detection",
            score_confiance=score_confiance,
        )
        db.add(scan)
        db.commit()
        return ScanResultat(
            statut="echec_detection",
            message="Aucune clé détectée. Vérifiez la position et la luminosité.",
            scan_id=scan.id,
        )

    # 3b. Score de confiance insuffisant
    if score_confiance < settings.YOLO_SEUIL_CONFIANCE:
        modele = db.query(ModeleCle).filter(ModeleCle.yolo_label == label_detecte).first()
        scan = Scan(
            utilisateur_id=utilisateur.id,
            image_path=chemin,
            modele_detecte_id=modele.id if modele else None,
            score_confiance=score_confiance,
            statut="echec_confiance",
        )
        db.add(scan)
        db.commit()
        return ScanResultat(
            statut="echec_confiance",
            message=f"Confiance insuffisante ({score_confiance:.0%}). Essayez la recherche manuelle.",
            scan_id=scan.id,
        )

    # 4. Chercher le modèle en base
    modele = db.query(ModeleCle).filter(ModeleCle.yolo_label == label_detecte).first()
    if not modele:
        scan = Scan(
            utilisateur_id=utilisateur.id,
            image_path=chemin,
            score_confiance=score_confiance,
            statut="echec_detection",
        )
        db.add(scan)
        db.commit()
        return ScanResultat(
            statut="echec_detection",
            message=f"Modèle '{label_detecte}' non référencé dans le catalogue.",
            scan_id=scan.id,
        )

    # 4b. Chercher l'ébauche disponible
    ebauche = db.query(Ebauche).filter(
        Ebauche.modele_id == modele.id
    ).first()

    # Chercher les équivalences (toujours utile à afficher)
    equivs_modeles = db.query(Equivalence).filter(
        Equivalence.modele_source_id == modele.id
    ).all()
    equivalences = [ModeleSchema.model_validate(e.modele_equiv) for e in equivs_modeles]

    # Stock épuisé → on propose les équivalences
    if not ebauche or ebauche.quantite <= ebauche.quantite_min:
        scan = Scan(
            utilisateur_id=utilisateur.id,
            image_path=chemin,
            modele_detecte_id=modele.id,
            score_confiance=score_confiance,
            statut="succes",
            ebauche_id=ebauche.id if ebauche else None,
        )
        db.add(scan)
        db.commit()
        return ScanResultat(
            statut="succes",
            message="Stock épuisé pour ce modèle. Équivalences proposées ci-dessous.",
            modele=ModeleSchema.model_validate(modele),
            score_confiance=score_confiance,
            equivalences=equivalences,
            scan_id=scan.id,
        )

    # 5. Allumer le guidage LED (simulé en V1)
    led_service.allumer_casier(ebauche.casier_id, settings.LED_DUREE_SECONDES, db)
    db.refresh(ebauche.casier)

    # 6. Enregistrer le scan en base
    scan = Scan(
        utilisateur_id=utilisateur.id,
        image_path=chemin,
        modele_detecte_id=modele.id,
        score_confiance=score_confiance,
        statut="succes",
        ebauche_id=ebauche.id,
        guidage_active=True,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    return ScanResultat(
        statut="succes",
        message=f"Modèle {modele.reference} localisé — casier {ebauche.casier.code} allumé pendant {settings.LED_DUREE_SECONDES} s.",
        modele=ModeleSchema.model_validate(modele),
        score_confiance=score_confiance,
        ebauche=ebauche,
        casier=ebauche.casier,
        equivalences=equivalences,
        scan_id=scan.id,
    )


@router.get("/", response_model=List[ScanSchema], summary="Historique des scans")
def historique(
    db: Session = Depends(get_db),
    _=Depends(get_utilisateur_courant),
):
    return db.query(Scan).order_by(Scan.created_at.desc()).limit(100).all()

