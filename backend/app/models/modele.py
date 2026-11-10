"""
Modèles SQLAlchemy — Fabricant, ModèleCle, Equivalence.
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Fabricant(Base):
    __tablename__ = "fabricants"

    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String(100), unique=True, nullable=False)
    pays = Column(String(100))
    created_at = Column(DateTime, server_default=func.now())

    modeles = relationship("ModeleCle", back_populates="fabricant")


class ModeleCle(Base):
    __tablename__ = "modeles_cles"

    id = Column(Integer, primary_key=True, index=True)
    reference = Column(String(100), unique=True, nullable=False, index=True)
    libelle = Column(String(200), nullable=False)
    fabricant_id = Column(Integer, ForeignKey("fabricants.id"), nullable=False)
    image_reference = Column(String(255))
    yolo_label = Column(String(100))
    description = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    fabricant = relationship("Fabricant", back_populates="modeles")
    ebauches = relationship("Ebauche", back_populates="modele")
    equivalences_source = relationship(
        "Equivalence",
        foreign_keys="Equivalence.modele_source_id",
        back_populates="modele_source",
    )
    equivalences_cible = relationship(
        "Equivalence",
        foreign_keys="Equivalence.modele_equiv_id",
        back_populates="modele_equiv",
    )
    scans = relationship("Scan", back_populates="modele_detecte")


class Equivalence(Base):
    __tablename__ = "equivalences"

    id = Column(Integer, primary_key=True, index=True)
    modele_source_id = Column(Integer, ForeignKey("modeles_cles.id"), nullable=False)
    modele_equiv_id = Column(Integer, ForeignKey("modeles_cles.id"), nullable=False)
    note = Column(String(255))

    modele_source = relationship(
        "ModeleCle", foreign_keys=[modele_source_id], back_populates="equivalences_source"
    )
    modele_equiv = relationship(
        "ModeleCle", foreign_keys=[modele_equiv_id], back_populates="equivalences_cible"
    )

