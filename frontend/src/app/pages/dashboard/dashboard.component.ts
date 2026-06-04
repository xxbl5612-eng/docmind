import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { TranslateModule, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil, finalize } from 'rxjs';
import { ApiService } from '../../core/http/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { FileIconComponent } from '../../shared/components/file-icon/file-icon.component';
import type { Document } from '../../shared/models/types';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NgIf, NgFor, RouterLink, ReactiveFormsModule, MatButtonModule, MatIconModule, MatMenuModule, TranslateModule, TranslatePipe, FileIconComponent],
  template: `
    <div class="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <!-- ═══ Header ═══ -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">{{ 'dashboard.title' | translate }}</h1>
          <p class="text-sm text-gray-500 mt-1" *ngIf="auth.currentUser">
            {{ 'dashboard.welcome' | translate }}，{{ auth.currentUser.display_name || auth.currentUser.email }}
          </p>
        </div>
        <div class="flex items-center gap-3">
          <a mat-stroked-button routerLink="/github/import" class="!rounded-lg">
            <mat-icon>code</mat-icon> {{ 'dashboard.import_from_github' | translate }}
          </a>
        </div>
      </div>

      <!-- ═══ Upload Zone ═══ -->
      <section
        class="surface-card p-10 text-center cursor-pointer transition-all duration-200 border-dashed border-2"
        [class.border-blue-400]="isDragging"
        [class.bg-blue-50]="isDragging"
        [class.border-gray-200]="!isDragging"
        [class.opacity-60]="uploading"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)"
        (click)="fileInput.click()">
        <input type="file" #fileInput class="hidden"
          accept=".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.csv,.txt,.md,.markdown,.html,.htm,.json,.xml,.yaml,.yml,.jpg,.jpeg,.png,.gif,.bmp,.webp"
          (change)="onFileSelected($event)" />
        <!-- Icon -->
        <div class="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center transition-colors duration-200"
             [class.bg-blue-100]="isDragging" [class.bg-gray-100]="!isDragging">
          <mat-icon class="text-3xl" [class.text-blue-600]="isDragging" [class.text-gray-400]="!isDragging">
            {{ isDragging ? 'cloud_done' : 'cloud_upload' }}
          </mat-icon>
        </div>
        <p class="text-lg font-semibold mb-1 text-gray-700">
          {{ isDragging ? ('dashboard.drop_active' | translate) : ('dashboard.drop_text' | translate) }}
        </p>
        <p class="text-sm text-gray-400">{{ 'dashboard.drop_hint' | translate }}</p>
        <!-- Upload feedback -->
        <div *ngIf="uploading" class="mt-4">
          <div class="w-full bg-gray-200 rounded-full h-1.5 max-w-xs mx-auto overflow-hidden">
            <div class="h-full bg-blue-500 rounded-full animate-pulse w-full"></div>
          </div>
          <p class="text-sm text-blue-600 mt-2">{{ 'common.loading' | translate }}</p>
        </div>
        <div *ngIf="uploadError" class="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-1.5 inline-block">{{ uploadError }}</div>
        <div *ngIf="uploadSuccess" class="mt-3 text-sm text-green-600 bg-green-50 rounded-lg px-3 py-1.5 inline-block">{{ 'dashboard.uploaded' | translate }}</div>
      </section>

      <!-- ═══ Folder input ═══ -->
      <div [formGroup]="folderForm" class="flex items-center gap-3 max-w-xs">
        <label class="text-sm font-medium text-gray-600 whitespace-nowrap">{{ 'dashboard.folder_label' | translate }}</label>
        <input type="text" formControlName="folder"
          class="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-shadow"
          [placeholder]="'dashboard.folder_placeholder' | translate" />
      </div>

      <!-- ═══ Document List ═══ -->
      <section>
        <!-- Loading skeleton -->
        <div *ngIf="loading" class="space-y-3">
          <div *ngFor="let _ of [1,2,3,4]" class="surface-card p-5 flex items-center gap-4">
            <div class="skeleton w-10 h-10 rounded-lg flex-shrink-0"></div>
            <div class="flex-1 space-y-2">
              <div class="skeleton h-4 w-1/3"></div>
              <div class="skeleton h-3 w-1/5"></div>
            </div>
            <div class="skeleton h-3 w-16"></div>
            <div class="skeleton h-3 w-12"></div>
          </div>
        </div>

        <!-- Error -->
        <div *ngIf="!loading && loadError" class="surface-card p-10 text-center">
          <mat-icon class="text-red-400 text-5xl mb-3">error_outline</mat-icon>
          <p class="text-red-700 font-medium mb-3">{{ loadError }}</p>
          <button mat-stroked-button color="warn" (click)="loadDocuments()">Retry</button>
        </div>

        <!-- Empty state -->
        <div *ngIf="!loading && !loadError && documents.length === 0" class="surface-card p-16 text-center">
          <div class="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gray-100 flex items-center justify-center">
            <mat-icon class="text-4xl text-gray-300">inbox</mat-icon>
          </div>
          <h2 class="text-xl font-semibold text-gray-700 mb-2">{{ 'dashboard.empty_title' | translate }}</h2>
          <p class="text-gray-400 mb-6">{{ 'dashboard.empty_desc' | translate }}</p>
        </div>

        <!-- Document table -->
        <ng-container *ngIf="!loading && !loadError && documents.length > 0">
          <div class="surface-card overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="border-b border-gray-100 bg-gray-50/50 text-left">
                    <th class="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-10"></th>
                    <th class="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">{{ 'dashboard.name' | translate }}</th>
                    <th class="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">{{ 'dashboard.format' | translate }}</th>
                    <th class="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">{{ 'dashboard.status' | translate }}</th>
                    <th class="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">{{ 'dashboard.size' | translate }}</th>
                    <th class="px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">{{ 'dashboard.date' | translate }}</th>
                    <th class="px-5 py-3.5 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let doc of documents" class="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td class="px-5 py-3.5"><app-file-icon [format]="doc.input_format" /></td>
                    <td class="px-5 py-3.5">
                      <a [routerLink]="['/documents', doc.id]" class="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors line-clamp-1">{{ doc.title }}</a>
                    </td>
                    <td class="px-5 py-3.5 hidden sm:table-cell">
                      <span class="badge bg-gray-100 text-gray-600">{{ doc.input_format.toUpperCase() }}</span>
                    </td>
                    <td class="px-5 py-3.5 hidden sm:table-cell">
                      <span class="badge" [class.badge-success]="doc.status === 'completed'" [class.badge-warning]="doc.status === 'processing'" [class.badge-danger]="doc.status === 'failed'" [class.bg-gray-100]="doc.status !== 'completed' && doc.status !== 'processing' && doc.status !== 'failed'" [class.text-gray-600]="doc.status !== 'completed' && doc.status !== 'processing' && doc.status !== 'failed'">
                        <span class="w-1.5 h-1.5 rounded-full mr-1.5 inline-block"
                          [class.bg-emerald-500]="doc.status === 'completed'"
                          [class.bg-amber-500]="doc.status === 'processing'"
                          [class.bg-red-500]="doc.status === 'failed'"
                          [class.bg-gray-400]="doc.status !== 'completed' && doc.status !== 'processing' && doc.status !== 'failed'"></span>
                        {{ doc.status }}
                      </span>
                    </td>
                    <td class="px-5 py-3.5 text-sm text-gray-500 hidden md:table-cell">{{ formatSize(doc.file_size_bytes) }}</td>
                    <td class="px-5 py-3.5 text-sm text-gray-400 hidden md:table-cell">{{ formatDate(doc.created_at) }}</td>
                    <td class="px-5 py-3.5 text-right">
                      <button mat-icon-button [matMenuTriggerFor]="actionMenu" aria-label="Actions" class="!text-gray-400 hover:!text-gray-600">
                        <mat-icon>more_vert</mat-icon>
                      </button>
                      <mat-menu #actionMenu="matMenu">
                        <a mat-menu-item [routerLink]="['/documents', doc.id]"><mat-icon>visibility</mat-icon> View</a>
                        <button mat-menu-item (click)="deleteDocument(doc)"><mat-icon class="text-red-500">delete</mat-icon> Delete</button>
                      </mat-menu>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Pagination -->
            <div class="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/30">
              <span class="text-sm text-gray-500">Page {{ page }} of {{ totalPages }} ({{ total }} documents)</span>
              <div class="flex items-center gap-1">
                <button mat-icon-button [disabled]="page <= 1" (click)="changePage(page - 1)" aria-label="Previous"><mat-icon>chevron_left</mat-icon></button>
                <ng-container *ngFor="let p of getPageNumbers()">
                  <button *ngIf="p !== '...'; else dots" mat-icon-button
                    [color]="p === page ? 'primary' : undefined"
                    class="!w-9 !h-9 !text-sm" (click)="changePage($any(p))">{{ p }}</button>
                  <ng-template #dots><span class="px-1 text-gray-300">...</span></ng-template>
                </ng-container>
                <button mat-icon-button [disabled]="page >= totalPages" (click)="changePage(page + 1)" aria-label="Next"><mat-icon>chevron_right</mat-icon></button>
              </div>
            </div>
          </div>
        </ng-container>
      </section>
    </div>
  `,
})
export class DashboardComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  readonly auth = inject(AuthService);
  private destroy$ = new Subject<void>();

  documents: Document[] = [];
  total = 0; page = 1; pageSize = 10; totalPages = 0;
  loading = true; loadError: string | null = null;
  isDragging = false; uploading = false; uploadError: string | null = null; uploadSuccess = false;
  folderForm = new FormGroup({ folder: new FormControl('') });

  ngOnInit(): void { this.loadDocuments(); }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  loadDocuments(): void {
    this.loading = true; this.loadError = null;
    this.api.list({ page: this.page, page_size: this.pageSize })
      .pipe(takeUntil(this.destroy$), finalize(() => this.loading = false))
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.documents = res.data.items; this.total = res.data.total; this.totalPages = res.data.total_pages;
          }
        },
        error: (err) => { this.loadError = err?.error?.message || 'Failed to load documents'; },
      });
  }

  changePage(page: number): void { if (page >= 1 && page <= this.totalPages) { this.page = page; this.loadDocuments(); } }

  deleteDocument(doc: Document): void {
    if (!confirm(`Delete "${doc.title}"?`)) return;
    this.api.delete(doc.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => { if (res.success) { this.loadDocuments(); } },
    });
  }

  onFileSelected(event: Event): void { const input = event.target as HTMLInputElement; if (input?.files?.length) { this.uploadFile(input.files[0]); input.value = ''; } }
  onDragOver(event: DragEvent): void { event.preventDefault(); this.isDragging = true; }
  onDragLeave(event: DragEvent): void { event.preventDefault(); this.isDragging = false; }
  onDrop(event: DragEvent): void { event.preventDefault(); this.isDragging = false; if (event.dataTransfer?.files?.[0]) this.uploadFile(event.dataTransfer.files[0]); }

  private uploadFile(file: File): void {
    this.uploading = true; this.uploadError = null; this.uploadSuccess = false;
    this.api.upload(file, this.folderForm.get('folder')?.value || undefined)
      .pipe(takeUntil(this.destroy$), finalize(() => this.uploading = false))
      .subscribe({
        next: (res) => { if (res.success) { this.uploadSuccess = true; this.loadDocuments(); setTimeout(() => this.uploadSuccess = false, 3000); } },
        error: (err) => { this.uploadError = err?.error?.message || 'Upload failed'; },
      });
  }

  formatSize(bytes: number): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0, n = bytes;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  formatDate(dateStr: string | null): string { if (!dateStr) return ''; return new Date(dateStr).toLocaleDateString(); }

  getPageNumbers(): (number | string)[] {
    const pages: (number | string)[] = []; const tp = this.totalPages;
    if (tp <= 7) { for (let i = 1; i <= tp; i++) pages.push(i); return pages; }
    pages.push(1); if (this.page > 3) pages.push('...');
    for (let i = Math.max(2, this.page - 1); i <= Math.min(tp - 1, this.page + 1); i++) pages.push(i);
    if (this.page < tp - 2) pages.push('...'); pages.push(tp); return pages;
  }
}
