"""
Script d'inférence YOLO standalone (test rapide en dehors de l'API).
Lance : python yolo/inference.py --image chemin/vers/photo.jpg

Utilisé pour valider le modèle entraîné avant de le brancher dans /api/scans/.
"""
import argparse
import os
import sys

# Ajouter le dossier backend au path pour importer app.core.config
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


def tester_inference(image_path: str, model_path: str, seuil: float = 0.6):
    from ultralytics import YOLO

    if not os.path.exists(model_path):
        print(f"❌ Modèle introuvable : {model_path}")
        sys.exit(1)
    if not os.path.exists(image_path):
        print(f"❌ Image introuvable : {image_path}")
        sys.exit(1)

    model = YOLO(model_path)
    results = model.predict(source=image_path, conf=seuil, verbose=False)

    if not results or len(results[0].boxes) == 0:
        print("❌ Aucune clé détectée au-dessus du seuil de confiance.")
        return

    boxes = results[0].boxes
    scores = boxes.conf.tolist()
    classes = boxes.cls.tolist()

    print(f"\n✅ {len(scores)} détection(s) :")
    for i, (cls_idx, score) in enumerate(zip(classes, scores)):
        label = results[0].names[int(cls_idx)]
        print(f"  [{i+1}] {label} — confiance : {score:.2%}")

    best_idx = scores.index(max(scores))
    best_label = results[0].names[int(classes[best_idx])]
    best_score = scores[best_idx]
    print(f"\n🏆 Meilleure détection : {best_label} @ {best_score:.2%}")

    if best_score < seuil:
        print(f"⚠️  Score ({best_score:.2%}) < seuil ({seuil:.0%}) — détection refusée")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test d'inférence YOLO KeyLocator")
    parser.add_argument("--image", required=True, help="Chemin vers la photo de clé")
    parser.add_argument("--model", default="yolo/weights/best.pt", help="Chemin vers best.pt")
    parser.add_argument("--seuil", type=float, default=0.6, help="Seuil de confiance (0.0–1.0)")
    args = parser.parse_args()

    tester_inference(args.image, args.model, args.seuil)

