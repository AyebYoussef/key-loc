"""
Modèles SQLAlchemy — Casier, Ebauche, MouvementStock, EtatLed.
"""
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, SmallInteger,
    Float, Text, Enum, ForeignKey
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Casier(Base):
    __tablename__ = "casiers"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, nullable=False, index=True)
    ligne = Column(SmallInteger, nullable=False)
    colonne = Column(SmallInteger, nullable=False)
    # [V2] Champs IoT — déjà prévus, non utilisés en V1
    led_index = Column(SmallInteger, default=None)
    esp32_id = Column(String(50), default=None)
    esp32_statut = Column(Enum("en_ligne", "hors_ligne"), default="hors_ligne")
    description = Column(String(255))
    actif = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    ebauches = relationship("Ebauche", back_populates="casier")
    etat_led = relationship("EtatLed", back_populates="casier", uselist=False)


class Ebauche(Base):
    __tablename__ = "ebauches"

    id = Column(Integer, primary_key=True, index=True)
    modele_id = Column(Integer, ForeignKey("modeles_cles.id"), nullable=False)
    casier_id = Column(Integer, ForeignKey("casiers.id"), nullable=False)
    quantite = Column(Integer, default=0, nullable=False)
    seuil_alerte = Column(Integer, default=5, nullable=False)
    quantite_min = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    modele = relationship("ModeleCle", back_populates="ebauches")
    casier = relationship("Casier", back_populates="ebauches")
    mouvements = relationship("MouvementStock", back_populates="ebauche")
    scans = relationship("Scan", back_populates="ebauche")

    @property
    def statut_stock(self) -> str:
        """Retourne 'ok', 'alerte' ou 'epuise'."""
        if self.quantite <= self.quantite_min:
            return "epuise"
        if self.quantite <= self.seuil_alerte:
            return "alerte"
        return "ok"


class MouvementStock(Base):
    __tablename__ = "mouvements_stock"

    id = Column(Integer, primary_key=True, index=True)
    ebauche_id = Column(Integer, ForeignKey("ebauches.id"), nullable=False)
    utilisateur_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False)
    type_mouvement = Column(
        Enum("prelevement", "reapprovisionnement", "correction"), nullable=False
    )
    quantite = Column(Integer, nullable=False)
    quantite_avant = Column(Integer, nullable=False)
    quantite_apres = Column(Integer, nullable=False)
    commentaire = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    ebauche = relationship("Ebauche", back_populates="mouvements")
    utilisateur = relationship("Utilisateur", back_populates="mouvements")


class EtatLed(Base):
    """
    État de la LED virtuelle pour un casier.
    V1 : polling REST.
    V2 : remplacé par état MQTT réel, mais cette table reste utile.
    """
    __tablename__ = "etats_led"

    id = Column(Integer, primary_key=True, index=True)
    casier_id = Column(Integer, ForeignKey("casiers.id"), unique=True, nullable=False)
    actif = Column(Boolean, default=False)
    expire_a = Column(DateTime, default=None)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    casier = relationship("Casier", back_populates="etat_led")


class Scan(Base):
    __tablename__ = "scans"

    id = Column(Integer, primary_key=True, index=True)
    utilisateur_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False)
    image_path = Column(String(255))
    modele_detecte_id = Column(Integer, ForeignKey("modeles_cles.id"), default=None)
    score_confiance = Column(Float, default=None)
    statut = Column(
        Enum("succes", "echec_confiance", "echec_detection", "photo_floue"),
        nullable=False,
    )
    ebauche_id = Column(Integer, ForeignKey("ebauches.id"), default=None)
    guidage_active = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())

    utilisateur = relationship("Utilisateur", back_populates="scans")
    modele_detecte = relationship("ModeleCle", back_populates="scans")
    ebauche = relationship("Ebauche", back_populates="scans")

