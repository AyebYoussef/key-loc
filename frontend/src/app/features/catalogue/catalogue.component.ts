import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ModeleCle } from '../../core/models/models';

@Component({
  selector: 'app-catalogue',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="catalogue-page">
      <div class="page-header">
        <div>
          <h1>Catalogue & Recherche Manuelle</h1>
          <p class="subtitle">Recherche de secours en cas d'échec de détection photo ou consultation de références</p>
        </div>
      </div>

      <div class="card search-card">
        <div class="search-bar">
          <input type="text" [(ngModel)]="searchQuery" (input)="onSearch()" placeholder="Rechercher par référence (ex: SX9, YA1, EU6P) ou nom de modèle..." />
          <button class="btn btn-primary" (click)="onSearch()">Rechercher</button>
        </div>
      </div>

      <div class="models-grid">
        <div class="card model-card" *ngFor="let m of modeles">
          <div class="m-header">
            <h3>{{ m.reference }}</h3>
            <span class="fab-tag">{{ m.fabricant?.nom }}</span>
          </div>
          <p class="desc">{{ m.libelle }}</p>

          <div class="m-footer">
            <button class="btn btn-secondary btn-sm" (click)="chargerEquivalences(m)">
              Voir équivalences
            </button>
          </div>

          <div class="equiv-list" *ngIf="m.equivalences && m.equivalences.length > 0">
            <span class="eq-title">Équivalents :</span>
            <span class="eq-badge" *ngFor="let eq of m.equivalences">{{ eq.reference }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .catalogue-page { display: flex; flex-direction: column; gap: 1.5rem; }
    .page-header h1 { font-size: 1.75rem; font-weight: 700; }
    .subtitle { color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.2rem; }

    .search-bar {
      display: flex; gap: 1rem;
      input {
        flex: 1; padding: 0.75rem 1rem; border: 1px solid var(--border);
        border-radius: var(--radius-md); font-size: 0.95rem; outline: none;
        background: var(--bg-page); color: var(--text-primary);
        &:focus { border-color: var(--primary); }
      }
    }

    .models-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.25rem;
    }

    .model-card {
      display: flex; flex-direction: column; gap: 0.75rem;
      .m-header {
        display: flex; justify-content: space-between; align-items: center;
        h3 { font-size: 1.2rem; font-weight: 700; color: var(--primary); }
        .fab-tag { font-size: 0.75rem; background: var(--bg-page); padding: 0.2rem 0.5rem; border-radius: 4px; border: 1px solid var(--border); }
      }
      .desc { font-size: 0.85rem; color: var(--text-secondary); min-height: 40px; }
      .m-footer { margin-top: auto; }
      .equiv-list {
        display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center;
        margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dashed var(--border);
        .eq-title { font-size: 0.75rem; color: var(--text-muted); }
        .eq-badge { font-size: 0.75rem; background: var(--primary-light); color: var(--primary); padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: 600; }
      }
    }
  `]
})
export class CatalogueComponent implements OnInit {
  modeles: ModeleCle[] = [];
  searchQuery = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.onSearch();
  }

  onSearch(): void {
    this.api.getModeles(this.searchQuery).subscribe({
      next: (res) => this.modeles = res
    });
  }

  chargerEquivalences(modele: ModeleCle): void {
    this.api.getModele(modele.id).subscribe({
      next: (full) => {
        modele.equivalences = full.equivalences;
      }
    });
  }
}

