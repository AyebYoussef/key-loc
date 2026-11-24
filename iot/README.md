# 🔌 KeyLocator — Module IoT ESP8266 (Guidage Lumineux Physique)

Ce dossier contient l'intégration matérielle complète pour la carte **ESP8266** (NodeMCU / Wemos D1 Mini) reliée aux 3 LEDs indicatrices des casiers.

---

## 🛠️ Matériel Requis

* **1x Carte ESP8266** (NodeMCU v2/v3 ou Wemos D1 Mini)
* **1x Breadboard** (plaque d'essai)
* **3x LEDs** (rouge, verte, bleue ou jaune)
* **3x Résistances** (220Ω ou 330Ω) pour protéger les LEDs
* **Fils de connexion Dupont** (mâle-mâle ou mâle-femelle)
* **1x Câble Micro-USB** pour programmer et alimenter l'ESP8266

---

## 📌 Schéma de Câblage (Breadboard & Pins)

| Casier | Clé Associée | Broche ESP8266 | GPIO | Câblage LED |
| :---: | :---: | :---: | :---: | :--- |
| **A1** | **UE 11R** | **`D3`** | GPIO 0 | Broche **`D3`** → Résistance 220Ω → Anode (+) LED 1 → Cathode (-) à **GND** |
| **A2** | **C8 208** (c8 206) | **`D4`** | GPIO 2 | Broche **`D4`** → Résistance 220Ω → Anode (+) LED 2 → Cathode (-) à **GND** |
| **A3** | **UG 5D** | **`D5`** | GPIO 14 | Broche **`D5`** → Résistance 220Ω → Anode (+) LED 3 → Cathode (-) à **GND** |

> **Rappel branchement d'une LED :**
> - La patte **longue** est l'**Anode (+)** (à relier au Pin ESP via la résistance).
> - La patte **courte** (côté méplat) est la **Cathode (-)** (à relier au **GND** de l'ESP8266).

---

## ⚡ Téléversement dans l'ESP8266 (Arduino IDE)

### 1. Préparer l'Arduino IDE
1. Téléchargez et installez **[Arduino IDE](https://www.arduino.cc/en/software)** si ce n'est pas déjà fait.
2. Allez dans **Fichier > Préférences**, puis dans le champ *URL de gestionnaire de cartes supplémentaires*, ajoutez :
   ```
   http://arduino.esp8266.com/stable/package_esp8266com_index.json
   ```
3. Allez dans **Outils > Type de carte > Gestionnaire de cartes**, cherchez **esp8266** et cliquez sur **Installer**.

### 2. Configurer le code
Ouvrez le fichier :
[`iot/firmware/keylocator_esp8266/keylocator_esp8266.ino`](firmware/keylocator_esp8266/keylocator_esp8266.ino)

Modifiez les lignes 32 à 38 :
```cpp
const char* WIFI_SSID     = "VOTRE_NOM_WIFI";       // Nom de votre Wi-Fi (2.4 GHz)
const char* WIFI_PASSWORD = "VOTRE_MOT_DE_PASSE";   // Mot de passe Wi-Fi
const char* SERVER_HOST   = "192.168.1.17";         // IP locale de votre ordinateur
const int   SERVER_PORT   = 8000;
```

### 3. Téléverser
1. Branchez l'ESP8266 en USB à votre PC.
2. Dans Arduino IDE, sélectionnez :
   - **Type de carte** : *NodeMCU 1.0 (ESP-12E Module)* ou *Generic ESP8266 Module*
   - **Port** : Le port COM correspondant (ex. COM3, COM4...)
3. Cliquez sur le bouton **Téléverser** (flèche vers la droite).
4. Ouvrez le **Moniteur Série** (`Ctrl+Maj+M`) à **115200 bauds** pour observer la connexion Wi-Fi et l'adresse IP attribuée à l'ESP8266 !

---

## 🚀 Fonctionnement en Temps Réel

1. **Scan d'une clé sur le site web** ([http://localhost:4200](http://localhost:4200)).
2. L'IA YOLO identifie la clé (ex: `UE 11R`).
3. Le backend associe le casier correspondant (`A1`).
4. L'ESP8266 détecte l'événement en moins de 300ms et **fait clignoter la LED `D3` pendant exactement 10 secondes** !

---

## 🧪 Test Manuel des LEDs depuis le Navigateur

Lorsque l'ESP8266 est connecté au Wi-Fi, vous pouvez tester son fonctionnement directement depuis votre navigateur ou via l'API :
- **Tester tout le panneau** : Ouvrez `http://<IP_ESP8266>/test`
- **Tester Casier A1 (D3)** : `http://localhost:8000/docs#/IoT%20%26%20LED/trigger_casier_api_iot_trigger__code__post` ou `POST http://localhost:8000/api/iot/trigger/A1`
- **Tester Casier A2 (D4)** : `POST http://localhost:8000/api/iot/trigger/A2`
- **Tester Casier A3 (D5)** : `POST http://localhost:8000/api/iot/trigger/A3`
