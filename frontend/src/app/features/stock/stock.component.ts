import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpEventType, HttpResponse } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import {
  Casier,
  DatasetExcludedModel,
  DatasetExportSummary,
  Ebauche,
  EbauchePhoto,
  Fabricant,
  ModeleCle,
} from '../../core/models/models';

interface PendingPhotoPreview {
  file: File;
  previewUrl: string;
  sizeLabel: string;
}

interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'warning';
  title: string;
  text: string;
}

@Component({
  selector: 'app-stock',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="stock-page">
      <!-- Pile de Toasts flottants -->
      <div class="toast-container" *ngIf="toasts.length > 0">
        <div class="toast-item" *ngFor="let t of toasts" [ngClass]="t.type">
          <div class="toast-body">
            <strong>{{ t.title }}</strong>
            <p>{{ t.text }}</p>
          </div>
          <button class="toast-close" (click)="fermerToast(t.id)" aria-label="Fermer">×</button>
        </div>
      </div>

      <!-- En-tête -->
      <div class="page-header">
        <div>
          <h1>Gestion des Stocks & Affectation des Casiers</h1>
          <p class="subtitle">Inventaire en temps réel · Ajout de nouvelles clés · Photos de référence YOLO & export dataset</p>
        </div>
        <div class="header-actions">
          <button
            *ngIf="authService.isGerant"
            class="btn btn-secondary export-btn"
            (click)="exporterDataset()"
            [disabled]="exportEnCours"
            title="Télécharger l'archive ZIP train/val pour entraîner YOLO sur Google Colab"
          >
            {{ exportEnCours ? '⏳ Génération du ZIP...' : '📦 Exporter le dataset' }}
          </button>
          <button class="btn btn-primary add-btn" (click)="ouvrirModalAjout()">
            ➕ Ajouter une Clé au Stock
          </button>
        </div>
      </div>

      <!-- Résumé / Alerte d'export (modèles exclus faute de photos) -->
      <div class="export-alert card" *ngIf="dernierExportInfo">
        <div class="export-alert-header">
          <div>
            <strong>📦 Export YOLO terminé</strong>
            <span class="export-stats" *ngIf="dernierExportInfo.summary">
              · {{ dernierExportInfo.summary.classes_incluses }} classe(s) incluse(s) ·
              {{ dernierExportInfo.summary.train_images }} train / {{ dernierExportInfo.summary.val_images }} val
            </span>
          </div>
          <button class="close-btn" (click)="dernierExportInfo = null">×</button>
        </div>
        <div class="excluded-list" *ngIf="dernierExportInfo.excluded.length > 0">
          <span class="excluded-title">⚠️ Modèles exclus (moins de 2 photos) :</span>
          <div class="excluded-pills">
            <span class="excluded-pill" *ngFor="let ex of dernierExportInfo.excluded">
              {{ ex.reference }} ({{ ex.nb_photos }} photo{{ ex.nb_photos > 1 ? 's' : '' }})
            </span>
          </div>
        </div>
      </div>

      <!-- Filtres et Recherche -->
      <div class="toolbar card">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" [(ngModel)]="rechercheTexte" placeholder="Rechercher par référence, modèle ou code casier (ex: SX9, A1)..." />
        </div>
        <div class="filter-group">
          <button class="btn btn-sm" [class.btn-primary]="filtreStatut === ''" (click)="filtrer('')">Tous ({{ ebauches.length }})</button>
          <button class="btn btn-sm" [class.btn-primary]="filtreStatut === 'alerte'" (click)="filtrer('alerte')">Alertes</button>
          <button class="btn btn-sm" [class.btn-primary]="filtreStatut === 'epuise'" (click)="filtrer('epuise')">Épuisés</button>
        </div>
      </div>

      <!-- Table Principale du Stock -->
      <div class="card table-card">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Référence</th>
              <th>Désignation & Fabricant</th>
              <th>Emplacement Casier</th>
              <th>Quantité</th>
              <th>Seuil Min</th>
              <th>Statut</th>
              <th>Photos IA</th>
              <th style="text-align: right">Actions & Affectation</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of ebauchesFiltrees">
              <td>
                <span class="ref-badge">{{ item.modele.reference }}</span>
              </td>
              <td>
                <div class="designation-cell">
                  <span class="libelle">{{ item.modele.libelle }}</span>
                  <span class="fabricant-sub" *ngIf="item.modele.fabricant">{{ item.modele.fabricant.nom }}</span>
                </div>
              </td>
              <td>
                <div class="casier-cell">
                  <span class="casier-pill">📍 {{ item.casier.code }}</span>
                  <span class="pos-info">L{{ item.casier.ligne }}-C{{ item.casier.colonne }}</span>
                </div>
              </td>
              <td class="font-bold">
                <span [class.text-danger]="item.quantite <= item.quantite_min" [class.text-warning]="item.quantite <= item.seuil_alerte && item.quantite > item.quantite_min">
                  {{ item.quantite }} unités
                </span>
              </td>
              <td>{{ item.seuil_alerte }}</td>
              <td>
                <span class="badge" [ngClass]="item.statut_stock">{{ item.statut_stock }}</span>
              </td>
              <td>
                <button
                  type="button"
                  class="photo-status-badge"
                  [class.ready]="(item.nb_photos || 0) >= seuilPhotos"
                  [class.pending]="(item.nb_photos || 0) < seuilPhotos"
                  (click)="ouvrirGalerie(item)"
                  title="Ouvrir la galerie des photos de référence"
                >
                  <span *ngIf="(item.nb_photos || 0) >= seuilPhotos">
                    ✓ Photos : {{ item.nb_photos || 0 }} / {{ seuilPhotos }} · Prêt pour l'entraînement
                  </span>
                  <span *ngIf="(item.nb_photos || 0) < seuilPhotos">
                    📷 Photos : {{ item.nb_photos || 0 }} / {{ seuilPhotos }}
                  </span>
                </button>
              </td>
              <td style="text-align: right">
                <div class="action-buttons">
                  <button class="btn btn-secondary btn-xs" (click)="ouvrirGalerie(item)" title="Voir / gérer les photos de référence">
                    🖼️ Galerie
                  </button>
                  <button class="btn btn-secondary btn-xs" (click)="allumer(item.casier_id)" title="Allumer la LED de ce casier pour le localiser">
                    💡 Allumer
                  </button>
                  <button class="btn btn-primary btn-xs" (click)="prelever(item)" [disabled]="item.quantite <= item.quantite_min" title="Prélever 1 ébauche">
                    -1 Prélever
                  </button>
                  <button class="btn btn-secondary btn-xs" (click)="reapprovisionner(item)" title="Ajouter du stock">
                    + Réappro
                  </button>
                  <button class="btn btn-outline-primary btn-xs" (click)="ouvrirModalDeplacement(item)" title="Changer l'emplacement de cette clé dans un autre casier">
                    📍 Déplacer
                  </button>
                  <button class="btn btn-danger-icon btn-xs" (click)="supprimerEbauche(item)" title="Retirer du stock">
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
            <tr *ngIf="ebauchesFiltrees.length === 0">
              <td colspan="8" class="empty-row">
                Aucune clé trouvée correspondant à vos critères.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- MODAL 1 : AJOUTER UNE NOUVELLE CLÉ AU STOCK -->
      <div class="modal-backdrop" *ngIf="modalAjoutOuverte" (click)="fermerModalAjout()">
        <div class="modal-content modal-lg" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>➕ Ajouter une Nouvelle Clé au Stock</h3>
            <button class="close-btn" (click)="fermerModalAjout()">×</button>
          </div>

          <div class="modal-body">
            <!-- Mode choix modèle existant vs nouveau modèle -->
            <div class="model-choice-tabs">
              <button type="button" [class.active]="!modeCreationModele" (click)="basculerOngletAjout(false)">
                Sélectionner un modèle existant ({{ modeles.length }})
              </button>
              <button type="button" [class.active]="modeCreationModele" (click)="basculerOngletAjout(true)">
                + Créer un nouveau profil / référence
              </button>
            </div>

            <!-- CHOIX 1 : Modèle existant -->
            <div *ngIf="!modeCreationModele" class="existing-model-block">
              <div class="form-group">
                <label for="select-modele">Modèle de clé *</label>
                <div class="model-select-row">
                  <select id="select-modele" [(ngModel)]="nouvelleEbauche.modele_id" class="form-input">
                    <option [ngValue]="null" disabled>-- Choisir une référence de clé --</option>
                    <option *ngFor="let m of modeles" [ngValue]="m.id">
                      {{ m.reference }} - {{ m.libelle }} {{ m.fabricant ? '(' + m.fabricant.nom + ')' : '' }}
                    </option>
                  </select>
                  <button
                    *ngIf="authService.isGerant"
                    type="button"
                    class="btn btn-secondary toggle-photos-btn"
                    (click)="afficherZonePhotosExistant = !afficherZonePhotosExistant"
                  >
                    📷 {{ afficherZonePhotosExistant ? 'Masquer les photos' : 'Ajouter des photos' }}
                    <span *ngIf="photosEnAttente.length > 0">({{ photosEnAttente.length }})</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- CHOIX 2 : Nouveau Modèle -->
            <div *ngIf="modeCreationModele" class="new-model-box">
              <div class="form-row">
                <div class="form-group">
                  <label>Référence (ex: SILCA HU66) *</label>
                  <input type="text" [(ngModel)]="nouveauModele.reference" placeholder="ex: HU66, VA2, SX9..." class="form-input" />
                </div>
                <div class="form-group">
                  <label>Fabricant / Marque *</label>
                  <select [(ngModel)]="nouveauModele.fabricant_id" class="form-input">
                    <option [ngValue]="null" disabled>-- Fabricant --</option>
                    <option *ngFor="let f of fabricants" [ngValue]="f.id">{{ f.nom }}</option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label>Désignation / Application véhicule</label>
                <input type="text" [(ngModel)]="nouveauModele.libelle" placeholder="ex: Clé Audi / Volkswagen à vague" class="form-input" />
              </div>
            </div>

            <!-- ZONE PHOTOS DE RÉFÉRENCE (affichée d'office en création, ou au clic sur Ajouter des photos) -->
            <div class="photos-upload-section" *ngIf="authService.isGerant && (modeCreationModele || afficherZonePhotosExistant)">
              <div class="photos-section-header">
                <label>Photos de référence (Entraînement YOLO)</label>
                <div class="source-selector">
                  <span>Source :</span>
                  <select [(ngModel)]="sourceUpload" class="form-input input-compact">
                    <option value="catalogue">Catalogue</option>
                    <option value="telephone">Téléphone</option>
                  </select>
                </div>
              </div>

              <div
                class="dropzone-photos"
                [class.drag-active]="isDragOverModal"
                (dragover)="onDragOver($event, 'modal')"
                (dragleave)="onDragLeave('modal')"
                (drop)="onDrop($event, 'modal')"
                (click)="fileInputModal.click()"
              >
                <input
                  #fileInputModal
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  (change)="onPhotosSelected($event, 'modal')"
                  style="display: none"
                />
                <span class="drop-icon">📸</span>
                <p class="drop-title">Glissez-déposez vos photos ici ou cliquez pour parcourir</p>
                <p class="drop-formats">Formats acceptés : JPG, JPEG, PNG, WEBP · Max 5 Mo par photo</p>
                <button type="button" class="btn btn-secondary btn-xs mt-1" (click)="$event.stopPropagation(); fileInputModal.click()">
                  Parcourir les fichiers
                </button>
              </div>

              <p class="photo-help-text">
                Ajoutez 30 photos ou plus : différents angles, éclairages et arrière-plans, recto et verso de la clé.
              </p>

              <!-- Miniatures sélectionnées -->
              <div class="pending-thumbs-grid" *ngIf="photosEnAttente.length > 0">
                <div class="thumb-card" *ngFor="let p of photosEnAttente; let i = index">
                  <img [src]="p.previewUrl" [alt]="p.file.name" />
                  <button type="button" class="remove-thumb-btn" (click)="retirerPhotoEnAttente(i)" title="Retirer cette photo">×</button>
                  <span class="thumb-meta">{{ p.sizeLabel }}</span>
                </div>
              </div>

              <!-- Raccourci envoi direct si modèle existant déjà en stock -->
              <div class="direct-upload-bar" *ngIf="!modeCreationModele && photosEnAttente.length > 0 && ebaucheExistantePourSelection">
                <span class="direct-hint">
                  Ce modèle existe déjà (Casier {{ ebaucheExistantePourSelection.casier.code }}).
                </span>
                <button
                  type="button"
                  class="btn btn-outline-primary btn-xs"
                  (click)="envoyerPhotosDirectementPourSelection()"
                  [disabled]="soumissionEnCours"
                >
                  ⬆️ Envoyer ces {{ photosEnAttente.length }} photo(s) maintenant
                </button>
              </div>

              <!-- Barre de progression upload -->
              <div class="progress-wrapper" *ngIf="uploadEnCours">
                <div class="progress-label">
                  <span>Envoi des photos en cours...</span>
                  <span>{{ uploadProgress }} %</span>
                </div>
                <div class="progress-track">
                  <div class="progress-bar" [style.width.%]="uploadProgress"></div>
                </div>
              </div>
            </div>

            <!-- CHOIX DU CASIER (EMPLACEMENT) -->
            <div class="form-group">
              <label for="select-casier">Casier d'affectation (Position physique) *</label>
              <div class="casier-select-wrapper">
                <select id="select-casier" [(ngModel)]="nouvelleEbauche.casier_id" class="form-input">
                  <option [ngValue]="null" disabled>-- Sélectionner un casier disponible --</option>
                  <option *ngFor="let c of casiers" [ngValue]="c.id">
                    Casier {{ c.code }} (Ligne {{ c.ligne }}, Col {{ c.colonne }}) {{ getCasierInfo(c.id) }}
                  </option>
                </select>
                <button type="button" class="btn btn-secondary test-led-btn" (click)="testerLedCasier(nouvelleEbauche.casier_id)" [disabled]="!nouvelleEbauche.casier_id" title="Allumer la LED de ce casier pour vérifier son emplacement réel">
                  💡 Tester LED
                </button>
              </div>
            </div>

            <!-- QUANTITÉS -->
            <div class="form-row">
              <div class="form-group">
                <label>Quantité initiale reçue *</label>
                <input type="number" [(ngModel)]="nouvelleEbauche.quantite" min="1" class="form-input" />
              </div>
              <div class="form-group">
                <label>Seuil d'alerte (stock bas)</label>
                <input type="number" [(ngModel)]="nouvelleEbauche.seuil_alerte" min="1" class="form-input" />
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="fermerModalAjout()" [disabled]="soumissionEnCours">Annuler</button>
            <button type="button" class="btn btn-primary" (click)="enregistrerNouvelleEbauche()" [disabled]="soumissionEnCours">
              {{ soumissionEnCours ? 'Enregistrement...' : '✓ Enregistrer & Assigner au Casier' }}
            </button>
          </div>
        </div>
      </div>

      <!-- MODAL 2 : CHANGER LA POSITION / CASIER D'UNE CLÉ -->
      <div class="modal-backdrop" *ngIf="modalDeplacementOuverte && ebaucheEnDeplacement" (click)="fermerModalDeplacement()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>📍 Déplacer la Clé dans un Autre Casier</h3>
            <button class="close-btn" (click)="fermerModalDeplacement()">×</button>
          </div>

          <div class="modal-body">
            <div class="current-position-banner">
              <div class="key-summary">
                <span class="ref-title">{{ ebaucheEnDeplacement.modele.reference }}</span>
                <span class="lib-sub">{{ ebaucheEnDeplacement.modele.libelle }}</span>
              </div>
              <div class="pos-badge">
                Emplacement actuel : <strong>Casier {{ ebaucheEnDeplacement.casier.code }}</strong> (Ligne {{ ebaucheEnDeplacement.casier.ligne }}, Col {{ ebaucheEnDeplacement.casier.colonne }})
              </div>
            </div>

            <div class="form-group mt-3">
              <label for="select-nouveau-casier">Nouveau Casier de destination *</label>
              <div class="casier-select-wrapper">
                <select id="select-nouveau-casier" [(ngModel)]="nouveauCasierId" class="form-input">
                  <option [ngValue]="null" disabled>-- Choisir le nouveau casier --</option>
                  <option *ngFor="let c of casiers" [ngValue]="c.id" [disabled]="c.id === ebaucheEnDeplacement.casier_id">
                    Casier {{ c.code }} (Ligne {{ c.ligne }}, Col {{ c.colonne }}) {{ c.id === ebaucheEnDeplacement.casier_id ? '(Actuel)' : getCasierInfo(c.id) }}
                  </option>
                </select>
                <button type="button" class="btn btn-secondary test-led-btn" (click)="testerLedCasier(nouveauCasierId)" [disabled]="!nouveauCasierId" title="Allumer la LED du nouveau casier">
                  💡 Allumer LED
                </button>
              </div>
            </div>

            <p class="help-text">
              💡 Le casier sélectionné s'allumera automatiquement pour vous guider lors du rangement des clés dans le panneau mural.
            </p>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="fermerModalDeplacement()">Annuler</button>
            <button type="button" class="btn btn-primary" (click)="confirmerDeplacement()" [disabled]="!nouveauCasierId || nouveauCasierId === ebaucheEnDeplacement.casier_id || soumissionEnCours">
              {{ soumissionEnCours ? 'Déplacement en cours...' : '✓ Confirmer le Changement de Casier' }}
            </button>
          </div>
        </div>
      </div>

      <!-- MODAL 3 : GALERIE DE PHOTOS PAR MODÈLE / ÉBAUCHE -->
      <div class="modal-backdrop" *ngIf="modalGalerieOuverte && ebaucheGalerie" (click)="fermerGalerie()">
        <div class="modal-content modal-xl" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="gallery-title-group">
              <h3>🖼️ Photos de référence — {{ ebaucheGalerie.modele.reference }}</h3>
              <div class="gallery-badges">
                <span class="yolo-class-pill" *ngIf="ebaucheGalerie.classe_yolo">Classe YOLO : {{ ebaucheGalerie.classe_yolo }}</span>
                <span
                  class="photo-status-badge"
                  [class.ready]="galeriePhotos.length >= seuilPhotos"
                  [class.pending]="galeriePhotos.length < seuilPhotos"
                >
                  {{ galeriePhotos.length >= seuilPhotos ? '✓ Prêt pour l\'entraînement' : 'En cours' }} ({{ galeriePhotos.length }} / {{ seuilPhotos }})
                </span>
              </div>
            </div>
            <button class="close-btn" (click)="fermerGalerie()">×</button>
          </div>

          <div class="modal-body gallery-body">
            <!-- Zone d'ajout rapide pour le gérant -->
            <div class="photos-upload-section" *ngIf="authService.isGerant">
              <div class="photos-section-header">
                <label>Ajouter de nouvelles photos à {{ ebaucheGalerie.modele.reference }}</label>
                <div class="source-selector">
                  <span>Source :</span>
                  <select [(ngModel)]="sourceUpload" class="form-input input-compact">
                    <option value="catalogue">Catalogue</option>
                    <option value="telephone">Téléphone</option>
                  </select>
                </div>
              </div>

              <div
                class="dropzone-photos compact"
                [class.drag-active]="isDragOverGalerie"
                (dragover)="onDragOver($event, 'galerie')"
                (dragleave)="onDragLeave('galerie')"
                (drop)="onDrop($event, 'galerie')"
                (click)="fileInputGalerie.click()"
              >
                <input
                  #fileInputGalerie
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  (change)="onPhotosSelected($event, 'galerie')"
                  style="display: none"
                />
                <span>📸 Glissez-déposez des photos ici ou <strong>cliquez pour parcourir</strong> (JPG, PNG, WEBP · max 5 Mo)</span>
              </div>

              <p class="photo-help-text">
                Ajoutez 30 photos ou plus : différents angles, éclairages et arrière-plans, recto et verso de la clé.
              </p>

              <!-- Barre de progression -->
              <div class="progress-wrapper" *ngIf="galerieUploadEnCours">
                <div class="progress-label">
                  <span>Téléversement des photos en cours...</span>
                  <span>{{ galerieUploadProgress }} %</span>
                </div>
                <div class="progress-track">
                  <div class="progress-bar" [style.width.%]="galerieUploadProgress"></div>
                </div>
              </div>
            </div>

            <!-- Chargement de la galerie -->
            <div class="gallery-loading" *ngIf="galerieChargement">
              Chargement des photos...
            </div>

            <!-- État vide soigné -->
            <div class="gallery-empty" *ngIf="!galerieChargement && galeriePhotos.length === 0">
              <span class="empty-icon">📷</span>
              <h4>Aucune photo de référence pour ce modèle</h4>
              <p>Ajoutez au moins 30 photos variées (angles, lumières, recto/verso) pour préparer l'entraînement YOLO sur Google Colab.</p>
            </div>

            <!-- Grille de photos enregistrées -->
            <div class="gallery-grid" *ngIf="!galerieChargement && galeriePhotos.length > 0">
              <div class="gallery-card" *ngFor="let photo of galeriePhotos">
                <div class="gallery-img-wrap">
                  <img [src]="api.getPhotoUrl(photo.url)" [alt]="'Photo ' + ebaucheGalerie.modele.reference" loading="lazy" />
                  <button
                    *ngIf="authService.isGerant"
                    type="button"
                    class="delete-photo-btn"
                    (click)="supprimerPhotoGalerie(photo)"
                    title="Supprimer cette photo"
                  >
                    🗑️
                  </button>
                </div>
                <div class="gallery-card-footer">
                  <span class="source-pill" [ngClass]="photo.source">{{ formatSource(photo.source) }}</span>
                  <span class="date-label">{{ photo.date_ajout | date:'dd/MM/yy HH:mm' }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" (click)="fermerGalerie()">Fermer</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .stock-page { display: flex; flex-direction: column; gap: 1.5rem; position: relative; }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
      h1 { font-size: 1.75rem; font-weight: 700; }
      .subtitle { color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.2rem; }
    }

    .header-actions {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .add-btn {
      font-size: 0.95rem;
      padding: 0.65rem 1.25rem;
      box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);
    }

    .export-btn {
      font-size: 0.9rem;
      padding: 0.65rem 1.1rem;
    }

    /* Toasts */
    .toast-container {
      position: fixed;
      top: 1.25rem;
      right: 1.25rem;
      z-index: 2000;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      max-width: 400px;
      width: calc(100% - 2.5rem);
    }

    .toast-item {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.85rem 1rem;
      border-radius: var(--radius-md);
      background: var(--bg-card);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-lg);
      animation: modalSlideIn 0.2s ease-out;

      &.success { border-left: 4px solid var(--success); }
      &.error { border-left: 4px solid var(--danger); }
      &.warning { border-left: 4px solid var(--warning); }

      .toast-body {
        strong { display: block; font-size: 0.88rem; margin-bottom: 0.15rem; }
        p { font-size: 0.82rem; color: var(--text-secondary); margin: 0; }
      }

      .toast-close {
        background: none;
        border: none;
        font-size: 1.2rem;
        line-height: 1;
        cursor: pointer;
        color: var(--text-muted);
        &:hover { color: var(--text-primary); }
      }
    }

    /* Bannière résumé export */
    .export-alert {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      padding: 1rem 1.25rem;
      border-left: 4px solid var(--primary);
    }

    .export-alert-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      .export-stats { font-size: 0.88rem; color: var(--text-secondary); }
      .close-btn { background: none; border: none; font-size: 1.3rem; cursor: pointer; color: var(--text-muted); }
    }

    .excluded-list {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      .excluded-title { font-size: 0.85rem; font-weight: 600; color: var(--warning); }
      .excluded-pills { display: flex; flex-wrap: wrap; gap: 0.4rem; }
      .excluded-pill {
        background: var(--warning-bg);
        color: var(--warning);
        padding: 0.2rem 0.55rem;
        border-radius: 9999px;
        font-size: 0.78rem;
        font-weight: 600;
      }
    }

    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      padding: 0.85rem 1.25rem;
      flex-wrap: wrap;
    }

    .search-box {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--bg-page);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 0.4rem 0.8rem;
      flex: 1;
      min-width: 240px;

      .search-icon { font-size: 0.95rem; opacity: 0.6; }
      input {
        border: none;
        background: transparent;
        width: 100%;
        outline: none;
        font-size: 0.9rem;
        color: var(--text-primary);
      }
    }

    .filter-group { display: flex; gap: 0.5rem; flex-wrap: wrap; }

    .table-card { padding: 0; overflow-x: auto; }

    .custom-table {
      width: 100%; border-collapse: collapse; text-align: left;
      th { padding: 0.85rem 1rem; background: var(--bg-page); color: var(--text-secondary); font-size: 0.78rem; text-transform: uppercase; border-bottom: 1px solid var(--border); white-space: nowrap; }
      td { padding: 0.85rem 1rem; border-bottom: 1px solid var(--border-light); font-size: 0.88rem; vertical-align: middle; }
    }

    .ref-badge {
      background: var(--bg-page);
      border: 1px solid var(--border);
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
      font-weight: 700;
      color: var(--primary);
      font-size: 0.9rem;
      white-space: nowrap;
    }

    .designation-cell {
      display: flex;
      flex-direction: column;
      .libelle { font-weight: 500; }
      .fabricant-sub { font-size: 0.75rem; color: var(--text-muted); }
    }

    .casier-cell {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      .casier-pill {
        background: rgba(59, 130, 246, 0.12);
        color: #1d4ed8;
        padding: 0.2rem 0.5rem;
        border-radius: 6px;
        font-weight: 700;
        font-size: 0.85rem;
        display: inline-block;
        width: fit-content;
      }
      .pos-info { font-size: 0.75rem; color: var(--text-muted); }
    }

    /* Badge Photos IA */
    .photo-status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.3rem 0.65rem;
      border-radius: 9999px;
      font-size: 0.76rem;
      font-weight: 600;
      border: 1px solid transparent;
      cursor: pointer;
      white-space: nowrap;
      transition: transform 0.12s ease, opacity 0.15s ease;

      &:hover { transform: translateY(-1px); opacity: 0.9; }
      &.ready { background: var(--success-bg); color: var(--success); border-color: rgba(16, 185, 129, 0.3); }
      &.pending { background: var(--warning-bg); color: var(--warning); border-color: rgba(245, 158, 11, 0.3); }
    }

    .action-buttons {
      display: inline-flex;
      gap: 0.35rem;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
    }

    .btn-xs { padding: 0.35rem 0.6rem; font-size: 0.75rem; border-radius: 6px; }
    .btn-outline-primary {
      background: transparent;
      border: 1px solid var(--primary);
      color: var(--primary);
      &:hover { background: var(--primary-light); }
    }
    .btn-danger-icon {
      background: transparent;
      border: 1px solid var(--border);
      padding: 0.35rem 0.5rem;
      &:hover { background: var(--danger-bg); border-color: var(--danger); }
    }

    .empty-row { text-align: center; padding: 3rem !important; color: var(--text-muted); }

    /* Modals */
    .modal-backdrop {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1.25rem;
    }

    .modal-content {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      width: 100%;
      max-width: 540px;
      max-height: 90vh;
      box-shadow: var(--shadow-lg);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: modalSlideIn 0.2s ease-out;

      &.modal-lg { max-width: 680px; }
      &.modal-xl { max-width: 860px; }
    }

    @keyframes modalSlideIn {
      from { transform: translateY(15px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .modal-header {
      padding: 1.15rem 1.5rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      h3 { font-size: 1.15rem; font-weight: 700; }
      .close-btn { background: none; border: none; font-size: 1.5rem; line-height: 1; cursor: pointer; color: var(--text-muted); &:hover { color: var(--text-primary); } }
    }

    .modal-body {
      padding: 1.35rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.15rem;
      overflow-y: auto;
    }

    .modal-footer {
      padding: 1rem 1.5rem;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      background: var(--bg-page);
    }

    .model-choice-tabs {
      display: flex;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      overflow: hidden;
      button {
        flex: 1;
        padding: 0.55rem;
        background: var(--bg-page);
        border: none;
        cursor: pointer;
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--text-secondary);
        &.active {
          background: var(--primary);
          color: white;
        }
      }
    }

    .model-select-row {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      select { flex: 1; min-width: 220px; }
      .toggle-photos-btn { white-space: nowrap; font-size: 0.82rem; }
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      label { font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); }
    }

    .form-input {
      padding: 0.6rem 0.8rem;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--bg-surface);
      color: var(--text-primary);
      font-size: 0.9rem;
      outline: none;
      &:focus { border-color: var(--primary); }
      &.input-compact { padding: 0.25rem 0.5rem; font-size: 0.8rem; }
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      @media (max-width: 600px) { grid-template-columns: 1fr; }
    }

    .new-model-box {
      background: var(--bg-page);
      border: 1px dashed var(--border);
      border-radius: var(--radius-md);
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    /* Zone d'upload Photos de référence */
    .photos-upload-section {
      background: var(--bg-page);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .photos-section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
      label { font-size: 0.85rem; font-weight: 700; color: var(--text-primary); }
      .source-selector {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.8rem;
        color: var(--text-secondary);
      }
    }

    .dropzone-photos {
      border: 2px dashed var(--border);
      border-radius: var(--radius-md);
      background: var(--bg-surface);
      padding: 1.25rem 1rem;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover, &.drag-active {
        border-color: var(--primary);
        background: var(--primary-light);
      }

      &.compact {
        padding: 0.95rem 1rem;
        font-size: 0.85rem;
        color: var(--text-secondary);
      }

      .drop-icon { font-size: 1.75rem; display: block; margin-bottom: 0.25rem; }
      .drop-title { font-size: 0.88rem; font-weight: 600; color: var(--text-primary); }
      .drop-formats { font-size: 0.76rem; color: var(--text-muted); margin-top: 0.15rem; }
      .mt-1 { margin-top: 0.5rem; }
    }

    .photo-help-text {
      font-size: 0.79rem;
      color: var(--text-secondary);
      line-height: 1.4;
      margin: 0;
    }

    .pending-thumbs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
      gap: 0.6rem;
    }

    .thumb-card {
      position: relative;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
      background: var(--bg-surface);
      overflow: hidden;
      aspect-ratio: 1 / 1;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .remove-thumb-btn {
        position: absolute;
        top: 3px;
        right: 3px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: none;
        background: rgba(239, 68, 68, 0.9);
        color: #fff;
        font-size: 0.85rem;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        &:hover { background: var(--danger); }
      }

      .thumb-meta {
        position: absolute;
        left: 0; right: 0; bottom: 0;
        background: rgba(15, 23, 42, 0.65);
        color: #fff;
        font-size: 0.65rem;
        padding: 1px 4px;
        text-align: center;
      }
    }

    .direct-upload-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
      padding-top: 0.5rem;
      border-top: 1px dashed var(--border);
      .direct-hint { font-size: 0.8rem; color: var(--text-secondary); }
    }

    /* Barre de progression */
    .progress-wrapper {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      .progress-label {
        display: flex;
        justify-content: space-between;
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--primary);
      }
      .progress-track {
        height: 8px;
        background: var(--border);
        border-radius: 9999px;
        overflow: hidden;
      }
      .progress-bar {
        height: 100%;
        background: var(--primary);
        transition: width 0.15s ease;
      }
    }

    /* Galerie de photos */
    .gallery-title-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      .gallery-badges {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .yolo-class-pill {
        background: var(--bg-page);
        border: 1px solid var(--border);
        padding: 0.2rem 0.55rem;
        border-radius: 6px;
        font-size: 0.76rem;
        font-weight: 600;
        color: var(--text-secondary);
      }
    }

    .gallery-loading {
      text-align: center;
      padding: 2.5rem 1rem;
      color: var(--text-secondary);
      font-size: 0.9rem;
    }

    .gallery-empty {
      text-align: center;
      padding: 2.5rem 1.5rem;
      background: var(--bg-page);
      border: 1px dashed var(--border);
      border-radius: var(--radius-md);
      .empty-icon { font-size: 2.5rem; display: block; margin-bottom: 0.5rem; opacity: 0.7; }
      h4 { font-size: 1rem; margin-bottom: 0.35rem; }
      p { font-size: 0.84rem; color: var(--text-secondary); max-width: 420px; margin: 0 auto; }
    }

    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(145px, 1fr));
      gap: 0.85rem;
    }

    .gallery-card {
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--bg-surface);
      overflow: hidden;
      display: flex;
      flex-direction: column;

      .gallery-img-wrap {
        position: relative;
        aspect-ratio: 1 / 1;
        background: var(--bg-page);
        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .delete-photo-btn {
          position: absolute;
          top: 6px;
          right: 6px;
          background: rgba(15, 23, 42, 0.75);
          border: none;
          border-radius: 6px;
          padding: 0.25rem 0.4rem;
          font-size: 0.85rem;
          cursor: pointer;
          transition: background 0.15s;
          &:hover { background: var(--danger); }
        }
      }

      .gallery-card-footer {
        padding: 0.4rem 0.5rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.7rem;
        border-top: 1px solid var(--border-light);

        .source-pill {
          padding: 0.1rem 0.35rem;
          border-radius: 4px;
          font-weight: 600;
          background: var(--primary-light);
          color: var(--primary);
          &.telephone { background: var(--warning-bg); color: var(--warning); }
          &.scan_confirme { background: var(--success-bg); color: var(--success); }
        }

        .date-label { color: var(--text-muted); white-space: nowrap; }
      }
    }

    .casier-select-wrapper {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      select { flex: 1; min-width: 200px; }
      .test-led-btn { white-space: nowrap; font-size: 0.85rem; }
    }

    .current-position-banner {
      background: var(--bg-page);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      .ref-title { font-size: 1.2rem; font-weight: 700; color: var(--primary); }
      .lib-sub { font-size: 0.85rem; color: var(--text-secondary); display: block; }
      .pos-badge { font-size: 0.85rem; color: var(--text-primary); }
    }

    .help-text { font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem; }
    .mt-3 { margin-top: 0.75rem; }
    .text-danger { color: var(--danger); font-weight: 700; }
    .text-warning { color: var(--warning); font-weight: 700; }
  `]
})
export class StockComponent implements OnInit, OnDestroy {
  ebauches: Ebauche[] = [];
  casiers: Casier[] = [];
  modeles: ModeleCle[] = [];
  fabricants: Fabricant[] = [];

  filtreStatut = '';
  rechercheTexte = '';
  seuilPhotos = 30;

  // Modal Ajout
  modalAjoutOuverte = false;
  modeCreationModele = false;
  afficherZonePhotosExistant = false;
  soumissionEnCours = false;

  nouvelleEbauche = {
    modele_id: null as number | null,
    casier_id: null as number | null,
    quantite: 10,
    seuil_alerte: 5,
    quantite_min: 0
  };

  nouveauModele = {
    reference: '',
    libelle: '',
    fabricant_id: null as number | null,
    description: ''
  };

  // Photos en attente & upload
  photosEnAttente: PendingPhotoPreview[] = [];
  sourceUpload: 'catalogue' | 'telephone' = 'catalogue';
  isDragOverModal = false;
  isDragOverGalerie = false;
  uploadEnCours = false;
  uploadProgress = 0;

  // Modal Déplacement
  modalDeplacementOuverte = false;
  ebaucheEnDeplacement: Ebauche | null = null;
  nouveauCasierId: number | null = null;

  // Modal Galerie
  modalGalerieOuverte = false;
  ebaucheGalerie: Ebauche | null = null;
  galeriePhotos: EbauchePhoto[] = [];
  galerieChargement = false;
  galerieUploadEnCours = false;
  galerieUploadProgress = 0;

  // Export Dataset
  exportEnCours = false;
  dernierExportInfo: { summary: DatasetExportSummary | null; excluded: DatasetExcludedModel[] } | null = null;

  // Toasts
  toasts: ToastMessage[] = [];
  private toastCounter = 0;

  constructor(
    public api: ApiService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.chargerDonnees();
  }

  ngOnDestroy(): void {
    this.viderPhotosEnAttente();
  }

  chargerDonnees(): void {
    this.api.getEbauches().subscribe({
      next: (res) => {
        this.ebauches = res;
        if (this.ebaucheGalerie) {
          const maj = res.find(e => e.id === this.ebaucheGalerie?.id);
          if (maj) this.ebaucheGalerie = maj;
        }
      }
    });
    this.api.getCasiers().subscribe({
      next: (res) => this.casiers = res
    });
    this.api.getModeles().subscribe({
      next: (res) => this.modeles = res
    });
    this.api.getFabricants().subscribe({
      next: (res) => {
        this.fabricants = res;
        if (res.length > 0 && !this.nouveauModele.fabricant_id) {
          this.nouveauModele.fabricant_id = res[0].id;
        }
      }
    });
    this.api.getDatasetStatus().subscribe({
      next: (status) => {
        if (status?.seuil_requis) {
          this.seuilPhotos = status.seuil_requis;
        }
      }
    });
  }

  get ebauchesFiltrees(): Ebauche[] {
    return this.ebauches.filter((item) => {
      if (this.filtreStatut && item.statut_stock !== this.filtreStatut) {
        return false;
      }
      if (this.rechercheTexte.trim()) {
        const q = this.rechercheTexte.toLowerCase().trim();
        const ref = item.modele.reference.toLowerCase();
        const lib = item.modele.libelle.toLowerCase();
        const code = item.casier.code.toLowerCase();
        const fab = item.modele.fabricant?.nom.toLowerCase() || '';
        return ref.includes(q) || lib.includes(q) || code.includes(q) || fab.includes(q);
      }
      return true;
    });
  }

  get ebaucheExistantePourSelection(): Ebauche | undefined {
    if (!this.nouvelleEbauche.modele_id) return undefined;
    return this.ebauches.find(e => e.modele_id === this.nouvelleEbauche.modele_id);
  }

  filtrer(statut: string): void {
    this.filtreStatut = statut;
  }

  allumer(casierId: number): void {
    this.api.allumerLed(casierId, 15).subscribe({
      next: () => this.ajouterToast('success', 'Guidage LED', 'Casier allumé pendant 15 secondes.')
    });
  }

  testerLedCasier(casierId: number | null): void {
    if (!casierId) return;
    this.api.allumerLed(casierId, 15).subscribe({
      next: () => this.ajouterToast('success', 'Guidage LED', 'La LED du casier sélectionné est allumée.')
    });
  }

  prelever(item: Ebauche): void {
    this.api.prelever(item.id).subscribe({
      next: (updated) => {
        item.quantite = updated.quantite;
        item.statut_stock = updated.statut_stock;
        this.ajouterToast('success', 'Prélèvement effectué', `1 clé ${item.modele.reference} prélevée.`);
      },
      error: (err) => {
        this.ajouterToast('error', 'Erreur prélèvement', err.error?.detail || 'Stock insuffisant.');
      }
    });
  }

  reapprovisionner(item: Ebauche): void {
    const qte = prompt(`Quantité de clés "${item.modele.reference}" à ajouter au stock :`, '10');
    if (qte && parseInt(qte, 10) > 0) {
      this.api.reapprovisionner(item.id, parseInt(qte, 10)).subscribe({
        next: (updated) => {
          item.quantite = updated.quantite;
          item.statut_stock = updated.statut_stock;
          this.ajouterToast('success', 'Réapprovisionnement', `+${qte} unités ajoutées pour ${item.modele.reference}.`);
        },
        error: (err) => {
          this.ajouterToast('error', 'Action refusée', err.error?.detail || 'Erreur lors du réapprovisionnement.');
        }
      });
    }
  }

  // --- MODAL AJOUT ---
  ouvrirModalAjout(): void {
    this.modalAjoutOuverte = true;
    this.modeCreationModele = false;
    this.afficherZonePhotosExistant = false;
    this.viderPhotosEnAttente();
    this.nouvelleEbauche = {
      modele_id: this.modeles.length > 0 ? this.modeles[0].id : null,
      casier_id: this.casiers.length > 0 ? this.casiers[0].id : null,
      quantite: 10,
      seuil_alerte: 5,
      quantite_min: 0
    };
    this.nouveauModele = {
      reference: '',
      libelle: '',
      fabricant_id: this.fabricants.length > 0 ? this.fabricants[0].id : null,
      description: ''
    };
  }

  fermerModalAjout(): void {
    if (this.soumissionEnCours) return;
    this.modalAjoutOuverte = false;
    this.viderPhotosEnAttente();
  }

  basculerOngletAjout(creationModele: boolean): void {
    this.modeCreationModele = creationModele;
  }

  // --- GESTION GLISSER-DÉPOSER & SÉLECTION DE FICHIERS ---
  onDragOver(event: DragEvent, cible: 'modal' | 'galerie'): void {
    event.preventDefault();
    event.stopPropagation();
    if (cible === 'modal') this.isDragOverModal = true;
    else this.isDragOverGalerie = true;
  }

  onDragLeave(cible: 'modal' | 'galerie'): void {
    if (cible === 'modal') this.isDragOverModal = false;
    else this.isDragOverGalerie = false;
  }

  onDrop(event: DragEvent, cible: 'modal' | 'galerie'): void {
    event.preventDefault();
    event.stopPropagation();
    this.onDragLeave(cible);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.traiterFichiersSelectionnes(Array.from(files), cible);
    }
  }

  onPhotosSelected(event: Event, cible: 'modal' | 'galerie'): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.traiterFichiersSelectionnes(Array.from(input.files), cible);
      input.value = '';
    }
  }

  private traiterFichiersSelectionnes(fichiers: File[], cible: 'modal' | 'galerie'): void {
    const valides: File[] = [];
    const extsOk = ['jpg', 'jpeg', 'png', 'webp'];
    const maxBytes = 5 * 1024 * 1024;

    for (const file of fichiers) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (!extsOk.includes(ext)) {
        this.ajouterToast('error', 'Format refusé', `"${file.name}" : seuls JPG, JPEG, PNG et WEBP sont acceptés.`);
        continue;
      }
      if (file.size > maxBytes) {
        this.ajouterToast('error', 'Fichier trop lourd', `"${file.name}" dépasse la limite de 5 Mo.`);
        continue;
      }
      valides.push(file);
    }

    if (valides.length === 0) return;

    if (cible === 'modal') {
      for (const file of valides) {
        this.photosEnAttente.push({
          file,
          previewUrl: URL.createObjectURL(file),
          sizeLabel: this.formaterTaille(file.size),
        });
      }
    } else if (cible === 'galerie' && this.ebaucheGalerie) {
      this.uploaderVersGalerie(this.ebaucheGalerie.id, valides);
    }
  }

  retirerPhotoEnAttente(index: number): void {
    const item = this.photosEnAttente[index];
    if (item) {
      URL.revokeObjectURL(item.previewUrl);
      this.photosEnAttente.splice(index, 1);
    }
  }

  private viderPhotosEnAttente(): void {
    for (const item of this.photosEnAttente) {
      URL.revokeObjectURL(item.previewUrl);
    }
    this.photosEnAttente = [];
    this.uploadEnCours = false;
    this.uploadProgress = 0;
  }

  private formaterTaille(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  envoyerPhotosDirectementPourSelection(): void {
    const cible = this.ebaucheExistantePourSelection;
    if (!cible || this.photosEnAttente.length === 0) return;

    const files = this.photosEnAttente.map(p => p.file);
    this.soumissionEnCours = true;
    this.uploadEnCours = true;
    this.uploadProgress = 0;

    this.api.uploadEbauchePhotos(cible.id, files, this.sourceUpload).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.uploadProgress = Math.round((100 * event.loaded) / event.total);
        } else if (event.type === HttpEventType.Response && event.body) {
          this.soumissionEnCours = false;
          this.uploadEnCours = false;
          this.viderPhotosEnAttente();
          this.chargerDonnees();
          this.ajouterToast(
            'success',
            'Photos ajoutées',
            `${event.body.ajoutees} photo(s) enregistrée(s) pour ${cible.modele.reference} (total : ${event.body.total_photos}).`
          );
        }
      },
      error: (err) => {
        this.soumissionEnCours = false;
        this.uploadEnCours = false;
        this.ajouterToast('error', 'Erreur d\'envoi', err.error?.detail || 'Impossible d\'envoyer les photos.');
      }
    });
  }

  enregistrerNouvelleEbauche(): void {
    if (this.modeCreationModele) {
      if (!this.nouveauModele.reference.trim() || !this.nouveauModele.fabricant_id) {
        this.ajouterToast('error', 'Champs requis', 'Veuillez renseigner la référence et le fabricant.');
        return;
      }
      this.soumissionEnCours = true;
      this.api.creerModele({
        reference: this.nouveauModele.reference.trim(),
        libelle: this.nouveauModele.libelle.trim() || this.nouveauModele.reference.trim(),
        fabricant_id: this.nouveauModele.fabricant_id,
        description: this.nouveauModele.description
      }).subscribe({
        next: (modeleCree) => {
          this.modeles.push(modeleCree);
          this.creerEbaucheFinale(modeleCree.id);
        },
        error: (err) => {
          this.soumissionEnCours = false;
          this.ajouterToast('error', 'Erreur modèle', err.error?.detail || 'Erreur lors de la création du modèle.');
        }
      });
    } else {
      if (!this.nouvelleEbauche.modele_id) {
        this.ajouterToast('error', 'Sélection requise', 'Veuillez sélectionner un modèle de clé.');
        return;
      }
      this.soumissionEnCours = true;
      this.creerEbaucheFinale(this.nouvelleEbauche.modele_id);
    }
  }

  private creerEbaucheFinale(modeleId: number): void {
    if (!this.nouvelleEbauche.casier_id) {
      this.soumissionEnCours = false;
      this.ajouterToast('error', 'Casier requis', 'Veuillez sélectionner un casier d\'affectation.');
      return;
    }

    const payload = {
      modele_id: modeleId,
      casier_id: this.nouvelleEbauche.casier_id,
      quantite: Number(this.nouvelleEbauche.quantite) || 1,
      seuil_alerte: Number(this.nouvelleEbauche.seuil_alerte) || 5,
      quantite_min: 0
    };

    this.api.creerEbauche(payload).subscribe({
      next: (ebaucheCree) => {
        const files = this.photosEnAttente.map(p => p.file);
        if (files.length > 0 && this.authService.isGerant) {
          this.uploadEnCours = true;
          this.uploadProgress = 0;

          this.api.uploadEbauchePhotos(ebaucheCree.id, files, this.sourceUpload).subscribe({
            next: (event) => {
              if (event.type === HttpEventType.UploadProgress && event.total) {
                this.uploadProgress = Math.round((100 * event.loaded) / event.total);
              } else if (event.type === HttpEventType.Response && event.body) {
                this.finaliserCreationAvecSucces(
                  ebaucheCree,
                  `${event.body.ajoutees} photo(s) de référence ajoutée(s).`
                );
              }
            },
            error: (err) => {
              this.soumissionEnCours = false;
              this.uploadEnCours = false;
              this.chargerDonnees();
              this.ajouterToast(
                'warning',
                'Stock créé, erreur photos',
                err.error?.detail || 'La clé est en stock mais certaines photos n\'ont pas pu être envoyées.'
              );
            }
          });
        } else {
          this.finaliserCreationAvecSucces(ebaucheCree);
        }
      },
      error: (err) => {
        this.soumissionEnCours = false;
        this.ajouterToast('error', 'Erreur stock', err.error?.detail || 'Erreur lors de l\'enregistrement dans le stock.');
      }
    });
  }

  private finaliserCreationAvecSucces(ebaucheCree: Ebauche, detailPhotos: string = ''): void {
    this.soumissionEnCours = false;
    this.uploadEnCours = false;
    this.fermerModalAjout();
    this.chargerDonnees();
    this.api.allumerLed(ebaucheCree.casier_id, 15).subscribe();
    this.ajouterToast(
      'success',
      'Clé ajoutée au stock',
      `${ebaucheCree.modele.reference} assignée au casier ${ebaucheCree.casier.code} (LED allumée). ${detailPhotos}`.trim()
    );
  }

  // --- MODAL GALERIE DE PHOTOS ---
  ouvrirGalerie(item: Ebauche): void {
    this.ebaucheGalerie = item;
    this.modalGalerieOuverte = true;
    this.galeriePhotos = [];
    this.chargerPhotosGalerie(item.id);
  }

  fermerGalerie(): void {
    this.modalGalerieOuverte = false;
    this.ebaucheGalerie = null;
    this.galeriePhotos = [];
  }

  private chargerPhotosGalerie(ebaucheId: number): void {
    this.galerieChargement = true;
    this.api.getEbauchePhotos(ebaucheId).subscribe({
      next: (photos) => {
        this.galeriePhotos = photos;
        this.galerieChargement = false;
        if (this.ebaucheGalerie) {
          this.ebaucheGalerie.nb_photos = photos.length;
        }
      },
      error: () => {
        this.galerieChargement = false;
        this.ajouterToast('error', 'Erreur galerie', 'Impossible de charger les photos du modèle.');
      }
    });
  }

  private uploaderVersGalerie(ebaucheId: number, files: File[]): void {
    this.galerieUploadEnCours = true;
    this.galerieUploadProgress = 0;

    this.api.uploadEbauchePhotos(ebaucheId, files, this.sourceUpload).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.galerieUploadProgress = Math.round((100 * event.loaded) / event.total);
        } else if (event.type === HttpEventType.Response && event.body) {
          this.galerieUploadEnCours = false;
          this.galerieUploadProgress = 0;
          this.chargerPhotosGalerie(ebaucheId);
          this.chargerDonnees();
          this.ajouterToast(
            'success',
            'Photos ajoutées',
            `${event.body.ajoutees} photo(s) ajoutée(s) · Total : ${event.body.total_photos} / ${this.seuilPhotos}.`
          );
        }
      },
      error: (err) => {
        this.galerieUploadEnCours = false;
        this.galerieUploadProgress = 0;
        this.ajouterToast('error', 'Erreur d\'envoi', err.error?.detail || 'Échec de l\'upload.');
      }
    });
  }

  supprimerPhotoGalerie(photo: EbauchePhoto): void {
    if (!this.ebaucheGalerie) return;
    this.api.deleteEbauchePhoto(photo.id).subscribe({
      next: () => {
        this.galeriePhotos = this.galeriePhotos.filter(p => p.id !== photo.id);
        if (this.ebaucheGalerie) {
          this.ebaucheGalerie.nb_photos = this.galeriePhotos.length;
          const row = this.ebauches.find(e => e.id === this.ebaucheGalerie?.id);
          if (row) row.nb_photos = this.galeriePhotos.length;
        }
        this.ajouterToast('success', 'Photo supprimée', 'La photo a été retirée du dataset.');
      },
      error: (err) => {
        this.ajouterToast('error', 'Suppression impossible', err.error?.detail || 'Erreur lors de la suppression.');
      }
    });
  }

  formatSource(source: string): string {
    switch (source) {
      case 'telephone': return 'Téléphone';
      case 'scan_confirme': return 'Scan confirmé';
      default: return 'Catalogue';
    }
  }

  // --- EXPORT DATASET ZIP ---
  exporterDataset(): void {
    if (this.exportEnCours) return;
    this.exportEnCours = true;

    this.api.exportDatasetZip(42).subscribe({
      next: (response: HttpResponse<Blob>) => {
        this.exportEnCours = false;
        const blob = response.body;
        if (!blob) return;

        // Déclencher le téléchargement ZIP
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'keylocator_yolo_dataset.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Lire le résumé et les modèles exclus depuis les headers
        let summary: DatasetExportSummary | null = null;
        let excluded: DatasetExcludedModel[] = [];

        try {
          const sumHeader = response.headers.get('X-Dataset-Summary');
          if (sumHeader) summary = JSON.parse(decodeURIComponent(sumHeader));

          const excHeader = response.headers.get('X-Dataset-Excluded');
          if (excHeader) excluded = JSON.parse(decodeURIComponent(excHeader));
        } catch {
          // Ignore si parsing header indisponible
        }

        this.dernierExportInfo = { summary, excluded };

        if (excluded.length > 0) {
          const refs = excluded.map(e => `${e.reference} (${e.nb_photos})`).join(', ');
          this.ajouterToast(
            'warning',
            'Dataset exporté avec exclusions',
            `ZIP téléchargé. Modèles exclus (< 2 photos) : ${refs}`,
            9000
          );
        } else {
          this.ajouterToast(
            'success',
            'Dataset exporté',
            summary
              ? `${summary.classes_incluses} classe(s) et ${summary.total_images} photo(s) téléchargées.`
              : 'Archive ZIP prête pour Google Colab.'
          );
        }
      },
      error: (err) => {
        this.exportEnCours = false;
        if (err.error instanceof Blob) {
          err.error.text().then((txt: string) => {
            try {
              const parsed = JSON.parse(txt);
              const detail = parsed.detail;
              if (detail && typeof detail === 'object') {
                this.dernierExportInfo = { summary: null, excluded: detail.modeles_exclus || [] };
                this.ajouterToast('error', 'Export impossible', detail.message || 'Pas assez de photos.');
              } else {
                this.ajouterToast('error', 'Export impossible', detail || 'Erreur lors de l\'export.');
              }
            } catch {
              this.ajouterToast('error', 'Export impossible', 'Aucune classe exportable (minimum 2 photos par classe).');
            }
          });
        } else {
          this.ajouterToast('error', 'Export impossible', err.error?.detail || 'Erreur serveur lors de l\'export.');
        }
      }
    });
  }

  // --- MODAL DÉPLACEMENT / CHANGEMENT DE POSITION ---
  ouvrirModalDeplacement(item: Ebauche): void {
    this.ebaucheEnDeplacement = item;
    this.nouveauCasierId = null;
    this.modalDeplacementOuverte = true;
  }

  fermerModalDeplacement(): void {
    this.modalDeplacementOuverte = false;
    this.ebaucheEnDeplacement = null;
    this.nouveauCasierId = null;
  }

  confirmerDeplacement(): void {
    if (!this.ebaucheEnDeplacement || !this.nouveauCasierId) return;

    this.soumissionEnCours = true;
    const item = this.ebaucheEnDeplacement;
    const casierCibleId = this.nouveauCasierId;

    this.api.modifierEbauche(item.id, { casier_id: casierCibleId }).subscribe({
      next: (updated) => {
        this.soumissionEnCours = false;
        item.casier_id = updated.casier_id;
        item.casier = updated.casier;
        this.fermerModalDeplacement();
        this.api.allumerLed(casierCibleId, 15).subscribe();
        this.ajouterToast(
          'success',
          'Emplacement modifié',
          `Clé ${item.modele.reference} déplacée vers le casier ${updated.casier.code} (LED allumée).`
        );
      },
      error: (err) => {
        this.soumissionEnCours = false;
        this.ajouterToast('error', 'Erreur déplacement', err.error?.detail || 'Erreur lors du déplacement de la clé.');
      }
    });
  }

  supprimerEbauche(item: Ebauche): void {
    if (confirm(`Confirmez-vous le retrait du stock de la clé ${item.modele.reference} (Casier ${item.casier.code}) ?`)) {
      this.api.supprimerEbauche(item.id).subscribe({
        next: () => {
          this.ebauches = this.ebauches.filter(e => e.id !== item.id);
          this.ajouterToast('success', 'Stock mis à jour', `Clé ${item.modele.reference} retirée du stock.`);
        },
        error: (err) => {
          this.ajouterToast('error', 'Erreur suppression', err.error?.detail || 'Erreur lors de la suppression.');
        }
      });
    }
  }

  getCasierInfo(casierId: number): string {
    const ebauche = this.ebauches.find(e => e.casier_id === casierId);
    if (ebauche) {
      return `· Contient: ${ebauche.modele.reference} (${ebauche.quantite})`;
    }
    return '· (Libre)';
  }

  // --- TOASTS ---
  ajouterToast(type: 'success' | 'error' | 'warning', title: string, text: string, durationMs: number = 5000): void {
    const id = ++this.toastCounter;
    this.toasts.push({ id, type, title, text });
    setTimeout(() => this.fermerToast(id), durationMs);
  }

  fermerToast(id: number): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }
}
