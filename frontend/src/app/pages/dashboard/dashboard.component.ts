import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { NgIf, NgFor, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, takeUntil, finalize } from 'rxjs';
import { ApiService } from '../../core/http/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { FileIconComponent } from '../../shared/components/file-icon/file-icon.component';
import type { Document, UsageData } from '../../shared/models/types';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    NgIf, NgFor, NgClass,
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    TranslateModule,
    FileIconComponent,
  ],
  template: `
    <div class="max-w-7xl mx-auto px-4 py-6 space-y-8">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900">{{ 'dashboard.title' | translate }}</h1>
        <div class="flex items-center gap-3">
          <a mat-stroked-button routerLink="/github/import">
            <mat-icon>code</mat-icon>
            {{ 'dashboard.import_from_github' | translate }}
          </a>
        </div>
      </div>

      <!-- Usage Stats -->
      <section *ngIf="usageData; else usageLoadingTpl" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <!-- Documents -->
        <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-medium text-gray-500">{{ 'dashboard.quota_documents' | translate }}</span>
            <mat-icon class="text-blue-500">description</mat-icon>
          </div>
          <div class="flex items-baseline gap-1 mb-2">
            <span class="text-2xl font-bold text-gray-900">{{ usageData.quota_used_docs }}</span>
            <span class="text-sm text-gray-400">
              / {{ getLimit(usageData.tier_limits, 'max_documents') }}
            </span>
          </div>
          <div class="w-full bg-gray-100 rounded-full h-2">
            <div class="h-2 rounded-full transition-all duration-300"
              [style.width.%]="getPercentage(usageData.quota_used_docs, usageData.tier_limits['max_documents'])"
              [ngClass]="getProgressColor(getPercentage(usageData.quota_used_docs, usageData.tier_limits['max_documents']))">
            </div>
          </div>
        </div>

        <!-- AI Calls -->
        <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-medium text-gray-500">{{ 'dashboard.quota_ai' | translate }}</span>
            <mat-icon class="text-purple-500">psychology</mat-icon>
          </div>
          <div class="flex items-baseline gap-1 mb-2">
            <span class="text-2xl font-bold text-gray-900">{{ usageData.quota_used_ai_calls }}</span>
            <span class="text-sm text-gray-400">
              / {{ getLimit(usageData.tier_limits, 'max_ai_calls') }}
            </span>
          </div>
          <div class="w-full bg-gray-100 rounded-full h-2">
            <div class="h-2 rounded-full transition-all duration-300"
              [style.width.%]="getPercentage(usageData.quota_used_ai_calls, usageData.tier_limits['max_ai_calls'])"
              [ngClass]="getProgressColor(getPercentage(usageData.quota_used_ai_calls, usageData.tier_limits['max_ai_calls']))">
            </div>
          </div>
        </div>

        <!-- Storage -->
        <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-medium text-gray-500">{{ 'dashboard.quota_storage' | translate }}</span>
            <mat-icon class="text-green-500">cloud</mat-icon>
          </div>
          <div class="flex items-baseline gap-1 mb-2">
            <span class="text-2xl font-bold text-gray-900">{{ formatSize(usageData.quota_used_storage_bytes) }}</span>
            <span class="text-sm text-gray-400">
              / {{ getStorageLimit(usageData.tier_limits) }}
            </span>
          </div>
          <div class="w-full bg-gray-100 rounded-full h-2">
            <div class="h-2 rounded-full transition-all duration-300"
              [style.width.%]="getPercentage(usageData.quota_used_storage_bytes, usageData.tier_limits['max_storage_bytes'])"
              [ngClass]="getProgressColor(getPercentage(usageData.quota_used_storage_bytes, usageData.tier_limits['max_storage_bytes']))">
            </div>
          </div>
        </div>
      </section>

      <ng-template #usageLoadingTpl>
        <section class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div *ngFor="let _ of [1,2,3]" class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm animate-pulse">
            <div class="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
            <div class="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div class="h-2 bg-gray-200 rounded w-full"></div>
          </div>
        </section>
      </ng-template>

      <!-- Upload Zone -->
      <section
        class="rounded-xl border-2 border-dashed p-10 text-center transition-colors cursor-pointer"
        [class.border-blue-400]="isDragging"
        [class.bg-blue-50]="isDragging"
        [class.border-gray-300]="!isDragging"
        [class.bg-gray-50]="!isDragging"
        [class.opacity-50]="uploading"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)"
        (click)="fileInput.click()">
        <input type="file" #fileInput class="hidden"
          accept=".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.csv,.txt,.md,.markdown,.html,.htm,.json,.xml,.yaml,.yml,.jpg,.jpeg,.png,.gif,.bmp,.webp"
          (change)="onFileSelected($event)" />
        <mat-icon class="text-5xl mb-3"
          [class.text-blue-500]="isDragging"
          [class.text-gray-400]="!isDragging">
          {{ isDragging ? 'cloud_done' : 'cloud_upload' }}
        </mat-icon>
        <p class="text-lg font-medium mb-1"
          [class.text-blue-600]="isDragging"
          [class.text-gray-700]="!isDragging">
          {{ isDragging ? ('dashboard.drop_active' | translate) : ('dashboard.drop_text' | translate) }}
        </p>
        <p class="text-sm text-gray-400">{{ 'dashboard.drop_hint' | translate }}</p>

        <!-- Upload feedback -->
        <div *ngIf="uploading" class="mt-4">
          <div class="w-full bg-gray-200 rounded-full h-2 max-w-xs mx-auto">
            <div class="h-2 bg-blue-500 rounded-full animate-pulse w-full"></div>
          </div>
          <p class="text-sm text-blue-600 mt-1">{{ 'common.loading' | translate }}</p>
        </div>
        <div *ngIf="uploadError" class="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-1.5 inline-block">
          {{ uploadError }}
        </div>
        <div *ngIf="uploadSuccess" class="mt-3 text-sm text-green-600 bg-green-50 rounded-lg px-3 py-1.5 inline-block">
          {{ 'dashboard.uploaded' | translate }}
        </div>
      </section>

      <!-- Folder input -->
      <div [formGroup]="folderForm" class="flex items-center gap-3 max-w-sm">
        <label class="text-sm text-gray-600 whitespace-nowrap">{{ 'dashboard.folder_label' | translate }}</label>
        <input type="text" formControlName="folder"
          class="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          [placeholder]="'dashboard.folder_placeholder' | translate" />
      </div>

      <!-- Document List -->
      <section>
        <!-- Loading -->
        <div *ngIf="loading" class="flex items-center justify-center py-20">
          <div class="text-center space-y-3">
            <div class="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p class="text-gray-500 text-sm">{{ 'common.loading' | translate }}</p>
          </div>
        </div>

        <!-- Error -->
        <div *ngIf="!loading && loadError" class="rounded-lg border border-red-300 bg-red-50 p-6 text-center">
          <mat-icon class="text-red-500 text-4xl mb-2">error_outline</mat-icon>
          <p class="text-red-700 font-medium">{{ loadError }}</p>
          <button mat-stroked-button color="warn" class="mt-3" (click)="loadDocuments()">
            Retry
          </button>
        </div>

        <!-- Empty state -->
        <div *ngIf="!loading && !loadError && documents.length === 0" class="rounded-xl border border-gray-200 bg-white p-16 text-center">
          <mat-icon class="text-6xl text-gray-300 mb-4">inbox</mat-icon>
          <h2 class="text-xl font-semibold text-gray-700 mb-1">{{ 'dashboard.empty_title' | translate }}</h2>
          <p class="text-gray-400">{{ 'dashboard.empty_desc' | translate }}</p>
        </div>

        <!-- Document table -->
        <ng-container *ngIf="!loading && !loadError && documents.length > 0">
          <div class="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="border-b border-gray-200 bg-gray-50 text-left">
                    <th class="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-10"></th>
                    <th class="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                    <th class="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Format</th>
                    <th class="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Status</th>
                    <th class="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Size</th>
                    <th class="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Date</th>
                    <th class="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let doc of documents; let i = index"
                    class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td class="px-5 py-3.5">
                      <app-file-icon [format]="doc.input_format" />
                    </td>
                    <td class="px-5 py-3.5">
                      <a [routerLink]="['/documents', doc.id]"
                        class="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors line-clamp-1">
                        {{ doc.title }}
                      </a>
                    </td>
                    <td class="px-5 py-3.5 hidden sm:table-cell">
                      <span class="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 uppercase">
                        {{ doc.input_format }}
                      </span>
                    </td>
                    <td class="px-5 py-3.5 hidden sm:table-cell">
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                        [class.bg-green-100]="doc.status === 'completed'"
                        [class.text-green-700]="doc.status === 'completed'"
                        [class.bg-yellow-100]="doc.status === 'processing'"
                        [class.text-yellow-700]="doc.status === 'processing'"
                        [class.bg-red-100]="doc.status === 'failed'"
                        [class.text-red-700]="doc.status === 'failed'"
                        [class.bg-gray-100]="doc.status !== 'completed' && doc.status !== 'processing' && doc.status !== 'failed'"
                        [class.text-gray-600]="doc.status !== 'completed' && doc.status !== 'processing' && doc.status !== 'failed'">
                        <span class="w-1.5 h-1.5 rounded-full"
                          [class.bg-green-500]="doc.status === 'completed'"
                          [class.bg-yellow-500]="doc.status === 'processing'"
                          [class.bg-red-500]="doc.status === 'failed'"
                          [class.bg-gray-400]="doc.status !== 'completed' && doc.status !== 'processing' && doc.status !== 'failed'">
                        </span>
                        {{ doc.status }}
                      </span>
                    </td>
                    <td class="px-5 py-3.5 text-sm text-gray-500 hidden md:table-cell">
                      {{ formatSize(doc.file_size_bytes) }}
                    </td>
                    <td class="px-5 py-3.5 text-sm text-gray-500 hidden md:table-cell">
                      {{ formatDate(doc.created_at) }}
                    </td>
                    <td class="px-5 py-3.5 text-right">
                      <button mat-icon-button [matMenuTriggerFor]="actionMenu" [attr.aria-label]="'Actions'">
                        <mat-icon>more_vert</mat-icon>
                      </button>
                      <mat-menu #actionMenu="matMenu">
                        <a mat-menu-item [routerLink]="['/documents', doc.id]">
                          <mat-icon>visibility</mat-icon>
                          View
                        </a>
                        <button mat-menu-item (click)="deleteDocument(doc)">
                          <mat-icon class="text-red-500">delete</mat-icon>
                          <span class="text-red-600">Delete</span>
                        </button>
                      </mat-menu>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Pagination -->
          <div class="flex items-center justify-between mt-4 px-1">
            <span class="text-sm text-gray-500">
              Page {{ page }} of {{ totalPages }} ({{ total }} documents)
            </span>
            <div class="flex items-center gap-1">
              <button mat-icon-button
                [disabled]="page <= 1"
                (click)="changePage(page - 1)"
                aria-label="Previous page">
                <mat-icon>chevron_left</mat-icon>
              </button>
              <ng-container *ngFor="let p of getPageNumbers()">
                <button mat-icon-button
                  *ngIf="p !== '...'; else ellipsis"
                  [color]="p === page ? 'primary' : undefined"
                  class="w-9 h-9 text-sm"
                  (click)="changePage($any(p))">
                  {{ p }}
                </button>
                <ng-template #ellipsis>
                  <span class="px-1 text-gray-400">...</span>
                </ng-template>
              </ng-container>
              <button mat-icon-button
                [disabled]="page >= totalPages"
                (click)="changePage(page + 1)"
                aria-label="Next page">
                <mat-icon>chevron_right</mat-icon>
              </button>
            </div>
          </div>
        </ng-container>
      </section>
    </div>
  `,
})
export class DashboardComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private destroy$ = new Subject<void>();

  // Usage stats
  usageData: UsageData | null = null;

  // Documents
  documents: Document[] = [];
  total = 0;
  page = 1;
  pageSize = 10;
  totalPages = 0;
  loading = true;
  loadError: string | null = null;

  // Upload
  isDragging = false;
  uploading = false;
  uploadError: string | null = null;
  uploadSuccess = false;

  // Folder form
  folderForm = new FormGroup({
    folder: new FormControl(''),
  });

  ngOnInit(): void {
    this.loadUsage();
    this.loadDocuments();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---------- Usage ----------
  loadUsage(): void {
    this.api.usage()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.usageData = res.data;
          }
        },
        error: () => {
          // Non-critical; silently ignore
        },
      });
  }

  // ---------- Documents ----------
  loadDocuments(): void {
    this.loading = true;
    this.loadError = null;
    this.api.list({ page: this.page, page_size: this.pageSize })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.documents = res.data.items;
            this.total = res.data.total;
            this.totalPages = res.data.total_pages;
          } else {
            this.loadError = res.message || 'Failed to load documents';
          }
        },
        error: (err) => {
          this.loadError = err?.error?.message || 'Failed to load documents';
        },
      });
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.page) return;
    this.page = page;
    this.loadDocuments();
  }

  deleteDocument(doc: Document): void {
    if (!confirm(`Delete "${doc.title}"?`)) return;
    this.api.delete(doc.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.documents = this.documents.filter(d => d.id !== doc.id);
            this.total--;
            if (this.documents.length === 0 && this.page > 1) {
              this.changePage(this.page - 1);
            } else {
              this.loadDocuments();
            }
            this.loadUsage();
          }
        },
        error: (err) => {
          this.loadError = err?.error?.message || 'Failed to delete document';
        },
      });
  }

  // ---------- Upload ----------
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input?.files?.length) {
      this.uploadFile(input.files[0]);
      input.value = '';
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.uploadFile(file);
    }
  }

  private uploadFile(file: File): void {
    this.uploading = true;
    this.uploadError = null;
    this.uploadSuccess = false;

    const folder = this.folderForm.get('folder')?.value || undefined;

    this.api.upload(file, folder)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.uploading = false)
      )
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.uploadSuccess = true;
            this.loadDocuments();
            this.loadUsage();
            setTimeout(() => this.uploadSuccess = false, 3000);
          } else {
            this.uploadError = res.message || 'Upload failed';
          }
        },
        error: (err) => {
          this.uploadError = err?.error?.message || 'Upload failed';
        },
      });
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

  getStorageLimit(limits: Record<string, number>): string {
    const val = limits['max_storage_bytes'];
    return val != null ? this.formatSize(val) : 'No limit';
  }

  getProgressColor(pct: number): string {
    if (pct >= 100) return 'bg-red-500';
    if (pct >= 80) return 'bg-yellow-500';
    return 'bg-blue-500';
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

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString();
  }

  getPageNumbers(): (number | string)[] {
    const pages: (number | string)[] = [];
    const tp = this.totalPages;
    if (tp <= 7) {
      for (let i = 1; i <= tp; i++) pages.push(i);
      return pages;
    }
    pages.push(1);
    if (this.page > 3) pages.push('...');
    const start = Math.max(2, this.page - 1);
    const end = Math.min(tp - 1, this.page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (this.page < tp - 2) pages.push('...');
    pages.push(tp);
    return pages;
  }
}
