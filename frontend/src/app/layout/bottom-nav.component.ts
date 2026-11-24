import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <nav class="bottom-nav">
      <a routerLink="/dashboard" routerLinkActive="active" class="nav-item">
        <span class="icon">📊</span>
        <span class="label">Accueil</span>
      </a>

      <a routerLink="/casiers" routerLinkActive="active" class="nav-item">
        <span class="icon">💡</span>
        <span class="label">Casiers</span>
      </a>

      <a routerLink="/scan" routerLinkActive="active" class="nav-item scan-center">
        <div class="scan-button-wrapper">
          <span class="icon">📷</span>
        </div>
        <span class="label">Scanner</span>
      </a>

      <a routerLink="/stock" routerLinkActive="active" class="nav-item">
        <span class="icon">📦</span>
        <span class="label">Stock</span>
      </a>

      <a routerLink="/catalogue" routerLinkActive="active" class="nav-item">
        <span class="icon">📑</span>
        <span class="label">Catalogue</span>
      </a>
    </nav>
  `,
  styles: [`
    :host {
      display: none;
    }

    @media (max-width: 768px) {
      :host {
        display: block;
      }

      .bottom-nav {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 64px;
        background: var(--bg-surface);
        border-top: 1px solid var(--border);
        box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.08);
        display: flex;
        justify-content: space-around;
        align-items: center;
        z-index: 1000;
        padding-bottom: env(safe-area-inset-bottom, 0px);
      }

      .nav-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-decoration: none;
        color: var(--text-secondary);
        font-size: 0.72rem;
        font-weight: 500;
        flex: 1;
        height: 100%;
        transition: all 0.2s;

        .icon {
          font-size: 1.25rem;
          margin-bottom: 2px;
        }

        &.active {
          color: var(--primary);
          font-weight: 700;

          .icon {
            transform: scale(1.1);
          }
        }
      }

      .scan-center {
        position: relative;
        top: -12px;

        .scan-button-wrapper {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 2px;
          border: 3px solid var(--bg-surface);
          transition: transform 0.2s ease, box-shadow 0.2s ease;

          .icon {
            font-size: 1.5rem;
            margin-bottom: 0;
            filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2));
          }
        }

        &.active .scan-button-wrapper {
          background: linear-gradient(135deg, #1d4ed8, #1e40af);
          box-shadow: 0 6px 16px rgba(37, 99, 235, 0.6);
          transform: scale(1.05);
        }

        .label {
          font-size: 0.75rem;
          font-weight: 600;
        }
      }
    }
  `]
})
export class BottomNavComponent {}
