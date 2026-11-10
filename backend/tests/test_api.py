"""
Tests backend — vérifie que l'API démarre et que les routes de base répondent.
Lancer : pytest backend/tests/ -v
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock


@pytest.fixture
def client():
    """Client de test avec DB mockée."""
    with patch("app.core.database.engine"), \
         patch("app.core.database.Base.metadata.create_all"):
        from app.main import app
        with TestClient(app) as c:
            yield c


def test_racine(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "KeyLocator" in response.json()["message"]


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_login_echec_sans_utilisateur(client):
    """Sans données en base, le login doit retourner 401."""
    with patch("app.routers.auth.Session") as mock_session:
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        response = client.post(
            "/api/auth/login",
            data={"username": "test@test.fr", "password": "wrongpass"},
        )
    assert response.status_code == 401

