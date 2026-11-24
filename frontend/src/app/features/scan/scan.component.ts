import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
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
          <h1>Identification de Clé par Photo & Caméra</h1>
          <p class="subtitle">Analyse IA (YOLO) · Scan direct via Caméra (Mobile & PC) ou Fichier · Localisation automatique du casier</p>
        </div>

        <!-- Sélecteur de mode -->
        <div class="mode-tabs">
          <button class="mode-tab" [class.active]="mode === 'camera'" (click)="setMode('camera')">
            <span class="icon">📷</span> Caméra en Direct
          </button>
          <button class="mode-tab" [class.active]="mode === 'mobile'" (click)="declencherPhotoMobile()">
            <span class="icon">📱</span> Photo Mobile
          </button>
          <button class="mode-tab" [class.active]="mode === 'file'" (click)="setMode('file')">
            <span class="icon">📁</span> Fichier / Galerie
          </button>
        </div>
      </div>

      <!-- Input invisible pour prise de photo native mobile -->
      <input #mobileCameraInput type="file" accept="image/*" capture="environment" (change)="onMobileCaptureSelected($event)" style="display: none" />

      <div class="scan-layout">
        <!-- Zone Caméra / Upload -->
        <div class="card scan-input-card">
          <!-- MODE 1 : CAMÉRA DU LAPTOP -->
          <div *ngIf="mode === 'camera'" class="camera-section">
            <div class="video-wrapper" [class.has-stream]="cameraActive && !previewUrl">
              <!-- Flux vidéo en direct -->
              <video #videoElement autoplay playsinline muted [style.display]="cameraActive && !previewUrl ? 'block' : 'none'" class="video-feed"></video>

              <!-- Viseur dynamique -->
              <div class="viewfinder" *ngIf="cameraActive && !previewUrl">
                <div class="target-frame">
                  <span class="corner tl"></span>
                  <span class="corner tr"></span>
                  <span class="corner bl"></span>
                  <span class="corner br"></span>
                  <div class="laser-scanner"></div>
                  <div class="frame-label">🔑 Placez la clé ici bien à plat</div>
                </div>
              </div>

              <!-- Aperçu de la photo capturée -->
              <div *ngIf="previewUrl" class="captured-preview">
                <img [src]="previewUrl" alt="Photo capturée" class="captured-img" />
                <div class="captured-badge">✓ Photo capturée</div>
              </div>

              <!-- État : Caméra éteinte -->
              <div *ngIf="!cameraActive && !previewUrl" class="camera-off-placeholder">
                <span class="cam-big-icon">📷</span>
                <h3>Caméra prête à démarrer</h3>
                <p>Scannez une clé directement en la présentant devant la caméra de votre smartphone ou de votre ordinateur.</p>
                <button type="button" class="btn btn-primary mt-3" (click)="demarrerCamera()">
                  ▶ Activer la Caméra
                </button>
              </div>

              <!-- Message d'erreur caméra -->
              <div *ngIf="cameraErreur" class="camera-error-banner">
                ⚠️ {{ cameraErreur }}
              </div>
            </div>

            <!-- Commandes Caméra -->
            <div class="camera-controls">
              <ng-container *ngIf="cameraActive && !previewUrl">
                <button type="button" class="btn btn-primary capture-btn" (click)="capturerPhoto()" [disabled]="loading">
                  📸 Prendre la photo & Scanner
                </button>
                <button type="button" class="btn btn-secondary flip-btn" (click)="basculerCamera()" title="Basculer caméra avant/arrière">
                  🔄 {{ facingMode === 'environment' ? 'Caméra Arrière' : 'Caméra Avant' }}
                </button>
                <button type="button" class="btn btn-secondary" (click)="arreterCamera()">
                  Arrêter
                </button>
              </ng-container>

              <ng-container *ngIf="previewUrl">
                <button type="button" class="btn btn-primary" (click)="lancerScan()" [disabled]="loading">
                  {{ loading ? '🔍 Analyse IA en cours...' : '🔍 Lancer l\'Analyse' }}
                </button>
                <button type="button" class="btn btn-secondary" (click)="reprendrePhoto()" [disabled]="loading">
                  🔄 Reprendre une photo
                </button>
              </ng-container>
            </div>
          </div>

          <!-- MODE 2 : FICHIER / UPLOAD -->
          <div *ngIf="mode === 'file'" class="file-section">
            <div class="dropzone" (click)="fileInput.click()" [class.has-preview]="previewUrl">
              <input #fileInput type="file" accept="image/*" (change)="onFileSelected($event)" style="display: none" />

              <div *ngIf="!previewUrl" class="placeholder">
                <span class="camera-icon">📁</span>
                <h3>Sélectionner une photo depuis votre disque</h3>
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

            <div class="actions" *ngIf="selectedFile">
              <button class="btn btn-primary scan-btn" [disabled]="!selectedFile || loading" (click)="lancerScan()">
                {{ loading ? 'Analyse IA en cours...' : '🔍 Identifier le modèle' }}
              </button>
            </div>
          </div>

          <!-- MODE 3 : PHOTO MOBILE (CAPTURE APPAREIL SMARTPHONE) -->
          <div *ngIf="mode === 'mobile'" class="mobile-section">
            <div *ngIf="!previewUrl" class="mobile-prompt-box">
              <span class="mobile-big-icon">📱</span>
              <h3>Photo Smartphone</h3>
              <p>Prenez une photo nette de la clé avec l'appareil photo de votre smartphone ou tablette.</p>

              <div class="mobile-guide">
                <div class="guide-item">💡 Placez la clé bien à plat sur un fond clair et contrasté</div>
                <div class="guide-item">📸 Cadrez l'ensemble de la clé bien au centre</div>
              </div>

              <button type="button" class="btn btn-primary mobile-trigger-btn" (click)="declencherPhotoMobile()">
                📸 Prendre la Photo avec le Smartphone
              </button>
            </div>

            <!-- Aperçu de la photo capturée en mode mobile -->
            <div *ngIf="previewUrl" class="captured-preview">
              <img [src]="previewUrl" alt="Photo capturée" class="captured-img" />
              <div class="captured-badge">✓ Photo capturée</div>
            </div>

            <div class="camera-controls" *ngIf="previewUrl">
              <button type="button" class="btn btn-primary" (click)="lancerScan()" [disabled]="loading">
                {{ loading ? '🔍 Analyse IA en cours...' : '🔍 Lancer l\'Analyse' }}
              </button>
              <button type="button" class="btn btn-secondary" (click)="declencherPhotoMobile()" [disabled]="loading">
                🔄 Reprendre une photo
              </button>
            </div>
          </div>
        </div>

        <!-- Zone Résultat du Scan -->
        <div class="card result-card" *ngIf="resultat">
          <div class="status-banner" [ngClass]="resultat.statut">
            <span class="status-icon">
              {{ resultat.statut === 'ok' ? '✅' : (resultat.statut === 'photo_floue' ? '📷' : '⚠️') }}
            </span>
            <div class="status-text">
              <h3>{{ getStatutTitre() }}</h3>
              <p>{{ resultat.message }}</p>
            </div>
          </div>

          <!-- Détails en cas de succès -->
          <div class="details-content" *ngIf="resultat.statut === 'ok' && resultat.modele">
            <div class="result-grid">
              <div class="res-item">
                <span class="label">Modèle Détecté</span>
                <span class="val highlight">{{ resultat.modele.reference }}</span>
              </div>

              <div class="res-item" *ngIf="resultat.score_confiance !== undefined && resultat.score_confiance !== null">
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
            <div class="guidage-box" *ngIf="resultat.casier && resultat.ebauche && resultat.ebauche.quantite > resultat.ebauche.quantite_min">
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

          <!-- Top 3 prédictions YOLO (utile pour vérification ou diagnostic) -->
          <div class="equiv-box" *ngIf="resultat.top3 && resultat.top3.length > 0">
            <h4>🎯 Top 3 Prédictions IA :</h4>
            <div class="equiv-tags">
              <span class="equiv-pill" *ngFor="let pred of resultat.top3">
                {{ pred.classe }} · {{ (pred.confiance * 100).toFixed(1) }} %
              </span>
            </div>
          </div>

          <!-- Bouton Nouveau Scan (Mobile / Bureau) -->
          <div class="new-scan-bar">
            <button type="button" class="btn btn-secondary w-100" (click)="nouveauScan()">
              🔄 Scanner une autre clé
            </button>
          </div>
        </div>

        <!-- Erreur serveur (ex: best.pt absent en mode real) -->
        <div class="card result-card" *ngIf="!resultat && erreurScan">
          <div class="status-banner photo_floue">
            <span class="status-icon">⚠️</span>
            <div class="status-text">
              <h3>Service de scan indisponible</h3>
              <p>{{ erreurScan }}</p>
            </div>
          </div>
        </div>

        <!-- Placeholder en attente de scan -->
        <div class="card result-card placeholder-card" *ngIf="!resultat && !erreurScan">
          <div class="empty-state">
            <span class="empty-icon">💡</span>
            <h3>En attente de scan</h3>
            <p>Présentez une clé devant la webcam ou chargez un fichier pour lancer la détection neuronale et localiser son casier.</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .scan-page { display: flex; flex-direction: column; gap: 1.5rem; }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
      h1 { font-size: 1.75rem; font-weight: 700; }
      .subtitle { color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.2rem; }
    }

    .mode-tabs {
      display: flex;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 0.25rem;
      gap: 0.25rem;
    }

    .mode-tab {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border: none;
      background: none;
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-secondary);
      transition: all 0.2s;

      &.active {
        background: var(--primary);
        color: #ffffff;
      }
      &:not(.active):hover {
        background: var(--border-light);
        color: var(--text-primary);
      }
    }

    .scan-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      @media (max-width: 900px) { grid-template-columns: 1fr; }
    }

    /* Section Caméra */
    .video-wrapper {
      position: relative;
      background: #0f172a;
      border-radius: var(--radius-lg);
      overflow: hidden;
      min-height: 340px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .video-feed {
      width: 100%;
      height: 360px;
      object-fit: contain;
    }

    .viewfinder {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }

    .target-frame {
      position: relative;
      width: 240px;
      height: 240px;
      border: 1px dashed rgba(255, 255, 255, 0.4);
      border-radius: 12px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding-bottom: 0.75rem;

      .corner {
        position: absolute;
        width: 20px;
        height: 20px;
        border-color: #38bdf8;
        border-style: solid;
      }
      .tl { top: -2px; left: -2px; border-width: 3px 0 0 3px; border-top-left-radius: 8px; }
      .tr { top: -2px; right: -2px; border-width: 3px 3px 0 0; border-top-right-radius: 8px; }
      .bl { bottom: -2px; left: -2px; border-width: 0 0 3px 3px; border-bottom-left-radius: 8px; }
      .br { bottom: -2px; right: -2px; border-width: 0 3px 3px 0; border-bottom-right-radius: 8px; }

      .laser-scanner {
        position: absolute;
        left: 0; right: 0;
        height: 2px;
        background: linear-gradient(90deg, transparent, #38bdf8, transparent);
        box-shadow: 0 0 12px #38bdf8;
        animation: scanMove 2.5s ease-in-out infinite alternate;
      }

      .frame-label {
        background: rgba(15, 23, 42, 0.75);
        color: #e2e8f0;
        font-size: 0.75rem;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        backdrop-filter: blur(4px);
      }
    }

    @keyframes scanMove {
      0% { top: 10%; }
      100% { top: 90%; }
    }

    .camera-off-placeholder {
      text-align: center;
      padding: 3rem 2rem;
      color: #94a3b8;
      .cam-big-icon { font-size: 3.5rem; display: block; margin-bottom: 0.75rem; }
      h3 { color: #f8fafc; font-size: 1.2rem; margin-bottom: 0.5rem; }
      p { font-size: 0.85rem; max-width: 320px; margin: 0 auto; }
    }

    .captured-preview {
      width: 100%;
      height: 340px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000;
      .captured-img { max-width: 100%; max-height: 100%; object-fit: contain; }
      .captured-badge {
        position: absolute;
        top: 1rem; right: 1rem;
        background: var(--success);
        color: white;
        padding: 0.3rem 0.7rem;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 600;
      }
    }

    .camera-controls {
      display: flex;
      gap: 0.75rem;
      margin-top: 1rem;
      .capture-btn { flex: 1; font-size: 1rem; padding: 0.75rem; }
    }

    .camera-error-banner {
      position: absolute;
      bottom: 1rem;
      background: rgba(239, 68, 68, 0.9);
      color: white;
      padding: 0.5rem 1rem;
      border-radius: var(--radius-sm);
      font-size: 0.8rem;
    }

    /* Mode Fichier */
    .dropzone {
      border: 2px dashed var(--border);
      border-radius: var(--radius-lg);
      padding: 2.5rem;
      text-align: center;
      cursor: pointer;
      background: var(--bg-page);
      transition: all 0.2s;

      &:hover { border-color: var(--primary); }
      &.has-preview {
        padding: 0.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .camera-icon { font-size: 3rem; margin-bottom: 0.5rem; display: block; }
      h3 { font-size: 1.1rem; margin-bottom: 0.25rem; }
      p { font-size: 0.85rem; color: var(--text-secondary); }
    }

    .preview-container {
      position: relative;
      border-radius: var(--radius-md);
      overflow: hidden;
      width: 100%;
      height: 380px;
      background: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;

      .preview-img {
        width: 100%;
        height: 100%;
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        display: block;
      }
      .preview-overlay {
        position: absolute;
        bottom: 0; left: 0; right: 0;
        background: rgba(0, 0, 0, 0.65);
        color: white;
        padding: 0.5rem;
        font-size: 0.8rem;
      }
    }

    .actions { margin-top: 1rem; }
    .scan-btn { width: 100%; padding: 0.85rem; font-size: 1rem; }

    /* Mode Mobile */
    .mobile-section {
      display: flex;
      flex-direction: column;
    }

    .mobile-prompt-box {
      text-align: center;
      padding: 2.5rem 1.5rem;
      background: var(--bg-page);
      border: 2px dashed var(--border);
      border-radius: var(--radius-lg);

      .mobile-big-icon {
        font-size: 3.5rem;
        display: block;
        margin-bottom: 0.75rem;
      }
      h3 {
        color: var(--text-primary);
        font-size: 1.25rem;
        font-weight: 700;
        margin-bottom: 0.5rem;
      }
      p {
        color: var(--text-secondary);
        font-size: 0.9rem;
        max-width: 380px;
        margin: 0 auto 1.5rem auto;
      }
    }

    .mobile-guide {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-width: 400px;
      margin: 0 auto 1.5rem auto;
      text-align: left;

      .guide-item {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        padding: 0.6rem 0.9rem;
        font-size: 0.85rem;
        color: var(--text-secondary);
      }
    }

    .mobile-trigger-btn {
      padding: 0.85rem 1.75rem;
      font-size: 1rem;
      font-weight: 600;
      box-shadow: var(--shadow-md);
      cursor: pointer;
    }

    /* Résultat */
    .placeholder-card {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 340px;
      text-align: center;
      color: var(--text-muted);
      .empty-state {
        max-width: 320px;
        .empty-icon { font-size: 3rem; display: block; margin-bottom: 0.5rem; opacity: 0.6; }
        h3 { color: var(--text-primary); font-size: 1.1rem; margin-bottom: 0.35rem; }
        p { font-size: 0.85rem; }
      }
    }

    .status-banner {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      border-radius: var(--radius-md);
      margin-bottom: 1.25rem;

      &.ok { background: var(--success-bg); color: var(--success); }
      &.non_reconnue, &.modele_inexistant { background: var(--warning-bg); color: var(--warning); }
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

    .new-scan-bar {
      margin-top: 1.25rem;
      border-top: 1px solid var(--border);
      padding-top: 1rem;
      button { width: 100%; padding: 0.8rem; font-weight: 600; font-size: 0.95rem; }
    }

    .w-100 { width: 100%; }

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
export class ScanComponent implements OnInit, OnDestroy {
  @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;
  @ViewChild('mobileCameraInput') mobileCameraInput?: ElementRef<HTMLInputElement>;

  mode: 'camera' | 'file' | 'mobile' = 'camera';
  facingMode: 'environment' | 'user' = 'environment';
  cameraActive = false;
  cameraErreur = '';
  mediaStream: MediaStream | null = null;

  selectedFile: File | null = null;
  previewUrl: string | null = null;
  loading = false;
  resultat: ScanResultat | null = null;
  erreurScan = '';
  prelevementFait = false;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    // Activer automatiquement la caméra au chargement pour une expérience fluide
    this.demarrerCamera();
  }

  ngOnDestroy(): void {
    this.arreterCamera();
  }

  setMode(mode: 'camera' | 'file' | 'mobile'): void {
    this.mode = mode;
    this.resultat = null;
    this.erreurScan = '';
    this.previewUrl = null;
    this.selectedFile = null;

    if (mode === 'camera') {
      this.demarrerCamera();
    } else {
      this.arreterCamera();
      if (mode === 'mobile') {
        this.declencherPhotoMobile();
      }
    }
  }

  declencherPhotoMobile(): void {
    this.mode = 'mobile';
    this.arreterCamera();
    if (this.mobileCameraInput && this.mobileCameraInput.nativeElement) {
      this.mobileCameraInput.nativeElement.value = '';
      this.mobileCameraInput.nativeElement.click();
    }
  }

  onMobileCaptureSelected(event: any): void {
    this.onFileSelected(event);
    if (this.selectedFile) {
      this.lancerScan();
    }
  }

  basculerCamera(): void {
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    this.arreterCamera();
    this.demarrerCamera();
  }

  nouveauScan(): void {
    this.resultat = null;
    this.erreurScan = '';
    this.selectedFile = null;
    this.previewUrl = null;
    this.prelevementFait = false;
    if (this.mode === 'camera') {
      this.demarrerCamera();
    }
  }

  demarrerCamera(): void {
    this.cameraErreur = '';
    this.previewUrl = null;
    this.selectedFile = null;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.cameraErreur = 'Votre navigateur ne supporte pas l’accès direct à la caméra.';
      return;
    }

    navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: { ideal: this.facingMode }
      },
      audio: false
    }).then((stream) => {
      this.mediaStream = stream;
      this.cameraActive = true;
      setTimeout(() => {
        if (this.videoElement && this.videoElement.nativeElement) {
          this.videoElement.nativeElement.srcObject = stream;
        }
      }, 50);
    }).catch((err) => {
      console.warn('Erreur caméra :', err);
      this.cameraActive = false;
      this.cameraErreur = 'Impossible d\'accéder à la caméra en direct. Vérifiez les autorisations de votre navigateur ou utilisez l\'onglet "Photo Mobile".';
    });
  }

  arreterCamera(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    this.cameraActive = false;
  }

  capturerPhoto(): void {
    if (!this.videoElement || !this.videoElement.nativeElement) return;
    const video = this.videoElement.nativeElement;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Sauvegarder l'image du flux
    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      this.selectedFile = new File([blob], `scan_camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
      this.previewUrl = canvas.toDataURL('image/jpeg', 0.92);
      this.arreterCamera();
      // Lancer automatiquement l'analyse IA
      this.lancerScan();
    }, 'image/jpeg', 0.92);
  }

  reprendrePhoto(): void {
    this.resultat = null;
    this.erreurScan = '';
    this.previewUrl = null;
    this.selectedFile = null;
    this.demarrerCamera();
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.prelevementFait = false;
      this.resultat = null;
      this.erreurScan = '';

      const reader = new FileReader();
      reader.onload = () => this.previewUrl = reader.result as string;
      reader.readAsDataURL(file);
    }
  }

  lancerScan(): void {
    if (!this.selectedFile) return;
    this.loading = true;
    this.prelevementFait = false;
    this.erreurScan = '';

    const formData = new FormData();
    formData.append('photo', this.selectedFile);

    this.api.scannerCle(formData).subscribe({
      next: (res) => {
        this.loading = false;
        this.resultat = res;
      },
      error: (err) => {
        this.loading = false;
        this.resultat = null;
        this.erreurScan = err?.error?.detail || 'Erreur serveur lors de la reconnaissance IA.';
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
      case 'ok': return 'Identification Réussie';
      case 'photo_floue': return 'Photo Floue Détectée';
      case 'non_reconnue': return 'Clé Non Reconnue';
      case 'modele_inexistant': return 'Modèle Absent du Stock';
      default: return 'Détection Impossible';
    }
  }
}
