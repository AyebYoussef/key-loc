"""
Schémas Pydantic — Casiers, Ébauches, Mouvements, Scans, LED.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.schemas.modele import ModeleSchema, FabricantSchema


# ── Casier ────────────────────────────────────────────────────────────────────

class CasierBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    ligne: int = Field(..., ge=1)
    colonne: int = Field(..., ge=1)
    description: Optional[str] = None
    # Champs V2 (optionnels)
    led_index: Optional[int] = None
    esp32_id: Optional[str] = None


class CasierCreate(CasierBase):
    pass


class CasierUpdate(BaseModel):
    description: Optional[str] = None
    actif: Optional[bool] = None
    led_index: Optional[int] = None
    esp32_id: Optional[str] = None


class EtatLedSchema(BaseModel):
    casier_id: int
    actif: bool
    expire_a: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CasierSchema(CasierBase):
    id: int
    actif: bool
    esp32_statut: str
    etat_led: Optional[EtatLedSchema] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Ébauche ───────────────────────────────────────────────────────────────────

class EbaucheBase(BaseModel):
    modele_id: int
    casier_id: int
    quantite: int = Field(..., ge=0)
    seuil_alerte: int = Field(5, ge=0)
    quantite_min: int = Field(0, ge=0)


class EbaucheCreate(EbaucheBase):
    pass


class EbaucheUpdate(BaseModel):
    quantite: Optional[int] = Field(None, ge=0)
    seuil_alerte: Optional[int] = Field(None, ge=0)
    quantite_min: Optional[int] = Field(None, ge=0)


class EbaucheSchema(EbaucheBase):
    id: int
    statut_stock: str           # ok | alerte | epuise
    modele: ModeleSchema
    casier: CasierSchema
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Mouvement de stock ────────────────────────────────────────────────────────

class PrelevementRequest(BaseModel):
    ebauche_id: int
    commentaire: Optional[str] = None


class ReapprovisionnementRequest(BaseModel):
    ebauche_id: int
    quantite: int = Field(..., ge=1)
    commentaire: Optional[str] = None


class MouvementSchema(BaseModel):
    id: int
    ebauche_id: int
    utilisateur_id: int
    type_mouvement: str
    quantite: int
    quantite_avant: int
    quantite_apres: int
    commentaire: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Scan ──────────────────────────────────────────────────────────────────────

class ScanResultat(BaseModel):
    """Réponse du POST /api/scans/"""
    statut: str                           # succes | echec_confiance | echec_detection | photo_floue
    message: str
    modele: Optional[ModeleSchema] = None
    score_confiance: Optional[float] = None
    ebauche: Optional[EbaucheSchema] = None
    casier: Optional[CasierSchema] = None
    equivalences: Optional[List[ModeleSchema]] = None
    scan_id: Optional[int] = None


class ScanSchema(BaseModel):
    id: int
    utilisateur_id: int
    image_path: Optional[str]
    modele_detecte_id: Optional[int]
    score_confiance: Optional[float]
    statut: str
    ebauche_id: Optional[int]
    guidage_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── LED virtuelle ─────────────────────────────────────────────────────────────

class AllumerCasierRequest(BaseModel):
    casier_id: int
    duree_secondes: int = Field(15, ge=1, le=300)

