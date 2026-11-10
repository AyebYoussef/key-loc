-- ============================================================
-- KeyLocator V1 - Script d'initialisation de la base MySQL
-- Compatible XAMPP / phpMyAdmin, port 3306
-- Champs V2 (IoT) déjà prévus mais non utilisés en V1
-- ============================================================

CREATE DATABASE IF NOT EXISTS keylocator CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE keylocator;

-- ============================================================
-- TABLE : roles
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    nom        VARCHAR(50) NOT NULL UNIQUE,  -- 'serrurier', 'gerant'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- TABLE : utilisateurs
-- ============================================================
CREATE TABLE IF NOT EXISTS utilisateurs (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    nom           VARCHAR(100) NOT NULL,
    prenom        VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    mot_de_passe  VARCHAR(255) NOT NULL,  -- bcrypt hash
    role_id       INT NOT NULL,
    actif         BOOLEAN DEFAULT TRUE,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_utilisateur_role FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE : fabricants
-- ============================================================
CREATE TABLE IF NOT EXISTS fabricants (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    nom        VARCHAR(100) NOT NULL UNIQUE,
    pays       VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- TABLE : modeles_cles
-- Description : modèles de clés reconnus par YOLO
-- ============================================================
CREATE TABLE IF NOT EXISTS modeles_cles (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    reference       VARCHAR(100) NOT NULL UNIQUE,  -- ex: 'YA1', 'SX9'
    libelle         VARCHAR(200) NOT NULL,
    fabricant_id    INT NOT NULL,
    image_reference VARCHAR(255),                  -- chemin vers l'image de référence
    yolo_label      VARCHAR(100),                  -- label utilisé dans le dataset YOLO
    description     TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_modele_fabricant FOREIGN KEY (fabricant_id) REFERENCES fabricants(id)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE : equivalences
-- Une ébauche peut avoir des équivalences chez d'autres fabricants
-- ============================================================
CREATE TABLE IF NOT EXISTS equivalences (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    modele_source_id INT NOT NULL,
    modele_equiv_id  INT NOT NULL,
    note             VARCHAR(255),
    CONSTRAINT fk_equiv_source FOREIGN KEY (modele_source_id) REFERENCES modeles_cles(id),
    CONSTRAINT fk_equiv_cible  FOREIGN KEY (modele_equiv_id)  REFERENCES modeles_cles(id),
    CONSTRAINT uq_equivalence  UNIQUE (modele_source_id, modele_equiv_id)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE : casiers
-- Champs V2 : led_index, esp32_id, esp32_statut
-- ============================================================
CREATE TABLE IF NOT EXISTS casiers (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    code          VARCHAR(20) NOT NULL UNIQUE,  -- ex: 'A1', 'B3'
    ligne         TINYINT NOT NULL,             -- position ligne (1-based)
    colonne       TINYINT NOT NULL,             -- position colonne (1-based)
    led_index     SMALLINT DEFAULT NULL,        -- [V2] index LED sur le panneau
    esp32_id      VARCHAR(50) DEFAULT NULL,     -- [V2] identifiant de l'ESP32 pilotant ce casier
    esp32_statut  ENUM('en_ligne','hors_ligne') DEFAULT 'hors_ligne', -- [V2]
    description   VARCHAR(255),
    actif         BOOLEAN DEFAULT TRUE,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_casier_position UNIQUE (ligne, colonne)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE : ebauches (stock d'ébauches dans les casiers)
-- ============================================================
CREATE TABLE IF NOT EXISTS ebauches (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    modele_id        INT NOT NULL,
    casier_id        INT NOT NULL,
    quantite         INT NOT NULL DEFAULT 0,
    seuil_alerte     INT NOT NULL DEFAULT 5,   -- alerte quand quantite <= seuil_alerte
    quantite_min     INT NOT NULL DEFAULT 0,   -- bloquant quand quantite <= quantite_min
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ebauche_modele FOREIGN KEY (modele_id) REFERENCES modeles_cles(id),
    CONSTRAINT fk_ebauche_casier FOREIGN KEY (casier_id) REFERENCES casiers(id),
    CONSTRAINT uq_ebauche_modele_casier UNIQUE (modele_id, casier_id)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE : mouvements_stock
-- Traçabilité de chaque prélèvement ou réapprovisionnement
-- ============================================================
CREATE TABLE IF NOT EXISTS mouvements_stock (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    ebauche_id      INT NOT NULL,
    utilisateur_id  INT NOT NULL,
    type_mouvement  ENUM('prelevement','reapprovisionnement','correction') NOT NULL,
    quantite        INT NOT NULL,              -- positif = entrée, négatif = sortie
    quantite_avant  INT NOT NULL,
    quantite_apres  INT NOT NULL,
    commentaire     TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mvt_ebauche      FOREIGN KEY (ebauche_id)     REFERENCES ebauches(id),
    CONSTRAINT fk_mvt_utilisateur  FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE : scans
-- Journalisation de chaque scan de clé
-- ============================================================
CREATE TABLE IF NOT EXISTS scans (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id      INT NOT NULL,
    image_path          VARCHAR(255),          -- chemin de la photo uploadée
    modele_detecte_id   INT DEFAULT NULL,      -- NULL si échec détection
    score_confiance     FLOAT DEFAULT NULL,    -- score YOLO (0.0 à 1.0)
    statut              ENUM('succes','echec_confiance','echec_detection','photo_floue') NOT NULL,
    ebauche_id          INT DEFAULT NULL,      -- ébauche proposée (si succès)
    guidage_active      BOOLEAN DEFAULT FALSE, -- LED virtuelle déclenchée
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_scan_utilisateur FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id),
    CONSTRAINT fk_scan_modele      FOREIGN KEY (modele_detecte_id) REFERENCES modeles_cles(id),
    CONSTRAINT fk_scan_ebauche     FOREIGN KEY (ebauche_id) REFERENCES ebauches(id)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE : etats_led (V1 : simulation, V2 : état réel via MQTT)
-- Stocke l'état instantané de l'allumage d'un casier
-- ============================================================
CREATE TABLE IF NOT EXISTS etats_led (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    casier_id   INT NOT NULL UNIQUE,
    actif       BOOLEAN DEFAULT FALSE,
    expire_a    DATETIME DEFAULT NULL,          -- timestamp d'extinction automatique
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_etat_led_casier FOREIGN KEY (casier_id) REFERENCES casiers(id)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE : configurations
-- Paramètres globaux de l'application (clé/valeur)
-- ============================================================
CREATE TABLE IF NOT EXISTS configurations (
    cle        VARCHAR(100) PRIMARY KEY,
    valeur     TEXT NOT NULL,
    description VARCHAR(255),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- DONNÉES DE TEST
-- ============================================================

-- Rôles
INSERT INTO roles (nom) VALUES ('serrurier'), ('gerant');

-- Utilisateurs (mot de passe = "Password1!" hashé bcrypt)
-- Hash bcrypt généré avec rounds=12 pour "Password1!"
INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role_id) VALUES
('Dupont',  'Jean',   'jean.dupont@keylocator.fr',  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewFh5LSi1Tv/YOOM', 1),
('Martin',  'Sophie', 'sophie.martin@keylocator.fr','$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewFh5LSi1Tv/YOOM', 2),
('Bernard', 'Marc',   'marc.bernard@keylocator.fr', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewFh5LSi1Tv/YOOM', 1);

-- Fabricants
INSERT INTO fabricants (nom, pays) VALUES
('Silca',      'Italie'),
('Errebi',     'Italie'),
('JMA',        'Espagne'),
('Keyline',    'Italie'),
('Lisi',       'France'),
('Yale',       'USA'),
('Mul-T-Lock', 'Israël');

-- Modèles de clés
INSERT INTO modeles_cles (reference, libelle, fabricant_id, yolo_label, description) VALUES
('SX9',    'Silca SX9 - Yale Y1 compatible',    1, 'SX9',    'Profil américain standard, Yale série 1'),
('SX10',   'Silca SX10 - Yale Y11 compatible',  1, 'SX10',   'Profil américain renforcé, Yale série 11'),
('EU6P',   'Silca EU6P - Vachette Radial',       1, 'EU6P',   'Profil européen, Vachette série Radial NT'),
('TE2',    'Silca TE2 - Tesa T60',               1, 'TE2',    'Profil espagnol, Tesa modèle 60'),
('JU3',    'Silca JU3 - Bricard Chifral',        1, 'JU3',    'Profil français, Bricard Chifral S'),
('Y1',     'Yale Y1 Original',                   6, 'Y1',     'Clé originale Yale Y1'),
('RR50',   'Errebi RR50 - Roto compatible',      2, 'RR50',   'Profil cylindre européen Roto'),
('JM1',    'JMA JM1 - Mul-T-Lock',               3, 'JM1',    'Profil haute sécurité Mul-T-Lock'),
('KL5',    'Keyline KL5 - Fichet compatible',    4, 'KL5',    'Profil français haute sécurité Fichet'),
('LI2',    'Lisi LI2 - Dom compatible',          5, 'LI2',    'Profil européen Dom Plura');

-- Équivalences
INSERT INTO equivalences (modele_source_id, modele_equiv_id, note) VALUES
(1, 6, 'SX9 (Silca) équivalent à Y1 (Yale)'),
(6, 1, 'Y1 (Yale) équivalent à SX9 (Silca)'),
(2, 6, 'SX10 (Silca) équivalent à Y1 (Yale) - version renforcée'),
(3, 7, 'EU6P (Silca) équivalent à RR50 (Errebi) - profil radial');

-- Casiers (grille 4 lignes x 5 colonnes = 20 casiers)
INSERT INTO casiers (code, ligne, colonne, led_index, description) VALUES
('A1', 1, 1, 0,  'Rangée A, colonne 1'),
('A2', 1, 2, 1,  'Rangée A, colonne 2'),
('A3', 1, 3, 2,  'Rangée A, colonne 3'),
('A4', 1, 4, 3,  'Rangée A, colonne 4'),
('A5', 1, 5, 4,  'Rangée A, colonne 5'),
('B1', 2, 1, 5,  'Rangée B, colonne 1'),
('B2', 2, 2, 6,  'Rangée B, colonne 2'),
('B3', 2, 3, 7,  'Rangée B, colonne 3'),
('B4', 2, 4, 8,  'Rangée B, colonne 4'),
('B5', 2, 5, 9,  'Rangée B, colonne 5'),
('C1', 3, 1, 10, 'Rangée C, colonne 1'),
('C2', 3, 2, 11, 'Rangée C, colonne 2'),
('C3', 3, 3, 12, 'Rangée C, colonne 3'),
('C4', 3, 4, 13, 'Rangée C, colonne 4'),
('C5', 3, 5, 14, 'Rangée C, colonne 5'),
('D1', 4, 1, 15, 'Rangée D, colonne 1'),
('D2', 4, 2, 16, 'Rangée D, colonne 2'),
('D3', 4, 3, 17, 'Rangée D, colonne 3'),
('D4', 4, 4, 18, 'Rangée D, colonne 4'),
('D5', 4, 5, 19, 'Rangée D, colonne 5');

-- Ébauches (stock initial)
INSERT INTO ebauches (modele_id, casier_id, quantite, seuil_alerte, quantite_min) VALUES
(1,  1,  25, 5, 2),   -- SX9    -> A1
(2,  2,  18, 5, 2),   -- SX10   -> A2
(3,  3,  30, 5, 2),   -- EU6P   -> A3
(4,  4,  12, 5, 2),   -- TE2    -> A4
(5,  5,   4, 5, 2),   -- JU3    -> A5 (alerte !)
(6,  6,  22, 5, 2),   -- Y1     -> B1
(7,  7,   2, 5, 2),   -- RR50   -> B2 (critique !)
(8,  8,  15, 5, 2),   -- JM1    -> B3
(9,  9,   0, 5, 2),   -- KL5    -> B4 (épuisé !)
(10, 10,  8, 5, 2);   -- LI2    -> B5

-- États LED (initialisés à éteint)
INSERT INTO etats_led (casier_id, actif, expire_a)
SELECT id, FALSE, NULL FROM casiers;

-- Configurations
INSERT INTO configurations (cle, valeur, description) VALUES
('yolo_seuil_confiance', '0.6',         'Seuil minimal de confiance YOLO pour accepter une détection'),
('led_duree_secondes',   '15',          'Durée d''allumage du guidage lumineux en secondes'),
('led_mode',             'simulated',   'Mode LED : simulated (V1) ou mqtt (V2)'),
('app_nom',              'KeyLocator',  'Nom de l''application'),
('app_version',          '1.0.0',       'Version courante');
