"""
Schémas Pydantic — Fabricants, Modèles de clés, Équivalences.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ── Fabricant ─────────────────────────────────────────────────────────────────

class FabricantBase(BaseModel):
    nom: str = Field(..., min_length=2, max_length=100)
    pays: Optional[str] = None


class FabricantCreate(FabricantBase):
    pass


class FabricantUpdate(BaseModel):
    nom: Optional[str] = Field(None, min_length=2, max_length=100)
    pays: Optional[str] = None


class FabricantSchema(FabricantBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Modèle de clé ─────────────────────────────────────────────────────────────

class ModeleBase(BaseModel):
    reference: str = Field(..., min_length=1, max_length=100)
    libelle: str = Field(..., min_length=2, max_length=200)
    fabricant_id: int
    image_reference: Optional[str] = None
    yolo_label: Optional[str] = None
    description: Optional[str] = None


class ModeleCreate(ModeleBase):
    pass


class ModeleUpdate(BaseModel):
    libelle: Optional[str] = Field(None, min_length=2, max_length=200)
    fabricant_id: Optional[int] = None
    image_reference: Optional[str] = None
    yolo_label: Optional[str] = None
    description: Optional[str] = None


class ModeleSchema(ModeleBase):
    id: int
    fabricant: FabricantSchema
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ModeleAvecEquivalences(ModeleSchema):
    """Modèle enrichi avec sa liste d'équivalences."""
    equivalences: List["ModeleSchema"] = []

    model_config = {"from_attributes": True}


# ── Équivalence ───────────────────────────────────────────────────────────────

class EquivalenceCreate(BaseModel):
    modele_source_id: int
    modele_equiv_id: int
    note: Optional[str] = None


class EquivalenceSchema(BaseModel):
    id: int
    modele_source_id: int
    modele_equiv_id: int
    note: Optional[str]
    modele_equiv: ModeleSchema

    model_config = {"from_attributes": True}


ModeleAvecEquivalences.model_rebuild()

