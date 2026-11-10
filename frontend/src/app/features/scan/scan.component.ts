import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { ScanResultat } from '../../core/models/models';

@Component({
  selector: 'app-scan',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="scan-page">
      <div class="page-header">
        <div>
          <h1>Identification de Clé par Photo</h1>
          <p class="subtitle">Analyse IA (YOLO) · Détection de flou · Localisation automatique du casier</p>
        </div>
      </div>

      <div class="scan-layout">
        <!-- Zone Upload / Capture -->
        <div class="card upload-card">
          <div class="dropzone" (click)="fileInput.click()" [class.has-preview]="previewUrl">
            <input #fileInput type="file" accept="image/*" (change)="onFileSelected($event)" style="display: none" />

            <div *ngIf="!previewUrl" class="placeholder">
              <span class="camera-icon">📷</span>
              <h3>Sélectionner ou prendre une photo</h3>
              <p>Formats supportés : JPG, PNG (éclairage net recommandé)</p>
              <button type="button" class="btn btn-secondary mt-2">Parcourir les fichiers</button>
            </div>

            <div *ngIf="previewUrl" class="preview-container">
              <img [src]="previewUrl" alt="Aperçu de la clé" class="preview-img" />
              <div class="preview-overlay">
                <span>Cliquez pour changer d'image</span>
              </div>
            </div>
          </div>

          <div class="actions">
            <button class="btn btn-primary scan-btn" [disabled]="!selectedFile || loading" (click)="lancerScan()">
              {{ loading ? 'Analyse IA en cours...' : '🔍 Identifier le modèle' }}
            </button>
          </div>
        </div>

        <!-- Zone Résultat du Scan -->
        <div class="card result-card" *ngIf="resultat">
          <div class="status-banner" [ngClass]="resultat.statut">
            <span class="status-icon">
              {{ resultat.statut === 'succes' ? '✅' : (resultat.statut === 'photo_floue' ? '📷' : '⚠️') }}
            </span>
            <div class="status-text">
              <h3>{{ getStatutTitre() }}</h3>
              <p>{{ resultat.message }}</p>
            </div>
          </div>

          <!-- Détails en cas de succès -->
          <div class="details-content" *ngIf="resultat.statut === 'succes' && resultat.modele">
            <div class="result-grid">
              <div class="res-item">
                <span class="label">Modèle Détecté</span>
                <span class="val highlight">{{ resultat.modele.reference }}</span>
              </div>

              <div class="res-item" *ngIf="resultat.score_confiance">
                <span class="label">Confiance YOLO</span>
                <span class="val">{{ (resultat.score_confiance * 100).toFixed(1) }} %</span>
              </div>

              <div class="res-item" *ngIf="resultat.casier">
                <span class="label">Casier Cible</span>
                <span class="val casier-tag">{{ resultat.casier.code }}</span>
              </div>

              <div class="res-item" *ngIf="resultat.ebauche">
                <span class="label">Stock Disponible</span>
                <span class="val">{{ resultat.ebauche.quantite }} unités</span>
              </div>
            </div>

            <!-- LED Animée en direct -->
            <div class="guidage-box" *ngIf="resultat.casier">
              <div class="g-icon">💡</div>
              <div class="g-info">
                <h4>Guidage Lumineux Activé</h4>
                <p>Le casier <strong>{{ resultat.casier.code }}</strong> clignote pendant 15 secondes pour repérage visuel.</p>
              </div>
            </div>

            <!-- Bouton de prélèvement direct -->
            <div class="prelevement-bar" *ngIf="resultat.ebauche && resultat.ebauche.quantite > resultat.ebauche.quantite_min">
              <button class="btn btn-primary" (click)="prelever(resultat.ebauche.id)" [disabled]="prelevementFait">
                {{ prelevementFait ? '✓ Clé Prélevée (-1)' : 'Valider la prise de clé (-1)' }}
              </button>
            </div>

            <!-- Équivalences alternatives -->
            <div class="equiv-box" *ngIf="resultat.equivalences && resultat.equivalences.length > 0">
              <h4>🔄 Profils Équivalents Compatibles :</h4>
              <div class="equiv-tags">
                <span class="equiv-pill" *ngFor="let eq of resultat.equivalences">
                  {{ eq.reference }} ({{ eq.libelle }})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .scan-page { display: flex; flex-direction: column; gap: 1.5rem; }
    .page-header h1 { font-size: 1.75rem; font-weight: 700; }
    .subtitle { color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.2rem; }

    .scan-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      @media (max-width: 900px) { grid-template-columns: 1fr; }
    }

    .dropzone {
      border: 2px dashed var(--border);
      border-radius: var(--radius-lg);
      padding: 2.5rem;
      text-align: center;
      cursor: pointer;
      background: var(--bg-page);
      transition: all 0.2s;

      &:hover { border-color: var(--primary); }
      &.has-preview { padding: 0.5rem; }

      .camera-icon { font-size: 3rem; margin-bottom: 0.5rem; display: block; }
      h3 { font-size: 1.1rem; margin-bottom: 0.25rem; }
      p { font-size: 0.85rem; color: var(--text-secondary); }
    }

    .preview-container {
      position: relative;
      border-radius: var(--radius-md);
      overflow: hidden;
      max-height: 320px;

      .preview-img { width: 100%; height: auto; object-fit: contain; }
      .preview-overlay {
        position: absolute;
        bottom: 0; left: 0; right: 0;
        background: rgba(0, 0, 0, 0.6);
        color: white;
        padding: 0.5rem;
        font-size: 0.8rem;
      }
    }

    .actions { margin-top: 1rem; }
    .scan-btn { width: 100%; padding: 0.85rem; font-size: 1rem; }

    .status-banner {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      border-radius: var(--radius-md);
      margin-bottom: 1.25rem;

      &.succes { background: var(--success-bg); color: var(--success); }
      &.echec_confiance, &.echec_detection { background: var(--warning-bg); color: var(--warning); }
      &.photo_floue { background: var(--danger-bg); color: var(--danger); }

      .status-icon { font-size: 1.8rem; }
      h3 { font-size: 1.05rem; font-weight: 700; }
      p { font-size: 0.85rem; opacity: 0.9; }
    }

    .result-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1.25rem;

      .res-item {
        background: var(--bg-page);
        padding: 0.75rem 1rem;
        border-radius: var(--radius-md);
        display: flex;
        flex-direction: column;

        .label { font-size: 0.75rem; color: var(--text-secondary); }
        .val { font-size: 1.1rem; font-weight: 700; }
        .highlight { color: var(--primary); font-size: 1.3rem; }
        .casier-tag { color: #3b82f6; }
      }
    }

    .guidage-box {
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid #3b82f6;
      border-radius: var(--radius-md);
      padding: 1rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.25rem;
      .g-icon { font-size: 2rem; animation: pulse 1s infinite; }
      h4 { font-size: 0.95rem; font-weight: 700; color: #1d4ed8; }
      p { font-size: 0.85rem; color: var(--text-secondary); }
    }

    .prelevement-bar { margin-bottom: 1.25rem; button { width: 100%; } }

    .equiv-box {
      border-top: 1px dashed var(--border);
      padding-top: 1rem;
      h4 { font-size: 0.9rem; margin-bottom: 0.5rem; color: var(--text-secondary); }
      .equiv-tags { display: flex; flex-wrap: wrap; gap: 0.5rem; }
      .equiv-pill {
        background: var(--bg-page);
        border: 1px solid var(--border);
        padding: 0.3rem 0.6rem;
        border-radius: 6px;
        font-size: 0.8rem;
        font-weight: 500;
      }
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.15); }
    }
  `]
})
export class ScanComponent {
  selectedFile: File | null = null;
  previewUrl: string | null = null;
  loading = false;
  resultat: ScanResultat | null = null;
  prelevementFait = false;

  constructor(private api: ApiService) {}

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.prelevementFait = false;
      this.resultat = null;

      const reader = new FileReader();
      reader.onload = () => this.previewUrl = reader.result as string;
      reader.readAsDataURL(file);
    }
  }

  lancerScan(): void {
    if (!this.selectedFile) return;
    this.loading = true;

    const formData = new FormData();
    formData.append('photo', this.selectedFile);

    this.api.scannerCle(formData).subscribe({
      next: (res) => {
        this.loading = false;
        this.resultat = res;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  prelever(ebaucheId: number): void {
    this.api.prelever(ebaucheId).subscribe({
      next: (ebauche) => {
        this.prelevementFait = true;
        if (this.resultat) {
          this.resultat.ebauche = ebauche;
        }
      }
    });
  }

  getStatutTitre(): string {
    switch (this.resultat?.statut) {
      case 'succes': return 'Identification Réussie';
      case 'photo_floue': return 'Photo Floue Détectée';
      case 'echec_confiance': return 'Confiance Insuffisante';
      default: return 'Détection Impossible';
    }
  }
}

