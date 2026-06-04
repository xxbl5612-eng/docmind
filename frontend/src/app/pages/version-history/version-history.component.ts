import { Component, OnInit, inject } from '@angular/core';
import { NgIf, NgFor, DatePipe } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/http/api.service';
import type { Version, VersionContent, DiffResponse } from '../../shared/models/types';

@Component({
  selector: 'app-version-history',
  standalone: true,
  imports: [
    NgIf, NgFor, DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    TranslateModule,
  ],
  template: `
    <div class="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <a mat-icon-button [routerLink]="['/documents', docId]" [attr.aria-label]="'common.back' | translate">
            <mat-icon>arrow_back</mat-icon>
          </a>
          <h1 class="text-2xl font-bold text-gray-900">{{ 'version.title' | translate }}</h1>
        </div>
        <span *ngIf="!loading && !error" class="text-sm text-gray-500">
          {{ versions.length }} {{ 'version.count' | translate }}
        </span>
      </div>

      <!-- Loading -->
      <div *ngIf="loading" class="flex items-center justify-center py-20">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span class="ml-3 text-gray-500">{{ 'common.loading' | translate }}</span>
      </div>

      <!-- Error -->
      <div *ngIf="error" class="rounded-lg border border-red-300 bg-red-50 p-6 text-center">
        <p class="text-red-700 font-medium">{{ error }}</p>
        <button mat-raised-button color="primary" class="mt-4" (click)="loadVersions()">
          {{ 'common.retry' | translate }}
        </button>
      </div>

      <!-- Empty -->
      <div *ngIf="!loading && !error && versions.length === 0"
        class="rounded-lg border border-dashed border-gray-300 p-12 text-center">
        <mat-icon class="text-4xl text-gray-300">history</mat-icon>
        <p class="mt-3 text-gray-500">{{ 'version.empty' | translate }}</p>
        <a mat-stroked-button color="primary" class="mt-4" [routerLink]="['/documents', docId]">
          {{ 'common.back_to_editor' | translate }}
        </a>
      </div>

      <!-- Version table -->
      <ng-container *ngIf="!loading && !error && versions.length > 0">
        <!-- Diff controls -->
        <div class="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
          <span class="text-sm font-medium text-gray-600">{{ 'version.diff_compare' | translate }}:</span>
          <button *ngFor="let v of versions; let i = index" (click)="toggleDiffSelection(v, i)"
            class="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
            [class.bg-blue-600]="isDiffSelected(v)"
            [class.text-white]="isDiffSelected(v)"
            [class.border-blue-600]="isDiffSelected(v)"
            [class.bg-white]="!isDiffSelected(v)"
            [class.text-gray-600]="!isDiffSelected(v)"
            [class.border-gray-300]="!isDiffSelected(v)"
            [class.hover:border-blue-400]="!isDiffSelected(v)">
            v{{ v.version_number }}
          </button>
          <button mat-raised-button color="primary" class="ml-2 text-sm"
            [disabled]="diffSelections.length !== 2"
            (click)="runDiff()">
            <mat-icon class="text-lg">compare_arrows</mat-icon>
            {{ 'version.compare' | translate }}
          </button>
          <button mat-button (click)="clearDiff()"
            *ngIf="diffSelections.length > 0" class="text-sm">
            {{ 'common.clear' | translate }}
          </button>
        </div>

        <!-- Table -->
        <div class="overflow-x-auto rounded-lg border border-gray-200">
          <table class="w-full text-sm text-left">
            <thead class="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th class="px-4 py-3 w-8"></th>
                <th class="px-4 py-3">{{ 'version.number' | translate }}</th>
                <th class="px-4 py-3">{{ 'version.change_summary' | translate }}</th>
                <th class="px-4 py-3">{{ 'version.source' | translate }}</th>
                <th class="px-4 py-3">{{ 'version.created_by' | translate }}</th>
                <th class="px-4 py-3">{{ 'version.created_at' | translate }}</th>
                <th class="px-4 py-3 w-[120px]">{{ 'version.actions' | translate }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr *ngFor="let v of versions; let i = index" class="hover:bg-gray-50 transition-colors"
                [class.bg-blue-50]="isDiffSelected(v)">
                <td class="px-4 py-3">
                  <input type="checkbox"
                    [checked]="isDiffSelected(v)"
                    (change)="toggleDiffSelection(v, i)"
                    class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                </td>
                <td class="px-4 py-3 font-medium text-gray-900">v{{ v.version_number }}</td>
                <td class="px-4 py-3 text-gray-600 max-w-[200px] truncate">
                  {{ v.change_summary || '—' }}
                </td>
                <td class="px-4 py-3">
                  <span class="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                    {{ v.source }}
                  </span>
                </td>
                <td class="px-4 py-3 text-gray-600">{{ v.created_by || '—' }}</td>
                <td class="px-4 py-3 text-gray-500 text-xs">
                  {{ v.created_at | date:'medium' }}
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-1">
                    <button mat-icon-button color="primary"
                      (click)="viewVersion(v)"
                      [attr.aria-label]="'version.view' | translate"
                      class="!w-8 !h-8">
                      <mat-icon class="text-lg">visibility</mat-icon>
                    </button>
                    <button mat-icon-button color="accent"
                      (click)="restoreVersion(v)"
                      [disabled]="restoringId === v.id"
                      [attr.aria-label]="'version.restore' | translate"
                      class="!w-8 !h-8">
                      <mat-icon class="text-lg" *ngIf="restoringId !== v.id">restore</mat-icon>
                      <div *ngIf="restoringId === v.id"
                        class="animate-spin rounded-full h-4 w-4 border-2 border-amber-500 border-t-transparent"></div>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Version content modal -->
        <div *ngIf="viewingVersion" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          (click)="$event.target === $event.currentTarget && (viewingVersion = null)">
          <div class="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col m-4"
            (click)="$event.stopPropagation()">
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 class="text-lg font-semibold text-gray-900">
                {{ 'version.content_of' | translate }} v{{ viewingVersion.version_number }}
              </h3>
              <button mat-icon-button (click)="viewingVersion = null" [attr.aria-label]="'common.close' | translate">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            <div *ngIf="viewingContentLoading" class="flex justify-center py-10">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
            <div *ngIf="viewingContentError" class="p-6 text-red-600 text-center">{{ viewingContentError }}</div>
            <pre *ngIf="!viewingContentLoading && !viewingContentError && viewingContent"
              class="flex-1 overflow-auto p-6 text-sm font-mono text-gray-800 whitespace-pre-wrap">{{ viewingContent }}</pre>
          </div>
        </div>

        <!-- Diff result -->
        <div *ngIf="diffResult" class="rounded-lg border border-gray-200 bg-white">
          <div class="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
            <h3 class="font-semibold text-gray-800">
              {{ 'version.diff_v' | translate }} {{ diffResult.version_a }} vs v{{ diffResult.version_b }}
            </h3>
            <div class="flex items-center gap-3 text-xs">
              <span class="text-green-600">+{{ diffResult.additions }}</span>
              <span class="text-red-600">-{{ diffResult.deletions }}</span>
              <span class="text-gray-500">{{ diffResult.changes_count }} {{ 'version.changes' | translate }}</span>
              <button mat-icon-button (click)="diffResult = null" class="!w-6 !h-6">
                <mat-icon class="text-base">close</mat-icon>
              </button>
            </div>
          </div>
          <pre class="p-5 text-sm font-mono text-gray-800 whitespace-pre-wrap overflow-auto max-h-[500px]">{{ diffResult.diff_text }}</pre>
        </div>
      </ng-container>
    </div>
  `,
})
export class VersionHistoryComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  docId!: string;
  versions: Version[] = [];
  loading = true;
  error: string | null = null;

  // Version viewing
  viewingVersion: Version | null = null;
  viewingContent: string | null = null;
  viewingContentLoading = false;
  viewingContentError: string | null = null;

  // Restore
  restoringId: string | null = null;

  // Diff
  diffSelections: { version: Version; index: number }[] = [];
  diffResult: DiffResponse | null = null;
  diffLoading = false;

  ngOnInit(): void {
    this.docId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.docId) {
      this.error = 'No document ID provided';
      this.loading = false;
      return;
    }
    this.loadVersions();
  }

  loadVersions(): void {
    this.loading = true;
    this.error = null;
    this.api.listVersions(this.docId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.versions = res.data.items || [];
        } else {
          this.error = res.message || 'Failed to load versions';
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to load versions';
        this.loading = false;
      },
    });
  }

  // ── View version content ──
  viewVersion(v: Version): void {
    this.viewingVersion = v;
    this.viewingContent = null;
    this.viewingContentLoading = true;
    this.viewingContentError = null;
    this.api.getVersion(this.docId, v.id).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.viewingContent = res.data.content;
        } else {
          this.viewingContentError = res.message || 'Failed to load version content';
        }
        this.viewingContentLoading = false;
      },
      error: (err) => {
        this.viewingContentError = err?.error?.message || 'Failed to load version content';
        this.viewingContentLoading = false;
      },
    });
  }

  // ── Restore version ──
  restoreVersion(v: Version): void {
    this.restoringId = v.id;
    this.api.restoreVersion(this.docId, v.id).subscribe({
      next: (res) => {
        if (res.success) {
          this.loadVersions(); // reload to reflect restored version
        } else {
          this.error = res.message || 'Failed to restore version';
        }
        this.restoringId = null;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to restore version';
        this.restoringId = null;
      },
    });
  }

  // ── Diff selection / run ──
  isDiffSelected(v: Version): boolean {
    return this.diffSelections.some((s) => s.version.id === v.id);
  }

  toggleDiffSelection(v: Version, index: number): void {
    const existing = this.diffSelections.findIndex((s) => s.version.id === v.id);
    if (existing >= 0) {
      this.diffSelections.splice(existing, 1);
    } else {
      this.diffSelections.push({ version: v, index });
      // Keep only last 2 selections
      if (this.diffSelections.length > 2) {
        this.diffSelections.shift();
      }
    }
  }

  runDiff(): void {
    if (this.diffSelections.length !== 2 || this.diffLoading) return;
    this.diffLoading = true;
    this.diffResult = null;
    const [a, b] = this.diffSelections.sort((x, y) => x.version.version_number - y.version.version_number);
    this.api.diffVersions(this.docId, a.version.id, b.version.id).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.diffResult = res.data;
        } else {
          this.error = res.message || 'Failed to compute diff';
        }
        this.diffLoading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to compute diff';
        this.diffLoading = false;
      },
    });
  }

  clearDiff(): void {
    this.diffSelections = [];
    this.diffResult = null;
  }
}
