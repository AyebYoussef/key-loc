import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="header">
      <div class="header-title">
        <span>Système de Guidage Lumineux pour Casiers d'Ébauches</span>
      </div>
      <div class="header-actions">
        <button class="theme-toggle" (click)="toggleTheme()" [title]="isDark ? 'Mode clair' : 'Mode sombre'">
          {{ isDark ? '☀️ Clair' : '🌙 Sombre' }}
        </button>
      </div>
    </header>
  `,
  styles: [`
    .header {
      height: 60px;
      background-color: var(--bg-surface);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 2rem;
      margin-left: 260px;
    }

    .header-title {
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--text-secondary);
    }

    .theme-toggle {
      background: var(--bg-page);
      border: 1px solid var(--border);
      color: var(--text-primary);
      padding: 0.4rem 0.8rem;
      border-radius: var(--radius-md);
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 500;
      transition: all 0.2s;

      &:hover {
        background: var(--border);
      }
    }
  `]
})
export class HeaderComponent {
  isDark = false;

  toggleTheme(): void {
    this.isDark = !this.isDark;
    if (this.isDark) {
      document.body.setAttribute('data-theme', 'dark');
    } else {
      document.body.removeAttribute('data-theme');
    }
  }
}

