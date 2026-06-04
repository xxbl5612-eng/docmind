import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { ApiService } from '../http/api.service';
import type { User, TokenResponse } from '../../shared/models/types';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private loadingSubject = new BehaviorSubject<boolean>(true);
  public loading$ = this.loadingSubject.asObservable();

  constructor(private api: ApiService, private router: Router) {
    this.loadUser();
  }

  get isAuthenticated(): boolean {
    return !!localStorage.getItem('access_token');
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  private loadUser(): void {
    if (!this.isAuthenticated) {
      this.loadingSubject.next(false);
      return;
    }
    this.api.me().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.currentUserSubject.next(res.data);
        }
        this.loadingSubject.next(false);
      },
      error: () => {
        this.loadingSubject.next(false);
      },
    });
  }

  login(email: string, password: string): Observable<any> {
    return this.api.login(email, password).pipe(
      tap((res) => {
        if (res.success && res.data) {
          localStorage.setItem('access_token', res.data.access_token);
          localStorage.setItem('refresh_token', res.data.refresh_token);
          this.fetchCurrentUser();
        }
      })
    );
  }

  register(email: string, password: string, display_name: string): Observable<any> {
    return this.api.register(email, password, display_name).pipe(
      tap((res) => {
        if (res.success && res.data) {
          localStorage.setItem('access_token', res.data.access_token);
          localStorage.setItem('refresh_token', res.data.refresh_token);
          this.fetchCurrentUser();
        }
      })
    );
  }

  refreshToken(token: string): Observable<any> {
    return this.api.refresh(token);
  }

  logout(): void {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      this.api.logout(refreshToken).subscribe();
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  fetchCurrentUser(): void {
    this.api.me().subscribe((res) => {
      if (res.success && res.data) {
        this.currentUserSubject.next(res.data);
      }
    });
  }
}
