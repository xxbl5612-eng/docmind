import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgIf } from '@angular/common';
import { MatFormField, MatLabel, MatError, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatIcon } from '@angular/material/icon';
import { TranslateModule, TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink, NgIf,
    MatFormField, MatLabel, MatError, MatSuffix,
    MatInput, MatButton, MatIconButton, MatProgressSpinner, MatIcon,
    TranslateModule, TranslatePipe,
  ],
  template: `
    <div class="min-h-screen flex">
      <!-- Left: Brand Panel -->
      <div class="hidden lg:flex lg:w-1/2 gradient-hero items-center justify-center p-16 relative overflow-hidden">
        <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDE4YzAtMS4xLjktMiAyLTJoMmMxLjEgMCAyIC45IDIgMnYyYzAgMS4xLS45IDItMiAyaC0yYy0xLjEgMC0yLS45LTItMnYtMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" aria-hidden="true"></div>
        <div class="relative z-10 text-white max-w-md">
          <div class="flex items-center gap-3 mb-8">
            <div class="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <mat-icon class="text-white text-2xl" [inline]="true">description</mat-icon>
            </div>
            <span class="text-2xl font-bold tracking-tight">DocMind</span>
          </div>
          <h2 class="text-3xl font-bold mb-4 leading-tight">智能文档处理，从此开始。</h2>
          <p class="text-lg text-white/70 leading-relaxed">
            登录您的账户，体验 AI 驱动的文档校对、重写、摘要、提取和格式转换。
          </p>
        </div>
      </div>

      <!-- Right: Login Form -->
      <div class="w-full lg:w-1/2 flex items-center justify-center px-4 py-12 bg-white">
        <div class="w-full max-w-md">
          <!-- Mobile Logo -->
          <div class="lg:hidden flex items-center gap-2.5 mb-10 justify-center">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
              <mat-icon class="text-white" [inline]="true">description</mat-icon>
            </div>
            <span class="text-xl font-bold text-gray-900 tracking-tight">DocMind</span>
          </div>

          <h1 class="text-2xl font-bold text-gray-900 mb-1">{{ 'auth.welcome_back' | translate }}</h1>
          <p class="text-gray-500 mb-8">{{ 'auth.sign_in_desc' | translate }}</p>

          <!-- Error -->
          <div *ngIf="errorMessage"
               class="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-3"
               role="alert">
            <mat-icon class="text-red-400 text-xl flex-shrink-0" [inline]="true">error_outline</mat-icon>
            <span>{{ errorMessage }}</span>
          </div>

          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="space-y-5" novalidate>
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>{{ 'auth.email' | translate }}</mat-label>
              <input matInput type="email" formControlName="email"
                     [placeholder]="'auth.email_placeholder' | translate"
                     autocomplete="email" />
              <mat-icon matSuffix class="text-gray-400">mail</mat-icon>
              <mat-error *ngIf="loginForm.get('email')?.touched && loginForm.get('email')?.hasError('required')">
                请输入邮箱地址
              </mat-error>
              <mat-error *ngIf="loginForm.get('email')?.touched && loginForm.get('email')?.hasError('email')">
                请输入有效的邮箱地址
              </mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full">
              <mat-label>{{ 'auth.password' | translate }}</mat-label>
              <input matInput [type]="hidePassword ? 'password' : 'text'"
                     formControlName="password"
                     [placeholder]="'auth.password_placeholder' | translate"
                     autocomplete="current-password" />
              <button mat-icon-button matSuffix type="button"
                      (click)="hidePassword = !hidePassword"
                      [attr.aria-label]="hidePassword ? '显示密码' : '隐藏密码'"
                      class="!text-gray-400">
                <mat-icon>{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              <mat-error *ngIf="loginForm.get('password')?.touched && loginForm.get('password')?.hasError('required')">
                请输入密码
              </mat-error>
            </mat-form-field>

            <button mat-flat-button color="primary" type="submit"
                    class="w-full !py-2.5 !rounded-xl !text-base !font-semibold !h-12"
                    [disabled]="loginForm.invalid || isLoading">
              <mat-spinner *ngIf="isLoading" diameter="20" class="mr-2 inline-block"></mat-spinner>
              {{ isLoading ? '' : ('auth.sign_in' | translate) }}
            </button>
          </form>

          <p class="text-center text-sm text-gray-500 mt-8">
            {{ 'auth.no_account' | translate }}
            <a routerLink="/register" class="text-blue-600 hover:text-blue-700 font-semibold ml-1">
              {{ 'auth.create_one' | translate }}
            </a>
          </p>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  isLoading = false;
  hidePassword = true;
  errorMessage: string | null = null;

  onSubmit(): void {
    if (this.loginForm.invalid) { this.loginForm.markAllAsTouched(); return; }
    this.isLoading = true;
    this.errorMessage = null;
    const { email, password } = this.loginForm.value;
    this.auth.login(email!, password!).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) this.router.navigate(['/dashboard']);
        else this.errorMessage = res.message || '登录失败';
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.message || '登录失败，请检查您的凭据。';
      },
    });
  }
}
