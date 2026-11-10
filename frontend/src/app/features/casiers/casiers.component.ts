import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { Casier } from '../../core/models/models';
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
          <p class="subtitle">Simulation virtuelle du panneau de LED (WS2812B / V1) — Durée d'allumage : 15s</p>
        </div>
        <div class="legend">
          <div class="legend-item"><span class="led-dot active"></span> LED Allumée</div>
          <div class="legend-item"><span class="led-dot inactive"></span> Éteinte</div>
        </div>
      </div>

      <!-- Grille virtuelle 4x5 -->
      <div class="grid-container">
        <div class="casier-cell" *ngFor="let casier of casiers" [class.allume]="casier.etat_led?.actif">
          <div class="casier-header">
            <span class="code">{{ casier.code }}</span>
            <div class="led-indicator" [class.pulse]="casier.etat_led?.actif"></div>
          </div>

          <div class="casier-body">
            <span class="pos">Ligne {{ casier.ligne }} · Col {{ casier.colonne }}</span>
            <span class="led-index" *ngIf="casier.led_index !== null">Index LED: #{{ casier.led_index }}</span>
          </div>

          <div class="casier-actions">
            <button class="btn btn-sm" [class.btn-primary]="!casier.etat_led?.actif" [class.btn-danger]="casier.etat_led?.actif"
                    (click)="toggleLed(casier)">
              {{ casier.etat_led?.actif ? 'Éteindre' : 'Tester (15s)' }}
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
        transform: translateY(-2px);
      }

      .casier-header {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .code {
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--text-primary);
        }
      }

      .casier-body {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        font-size: 0.75rem;
        color: var(--text-secondary);
      }

      .casier-actions {
        margin-top: auto;
      }
    }

    .led-indicator, .led-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #94a3b8;
      transition: all 0.2s;

      &.active, &.pulse {
        background: #3b82f6;
        box-shadow: 0 0 12px #3b82f6, 0 0 20px #3b82f6;
        animation: blink 1.2s infinite ease-in-out;
      }

      &.inactive {
        background: #cbd5e1;
      }
    }

    @keyframes blink {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.9); }
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
  pollSubscription?: Subscription;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.chargerCasiers();
    // Polling toutes les 2 secondes pour actualiser les LED virtuelles
    this.pollSubscription = interval(2000).subscribe(() => this.actualiserEtatsLed());
  }

  ngOnDestroy(): void {
    this.pollSubscription?.unsubscribe();
  }

  chargerCasiers(): void {
    this.api.getCasiers().subscribe({
      next: (res) => {
        this.casiers = res;
        this.actualiserEtatsLed();
      }
    });
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
      this.api.allumerLed(casier.id, 15).subscribe({
        next: (etat) => casier.etat_led = etat
      });
    }
  }
}

