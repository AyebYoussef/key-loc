"""
Schémas Pydantic — Authentification et Utilisateurs.
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


# ── Rôle ──────────────────────────────────────────────────────────────────────

class RoleSchema(BaseModel):
    id: int
    nom: str

    model_config = {"from_attributes": True}


# ── Authentification ──────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    mot_de_passe: str = Field(..., min_length=6)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    utilisateur: "UtilisateurPublic"


# ── Utilisateur ───────────────────────────────────────────────────────────────

class UtilisateurPublic(BaseModel):
    id: int
    nom: str
    prenom: str
    email: str
    actif: bool
    role: RoleSchema
    created_at: datetime

    model_config = {"from_attributes": True}


class UtilisateurCreate(BaseModel):
    nom: str = Field(..., min_length=2, max_length=100)
    prenom: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    mot_de_passe: str = Field(..., min_length=8)
    role_id: int


class UtilisateurUpdate(BaseModel):
    nom: Optional[str] = Field(None, min_length=2, max_length=100)
    prenom: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    actif: Optional[bool] = None
    role_id: Optional[int] = None


class ChangerMotDePasse(BaseModel):
    ancien_mot_de_passe: str
    nouveau_mot_de_passe: str = Field(..., min_length=8)


TokenResponse.model_rebuild()

