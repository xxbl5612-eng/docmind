import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgIf } from '@angular/common';
import { MatFormField, MatLabel, MatError } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatButton } from '@angular/material/button';
import { MatCard } from '@angular/material/card';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { TranslateModule, TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NgIf,
    MatFormField,
    MatLabel,
    MatError,
    MatInput,
    MatButton,
    MatCard,
    MatProgressSpinner,
    TranslateModule,
    TranslatePipe,
  ],
  template: `
    <div class="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <mat-card class="w-full max-w-md shadow-lg">
        <div class="p-8">
          <!-- Header -->
          <div class="text-center mb-8">
            <h1 class="text-2xl font-bold text-gray-900">
              {{ 'auth.welcome_back' | translate }}
            </h1>
            <p class="text-gray-500 mt-2">
              {{ 'auth.sign_in_desc' | translate }}
            </p>
          </div>

          <!-- Error Message -->
          <div
            *ngIf="errorMessage"
            class="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
          >
            {{ errorMessage }}
          </div>

          <!-- Login Form -->
          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="flex flex-col gap-4">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'auth.email' | translate }}</mat-label>
              <input
                matInput
                type="email"
                formControlName="email"
                [placeholder]="'auth.email_placeholder' | translate"
                autocomplete="email"
              />
              <mat-error *ngIf="loginForm.get('email')?.hasError('required') && loginForm.get('email')?.touched">
                {{ 'auth.email' | translate }} is required
              </mat-error>
              <mat-error *ngIf="loginForm.get('email')?.hasError('email') && loginForm.get('email')?.touched">
                Please enter a valid email address
              </mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>{{ 'auth.password' | translate }}</mat-label>
              <input
                matInput
                [type]="hidePassword ? 'password' : 'text'"
                formControlName="password"
                [placeholder]="'auth.password_placeholder' | translate"
                autocomplete="current-password"
              />
              <mat-error *ngIf="loginForm.get('password')?.hasError('required') && loginForm.get('password')?.touched">
                {{ 'auth.password' | translate }} is required
              </mat-error>
            </mat-form-field>

            <button
              mat-flat-button
              color="primary"
              type="submit"
              class="w-full py-2 !rounded-lg !text-base"
              [disabled]="loginForm.invalid || isLoading"
            >
              <mat-spinner *ngIf="isLoading" diameter="20" class="inline-block mr-2"></mat-spinner>
              {{ 'auth.sign_in' | translate }}
            </button>
          </form>

          <!-- Register Link -->
          <p class="text-center text-sm text-gray-500 mt-6">
            {{ 'auth.no_account' | translate }}
            <a routerLink="/register" class="text-indigo-600 hover:text-indigo-700 font-medium">
              {{ 'auth.create_one' | translate }}
            </a>
          </p>
        </div>
      </mat-card>
    </div>
  `,
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  isLoading = false;
  hidePassword = true;
  errorMessage: string | null = null;

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    const { email, password } = this.loginForm.value;

    this.auth.login(email, password).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.router.navigate(['/dashboard']);
        } else {
          this.errorMessage = res.message || 'Login failed';
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage =
          err?.error?.message || err?.message || 'Login failed. Please check your credentials.';
      },
    });
  }
}
