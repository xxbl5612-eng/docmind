import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { NgIf, NgFor, NgSwitch, NgSwitchCase } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription, interval } from 'rxjs';
import { ApiService } from '../../core/http/api.service';
import type {
  Document, DocumentContent, TaskStatus, AsyncTaskResponse,
  ProofreadRequest, RewriteRequest, SummarizeRequest,
  ExtractRequest, ConvertRequest,
} from '../../shared/models/types';

type ActiveTab = 'content' | 'ai' | 'versions' | 'collaboration';

@Component({
  selector: 'app-document-editor',
  standalone: true,
  imports: [
    NgIf, NgFor, NgSwitch, NgSwitchCase,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    TranslateModule,
  ],
  template: `
    <div class="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <!-- Loading state -->
      <ng-container *ngIf="loading; else loaded">
        <div class="flex items-center justify-center py-20">
          <mat-spinner diameter="40" />
        </div>
      </ng-container>

      <ng-template #loaded>
        <!-- Error state -->
        <div *ngIf="error" class="rounded-lg border border-red-300 bg-red-50 p-6 text-center">
          <p class="text-red-700 font-medium">{{ error }}</p>
          <button mat-raised-button color="primary" class="mt-4" routerLink="/dashboard">
            {{ 'common.back_to_dashboard' | translate }}
          </button>
        </div>

        <!-- Main content -->
        <ng-container *ngIf="!error && document">
          <!-- Header -->
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="space-y-1">
              <h1 class="text-2xl font-bold text-gray-900">{{ document.title }}</h1>
              <div class="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                <span class="inline-flex items-center gap-1">
                  <mat-icon class="text-base leading-none">description</mat-icon>
                  {{ document.input_format }}
                </span>
                <span>{{ formatSize(document.file_size_bytes) }}</span>
                <span class="px-2 py-0.5 rounded-full text-xs font-medium"
                  [class.bg-green-100]="document.status === 'completed'"
                  [class.text-green-700]="document.status === 'completed'"
                  [class.bg-yellow-100]="document.status === 'processing'"
                  [class.text-yellow-700]="document.status === 'processing'"
                  [class.bg-red-100]="document.status === 'failed'"
                  [class.text-red-700]="document.status === 'failed'"
                  [class.bg-gray-100]="document.status !== 'completed' && document.status !== 'processing' && document.status !== 'failed'"
                  [class.text-gray-600]="document.status !== 'completed' && document.status !== 'processing' && document.status !== 'failed'">
                  {{ document.status }}
                </span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <!-- Export menu -->
              <button mat-stroked-button [matMenuTriggerFor]="exportMenu">
                <mat-icon>file_download</mat-icon> {{ 'document.export' | translate }}
              </button>
              <mat-menu #exportMenu="matMenu">
                <button mat-menu-item (click)="exportDocument('txt')">
                  <mat-icon>text_snippet</mat-icon> TXT
                </button>
                <button mat-menu-item (click)="exportDocument('md')">
                  <mat-icon>article</mat-icon> Markdown
                </button>
                <button mat-menu-item (click)="exportDocument('docx')">
                  <mat-icon>description</mat-icon> DOCX
                </button>
                <button mat-menu-item (click)="exportDocument('pdf')">
                  <mat-icon>picture_as_pdf</mat-icon> PDF
                </button>
                <button mat-menu-item (click)="exportDocument('html')">
                  <mat-icon>code</mat-icon> HTML
                </button>
              </mat-menu>

              <!-- Save button -->
              <button mat-raised-button color="primary"
                (click)="saveContent()"
                [disabled]="saving || contentForm.pristine">
                <mat-spinner *ngIf="saving" diameter="18" class="inline-block mr-1" />
                <mat-icon *ngIf="!saving">save</mat-icon>
                {{ 'document.save' | translate }}
              </button>

              <!-- Back -->
              <a mat-icon-button routerLink="/dashboard" [attr.aria-label]="'common.back' | translate">
                <mat-icon>arrow_back</mat-icon>
              </a>
            </div>
          </div>

          <!-- Tab bar -->
          <nav class="flex border-b border-gray-200 gap-0">
            <button *ngFor="let tab of tabs" (click)="activeTab = tab.id"
              class="px-5 py-3 text-sm font-medium border-b-2 transition-colors"
              [class.border-blue-600]="activeTab === tab.id"
              [class.text-blue-600]="activeTab === tab.id"
              [class.border-transparent]="activeTab !== tab.id"
              [class.text-gray-500]="activeTab !== tab.id"
              [class.hover:text-gray-700]="activeTab !== tab.id">
              {{ tab.label | translate }}
            </button>
          </nav>

          <!-- Tab: Content -->
          <div *ngIf="activeTab === 'content'">
            <div *ngIf="contentLoading" class="flex justify-center py-10">
              <mat-spinner diameter="32" />
            </div>
            <div *ngIf="contentError" class="text-red-600 text-center py-6">{{ contentError }}</div>
            <form *ngIf="!contentLoading && !contentError" [formGroup]="contentForm" class="space-y-4">
              <textarea formControlName="content"
                class="w-full min-h-[320px] rounded-lg border border-gray-300 p-4 text-sm font-mono
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       bg-white text-gray-900 resize-y"
                [placeholder]="'document.content_placeholder' | translate"></textarea>
              <div class="text-xs text-gray-400">
                {{ contentForm.get('content')?.value?.length || 0 }} {{ 'document.characters' | translate }}
              </div>
            </form>
          </div>

          <!-- Tab: AI Tools -->
          <div *ngIf="activeTab === 'ai'" class="space-y-6">
            <!-- AI tool buttons -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button *ngFor="let tool of aiTools" (click)="selectAiTool(tool)"
                class="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200
                       hover:border-blue-300 hover:bg-blue-50 transition-colors text-center"
                [class.border-blue-500]="selectedAiTool === tool.id"
                [class.bg-blue-50]="selectedAiTool === tool.id">
                <mat-icon class="text-2xl text-blue-600">{{ tool.icon }}</mat-icon>
                <span class="text-sm font-medium text-gray-700">{{ tool.label | translate }}</span>
              </button>
            </div>

            <!-- AI Tool forms -->
            <div *ngIf="selectedAiTool" class="rounded-lg border border-gray-200 bg-gray-50 p-5 space-y-4">
              <h3 class="text-lg font-semibold text-gray-800">{{ getSelectedAiToolLabel() | translate }}</h3>

              <ng-container [ngSwitch]="selectedAiTool">
                <!-- Proofread -->
                <form *ngSwitchCase="'proofread'" [formGroup]="proofreadForm"
                  (ngSubmit)="runProofread()" class="space-y-3">
                  <div class="grid grid-cols-2 gap-3">
                    <label class="block text-sm text-gray-600">
                      {{ 'ai.language' | translate }}
                      <select formControlName="language"
                        class="mt-1 block w-full rounded border border-gray-300 bg-white p-2 text-sm">
                        <option value="zh">中文</option>
                        <option value="en">English</option>
                        <option value="auto">Auto</option>
                      </select>
                    </label>
                    <label class="block text-sm text-gray-600">
                      {{ 'ai.style_guide' | translate }}
                      <select formControlName="style_guide"
                        class="mt-1 block w-full rounded border border-gray-300 bg-white p-2 text-sm">
                        <option value="academic">{{ 'ai.academic' | translate }}</option>
                        <option value="business">{{ 'ai.business' | translate }}</option>
                        <option value="casual">{{ 'ai.casual' | translate }}</option>
                      </select>
                    </label>
                  </div>
                  <div class="flex gap-4">
                    <label class="flex items-center gap-2 text-sm text-gray-600">
                      <input type="checkbox" formControlName="check_grammar" checked />
                      {{ 'ai.check_grammar' | translate }}
                    </label>
                    <label class="flex items-center gap-2 text-sm text-gray-600">
                      <input type="checkbox" formControlName="check_spelling" checked />
                      {{ 'ai.check_spelling' | translate }}
                    </label>
                    <label class="flex items-center gap-2 text-sm text-gray-600">
                      <input type="checkbox" formControlName="check_style" />
                      {{ 'ai.check_style' | translate }}
                    </label>
                  </div>
                  <button mat-raised-button color="primary" type="submit" [disabled]="aiRunning">
                    <mat-spinner *ngIf="aiRunning" diameter="18" class="inline-block mr-1" />
                    {{ 'ai.run' | translate }}
                  </button>
                </form>

                <!-- Rewrite -->
                <form *ngSwitchCase="'rewrite'" [formGroup]="rewriteForm"
                  (ngSubmit)="runRewrite()" class="space-y-3">
                  <div class="grid grid-cols-2 gap-3">
                    <label class="block text-sm text-gray-600">
                      {{ 'ai.tone' | translate }}
                      <select formControlName="tone"
                        class="mt-1 block w-full rounded border border-gray-300 bg-white p-2 text-sm">
                        <option value="professional">{{ 'ai.professional' | translate }}</option>
                        <option value="friendly">{{ 'ai.friendly' | translate }}</option>
                        <option value="concise">{{ 'ai.concise' | translate }}</option>
                        <option value="creative">{{ 'ai.creative' | translate }}</option>
                      </select>
                    </label>
                    <label class="block text-sm text-gray-600">
                      {{ 'ai.audience' | translate }}
                      <select formControlName="audience"
                        class="mt-1 block w-full rounded border border-gray-300 bg-white p-2 text-sm">
                        <option value="general">{{ 'ai.general' | translate }}</option>
                        <option value="expert">{{ 'ai.expert' | translate }}</option>
                        <option value="beginner">{{ 'ai.beginner' | translate }}</option>
                      </select>
                    </label>
                  </div>
                  <label class="block text-sm text-gray-600">
                    {{ 'ai.length' | translate }}
                    <select formControlName="length"
                      class="mt-1 block w-full rounded border border-gray-300 bg-white p-2 text-sm">
                      <option value="same">{{ 'ai.same_length' | translate }}</option>
                      <option value="shorter">{{ 'ai.shorter' | translate }}</option>
                      <option value="longer">{{ 'ai.longer' | translate }}</option>
                    </select>
                  </label>
                  <label class="block text-sm text-gray-600">
                    {{ 'ai.instructions' | translate }}
                    <input type="text" formControlName="instructions"
                      class="mt-1 block w-full rounded border border-gray-300 bg-white p-2 text-sm"
                      [placeholder]="'ai.instructions_placeholder' | translate" />
                  </label>
                  <button mat-raised-button color="primary" type="submit" [disabled]="aiRunning">
                    <mat-spinner *ngIf="aiRunning" diameter="18" class="inline-block mr-1" />
                    {{ 'ai.run' | translate }}
                  </button>
                </form>

                <!-- Summarize -->
                <form *ngSwitchCase="'summarize'" [formGroup]="summarizeForm"
                  (ngSubmit)="runSummarize()" class="space-y-3">
                  <label class="block text-sm text-gray-600">
                    {{ 'ai.summary_length' | translate }}
                    <select formControlName="length"
                      class="mt-1 block w-full rounded border border-gray-300 bg-white p-2 text-sm">
                      <option value="short">{{ 'ai.short' | translate }}</option>
                      <option value="medium">{{ 'ai.medium' | translate }}</option>
                      <option value="detailed">{{ 'ai.detailed' | translate }}</option>
                    </select>
                  </label>
                  <label class="block text-sm text-gray-600">
                    {{ 'ai.summary_format' | translate }}
                    <select formControlName="format"
                      class="mt-1 block w-full rounded border border-gray-300 bg-white p-2 text-sm">
                      <option value="paragraphs">{{ 'ai.paragraphs' | translate }}</option>
                      <option value="bullet_points">{{ 'ai.bullet_points' | translate }}</option>
                      <option value="numbered_list">{{ 'ai.numbered_list' | translate }}</option>
                    </select>
                  </label>
                  <button mat-raised-button color="primary" type="submit" [disabled]="aiRunning">
                    <mat-spinner *ngIf="aiRunning" diameter="18" class="inline-block mr-1" />
                    {{ 'ai.run' | translate }}
                  </button>
                </form>

                <!-- Extract -->
                <form *ngSwitchCase="'extract'" [formGroup]="extractForm"
                  (ngSubmit)="runExtract()" class="space-y-3">
                  <label class="block text-sm text-gray-600">
                    {{ 'ai.extract_type' | translate }}
                    <select formControlName="extract_type"
                      class="mt-1 block w-full rounded border border-gray-300 bg-white p-2 text-sm">
                      <option value="entities">{{ 'ai.entities' | translate }}</option>
                      <option value="keywords">{{ 'ai.keywords' | translate }}</option>
                      <option value="tables">{{ 'ai.tables' | translate }}</option>
                      <option value="dates">{{ 'ai.dates' | translate }}</option>
                      <option value="contacts">{{ 'ai.contacts' | translate }}</option>
                      <option value="custom">{{ 'ai.custom' | translate }}</option>
                    </select>
                  </label>
                  <button mat-raised-button color="primary" type="submit" [disabled]="aiRunning">
                    <mat-spinner *ngIf="aiRunning" diameter="18" class="inline-block mr-1" />
                    {{ 'ai.run' | translate }}
                  </button>
                </form>

                <!-- Convert -->
                <form *ngSwitchCase="'convert'" [formGroup]="convertForm"
                  (ngSubmit)="runConvert()" class="space-y-3">
                  <label class="block text-sm text-gray-600">
                    {{ 'ai.target_format' | translate }}
                    <select formControlName="target_format"
                      class="mt-1 block w-full rounded border border-gray-300 bg-white p-2 text-sm">
                      <option value="markdown">Markdown</option>
                      <option value="html">HTML</option>
                      <option value="json">JSON</option>
                      <option value="csv">CSV</option>
                    </select>
                  </label>
                  <label class="flex items-center gap-2 text-sm text-gray-600">
                    <input type="checkbox" formControlName="preserve_structure" checked />
                    {{ 'ai.preserve_structure' | translate }}
                  </label>
                  <button mat-raised-button color="primary" type="submit" [disabled]="aiRunning">
                    <mat-spinner *ngIf="aiRunning" diameter="18" class="inline-block mr-1" />
                    {{ 'ai.run' | translate }}
                  </button>
                </form>
              </ng-container>

              <!-- AI result / task status -->
              <div *ngIf="aiTaskStatus" class="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm font-medium text-blue-800">
                      {{ 'ai.task_status' | translate }}: {{ aiTaskStatus.status }}
                    </p>
                    <p *ngIf="aiTaskStatus.progress_pct > 0" class="text-xs text-blue-600 mt-1">
                      {{ aiTaskStatus.progress_pct }}% {{ 'ai.complete' | translate }}
                    </p>
                    <p *ngIf="aiTaskStatus.error_message" class="text-xs text-red-600 mt-1">
                      {{ aiTaskStatus.error_message }}
                    </p>
                  </div>
                  <mat-spinner *ngIf="aiTaskStatus.status === 'pending' || aiTaskStatus.status === 'processing'"
                    diameter="20" />
                  <mat-icon *ngIf="aiTaskStatus.status === 'completed'" class="text-green-600">check_circle</mat-icon>
                  <mat-icon *ngIf="aiTaskStatus.status === 'failed'" class="text-red-600">error</mat-icon>
                </div>
              </div>

              <div *ngIf="aiError" class="text-sm text-red-600 bg-red-50 rounded-lg p-3">
                {{ aiError }}
              </div>
            </div>
          </div>

          <!-- Tab: Versions -->
          <div *ngIf="activeTab === 'versions'" class="text-center py-10">
            <p class="text-gray-500 mb-4">{{ 'document.view_versions' | translate }}</p>
            <a mat-stroked-button color="primary" [routerLink]="['/documents', docId, 'versions']">
              <mat-icon>history</mat-icon> {{ 'document.open_version_history' | translate }}
            </a>
          </div>

          <!-- Tab: Collaboration -->
          <div *ngIf="activeTab === 'collaboration'" class="text-center py-10">
            <p class="text-gray-500 mb-4">{{ 'document.manage_collaboration' | translate }}</p>
            <a mat-stroked-button color="primary" [routerLink]="['/documents', docId, 'collaboration']">
              <mat-icon>group</mat-icon> {{ 'document.open_collaboration' | translate }}
            </a>
          </div>
        </ng-container>
      </ng-template>
    </div>
  `,
})
export class DocumentEditorComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  // Core state
  docId!: string;
  document: Document | null = null;
  loading = true;
  error: string | null = null;
  saving = false;

  // Content state
  contentLoading = false;
  contentError: string | null = null;
  contentForm: FormGroup = this.fb.group({ content: [''] });

  // Tab state
  activeTab: ActiveTab = 'content';
  tabs: { id: ActiveTab; label: string }[] = [
    { id: 'content', label: 'document.tab_content' },
    { id: 'ai', label: 'document.tab_ai_tools' },
    { id: 'versions', label: 'document.tab_versions' },
    { id: 'collaboration', label: 'document.tab_collaboration' },
  ];

  // AI state
  selectedAiTool: string | null = null;
  aiRunning = false;
  aiError: string | null = null;
  aiTaskStatus: TaskStatus | null = null;
  private pollingSub: Subscription | null = null;

  aiTools = [
    { id: 'proofread', icon: 'spellcheck', label: 'ai.proofread' },
    { id: 'rewrite', icon: 'auto_fix_high', label: 'ai.rewrite' },
    { id: 'summarize', icon: 'summarize', label: 'ai.summarize' },
    { id: 'extract', icon: 'data_exploration', label: 'ai.extract' },
    { id: 'convert', icon: 'transform', label: 'ai.convert' },
  ];

  // AI forms
  proofreadForm: FormGroup = this.fb.group({
    language: ['auto'],
    style_guide: ['business'],
    check_grammar: [true],
    check_spelling: [true],
    check_style: [false],
  });
  rewriteForm: FormGroup = this.fb.group({
    tone: ['professional'],
    audience: ['general'],
    length: ['same'],
    instructions: [''],
  });
  summarizeForm: FormGroup = this.fb.group({
    length: ['medium'],
    format: ['paragraphs'],
    focus: [''],
  });
  extractForm: FormGroup = this.fb.group({
    extract_type: ['entities'],
    language: ['zh'],
  });
  convertForm: FormGroup = this.fb.group({
    target_format: ['markdown'],
    preserve_structure: [true],
  });

  ngOnInit(): void {
    this.docId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.docId) {
      this.error = 'No document ID provided';
      this.loading = false;
      return;
    }
    this.loadDocument();
  }

  ngOnDestroy(): void {
    this.pollingSub?.unsubscribe();
  }

  // ── Load document ──
  private loadDocument(): void {
    this.loading = true;
    this.api.get(this.docId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.document = res.data;
        } else {
          this.error = res.message || 'Failed to load document';
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to load document';
        this.loading = false;
      },
    });
  }

  loadContent(): void {
    this.contentLoading = true;
    this.contentError = null;
    this.api.getContent(this.docId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.contentForm.patchValue({ content: res.data.content }, { emitEvent: false });
        } else {
          this.contentError = res.message || 'Failed to load content';
        }
        this.contentLoading = false;
      },
      error: (err) => {
        this.contentError = err?.error?.message || 'Failed to load content';
        this.contentLoading = false;
      },
    });
  }

  // ── Save content ──
  saveContent(): void {
    if (this.contentForm.invalid || this.saving) return;
    this.saving = true;
    const content = this.contentForm.get('content')?.value || '';
    this.api.updateContent(this.docId, content, 'Manual edit').subscribe({
      next: (res) => {
        if (!res.success) {
          this.contentError = res.message || 'Failed to save';
        }
        this.saving = false;
      },
      error: (err) => {
        this.contentError = err?.error?.message || 'Failed to save';
        this.saving = false;
      },
    });
  }

  // ── Export ──
  exportDocument(format: string): void {
    this.api.export(this.docId, format).subscribe({
      next: (res) => {
        if (res.success && res.data?.url) {
          window.open(res.data.url, '_blank');
        }
      },
      error: (err) => console.error('Export failed:', err),
    });
  }

  // ── AI Tools ──
  selectAiTool(tool: { id: string; label: string }): void {
    this.selectedAiTool = this.selectedAiTool === tool.id ? null : tool.id;
    this.aiError = null;
    this.aiTaskStatus = null;
  }

  getSelectedAiToolLabel(): string {
    const tool = this.aiTools.find((t) => t.id === this.selectedAiTool);
    return tool?.label || '';
  }

  private pollTask(taskId: string): void {
    this.pollingSub?.unsubscribe();
    this.pollingSub = interval(2000).subscribe(() => {
      this.api.taskStatus(this.docId, taskId).subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.aiTaskStatus = res.data;
            this.aiRunning = res.data.status === 'pending' || res.data.status === 'processing';
            if (!this.aiRunning) {
              this.pollingSub?.unsubscribe();
              this.loadContent(); // reload content after AI processing
            }
          }
        },
        error: () => {
          this.aiError = 'Failed to check task status';
          this.pollingSub?.unsubscribe();
          this.aiRunning = false;
        },
      });
    });
  }

  private handleAiResponse(res: { success: boolean; data: AsyncTaskResponse | null; message: string | null }): void {
    if (res.success && res.data) {
      this.aiRunning = true;
      this.aiError = null;
      this.aiTaskStatus = { task_id: res.data.task_id, status: res.data.status, job_type: '', progress_pct: 0,
        chunks_total: null, chunks_completed: null, tokens_used: null, error_message: null,
        result_summary: null, created_at: '', started_at: null, completed_at: null };
      this.pollTask(res.data.task_id);
    } else {
      this.aiError = res.message || 'AI request failed';
    }
  }

  runProofread(): void {
    const data: Record<string, unknown> = this.proofreadForm.value;
    this.aiRunning = true;
    this.aiError = null;
    this.api.proofread(this.docId, data).subscribe({
      next: (r) => this.handleAiResponse(r),
      error: (err) => {
        this.aiError = err?.error?.message || 'Proofread request failed';
        this.aiRunning = false;
      },
    });
  }

  runRewrite(): void {
    const data: Record<string, unknown> = this.rewriteForm.value;
    this.aiRunning = true;
    this.aiError = null;
    this.api.rewrite(this.docId, data).subscribe({
      next: (r) => this.handleAiResponse(r),
      error: (err) => {
        this.aiError = err?.error?.message || 'Rewrite request failed';
        this.aiRunning = false;
      },
    });
  }

  runSummarize(): void {
    const data: Record<string, unknown> = this.summarizeForm.value;
    this.aiRunning = true;
    this.aiError = null;
    this.api.summarize(this.docId, data).subscribe({
      next: (r) => this.handleAiResponse(r),
      error: (err) => {
        this.aiError = err?.error?.message || 'Summarize request failed';
        this.aiRunning = false;
      },
    });
  }

  runExtract(): void {
    const data: Record<string, unknown> = this.extractForm.value;
    this.aiRunning = true;
    this.aiError = null;
    this.api.extract(this.docId, data).subscribe({
      next: (r) => this.handleAiResponse(r),
      error: (err) => {
        this.aiError = err?.error?.message || 'Extract request failed';
        this.aiRunning = false;
      },
    });
  }

  runConvert(): void {
    const data: Record<string, unknown> = this.convertForm.value;
    this.aiRunning = true;
    this.aiError = null;
    this.api.convert(this.docId, data).subscribe({
      next: (r) => this.handleAiResponse(r),
      error: (err) => {
        this.aiError = err?.error?.message || 'Convert request failed';
        this.aiRunning = false;
      },
    });
  }

  // ── Helpers ──
  formatSize(bytes: number): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let n = bytes;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }
}
