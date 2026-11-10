# IoT — V2 (à venir)

Ce dossier contiendra tout ce qui concerne l'intégration matérielle du panneau de LED physique.

## Ce qui sera développé en V2

### Matériel requis
- **ESP32** (ex. ESP32-WROOM-32D) avec WiFi intégré
- **Panneau de LEDs adressables** (WS2812B ou SK6812) : 20 LEDs minimum (1 par casier)
- Alimentation 5V / 2A

### Architecture V2

```
Mobile/Web  →  Backend FastAPI  →  Broker MQTT (Mosquitto)  →  ESP32  →  LEDs
```

### Broker MQTT
- **Mosquitto** installé sur le même serveur que le backend
- Port : 1883 (ou 8883 en TLS)
- Topics prévus :
  - `keylocator/casier/{casier_id}/allumer` → payload : `{"duree": 15}`
  - `keylocator/casier/{casier_id}/eteindre` → payload : `{}`
  - `keylocator/esp32/{esp32_id}/statut` → payload : `{"statut": "en_ligne"}` (LWT)

### Implémentation backend à créer
- Classe `MqttLedGuidanceService(LedGuidanceService)` dans `backend/app/services/led_mqtt.py`
- Publication MQTT via `paho-mqtt` ou `asyncio-mqtt`
- Activation via variable d'environnement : `LED_MODE=mqtt`

### Firmware ESP32
- Langage : MicroPython ou Arduino (C++)
- Bibliothèque LED : `Adafruit NeoPixel` ou `FastLED`
- Connexion MQTT : `PubSubClient` (Arduino) ou `umqtt` (MicroPython)
- Gestion du LWT (Last Will and Testament) pour détecter la déconnexion

### Champs base de données déjà prévus (V1)
| Table    | Champ         | Rôle V2                         |
|----------|---------------|---------------------------------|
| casiers  | led_index     | Index de la LED sur le panneau  |
| casiers  | esp32_id      | Identifiant de l'ESP32          |
| casiers  | esp32_statut  | En ligne / hors ligne           |

### Dossiers à créer en V2
```
iot/
├── firmware/          # Code Arduino/MicroPython pour l'ESP32
├── mosquitto/         # Configuration du broker Mosquitto
└── docs/             # Schémas de câblage, guide d'installation
```
