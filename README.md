# KeyLocator — Système de gestion d'ébauches de clés

Application de gestion et de localisation d'ébauches de clés pour serrurier.

## Stack technique

| Couche      | Technologie                                              |
|-------------|----------------------------------------------------------|
| Frontend    | Angular (standalone), SCSS, Angular Router, HttpClient  |
| Backend     | Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy, JWT     |
| IA          | Ultralytics YOLO v8 (mode mock en V1)                   |
| Base de données | MySQL 8 via XAMPP (phpMyAdmin)                      |
| Mobile      | Android Kotlin, CameraX, Retrofit, MVVM                 |
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
├── frontend/          # Application Angular
├── mobile/            # Application Android Kotlin
├── database/          # Script SQL d'initialisation
└── iot/               # (V2) Firmware ESP32, config MQTT
```

## Démarrage rapide

### Prérequis
- XAMPP ≥ 8.0 (MySQL + phpMyAdmin)
- Python ≥ 3.11
- Node.js ≥ 20 + Angular CLI ≥ 17
- Android Studio (Hedgehog ou supérieur)

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

### 3. Frontend
```bash
cd frontend
npm install
ng serve
```
Application disponible sur : http://localhost:4200

### 4. Mobile
Ouvrez le dossier `mobile/` dans Android Studio et lancez l'émulateur.

## Comptes de test

| Email                          | Mot de passe | Rôle      |
|--------------------------------|--------------|-----------|
| jean.dupont@keylocator.fr      | Password1!   | Serrurier |
| sophie.martin@keylocator.fr    | Password1!   | Gérant    |
| marc.bernard@keylocator.fr     | Password1!   | Serrurier |

## Versions

- **V1** (en cours) : Application complète sans IoT, guidage LED simulé
- **V2** (à venir) : Intégration ESP32 + panneau LED physique via MQTT
