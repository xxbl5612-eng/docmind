import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIf } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, NgIf, TranslateModule, LanguageSwitcherComponent],
  template: `
    <nav class="sticky top-0 z-40 border-b border-[#E2E8F0] bg-white/80 backdrop-blur-md">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">

          <!-- Logo -->
          <a routerLink="/" class="flex items-center gap-2 font-bold text-xl text-[#2563EB] no-underline">
            <svg class="w-8 h-8" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="currentColor" />
              <path d="M8 10h16M8 16h12M8 22h14" stroke="white" stroke-width="2.5" stroke-linecap="round" />
            </svg>
            DocMind
          </a>

          <!-- Desktop Nav -->
          <div class="hidden md:flex items-center gap-4">
            <app-language-switcher />

            <ng-container *ngIf="auth.isAuthenticated; else guestNav">
              <a routerLink="/dashboard" class="text-sm text-[#475569] hover:text-[#0F172A] transition-colors no-underline">
                {{ 'nav.dashboard' | translate }}
              </a>
              <a routerLink="/github/import" class="text-sm text-[#475569] hover:text-[#0F172A] transition-colors no-underline">
                {{ 'nav.github_import' | translate }}
              </a>
              <a *ngIf="auth.currentUser?.is_superuser" routerLink="/admin" class="text-sm text-[#475569] hover:text-[#0F172A] transition-colors no-underline">
                {{ 'nav.admin' | translate }}
              </a>

              <!-- User Menu -->
              <div class="relative" (clickOutside)="menuOpen = false">
                <button (click)="menuOpen = !menuOpen"
                        class="flex items-center gap-2 text-sm text-[#334155] hover:text-[#0F172A] cursor-pointer bg-transparent border-0">
                  <div class="w-8 h-8 rounded-full bg-[#DBEAFE] text-[#2563EB] flex items-center justify-center text-sm font-medium">
                    {{ (auth.currentUser?.display_name || 'U')[0].toUpperCase() }}
                  </div>
                  <span class="hidden lg:inline">{{ auth.currentUser?.display_name }}</span>
                </button>

                <div *ngIf="menuOpen" class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-[#E2E8F0] py-1 z-50">
                  <a routerLink="/settings" (click)="menuOpen = false"
                     class="block px-4 py-2 text-sm text-[#334155] hover:bg-[#F8FAFC] no-underline">{{ 'nav.settings' | translate }}</a>
                  <hr class="border-[#F1F5F9]" />
                  <button (click)="logout(); menuOpen = false"
                          class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-[#F8FAFC] cursor-pointer bg-transparent border-0">
                    {{ 'nav.signOut' | translate }}
                  </button>
                </div>
                <div *ngIf="menuOpen" class="fixed inset-0 z-[-1]" (click)="menuOpen = false"></div>
              </div>
            </ng-container>

            <ng-template #guestNav>
              <a routerLink="/login"
                 class="text-sm text-[#475569] hover:text-[#0F172A] transition-colors no-underline">{{ 'nav.signIn' | translate }}</a>
              <a routerLink="/register"
                 class="inline-flex items-center h-9 px-4 rounded-lg text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors no-underline shadow-sm">
                {{ 'nav.getStarted' | translate }}
              </a>
            </ng-template>
          </div>

          <!-- Mobile Hamburger -->
          <button class="md:hidden text-[#475569] cursor-pointer bg-transparent border-0 p-1" (click)="menuOpen = !menuOpen" aria-label="Toggle menu">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path *ngIf="!menuOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              <path *ngIf="menuOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Mobile Menu -->
        <div *ngIf="menuOpen" class="md:hidden border-t border-[#E2E8F0] py-4 space-y-2">
          <div class="px-3 py-2"><app-language-switcher /></div>
          <ng-container *ngIf="auth.isAuthenticated; else guestMobile">
            <a routerLink="/dashboard" (click)="menuOpen = false" class="block px-3 py-2 text-sm rounded-lg hover:bg-[#F8FAFC] no-underline text-[#334155]">{{ 'nav.dashboard' | translate }}</a>
            <a routerLink="/github/import" (click)="menuOpen = false" class="block px-3 py-2 text-sm rounded-lg hover:bg-[#F8FAFC] no-underline text-[#334155]">{{ 'nav.github_import' | translate }}</a>
            <a *ngIf="auth.currentUser?.is_superuser" routerLink="/admin" (click)="menuOpen = false" class="block px-3 py-2 text-sm rounded-lg hover:bg-[#F8FAFC] no-underline text-[#334155]">{{ 'nav.admin' | translate }}</a>
            <a routerLink="/settings" (click)="menuOpen = false" class="block px-3 py-2 text-sm rounded-lg hover:bg-[#F8FAFC] no-underline text-[#334155]">{{ 'nav.settings' | translate }}</a>
            <button (click)="logout(); menuOpen = false" class="w-full text-left px-3 py-2 text-sm text-red-600 rounded-lg hover:bg-[#F8FAFC] cursor-pointer bg-transparent border-0">{{ 'nav.signOut' | translate }}</button>
          </ng-container>
          <ng-template #guestMobile>
            <a routerLink="/login" (click)="menuOpen = false" class="block px-3 py-2 text-sm rounded-lg hover:bg-[#F8FAFC] no-underline text-[#334155]">{{ 'nav.signIn' | translate }}</a>
            <a routerLink="/register" (click)="menuOpen = false" class="block px-3 py-2 text-sm rounded-lg hover:bg-[#F8FAFC] no-underline text-[#334155]">{{ 'nav.getStarted' | translate }}</a>
          </ng-template>
        </div>
      </div>
    </nav>
  `,
})
export class NavbarComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  menuOpen = false;

  logout(): void { this.auth.logout(); }
}
