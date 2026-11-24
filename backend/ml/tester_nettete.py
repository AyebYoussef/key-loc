"""
Utilitaire CLI pour mesurer la netteté (variance du Laplacien) de vos vraies photos
et calibrer le paramètre BLUR_THRESHOLD dans .env.

Exemples d'utilisation (depuis le dossier backend/) :
  python ml/tester_nettete.py uploads/photo_cle.jpg
  python ml/tester_nettete.py uploads/photo_cle.jpg --seuil 80
  python ml/tester_nettete.py uploads/ebauches/SX9/ --seuil 100
"""
import argparse
import os
import sys

# Permettre l'import du package app depuis backend/
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.core.config import settings
from app.utils.image_utils import est_nette

EXTENSIONS_IMAGES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def analyser_fichier(chemin: str, seuil: float) -> None:
    if not os.path.isfile(chemin):
        print(f"❌ Fichier introuvable : {chemin}")
        return

    with open(chemin, "rb") as f:
        image_bytes = f.read()

    nette, score = est_nette(image_bytes, seuil=seuil)
    statut = "✅ NETTE" if nette else "❌ FLOUE"
    print(f"{statut} | Score Laplacien = {score:8.2f} | Seuil = {seuil:.1f} | {chemin}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Mesure la netteté (variance du Laplacien) d'une photo ou d'un dossier."
    )
    parser.add_argument("cible", help="Chemin vers une image ou un dossier d'images")
    parser.add_argument(
        "--seuil",
        type=float,
        default=settings.BLUR_THRESHOLD,
        help=f"Seuil de netteté BLUR_THRESHOLD à tester (défaut .env : {settings.BLUR_THRESHOLD})",
    )
    args = parser.parse_args()

    cible = args.cible
    if os.path.isdir(cible):
        fichiers = sorted(
            os.path.join(cible, nom)
            for nom in os.listdir(cible)
            if os.path.splitext(nom)[1].lower() in EXTENSIONS_IMAGES
        )
        if not fichiers:
            print(f"⚠️  Aucune image trouvée dans : {cible}")
            sys.exit(1)
        for chemin in fichiers:
            analyser_fichier(chemin, args.seuil)
    else:
        analyser_fichier(cible, args.seuil)


if __name__ == "__main__":
    main()

