import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { Casier, Ebauche } from '../../core/models/models';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-casiers',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="casiers-page">
      <div class="page-header">
        <div>
          <h1>Grille des Casiers & Guidage Lumineux</h1>
          <p class="subtitle">Casiers A1 à A5 avec intégration IoT ESP8266 (Pins D3, D4, D5) — Clignotement 10 secondes</p>
        </div>
        <div class="legend">
          <div class="legend-item"><span class="led-dot active"></span> LED Clignotante (10s)</div>
          <div class="legend-item"><span class="led-dot inactive"></span> Éteinte</div>
        </div>
      </div>

      <!-- Grille virtuelle 5 casiers (A1 à A5) -->
      <div class="grid-container">
        <div class="casier-cell" *ngFor="let casier of casiers" [class.allume]="casier.etat_led?.actif">
          <div class="casier-header">
            <span class="code">{{ casier.code }}</span>
            <div class="led-indicator" [class.pulse]="casier.etat_led?.actif"></div>
          </div>

          <div class="casier-body">
            <span class="pos">Position : {{ casier.code }} (Col {{ casier.colonne }})</span>
            <span class="esp-pin-badge" *ngIf="casier.esp_pin">⚡ ESP8266 Pin: {{ casier.esp_pin }}</span>

            <!-- Clé stockée dans ce casier -->
            <div class="ebauche-tag" *ngIf="getEbaucheForCasier(casier.id) as ebauche">
              <span class="key-icon">🔑</span>
              <div class="key-info">
                <strong>{{ ebauche.modele.reference }}</strong>
                <span class="qte">Stock : {{ ebauche.quantite }}</span>
              </div>
            </div>
            <div class="empty-casier-tag" *ngIf="!getEbaucheForCasier(casier.id)">
              <span class="empty-dot">○</span>
              <span>Casier disponible</span>
            </div>
          </div>

          <div class="casier-actions">
            <button class="btn btn-sm" [class.btn-primary]="!casier.etat_led?.actif" [class.btn-danger]="casier.etat_led?.actif"
                    (click)="toggleLed(casier)">
              {{ casier.etat_led?.actif ? 'Éteindre' : 'Tester LED (10s)' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .casiers-page {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      h1 { font-size: 1.75rem; font-weight: 700; }
      .subtitle { color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.2rem; }
    }

    .legend {
      display: flex;
      gap: 1rem;
      background: var(--bg-card);
      padding: 0.5rem 1rem;
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      .legend-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.85rem;
      }
    }

    .grid-container {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 1rem;

      @media (max-width: 900px) {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    .casier-cell {
      background: var(--bg-card);
      border: 2px solid var(--border);
      border-radius: var(--radius-md);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      transition: all 0.3s ease;

      &.allume {
        border-color: #3b82f6;
        box-shadow: 0 0 25px rgba(59, 130, 246, 0.5);
        background: rgba(59, 130, 246, 0.05);

        .led-indicator {
          background-color: #3b82f6;
          box-shadow: 0 0 15px #3b82f6, 0 0 30px #3b82f6;
        }
      }
    }

    .casier-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .code {
        font-size: 1.2rem;
        font-weight: 700;
        color: var(--text-primary);
      }
    }

    .led-indicator, .led-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background-color: var(--border);
      transition: all 0.2s;

      &.active {
        background-color: #3b82f6;
        box-shadow: 0 0 8px #3b82f6;
      }
    }

    .pulse {
      animation: pulse 1s infinite alternate;
    }

    @keyframes pulse {
      0% { transform: scale(0.9); opacity: 0.8; }
      100% { transform: scale(1.3); opacity: 1; }
    }

    .casier-body {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      flex: 1;

      .pos {
        font-size: 0.8rem;
        color: var(--text-secondary);
      }

      .esp-pin-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        background: rgba(16, 185, 129, 0.15);
        color: #10b981;
        font-weight: 700;
        font-size: 0.75rem;
        padding: 0.2rem 0.5rem;
        border-radius: 4px;
        border: 1px solid rgba(16, 185, 129, 0.3);
        width: fit-content;
      }

      .ebauche-tag {
        margin-top: 0.4rem;
        background: var(--primary-light);
        border: 1px solid rgba(37, 99, 235, 0.2);
        padding: 0.35rem 0.55rem;
        border-radius: 6px;
        display: flex;
        align-items: center;
        gap: 0.45rem;
        font-size: 0.8rem;
        .key-icon { font-size: 1rem; }
        .key-info {
          display: flex;
          flex-direction: column;
          line-height: 1.2;
          strong { color: var(--primary); }
          .qte { font-size: 0.7rem; color: var(--text-secondary); }
        }
      }

      .empty-casier-tag {
        margin-top: 0.4rem;
        font-size: 0.75rem;
        color: var(--text-muted);
        display: flex;
        align-items: center;
        gap: 0.35rem;
      }
    }

    .btn-sm {
      width: 100%;
      padding: 0.4rem;
      font-size: 0.8rem;
    }
  `]
})
export class CasiersComponent implements OnInit, OnDestroy {
  casiers: Casier[] = [];
  ebauches: Ebauche[] = [];
  pollSubscription?: Subscription;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.chargerDonnees();
    // Polling toutes les 2 secondes pour actualiser les LED virtuelles
    this.pollSubscription = interval(2000).subscribe(() => this.actualiserEtatsLed());
  }

  ngOnDestroy(): void {
    this.pollSubscription?.unsubscribe();
  }

  chargerDonnees(): void {
    this.api.getCasiers().subscribe({
      next: (res) => {
        this.casiers = res;
        this.actualiserEtatsLed();
      }
    });
    this.api.getEbauches().subscribe({
      next: (res) => this.ebauches = res
    });
  }

  getEbaucheForCasier(casierId: number): Ebauche | undefined {
    return this.ebauches.find(e => e.casier_id === casierId);
  }

  actualiserEtatsLed(): void {
    this.casiers.forEach(casier => {
      this.api.getEtatLed(casier.id).subscribe({
        next: (etat) => casier.etat_led = etat
      });
    });
  }

  toggleLed(casier: Casier): void {
    if (casier.etat_led?.actif) {
      this.api.eteindreLed(casier.id).subscribe({
        next: (etat) => casier.etat_led = etat
      });
    } else {
      this.api.allumerLed(casier.id, 10).subscribe({
        next: (etat) => casier.etat_led = etat
      });
    }
  }
}
