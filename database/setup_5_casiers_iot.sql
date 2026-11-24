-- ============================================================
-- Configuration KeyLocator : 5 Casiers (A1 à A5) + Intégration IoT ESP8266
-- Pins : A1 -> D3 | A2 -> D4 | A3 -> D5
-- Clés : A1: UE 11R | A2: C8 208 (c8 206) | A3: UG 5D | A4: SX9 | A5: EU6P
-- ============================================================

-- 1. Ajout de la colonne esp_pin dans casiers si absente
ALTER TABLE casiers ADD COLUMN IF NOT EXISTS esp_pin VARCHAR(10) DEFAULT NULL;

-- 2. Mise à jour de la durée LED à 10 secondes
UPDATE configurations SET valeur = '10' WHERE cle = 'led_duree_secondes';

-- 3. Nettoyer les mouvements de stock et scans des anciens casiers pour éviter les conflits FK
DELETE FROM mouvements_stock;
DELETE FROM scans;
DELETE FROM ebauche_photo;
DELETE FROM ebauches;
DELETE FROM etats_led;

-- 4. Conserver uniquement les casiers A1 à A5
DELETE FROM casiers WHERE code NOT IN ('A1', 'A2', 'A3', 'A4', 'A5');

-- 5. Mettre à jour / insérer les casiers A1 à A5 avec leurs pins ESP8266
INSERT INTO casiers (id, code, ligne, colonne, led_index, esp_pin, description, actif)
VALUES
(1, 'A1', 1, 1, 0, 'D3', 'Casier A1 — LED Pin D3 (UE 11R)', TRUE),
(2, 'A2', 1, 2, 1, 'D4', 'Casier A2 — LED Pin D4 (C8 208 / C8 206)', TRUE),
(3, 'A3', 1, 3, 2, 'D5', 'Casier A3 — LED Pin D5 (UG 5D)', TRUE),
(4, 'A4', 1, 4, 3, NULL, 'Casier A4 — (SX9)', TRUE),
(5, 'A5', 1, 5, 4, NULL, 'Casier A5 — (EU6P)', TRUE)
ON DUPLICATE KEY UPDATE 
    code = VALUES(code),
    ligne = VALUES(ligne),
    colonne = VALUES(colonne),
    led_index = VALUES(led_index),
    esp_pin = VALUES(esp_pin),
    description = VALUES(description),
    actif = TRUE;

-- 6. Initialiser les états LED pour A1 à A5
INSERT INTO etats_led (casier_id, actif, expire_a)
SELECT id, FALSE, NULL FROM casiers;

-- 7. Assurer la présence des modèles dans modeles_cles
INSERT INTO modeles_cles (id, reference, libelle, fabricant_id, yolo_label, description)
VALUES 
(1, 'SX9', 'Silca SX9 - Yale Y1 compatible', 1, 'SX9', 'Profil américain standard'),
(2, 'SX10', 'Silca SX10 - Yale Y11 compatible', 1, 'SX10', 'Profil américain renforcé'),
(3, 'EU6P', 'Silca EU6P - Vachette Radial', 1, 'EU6P', 'Profil européen radial'),
(11, 'C8 208', 'C8 208 / C8 206 Original', 1, 'C8 208', 'Clé profil C8 208 (compatible C8 206)'),
(12, 'UE 11R', 'Silca UE 11R', 1, 'UE 11R', 'Profil Silca UE 11R'),
(13, 'UG 5D', 'Silca UG 5D', 1, 'UG 5D', 'Profil Silca UG 5D')
ON DUPLICATE KEY UPDATE 
    reference = VALUES(reference),
    libelle = VALUES(libelle),
    yolo_label = VALUES(yolo_label),
    description = VALUES(description);

-- 8. Assigner le stock d'ébauches dans A1 à A5
INSERT INTO ebauches (id, modele_id, casier_id, classe_yolo, quantite, seuil_alerte, quantite_min)
VALUES
(1, 12, 1, 'UE 11R', 25, 5, 2), -- UE 11R -> A1 (Pin D3)
(2, 11, 2, 'C8 208', 20, 5, 2), -- C8 208 -> A2 (Pin D4)
(3, 13, 3, 'UG 5D',  18, 5, 2), -- UG 5D  -> A3 (Pin D5)
(4, 1,  4, 'SX9',    15, 5, 2), -- SX9    -> A4
(5, 3,  5, 'EU6P',   12, 5, 2)  -- EU6P   -> A5
ON DUPLICATE KEY UPDATE
    modele_id = VALUES(modele_id),
    casier_id = VALUES(casier_id),
    classe_yolo = VALUES(classe_yolo),
    quantite = VALUES(quantite);
