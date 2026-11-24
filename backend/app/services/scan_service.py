"""
Service — Orchestration du flux de scan :
  verifierPhoto -> yolo_service.predire -> verifierModele (ebauches.classe_yolo)
  -> stock / équivalences / guidage LED -> journalisation dans scans.
"""
import os
import uuid
from typing import List

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.models.casier import Ebauche, Scan
from app.models.modele import Equivalence, ModeleCle
from app.schemas.casier import ScanResultat, TopPredictionSchema
from app.services.led_guidance import LedGuidanceService
from app.services.yolo_service import YoloModelUnavailableError, yolo_service
from app.utils.image_utils import est_nette


async def traiter_scan_cle(
    photo: UploadFile,
    db: Session,
    utilisateur,
    led_service: LedGuidanceService,
) -> ScanResultat:
    """Exécute le pipeline complet d'identification d'une clé par photo."""
    contenu = await photo.read()
    if not contenu:
        raise HTTPException(status_code=400, detail="Le fichier photo est vide.")

    # 1. Sauvegarder la photo dans uploads/
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    nom_orig = photo.filename or "scan.jpg"
    extension = nom_orig.rsplit(".", 1)[-1].lower() if "." in nom_orig else "jpg"
    nom_fichier = f"{uuid.uuid4()}.{extension}"
    chemin = os.path.join(settings.UPLOAD_DIR, nom_fichier).replace("\\", "/")
    with open(chemin, "wb") as f:
        f.write(contenu)

    # 2. Vérification de la netteté (OpenCV variance du Laplacien)
    nette, score_nettete = est_nette(contenu)
    if not nette:
        scan = Scan(
            utilisateur_id=utilisateur.id,
            image_path=chemin,
            statut="photo_floue",
        )
        db.add(scan)
        db.commit()
        db.refresh(scan)
        return ScanResultat(
            statut="photo_floue",
            message=(
                f"L'image est trop floue (netteté {score_nettete:.1f} < {settings.BLUR_THRESHOLD:.1f}). "
                "Veuillez prendre une nouvelle photo."
            ),
            scan_id=scan.id,
        )

    # 3. Inférence YOLO (mock ou real)
    try:
        prediction = yolo_service.predire(contenu)
    except YoloModelUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Reconnaissance IA indisponible : {exc}",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    top3_schemas: List[TopPredictionSchema] = [
        TopPredictionSchema(classe=item.classe, confiance=item.confiance)
        for item in prediction.top3
    ]

    # 3a. Aucune classe ou confiance inférieure au seuil -> non_reconnue
    variantes_classe = (
        {
            prediction.classe,
            prediction.classe.replace(" ", "_"),
            prediction.classe.replace("_", " "),
            prediction.classe.replace("-", "_"),
        }
        if prediction.classe
        else set()
    )

    if prediction.classe is None or prediction.confiance < settings.YOLO_CONFIDENCE_THRESHOLD:
        eb_possible = None
        if prediction.classe:
            eb_possible = (
                db.query(Ebauche)
                .filter(Ebauche.classe_yolo.in_(variantes_classe))
                .first()
            )
        scan = Scan(
            utilisateur_id=utilisateur.id,
            image_path=chemin,
            modele_detecte_id=eb_possible.modele_id if eb_possible else None,
            score_confiance=prediction.confiance,
            statut="non_reconnue",
        )
        db.add(scan)
        db.commit()
        db.refresh(scan)
        msg = (
            f"Confiance insuffisante ({prediction.confiance:.0%} < {settings.YOLO_CONFIDENCE_THRESHOLD:.0%}). "
            "Essayez la recherche manuelle ou reprenez une photo."
            if prediction.classe
            else "Clé non reconnue. Vérifiez l'éclairage et reprenez une photo."
        )
        return ScanResultat(
            statut="non_reconnue",
            message=msg,
            score_confiance=prediction.confiance,
            top3=top3_schemas,
            scan_id=scan.id,
        )

    # 4. Vérification du modèle en base via ebauches.classe_yolo
    ebauches_candidates = (
        db.query(Ebauche)
        .options(
            selectinload(Ebauche.modele).selectinload(ModeleCle.fabricant),
            selectinload(Ebauche.casier),
            selectinload(Ebauche.photos),
        )
        .filter(Ebauche.classe_yolo.in_(variantes_classe))
        .all()
    )

    if not ebauches_candidates:
        scan = Scan(
            utilisateur_id=utilisateur.id,
            image_path=chemin,
            score_confiance=prediction.confiance,
            statut="modele_inexistant",
        )
        db.add(scan)
        db.commit()
        db.refresh(scan)
        return ScanResultat(
            statut="modele_inexistant",
            message=f"Classe '{prediction.classe}' non référencée dans le stock (table ebauches).",
            score_confiance=prediction.confiance,
            top3=top3_schemas,
            scan_id=scan.id,
        )

    # Privilégier un casier ayant du stock disponible s'il y en a plusieurs
    ebauche = next(
        (e for e in ebauches_candidates if e.quantite > e.quantite_min),
        ebauches_candidates[0],
    )
    modele = ebauche.modele

    # Équivalences du modèle
    equivs_modeles = (
        db.query(Equivalence)
        .filter(Equivalence.modele_source_id == modele.id)
        .all()
    )
    equivalences = [e.modele_equiv for e in equivs_modeles]

    # Stock épuisé -> statut ok avec message et équivalences
    if ebauche.quantite <= ebauche.quantite_min:
        scan = Scan(
            utilisateur_id=utilisateur.id,
            image_path=chemin,
            modele_detecte_id=modele.id,
            score_confiance=prediction.confiance,
            statut="ok",
            ebauche_id=ebauche.id,
            guidage_active=False,
        )
        db.add(scan)
        db.commit()
        db.refresh(scan)
        return ScanResultat(
            statut="ok",
            message=f"Modèle {modele.reference} reconnu, mais stock épuisé dans le casier {ebauche.casier.code}. Équivalences proposées.",
            modele=modele,
            score_confiance=prediction.confiance,
            top3=top3_schemas,
            ebauche=ebauche,
            casier=ebauche.casier,
            equivalences=equivalences,
            scan_id=scan.id,
        )

    # 5. Allumer le guidage LED du casier
    led_service.allumer_casier(ebauche.casier_id, settings.LED_DUREE_SECONDES, db)
    db.refresh(ebauche.casier)

    # 6. Journaliser le scan dans scans
    scan = Scan(
        utilisateur_id=utilisateur.id,
        image_path=chemin,
        modele_detecte_id=modele.id,
        score_confiance=prediction.confiance,
        statut="ok",
        ebauche_id=ebauche.id,
        guidage_active=True,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    return ScanResultat(
        statut="ok",
        message=f"Modèle {modele.reference} localisé — casier {ebauche.casier.code} allumé pendant {settings.LED_DUREE_SECONDES} s.",
        modele=modele,
        score_confiance=prediction.confiance,
        top3=top3_schemas,
        ebauche=ebauche,
        casier=ebauche.casier,
        equivalences=equivalences,
        scan_id=scan.id,
    )

