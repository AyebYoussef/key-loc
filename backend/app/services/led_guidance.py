"""
LedGuidanceService — Interface abstraite + implémentation simulée (V1).

Architecture :
  LedGuidanceService          ← interface abstraite
  SimulatedLedGuidanceService ← V1 : stocke l'état en base, polling REST
  MqttLedGuidanceService      ← V2 : à créer dans led_mqtt.py (MQTT + ESP32)

Injection via variable d'env LED_MODE=simulated|mqtt dans les dépendances FastAPI.
"""
from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.casier import EtatLed


# ── Interface abstraite ───────────────────────────────────────────────────────

class LedGuidanceService(ABC):
    """Interface que toute implémentation (V1 simulée, V2 MQTT) doit respecter."""

    @abstractmethod
    def allumer_casier(self, casier_id: int, duree_secondes: int, db: Session) -> None:
        """Allume (ou simule l'allumage de) la LED du casier pendant `duree_secondes`."""
        ...

    @abstractmethod
    def eteindre_casier(self, casier_id: int, db: Session) -> None:
        """Éteint (ou simule l'extinction de) la LED du casier."""
        ...

    @abstractmethod
    def get_etat(self, casier_id: int, db: Session) -> dict:
        """Retourne l'état courant de la LED (actif, expire_a)."""
        ...


# ── Implémentation V1 : Simulée ───────────────────────────────────────────────

class SimulatedLedGuidanceService(LedGuidanceService):
    """
    V1 : Simule le guidage lumineux en écrivant l'état en base.
    Le frontend fait du polling sur GET /api/casiers/{id}/etat pour
    animer la LED virtuelle.
    """

    def allumer_casier(self, casier_id: int, duree_secondes: int, db: Session) -> None:
        expire_a = datetime.now(timezone.utc) + timedelta(seconds=duree_secondes)
        etat = db.query(EtatLed).filter(EtatLed.casier_id == casier_id).first()
        if etat:
            etat.actif = True
            etat.expire_a = expire_a
        else:
            etat = EtatLed(casier_id=casier_id, actif=True, expire_a=expire_a)
            db.add(etat)
        db.commit()

        # Notification directe optionnelle vers l'ESP8266 si configuré
        from app.core.config import settings
        from app.models.casier import Casier
        if getattr(settings, "ESP8266_IP", None):
            casier = db.query(Casier).filter(Casier.id == casier_id).first()
            if casier and casier.esp_pin:
                self._notifier_esp8266(settings.ESP8266_IP, casier.code, casier.esp_pin, duree_secondes)

    @staticmethod
    def _notifier_esp8266(ip: str, code: str, pin: str, duree: int):
        import threading
        import urllib.request

        def _send():
            try:
                url = f"http://{ip}/blink?casier={code}&pin={pin}&duration={duree}"
                urllib.request.urlopen(url, timeout=0.8)
            except Exception:
                pass  # L'ESP8266 utilise également le polling comme mécanisme principal

        threading.Thread(target=_send, daemon=True).start()

    def eteindre_casier(self, casier_id: int, db: Session) -> None:
        etat = db.query(EtatLed).filter(EtatLed.casier_id == casier_id).first()
        if etat:
            etat.actif = False
            etat.expire_a = None
            db.commit()

    def get_etat(self, casier_id: int, db: Session) -> dict:
        etat = db.query(EtatLed).filter(EtatLed.casier_id == casier_id).first()
        if not etat:
            return {"casier_id": casier_id, "actif": False, "expire_a": None}

        # Auto-extinction si le délai est passé
        maintenant = datetime.now(timezone.utc)
        if etat.actif and etat.expire_a:
            # MySQL stocke en UTC naïf — on le rend conscient pour la comparaison
            expire = etat.expire_a.replace(tzinfo=timezone.utc) if etat.expire_a.tzinfo is None else etat.expire_a
            if maintenant > expire:
                self.eteindre_casier(casier_id, db)
                return {"casier_id": casier_id, "actif": False, "expire_a": None}

        return {
            "casier_id": casier_id,
            "actif": etat.actif,
            "expire_a": etat.expire_a,
        }


# ── Fabrique d'injection ──────────────────────────────────────────────────────

def get_led_service() -> LedGuidanceService:
    """
    Dépendance FastAPI : retourne l'implémentation selon LED_MODE.
    V2 : ajouter 'elif settings.LED_MODE == "mqtt": return MqttLedGuidanceService()'
    """
    from app.core.config import settings  # import local pour éviter les cycles

    if settings.LED_MODE == "simulated":
        return SimulatedLedGuidanceService()
    # [V2] elif settings.LED_MODE == "mqtt":
    #     from app.services.led_mqtt import MqttLedGuidanceService
    #     return MqttLedGuidanceService()
    raise ValueError(f"LED_MODE inconnu : {settings.LED_MODE}. Valeurs acceptées : simulated, mqtt")

