import { Component, OnInit, inject } from '@angular/core';
import { NgIf, NgFor, DatePipe, UpperCasePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/http/api.service';
import type { CollaborationSession, Collaborator } from '../../shared/models/types';

@Component({
  selector: 'app-collaboration',
  standalone: true,
  imports: [
    NgIf, NgFor, DatePipe, UpperCasePipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatCardModule,
    MatSelectModule,
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
          <h1 class="text-2xl font-bold text-gray-900">{{ 'collaboration.title' | translate }}</h1>
        </div>
        <button mat-raised-button color="primary" (click)="toggleCreateForm()">
          <mat-icon>{{ showCreateForm ? 'close' : 'add' }}</mat-icon>
          {{ (showCreateForm ? 'common.cancel' : 'collaboration.create_session') | translate }}
        </button>
      </div>

      <!-- Loading -->
      <div *ngIf="loading" class="flex items-center justify-center py-20">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span class="ml-3 text-gray-500">{{ 'common.loading' | translate }}</span>
      </div>

      <!-- Error -->
      <div *ngIf="error && !loading" class="rounded-lg border border-red-300 bg-red-50 p-6 text-center">
        <p class="text-red-700 font-medium">{{ error }}</p>
        <button mat-raised-button color="primary" class="mt-4" (click)="loadSessions()">
          {{ 'common.retry' | translate }}
        </button>
      </div>

      <!-- Create session form -->
      <div *ngIf="showCreateForm"
        class="rounded-lg border border-gray-200 bg-gray-50 p-5 space-y-4">
        <h3 class="text-lg font-semibold text-gray-800">{{ 'collaboration.new_session' | translate }}</h3>
        <form [formGroup]="createForm" (ngSubmit)="createSession()" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>{{ 'collaboration.max_collaborators' | translate }}</mat-label>
              <input matInput type="number" formControlName="max_collaborators" min="1" max="50" />
            </mat-form-field>
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>{{ 'collaboration.expires_in_hours' | translate }}</mat-label>
              <input matInput type="number" formControlName="expires_in_hours" min="1" max="720" />
            </mat-form-field>
          </div>
          <div class="flex items-center gap-3">
            <button mat-raised-button color="primary" type="submit" [disabled]="creating || createForm.invalid">
              <div *ngIf="creating" class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
              {{ 'collaboration.create' | translate }}
            </button>
            <button mat-button type="button" (click)="showCreateForm = false">
              {{ 'common.cancel' | translate }}
            </button>
          </div>
        </form>
      </div>

      <!-- Sessions list -->
      <ng-container *ngIf="!loading && !error">
        <!-- Empty state -->
        <div *ngIf="sessions.length === 0"
          class="rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <mat-icon class="text-4xl text-gray-300">group_off</mat-icon>
          <p class="mt-3 text-gray-500">{{ 'collaboration.no_sessions' | translate }}</p>
          <p class="text-sm text-gray-400 mt-1">{{ 'collaboration.no_sessions_hint' | translate }}</p>
        </div>

        <!-- Session cards -->
        <div *ngFor="let session of sessions" class="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <!-- Session header -->
          <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-gray-50 border-b border-gray-200">
            <div class="space-y-1">
              <div class="flex items-center gap-2 text-sm text-gray-500">
                <span class="font-mono text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                  {{ session.id.slice(0, 8) }}...
                </span>
                <span class="px-2 py-0.5 rounded-full text-xs font-medium"
                  [class.bg-green-100]="session.status === 'active'"
                  [class.text-green-700]="session.status === 'active'"
                  [class.bg-gray-100]="session.status !== 'active'"
                  [class.text-gray-600]="session.status !== 'active'">
                  {{ session.status }}
                </span>
              </div>
              <p *ngIf="session.expires_at" class="text-xs text-gray-400">
                {{ 'collaboration.expires' | translate }}: {{ session.expires_at | date:'medium' }}
              </p>
            </div>
            <button mat-stroked-button color="warn" (click)="deleteSession(session.id)" class="text-sm"
              [disabled]="deletingId === session.id">
              <mat-icon class="text-lg">delete</mat-icon>
              {{ 'collaboration.delete_session' | translate }}
            </button>
          </div>

          <!-- Collaborators -->
          <div class="p-5 space-y-3">
            <h4 class="text-sm font-semibold text-gray-600">
              {{ 'collaboration.collaborators' | translate }} ({{ session.collaborators.length || 0 }})
            </h4>

            <div *ngIf="session.collaborators.length; else noCollaborators"
              class="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
              <div *ngFor="let c of session.collaborators"
                class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                    [style.backgroundColor]="c.cursor_color || '#6b7280'">
                    {{ (c.display_name || c.user_id)[0] | uppercase }}
                  </div>
                  <div>
                    <p class="text-sm font-medium text-gray-800">{{ c.display_name || c.user_id }}</p>
                    <p class="text-xs text-gray-400">{{ c.user_id }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <select [value]="c.permission"
                    (change)="updatePermission(session.id, c.user_id, $any($event.target).value)"
                    class="text-xs rounded border border-gray-300 bg-white px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="view">{{ 'collaboration.permission_view' | translate }}</option>
                    <option value="comment">{{ 'collaboration.permission_comment' | translate }}</option>
                    <option value="edit">{{ 'collaboration.permission_edit' | translate }}</option>
                  </select>
                  <button mat-icon-button color="warn" (click)="removeUser(session.id, c.user_id)"
                    class="!w-7 !h-7" [attr.aria-label]="'collaboration.remove_user' | translate">
                    <mat-icon class="text-base">person_remove</mat-icon>
                  </button>
                </div>
              </div>
            </div>
            <ng-template #noCollaborators>
              <p class="text-sm text-gray-400 py-3">{{ 'collaboration.no_collaborators' | translate }}</p>
            </ng-template>

            <!-- Invite form -->
            <div class="border-t border-gray-100 pt-4">
              <h5 class="text-sm font-semibold text-gray-600 mb-3">{{ 'collaboration.invite' | translate }}</h5>
              <form [formGroup]="getInviteForm(session.id)"
                (ngSubmit)="inviteUser(session.id)" class="flex flex-wrap items-start gap-3">
                <mat-form-field appearance="outline" class="flex-1 min-w-[200px]">
                  <mat-label>{{ 'collaboration.email' | translate }}</mat-label>
                  <input matInput type="email" formControlName="email"
                    [placeholder]="'collaboration.email_placeholder' | translate" />
                </mat-form-field>
                <mat-form-field appearance="outline" class="w-32">
                  <mat-label>{{ 'collaboration.permission' | translate }}</mat-label>
                  <mat-select formControlName="permission">
                    <mat-option value="view">{{ 'collaboration.permission_view' | translate }}</mat-option>
                    <mat-option value="comment">{{ 'collaboration.permission_comment' | translate }}</mat-option>
                    <mat-option value="edit">{{ 'collaboration.permission_edit' | translate }}</mat-option>
                  </mat-select>
                </mat-form-field>
                <button mat-raised-button color="primary" type="submit"
                  [disabled]="getInviteForm(session.id).invalid || inviting[session.id]">
                  <mat-icon>send</mat-icon>
                  {{ 'collaboration.send_invite' | translate }}
                </button>
              </form>
              <p *ngIf="inviteErrors[session.id]" class="text-sm text-red-600 mt-2">{{ inviteErrors[session.id] }}</p>
            </div>
          </div>
        </div>
      </ng-container>
    </div>
  `,
})
export class CollaborationComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);

  docId!: string;
  sessions: CollaborationSession[] = [];
  loading = true;
  error: string | null = null;

  // Create session
  showCreateForm = false;
  creating = false;
  createForm: FormGroup = this.fb.group({
    max_collaborators: [10],
    expires_in_hours: [24],
  });

  // Delete
  deletingId: string | null = null;

  // Invite state (per session)
  inviteForms: Record<string, FormGroup> = {};
  inviting: Record<string, boolean> = {};
  inviteErrors: Record<string, string> = {};

  ngOnInit(): void {
    this.docId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.docId) {
      this.error = 'No document ID provided';
      this.loading = false;
      return;
    }
    this.loadSessions();
  }

  loadSessions(): void {
    this.loading = true;
    this.error = null;
    this.api.listSessions(this.docId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.sessions = res.data;
        } else {
          this.error = res.message || 'Failed to load sessions';
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to load sessions';
        this.loading = false;
      },
    });
  }

  // ── Create session ──
  toggleCreateForm(): void {
    this.showCreateForm = !this.showCreateForm;
    if (!this.showCreateForm) {
      this.createForm.reset({ max_collaborators: 10, expires_in_hours: 24 });
    }
  }

  createSession(): void {
    if (this.createForm.invalid || this.creating) return;
    this.creating = true;
    this.api.createSession(this.docId, this.createForm.value).subscribe({
      next: (res) => {
        if (res.success) {
          this.showCreateForm = false;
          this.createForm.reset({ max_collaborators: 10, expires_in_hours: 24 });
          this.loadSessions();
        } else {
          this.error = res.message || 'Failed to create session';
        }
        this.creating = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to create session';
        this.creating = false;
      },
    });
  }

  // ── Delete session ──
  deleteSession(sessionId: string): void {
    this.deletingId = sessionId;
    this.api.deleteSession(this.docId, sessionId).subscribe({
      next: (res) => {
        if (res.success) {
          this.sessions = this.sessions.filter((s) => s.id !== sessionId);
        } else {
          this.error = res.message || 'Failed to delete session';
        }
        this.deletingId = null;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to delete session';
        this.deletingId = null;
      },
    });
  }

  // ── Invite ──
  getInviteForm(sessionId: string): FormGroup {
    if (!this.inviteForms[sessionId]) {
      this.inviteForms[sessionId] = this.fb.group({
        email: ['', [Validators.required, Validators.email]],
        permission: ['view', Validators.required],
      });
    }
    return this.inviteForms[sessionId];
  }

  inviteUser(sessionId: string): void {
    const form = this.getInviteForm(sessionId);
    if (form.invalid || this.inviting[sessionId]) return;
    this.inviting[sessionId] = true;
    this.inviteErrors[sessionId] = '';
    const { email, permission } = form.value;
    this.api.invite(this.docId, sessionId, email, permission).subscribe({
      next: (res) => {
        if (res.success) {
          form.get('email')?.reset('');
          this.loadSessions(); // refresh to show new collaborator
        } else {
          this.inviteErrors[sessionId] = res.message || 'Failed to send invitation';
        }
        this.inviting[sessionId] = false;
      },
      error: (err) => {
        this.inviteErrors[sessionId] = err?.error?.message || 'Failed to send invitation';
        this.inviting[sessionId] = false;
      },
    });
  }

  // ── Update permission ──
  updatePermission(sessionId: string, userId: string, permission: string): void {
    this.api.updatePermission(this.docId, sessionId, userId, permission).subscribe({
      next: () => {
        // Refresh sessions to reflect change
        this.loadSessions();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to update permission';
      },
    });
  }

  // ── Remove user ──
  removeUser(sessionId: string, userId: string): void {
    this.api.removeUser(this.docId, sessionId, userId).subscribe({
      next: (res) => {
        if (res.success) {
          this.loadSessions(); // refresh
        } else {
          this.error = res.message || 'Failed to remove user';
        }
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to remove user';
      },
    });
  }
}
