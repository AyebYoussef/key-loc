import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './layout/sidebar.component';
import { HeaderComponent } from './layout/header.component';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, HeaderComponent],
  template: `
    <div class="app-layout" *ngIf="authService.currentUser$ | async; else noAuth">
      <app-sidebar></app-sidebar>
      <div class="main-content-area">
        <app-header></app-header>
        <main class="page-container">
          <router-outlet></router-outlet>
        </main>
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
    }

    .page-container {
      margin-left: 260px;
      padding: 2rem;
      flex: 1;
      background-color: var(--bg-page);
    }
  `]
})
export class AppComponent {
  constructor(public authService: AuthService) {}
}
