import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIf, NgFor } from '@angular/common';
import { TranslateModule, TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, NgIf, NgFor, TranslateModule, TranslatePipe],
  template: `
    <!-- ═══ Hero ═══ -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32 text-center">
      <h1 class="text-4xl md:text-6xl font-bold tracking-tight text-[#0F172A]">
        {{ 'landing.hero_title' | translate }}
      </h1>
      <p class="mt-6 text-lg md:text-xl text-[#64748B] max-w-2xl mx-auto leading-relaxed">
        {{ 'landing.hero_desc' | translate }}
      </p>
      <div class="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
        <ng-container *ngIf="auth.isAuthenticated; else guestCtA">
          <a routerLink="/dashboard"
             class="inline-flex items-center justify-center h-11 px-6 rounded-lg text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors shadow-sm">
            {{ 'landing.go_dashboard' | translate }}
          </a>
        </ng-container>
        <ng-template #guestCtA>
          <a routerLink="/register"
             class="inline-flex items-center justify-center h-11 px-6 rounded-lg text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors shadow-sm">
            {{ 'landing.start_free' | translate }}
          </a>
          <a routerLink="/login"
             class="inline-flex items-center justify-center h-11 px-6 rounded-lg text-sm font-semibold text-[#475569] border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors">
            {{ 'nav.signIn' | translate }}
          </a>
        </ng-template>
      </div>
    </section>

    <!-- ═══ Features ═══ -->
    <section class="bg-white border-y border-[#E2E8F0] py-20">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="text-3xl font-bold text-center text-[#0F172A]">{{ 'landing.features_title' | translate }}</h2>
        <p class="mt-4 text-center text-[#64748B] max-w-xl mx-auto">{{ 'landing.features_desc' | translate }}</p>
        <div class="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div *ngFor="let f of features" class="text-center">
            <div class="w-12 h-12 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center mx-auto">
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" [attr.d]="f.path" />
              </svg>
            </div>
            <h3 class="mt-4 font-semibold text-[#0F172A]">{{ f.titleKey | translate }}</h3>
            <p class="mt-2 text-sm text-[#64748B] leading-relaxed">{{ f.descKey | translate }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ CTA ═══ -->
    <section class="bg-[#2563EB] py-20">
      <div class="max-w-4xl mx-auto px-4 text-center">
        <h2 class="text-3xl font-bold text-white">{{ 'landing.cta_title' | translate }}</h2>
        <p class="mt-4 text-[#BFDBFE] text-lg">{{ 'landing.cta_desc' | translate }}</p>
        <div class="mt-8">
          <a *ngIf="!auth.isAuthenticated" routerLink="/register"
             class="inline-flex items-center justify-center h-11 px-6 rounded-lg text-sm font-semibold text-[#2563EB] bg-white hover:bg-[#F8FAFC] transition-colors">
            {{ 'landing.cta_button' | translate }}
          </a>
          <a *ngIf="auth.isAuthenticated" routerLink="/dashboard"
             class="inline-flex items-center justify-center h-11 px-6 rounded-lg text-sm font-semibold text-[#2563EB] bg-white hover:bg-[#F8FAFC] transition-colors">
            {{ 'landing.go_dashboard' | translate }}
          </a>
        </div>
      </div>
    </section>
  `,
})
export class LandingComponent {
  auth = inject(AuthService);

  features = [
    { path: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z', titleKey: 'landing.feature_1_title', descKey: 'landing.feature_1_desc' },
    { path: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z', titleKey: 'landing.feature_2_title', descKey: 'landing.feature_2_desc' },
    { path: 'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z', titleKey: 'landing.feature_3_title', descKey: 'landing.feature_3_desc' },
    { path: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z', titleKey: 'landing.feature_4_title', descKey: 'landing.feature_4_desc' },
  ];
}
