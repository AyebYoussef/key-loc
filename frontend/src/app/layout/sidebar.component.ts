import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { Utilisateur } from '../core/models/models';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <aside class="sidebar">
      <div class="logo">
        <span class="icon">🔑</span>
        <h2>KeyLocator</h2>
      </div>

      <nav class="nav-links">
        <a routerLink="/dashboard" routerLinkActive="active" class="nav-item">
          <span class="nav-icon">📊</span>
          <span>Tableau de bord</span>
        </a>
        <a routerLink="/scan" routerLinkActive="active" class="nav-item">
          <span class="nav-icon">📷</span>
          <span>Scan de Clé</span>
        </a>
        <a routerLink="/casiers" routerLinkActive="active" class="nav-item">
          <span class="nav-icon">💡</span>
          <span>Casiers & LED</span>
        </a>
        <a routerLink="/stock" routerLinkActive="active" class="nav-item">
          <span class="nav-icon">📦</span>
          <span>Gestion du Stock</span>
        </a>
        <a routerLink="/catalogue" routerLinkActive="active" class="nav-item">
          <span class="nav-icon">📑</span>
          <span>Catalogue & Recherche</span>
        </a>
      </nav>

      <div class="user-panel" *ngIf="authService.currentUser$ | async as user">
        <div class="user-info">
          <span class="avatar">{{ getInitials(user) }}</span>
          <div class="details">
            <span class="name">{{ user.prenom }} {{ user.nom }}</span>
            <span class="role">{{ user.role?.nom }}</span>
          </div>
        </div>
        <button class="logout-btn" (click)="logout()" title="Se déconnecter" aria-label="Se déconnecter">
          <span class="logout-icon">🚪</span>
        </button>
      </div>
    </aside>
  `,
  styles: [`
    :host {
      display: block;
    }

    @media (max-width: 768px) {
      :host {
        display: none !important;
      }
      .sidebar {
        display: none !important;
      }
    }

    .sidebar {
      width: 260px;
      height: 100vh;
      background-color: var(--bg-surface);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      position: fixed;
      left: 0;
      top: 0;
      z-index: 100;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1.5rem;
      border-bottom: 1px solid var(--border);
      .icon { font-size: 1.5rem; }
      h2 { font-size: 1.25rem; font-weight: 700; color: var(--primary); }
    }

    .nav-links {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 1rem;
      flex: 1;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      text-decoration: none;
      font-weight: 500;
      transition: all 0.15s ease;

      &:hover {
        background-color: var(--border-light);
        color: var(--text-primary);
      }

      &.active {
        background-color: var(--primary-light);
        color: var(--primary);
        font-weight: 600;
      }
    }

    .user-panel {
      padding: 1rem;
      border-top: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;

      .user-info {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        min-width: 0;
        overflow: hidden;
      }

      .avatar {
        width: 36px;
        height: 36px;
        min-width: 36px;
        background: var(--primary);
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 0.85rem;
      }

      .details {
        display: flex;
        flex-direction: column;
        min-width: 0;
        overflow: hidden;
        .name {
          font-size: 0.85rem;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .role { font-size: 0.75rem; color: var(--text-muted); text-transform: capitalize; }
      }

      .logout-btn {
        background: none;
        border: 1px solid transparent;
        font-size: 1.1rem;
        cursor: pointer;
        padding: 0.4rem 0.5rem;
        border-radius: var(--radius-sm, 6px);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
        &:hover {
          background: var(--danger-bg);
          border-color: var(--danger);
        }
      }
    }
  `]
})
export class SidebarComponent {
  constructor(public authService: AuthService) {}

  getInitials(user: Utilisateur): string {
    const p = user?.prenom?.[0] || '';
    const n = user?.nom?.[0] || '';
    return (p + n).toUpperCase() || '?';
  }

  logout(): void {
    this.authService.logout();
  }
}
