import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { Ebauche } from '../../core/models/models';

@Component({
  selector: 'app-stock',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="stock-page">
      <div class="page-header">
        <div>
          <h1>Gestion des Stocks & Prélèvements</h1>
          <p class="subtitle">Inventaire en temps réel par casier · Prélèvement immédiat · Réapprovisionnement</p>
        </div>
        <div class="filter-group">
          <button class="btn btn-sm" [class.btn-primary]="filtreStatut === ''" (click)="filtrer('')">Tous</button>
          <button class="btn btn-sm" [class.btn-primary]="filtreStatut === 'alerte'" (click)="filtrer('alerte')">Alertes</button>
          <button class="btn btn-sm" [class.btn-primary]="filtreStatut === 'epuise'" (click)="filtrer('epuise')">Épuisés</button>
        </div>
      </div>

      <div class="card">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Référence</th>
              <th>Désignation</th>
              <th>Casier</th>
              <th>Quantité</th>
              <th>Seuil Min</th>
              <th>Statut</th>
              <th style="text-align: right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of ebauches">
              <td><strong>{{ item.modele.reference }}</strong></td>
              <td>{{ item.modele.libelle }}</td>
              <td><span class="casier-pill">{{ item.casier.code }}</span></td>
              <td class="font-bold">{{ item.quantite }}</td>
              <td>{{ item.seuil_alerte }}</td>
              <td>
                <span class="badge" [ngClass]="item.statut_stock">{{ item.statut_stock }}</span>
              </td>
              <td style="text-align: right">
                <button class="btn btn-secondary btn-xs mr-2" (click)="allumer(item.casier_id)">💡 Allumer</button>
                <button class="btn btn-primary btn-xs mr-2" (click)="prelever(item)" [disabled]="item.quantite <= item.quantite_min">
                  -1 Prélever
                </button>
                <button class="btn btn-secondary btn-xs" (click)="reapprovisionner(item)">+ Réappro</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .stock-page { display: flex; flex-direction: column; gap: 1.5rem; }
    .page-header { display: flex; justify-content: space-between; align-items: center; }
    .page-header h1 { font-size: 1.75rem; font-weight: 700; }
    .subtitle { color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.2rem; }

    .filter-group { display: flex; gap: 0.5rem; }

    .custom-table {
      width: 100%; border-collapse: collapse; text-align: left;
      th { padding: 0.75rem 1rem; background: var(--bg-page); color: var(--text-secondary); font-size: 0.8rem; text-transform: uppercase; border-bottom: 1px solid var(--border); }
      td { padding: 0.85rem 1rem; border-bottom: 1px solid var(--border-light); font-size: 0.9rem; }
    }

    .casier-pill { background: var(--primary-light); color: var(--primary); padding: 0.2rem 0.6rem; border-radius: 6px; font-weight: 600; }
    .font-bold { font-weight: 700; }
    .btn-xs { padding: 0.3rem 0.6rem; font-size: 0.75rem; }
    .mr-2 { margin-right: 0.5rem; }
  `]
})
export class StockComponent implements OnInit {
  ebauches: Ebauche[] = [];
  filtreStatut = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.api.getEbauches(this.filtreStatut).subscribe({
      next: (res) => this.ebauches = res
    });
  }

  filtrer(statut: string): void {
    this.filtreStatut = statut;
    this.charger();
  }

  allumer(casierId: number): void {
    this.api.allumerLed(casierId, 15).subscribe();
  }

  prelever(item: Ebauche): void {
    this.api.prelever(item.id).subscribe({
      next: (updated) => {
        item.quantite = updated.quantite;
        item.statut_stock = updated.statut_stock;
      }
    });
  }

  reapprovisionner(item: Ebauche): void {
    const qte = prompt('Quantité à ajouter au stock :', '10');
    if (qte && parseInt(qte, 10) > 0) {
      this.api.reapprovisionner(item.id, parseInt(qte, 10)).subscribe({
        next: (updated) => {
          item.quantite = updated.quantite;
          item.statut_stock = updated.statut_stock;
        }
      });
    }
  }
}

