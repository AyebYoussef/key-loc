-- ============================================================================
-- Migration KeyLocator : Photos de référence & classe_yolo pour YOLO Classify
-- Compatible XAMPP / MariaDB 10.4+ (sans perte de données existantes)
-- ============================================================================

USE keylocator;

-- 1. Ajouter la colonne classe_yolo à la table ebauches (si absente)
ALTER TABLE ebauches
    ADD COLUMN IF NOT EXISTS classe_yolo VARCHAR(100) NULL AFTER casier_id;

-- 2. Générer automatiquement classe_yolo depuis modeles_cles (sans espaces ni accents courants)
UPDATE ebauches e
JOIN modeles_cles m ON m.id = e.modele_id
SET e.classe_yolo = REPLACE(
    REPLACE(
        REPLACE(
            REPLACE(
                REPLACE(
                    REPLACE(
                        COALESCE(NULLIF(TRIM(m.yolo_label), ''), TRIM(m.reference)),
                        ' ', '_'
                    ),
                    'é', 'e'
                ),
                'è', 'e'
            ),
            'ê', 'e'
        ),
        'à', 'a'
    ),
    'ç', 'c'
)
WHERE e.classe_yolo IS NULL OR e.classe_yolo = '';

-- 3. Créer la table ebauche_photo avec suppression en cascade
CREATE TABLE IF NOT EXISTS ebauche_photo (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    ebauche_id     INT NOT NULL,
    chemin_fichier VARCHAR(255) NOT NULL,
    source         ENUM('catalogue', 'telephone', 'scan_confirme') NOT NULL DEFAULT 'catalogue',
    date_ajout     DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ebauche_photo_ebauche
        FOREIGN KEY (ebauche_id) REFERENCES ebauches(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. Index pour accélérer le comptage et l'export par ébauche
CREATE INDEX IF NOT EXISTS idx_ebauche_photo_ebauche_id ON ebauche_photo(ebauche_id);

