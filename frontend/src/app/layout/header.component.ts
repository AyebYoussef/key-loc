import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="header">
      <div class="header-brand">
        <span class="mobile-logo">🔑</span>
        <span class="header-title">KeyLocator</span>
        <span class="header-subtitle">· Guidage Casiers</span>
      </div>
      <div class="header-actions">
        <button class="theme-toggle" (click)="toggleTheme()" [title]="isDark ? 'Mode clair' : 'Mode sombre'">
          {{ isDark ? '☀️ Clair' : '🌙 Sombre' }}
        </button>
        <button class="logout-btn" (click)="logout()" title="Se déconnecter">
          <span class="logout-icon">🚪</span>
          <span class="logout-text">Déconnexion</span>
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
      transition: margin-left 0.2s ease;
    }

    .header-brand {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .mobile-logo {
      display: none;
      font-size: 1.25rem;
    }

    .header-title {
      font-size: 1rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .header-subtitle {
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--text-secondary);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    @media (max-width: 768px) {
      .header {
        margin-left: 0;
        padding: 0 1rem;
      }
      .mobile-logo {
        display: inline-block;
      }
      .header-subtitle {
        display: none;
      }
      .logout-text {
        display: none;
      }
    }

    .theme-toggle, .logout-btn {
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

    .logout-btn:hover {
      background: var(--danger-bg);
      border-color: var(--danger);
      color: var(--danger);
    }
  `]
})
export class HeaderComponent {
  isDark = false;

  constructor(private authService: AuthService) {}

  toggleTheme(): void {
    this.isDark = !this.isDark;
    if (this.isDark) {
      document.body.setAttribute('data-theme', 'dark');
    } else {
      document.body.removeAttribute('data-theme');
    }
  }

  logout(): void {
    this.authService.logout();
  }
}
