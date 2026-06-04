import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgIf } from '@angular/common';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { TranslateModule, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, NgIf, MatProgressSpinner, TranslateModule, TranslatePipe],
  template: `
    <div class="min-h-[80vh] flex items-center justify-center px-4">
      <div class="w-full max-w-md">
        <div class="text-center mb-8">
          <h1 class="text-2xl font-bold text-[#0F172A]">{{ 'auth.welcome_back' | translate }}</h1>
          <p class="mt-2 text-[#64748B]">{{ 'auth.sign_in_desc' | translate }}</p>
        </div>

        <div class="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="space-y-4" novalidate>
            <!-- Email -->
            <div>
              <label for="email" class="block text-[13px] font-semibold text-[#334155] mb-1.5">
                {{ 'auth.email' | translate }}
              </label>
              <input id="email" type="email" formControlName="email"
                     autocomplete="email"
                     class="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10 transition-shadow" />
            </div>

            <!-- Password -->
            <div>
              <label for="password" class="block text-[13px] font-semibold text-[#334155] mb-1.5">
                {{ 'auth.password' | translate }}
              </label>
              <div class="relative">
                <input id="password" [type]="hidePassword ? 'password' : 'text'"
                       formControlName="password"
                       autocomplete="current-password"
                       class="w-full h-10 px-3 pr-10 rounded-lg border border-[#E2E8F0] text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10 transition-shadow" />
                <button type="button" (click)="hidePassword = !hidePassword"
                        class="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] rounded"
                        [attr.aria-label]="hidePassword ? 'Show' : 'Hide'">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path *ngIf="hidePassword" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path *ngIf="hidePassword" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path *ngIf="!hidePassword" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                </button>
              </div>
            </div>

            <button type="submit"
                    class="w-full h-11 rounded-lg text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    [disabled]="loginForm.invalid || isLoading">
              <mat-spinner *ngIf="isLoading" diameter="18"></mat-spinner>
              {{ isLoading ? '' : ('auth.sign_in' | translate) }}
            </button>
          </form>

          <div class="relative my-5">
            <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-[#E2E8F0]"></div></div>
            <div class="relative flex justify-center text-xs"><span class="bg-white px-2 text-[#94A3B8]">{{ 'auth.or_continue_with' | translate }}</span></div>
          </div>

          <button type="button" (click)="loginWithGitHub()"
                  class="w-full h-11 rounded-lg text-sm font-medium text-[#475569] border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors flex items-center justify-center gap-2">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            {{ 'auth.sign_in_with_github' | translate }}
          </button>
        </div>

        <p class="mt-4 text-center text-sm text-[#64748B]">
          {{ 'auth.no_account' | translate }}
          <a routerLink="/register" class="text-[#2563EB] hover:text-[#1D4ED8] font-medium ml-1">{{ 'auth.create_one' | translate }}</a>
        </p>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  isLoading = false;
  hidePassword = true;

  onSubmit(): void {
    if (this.loginForm.invalid) { this.loginForm.markAllAsTouched(); return; }
    this.isLoading = true;
    const { email, password } = this.loginForm.value;
    this.auth.login(email!, password!).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) this.router.navigate(['/dashboard']);
      },
      error: () => { this.isLoading = false; },
    });
  }

  loginWithGitHub(): void {
    this.auth.login('', ''); // placeholder — OAuth flow redirects to GitHub
  }
}
