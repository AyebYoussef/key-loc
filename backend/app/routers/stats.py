"""
Router — Statistiques du dashboard.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone

from app.core.database import get_db
from app.core.security import get_utilisateur_courant
from app.models.casier import MouvementStock, Ebauche
from app.models.modele import ModeleCle

router = APIRouter()


class StatDashboard(BaseModel):
    total_modeles: int
    total_ebauches: int
    ebauches_en_alerte: int
    ebauches_epuisees: int
    prelevements_aujourd_hui: int
    prelevements_semaine: int
    scans_aujourd_hui: int


class TopPrelevement(BaseModel):
    modele_id: int
    reference: str
    libelle: str
    total_prelevements: int


@router.get("/dashboard", response_model=StatDashboard, summary="Statistiques globales du dashboard")
def dashboard(
    db: Session = Depends(get_db),
    _=Depends(get_utilisateur_courant),
):
    maintenant = datetime.now(timezone.utc)
    debut_jour = maintenant.replace(hour=0, minute=0, second=0, microsecond=0)
    debut_semaine = maintenant - timedelta(days=7)

    total_modeles = db.query(ModeleCle).count()
    total_ebauches = db.query(Ebauche).count()

    toutes = db.query(Ebauche).all()
    en_alerte = sum(1 for e in toutes if e.statut_stock == "alerte")
    epuisees = sum(1 for e in toutes if e.statut_stock == "epuise")

    prelevements_aujourd_hui = db.query(MouvementStock).filter(
        MouvementStock.type_mouvement == "prelevement",
        MouvementStock.created_at >= debut_jour,
    ).count()

    prelevements_semaine = db.query(MouvementStock).filter(
        MouvementStock.type_mouvement == "prelevement",
        MouvementStock.created_at >= debut_semaine,
    ).count()

    from app.models.casier import Scan
    scans_aujourd_hui = db.query(Scan).filter(Scan.created_at >= debut_jour).count()

    return StatDashboard(
        total_modeles=total_modeles,
        total_ebauches=total_ebauches,
        ebauches_en_alerte=en_alerte,
        ebauches_epuisees=epuisees,
        prelevements_aujourd_hui=prelevements_aujourd_hui,
        prelevements_semaine=prelevements_semaine,
        scans_aujourd_hui=scans_aujourd_hui,
    )


@router.get("/top-prelevements", response_model=List[TopPrelevement], summary="Top 10 ébauches les plus prélevées")
def top_prelevements(
    db: Session = Depends(get_db),
    _=Depends(get_utilisateur_courant),
):
    rows = (
        db.query(
            Ebauche.modele_id,
            ModeleCle.reference,
            ModeleCle.libelle,
            func.count(MouvementStock.id).label("total"),
        )
        .join(MouvementStock, MouvementStock.ebauche_id == Ebauche.id)
        .join(ModeleCle, ModeleCle.id == Ebauche.modele_id)
        .filter(MouvementStock.type_mouvement == "prelevement")
        .group_by(Ebauche.modele_id, ModeleCle.reference, ModeleCle.libelle)
        .order_by(func.count(MouvementStock.id).desc())
        .limit(10)
        .all()
    )
    return [
        TopPrelevement(
            modele_id=r.modele_id,
            reference=r.reference,
            libelle=r.libelle,
            total_prelevements=r.total,
        )
        for r in rows
    ]

