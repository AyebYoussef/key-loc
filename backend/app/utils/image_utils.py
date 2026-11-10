"""
Utilitaire de détection de flou dans une image (Laplacien).
"""
import logging
from typing import Tuple

logger = logging.getLogger(__name__)

SEUIL_LAPLACIEN = 100.0  # En dessous → image considérée floue


def calculer_laplacien(image_path: str) -> float:
    """
    Calcule la variance du Laplacien d'une image.
    Plus la valeur est faible, plus l'image est floue.
    """
    try:
        import cv2
        img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            raise ValueError(f"Impossible de lire l'image : {image_path}")
        variance = cv2.Laplacian(img, cv2.CV_64F).var()
        return float(variance)
    except ImportError:
        logger.warning("OpenCV non disponible — vérification de flou désactivée")
        return 999.0  # On ne bloque pas si OpenCV est absent
    except Exception as e:
        logger.error(f"Erreur calcul Laplacien : {e}")
        return 999.0


def est_floue(image_path: str, seuil: float = SEUIL_LAPLACIEN) -> Tuple[bool, float]:
    """
    Retourne (est_floue: bool, score_laplacien: float).
    """
    score = calculer_laplacien(image_path)
    return score < seuil, score

