import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NgIf } from '@angular/common';
import { MatToolbar } from '@angular/material/toolbar';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatIcon } from '@angular/material/icon';
import { MatDivider } from '@angular/material/divider';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    RouterLink, RouterLinkActive, NgIf,
    MatToolbar, MatButton, MatIconButton,
    MatMenu, MatMenuItem, MatMenuTrigger, MatIcon, MatDivider,
    TranslateModule, LanguageSwitcherComponent,
  ],
  template: `
    <mat-toolbar class="!bg-white !border-b !border-gray-100 !sticky !top-0 !z-50 !h-16 !px-6 !flex !items-center !justify-between">
      <!-- Left: Logo + Nav -->
      <div class="flex items-center gap-1">
        <a routerLink="/" class="flex items-center gap-2.5 no-underline mr-4">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
            <mat-icon class="text-white text-lg" [inline]="true">description</mat-icon>
          </div>
          <span class="text-gray-900 font-bold text-lg tracking-tight hidden sm:inline">DocMind</span>
        </a>

        <nav class="hidden md:flex items-center gap-1">
          <a routerLink="/dashboard" routerLinkActive="!text-blue-600 !bg-blue-50"
             [routerLinkActiveOptions]="{ exact: false }"
             class="px-3.5 py-2 rounded-lg text-sm font-medium text-gray-600 no-underline hover:text-gray-900 hover:bg-gray-50 transition-all duration-200">
            {{ 'nav.dashboard' | translate }}
          </a>
          <a routerLink="/github/import" routerLinkActive="!text-blue-600 !bg-blue-50"
             [routerLinkActiveOptions]="{ exact: false }"
             class="px-3.5 py-2 rounded-lg text-sm font-medium text-gray-600 no-underline hover:text-gray-900 hover:bg-gray-50 transition-all duration-200">
            {{ 'nav.github_import' | translate }}
          </a>
        </nav>
      </div>

      <!-- Right: Actions -->
      <div class="flex items-center gap-1">
        <app-language-switcher />

        <!-- Authenticated -->
        <ng-container *ngIf="auth.isAuthenticated; else guestBtns">
          <button mat-icon-button [matMenuTriggerFor]="userMenu"
                  class="!text-gray-500 hover:!text-gray-700 hover:!bg-gray-100 transition-colors"
                  aria-label="用户菜单">
            <mat-icon>account_circle</mat-icon>
          </button>
          <mat-menu #userMenu="matMenu" class="!min-w-[200px]">
            <div class="px-4 py-3 border-b border-gray-100">
              <p class="text-sm font-medium text-gray-900 truncate max-w-[180px]">{{ auth.currentUser?.display_name || auth.currentUser?.email }}</p>
              <p class="text-xs text-gray-400 mt-0.5 truncate max-w-[180px]">{{ auth.currentUser?.email }}</p>
            </div>
            <a mat-menu-item routerLink="/settings">
              <mat-icon>settings</mat-icon> {{ 'nav.settings' | translate }}
            </a>
            <a *ngIf="auth.currentUser?.is_superuser" mat-menu-item routerLink="/admin">
              <mat-icon>admin_panel_settings</mat-icon> {{ 'nav.admin' | translate }}
            </a>
            <mat-divider />
            <button mat-menu-item (click)="logout()">
              <mat-icon class="!text-red-500">logout</mat-icon>
              <span class="text-red-600">{{ 'nav.signOut' | translate }}</span>
            </button>
          </mat-menu>
        </ng-container>

        <!-- Guest -->
        <ng-template #guestBtns>
          <a routerLink="/login"
             class="px-3 py-1.5 text-sm font-medium text-gray-600 no-underline hover:text-gray-900 transition-colors">
            {{ 'nav.signIn' | translate }}
          </a>
          <a routerLink="/register"
             class="ml-1 px-4 py-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg no-underline shadow-sm transition-all duration-200">
            {{ 'nav.getStarted' | translate }}
          </a>
        </ng-template>
      </div>
    </mat-toolbar>
  `,
})
export class NavbarComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  logout(): void {
    this.auth.logout();
  }
}
