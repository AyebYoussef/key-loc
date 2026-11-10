"""
YoloService — Mode MOCK (V1) et Mode INFERENCE (branché en étape 4).
"""
import os
import logging
from typing import Optional, Tuple
import random

from app.core.config import settings

logger = logging.getLogger(__name__)

# Labels disponibles en mode mock (doivent correspondre aux yolo_label en base)
MOCK_LABELS = ["SX9", "SX10", "EU6P", "TE2", "JU3", "Y1", "RR50", "JM1", "KL5", "LI2"]


class YoloService:
    """
    Service de reconnaissance de clés par YOLO.

    YOLO_MODE=mock       → retourne un label aléatoire avec un score fixe (dev)
    YOLO_MODE=inference  → utilise le modèle best.pt entraîné (étape 4)
    """

    def __init__(self):
        self.mode = settings.YOLO_MODE
        self.seuil = settings.YOLO_SEUIL_CONFIANCE
        self._model = None

        if self.mode == "inference":
            self._charger_modele()

    def _charger_modele(self):
        """Charge le modèle YOLO (uniquement en mode inference)."""
        try:
            from ultralytics import YOLO
            if not os.path.exists(settings.YOLO_MODEL_PATH):
                logger.error(f"Modèle YOLO introuvable : {settings.YOLO_MODEL_PATH}")
                logger.warning("Basculement automatique en mode MOCK")
                self.mode = "mock"
                return
            self._model = YOLO(settings.YOLO_MODEL_PATH)
            logger.info(f"Modèle YOLO chargé : {settings.YOLO_MODEL_PATH}")
        except ImportError:
            logger.error("Ultralytics non installé — basculement en mode MOCK")
            self.mode = "mock"

    def predire(self, image_path: str) -> Tuple[Optional[str], float]:
        """
        Retourne (label_detecte, score_confiance).
        Retourne (None, 0.0) si rien n'est détecté au-dessus du seuil.
        """
        if self.mode == "mock":
            return self._predire_mock(image_path)
        return self._predire_inference(image_path)

    def _predire_mock(self, image_path: str) -> Tuple[Optional[str], float]:
        """
        Mode développement : simule une détection.
        - 80 % de chance de succès avec score entre 0.70 et 0.99
        - 10 % de chance d'échec de confiance (score < seuil)
        - 10 % de chance d'aucune détection
        """
        tirage = random.random()
        if tirage < 0.80:
            label = random.choice(MOCK_LABELS)
            score = round(random.uniform(0.70, 0.99), 3)
            logger.info(f"[MOCK] Détection : {label} @ {score:.2%}")
            return label, score
        elif tirage < 0.90:
            label = random.choice(MOCK_LABELS)
            score = round(random.uniform(0.30, 0.59), 3)
            logger.info(f"[MOCK] Confiance trop faible : {label} @ {score:.2%}")
            return label, score
        else:
            logger.info("[MOCK] Aucune clé détectée")
            return None, 0.0

    def _predire_inference(self, image_path: str) -> Tuple[Optional[str], float]:
        """Mode production : inférence YOLO réelle."""
        if self._model is None:
            return self._predire_mock(image_path)

        try:
            results = self._model.predict(
                source=image_path,
                conf=self.seuil,
                verbose=False,
            )
            if not results or len(results[0].boxes) == 0:
                return None, 0.0

            # Meilleure détection (score le plus élevé)
            boxes = results[0].boxes
            scores = boxes.conf.tolist()
            classes = boxes.cls.tolist()
            best_idx = scores.index(max(scores))
            best_score = round(scores[best_idx], 3)
            best_class_idx = int(classes[best_idx])
            best_label = results[0].names[best_class_idx]

            logger.info(f"[YOLO] Détection : {best_label} @ {best_score:.2%}")
            return best_label, best_score

        except Exception as e:
            logger.error(f"Erreur inférence YOLO : {e}")
            return None, 0.0


# Singleton chargé une seule fois au démarrage
yolo_service = YoloService()

