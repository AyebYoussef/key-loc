import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="login-container">
      <div class="login-card">
        <div class="header">
          <div class="logo">🔑</div>
          <h1>KeyLocator</h1>
          <p>Gestion et localisation intelligente d'ébauches de clés</p>
        </div>

        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label for="email">Adresse Email</label>
            <input id="email" type="email" formControlName="email" placeholder="ex: jean.dupont@keylocator.fr" />
            <span class="error" *ngIf="loginForm.get('email')?.touched && loginForm.get('email')?.invalid">Email invalide</span>
          </div>

          <div class="form-group">
            <label for="password">Mot de passe</label>
            <input id="password" type="password" formControlName="password" placeholder="••••••••" />
            <span class="error" *ngIf="loginForm.get('password')?.touched && loginForm.get('password')?.invalid">Requis</span>
          </div>

          <div class="alert-error" *ngIf="errorMessage">{{ errorMessage }}</div>

          <button type="submit" class="btn btn-primary submit-btn" [disabled]="loginForm.invalid || loading">
            {{ loading ? 'Connexion en cours...' : 'Se connecter' }}
          </button>
        </form>

        <div class="demo-logins">
          <p class="demo-title">Comptes de test (clic rapide) :</p>
          <div class="demo-buttons">
            <button type="button" (click)="fillLogin('jean.dupont@keylocator.fr')">Serrurier (Jean)</button>
            <button type="button" (click)="fillLogin('sophie.martin@keylocator.fr')">Gérante (Sophie)</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      padding: 1.5rem;
    }

    .login-card {
      background: #ffffff;
      border-radius: var(--radius-lg);
      padding: 2.5rem;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);

      .header {
        text-align: center;
        margin-bottom: 2rem;
        .logo { font-size: 2.5rem; margin-bottom: 0.5rem; }
        h1 { font-size: 1.75rem; color: #0f172a; font-weight: 700; }
        p { color: #64748b; font-size: 0.9rem; margin-top: 0.25rem; }
      }
    }

    .form-group {
      margin-bottom: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;

      label { font-size: 0.85rem; font-weight: 600; color: #334155; }
      input {
        padding: 0.75rem 1rem;
        border: 1px solid #cbd5e1;
        border-radius: var(--radius-md);
        font-size: 0.95rem;
        outline: none;
        transition: border 0.15s;
        &:focus { border-color: var(--primary); ring: 2px solid var(--primary-light); }
      }
      .error { font-size: 0.75rem; color: var(--danger); }
    }

    .alert-error {
      background: var(--danger-bg);
      color: var(--danger);
      padding: 0.75rem;
      border-radius: var(--radius-md);
      font-size: 0.85rem;
      margin-bottom: 1rem;
      text-align: center;
    }

    .submit-btn { width: 100%; padding: 0.8rem; font-size: 1rem; }

    .demo-logins {
      margin-top: 2rem;
      border-top: 1px dashed #e2e8f0;
      padding-top: 1rem;
      text-align: center;
      .demo-title { font-size: 0.75rem; color: #64748b; margin-bottom: 0.5rem; }
      .demo-buttons {
        display: flex;
        gap: 0.5rem;
        justify-content: center;
        button {
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          padding: 0.4rem 0.6rem;
          border-radius: 6px;
          font-size: 0.75rem;
          cursor: pointer;
          &:hover { background: #e2e8f0; }
        }
      }
    }
  `]
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  loading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['jean.dupont@keylocator.fr', [Validators.required, Validators.email]],
      password: ['Password1!', Validators.required]
    });
  }

  ngOnInit(): void {
    if (this.authService.isAuthenticated) {
      this.router.navigate(['/dashboard']);
    }
  }

  fillLogin(email: string): void {
    this.loginForm.patchValue({
      email: email,
      password: 'Password1!'
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) return;
    this.loading = true;
    this.errorMessage = '';

    const formData = new FormData();
    formData.append('username', this.loginForm.value.email);
    formData.append('password', this.loginForm.value.password);

    this.authService.login(formData).subscribe({
      next: () => {
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.detail || 'Erreur d’authentification';
      }
    });
  }
}

