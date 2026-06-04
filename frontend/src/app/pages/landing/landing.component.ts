import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIf, NgFor } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { TranslateModule, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';

interface FeatureCard {
  icon: string;
  titleKey: string;
  descKey: string;
  color: string;
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, NgIf, NgFor, MatIcon, TranslateModule, TranslatePipe],
  template: `
    <!-- ═══ Navigation Bar ═══ -->
    <nav class="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-white/80 border-b border-gray-100">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <!-- Logo -->
          <a routerLink="/" class="flex items-center gap-2.5 no-underline">
            <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
              <mat-icon class="text-white text-xl" [inline]="true">description</mat-icon>
            </div>
            <span class="text-gray-900 font-bold text-xl tracking-tight">DocMind</span>
          </a>

          <!-- Nav Actions -->
          <div class="flex items-center gap-3">
            <ng-container *ngIf="!auth.isAuthenticated">
              <a routerLink="/login" class="text-gray-600 hover:text-gray-900 text-sm font-medium px-3 py-2 rounded-lg hover:bg-gray-50 transition-all duration-200">
                {{ 'nav.signIn' | translate }}
              </a>
              <a routerLink="/register"
                 class="bg-blue-600 text-white hover:bg-blue-700 px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm hover:shadow-md transition-all duration-200">
                {{ 'nav.getStarted' | translate }}
              </a>
            </ng-container>
            <a *ngIf="auth.isAuthenticated" routerLink="/dashboard"
               class="bg-blue-600 text-white hover:bg-blue-700 px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm hover:shadow-md transition-all duration-200">
              {{ 'landing.go_dashboard' | translate }}
            </a>
          </div>
        </div>
      </div>
    </nav>

    <!-- ═══ Hero Section ═══ -->
    <section class="relative min-h-screen flex items-center justify-center gradient-hero overflow-hidden pt-16">
      <!-- Animated background elements -->
      <div class="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div class="absolute -top-40 -right-20 w-[500px] h-[500px] bg-cyan-400/20 rounded-full blur-3xl"></div>
        <div class="absolute -bottom-32 -left-20 w-[400px] h-[400px] bg-blue-400/20 rounded-full blur-3xl"></div>
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-3xl"></div>
        <!-- Grid pattern overlay -->
        <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDE4YzAtMS4xLjktMiAyLTJoMmMxLjEgMCAyIC45IDIgMnYyYzAgMS4xLS45IDItMiAyaC0yYy0xLjEgMC0yLS45LTItMnYtMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30"></div>
      </div>

      <div class="relative z-10 max-w-4xl mx-auto px-4 text-center animate-fade-in-up">
        <!-- Badge -->
        <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-white/90 text-sm mb-8">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          AI-Powered Document Intelligence
        </div>

        <h1 class="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-tight mb-6">
          {{ 'landing.hero_title' | translate }}
        </h1>
        <p class="text-xl sm:text-2xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
          {{ 'landing.hero_desc' | translate }}
        </p>

        <!-- CTA -->
        <div *ngIf="!auth.isAuthenticated" class="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a routerLink="/register"
             class="group w-full sm:w-auto inline-flex items-center gap-2 bg-white text-blue-700 hover:bg-gray-50 px-8 py-4 rounded-xl text-lg font-semibold shadow-xl hover:shadow-2xl transition-all duration-200 hover:-translate-y-0.5">
            {{ 'landing.start_free' | translate }}
            <mat-icon class="group-hover:translate-x-1 transition-transform duration-200" [inline]="true">arrow_forward</mat-icon>
          </a>
          <a routerLink="/login"
             class="w-full sm:w-auto inline-flex items-center gap-2 border-2 border-white/30 text-white hover:bg-white/10 hover:border-white/50 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-200">
            {{ 'nav.signIn' | translate }}
          </a>
        </div>
        <div *ngIf="auth.isAuthenticated" class="flex justify-center">
          <a routerLink="/dashboard"
             class="group inline-flex items-center gap-2 bg-white text-blue-700 hover:bg-gray-50 px-8 py-4 rounded-xl text-lg font-semibold shadow-xl transition-all duration-200 hover:-translate-y-0.5">
            {{ 'landing.go_dashboard' | translate }}
            <mat-icon class="group-hover:translate-x-1 transition-transform duration-200" [inline]="true">arrow_forward</mat-icon>
          </a>
        </div>

        <!-- Trust indicators -->
        <div class="mt-12 flex flex-wrap items-center justify-center gap-6 text-white/50 text-sm">
          <div class="flex items-center gap-2"><mat-icon class="text-emerald-400 text-base" [inline]="true">lock</mat-icon> 企业级安全</div>
          <div class="flex items-center gap-2"><mat-icon class="text-emerald-400 text-base" [inline]="true">speed</mat-icon> AI 极速处理</div>
          <div class="flex items-center gap-2"><mat-icon class="text-emerald-400 text-base" [inline]="true">translate</mat-icon> 中英双语支持</div>
        </div>
      </div>
    </section>

    <!-- ═══ Stats Bar ═══ -->
    <section class="relative -mt-1 bg-white border-b border-gray-100">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div *ngFor="let stat of stats" class="space-y-1">
            <p class="text-3xl font-bold text-gray-900">{{ stat.value }}</p>
            <p class="text-sm text-gray-500">{{ stat.label }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ Features Section ═══ -->
    <section class="py-24 bg-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-16">
          <span class="badge badge-primary mb-4">{{ 'landing.features_badge' | translate }}</span>
          <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            {{ 'landing.features_title' | translate }}
          </h2>
          <p class="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
            {{ 'landing.features_desc' | translate }}
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div *ngFor="let feature of features; let i = index"
               class="group surface-card p-8 hover:-translate-y-1 cursor-default"
               [style.animation-delay]="i * 80 + 'ms'"
               style="animation: fadeInUp 0.5s ease both">
            <!-- Icon -->
            <div class="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-colors duration-200"
                 [style.background-color]="feature.color + '15'"
                 [style.color]="feature.color">
              <mat-icon class="text-2xl" [inline]="true">{{ feature.icon }}</mat-icon>
            </div>
            <h3 class="text-lg font-semibold text-gray-900 mb-2">
              {{ feature.titleKey | translate }}
            </h3>
            <p class="text-gray-500 text-sm leading-relaxed">
              {{ feature.descKey | translate }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ How It Works ═══ -->
    <section class="py-24 bg-gray-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-16">
          <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">{{ 'landing.how_title' | translate }}</h2>
          <p class="text-lg text-gray-500 max-w-2xl mx-auto">{{ 'landing.how_desc' | translate }}</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div *ngFor="let step of steps; let i = index" class="text-center relative">
            <!-- Step number -->
            <div class="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-200">
              <span class="text-2xl font-bold text-white">{{ i + 1 }}</span>
            </div>
            <h3 class="text-lg font-semibold text-gray-900 mb-2">{{ step.titleKey | translate }}</h3>
            <p class="text-gray-500 text-sm">{{ step.descKey | translate }}</p>
            <!-- Connector line -->
            <div *ngIf="i < 2" class="hidden md:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-blue-200 to-transparent" aria-hidden="true"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ Bottom CTA ═══ -->
    <section class="py-24 gradient-hero">
      <div class="max-w-3xl mx-auto px-4 text-center">
        <h2 class="text-3xl sm:text-4xl font-bold text-white mb-4">
          {{ 'landing.cta_title' | translate }}
        </h2>
        <p class="text-lg text-white/70 mb-10 max-w-xl mx-auto leading-relaxed">
          {{ 'landing.cta_desc' | translate }}
        </p>
        <a *ngIf="!auth.isAuthenticated" routerLink="/register"
           class="group inline-flex items-center gap-2 bg-white text-blue-700 hover:bg-gray-50 px-10 py-4 rounded-xl text-lg font-semibold shadow-xl hover:shadow-2xl transition-all duration-200 hover:-translate-y-0.5">
          {{ 'landing.cta_button' | translate }}
          <mat-icon class="group-hover:translate-x-1 transition-transform duration-200" [inline]="true">rocket_launch</mat-icon>
        </a>
        <a *ngIf="auth.isAuthenticated" routerLink="/dashboard"
           class="group inline-flex items-center gap-2 bg-white text-blue-700 hover:bg-gray-50 px-10 py-4 rounded-xl text-lg font-semibold shadow-xl transition-all duration-200">
          {{ 'landing.go_dashboard' | translate }}
          <mat-icon class="group-hover:translate-x-1 transition-transform duration-200" [inline]="true">arrow_forward</mat-icon>
        </a>
      </div>
    </section>

    <!-- ═══ Footer ═══ -->
    <footer class="py-10 bg-gray-900">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex flex-col md:flex-row items-center justify-between gap-4">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-md bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <mat-icon class="text-white text-sm" [inline]="true">description</mat-icon>
            </div>
            <span class="text-white/70 font-semibold text-sm">DocMind</span>
          </div>
          <p class="text-gray-500 text-sm">
            {{ 'footer.copyright' | translate }}
          </p>
        </div>
      </div>
    </footer>
  `,
})
export class LandingComponent {
  auth = inject(AuthService);

  stats = [
    { value: '10+', label: '支持文件格式' },
    { value: '6', label: 'AI 处理能力' },
    { value: '4', label: '用户分级体系' },
    { value: '99.9%', label: '服务可用性' },
  ];

  features: FeatureCard[] = [
    { icon: 'psychology', titleKey: 'landing.feature_1_title', descKey: 'landing.feature_1_desc', color: '#2563EB' },
    { icon: 'description', titleKey: 'landing.feature_2_title', descKey: 'landing.feature_2_desc', color: '#0891B2' },
    { icon: 'group_work', titleKey: 'landing.feature_3_title', descKey: 'landing.feature_3_desc', color: '#7C3AED' },
    { icon: 'history', titleKey: 'landing.feature_4_title', descKey: 'landing.feature_4_desc', color: '#059669' },
    { icon: 'code', titleKey: 'landing.feature_5_title', descKey: 'landing.feature_5_desc', color: '#D97706' },
    { icon: 'cloud_done', titleKey: 'landing.feature_6_title', descKey: 'landing.feature_6_desc', color: '#DC2626' },
  ];

  steps = [
    { titleKey: 'landing.step_1_title', descKey: 'landing.step_1_desc' },
    { titleKey: 'landing.step_2_title', descKey: 'landing.step_2_desc' },
    { titleKey: 'landing.step_3_title', descKey: 'landing.step_3_desc' },
  ];
}
