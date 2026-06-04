import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil, finalize } from 'rxjs';
import { ApiService } from '../../core/http/api.service';
import { AuthService } from '../../core/auth/auth.service';
import type { UsageData, OAuthAccount } from '../../shared/models/types';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    NgIf, NgFor,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatTabsModule,
    MatSnackBarModule,
    TranslateModule,
  ],
  template: `
    <div class="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <h1 class="text-2xl font-bold text-gray-900">{{ 'settings.title' | translate }}</h1>

      <!-- Loading -->
      <div *ngIf="loading" class="flex items-center justify-center py-20">
        <div class="text-center space-y-3">
          <div class="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p class="text-gray-500 text-sm">{{ 'common.loading' | translate }}</p>
        </div>
      </div>

      <!-- Tabs -->
      <mat-tab-group *ngIf="!loading" class="settings-tabs">
        <!-- ==================== Profile Tab ==================== -->
        <mat-tab [label]="'settings.profile' | translate">
          <div class="py-6 space-y-6">
            <form [formGroup]="profileForm" (ngSubmit)="saveProfile()" class="space-y-6">
              <!-- Display Name -->
              <mat-form-field appearance="outline" class="w-full">
                <mat-label>{{ 'auth.display_name' | translate }}</mat-label>
                <input matInput formControlName="display_name"
                  [placeholder]="'auth.display_name_placeholder' | translate" />
              </mat-form-field>

              <!-- Email (read-only) -->
              <mat-form-field appearance="outline" class="w-full">
                <mat-label>{{ 'auth.email' | translate }}</mat-label>
                <input matInput [value]="userEmail" readonly class="text-gray-500" />
              </mat-form-field>

              <!-- Avatar URL -->
              <mat-form-field appearance="outline" class="w-full">
                <mat-label>Avatar URL</mat-label>
                <input matInput formControlName="avatar_url" placeholder="https://example.com/avatar.jpg" />
              </mat-form-field>

              <!-- Save Button -->
              <div class="flex items-center gap-3">
                <button mat-raised-button color="primary" type="submit"
                  [disabled]="profileForm.pristine || profileSaving">
                  <mat-icon *ngIf="!profileSaving">save</mat-icon>
                  <div *ngIf="profileSaving"
                    class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                  {{ 'settings.save_changes' | translate }}
                </button>
                <span *ngIf="profileUpdated" class="text-sm text-green-600">{{ 'settings.updated' | translate }}</span>
                <span *ngIf="profileError" class="text-sm text-red-600">{{ profileError }}</span>
              </div>
            </form>
          </div>
        </mat-tab>

        <!-- ==================== Tier Tab ==================== -->
        <mat-tab [label]="'settings.plan' | translate">
          <div class="py-6 space-y-6">
            <!-- Current Tier Card -->
            <mat-card class="!bg-white !border !border-gray-200 !shadow-sm">
              <mat-card-header>
                <mat-card-title class="text-lg font-semibold">
                  {{ 'settings.current_plan' | translate }}: {{ currentTier | translate }}
                </mat-card-title>
              </mat-card-header>
              <mat-card-content class="!pt-4">
                <div *ngIf="usageData; else usageSkeleton" class="space-y-4">
                  <!-- Documents -->
                  <div>
                    <div class="flex justify-between text-sm mb-1">
                      <span class="text-gray-600">{{ 'dashboard.quota_documents' | translate }}</span>
                      <span class="text-gray-800 font-medium">
                        {{ usageData.quota_used_docs }} / {{ getLimit(usageData.tier_limits, 'max_documents') }}
                      </span>
                    </div>
                    <div class="w-full bg-gray-100 rounded-full h-2">
                      <div class="h-2 rounded-full bg-blue-500"
                        [style.width.%]="getPercentage(usageData.quota_used_docs, usageData.tier_limits['max_documents'])">
                      </div>
                    </div>
                  </div>
                  <!-- AI Calls -->
                  <div>
                    <div class="flex justify-between text-sm mb-1">
                      <span class="text-gray-600">{{ 'dashboard.quota_ai' | translate }}</span>
                      <span class="text-gray-800 font-medium">
                        {{ usageData.quota_used_ai_calls }} / {{ getLimit(usageData.tier_limits, 'max_ai_calls') }}
                      </span>
                    </div>
                    <div class="w-full bg-gray-100 rounded-full h-2">
                      <div class="h-2 rounded-full bg-purple-500"
                        [style.width.%]="getPercentage(usageData.quota_used_ai_calls, usageData.tier_limits['max_ai_calls'])">
                      </div>
                    </div>
                  </div>
                  <!-- Storage -->
                  <div>
                    <div class="flex justify-between text-sm mb-1">
                      <span class="text-gray-600">{{ 'dashboard.quota_storage' | translate }}</span>
                      <span class="text-gray-800 font-medium">
                        {{ formatSize(usageData.quota_used_storage_bytes) }} / {{ formatLimitSize(usageData.tier_limits, 'max_storage_bytes') }}
                      </span>
                    </div>
                    <div class="w-full bg-gray-100 rounded-full h-2">
                      <div class="h-2 rounded-full bg-green-500"
                        [style.width.%]="getPercentage(usageData.quota_used_storage_bytes, usageData.tier_limits['max_storage_bytes'])">
                      </div>
                    </div>
                  </div>
                </div>
                <ng-template #usageSkeleton>
                  <div class="animate-pulse space-y-3">
                    <div *ngFor="let _ of [1,2,3]" class="h-4 bg-gray-200 rounded"></div>
                  </div>
                </ng-template>
              </mat-card-content>
            </mat-card>

            <!-- Upgrade -->
            <mat-card class="!bg-white !border !border-gray-200 !shadow-sm">
              <mat-card-header>
                <mat-card-title class="text-lg font-semibold">Upgrade Tier</mat-card-title>
              </mat-card-header>
              <mat-card-content class="!pt-4 space-y-4">
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button *ngFor="let tier of availableTiers"
                    mat-stroked-button
                    [color]="currentTier === tier.value ? 'primary' : undefined"
                    [disabled]="currentTier === tier.value || upgradeLoading"
                    (click)="upgradeTier(tier.value)"
                    class="py-6 !flex !flex-col !items-center !gap-1 h-auto">
                    <mat-icon>{{ tier.icon }}</mat-icon>
                    <span class="text-sm font-medium">{{ tier.label }}</span>
                  </button>
                </div>
                <div *ngIf="upgradeError" class="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{{ upgradeError }}</div>
                <div *ngIf="upgradeSuccess" class="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">
                  {{ 'settings.upgraded' | translate }} {{ upgradeSuccess }}
                </div>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>

        <!-- ==================== GitHub Tab ==================== -->
        <mat-tab [label]="'settings.connected_accounts' | translate">
          <div class="py-6 space-y-6">
            <mat-card class="!bg-white !border !border-gray-200 !shadow-sm">
              <mat-card-header>
                <mat-card-title class="text-lg font-semibold">GitHub</mat-card-title>
              </mat-card-header>
              <mat-card-content class="!pt-4">
                <div *ngIf="accountsLoading" class="flex justify-center py-8">
                  <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>

                <div *ngIf="!accountsLoading && oauthAccounts.length === 0" class="text-center py-8">
                  <mat-icon class="text-4xl text-gray-300 mb-2">link_off</mat-icon>
                  <p class="text-gray-500">{{ 'settings.no_connected_accounts' | translate }}</p>
                </div>

                <div *ngIf="!accountsLoading && oauthAccounts.length > 0" class="space-y-3">
                  <div *ngFor="let account of oauthAccounts"
                    class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg border border-gray-200">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
                        <mat-icon class="text-white text-xl">code</mat-icon>
                      </div>
                      <div>
                        <p class="text-sm font-medium text-gray-800">{{ account.provider_login || account.provider_email || account.provider }}</p>
                        <p class="text-xs text-gray-400">
                          {{ 'settings.linked_since' | translate }} {{ formatDate(account.linked_at) }}
                        </p>
                      </div>
                    </div>
                    <button mat-stroked-button color="warn" (click)="unlinkAccount()" [disabled]="unlinkLoading">
                      {{ unlinkLoading ? ('common.loading' | translate) : ('auth.unlink_github' | translate) }}
                    </button>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>

            <div class="flex items-center gap-3">
              <button mat-raised-button color="primary" (click)="linkGitHub()" [disabled]="linkLoading">
                <mat-icon>link</mat-icon>
                {{ linkLoading ? ('common.loading' | translate) : ('auth.link_github' | translate) }}
              </button>
              <span *ngIf="accountError" class="text-sm text-red-600">{{ accountError }}</span>
            </div>
          </div>
        </mat-tab>

        <!-- ==================== Language Tab ==================== -->
        <mat-tab [label]="'nav.language' | translate">
          <div class="py-6">
            <mat-card class="!bg-white !border !border-gray-200 !shadow-sm">
              <mat-card-header>
                <mat-card-title class="text-lg font-semibold">{{ 'nav.language' | translate }}</mat-card-title>
              </mat-card-header>
              <mat-card-content class="!pt-4 space-y-3">
                <p class="text-sm text-gray-500">Choose your preferred language for the application interface.</p>
                <div class="flex flex-wrap items-center gap-3">
                  <button mat-stroked-button
                    [color]="currentLang === 'en' ? 'primary' : undefined"
                    (click)="switchLanguage('en')">
                    English
                  </button>
                  <button mat-stroked-button
                    [color]="currentLang === 'zh' ? 'primary' : undefined"
                    (click)="switchLanguage('zh')">
                    中文
                  </button>
                </div>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>
      </mat-tab-group>

      <!-- Danger Zone -->
      <section *ngIf="!loading" class="rounded-xl border border-red-200 bg-red-50 p-6 space-y-3">
        <h3 class="text-lg font-semibold text-red-800">{{ 'settings.danger_zone' | translate }}</h3>
        <p class="text-sm text-red-600">{{ 'settings.sign_out_desc' | translate }}</p>
        <button mat-stroked-button color="warn" (click)="signOut()">
          <mat-icon>logout</mat-icon>
          {{ 'settings.sign_out' | translate }}
        </button>
      </section>
    </div>
  `,
  styles: [`
    :host ::ng-deep .settings-tabs .mat-mdc-tab-body-wrapper {
      min-height: 300px;
    }
  `],
})
export class SettingsComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private destroy$ = new Subject<void>();

  // General
  loading = true;

  // Profile
  profileForm = new FormGroup({
    display_name: new FormControl('', [Validators.required]),
    avatar_url: new FormControl(''),
  });
  profileSaving = false;
  profileUpdated = false;
  profileError: string | null = null;

  // Tier & Usage
  currentTier = '';
  usageData: UsageData | null = null;
  upgradeLoading = false;
  upgradeError: string | null = null;
  upgradeSuccess: string | null = null;

  availableTiers = [
    { value: 'novice', label: 'Novice', icon: 'star_outline' },
    { value: 'white_collar', label: 'White-Collar', icon: 'star_half' },
    { value: 'professional', label: 'Professional', icon: 'star' },
    { value: 'enterprise', label: 'Enterprise', icon: 'diamond' },
  ];

  // GitHub / OAuth
  oauthAccounts: OAuthAccount[] = [];
  accountsLoading = false;
  linkLoading = false;
  unlinkLoading = false;
  accountError: string | null = null;

  // Language
  currentLang: string;

  get userEmail(): string {
    return this.auth.currentUser?.email || '';
  }

  constructor() {
    this.currentLang = inject(TranslateService).currentLang || 'zh';
  }

  ngOnInit(): void {
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadInitialData(): void {
    const user = this.auth.currentUser;
    if (user) {
      this.currentTier = user.tier || 'novice';
      this.profileForm.patchValue({
        display_name: user.display_name || '',
        avatar_url: user.avatar_url || '',
      }, { emitEvent: false });
    }

    this.loadUsage();
    this.loadOAuthAccounts();
    this.loading = false;
  }

  // ---------- Profile ----------
  saveProfile(): void {
    if (this.profileForm.invalid || this.profileSaving) return;
    this.profileSaving = true;
    this.profileUpdated = false;
    this.profileError = null;

    const { display_name, avatar_url } = this.profileForm.value;
    this.api.updateMe({
      display_name: display_name || undefined,
      avatar_url: avatar_url || undefined,
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.profileSaving = false)
      )
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.profileUpdated = true;
            this.profileForm.markAsPristine();
            this.auth.fetchCurrentUser();
            this.snackBar.open(
              this.translate.instant('settings.updated'),
              this.translate.instant('common.close') || 'Close',
              { duration: 3000 }
            );
            setTimeout(() => this.profileUpdated = false, 3000);
          } else {
            this.profileError = res.message || 'Update failed';
          }
        },
        error: (err) => {
          this.profileError = err?.error?.message || 'Failed to update profile';
        },
      });
  }

  // ---------- Usage & Tier ----------
  loadUsage(): void {
    this.api.usage()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.usageData = res.data;
            this.currentTier = res.data.tier || this.currentTier;
          }
        },
        error: () => {
          // Non-critical
        },
      });
  }

  upgradeTier(targetTier: string): void {
    if (this.upgradeLoading || targetTier === this.currentTier) return;
    this.upgradeLoading = true;
    this.upgradeError = null;
    this.upgradeSuccess = null;

    this.api.upgradeTier(targetTier)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.upgradeLoading = false)
      )
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.upgradeSuccess = targetTier;
            this.currentTier = targetTier;
            this.loadUsage();
            this.snackBar.open(
              this.translate.instant('settings.upgraded') + ' ' + targetTier,
              this.translate.instant('common.close') || 'Close',
              { duration: 3000 }
            );
          } else {
            this.upgradeError = res.message || 'Upgrade failed';
          }
        },
        error: (err) => {
          this.upgradeError = err?.error?.message || 'Upgrade failed';
        },
      });
  }

  // ---------- GitHub / OAuth ----------
  loadOAuthAccounts(): void {
    this.accountsLoading = true;
    this.api.getAccounts()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.accountsLoading = false)
      )
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.oauthAccounts = res.data;
          }
        },
        error: () => {
          // Non-critical
        },
      });
  }

  linkGitHub(): void {
    if (this.linkLoading) return;
    this.linkLoading = true;
    this.accountError = null;

    this.api.getAuthorizationUrl()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.linkLoading = false)
      )
      .subscribe({
        next: (res) => {
          if (res.success && res.data?.url) {
            window.location.href = res.data.url;
          } else {
            this.accountError = res.message || 'Failed to get authorization URL';
          }
        },
        error: (err) => {
          this.accountError = err?.error?.message || 'Failed to get authorization URL';
        },
      });
  }

  unlinkAccount(): void {
    if (this.unlinkLoading) return;
    if (!confirm('Unlink your GitHub account?')) return;

    this.unlinkLoading = true;
    this.accountError = null;

    this.api.unlink()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.unlinkLoading = false)
      )
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.oauthAccounts = [];
            this.snackBar.open(
              this.translate.instant('auth.github_unlinked'),
              this.translate.instant('common.close') || 'Close',
              { duration: 3000 }
            );
          } else {
            this.accountError = res.message || 'Failed to unlink';
          }
        },
        error: (err) => {
          this.accountError = err?.error?.message || 'Failed to unlink';
        },
      });
  }

  // ---------- Language ----------
  switchLanguage(lang: string): void {
    this.currentLang = lang;
    this.translate.use(lang);
  }

  // ---------- Sign Out ----------
  signOut(): void {
    this.auth.logout();
  }

  // ---------- Helpers ----------
  getPercentage(used: number, limit: number | undefined): number {
    if (!limit || limit <= 0) return 0;
    return Math.min((used / limit) * 100, 100);
  }

  getLimit(limits: Record<string, number>, key: string): string {
    const val = limits[key];
    return val != null ? String(val) : 'No limit';
  }

  formatSize(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let n = bytes;
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024;
      i++;
    }
    return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  formatLimitSize(limits: Record<string, number>, key: string): string {
    const val = limits[key];
    return val != null ? this.formatSize(val) : 'No limit';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString();
  }
}
