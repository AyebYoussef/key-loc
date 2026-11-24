-- ============================================================
-- Ajout des modèles entraînés YOLO : C8 208, UE 11R, UG 5D
-- À exécuter dans phpMyAdmin sur la base keylocator
-- ============================================================

INSERT INTO modeles_cles (reference, libelle, fabricant_id, yolo_label, description)
VALUES 
('C8 208', 'C8 208 Original', 1, 'C8 208', 'Clé profil C8 208'),
('UE 11R', 'Silca UE 11R', 1, 'UE 11R', 'Profil Silca UE 11R'),
('UG 5D', 'Silca UG 5D', 1, 'UG 5D', 'Profil Silca UG 5D')
ON DUPLICATE KEY UPDATE yolo_label = VALUES(yolo_label);

-- Associer aux casiers C1 (id 11), C2 (id 12), C3 (id 13)
INSERT INTO ebauches (modele_id, casier_id, classe_yolo, quantite, seuil_alerte, quantite_min)
SELECT m.id, 11, 'C8 208', 25, 5, 2 FROM modeles_cles m WHERE m.reference = 'C8 208'
ON DUPLICATE KEY UPDATE classe_yolo = 'C8 208', quantite = 25;

INSERT INTO ebauches (modele_id, casier_id, classe_yolo, quantite, seuil_alerte, quantite_min)
SELECT m.id, 12, 'UE 11R', 20, 5, 2 FROM modeles_cles m WHERE m.reference = 'UE 11R'
ON DUPLICATE KEY UPDATE classe_yolo = 'UE 11R', quantite = 20;

INSERT INTO ebauches (modele_id, casier_id, classe_yolo, quantite, seuil_alerte, quantite_min)
SELECT m.id, 13, 'UG 5D', 15, 5, 2 FROM modeles_cles m WHERE m.reference = 'UG 5D'
ON DUPLICATE KEY UPDATE classe_yolo = 'UG 5D', quantite = 15;
