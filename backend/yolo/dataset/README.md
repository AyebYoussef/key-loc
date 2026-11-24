# Guide Dataset & Entraînement YOLOv8 pour KeyLocator

Ce dossier contient les données d'entraînement pour le modèle d'identification automatique des clés de KeyLocator.

---

## 🎯 Comment fonctionne l'IA dans KeyLocator ?

KeyLocator utilise **YOLOv8 Classification** (`yolov8n-cls.pt`).
- **Aucune annotation manuelle (pas de boîtes rectangulaires à tracer)**.
- Le modèle apprend simplement à associer l'image complète d'une clé à sa référence (`SX9`, `TE2`, `EU6P`, etc.).
- La structure attendue est un dossier par classe :
  ```
  yolo/dataset/
  ├── train/
  │   ├── SX9/   (photos d'entraînement de la clé SX9)
  │   ├── TE2/   (photos d'entraînement de la clé TE2)
  │   └── ...
  └── val/
      ├── SX9/   (photos de validation de la clé SX9)
      ├── TE2/
      └── ...
  ```

---

## 🌐 Vous n'avez pas d'ébauches physiques ? Pas de problème !

### Étape 1 : Récupérer des photos sur Internet
Pour chaque modèle (ex: `SX9`), trouvez **3 à 10 images** sur le web :
1. **Catalogues fabricants officiels** :
   - Silca Electronic Key Catalogue (*silca.biz* ou *mykeyspro.com*)
   - JMA Catalogue (*jma.es*)
   - Errebi, Keyline
2. **Sites de vente en serrurerie** (*mesclefs.com*, *francecles.com*, *ebay*, *amazon*)
3. **Google Images** :
   - Recherchez : `"Silca SX9 key blank"`, `"ébauche clé SX9"`, `"Silca TE2"`
   - Sauvegardez les images dans le dossier correspondant :
     `backend/yolo/raw_images/SX9/`
     `backend/yolo/raw_images/TE2/`
     etc.

### Étape 2 : Préparer et Augmenter automatiquement le Dataset
Grâce au script d'augmentation, 5 images téléchargées sont automatiquement transformées en 40 images réalistes (rotations légères, luminosité, cadrage) :
```bash
cd backend
venv\Scripts\python yolo/prepare_dataset.py
```
Le dossier `yolo/dataset/train/` et `yolo/dataset/val/` sera généré instantanément.

### Étape 3 : Lancer l'Entraînement
```bash
cd backend
venv\Scripts\python yolo/train.py
```
L'entraînement dure environ 5 à 15 minutes sur processeur (CPU) ou quelques minutes sur GPU.
Le fichier de poids optimal `best.pt` est automatiquement sauvegardé dans `backend/ml/best.pt`.

### Étape 4 : Activer le modèle réel dans l'application
Dans `backend/.env`, définissez :
```env
YOLO_MODE=real
YOLO_MODEL_PATH=ml/best.pt
```
Redémarrez les serveurs via `start_dev.bat`. L'application scannera désormais vos clés avec le modèle entraîné !
