import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { Ebauche, StatDashboard } from '../../core/models/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="dashboard-page">
      <div class="page-header">
        <div>
          <h1>Tableau de Bord</h1>
          <p class="subtitle">Vue d'ensemble du stock et des activités d'identification</p>
        </div>
        <a routerLink="/scan" class="btn btn-primary">
          <span>📷 Lancer un Scan</span>
        </a>
      </div>

      <!-- Métriques Cartes -->
      <div class="stats-grid" *ngIf="stats">
        <div class="stat-card">
          <div class="icon-wrap primary">🔑</div>
          <div class="info">
            <span class="label">Modèles Référencés</span>
            <span class="value">{{ stats.total_modeles }}</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="icon-wrap success">📦</div>
          <div class="info">
            <span class="label">Total Casiers en Stock</span>
            <span class="value">{{ stats.total_ebauches }}</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="icon-wrap warning">⚠️</div>
          <div class="info">
            <span class="label">Seuil d'Alerte Atteint</span>
            <span class="value">{{ stats.ebauches_en_alerte }}</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="icon-wrap danger">🚫</div>
          <div class="info">
            <span class="label">Stock Épuisé</span>
            <span class="value">{{ stats.ebauches_epuisees }}</span>
          </div>
        </div>
      </div>

      <!-- Section Alertes Prioritaires -->
      <div class="card alertes-section">
        <div class="section-header">
          <h2>🚨 Réapprovisionnements Prioritaires</h2>
          <span class="badge alerte" *ngIf="alertes.length > 0">{{ alertes.length }} en alerte</span>
        </div>

        <div *ngIf="alertes.length === 0" class="empty-state">
          <span>✅ Tous les stocks sont au-dessus des seuils de sécurité.</span>
        </div>

        <div class="table-container" *ngIf="alertes.length > 0">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Fabricant</th>
                <th>Casier</th>
                <th>Quantité Actuelle</th>
                <th>Seuil d'Alerte</th>
                <th>Statut</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of alertes">
                <td><strong>{{ item.modele.reference }}</strong></td>
                <td>{{ item.modele.fabricant?.nom }}</td>
                <td>
                  <span class="casier-pill">{{ item.casier.code }}</span>
                </td>
                <td [class.danger-text]="item.quantite <= item.quantite_min">
                  {{ item.quantite }}
                </td>
                <td>{{ item.seuil_alerte }}</td>
                <td>
                  <span class="badge" [ngClass]="item.statut_stock">
                    {{ item.statut_stock === 'epuise' ? 'Épuisé' : 'Critique' }}
                  </span>
                </td>
                <td>
                  <button class="btn btn-secondary btn-sm" (click)="allumerCasier(item.casier_id)">
                    💡 Allumer (15s)
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-page {
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

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.25rem;
    }

    .stat-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 1.25rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      box-shadow: var(--shadow-sm);

      .icon-wrap {
        width: 48px;
        height: 48px;
        border-radius: var(--radius-md);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;

        &.primary { background: var(--primary-light); }
        &.success { background: var(--success-bg); }
        &.warning { background: var(--warning-bg); }
        &.danger { background: var(--danger-bg); }
      }

      .info {
        display: flex;
        flex-direction: column;
        .label { font-size: 0.8rem; color: var(--text-secondary); font-weight: 500; }
        .value { font-size: 1.5rem; font-weight: 700; color: var(--text-primary); }
      }
    }

    .alertes-section {
      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
        h2 { font-size: 1.2rem; font-weight: 600; }
      }
    }

    .custom-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;

      th {
        padding: 0.75rem 1rem;
        background: var(--bg-page);
        color: var(--text-secondary);
        font-size: 0.8rem;
        text-transform: uppercase;
        border-bottom: 1px solid var(--border);
      }

      td {
        padding: 0.85rem 1rem;
        border-bottom: 1px solid var(--border-light);
        font-size: 0.9rem;
      }
    }

    .casier-pill {
      background: var(--primary-light);
      color: var(--primary);
      padding: 0.2rem 0.6rem;
      border-radius: 6px;
      font-weight: 600;
    }

    .danger-text {
      color: var(--danger);
      font-weight: bold;
    }

    .btn-sm {
      padding: 0.35rem 0.7rem;
      font-size: 0.8rem;
    }

    .empty-state {
      padding: 2rem;
      text-align: center;
      color: var(--success);
      font-weight: 500;
    }
  `]
})
export class DashboardComponent implements OnInit {
  stats: StatDashboard | null = null;
  alertes: Ebauche[] = [];

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.chargerDonnees();
  }

  chargerDonnees(): void {
    this.api.getDashboardStats().subscribe({
      next: (res) => this.stats = res
    });

    this.api.getAlertes().subscribe({
      next: (res) => this.alertes = res
    });
  }

  allumerCasier(casierId: number): void {
    this.api.allumerLed(casierId, 15).subscribe();
  }
}

