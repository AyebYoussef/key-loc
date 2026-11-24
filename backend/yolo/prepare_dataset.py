"""
Script de préparation et d'augmentation du dataset YOLOv8 Classification.
Usage :
    cd backend
    venv\\Scripts\\python yolo/prepare_dataset.py

Fonctionnement :
1. Vous téléchargez 3 à 10 photos par modèle de clé depuis Internet (Google Images, catalogues Silca/JMA).
2. Vous les rangez dans des sous-dossiers :
       backend/yolo/raw_images/
         SX9/    (images téléchargées pour SX9)
         TE2/    (images téléchargées pour TE2)
         EU6P/
         ...
3. Ce script s'occupe de TOUT le reste :
   - Redimensionnement et cadrage propre.
   - Augmentation réaliste (rotations légères, variations d'éclairage et contraste).
     *Note : Pas d'inversion miroir car les rainures gauche/droite d'une clé sont distinctives.*
   - Répartition automatique en train (80%) et val (20%) dans backend/yolo/dataset/.
"""
from pathlib import Path
import random
import shutil
from PIL import Image, ImageEnhance, ImageOps

RAW_DIR = Path(__file__).resolve().parent / "raw_images"
DATASET_DIR = Path(__file__).resolve().parent / "dataset"
TRAIN_DIR = DATASET_DIR / "train"
VAL_DIR = DATASET_DIR / "val"

SUPPORTED_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def preparer_image_carree(img: Image.Image, taille: int = 416) -> Image.Image:
    """Rend l'image carrée avec marges neutres pour éviter la déformation de la clé."""
    img = ImageOps.exif_transpose(img).convert("RGB")
    w, h = img.size
    max_dim = max(w, h)

    # Déterminer la couleur de fond par la médiane des bords
    carre = Image.new("RGB", (max_dim, max_dim), (240, 240, 240))
    carre.paste(img, ((max_dim - w) // 2, (max_dim - h) // 2))
    return carre.resize((taille, taille), Image.Resampling.LANCZOS)


def generer_variations(img_base: Image.Image, nb_voulu: int) -> list[Image.Image]:
    """Génère des variations réalistes simulant un smartphone ou une webcam."""
    variations = [img_base]

    angles = [-14, -10, -6, -3, 3, 6, 10, 14]
    luminosites = [0.8, 0.9, 1.1, 1.2, 1.3]
    contrastes = [0.85, 0.95, 1.1, 1.2]

    while len(variations) < nb_voulu:
        v = img_base.copy()

        # Rotation légère (clé posée sur une table)
        if random.random() > 0.3:
            angle = random.choice(angles)
            v = v.rotate(angle, resample=Image.Resampling.BILINEAR, fillcolor=(240, 240, 240))

        # Variation d'éclairage
        if random.random() > 0.3:
            lum = random.choice(luminosites)
            v = ImageEnhance.Brightness(v).enhance(lum)

        # Variation de contraste
        if random.random() > 0.4:
            con = random.choice(contrastes)
            v = ImageEnhance.Contrast(v).enhance(con)

        variations.append(v)

    return variations[:nb_voulu]


def traiter():
    if not RAW_DIR.exists():
        RAW_DIR.mkdir(parents=True, exist_ok=True)
        print("=" * 60)
        print("📁 Dossier créé :", RAW_DIR)
        print("=" * 60)
        print("Pour commencer :")
        print("1. Créez un sous-dossier par clé dans 'yolo/raw_images/' :")
        print("   Ex: yolo/raw_images/SX9/")
        print("       yolo/raw_images/TE2/")
        print("       yolo/raw_images/EU6P/")
        print("2. Déposez-y entre 3 et 10 photos téléchargées depuis le net.")
        print("3. Relancez ce script !")
        return

    classes = [d for d in RAW_DIR.iterdir() if d.is_dir()]
    if not classes:
        print(f"⚠️ Aucun sous-dossier trouvé dans {RAW_DIR}")
        print("Créez des sous-dossiers correspondant à vos modèles (ex: SX9, TE2, EU6P...)")
        return

    # Nettoyage et recréation de dataset/train et dataset/val
    if TRAIN_DIR.exists():
        shutil.rmtree(TRAIN_DIR)
    if VAL_DIR.exists():
        shutil.rmtree(VAL_DIR)

    TRAIN_DIR.mkdir(parents=True, exist_ok=True)
    VAL_DIR.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("   Génération & Augmentation du Dataset YOLO")
    print("=" * 60)

    total_train = 0
    total_val = 0

    for classe_dir in classes:
        classe_nom = classe_dir.name
        fichiers = [f for f in classe_dir.iterdir() if f.is_file() and f.suffix.lower() in SUPPORTED_EXTS]

        if not fichiers:
            print(f"⚠️ Classe '{classe_nom}' ignorée : aucune image valide.")
            continue

        images_base = []
        for f in fichiers:
            try:
                with Image.open(f) as img:
                    images_base.append(preparer_image_carree(img))
            except Exception as e:
                print(f"  Erreur lecture {f.name} : {e}")

        if not images_base:
            continue

        # Objectif : ~35 images d'entraînement et ~10 images de validation par classe
        nb_train_cible = 35
        nb_val_cible = 10

        # Séparer les bases en train / val
        random.shuffle(images_base)
        if len(images_base) >= 2:
            base_val = [images_base[0]]
            base_train = images_base[1:]
        else:
            base_val = images_base
            base_train = images_base

        train_variations = []
        for img in base_train:
            train_variations.extend(generer_variations(img, max(1, nb_train_cible // len(base_train))))

        val_variations = []
        for img in base_val:
            val_variations.extend(generer_variations(img, max(1, nb_val_cible // len(base_val))))

        # Sauvegarde
        dest_train = TRAIN_DIR / classe_nom
        dest_val = VAL_DIR / classe_nom
        dest_train.mkdir(parents=True, exist_ok=True)
        dest_val.mkdir(parents=True, exist_ok=True)

        for i, img in enumerate(train_variations):
            img.save(dest_train / f"{classe_nom}_train_{i+1:03d}.jpg", quality=92)
            total_train += 1

        for i, img in enumerate(val_variations):
            img.save(dest_val / f"{classe_nom}_val_{i+1:03d}.jpg", quality=92)
            total_val += 1

        print(f"✅ Classe '{classe_nom}' : {len(fichiers)} image(s) source -> {len(train_variations)} train, {len(val_variations)} val")

    print("=" * 60)
    print(f"🎉 Dataset prêt : {total_train} images train, {total_val} images val.")
    print("👉 Vous pouvez maintenant lancer l'entraînement avec :")
    print("   cd backend && venv\\Scripts\\python yolo/train.py")
    print("=" * 60)


if __name__ == "__main__":
    traiter()
