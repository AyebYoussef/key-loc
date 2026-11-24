"""
Router — IoT & Contrôle des LEDs physiques (ESP8266 / NodeMCU).
Permet la communication en temps réel entre le Backend FastAPI et la carte ESP8266.
"""
from datetime import datetime, timezone
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.casier import Casier, EtatLed
from app.services.led_guidance import LedGuidanceService, get_led_service

logger = logging.getLogger(__name__)

router = APIRouter()


class CasierIotItem(BaseModel):
    code: str
    pin: Optional[str] = None
    actif: bool
    reste_secondes: float


class IotStatusResponse(BaseModel):
    actif: bool
    casier: Optional[str] = None
    pin: Optional[str] = None
    reste_secondes: float
    casiers: list[CasierIotItem]


@router.get(
    "/active",
    summary="État actif simple pour ESP8266 (Plain Text)",
    description="Retourne 'A1', 'A2', 'A3' ou 'NONE'. Conçu pour un polling ultra-rapide et sans dépendance JSON sur ESP8266.",
)
def get_active_plain(db: Session = Depends(get_db)):
    """
    Endpoint ultra-léger dédié à l'ESP8266 :
    Renvoie le code du casier actif (ex: 'A1') ou 'NONE'.
    """
    maintenant = datetime.now(timezone.utc)
    etats_actifs = (
        db.query(EtatLed, Casier)
        .join(Casier, EtatLed.casier_id == Casier.id)
        .filter(EtatLed.actif == True, Casier.actif == True)
        .all()
    )

    for etat, casier in etats_actifs:
        if etat.expire_a:
            expire = etat.expire_a.replace(tzinfo=timezone.utc) if etat.expire_a.tzinfo is None else etat.expire_a
            if maintenant < expire:
                return Response(content=casier.code, media_type="text/plain")
            else:
                etat.actif = False
                etat.expire_a = None
                db.commit()

    return Response(content="NONE", media_type="text/plain")


@router.get(
    "/status",
    response_model=IotStatusResponse,
    summary="Statut IoT complet (JSON)",
    description="Retourne l'état de tous les casiers, le pin associé (D3, D4, D5) et le temps restant.",
)
def get_iot_status(db: Session = Depends(get_db)):
    maintenant = datetime.now(timezone.utc)
    casiers = db.query(Casier).filter(Casier.actif == True).order_by(Casier.code).all()

    items: list[CasierIotItem] = []
    actif_principal = False
    casier_actif = None
    pin_actif = None
    max_reste = 0.0

    for c in casiers:
        etat = db.query(EtatLed).filter(EtatLed.casier_id == c.id).first()
        is_active = False
        reste = 0.0

        if etat and etat.actif and etat.expire_a:
            expire = etat.expire_a.replace(tzinfo=timezone.utc) if etat.expire_a.tzinfo is None else etat.expire_a
            if maintenant < expire:
                is_active = True
                reste = round((expire - maintenant).total_seconds(), 1)
                if reste > max_reste:
                    max_reste = reste
                    casier_actif = c.code
                    pin_actif = c.esp_pin
                    actif_principal = True
            else:
                etat.actif = False
                etat.expire_a = None
                db.commit()

        items.append(
            CasierIotItem(
                code=c.code,
                pin=c.esp_pin,
                actif=is_active,
                reste_secondes=reste,
            )
        )

    return IotStatusResponse(
        actif=actif_principal,
        casier=casier_actif,
        pin=pin_actif,
        reste_secondes=max_reste,
        casiers=items,
    )


@router.post("/trigger/{code}", summary="Déclencher le clignotement d'un casier (Test)")
def trigger_casier(
    code: str,
    duree: int = Query(default=10, ge=1, le=60, description="Durée en secondes (défaut: 10s)"),
    db: Session = Depends(get_db),
    led_service: LedGuidanceService = Depends(get_led_service),
):
    """Permet de tester l'allumage physique de la LED d'un casier (ex: A1, A2, A3)."""
    casier = db.query(Casier).filter(Casier.code == code.upper(), Casier.actif == True).first()
    if not casier:
        raise HTTPException(status_code=404, detail=f"Casier '{code}' introuvable.")

    led_service.allumer_casier(casier.id, duree, db)
    return {
        "succes": True,
        "casier": casier.code,
        "pin": casier.esp_pin,
        "duree_secondes": duree,
        "message": f"LED du casier {casier.code} activée pendant {duree} secondes.",
    }


@router.post("/stop", summary="Éteindre toutes les LEDs")
def stop_all(db: Session = Depends(get_db)):
    """Éteint immédiatement toutes les LEDs actives."""
    etats = db.query(EtatLed).filter(EtatLed.actif == True).all()
    for e in etats:
        e.actif = False
        e.expire_a = None
    db.commit()
    return {"succes": True, "message": "Toutes les LEDs ont été éteintes."}
