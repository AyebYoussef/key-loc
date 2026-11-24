"""
Script d'entraînement YOLOv8 Classification pour KeyLocator.
Usage :
    cd backend
    venv\\Scripts\\python yolo/train.py

Ce script utilise le Transfer Learning avec yolov8n-cls.pt (modèle nano pré-entraîné)
pour apprendre à classer les profils de clés à partir des dossiers dans yolo/dataset/ :
    yolo/dataset/
      train/<classe_yolo>/*.jpg
      val/<classe_yolo>/*.jpg
"""
from pathlib import Path
import shutil
import sys
from ultralytics import YOLO

BACKEND_DIR = Path(__file__).resolve().parents[1]
DATASET_DIR = Path(__file__).resolve().parent / "dataset"
WEIGHTS_DIR = Path(__file__).resolve().parent / "weights"
TARGET_ML_DIR = BACKEND_DIR / "ml"


def entrainer(epochs: int = 50, imgsz: int = 224, batch: int = 16):
    train_dir = DATASET_DIR / "train"
    val_dir = DATASET_DIR / "val"

    if not train_dir.exists() or not any(train_dir.iterdir()):
        print("\n❌ Erreur : Le dossier d'entraînement est vide ou inexistant.")
        print(f"   Chemin attendu : {train_dir}")
        print("\nStructure attendue :")
        print("   yolo/dataset/")
        print("     train/")
        print("       SX9/  (photos .jpg de la clé SX9)")
        print("       TE2/  (photos .jpg de la clé TE2)")
        print("     val/")
        print("       SX9/  (photos de validation)")
        print("       TE2/")
        print("\n💡 Astuce : Placez quelques photos téléchargées dans yolo/raw_images/<classe>/")
        print("   puis exécutez 'python yolo/prepare_dataset.py' pour générer ce dossier automatiquement !")
        return

    # Compter les classes
    classes_train = [d.name for d in train_dir.iterdir() if d.is_dir()]
    print("=" * 60)
    print("      KeyLocator — Entraînement IA YOLOv8 Classification")
    print("=" * 60)
    print(f"📁 Dossier Dataset   : {DATASET_DIR}")
    print(f"🏷️  Classes détectées : {len(classes_train)} ({', '.join(sorted(classes_train))})")
    print(f"⚙️  Paramètres        : {epochs} epochs | image {imgsz}x{imgsz} | batch {batch}")
    print("=" * 60)

    # Modèle pré-entraîné YOLOv8 nano classification (Transfer Learning)
    model = YOLO("yolov8n-cls.pt")

    results = model.train(
        data=str(DATASET_DIR),
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        project=str(WEIGHTS_DIR),
        name="keylocator_cls",
        exist_ok=True,
        patience=15,
        save=True,
        plots=True,
        workers=0,
    )

    best_pt = WEIGHTS_DIR / "keylocator_cls" / "weights" / "best.pt"
    if best_pt.exists():
        TARGET_ML_DIR.mkdir(parents=True, exist_ok=True)
        dest_best = TARGET_ML_DIR / "best.pt"
        shutil.copy(best_pt, dest_best)
        print("\n" + "=" * 60)
        print("  ✅ ENTRAÎNEMENT TERMINÉ AVEC SUCCÈS !")
        print("=" * 60)
        print(f"📦 Modèle optimal sauvegardé : {dest_best}")
        print("\nPour activer le modèle dans l'application :")
        print("1. Ouvrez 'backend/.env'")
        print("2. Modifiez la ligne :")
        print("   YOLO_MODE=real")
        print("   YOLO_MODEL_PATH=ml/best.pt")
        print("3. Relancez l'application via start_dev.bat !")
        print("=" * 60)


if __name__ == "__main__":
    entrainer()
