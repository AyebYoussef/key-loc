"""
Router — Alertes de stock (ébauches en alerte ou épuisées).
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.security import get_utilisateur_courant
from app.models.casier import Ebauche
from app.schemas.casier import EbaucheSchema

router = APIRouter()


@router.get("/", response_model=List[EbaucheSchema], summary="Ébauches en alerte ou épuisées")
def get_alertes(
    db: Session = Depends(get_db),
    _=Depends(get_utilisateur_courant),
):
    """
    Retourne toutes les ébauches dont le stock est en alerte (quantite <= seuil_alerte)
    ou épuisé (quantite <= quantite_min).
    Triées par quantité croissante (plus urgentes en premier).
    """
    ebauches = db.query(Ebauche).all()
    en_alerte = [e for e in ebauches if e.statut_stock in ("alerte", "epuise")]
    en_alerte.sort(key=lambda e: e.quantite)
    return en_alerte

