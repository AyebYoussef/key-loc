# KeyLocator — Rapport d'Avancement V1

## ✅ Étape 1 : Arborescence Monorepo & Structure de Fichiers
- Monorepo structuré avec `backend/`, `frontend/`, `mobile/`, `database/`, `iot/`.
- Architecture V2 IoT anticipée dans `iot/README.md`.

## ✅ Étape 2 : Base de Données MySQL (XAMPP)
- Base `keylocator` initialisée avec 11 tables relationnelles (`database/init.sql`).
- Données de test chargées (utilisateurs, fabricants, modèles, 20 casiers, 10 ébauches, équivalences).

## ✅ Étape 3 : Backend FastAPI
- Auth JWT (rôles `serrurier` / `gerant`).
- Modèles SQLAlchemy + Schémas Pydantic.
- Interface `LedGuidanceService` et implémentation V1 `SimulatedLedGuidanceService`.
- Route centrale `POST /api/scans/` avec flux complet (vérification de netteté Laplacien, détection YOLO, décrémentation stock, guidage lumineux).
- Tests de bout en bout passés avec succès (`test_e2e.py`).

## ✅ Étape 4 : Reconnaissance YOLO
- Structure de dataset prête (`backend/yolo/dataset/data.yaml` avec 10 classes).
- Scripts d'entraînement `train.py` et d'inférence autonome `inference.py`.
- Mode **MOCK** actif par défaut permettant le développement et le test sans dataset physique.

## ✅ Étape 5 : Frontend Angular 19 (Standalone)
- Angular 19 avec composants standalone, `HttpClient`, Router et Reactive Forms.
- Thème Clair / Sombre, variables CSS et design SCSS sans framework lourd.
- Vues fonctionnelles :
  - **Login** avec pré-remplissage rapide des rôles
  - **Dashboard** avec statistiques et tableau d'alertes prioritaires
  - **Scan** avec upload d'image, affichage dynamique de l'état, du casier, du stock et validation du prélèvement
  - **Casiers & LED** avec grille 4x5 animée en temps réel (clignotement 15s)
  - **Stock** avec filtrage et réapprovisionnement
  - **Catalogue** avec recherche manuelle et profils d'équivalences de fabricants
- Bundle compilé avec succès (`npm run build`).

## ✅ Étape 6 : Application Mobile Kotlin (Android)
- Architecture **MVVM** (`MainActivity`, `MainViewModel`, `ScanRepository`).
- Intégration **CameraX** (PreviewView, ImageCapture avec cadre de ciblage).
- Client **Retrofit / OkHttp** avec envoi multipart de la photo.
- Gestion des états (Loading, Success avec affichage du casier lumineux, alertes photo floue / erreur).

