"""
Sécurité : hachage des mots de passe et génération/vérification des tokens JWT.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# ── Mots de passe ─────────────────────────────────────────────────────────────

def hacher_mot_de_passe(mot_de_passe: str) -> str:
    return pwd_context.hash(mot_de_passe)


def verifier_mot_de_passe(mot_de_passe_clair: str, hash_stocke: str) -> bool:
    return pwd_context.verify(mot_de_passe_clair, hash_stocke)


# ── Tokens JWT ────────────────────────────────────────────────────────────────

def creer_access_token(data: dict, expire_dans: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expire_dans or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decoder_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expiré",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ── Dépendances FastAPI ───────────────────────────────────────────────────────

def get_utilisateur_courant(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    """Extrait et valide l'utilisateur depuis le token JWT."""
    from app.models.utilisateur import Utilisateur  # import local pour éviter les cycles

    payload = decoder_token(token)
    user_id: Optional[int] = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Token invalide")

    user = db.query(Utilisateur).filter(Utilisateur.id == int(user_id)).first()
    if not user or not user.actif:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable ou désactivé")
    return user


def get_gerant(utilisateur=Depends(get_utilisateur_courant)):
    """Exige que l'utilisateur courant soit gérant."""
    if utilisateur.role.nom != "gerant":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux gérants",
        )
    return utilisateur

