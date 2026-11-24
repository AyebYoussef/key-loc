export interface Role {
  id: number;
  nom: 'serrurier' | 'gerant';
}

export interface Utilisateur {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  actif: boolean;
  role: Role;
  created_at: string;
}

export interface Fabricant {
  id: number;
  nom: string;
  pays?: string;
  created_at: string;
}

export interface ModeleCle {
  id: number;
  reference: string;
  libelle: string;
  fabricant_id: number;
  fabricant?: Fabricant;
  image_reference?: string;
  yolo_label?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  equivalences?: ModeleCle[];
}

export interface Casier {
  id: number;
  code: string;
  ligne: number;
  colonne: number;
  description?: string;
  led_index?: number;
  esp32_id?: string;
  esp32_statut: 'en_ligne' | 'hors_ligne';
  actif: boolean;
  etat_led?: EtatLed;
  created_at: string;
}

export interface EtatLed {
  casier_id: number;
  actif: boolean;
  expire_a?: string | null;
  updated_at?: string;
}

export interface Ebauche {
  id: number;
  modele_id: number;
  casier_id: number;
  classe_yolo?: string;
  nb_photos?: number;
  quantite: number;
  seuil_alerte: number;
  quantite_min: number;
  statut_stock: 'ok' | 'alerte' | 'epuise';
  modele: ModeleCle;
  casier: Casier;
  created_at: string;
  updated_at: string;
}

export interface EbauchePhoto {
  id: number;
  ebauche_id: number;
  chemin_fichier: string;
  url: string;
  source: 'catalogue' | 'telephone' | 'scan_confirme';
  date_ajout: string;
}

export interface EbauchePhotosUploadResponse {
  ebauche_id: number;
  classe_yolo: string;
  ajoutees: number;
  total_photos: number;
  photos: EbauchePhoto[];
}

export interface DatasetModeleStatus {
  ebauche_id: number;
  modele_id: number;
  reference: string;
  libelle: string;
  classe_yolo: string;
  nb_photos: number;
  seuil_requis: number;
  pret: boolean;
  manquantes: number;
}

export interface DatasetStatusResponse {
  seuil_requis: number;
  total_modeles: number;
  modeles_prets: number;
  total_photos: number;
  modeles: DatasetModeleStatus[];
}

export interface DatasetExcludedModel {
  reference: string;
  classe_yolo: string;
  nb_photos: number;
  raison: string;
}

export interface DatasetExportSummary {
  classes_incluses: number;
  total_images: number;
  train_images: number;
  val_images: number;
}

export interface TopPrediction {
  classe: string;
  confiance: number;
}

export interface ScanResultat {
  statut: 'ok' | 'photo_floue' | 'non_reconnue' | 'modele_inexistant';
  message: string;
  modele?: ModeleCle;
  score_confiance?: number;
  top3?: TopPrediction[];
  ebauche?: Ebauche;
  casier?: Casier;
  equivalences?: ModeleCle[];
  scan_id?: number;
}

export interface StatDashboard {
  total_modeles: number;
  total_ebauches: number;
  ebauches_en_alerte: number;
  ebauches_epuisees: number;
  prelevements_aujourd_hui: number;
  prelevements_semaine: number;
  scans_aujourd_hui: number;
}

