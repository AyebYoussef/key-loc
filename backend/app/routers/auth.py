"""
Router — Authentification (login, profil, changement de mot de passe).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    verifier_mot_de_passe, hacher_mot_de_passe,
    creer_access_token, get_utilisateur_courant,
)
from app.models.utilisateur import Utilisateur
from app.schemas.utilisateur import TokenResponse, UtilisateurPublic, ChangerMotDePasse

router = APIRouter()


@router.post("/login", response_model=TokenResponse, summary="Connexion")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    Authentifie un utilisateur (email + mot de passe) et retourne un token JWT.
    Compatible avec le formulaire OAuth2 standard (username = email).
    """
    user = db.query(Utilisateur).filter(Utilisateur.email == form_data.username).first()
    if not user or not verifier_mot_de_passe(form_data.password, user.mot_de_passe):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.actif:
        raise HTTPException(status_code=403, detail="Compte désactivé")

    token = creer_access_token(data={"sub": str(user.id)})
    return TokenResponse(access_token=token, utilisateur=UtilisateurPublic.model_validate(user))


@router.get("/me", response_model=UtilisateurPublic, summary="Profil courant")
def get_profil(utilisateur=Depends(get_utilisateur_courant)):
    return utilisateur


@router.put("/me/mot-de-passe", summary="Changer son mot de passe")
def changer_mot_de_passe(
    payload: ChangerMotDePasse,
    utilisateur=Depends(get_utilisateur_courant),
    db: Session = Depends(get_db),
):
    if not verifier_mot_de_passe(payload.ancien_mot_de_passe, utilisateur.mot_de_passe):
        raise HTTPException(status_code=400, detail="Ancien mot de passe incorrect")
    utilisateur.mot_de_passe = hacher_mot_de_passe(payload.nouveau_mot_de_passe)
    db.commit()
    return {"message": "Mot de passe modifié avec succès"}

