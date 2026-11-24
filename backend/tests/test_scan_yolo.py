"""
Tests pytest du pipeline de scan YOLO (mocké, sans fichier best.pt requis).
Couvre :
  1. photo_floue
  2. non_reconnue (confiance trop basse)
  3. modele_inexistant (classe absente de la table ebauches)
  4. ok (scan réussi + casier + stock + équivalences + top3 + LED)
  5. mode real avec best.pt introuvable (démarrage sûr + erreur HTTP 503 propre)
  6. routes d'administration /api/ml/status et /api/ml/coherence

Lancer depuis backend/ : pytest tests/ -v
"""
from datetime import datetime, timezone
import io
import os
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from PIL import Image, ImageDraw
import pytest

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_gerant, get_utilisateur_courant
from app.main import app
from app.services.led_guidance import get_led_service
from app.services.yolo_service import (
    PredictionResult,
    TopPrediction,
    YoloModelUnavailableError,
    YoloService,
)


def _image_nette_bytes() -> bytes:
    """Génère une image JPEG très contrastée (score Laplacien élevé)."""
    img = Image.new("RGB", (240, 240), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    for x in range(0, 240, 12):
        draw.line([(x, 0), (x, 240)], fill=(0, 0, 0), width=4)
    for y in range(0, 240, 12):
        draw.line([(0, y), (240, y)], fill=(0, 0, 0), width=4)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=95)
    return buf.getvalue()


def _image_floue_bytes() -> bytes:
    """Génère une image JPEG uniforme (score Laplacien = 0, donc floue)."""
    img = Image.new("RGB", (240, 240), (140, 140, 140))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=95)
    return buf.getvalue()


class FakeQuery:
    """Simule les requêtes SQLAlchemy sur Session.query(...)."""

    def __init__(self, first_val=None, all_val=None):
        self._first = first_val
        self._all = all_val if all_val is not None else []

    def options(self, *args, **kwargs):
        return self

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self._first

    def all(self):
        return self._all


def _make_mock_db(ebauches_result=None, equivalences_result=None):
    db = MagicMock()
    ebauches_list = ebauches_result or []
    equivs_list = equivalences_result or []

    def query_side_effect(model):
        name = getattr(model, "__name__", "")
        if name == "Ebauche":
            return FakeQuery(
                first_val=ebauches_list[0] if ebauches_list else None,
                all_val=ebauches_list,
            )
        if name == "Equivalence":
            return FakeQuery(all_val=equivs_list)
        return FakeQuery()

    db.query.side_effect = query_side_effect

    def refresh_side_effect(obj):
        if getattr(obj, "id", None) is None:
            obj.id = 101

    db.refresh.side_effect = refresh_side_effect
    return db


def _make_fake_ebauche():
    now = datetime.now(timezone.utc)
    fabricant = SimpleNamespace(id=1, nom="Silca", pays="Italie", created_at=now)
    modele = SimpleNamespace(
        id=1,
        reference="SX9",
        libelle="Silca SX9 - Yale Y1",
        fabricant_id=1,
        image_reference=None,
        yolo_label="SX9",
        description="Profil standard",
        fabricant=fabricant,
        created_at=now,
        updated_at=now,
    )
    etat_led = SimpleNamespace(casier_id=1, actif=True, expire_a=now, updated_at=now)
    casier = SimpleNamespace(
        id=1,
        code="A1",
        ligne=1,
        colonne=1,
        description="Casier A1",
        led_index=0,
        esp32_id=None,
        esp32_statut="hors_ligne",
        actif=True,
        etat_led=etat_led,
        created_at=now,
    )
    return SimpleNamespace(
        id=1,
        modele_id=1,
        casier_id=1,
        classe_yolo="SX9",
        nb_photos=30,
        quantite=12,
        seuil_alerte=5,
        quantite_min=0,
        statut_stock="ok",
        modele=modele,
        casier=casier,
        created_at=now,
        updated_at=now,
    )


@pytest.fixture
def scan_env(tmp_path):
    """Fournit un client TestClient isolé avec DB, Auth, LED et dossier uploads temporaire."""
    fake_user = SimpleNamespace(id=1, nom="Dupont", prenom="Jean", role=SimpleNamespace(nom="gerant"))
    fake_led = MagicMock()

    mock_db = _make_mock_db()
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_utilisateur_courant] = lambda: fake_user
    app.dependency_overrides[get_gerant] = lambda: fake_user
    app.dependency_overrides[get_led_service] = lambda: fake_led

    old_upload_dir = settings.UPLOAD_DIR
    settings.UPLOAD_DIR = str(tmp_path)

    with patch("app.main.yolo_service.charger_modele", return_value=True):
        with TestClient(app) as client:
            yield SimpleNamespace(client=client, db=mock_db, led=fake_led, tmp_path=tmp_path)

    settings.UPLOAD_DIR = old_upload_dir
    app.dependency_overrides.clear()


def test_scan_photo_floue(scan_env):
    files = {"photo": ("floue.jpg", _image_floue_bytes(), "image/jpeg")}
    with patch("app.services.scan_service.yolo_service.predire") as mock_predire:
        resp = scan_env.client.post("/api/scans/", files=files)

    assert resp.status_code == 200
    data = resp.json()
    assert data["statut"] == "photo_floue"
    assert "floue" in data["message"].lower()
    mock_predire.assert_not_called()
    scan_env.db.add.assert_called_once()


def test_scan_confiance_trop_basse(scan_env):
    files = {"photo": ("nette.jpg", _image_nette_bytes(), "image/jpeg")}
    fake_pred = PredictionResult(
        classe="SX9",
        confiance=0.35,
        top3=[
            TopPrediction("SX9", 0.35),
            TopPrediction("Y1", 0.28),
            TopPrediction("TE2", 0.12),
        ],
    )
    with patch("app.services.scan_service.yolo_service.predire", return_value=fake_pred):
        resp = scan_env.client.post("/api/scans/", files=files)

    assert resp.status_code == 200
    data = resp.json()
    assert data["statut"] == "non_reconnue"
    assert data["score_confiance"] == pytest.approx(0.35)
    assert len(data["top3"]) == 3
    assert data["top3"][0]["classe"] == "SX9"
    scan_env.led.allumer_casier.assert_not_called()


def test_scan_classe_inexistante(scan_env):
    files = {"photo": ("nette.jpg", _image_nette_bytes(), "image/jpeg")}
    fake_pred = PredictionResult(
        classe="CLASSE_INCONNUE_XYZ",
        confiance=0.92,
        top3=[
            TopPrediction("CLASSE_INCONNUE_XYZ", 0.92),
            TopPrediction("SX9", 0.05),
            TopPrediction("Y1", 0.03),
        ],
    )
    # DB sans ébauche correspondante
    with patch("app.services.scan_service.yolo_service.predire", return_value=fake_pred):
        resp = scan_env.client.post("/api/scans/", files=files)

    assert resp.status_code == 200
    data = resp.json()
    assert data["statut"] == "modele_inexistant"
    assert data["score_confiance"] == pytest.approx(0.92)
    assert data["top3"][0]["classe"] == "CLASSE_INCONNUE_XYZ"
    scan_env.led.allumer_casier.assert_not_called()


def test_scan_reussi_ok(scan_env):
    fake_ebauche = _make_fake_ebauche()
    now = datetime.now(timezone.utc)
    fake_equiv = SimpleNamespace(
        modele_equiv=SimpleNamespace(
            id=6,
            reference="Y1",
            libelle="Yale Y1 Original",
            fabricant_id=6,
            image_reference=None,
            yolo_label="Y1",
            description="Équivalent Yale",
            fabricant=SimpleNamespace(id=6, nom="Yale", pays="USA", created_at=now),
            created_at=now,
            updated_at=now,
        )
    )
    mock_db = _make_mock_db(ebauches_result=[fake_ebauche], equivalences_result=[fake_equiv])
    app.dependency_overrides[get_db] = lambda: mock_db

    files = {"photo": ("cle_sx9.jpg", _image_nette_bytes(), "image/jpeg")}
    fake_pred = PredictionResult(
        classe="SX9",
        confiance=0.94,
        top3=[
            TopPrediction("SX9", 0.94),
            TopPrediction("Y1", 0.04),
            TopPrediction("SX10", 0.02),
        ],
    )
    with patch("app.services.scan_service.yolo_service.predire", return_value=fake_pred):
        resp = scan_env.client.post("/api/scans/", files=files)

    assert resp.status_code == 200
    data = resp.json()
    assert data["statut"] == "ok"
    assert data["score_confiance"] == pytest.approx(0.94)
    assert data["casier"]["code"] == "A1"
    assert data["ebauche"]["quantite"] == 12
    assert data["modele"]["reference"] == "SX9"
    assert len(data["equivalences"]) == 1
    assert data["equivalences"][0]["reference"] == "Y1"
    assert len(data["top3"]) == 3
    scan_env.led.allumer_casier.assert_called_once()


def test_mode_real_best_pt_introuvable_demarrage_sur_et_503(scan_env, tmp_path):
    """Si best.pt manque en mode real, le service ne plante pas au démarrage et /scans renvoie 503."""
    svc = YoloService()
    old_mode = settings.YOLO_MODE
    old_path = settings.YOLO_MODEL_PATH
    try:
        settings.YOLO_MODE = "real"
        settings.YOLO_MODEL_PATH = str(tmp_path / "absent_best.pt")
        ok = svc.charger_modele()
        assert ok is False
        assert svc.model_loaded is False
        assert "introuvable" in (svc.load_error or "").lower()

        with pytest.raises(YoloModelUnavailableError):
            svc.predire(_image_nette_bytes())
    finally:
        settings.YOLO_MODE = old_mode
        settings.YOLO_MODEL_PATH = old_path

    # Vérifier la réponse HTTP 503 propre sur /api/scans/
    files = {"photo": ("cle.jpg", _image_nette_bytes(), "image/jpeg")}
    with patch(
        "app.services.scan_service.yolo_service.predire",
        side_effect=YoloModelUnavailableError("Modèle YOLO introuvable"),
    ):
        resp = scan_env.client.post("/api/scans/", files=files)
    assert resp.status_code == 503
    assert "indisponible" in resp.json()["detail"].lower()


def test_routes_admin_ml_status_et_coherence(scan_env):
    fake_ebauche = _make_fake_ebauche()
    mock_db = _make_mock_db(ebauches_result=[fake_ebauche])
    app.dependency_overrides[get_db] = lambda: mock_db

    r_status = scan_env.client.get("/api/ml/status")
    assert r_status.status_code == 200
    assert "mode" in r_status.json()
    assert "seuil_confiance" in r_status.json()

    r_coh = scan_env.client.get("/api/ml/coherence")
    assert r_coh.status_code == 200
    coh = r_coh.json()
    assert "SX9" in coh["classes_communes"]
    assert len(coh["classes_modele_absentes_base"]) >= 1


def test_preparer_image_complete_sans_rogner():
    """Une image rectangulaire est mise au carré par padding pour lire 100 % de l'image."""
    img = Image.new("RGB", (400, 900), (180, 180, 180))
    draw = ImageDraw.Draw(img)
    # Marqueur tout en haut et tout en bas (lame de clé)
    draw.rectangle([150, 10, 250, 40], fill=(255, 0, 0))
    draw.rectangle([150, 860, 250, 890], fill=(0, 0, 255))

    carre = YoloService._preparer_image_complete(img)
    assert carre.size == (900, 900)
    # Les marqueurs haut et bas (décalés horizontalement de (900-400)//2 = 250) sont préservés
    assert carre.getpixel((250 + 200, 20))[0] > 200
    assert carre.getpixel((250 + 200, 875))[2] > 200


