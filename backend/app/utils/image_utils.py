"""
Utilitaire de détection de flou dans une image (Laplacien) et normalisation YOLO.
"""
import logging
import re
import unicodedata
from typing import Optional, Tuple

from app.core.config import settings

logger = logging.getLogger(__name__)

SEUIL_LAPLACIEN = settings.BLUR_THRESHOLD  # En dessous -> image considérée floue


def calculer_laplacien_bytes(image_bytes: bytes) -> float:
    """
    Calcule la variance du Laplacien depuis les octets d'une image.
    Plus la valeur est faible, plus l'image est floue.
    """
    if not image_bytes:
        return 0.0
    try:
        import cv2
        import numpy as np

        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
        if img is None:
            raise ValueError("Impossible de décoder l'image depuis les octets fournis")

        # Normaliser les grandes photos (ex: 12MP téléphone) à 640px max
        # afin que la variance du Laplacien ne soit pas artificiellement écrasée
        h, w = img.shape[:2]
        max_side = max(h, w)
        if max_side > 640:
            scale = 640.0 / max_side
            img = cv2.resize(
                img,
                (max(1, int(w * scale)), max(1, int(h * scale))),
                interpolation=cv2.INTER_AREA,
            )

        variance = cv2.Laplacian(img, cv2.CV_64F).var()
        return round(float(variance), 2)
    except ImportError:
        logger.warning("OpenCV non disponible — vérification de netteté désactivée")
        return 999.0
    except Exception as e:
        logger.error(f"Erreur calcul Laplacien : {e}")
        return 0.0


def est_nette(image_bytes: bytes, seuil: Optional[float] = None) -> Tuple[bool, float]:
    """
    Vérifie si une image (octets) est suffisamment nette selon BLUR_THRESHOLD.
    Retourne (est_nette: bool, score_laplacien: float).
    """
    seuil_effectif = settings.BLUR_THRESHOLD if seuil is None else seuil
    score = calculer_laplacien_bytes(image_bytes)
    return score >= seuil_effectif, score


def calculer_laplacien(image_path: str) -> float:
    """Compatibilité : calcule la variance du Laplacien depuis un chemin fichier."""
    try:
        with open(image_path, "rb") as f:
            return calculer_laplacien_bytes(f.read())
    except Exception as e:
        logger.error(f"Erreur lecture image {image_path} : {e}")
        return 0.0


def est_floue(image_path: str, seuil: Optional[float] = None) -> Tuple[bool, float]:
    """Compatibilité : retourne (est_floue: bool, score_laplacien: float)."""
    seuil_effectif = settings.BLUR_THRESHOLD if seuil is None else seuil
    score = calculer_laplacien(image_path)
    return score < seuil_effectif, score


def generer_classe_yolo(reference: str) -> str:
    """
    Normalise une référence de clé en nom de classe/dossier YOLO valide :
    sans accents, sans espaces, uniquement caractères alphanumériques, '_' ou '-'.
    Ex. 'Silca Élite 9' -> 'Silca_Elite_9', 'SX9' -> 'SX9'.
    """
    if not reference:
        return "CLASSE_INCONNUE"
    normalise = unicodedata.normalize("NFKD", reference.strip())
    sans_accents = "".join(c for c in normalise if not unicodedata.combining(c))
    nettoye = re.sub(r"[^A-Za-z0-9_-]+", "_", sans_accents)
    nettoye = re.sub(r"_+", "_", nettoye).strip("_")
    return nettoye or "CLASSE_INCONNUE"
