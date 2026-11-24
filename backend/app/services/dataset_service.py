"""
Service — Gestion des photos de référence et export du dataset YOLO Classification.
"""
import io
import os
import random
import uuid
import zipfile
from typing import Dict, List, Tuple

from fastapi import HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.models.casier import Ebauche, EbauchePhoto
from app.schemas.casier import DatasetModeleStatus, DatasetStatusResponse
from app.utils.image_utils import generer_classe_yolo

EXTENSIONS_AUTORISEES = {"jpg", "jpeg", "png", "webp"}
MIME_TYPES_AUTORISES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
SOURCES_AUTORISEES = {"catalogue", "telephone", "scan_confirme"}


def assurer_classe_yolo(ebauche: Ebauche, db: Session) -> str:
    """Garantit que l'ébauche dispose d'un nom de classe YOLO valide et normalisé."""
    if ebauche.classe_yolo and ebauche.classe_yolo.strip():
        return ebauche.classe_yolo.strip()

    source_ref = (
        ebauche.modele.yolo_label
        if ebauche.modele and ebauche.modele.yolo_label
        else (ebauche.modele.reference if ebauche.modele else f"ebauche_{ebauche.id}")
    )
    classe = generer_classe_yolo(source_ref)
    ebauche.classe_yolo = classe
    if ebauche.modele and not ebauche.modele.yolo_label:
        ebauche.modele.yolo_label = classe
    db.commit()
    db.refresh(ebauche)
    return classe


async def sauvegarder_photos_ebauche(
    ebauche: Ebauche,
    fichiers: List[UploadFile],
    source: str,
    db: Session,
) -> List[EbauchePhoto]:
    """
    Valide, renomme avec UUID et sauvegarde plusieurs photos sur disque + BDD.
    """
    if source not in SOURCES_AUTORISEES:
        raise HTTPException(
            status_code=400,
            detail=f"Source invalide '{source}'. Valeurs autorisées : {', '.join(sorted(SOURCES_AUTORISEES))}",
        )

    if not fichiers:
        raise HTTPException(status_code=400, detail="Aucune photo fournie.")

    classe_yolo = assurer_classe_yolo(ebauche, db)
    dossier_cible = os.path.join(settings.UPLOAD_DIR, "ebauches", classe_yolo)
    os.makedirs(dossier_cible, exist_ok=True)

    chemins_crees: List[str] = []
    photos_creees: List[EbauchePhoto] = []

    try:
        for fichier in fichiers:
            nom_orig = fichier.filename or "image.jpg"
            ext = nom_orig.rsplit(".", 1)[-1].lower() if "." in nom_orig else ""
            if ext not in EXTENSIONS_AUTORISEES:
                raise HTTPException(
                    status_code=400,
                    detail=f"Format non supporté pour '{nom_orig}'. Extensions autorisées : jpg, jpeg, png, webp.",
                )

            if fichier.content_type and fichier.content_type.lower() not in MIME_TYPES_AUTORISES:
                raise HTTPException(
                    status_code=400,
                    detail=f"Type MIME invalide ({fichier.content_type}) pour '{nom_orig}'.",
                )

            contenu = await fichier.read()
            if not contenu:
                raise HTTPException(status_code=400, detail=f"Le fichier '{nom_orig}' est vide.")

            if len(contenu) > settings.MAX_PHOTO_SIZE_BYTES:
                max_mo = settings.MAX_PHOTO_SIZE_BYTES // (1024 * 1024)
                raise HTTPException(
                    status_code=400,
                    detail=f"Le fichier '{nom_orig}' dépasse la taille maximale autorisée ({max_mo} Mo).",
                )

            # Validation réelle de l'image via Pillow
            try:
                with Image.open(io.BytesIO(contenu)) as img:
                    img.verify()
            except (UnidentifiedImageError, Exception):
                raise HTTPException(
                    status_code=400,
                    detail=f"Le fichier '{nom_orig}' n'est pas une image valide ou est corrompu.",
                )

            nom_unique = f"{uuid.uuid4().hex}.{ext}"
            chemin_disque = os.path.join(dossier_cible, nom_unique)
            with open(chemin_disque, "wb") as f:
                f.write(contenu)
            chemins_crees.append(chemin_disque)

            chemin_relatif = f"{settings.UPLOAD_DIR}/ebauches/{classe_yolo}/{nom_unique}".replace("\\", "/")
            photo = EbauchePhoto(
                ebauche_id=ebauche.id,
                chemin_fichier=chemin_relatif,
                source=source,
            )
            db.add(photo)
            photos_creees.append(photo)

        db.commit()
        for photo in photos_creees:
            db.refresh(photo)
        return photos_creees

    except HTTPException:
        db.rollback()
        for p in chemins_crees:
            if os.path.exists(p):
                os.remove(p)
        raise
    except Exception as exc:
        db.rollback()
        for p in chemins_crees:
            if os.path.exists(p):
                os.remove(p)
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'enregistrement des photos : {exc}")


def supprimer_photo_ebauche(photo_id: int, db: Session) -> int:
    """Supprime la photo du disque et de la base de données."""
    photo = db.query(EbauchePhoto).filter(EbauchePhoto.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo introuvable")

    chemin_disque = os.path.normpath(photo.chemin_fichier)
    ebauche_id = photo.ebauche_id

    db.delete(photo)
    db.commit()

    if os.path.exists(chemin_disque):
        try:
            os.remove(chemin_disque)
        except OSError:
            pass

    return ebauche_id


def get_dataset_status(db: Session, seuil: int) -> DatasetStatusResponse:
    """Retourne le statut du dataset pour chaque modèle/ébauche en stock."""
    ebauches = (
        db.query(Ebauche)
        .options(selectinload(Ebauche.modele), selectinload(Ebauche.photos))
        .all()
    )

    items: List[DatasetModeleStatus] = []
    total_photos = 0
    modeles_prets = 0

    for eb in ebauches:
        classe = eb.classe_yolo or generer_classe_yolo(eb.modele.reference if eb.modele else f"ebauche_{eb.id}")
        nb = len(eb.photos) if eb.photos else 0
        total_photos += nb
        pret = nb >= seuil
        if pret:
            modeles_prets += 1

        items.append(
            DatasetModeleStatus(
                ebauche_id=eb.id,
                modele_id=eb.modele_id,
                reference=eb.modele.reference if eb.modele else classe,
                libelle=eb.modele.libelle if eb.modele else "",
                classe_yolo=classe,
                nb_photos=nb,
                seuil_requis=seuil,
                pret=pret,
                manquantes=max(0, seuil - nb),
            )
        )

    return DatasetStatusResponse(
        seuil_requis=seuil,
        total_modeles=len(items),
        modeles_prets=modeles_prets,
        total_photos=total_photos,
        modeles=items,
    )


def _lire_bytes_jpg(chemin_disque: str) -> bytes:
    """Lit une image et la convertit en JPEG si besoin pour l'export YOLO classification."""
    ext = os.path.splitext(chemin_disque)[1].lower()
    if ext in {".jpg", ".jpeg"}:
        with open(chemin_disque, "rb") as f:
            return f.read()

    with Image.open(chemin_disque) as img:
        rgb = img.convert("RGB")
        buf = io.BytesIO()
        rgb.save(buf, format="JPEG", quality=92)
        return buf.getvalue()


def generer_zip_dataset(
    db: Session,
    seed: int = 42,
    train_ratio: float = 0.8,
) -> Tuple[bytes, dict]:
    """
    Génère une archive ZIP au format YOLO classification :
      dataset/train/<classe_yolo>/*.jpg
      dataset/val/<classe_yolo>/*.jpg
    Exclut les classes ayant moins de 2 photos et les signale dans le résumé.
    """
    ebauches = (
        db.query(Ebauche)
        .options(selectinload(Ebauche.modele), selectinload(Ebauche.photos))
        .all()
    )

    # Regrouper par classe_yolo (gère proprement plusieurs ébauches partageant un modèle)
    classes_map: Dict[str, dict] = {}
    for eb in ebauches:
        classe = eb.classe_yolo or generer_classe_yolo(eb.modele.reference if eb.modele else f"ebauche_{eb.id}")
        ref = eb.modele.reference if eb.modele else classe
        if classe not in classes_map:
            classes_map[classe] = {
                "reference": ref,
                "classe_yolo": classe,
                "photos": [],
            }
        for photo in (eb.photos or []):
            chemin_disque = os.path.normpath(photo.chemin_fichier)
            if os.path.exists(chemin_disque):
                classes_map[classe]["photos"].append((photo.id, chemin_disque))

    modeles_exclus = []
    classes_incluses = []
    train_total = 0
    val_total = 0

    zip_buffer = io.BytesIO()
    rng = random.Random(seed)

    with zipfile.ZipFile(zip_buffer, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for classe in sorted(classes_map.keys()):
            info = classes_map[classe]
            photos = sorted(info["photos"], key=lambda item: item[0])
            nb = len(photos)

            if nb < 2:
                modeles_exclus.append({
                    "reference": info["reference"],
                    "classe_yolo": classe,
                    "nb_photos": nb,
                    "raison": f"{nb} photo(s) disponible(s) — minimum 2 requises",
                })
                continue

            # Mélange aléatoire reproductible (graine fixe)
            photos_melangees = list(photos)
            rng.shuffle(photos_melangees)

            val_count = max(1, round(nb * (1.0 - train_ratio)))
            val_count = min(val_count, nb - 1)  # Garantit au moins 1 image en train et 1 en val
            split_idx = nb - val_count

            train_photos = photos_melangees[:split_idx]
            val_photos = photos_melangees[split_idx:]

            for photo_id, chemin_disque in train_photos:
                stem = os.path.splitext(os.path.basename(chemin_disque))[0]
                arcname = f"dataset/train/{classe}/{stem}.jpg"
                zf.writestr(arcname, _lire_bytes_jpg(chemin_disque))
                train_total += 1

            for photo_id, chemin_disque in val_photos:
                stem = os.path.splitext(os.path.basename(chemin_disque))[0]
                arcname = f"dataset/val/{classe}/{stem}.jpg"
                zf.writestr(arcname, _lire_bytes_jpg(chemin_disque))
                val_total += 1

            classes_incluses.append({
                "reference": info["reference"],
                "classe_yolo": classe,
                "train": len(train_photos),
                "val": len(val_photos),
                "total": nb,
            })

    if not classes_incluses:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Aucune classe ne possède au moins 2 photos valides pour l'export YOLO.",
                "modeles_exclus": modeles_exclus,
            },
        )

    summary = {
        "seed": seed,
        "train_ratio": train_ratio,
        "classes_incluses": len(classes_incluses),
        "total_images": train_total + val_total,
        "train_images": train_total,
        "val_images": val_total,
        "modeles_exclus": modeles_exclus,
    }
    return zip_buffer.getvalue(), summary

