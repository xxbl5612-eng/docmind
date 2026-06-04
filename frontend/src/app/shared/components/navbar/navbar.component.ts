import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NgIf } from '@angular/common';
import { MatToolbar } from '@angular/material/toolbar';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatIcon } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../core/auth/auth.service';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    NgIf,
    MatToolbar,
    MatButton,
    MatIconButton,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatIcon,
    TranslateModule,
    LanguageSwitcherComponent,
  ],
  template: `
    <mat-toolbar
      class="!bg-white !border-b !border-gray-200 !sticky !top-0 !z-50 !h-16 !px-6 !flex !items-center !justify-between"
    >
      <!-- Logo -->
      <a
        routerLink="/"
        class="text-xl font-bold text-blue-600 no-underline hover:text-blue-700 transition-colors tracking-tight"
      >
        DocMind
      </a>

      <!-- Nav Links -->
      <nav class="hidden md:flex items-center gap-1">
        <a
          routerLink="/dashboard"
          routerLinkActive="!text-blue-600 !bg-blue-50"
          [routerLinkActiveOptions]="{ exact: false }"
          class="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 no-underline hover:text-blue-600 hover:bg-blue-50 transition-colors"
        >
          {{ 'nav.dashboard' | translate }}
        </a>
        <a
          routerLink="/github/import"
          routerLinkActive="!text-blue-600 !bg-blue-50"
          [routerLinkActiveOptions]="{ exact: false }"
          class="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 no-underline hover:text-blue-600 hover:bg-blue-50 transition-colors"
        >
          {{ 'nav.github_import' | translate }}
        </a>
      </nav>

      <!-- Right Side -->
      <div class="flex items-center gap-2">
        <app-language-switcher />

        <!-- Authenticated: User Menu -->
        <ng-container *ngIf="auth.isAuthenticated; else guestButtons">
          <button
            mat-icon-button
            [matMenuTriggerFor]="userMenu"
            class="!text-gray-600 hover:!bg-gray-100"
            aria-label="User menu"
          >
            <mat-icon>account_circle</mat-icon>
          </button>
          <mat-menu #userMenu="matMenu">
            <span class="block px-4 py-2 text-xs text-gray-400 border-b border-gray-100">
              {{ auth.currentUser?.email }}
            </span>
            <a
              mat-menu-item
              routerLink="/settings"
              class="flex items-center gap-2"
            >
              <mat-icon class="!mr-2">settings</mat-icon>
              {{ 'nav.settings' | translate }}
            </a>
            <button mat-menu-item (click)="logout()" class="flex items-center gap-2">
              <mat-icon class="!mr-2">logout</mat-icon>
              {{ 'nav.signOut' | translate }}
            </button>
          </mat-menu>
        </ng-container>

        <!-- Guest: Login / Register -->
        <ng-template #guestButtons>
          <a
            routerLink="/login"
            class="px-3 py-1.5 text-sm font-medium text-gray-600 no-underline hover:text-blue-600 transition-colors"
          >
            {{ 'nav.signIn' | translate }}
          </a>
          <a
            routerLink="/register"
            class="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg no-underline hover:bg-blue-700 transition-colors"
          >
            {{ 'nav.getStarted' | translate }}
          </a>
        </ng-template>
      </div>
    </mat-toolbar>
  `,
  styles: [``],
})
export class NavbarComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  logout(): void {
    this.auth.logout();
  }
}
