import { Component, OnInit, inject } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/http/api.service';
import { AuthService } from '../../core/auth/auth.service';
import type { AdminStats } from '../../shared/models/types';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [NgIf, NgFor, MatCardModule, MatIconModule, MatButtonModule, RouterLink, TranslateModule],
  template: `
    <div class="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900">{{ 'admin.title' | translate }}</h1>
        <a mat-stroked-button routerLink="/dashboard">
          <mat-icon>arrow_back</mat-icon>
          {{ 'common.back_to_dashboard' | translate }}
        </a>
      </div>

      <!-- Access Denied -->
      <div *ngIf="!isAdmin" class="rounded-xl border border-red-200 bg-red-50 p-10 text-center">
        <mat-icon class="text-6xl text-red-400 mb-4">lock</mat-icon>
        <h2 class="text-xl font-bold text-red-700 mb-1">Access Denied</h2>
        <p class="text-red-500">You do not have administrator privileges.</p>
      </div>

      <!-- Loading -->
      <div *ngIf="isAdmin && loading" class="flex items-center justify-center py-20">
        <div class="text-center space-y-3">
          <div class="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p class="text-gray-500 text-sm">{{ 'common.loading' | translate }}</p>
        </div>
      </div>

      <!-- Error -->
      <div *ngIf="isAdmin && !loading && error" class="rounded-lg border border-red-300 bg-red-50 p-6 text-center">
        <mat-icon class="text-red-500 text-4xl mb-2">error_outline</mat-icon>
        <p class="text-red-700 font-medium">{{ error }}</p>
        <button mat-stroked-button color="warn" class="mt-3" (click)="loadStats()">Retry</button>
      </div>

      <!-- Stats Grid -->
      <ng-container *ngIf="isAdmin && !loading && !error && stats">
        <!-- Stat Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
          <!-- Total Users -->
          <mat-card class="!bg-white !border !border-gray-200 !shadow-sm !rounded-xl">
            <mat-card-content class="!p-6">
              <div class="flex items-center gap-5">
                <div class="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <mat-icon class="text-3xl text-blue-600">people</mat-icon>
                </div>
                <div>
                  <p class="text-3xl font-bold text-gray-900">{{ formatNumber(stats.total_users) }}</p>
                  <p class="text-sm text-gray-500 mt-0.5">{{ 'admin.total_users' | translate }}</p>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Total Documents -->
          <mat-card class="!bg-white !border !border-gray-200 !shadow-sm !rounded-xl">
            <mat-card-content class="!p-6">
              <div class="flex items-center gap-5">
                <div class="w-14 h-14 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                  <mat-icon class="text-3xl text-green-600">description</mat-icon>
                </div>
                <div>
                  <p class="text-3xl font-bold text-gray-900">{{ formatNumber(stats.total_documents) }}</p>
                  <p class="text-sm text-gray-500 mt-0.5">{{ 'admin.total_documents' | translate }}</p>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Total Characters -->
          <mat-card class="!bg-white !border !border-gray-200 !shadow-sm !rounded-xl">
            <mat-card-content class="!p-6">
              <div class="flex items-center gap-5">
                <div class="w-14 h-14 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <mat-icon class="text-3xl text-purple-600">text_fields</mat-icon>
                </div>
                <div>
                  <p class="text-3xl font-bold text-gray-900">{{ formatNumber(stats.total_characters) }}</p>
                  <p class="text-sm text-gray-500 mt-0.5">{{ 'admin.total_chars' | translate }}</p>
                </div>
              </div>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Supported Formats Section -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <!-- Input Formats -->
          <mat-card class="!bg-white !border !border-gray-200 !shadow-sm !rounded-xl">
            <mat-card-header>
              <mat-card-title class="text-lg font-semibold flex items-center gap-2">
                <mat-icon class="text-blue-500">input</mat-icon>
                {{ 'admin.input_formats' | translate }}
              </mat-card-title>
            </mat-card-header>
            <mat-card-content class="!pt-4">
              <div class="flex flex-wrap gap-2">
                <span *ngFor="let fmt of stats.supported_formats?.input || []"
                  class="inline-block px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide
                         bg-blue-50 text-blue-700 border border-blue-200">
                  {{ fmt }}
                </span>
              </div>
              <p *ngIf="!(stats.supported_formats?.input?.length)" class="text-sm text-gray-400">
                No input formats listed.
              </p>
            </mat-card-content>
          </mat-card>

          <!-- Output Formats -->
          <mat-card class="!bg-white !border !border-gray-200 !shadow-sm !rounded-xl">
            <mat-card-header>
              <mat-card-title class="text-lg font-semibold flex items-center gap-2">
                <mat-icon class="text-green-500">output</mat-icon>
                {{ 'admin.output_formats' | translate }}
              </mat-card-title>
            </mat-card-header>
            <mat-card-content class="!pt-4">
              <div class="flex flex-wrap gap-2">
                <span *ngFor="let fmt of stats.supported_formats?.output || []"
                  class="inline-block px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide
                         bg-green-50 text-green-700 border border-green-200">
                  {{ fmt }}
                </span>
              </div>
              <p *ngIf="!(stats.supported_formats?.output?.length)" class="text-sm text-gray-400">
                No output formats listed.
              </p>
            </mat-card-content>
          </mat-card>
        </div>
      </ng-container>
    </div>
  `,
})
export class AdminDashboardComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  stats: AdminStats | null = null;
  loading = false;
  error: string | null = null;

  get isAdmin(): boolean {
    return this.auth.currentUser?.is_superuser === true;
  }

  ngOnInit(): void {
    if (this.isAdmin) {
      this.loadStats();
    }
  }

  loadStats(): void {
    this.loading = true;
    this.error = null;
    this.api.adminStats().subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.data) {
          this.stats = res.data;
        } else {
          this.error = res.message || 'Failed to load admin statistics';
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Failed to load admin statistics';
      },
    });
  }

  formatNumber(n: number): string {
    if (n == null) return '0';
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toLocaleString();
  }
}
