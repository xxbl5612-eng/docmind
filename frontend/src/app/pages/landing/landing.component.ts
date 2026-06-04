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
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, NgIf, NgFor, MatIcon, TranslateModule, TranslatePipe],
  template: `
    <!-- Navigation -->
    <nav class="absolute top-0 left-0 right-0 z-10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <span class="text-white font-bold text-xl tracking-tight">DocMind</span>
          <div class="flex items-center gap-4">
            <a
              *ngIf="!auth.isAuthenticated"
              routerLink="/login"
              class="text-white/80 hover:text-white text-sm font-medium transition-colors"
            >
              {{ 'nav.signIn' | translate }}
            </a>
            <a
              *ngIf="!auth.isAuthenticated"
              routerLink="/register"
              class="bg-white text-indigo-600 hover:bg-white/90 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              {{ 'nav.getStarted' | translate }}
            </a>
            <a
              *ngIf="auth.isAuthenticated"
              routerLink="/dashboard"
              class="bg-white text-indigo-600 hover:bg-white/90 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              {{ 'landing.go_dashboard' | translate }}
            </a>
          </div>
        </div>
      </div>
    </nav>

    <!-- Hero Section -->
    <section class="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 overflow-hidden">
      <!-- Background decorative blobs -->
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="absolute -top-40 -right-40 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
        <div class="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
      </div>

      <div class="relative z-10 max-w-4xl mx-auto px-4 text-center">
        <h1 class="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-tight mb-6">
          DocMind
        </h1>
        <p class="text-xl sm:text-2xl text-white/80 max-w-2xl mx-auto mb-10 leading-relaxed">
          {{ 'landing.hero_desc' | translate }}
        </p>

        <!-- CTA Buttons -->
        <div *ngIf="!auth.isAuthenticated" class="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            routerLink="/register"
            class="w-full sm:w-auto bg-white text-indigo-600 hover:bg-white/90 px-8 py-4 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
          >
            {{ 'landing.start_free' | translate }}
          </a>
          <a
            routerLink="/login"
            class="w-full sm:w-auto border-2 border-white/40 text-white hover:bg-white/10 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-200"
          >
            {{ 'nav.signIn' | translate }}
          </a>
        </div>
        <div *ngIf="auth.isAuthenticated" class="flex justify-center">
          <a
            routerLink="/dashboard"
            class="w-full sm:w-auto bg-white text-indigo-600 hover:bg-white/90 px-8 py-4 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
          >
            {{ 'landing.go_dashboard' | translate }}
          </a>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section class="py-24 bg-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-16">
          <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            {{ 'landing.features_title' | translate }}
          </h2>
          <p class="text-lg text-gray-500 max-w-2xl mx-auto">
            {{ 'landing.features_desc' | translate }}
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div
            *ngFor="let feature of features"
            class="group relative p-6 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-indigo-100 transition-all duration-300"
          >
            <div class="w-14 h-14 bg-indigo-50 rounded-xl flex items-center justify-center mb-5 group-hover:bg-indigo-100 transition-colors">
              <mat-icon class="text-indigo-600" [inline]="true">{{ feature.icon }}</mat-icon>
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

    <!-- CTA Section -->
    <section class="py-20 bg-gradient-to-r from-indigo-600 to-purple-600">
      <div class="max-w-4xl mx-auto px-4 text-center">
        <h2 class="text-3xl sm:text-4xl font-bold text-white mb-4">
          {{ 'landing.cta_title' | translate }}
        </h2>
        <p class="text-lg text-white/70 mb-8 max-w-2xl mx-auto">
          {{ 'landing.cta_desc' | translate }}
        </p>
        <a
          *ngIf="!auth.isAuthenticated"
          routerLink="/register"
          class="inline-block bg-white text-indigo-600 hover:bg-white/90 px-8 py-4 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
        >
          {{ 'landing.cta_button' | translate }}
        </a>
        <a
          *ngIf="auth.isAuthenticated"
          routerLink="/dashboard"
          class="inline-block bg-white text-indigo-600 hover:bg-white/90 px-8 py-4 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
        >
          {{ 'landing.go_dashboard' | translate }}
        </a>
      </div>
    </section>

    <!-- Footer -->
    <footer class="py-8 bg-gray-900">
      <div class="max-w-7xl mx-auto px-4 text-center">
        <p class="text-gray-400 text-sm">
          {{ 'footer.copyright' | translate }}
        </p>
      </div>
    </footer>
  `,
})
export class LandingComponent {
  auth = inject(AuthService);

  features: FeatureCard[] = [
    {
      icon: 'psychology',
      titleKey: 'landing.feature_1_title',
      descKey: 'landing.feature_1_desc',
    },
    {
      icon: 'description',
      titleKey: 'landing.feature_2_title',
      descKey: 'landing.feature_2_desc',
    },
    {
      icon: 'group_work',
      titleKey: 'landing.feature_3_title',
      descKey: 'landing.feature_3_desc',
    },
    {
      icon: 'history',
      titleKey: 'landing.feature_4_title',
      descKey: 'landing.feature_4_desc',
    },
  ];
}
