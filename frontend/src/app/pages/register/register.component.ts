import { Component, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
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
  selector: 'app-register',
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
              {{ 'auth.create_account' | translate }}
            </h1>
            <p class="text-gray-500 mt-2">
              {{ 'auth.register_desc' | translate }}
            </p>
          </div>

          <!-- Error Message -->
          <div
            *ngIf="errorMessage"
            class="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
          >
            {{ errorMessage }}
          </div>

          <!-- Registration Form -->
          <form [formGroup]="registerForm" (ngSubmit)="onSubmit()" class="flex flex-col gap-4">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'auth.display_name' | translate }}</mat-label>
              <input
                matInput
                type="text"
                formControlName="display_name"
                [placeholder]="'auth.display_name_placeholder' | translate"
                autocomplete="name"
              />
              <mat-error
                *ngIf="registerForm.get('display_name')?.hasError('required') && registerForm.get('display_name')?.touched"
              >
                {{ 'auth.display_name' | translate }} is required
              </mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>{{ 'auth.email' | translate }}</mat-label>
              <input
                matInput
                type="email"
                formControlName="email"
                [placeholder]="'auth.email_placeholder' | translate"
                autocomplete="email"
              />
              <mat-error *ngIf="registerForm.get('email')?.hasError('required') && registerForm.get('email')?.touched">
                {{ 'auth.email' | translate }} is required
              </mat-error>
              <mat-error *ngIf="registerForm.get('email')?.hasError('email') && registerForm.get('email')?.touched">
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
                autocomplete="new-password"
              />
              <mat-error *ngIf="registerForm.get('password')?.hasError('required') && registerForm.get('password')?.touched">
                {{ 'auth.password' | translate }} is required
              </mat-error>
              <mat-error *ngIf="registerForm.get('password')?.hasError('minlength') && registerForm.get('password')?.touched">
                {{ 'auth.password_requirement' | translate }}
              </mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Confirm Password</mat-label>
              <input
                matInput
                [type]="hidePassword ? 'password' : 'text'"
                formControlName="confirm_password"
                placeholder="Re-enter your password"
                autocomplete="new-password"
              />
              <mat-error
                *ngIf="registerForm.get('confirm_password')?.hasError('required') && registerForm.get('confirm_password')?.touched"
              >
                Please confirm your password
              </mat-error>
              <mat-error
                *ngIf="registerForm.hasError('passwordMismatch') && registerForm.get('confirm_password')?.touched"
              >
                Passwords do not match
              </mat-error>
            </mat-form-field>

            <button
              mat-flat-button
              color="primary"
              type="submit"
              class="w-full py-2 !rounded-lg !text-base"
              [disabled]="registerForm.invalid || isLoading"
            >
              <mat-spinner *ngIf="isLoading" diameter="20" class="inline-block mr-2"></mat-spinner>
              {{ 'auth.create_button' | translate }}
            </button>
          </form>

          <!-- Login Link -->
          <p class="text-center text-sm text-gray-500 mt-6">
            {{ 'auth.have_account' | translate }}
            <a routerLink="/login" class="text-indigo-600 hover:text-indigo-700 font-medium">
              {{ 'auth.sign_in_link' | translate }}
            </a>
          </p>
        </div>
      </mat-card>
    </div>
  `,
})
export class RegisterComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  registerForm: FormGroup = this.fb.group(
    {
      display_name: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm_password: ['', [Validators.required]],
    },
    { validators: this.passwordMatchValidator }
  );

  isLoading = false;
  hidePassword = true;
  errorMessage: string | null = null;

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirm_password')?.value;
    if (password && confirmPassword && password !== confirmPassword) {
      return { passwordMismatch: true };
    }
    return null;
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    const { email, password, display_name } = this.registerForm.value;

    this.auth.register(email, password, display_name).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.router.navigate(['/dashboard']);
        } else {
          this.errorMessage = res.message || 'Registration failed';
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage =
          err?.error?.message || err?.message || 'Registration failed. Please try again.';
      },
    });
  }
}
