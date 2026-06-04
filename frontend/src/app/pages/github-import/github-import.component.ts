import { Component, OnInit, inject } from '@angular/core';
import { NgIf, NgFor, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/http/api.service';
import { AuthService } from '../../core/auth/auth.service';
import type {
  OAuthAccount, GitHubRepo, GitHubContent, GitHubRateLimit, Document,
} from '../../shared/models/types';

@Component({
  selector: 'app-github-import',
  standalone: true,
  imports: [
    NgIf, NgFor, DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatCardModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  template: `
    <div class="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900">{{ 'github.title' | translate }}</h1>
        <a mat-stroked-button routerLink="/dashboard">
          <mat-icon>arrow_back</mat-icon> {{ 'common.back_to_dashboard' | translate }}
        </a>
      </div>

      <!-- Loading account check -->
      <div *ngIf="accountLoading" class="flex items-center justify-center py-12">
        <mat-spinner diameter="32" />
        <span class="ml-3 text-gray-500">{{ 'github.checking_account' | translate }}</span>
      </div>

      <!-- GitHub not linked -->
      <div *ngIf="!accountLoading && !githubLinked"
        class="rounded-lg border border-gray-200 bg-white p-8 text-center space-y-4">
        <mat-icon class="text-5xl text-gray-300">link_off</mat-icon>
        <h2 class="text-xl font-semibold text-gray-700">{{ 'github.not_linked' | translate }}</h2>
        <p class="text-gray-500 max-w-md mx-auto">{{ 'github.not_linked_hint' | translate }}</p>
        <button mat-raised-button color="primary" (click)="linkGitHubAccount()" [disabled]="linking">
          <mat-spinner *ngIf="linking" diameter="18" class="inline-block mr-2" />
          <mat-icon *ngIf="!linking">link</mat-icon>
          {{ 'github.link_account' | translate }}
        </button>
        <p *ngIf="linkError" class="text-sm text-red-600">{{ linkError }}</p>
      </div>

      <!-- Main content (GitHub linked) -->
      <ng-container *ngIf="!accountLoading && githubLinked">
        <!-- Rate limit info -->
        <div *ngIf="rateLimit" class="flex items-center gap-2 text-sm">
          <mat-icon class="text-base"
            [class.text-gray-400]="rateLimit.remaining > 10"
            [class.text-amber-500]="rateLimit.remaining <= 10 && rateLimit.remaining > 0"
            [class.text-red-500]="rateLimit.remaining === 0">speed</mat-icon>
          <span class="text-gray-600">
            {{ 'github.rate_limit' | translate }}: {{ rateLimit.remaining }}/{{ rateLimit.limit }}
          </span>
          <span *ngIf="rateLimit.reset" class="text-gray-400 text-xs">
            ({{ 'github.resets_at' | translate }} {{ (rateLimit.reset * 1000) | date:'shortTime' }})
          </span>
        </div>

        <!-- Search repos -->
        <div class="flex items-center gap-3">
          <mat-form-field appearance="outline" class="flex-1 max-w-md">
            <mat-label>{{ 'github.search_repos' | translate }}</mat-label>
            <input matInput [formControl]="searchControl"
              [placeholder]="'github.search_placeholder' | translate"
              (keyup.enter)="searchRepos()" />
            <button matSuffix mat-icon-button (click)="searchRepos()" [disabled]="searchingRepos">
              <mat-icon>search</mat-icon>
            </button>
          </mat-form-field>
        </div>

        <!-- Repos list -->
        <div *ngIf="reposLoading" class="flex justify-center py-10">
          <mat-spinner diameter="32" />
        </div>

        <div *ngIf="reposError" class="rounded-lg border border-red-300 bg-red-50 p-4 text-center">
          <p class="text-red-700">{{ reposError }}</p>
        </div>

        <div *ngIf="!reposLoading && !reposError && repos.length === 0 && searched"
          class="rounded-lg border border-dashed border-gray-300 p-10 text-center">
          <mat-icon class="text-4xl text-gray-300">folder_off</mat-icon>
          <p class="mt-3 text-gray-500">{{ 'github.no_repos' | translate }}</p>
        </div>

        <div *ngIf="repos.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div *ngFor="let repo of repos" (click)="selectRepo(repo)"
            class="rounded-lg border border-gray-200 bg-white p-4 cursor-pointer
                   hover:border-blue-300 hover:shadow-md transition-all"
            [class.border-blue-500]="selectedRepo?.full_name === repo.full_name"
            [class.shadow-md]="selectedRepo?.full_name === repo.full_name">
            <div class="flex items-start gap-3">
              <mat-icon class="text-gray-400 mt-0.5">{{ repo.private ? 'lock' : 'folder' }}</mat-icon>
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-gray-800 truncate">{{ repo.full_name }}</p>
                <p *ngIf="repo.description" class="text-sm text-gray-500 mt-1 line-clamp-2">
                  {{ repo.description }}
                </p>
                <span class="inline-block mt-2 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                  {{ repo.default_branch }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- File browser (when repo selected) -->
        <ng-container *ngIf="selectedRepo">
          <div class="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <!-- Breadcrumb -->
            <div class="flex items-center gap-1 px-4 py-3 bg-gray-50 border-b border-gray-200 text-sm overflow-x-auto">
              <button (click)="navigatePath('')"
                class="text-blue-600 hover:text-blue-800 whitespace-nowrap">
                {{ selectedRepo.name }}
              </button>
              <ng-container *ngFor="let part of breadcrumbParts; let last = last">
                <mat-icon class="text-gray-400 text-base">chevron_right</mat-icon>
                <button *ngIf="!last" (click)="navigateBreadcrumb(part)"
                  class="text-blue-600 hover:text-blue-800 whitespace-nowrap">
                  {{ part.name }}
                </button>
                <span *ngIf="last" class="text-gray-700 whitespace-nowrap">{{ part.name }}</span>
              </ng-container>
            </div>

            <!-- Loading indicator -->
            <div *ngIf="contentsLoading" class="flex justify-center py-10">
              <mat-spinner diameter="28" />
            </div>

            <!-- Contents error -->
            <div *ngIf="contentsError && !contentsLoading"
              class="p-6 text-red-600 text-center">{{ contentsError }}</div>

            <!-- Contents list -->
            <ng-container *ngIf="!contentsLoading && !contentsError">
              <div *ngIf="contents.length === 0"
                class="p-10 text-center text-gray-400">{{ 'github.empty_directory' | translate }}</div>

              <div *ngFor="let item of contents"
                class="flex items-center justify-between px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                  <mat-icon class="text-gray-400 flex-shrink-0"
                    [class.text-blue-500]="item.type === 'dir'"
                    [class.text-orange-400]="isMarkdown(item) || isText(item)">
                    {{ item.type === 'dir' ? 'folder' : 'insert_drive_file' }}
                  </mat-icon>
                  <div class="min-w-0 flex-1">
                    <button *ngIf="item.type === 'dir'" (click)="navigatePath(item.path)"
                      class="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline text-left truncate block w-full">
                      {{ item.name }}
                    </button>
                    <button *ngIf="item.type === 'file'" (click)="previewFile(item)"
                      class="text-sm font-medium text-gray-700 hover:text-blue-600 text-left truncate block w-full">
                      {{ item.name }}
                    </button>
                  </div>
                </div>
                <div class="flex items-center gap-3 flex-shrink-0">
                  <span class="text-xs text-gray-400">{{ formatFileSize(item.size) }}</span>
                  <button *ngIf="item.type === 'file'" mat-stroked-button color="primary"
                    class="text-xs" (click)="importFile(item); $event.stopPropagation()"
                    [disabled]="importingPath === item.path">
                    <mat-spinner *ngIf="importingPath === item.path" diameter="14" class="inline-block mr-1" />
                    <mat-icon *ngIf="importingPath !== item.path" class="text-sm">file_download</mat-icon>
                    {{ 'github.import' | translate }}
                  </button>
                </div>
              </div>
            </ng-container>
          </div>
        </ng-container>

        <!-- File preview -->
        <div *ngIf="previewingFile" class="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div class="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
            <h3 class="font-semibold text-gray-800 truncate">{{ previewingFile.path }}</h3>
            <div class="flex items-center gap-2 flex-shrink-0">
              <button mat-raised-button color="primary" (click)="importFile(previewingFile)" class="text-sm"
                [disabled]="importingPath === previewingFile.path">
                <mat-spinner *ngIf="importingPath === previewingFile.path" diameter="14" class="inline-block mr-1" />
                <mat-icon *ngIf="importingPath !== previewingFile.path">file_download</mat-icon>
                {{ 'github.import_file' | translate }}
              </button>
              <button mat-icon-button (click)="closePreview()">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          </div>
          <div *ngIf="previewLoading" class="flex justify-center py-10">
            <mat-spinner diameter="28" />
          </div>
          <div *ngIf="previewError" class="p-6 text-red-600 text-center">{{ previewError }}</div>
          <pre *ngIf="!previewLoading && !previewError && filePreview"
            class="p-5 text-sm font-mono text-gray-800 whitespace-pre-wrap overflow-auto max-h-[500px]">{{ filePreview }}</pre>
        </div>

        <!-- Import result -->
        <div *ngIf="importedDoc"
          class="rounded-lg border border-green-300 bg-green-50 p-5 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <mat-icon class="text-green-600">check_circle</mat-icon>
            <div>
              <p class="font-medium text-green-800">{{ 'github.import_success' | translate }}</p>
              <p class="text-sm text-green-600">{{ importedDoc.title }}</p>
            </div>
          </div>
          <a mat-raised-button color="primary" [routerLink]="['/documents', importedDoc.id]">
            {{ 'github.open_document' | translate }}
          </a>
        </div>
      </ng-container>
    </div>
  `,
})
export class GitHubImportComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);

  // Account state
  accountLoading = true;
  githubLinked = false;
  linking = false;
  linkError: string | null = null;

  // Search state
  searchControl = this.fb.control('');
  searched = false;
  repos: GitHubRepo[] = [];
  reposLoading = false;
  reposError: string | null = null;
  searchingRepos = false;

  // Repo/contents browsing
  selectedRepo: GitHubRepo | null = null;
  currentPath = '';
  breadcrumbParts: { name: string; path: string }[] = [];
  contents: GitHubContent[] = [];
  contentsLoading = false;
  contentsError: string | null = null;

  // Preview
  previewingFile: GitHubContent | null = null;
  filePreview: string | null = null;
  previewLoading = false;
  previewError: string | null = null;

  // Import
  importingPath: string | null = null;
  importedDoc: Document | null = null;

  // Rate limit
  rateLimit: GitHubRateLimit | null = null;

  ngOnInit(): void {
    this.checkGitHubAccount();
    this.loadRateLimit();
  }

  // ── Account/API ──
  checkGitHubAccount(): void {
    this.accountLoading = true;
    this.api.getAccounts().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.githubLinked = (res.data || []).some((a: OAuthAccount) => a.provider === 'github');
        }
        this.accountLoading = false;
      },
      error: () => {
        this.githubLinked = false;
        this.accountLoading = false;
      },
    });
  }

  loadRateLimit(): void {
    this.api.rateLimit().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.rateLimit = res.data;
        }
      },
      error: () => { /* silently ignore */ },
    });
  }

  linkGitHubAccount(): void {
    this.linking = true;
    this.linkError = null;
    this.api.getAuthorizationUrl().subscribe({
      next: (res) => {
        if (res.success && res.data?.url) {
          window.location.href = res.data.url;
        } else {
          this.linkError = res.message || 'Failed to get authorization URL';
          this.linking = false;
        }
      },
      error: (err) => {
        this.linkError = err?.error?.message || 'Failed to initiate GitHub link';
        this.linking = false;
      },
    });
  }

  // ── Repo search ──
  searchRepos(): void {
    const search = this.searchControl.value?.trim() || '';
    this.reposLoading = true;
    this.reposError = null;
    this.searched = true;
    this.searchingRepos = true;
    this.api.listRepos({ search }).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.repos = res.data;
        } else {
          this.reposError = res.message || 'Failed to list repos';
          this.repos = [];
        }
        this.reposLoading = false;
        this.searchingRepos = false;
      },
      error: (err) => {
        this.reposError = err?.error?.message || 'Failed to list repos';
        this.repos = [];
        this.reposLoading = false;
        this.searchingRepos = false;
      },
    });
  }

  // ── Repo selection & browsing ──
  selectRepo(repo: GitHubRepo): void {
    this.selectedRepo = repo;
    this.currentPath = '';
    this.breadcrumbParts = [];
    this.contents = [];
    this.previewingFile = null;
    this.filePreview = null;
    this.loadContents();
  }

  navigatePath(path: string): void {
    this.currentPath = path;
    this.buildBreadcrumbs();
    this.contentsError = null;
    this.previewingFile = null;
    this.filePreview = null;
    this.loadContents();
  }

  navigateBreadcrumb(part: { name: string; path: string }): void {
    this.currentPath = part.path;
    this.buildBreadcrumbs();
    this.contentsError = null;
    this.previewingFile = null;
    this.filePreview = null;
    this.loadContents();
  }

  private buildBreadcrumbs(): void {
    if (!this.currentPath) {
      this.breadcrumbParts = [];
      return;
    }
    const segments = this.currentPath.split('/');
    this.breadcrumbParts = segments.map((name, i) => ({
      name,
      path: segments.slice(0, i + 1).join('/'),
    }));
  }

  loadContents(): void {
    if (!this.selectedRepo) return;
    this.contentsLoading = true;
    const owner = this.getOwner();
    const repo = this.selectedRepo.name;
    const req = this.currentPath
      ? this.api.getContents(owner, repo, this.currentPath)
      : this.api.getContents(owner, repo);
    req.subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const items: GitHubContent[] = res.data;
          this.contents = items.sort((a: GitHubContent, b: GitHubContent) => {
            if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
            return a.name.localeCompare(b.name);
          });
        } else {
          this.contentsError = res.message || 'Failed to load contents';
          this.contents = [];
        }
        this.contentsLoading = false;
      },
      error: (err) => {
        this.contentsError = err?.error?.message || 'Failed to load contents';
        this.contents = [];
        this.contentsLoading = false;
      },
    });
  }

  // ── File preview ──
  previewFile(item: GitHubContent): void {
    if (!this.selectedRepo || item.type !== 'file') return;
    this.previewingFile = item;
    this.filePreview = null;
    this.previewLoading = true;
    this.previewError = null;
    this.api.getFile(this.getOwner(), this.selectedRepo.name, item.path).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          // Limit preview to ~10k chars
          this.filePreview = res.data.content.length > 10000
            ? res.data.content.slice(0, 10000) + '\n\n... (truncated)'
            : res.data.content;
        } else {
          this.previewError = res.message || 'Failed to load file';
        }
        this.previewLoading = false;
      },
      error: (err) => {
        this.previewError = err?.error?.message || 'Failed to load file';
        this.previewLoading = false;
      },
    });
  }

  closePreview(): void {
    this.previewingFile = null;
    this.filePreview = null;
    this.previewError = null;
  }

  // ── Import ──
  importFile(item: GitHubContent): void {
    if (!this.selectedRepo || this.importingPath) return;
    this.importingPath = item.path;
    this.importedDoc = null;
    this.api.importFile(this.selectedRepo.full_name, item.path).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.importedDoc = res.data;
        } else {
          this.reposError = res.message || 'Failed to import file';
        }
        this.importingPath = null;
      },
      error: (err) => {
        this.reposError = err?.error?.message || 'Failed to import file';
        this.importingPath = null;
      },
    });
  }

  // ── Helpers ──
  private getOwner(): string {
    return this.selectedRepo?.full_name?.split('/')[0] || '';
  }

  formatFileSize(bytes: number): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let n = bytes;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  isMarkdown(item: GitHubContent): boolean {
    return item.type === 'file' && item.name.endsWith('.md');
  }

  isText(item: GitHubContent): boolean {
    const textExts = ['.txt', '.json', '.yaml', '.yml', '.xml', '.csv', '.tsv', '.html', '.css', '.js', '.ts', '.py', '.java', '.rst'];
    return item.type === 'file' && textExts.some((ext) => item.name.endsWith(ext));
  }
}
