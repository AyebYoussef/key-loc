import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Utilisateur } from '../models/models';

export interface TokenResponse {
  access_token: string;
  token_type: string;
  utilisateur: Utilisateur;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private get apiUrl(): string {
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname || 'localhost';
      return `http://${hostname}:8000/api/auth`;
    }
    return 'http://localhost:8000/api/auth';
  }
  private currentUserSubject = new BehaviorSubject<Utilisateur | null>(this.getStoredUser());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  public get currentUserValue(): Utilisateur | null {
    return this.currentUserSubject.value;
  }

  public get token(): string | null {
    return localStorage.getItem('token');
  }

  public get isAuthenticated(): boolean {
    return !!this.token && !!this.currentUserValue;
  }

  public get isGerant(): boolean {
    return this.currentUserValue?.role?.nom === 'gerant';
  }

  login(credentials: FormData): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap(res => {
        localStorage.setItem('token', res.access_token);
        localStorage.setItem('user', JSON.stringify(res.utilisateur));
        this.currentUserSubject.next(res.utilisateur);
      })
    );
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  private getStoredUser(): Utilisateur | null {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (!token || !userStr) {
      return null;
    }
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }
}
