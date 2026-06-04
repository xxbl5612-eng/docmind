import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIf } from '@angular/common';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { ApiService } from '../../core/http/api.service';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [NgIf, MatProgressSpinner],
  template: `
    <div class="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <!-- Loading State -->
      <div *ngIf="isLoading" class="text-center">
        <mat-spinner diameter="48" class="mx-auto mb-4"></mat-spinner>
        <p class="text-gray-600 text-lg">Completing sign-in...</p>
        <p class="text-gray-400 text-sm mt-2">Please wait while we authenticate your account.</p>
      </div>

      <!-- Error State -->
      <div *ngIf="!isLoading && errorMessage" class="text-center max-w-md">
        <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-gray-900 mb-2">Authentication Failed</h2>
        <p class="text-gray-500 mb-6">{{ errorMessage }}</p>
        <a
          routerLink="/login"
          class="inline-block bg-indigo-600 text-white hover:bg-indigo-700 px-6 py-3 rounded-lg font-medium transition-colors"
        >
          Back to Sign In
        </a>
      </div>
    </div>
  `,
})
export class AuthCallbackComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private auth = inject(AuthService);

  isLoading = true;
  errorMessage: string | null = null;

  ngOnInit(): void {
    const code = this.route.snapshot.queryParamMap.get('code');
    const state = this.route.snapshot.queryParamMap.get('state');

    if (!code || !state) {
      this.isLoading = false;
      this.errorMessage = 'Missing authentication parameters. Please try signing in again.';
      return;
    }

    this.api.callback(code, state).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          localStorage.setItem('access_token', res.data.access_token);
          localStorage.setItem('refresh_token', res.data.refresh_token);
          this.auth.fetchCurrentUser();
          this.router.navigate(['/dashboard'], { replaceUrl: true });
        } else {
          this.isLoading = false;
          this.errorMessage = res.message || 'Authentication failed. Please try again.';
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage =
          err?.error?.message || err?.message || 'Authentication failed. Please try again.';
      },
    });
  }
}
