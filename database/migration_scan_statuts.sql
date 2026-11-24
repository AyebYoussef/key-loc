-- ============================================================================
-- Migration KeyLocator : Alignement des statuts de scan pour YOLO Classification
-- Statuts : ok | photo_floue | non_reconnue | modele_inexistant
-- Compatible XAMPP / MariaDB 10.4+ (sans perte de données existantes)
-- ============================================================================

USE keylocator;

-- 1. Étendre temporairement l'ENUM pour conserver les lignes existantes
ALTER TABLE scans
    MODIFY COLUMN statut ENUM(
        'succes', 'echec_confiance', 'echec_detection', 'photo_floue',
        'ok', 'non_reconnue', 'modele_inexistant'
    ) NOT NULL;

-- 2. Migrer les anciennes valeurs vers les nouveaux statuts
UPDATE scans SET statut = 'ok'                WHERE statut = 'succes';
UPDATE scans SET statut = 'non_reconnue'      WHERE statut = 'echec_confiance';
UPDATE scans SET statut = 'modele_inexistant' WHERE statut = 'echec_detection';

-- 3. Restreindre l'ENUM aux 4 statuts finaux
ALTER TABLE scans
    MODIFY COLUMN statut ENUM('ok', 'photo_floue', 'non_reconnue', 'modele_inexistant') NOT NULL;

