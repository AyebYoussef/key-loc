import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './layout/sidebar.component';
import { HeaderComponent } from './layout/header.component';
import { BottomNavComponent } from './layout/bottom-nav.component';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, HeaderComponent, BottomNavComponent],
  template: `
    <div class="app-layout" *ngIf="authService.currentUser$ | async; else noAuth">
      <app-sidebar class="desktop-sidebar"></app-sidebar>
      <div class="main-content-area">
        <app-header></app-header>
        <main class="page-container">
          <router-outlet></router-outlet>
        </main>
        <app-bottom-nav></app-bottom-nav>
      </div>
    </div>

    <ng-template #noAuth>
      <router-outlet></router-outlet>
    </ng-template>
  `,
  styles: [`
    .app-layout {
      display: flex;
      min-height: 100vh;
    }

    .main-content-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .page-container {
      margin-left: 260px;
      padding: 2rem;
      flex: 1;
      background-color: var(--bg-page);
      min-width: 0;
      transition: margin-left 0.2s ease, padding 0.2s ease;
    }

    @media (max-width: 768px) {
      .desktop-sidebar {
        display: none !important;
      }
      .page-container {
        margin-left: 0;
        padding: 1rem;
        padding-bottom: 5.5rem; /* Espace réservé pour la barre de navigation mobile */
      }
    }
  `]
})
export class AppComponent {
  constructor(public authService: AuthService) {}
}
