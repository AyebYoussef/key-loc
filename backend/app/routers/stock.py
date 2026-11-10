"""
Router — Stock : prélèvement et réapprovisionnement.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.security import get_utilisateur_courant, get_gerant
from app.models.casier import Ebauche, MouvementStock
from app.schemas.casier import PrelevementRequest, ReapprovisionnementRequest, MouvementSchema, EbaucheSchema

router = APIRouter()


@router.post("/prelever", response_model=EbaucheSchema, summary="Prélever une ébauche (−1 en stock)")
def prelever(
    payload: PrelevementRequest,
    db: Session = Depends(get_db),
    utilisateur=Depends(get_utilisateur_courant),
):
    """
    Décrémente le stock de 1.
    Bloqué si quantite <= quantite_min (stock épuisé).
    """
    ebauche = db.query(Ebauche).filter(Ebauche.id == payload.ebauche_id).first()
    if not ebauche:
        raise HTTPException(status_code=404, detail="Ébauche introuvable")

    if ebauche.quantite <= ebauche.quantite_min:
        # Chercher des équivalences disponibles
        from app.models.modele import Equivalence
        equivs = db.query(Equivalence).filter(
            Equivalence.modele_source_id == ebauche.modele_id
        ).all()
        equivs_dispo = []
        for eq in equivs:
            eq_ebauche = db.query(Ebauche).filter(
                Ebauche.modele_id == eq.modele_equiv_id,
                Ebauche.quantite > Ebauche.quantite_min,
            ).first()
            if eq_ebauche:
                equivs_dispo.append(eq_ebauche)

        detail = "Stock épuisé — prélèvement bloqué."
        if equivs_dispo:
            refs = ", ".join(e.modele.reference for e in equivs_dispo)
            detail += f" Équivalences disponibles : {refs}"
        raise HTTPException(status_code=409, detail=detail)

    quantite_avant = ebauche.quantite
    ebauche.quantite -= 1

    mvt = MouvementStock(
        ebauche_id=ebauche.id,
        utilisateur_id=utilisateur.id,
        type_mouvement="prelevement",
        quantite=-1,
        quantite_avant=quantite_avant,
        quantite_apres=ebauche.quantite,
        commentaire=payload.commentaire,
    )
    db.add(mvt)
    db.commit()
    db.refresh(ebauche)
    return ebauche


@router.post("/reapprovisionner", response_model=EbaucheSchema, summary="Réapprovisionner une ébauche")
def reapprovisionner(
    payload: ReapprovisionnementRequest,
    db: Session = Depends(get_db),
    _=Depends(get_gerant),
):
    ebauche = db.query(Ebauche).filter(Ebauche.id == payload.ebauche_id).first()
    if not ebauche:
        raise HTTPException(status_code=404, detail="Ébauche introuvable")

    quantite_avant = ebauche.quantite
    ebauche.quantite += payload.quantite

    mvt = MouvementStock(
        ebauche_id=ebauche.id,
        utilisateur_id=1,  # gérant — récupéré via dépendance en vrai projet
        type_mouvement="reapprovisionnement",
        quantite=payload.quantite,
        quantite_avant=quantite_avant,
        quantite_apres=ebauche.quantite,
        commentaire=payload.commentaire,
    )
    db.add(mvt)
    db.commit()
    db.refresh(ebauche)
    return ebauche


@router.get("/mouvements", response_model=List[MouvementSchema], summary="Historique des mouvements")
def historique(
    db: Session = Depends(get_db),
    _=Depends(get_utilisateur_courant),
):
    return db.query(MouvementStock).order_by(MouvementStock.created_at.desc()).limit(200).all()

