import { Component, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgIf } from '@angular/common';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatIcon } from '@angular/material/icon';
import { TranslateModule, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';

function passwordMatchValidator(g: AbstractControl): ValidationErrors | null {
  return g.get('password')?.value === g.get('confirm_password')?.value ? null : { mismatch: true };
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, NgIf, MatProgressSpinner, MatIcon, TranslateModule, TranslatePipe],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-[#F1F5F9] px-4 py-12">
      <!-- Card -->
      <div class="w-full max-w-[420px] bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,.06),0_1px_4px_rgba(0,0,0,.04)] p-10">
        <!-- Logo -->
        <a routerLink="/" class="flex items-center gap-2.5 no-underline mb-10">
          <div class="w-9 h-9 rounded-lg bg-[#1E3A5F] flex items-center justify-center">
            <mat-icon class="text-white text-lg" [inline]="true">description</mat-icon>
          </div>
          <span class="text-gray-900 font-bold text-lg tracking-tight">DocMind</span>
        </a>

        <!-- Header -->
        <h1 class="text-[22px] font-bold text-gray-900 mb-1.5 tracking-tight">{{ 'auth.create_account' | translate }}</h1>
        <p class="text-[15px] text-gray-400 mb-8">{{ 'auth.register_desc' | translate }}</p>

        <!-- Error -->
        <div *ngIf="errorMessage" class="mb-6 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-600 flex items-start gap-2.5" role="alert">
          <mat-icon class="text-red-400 text-lg flex-shrink-0 mt-px" [inline]="true">error_outline</mat-icon>
          <span>{{ errorMessage }}</span>
        </div>

        <!-- Form -->
        <form [formGroup]="registerForm" (ngSubmit)="onSubmit()" class="space-y-5" novalidate>
          <!-- Name -->
          <div>
            <label class="block text-[13px] font-semibold text-gray-700 mb-1.5">
              {{ 'auth.display_name' | translate }}
            </label>
            <input type="text" formControlName="display_name"
                   autocomplete="name"
                   class="w-full h-11 px-3.5 rounded-lg border text-[15px] text-gray-900 outline-none transition-shadow duration-150
                          [border-color:#E2E8F0] focus:[border-color:#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10
                          placeholder-shown:border-[#E2E8F0]"
                   [class.!border-red-300]="registerForm.get('display_name')?.touched && registerForm.get('display_name')?.invalid" />
            <p *ngIf="registerForm.get('display_name')?.touched && registerForm.get('display_name')?.hasError('required')"
               class="mt-1.5 text-[12px] text-red-500">{{ 'auth.name_required' | translate }}</p>
          </div>

          <!-- Email -->
          <div>
            <label class="block text-[13px] font-semibold text-gray-700 mb-1.5">
              {{ 'auth.email' | translate }}
            </label>
            <input type="email" formControlName="email"
                   autocomplete="email"
                   class="w-full h-11 px-3.5 rounded-lg border text-[15px] text-gray-900 outline-none transition-shadow duration-150
                          [border-color:#E2E8F0] focus:[border-color:#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10"
                   [class.!border-red-300]="registerForm.get('email')?.touched && registerForm.get('email')?.invalid" />
            <p *ngIf="registerForm.get('email')?.touched && registerForm.get('email')?.hasError('required')"
               class="mt-1.5 text-[12px] text-red-500">{{ 'auth.email_required' | translate }}</p>
            <p *ngIf="registerForm.get('email')?.touched && registerForm.get('email')?.hasError('email')"
               class="mt-1.5 text-[12px] text-red-500">{{ 'auth.email_invalid' | translate }}</p>
          </div>

          <!-- Password -->
          <div>
            <label class="block text-[13px] font-semibold text-gray-700 mb-1.5">
              {{ 'auth.password' | translate }}
            </label>
            <div class="relative">
              <input [type]="hidePassword ? 'password' : 'text'"
                     formControlName="password"
                     autocomplete="new-password"
                     class="w-full h-11 px-3.5 pr-10 rounded-lg border text-[15px] text-gray-900 outline-none transition-shadow duration-150
                            [border-color:#E2E8F0] focus:[border-color:#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10"
                     [class.!border-red-300]="registerForm.get('password')?.touched && registerForm.get('password')?.invalid" />
              <button type="button" (click)="hidePassword = !hidePassword"
                      class="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-md transition-colors"
                      [attr.aria-label]="hidePassword ? ('auth.show_password' | translate) : ('auth.hide_password' | translate)">
                <mat-icon class="text-xl">{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
            </div>
            <p *ngIf="registerForm.get('password')?.touched && registerForm.get('password')?.hasError('required')"
               class="mt-1.5 text-[12px] text-red-500">{{ 'auth.password_required' | translate }}</p>
            <p *ngIf="registerForm.get('password')?.touched && registerForm.get('password')?.hasError('minlength')"
               class="mt-1.5 text-[12px] text-red-500">{{ 'auth.password_requirement' | translate }}</p>
          </div>

          <!-- Confirm Password -->
          <div>
            <label class="block text-[13px] font-semibold text-gray-700 mb-1.5">
              {{ 'auth.confirm_password' | translate }}
            </label>
            <input type="password" formControlName="confirm_password"
                   autocomplete="new-password"
                   class="w-full h-11 px-3.5 rounded-lg border text-[15px] text-gray-900 outline-none transition-shadow duration-150
                          [border-color:#E2E8F0] focus:[border-color:#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/10"
                   [class.!border-red-300]="registerForm.get('confirm_password')?.touched && registerForm.get('confirm_password')?.invalid" />
            <p *ngIf="registerForm.get('confirm_password')?.touched && registerForm.get('confirm_password')?.hasError('required')"
               class="mt-1.5 text-[12px] text-red-500">{{ 'auth.confirm_password_required' | translate }}</p>
            <p *ngIf="registerForm.get('confirm_password')?.touched && registerForm.hasError('mismatch')"
               class="mt-1.5 text-[12px] text-red-500">{{ 'auth.password_mismatch' | translate }}</p>
          </div>

          <!-- Submit -->
          <button type="submit"
                  class="w-full h-12 rounded-xl text-[15px] font-semibold text-white transition-all duration-200
                         bg-[#1E3A5F] hover:bg-[#162D4A] active:scale-[0.98]
                         disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
                         flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(30,58,95,.25)]"
                  [disabled]="registerForm.invalid || isLoading">
            <mat-spinner *ngIf="isLoading" diameter="18" class="inline-block"></mat-spinner>
            {{ isLoading ? '' : ('auth.create_button' | translate) }}
          </button>
        </form>

        <!-- Footer -->
        <p class="text-center text-[14px] text-gray-400 mt-8">
          {{ 'auth.have_account' | translate }}
          <a routerLink="/login" class="text-[#1E3A5F] hover:text-[#162D4A] font-semibold ml-1 transition-colors">
            {{ 'auth.sign_in_link' | translate }}
          </a>
        </p>
      </div>
    </div>
  `,
})
export class RegisterComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private translateSvc = inject(TranslateService);

  registerForm = this.fb.group({
    display_name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm_password: ['', [Validators.required]],
  }, { validators: passwordMatchValidator });

  isLoading = false;
  hidePassword = true;
  errorMessage: string | null = null;

  onSubmit(): void {
    if (this.registerForm.invalid) { this.registerForm.markAllAsTouched(); return; }
    this.isLoading = true;
    this.errorMessage = null;
    const { email, password, display_name } = this.registerForm.value;
    this.auth.register(email!, password!, display_name!).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) this.router.navigate(['/dashboard']);
        else this.errorMessage = res.message || '注册失败';
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.message || this.translateSvc.instant('auth.register_error_default');
      },
    });
  }
}
