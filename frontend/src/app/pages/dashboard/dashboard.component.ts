import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { TranslateModule, TranslatePipe } from '@ngx-translate/core';
import { Subject, takeUntil, finalize } from 'rxjs';
import { ApiService } from '../../core/http/api.service';
import { FileIconComponent } from '../../shared/components/file-icon/file-icon.component';
import type { Document } from '../../shared/models/types';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NgIf, NgFor, RouterLink, ReactiveFormsModule, TranslateModule, TranslatePipe, FileIconComponent],
  template: `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- ═══ Header ═══ -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 class="text-2xl font-bold text-[#0F172A]">{{ 'dashboard.title' | translate }}</h1>
          <p class="text-[#64748B] mt-1 text-sm" *ngIf="docsData">
            {{ docsData.total }} {{ 'dashboard.usage_docs' | translate }}
          </p>
        </div>
        <div class="flex gap-3">
          <button (click)="uploadOpen = true"
                  class="inline-flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] shadow-sm transition-colors cursor-pointer border-0">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            {{ 'dashboard.upload' | translate }}
          </button>
          <button (click)="router.navigate(['/github/import'])"
                  class="inline-flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-medium text-[#475569] border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors cursor-pointer bg-white">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            {{ 'dashboard.import_from_github' | translate }}
          </button>
        </div>
      </div>

      <!-- ═══ Upload Modal ═══ -->
      <div *ngIf="uploadOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" (click)="uploadOpen = false">
        <div class="bg-white rounded-xl shadow-xl w-full max-w-lg p-6" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-[#0F172A]">{{ 'dashboard.upload_title' | translate }}</h2>
            <button (click)="uploadOpen = false" class="w-8 h-8 flex items-center justify-center rounded-lg text-[#94A3B8] hover:bg-[#F1F5F9] cursor-pointer border-0 bg-transparent">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div class="space-y-4">
            <!-- Drop zone -->
            <div [class.border-[#2563EB]]="isDragOver" [class.bg-[#EFF6FF]]="isDragOver"
                 class="border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer border-[#CBD5E1] hover:border-[#2563EB]"
                 (dragover)="$event.preventDefault(); isDragOver = true"
                 (dragleave)="isDragOver = false"
                 (drop)="isDragOver = false; onDrop($event)"
                 (click)="fileInput.click()">
              <input #fileInput type="file" class="hidden" accept=".pdf,.docx,.txt,.md,.html,.pptx,.xlsx,.csv,.png,.jpg"
                     (change)="onFileSelected($event)" />
              <svg class="w-10 h-10 mx-auto mb-3 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p class="text-[#475569] font-medium">{{ isDragOver ? ('dashboard.drop_active' | translate) : ('dashboard.drop_text' | translate) }}</p>
              <p class="text-sm text-[#94A3B8] mt-1">{{ 'dashboard.drop_hint' | translate }}</p>
              <div *ngIf="uploading" class="mt-3">
                <div class="w-full bg-[#E2E8F0] rounded-full h-1.5 overflow-hidden">
                  <div class="h-full bg-[#2563EB] rounded-full animate-pulse w-full"></div>
                </div>
              </div>
            </div>
            <!-- Folder input -->
            <div>
              <label class="block text-sm font-medium text-[#334155] mb-1">{{ 'dashboard.folder_label' | translate }}</label>
              <input type="text" [formControl]="folder"
                     class="w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
                     [placeholder]="'dashboard.folder_placeholder' | translate" />
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ Loading Skeleton ═══ -->
      <div *ngIf="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div *ngFor="let _ of [1,2,3,4,5,6,7,8]" class="bg-white rounded-xl border border-[#E2E8F0] p-5 animate-pulse">
          <div class="h-4 bg-[#F1F5F9] rounded w-3/4 mb-3"></div>
          <div class="h-3 bg-[#F1F5F9] rounded w-1/2 mb-2"></div>
          <div class="h-3 bg-[#F1F5F9] rounded w-1/3"></div>
        </div>
      </div>

      <!-- ═══ Document Grid ═══ -->
      <ng-container *ngIf="!loading">
        <div *ngIf="docsData?.items?.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div *ngFor="let doc of docsData!.items"
               class="group bg-white rounded-xl border border-[#E2E8F0] p-5 hover:shadow-md transition-shadow cursor-pointer"
               (click)="router.navigate(['/documents', doc.id])">
            <div class="flex items-start justify-between mb-3">
              <app-file-icon [format]="doc.input_format" />
              <button (click)="deleteDoc($event, doc)"
                      class="opacity-0 group-hover:opacity-100 text-[#94A3B8] hover:text-red-500 transition-all cursor-pointer p-1 border-0 bg-transparent">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
            <h3 class="font-medium text-[#0F172A] truncate">{{ doc.title }}</h3>
            <p class="text-sm text-[#64748B] mt-1">{{ doc.input_format.toUpperCase() }} · {{ formatBytes(doc.file_size_bytes) }}</p>
            <div class="flex items-center justify-between mt-3">
              <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
                    [class.bg-[#D1FAE5]]="doc.status === 'completed'"
                    [class.text-[#059669]]="doc.status === 'completed'"
                    [class.bg-[#FEF3C7]]="doc.status === 'processing'"
                    [class.text-[#D97706]]="doc.status === 'processing'"
                    [class.bg-[#F1F5F9]]="doc.status !== 'completed' && doc.status !== 'processing'"
                    [class.text-[#64748B]]="doc.status !== 'completed' && doc.status !== 'processing'">
                {{ doc.status }}
              </span>
              <span class="text-xs text-[#94A3B8]">{{ formatDate(doc.created_at) }}</span>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div *ngIf="docsData && docsData.total_pages > 1" class="flex justify-center gap-2 mt-8">
          <button *ngFor="let p of pageNumbers()"
                  [class.bg-[#2563EB]]="page === p"
                  [class.text-white]="page === p"
                  [class.text-[#475569]]="page !== p"
                  [class.hover:bg-[#F1F5F9]]="page !== p"
                  class="w-9 h-9 rounded-lg text-sm font-medium transition-colors cursor-pointer border-0 bg-transparent"
                  (click)="changePage(p)">
            {{ p }}
          </button>
        </div>

        <!-- Empty State -->
        <div *ngIf="!docsData?.items?.length" class="text-center py-16">
          <svg class="w-16 h-16 text-[#CBD5E1] mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <p class="text-[#64748B] text-lg font-medium">{{ 'dashboard.empty_title' | translate }}</p>
          <p class="text-[#94A3B8] mt-1">{{ 'dashboard.empty_desc' | translate }}</p>
          <button (click)="uploadOpen = true"
                  class="inline-flex items-center gap-2 mt-4 h-10 px-4 rounded-lg text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] cursor-pointer border-0">
            {{ 'dashboard.upload' | translate }}
          </button>
        </div>
      </ng-container>
    </div>
  `,
})
export class DashboardComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  readonly router = inject(Router);
  private destroy$ = new Subject<void>();

  docsData: { items: Document[]; total: number; total_pages: number } | null = null;
  page = 1; pageSize = 12; loading = true;
  uploadOpen = false; isDragOver = false; uploading = false;
  folder = new FormControl('');

  ngOnInit(): void { this.loadDocuments(); }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  loadDocuments(): void {
    this.loading = true;
    this.api.list({ page: this.page, page_size: this.pageSize })
      .pipe(takeUntil(this.destroy$), finalize(() => this.loading = false))
      .subscribe({
        next: (res) => { if (res.success && res.data) this.docsData = res.data; },
      });
  }

  changePage(p: number): void { if (p !== this.page) { this.page = p; this.loadDocuments(); } }
  pageNumbers(): number[] { const n = this.docsData?.total_pages || 0; return Array.from({ length: n }, (_, i) => i + 1); }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input?.files?.[0]) { this.uploadFile(input.files[0]); input.value = ''; }
  }
  onDrop(event: DragEvent): void { event.preventDefault(); if (event.dataTransfer?.files?.[0]) this.uploadFile(event.dataTransfer.files[0]); }

  private uploadFile(file: File): void {
    this.uploading = true;
    this.api.upload(file, this.folder.value || undefined)
      .pipe(takeUntil(this.destroy$), finalize(() => this.uploading = false))
      .subscribe({
        next: () => { this.loadDocuments(); this.uploadOpen = false; },
      });
  }

  deleteDoc(event: Event, doc: Document): void {
    event.stopPropagation();
    if (!confirm('Delete "' + doc.title + '"?')) return;
    this.api.delete(doc.id).pipe(takeUntil(this.destroy$)).subscribe({ next: () => this.loadDocuments() });
  }

  formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB']; let i = 0, n = bytes;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return n.toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
  }
  formatDate(s: string | null): string { if (!s) return ''; return new Date(s).toLocaleDateString(); }
}
