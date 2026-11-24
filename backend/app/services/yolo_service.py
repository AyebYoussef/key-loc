"""
YoloService — Classification Ultralytics YOLO sur CPU (mode mock | real).

En mode `real`, le modèle `best.pt` est chargé UNE SEULE FOIS au démarrage
de l'application via le lifespan FastAPI (et peut être rechargé à chaud via
`recharger_modele()`).
"""
from dataclasses import dataclass, field
from datetime import datetime, timezone
import io
import logging
import os
from pathlib import Path
import random
import threading
from typing import List, Optional

from PIL import Image, ImageOps

from app.core.config import settings

logger = logging.getLogger(__name__)

# Labels disponibles en mode mock (correspondent aux classe_yolo initiaux en base)
MOCK_LABELS = ["SX9", "SX10", "EU6P", "TE2", "JU3", "Y1", "RR50", "JM1", "KL5", "LI2"]


class YoloModelUnavailableError(RuntimeError):
    """Levée en mode `real` si le fichier modèle best.pt est absent ou illisible."""


@dataclass
class TopPrediction:
    classe: str
    confiance: float


@dataclass
class PredictionResult:
    classe: Optional[str]
    confiance: float
    top3: List[TopPrediction] = field(default_factory=list)


class YoloService:
    """
    Service de classification de clés par Ultralytics YOLO.

    YOLO_MODE=mock -> simulation développement
    YOLO_MODE=real -> inférence CPU sur le modèle de classification best.pt
    """

    def __init__(self):
        self._lock = threading.Lock()
        self.mode: str = (settings.YOLO_MODE or "mock").strip().lower()
        self._model = None
        self.model_loaded: bool = False
        self.load_error: Optional[str] = None
        self.classes: List[str] = []
        self.model_mtime: Optional[datetime] = None

    def resolve_model_path(self) -> Path:
        """Résout le chemin vers best.pt par rapport à CWD ou à la racine backend/."""
        raw = Path(settings.YOLO_MODEL_PATH)
        if raw.is_absolute():
            return raw
        if raw.exists():
            return raw.resolve()
        backend_root = Path(__file__).resolve().parents[2]
        return (backend_root / raw).resolve()

    def charger_modele(self) -> bool:
        """
        Initialise le service au démarrage (lifespan) sans jamais faire planter le serveur.
        En mode `mock`, aucun fichier .pt n'est chargé.
        """
        self.mode = (settings.YOLO_MODE or "mock").strip().lower()
        if self.mode != "real":
            with self._lock:
                self._model = None
                self.model_loaded = False
                self.load_error = None
                self.classes = list(MOCK_LABELS)
                self.model_mtime = None
            logger.info("[YOLO] Service démarré en mode MOCK.")
            return True

        return self._charger_poids_real()

    def _charger_poids_real(self) -> bool:
        """Charge le modèle de classification Ultralytics best.pt sur CPU."""
        model_path = self.resolve_model_path()
        if not model_path.is_file():
            msg = f"Modèle YOLO introuvable : {model_path}"
            logger.error(f"[YOLO] {msg}")
            with self._lock:
                self._model = None
                self.model_loaded = False
                self.load_error = msg
                self.classes = []
                self.model_mtime = None
            return False

        try:
            from ultralytics import YOLO

            loaded_model = YOLO(str(model_path))
            names_dict = getattr(loaded_model, "names", None) or {}
            classes = [str(names_dict[k]) for k in sorted(names_dict.keys())]
            mtime = datetime.fromtimestamp(os.path.getmtime(model_path), tz=timezone.utc)

            with self._lock:
                self._model = loaded_model
                self.model_loaded = True
                self.load_error = None
                self.classes = classes
                self.model_mtime = mtime

            logger.info(
                f"[YOLO] Modèle chargé sur CPU : {model_path} ({len(classes)} classes : {classes})"
            )
            return True

        except Exception as exc:
            msg = f"Impossible de charger le modèle YOLO ({model_path}) : {exc}"
            logger.error(f"[YOLO] {msg}", exc_info=True)
            with self._lock:
                self._model = None
                self.model_loaded = False
                self.load_error = msg
                self.classes = []
                self.model_mtime = None
            return False

    def recharger_modele(self) -> tuple[bool, str]:
        """Recharge le modèle à chaud (sans redémarrer FastAPI)."""
        self.mode = (settings.YOLO_MODE or "mock").strip().lower()
        if self.mode != "real":
            self.charger_modele()
            return True, "Mode MOCK actif : aucun fichier best.pt à recharger."

        ok = self._charger_poids_real()
        if ok:
            return True, f"Modèle YOLO rechargé avec succès ({len(self.classes)} classes)."
        return False, self.load_error or "Échec du rechargement du modèle YOLO."

    def get_classes(self) -> List[str]:
        """Retourne la liste des classes connues du modèle actif."""
        if self.mode == "real":
            return list(self.classes)
        return list(MOCK_LABELS)

    def predire(self, image_bytes: bytes) -> PredictionResult:
        """
        Prédit la classe d'une clé depuis les octets de la photo.
        Retourne PredictionResult(classe, confiance, top3).
        """
        if self.mode == "mock":
            return self._predire_mock(image_bytes)
        return self._predire_real(image_bytes)

    def _predire_mock(self, image_bytes: bytes) -> PredictionResult:
        """
        Comportement MOCK inchangé (80% succès, 10% confiance faible, 10% non détecté)
        enrichi avec un top3 cohérent.
        """
        tirage = random.random()
        if tirage < 0.80:
            echantillon = random.sample(MOCK_LABELS, k=min(3, len(MOCK_LABELS)))
            score1 = round(random.uniform(0.70, 0.99), 3)
            reste = max(0.0, 1.0 - score1)
            score2 = round(reste * 0.65, 3)
            score3 = round(reste * 0.25, 3)
            top3 = [
                TopPrediction(classe=echantillon[0], confiance=score1),
                TopPrediction(classe=echantillon[1], confiance=score2),
                TopPrediction(classe=echantillon[2], confiance=score3),
            ]
            logger.info(f"[MOCK] Détection : {echantillon[0]} @ {score1:.2%}")
            return PredictionResult(classe=echantillon[0], confiance=score1, top3=top3)

        if tirage < 0.90:
            echantillon = random.sample(MOCK_LABELS, k=min(3, len(MOCK_LABELS)))
            score1 = round(random.uniform(0.30, 0.55), 3)
            score2 = round(random.uniform(0.15, 0.29), 3)
            score3 = round(random.uniform(0.05, 0.14), 3)
            top3 = [
                TopPrediction(classe=echantillon[0], confiance=score1),
                TopPrediction(classe=echantillon[1], confiance=score2),
                TopPrediction(classe=echantillon[2], confiance=score3),
            ]
            logger.info(f"[MOCK] Confiance trop faible : {echantillon[0]} @ {score1:.2%}")
            return PredictionResult(classe=echantillon[0], confiance=score1, top3=top3)

        logger.info("[MOCK] Aucune clé reconnue")
        return PredictionResult(classe=None, confiance=0.0, top3=[])

    @staticmethod
    def _preparer_image_complete(image: Image.Image) -> Image.Image:
        """
        Rend l'image carrée par ajout de marges (letterbox) afin que
        le CenterCrop interne d'Ultralytics classification lise 100 % de l'image
        entière sans rogner la tête ni la lame de la clé.
        """
        w, h = image.size
        if w == h:
            return image

        import numpy as np

        arr = np.asarray(image)
        bord = np.concatenate([arr[0, :], arr[-1, :], arr[:, 0], arr[:, -1]], axis=0)
        couleur_fond = tuple(int(v) for v in np.median(bord, axis=0))

        cote = max(w, h)
        carre = Image.new("RGB", (cote, cote), couleur_fond)
        carre.paste(image, ((cote - w) // 2, (cote - h) // 2))
        return carre

    def _predire_real(self, image_bytes: bytes) -> PredictionResult:
        """Inférence Ultralytics Classification sur CPU."""
        with self._lock:
            model = self._model
            loaded = self.model_loaded
            load_error = self.load_error

        if not loaded or model is None:
            raise YoloModelUnavailableError(
                load_error or "Le modèle YOLO best.pt n'est pas chargé."
            )

        try:
            image = Image.open(io.BytesIO(image_bytes))
            image = ImageOps.exif_transpose(image).convert("RGB")
            image = self._preparer_image_complete(image)
        except Exception as exc:
            raise ValueError(f"Image illisible : {exc}") from exc

        results = model(image, device="cpu", verbose=False)
        if not results:
            return PredictionResult(classe=None, confiance=0.0, top3=[])

        res = results[0]
        probs = getattr(res, "probs", None)
        if probs is None:
            logger.error("[YOLO] Le modèle chargé ne semble pas être un modèle de classification (probs=None).")
            return PredictionResult(classe=None, confiance=0.0, top3=[])

        names = getattr(res, "names", None) or getattr(model, "names", {})
        top1_idx = int(probs.top1)
        top1_conf = round(float(probs.top1conf), 4)
        classe_top1 = str(names.get(top1_idx, top1_idx))

        # Top 3 prédictions
        top_indices = list(getattr(probs, "top5", [top1_idx]))[:3]
        top_confs = list(getattr(probs, "top5conf", [top1_conf]))[:3]
        top3 = [
            TopPrediction(
                classe=str(names.get(int(idx), int(idx))),
                confiance=round(float(conf), 4),
            )
            for idx, conf in zip(top_indices, top_confs)
        ]

        logger.info(f"[YOLO] Classification CPU : {classe_top1} @ {top1_conf:.2%} | top3={top3}")
        return PredictionResult(classe=classe_top1, confiance=top1_conf, top3=top3)


# Singleton global géré au démarrage par le lifespan FastAPI
yolo_service = YoloService()
