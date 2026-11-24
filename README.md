# KeyLocator — Système de gestion d'ébauches de clés

Application de gestion et de localisation d'ébauches de clés pour serrurier.

## Stack technique

| Couche      | Technologie                                              |
|-------------|----------------------------------------------------------|
| Frontend    | Angular (standalone), SCSS, Angular Router, HttpClient  |
| Backend     | Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy, JWT     |
| IA          | Ultralytics YOLO v8 (mode mock en V1)                   |
| Base de données | MySQL 8 via XAMPP (phpMyAdmin)                      |
| Mobile & Web | Application Web Responsive (Angular, Camera API, WebRTC) |
| IoT (V2)    | ESP32, MQTT Mosquitto, LEDs WS2812B                     |

## Structure du monorepo

```
keylocator/
├── backend/           # API FastAPI
│   ├── app/
│   │   ├── core/      # Config, sécurité, DB
│   │   ├── models/    # Modèles SQLAlchemy
│   │   ├── schemas/   # Schémas Pydantic
│   │   ├── routers/   # Routes FastAPI (MVC : contrôleurs)
│   │   ├── services/  # Logique métier
│   │   └── utils/     # Utilitaires
│   ├── yolo/          # Dataset, poids, scripts YOLO
│   └── tests/
├── frontend/          # Application Web & Mobile (Angular Responsive)
├── database/          # Script SQL d'initialisation
└── iot/               # (V2) Firmware ESP32, config MQTT
```

## Démarrage rapide

### Prérequis
- XAMPP ≥ 8.0 (MySQL + phpMyAdmin)
- Python ≥ 3.11
- Node.js ≥ 20 + Angular CLI ≥ 17

### 1. Base de données (XAMPP)
1. Démarrez Apache et MySQL dans XAMPP Control Panel
2. Ouvrez `http://localhost/phpmyadmin`
3. Importez `database/init.sql`

### 2. Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env         # puis éditez .env
uvicorn app.main:app --reload
```
API disponible sur : http://localhost:8000  
Documentation Swagger : http://localhost:8000/docs

### 3. Application Web & Mobile (Frontend)
```bash
cd frontend
npm install
npm start                      # Lance le serveur sur 0.0.0.0:4200
```
- **Sur PC** : Ouvrez `http://localhost:4200`
- **Sur Mobile** : Ouvrez directement `http://localhost:4200` (émulateur) ou `http://<IP_DU_PC>:4200` dans votre navigateur mobile (Chrome, Safari, etc.) connecté au même réseau.

La capture photo fonctionne directement depuis le navigateur du smartphone via l'appareil photo ou la caméra en direct.

## Comptes de test

| Email                          | Mot de passe | Rôle      |
|--------------------------------|--------------|-----------|
| jean.dupont@keylocator.fr      | Password1!   | Serrurier |
| sophie.martin@keylocator.fr    | Password1!   | Gérant    |
| marc.bernard@keylocator.fr     | Password1!   | Serrurier |

## Versions

- **V1** (en cours) : Application complète sans IoT, guidage LED simulé
- **V2** (à venir) : Intégration ESP32 + panneau LED physique via MQTT
