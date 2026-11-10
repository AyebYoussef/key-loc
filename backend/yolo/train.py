"""
Script d'entraînement YOLO (étape 4).
Lance : python yolo/train.py

Prérequis :
  - pip install ultralytics
  - dataset structuré dans yolo/dataset/ (voir data.yaml)
  - au moins 50 images par classe recommandé
"""
from ultralytics import YOLO
import os

DATASET_YAML = os.path.join(os.path.dirname(__file__), "dataset", "data.yaml")
OUTPUT_DIR   = os.path.join(os.path.dirname(__file__), "weights")

def entrainer(epochs: int = 100, imgsz: int = 640, batch: int = 16):
    # Modèle de base pré-entraîné (transfert learning)
    model = YOLO("yolov8n.pt")  # nano = léger, yolov8s.pt = small si GPU dispo

    results = model.train(
        data=DATASET_YAML,
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        project=OUTPUT_DIR,
        name="keylocator",
        exist_ok=True,
        patience=20,       # arrêt anticipé si pas d'amélioration pendant 20 epochs
        save=True,
        plots=True,
    )
    print(f"\n✅ Entraînement terminé. Poids sauvegardés dans {OUTPUT_DIR}/keylocator/weights/best.pt")
    print("Copiez best.pt dans yolo/weights/best.pt puis passez YOLO_MODE=inference dans .env")


if __name__ == "__main__":
    entrainer()

