import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  ApiResponse, Document, DocumentContent, DocumentListResponse,
  Version, VersionListResponse, VersionContent, DiffResponse,
  CollaborationSession, Invitation, AsyncTaskResponse, TaskStatus,
  AdminStats, User, TokenResponse, OperationLog,
  GitHubRepo, GitHubContent, OAuthAccount, GitHubRateLimit,
  SlidesResponse
} from '../../shared/models/types';

const API_BASE = '/api/v1';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  // ── Auth ──
  register(email: string, password: string, display_name: string) {
    return this.http.post<ApiResponse<TokenResponse>>(`${API_BASE}/auth/register`, { email, password, display_name });
  }
  login(email: string, password: string) {
    return this.http.post<ApiResponse<TokenResponse & { user: User }>>(`${API_BASE}/auth/login`, { email, password });
  }
  refresh(refresh_token: string) {
    return this.http.post<ApiResponse<TokenResponse>>(`${API_BASE}/auth/refresh`, { refresh_token });
  }
  logout(refresh_token: string) {
    return this.http.post<ApiResponse<null>>(`${API_BASE}/auth/logout`, { refresh_token });
  }

  // ── Users ──
  me() { return this.http.get<ApiResponse<User>>(`${API_BASE}/users/me`); }
  updateMe(data: { display_name?: string; avatar_url?: string; preferences?: Record<string, unknown> }) {
    return this.http.patch<ApiResponse<User>>(`${API_BASE}/users/me`, data);
  }
  myOperations(page = 1, page_size = 50) {
    return this.http.get<ApiResponse<OperationLog[]>>(`${API_BASE}/users/me/operations`, { params: { page, page_size } });
  }
  recommendations() { return this.http.get<ApiResponse<any>>(`${API_BASE}/users/me/recommendations`); }
  achievements() { return this.http.get<ApiResponse<any>>(`${API_BASE}/users/me/achievements`); }
  pointsHistory() { return this.http.get<ApiResponse<any[]>>(`${API_BASE}/users/me/points-history`); }

  // ── Documents ──
  list(params?: { page?: number; page_size?: number; status_filter?: string; doc_type?: string }) {
    return this.http.get<ApiResponse<DocumentListResponse>>(`${API_BASE}/documents/`, { params: params as any });
  }
  upload(file: File, folder?: string) {
    const form = new FormData();
    form.append('file', file);
    if (folder) form.append('folder', folder);
    return this.http.post<ApiResponse<Document>>(`${API_BASE}/documents/upload`, form);
  }
  get(id: string) { return this.http.get<ApiResponse<Document>>(`${API_BASE}/documents/${id}`); }
  update(id: string, data: { title?: string; tags?: string[]; folder?: string }) {
    return this.http.patch<ApiResponse<Document>>(`${API_BASE}/documents/${id}`, data);
  }
  delete(id: string) { return this.http.delete<ApiResponse<null>>(`${API_BASE}/documents/${id}`); }
  getContent(id: string) { return this.http.get<ApiResponse<DocumentContent>>(`${API_BASE}/documents/${id}/content`); }
  updateContent(id: string, content: string, change_summary?: string) {
    return this.http.put<ApiResponse<DocumentContent>>(`${API_BASE}/documents/${id}/content`, { content, change_summary });
  }
  export(id: string, target_format: string, options?: Record<string, unknown>) {
    return this.http.post<ApiResponse<{ url: string }>>(`${API_BASE}/documents/${id}/export`, { target_format, options });
  }

  // ── AI Processing ──
  proofread(docId: string, data: Record<string, unknown>) {
    return this.http.post<ApiResponse<AsyncTaskResponse>>(`${API_BASE}/documents/${docId}/ai/proofread`, data);
  }
  rewrite(docId: string, data: Record<string, unknown>) {
    return this.http.post<ApiResponse<AsyncTaskResponse>>(`${API_BASE}/documents/${docId}/ai/rewrite`, data);
  }
  summarize(docId: string, data: Record<string, unknown>) {
    return this.http.post<ApiResponse<AsyncTaskResponse>>(`${API_BASE}/documents/${docId}/ai/summarize`, data);
  }
  extract(docId: string, data: Record<string, unknown>) {
    return this.http.post<ApiResponse<AsyncTaskResponse>>(`${API_BASE}/documents/${docId}/ai/extract`, data);
  }
  convert(docId: string, data: Record<string, unknown>) {
    return this.http.post<ApiResponse<AsyncTaskResponse>>(`${API_BASE}/documents/${docId}/ai/convert`, data);
  }
  qa(docId: string, data: Record<string, unknown>) {
    return this.http.post<ApiResponse<{ answer: string }>>(`${API_BASE}/documents/${docId}/ai/qa`, data);
  }
  // Async AI (for large documents)
  asyncProofread(docId: string, data: Record<string, unknown>) {
    return this.http.post<ApiResponse<AsyncTaskResponse>>(`${API_BASE}/documents/${docId}/ai/async/proofread`, data);
  }
  asyncRewrite(docId: string, data: Record<string, unknown>) {
    return this.http.post<ApiResponse<AsyncTaskResponse>>(`${API_BASE}/documents/${docId}/ai/async/rewrite`, data);
  }
  asyncSummarize(docId: string, data: Record<string, unknown>) {
    return this.http.post<ApiResponse<AsyncTaskResponse>>(`${API_BASE}/documents/${docId}/ai/async/summarize`, data);
  }
  asyncExtract(docId: string, data: Record<string, unknown>) {
    return this.http.post<ApiResponse<AsyncTaskResponse>>(`${API_BASE}/documents/${docId}/ai/async/extract`, data);
  }
  asyncConvert(docId: string, data: Record<string, unknown>) {
    return this.http.post<ApiResponse<AsyncTaskResponse>>(`${API_BASE}/documents/${docId}/ai/async/convert`, data);
  }
  taskStatus(docId: string, taskId: string) {
    return this.http.get<ApiResponse<TaskStatus>>(`${API_BASE}/documents/${docId}/ai/tasks/${taskId}`);
  }
  tasksList(docId: string) {
    return this.http.get<ApiResponse<TaskStatus[]>>(`${API_BASE}/documents/${docId}/ai/tasks`);
  }

  // ── Versions ──
  listVersions(docId: string) {
    return this.http.get<ApiResponse<VersionListResponse>>(`${API_BASE}/documents/${docId}/versions/`);
  }
  getVersion(docId: string, versionId: string) {
    return this.http.get<ApiResponse<VersionContent>>(`${API_BASE}/documents/${docId}/versions/${versionId}`);
  }
  restoreVersion(docId: string, versionId: string) {
    return this.http.post<ApiResponse<Version>>(`${API_BASE}/documents/${docId}/versions/${versionId}/restore`, {});
  }
  diffVersions(docId: string, verA: string, verB: string) {
    return this.http.get<ApiResponse<DiffResponse>>(`${API_BASE}/documents/${docId}/versions/${verA}/diff/${verB}`);
  }

  // ── Collaboration ──
  createSession(docId: string, data?: { max_collaborators?: number; expires_in_hours?: number }) {
    return this.http.post<ApiResponse<CollaborationSession>>(`${API_BASE}/documents/${docId}/collaboration/`, data || {});
  }
  listSessions(docId: string) {
    return this.http.get<ApiResponse<CollaborationSession[]>>(`${API_BASE}/documents/${docId}/collaboration/`);
  }
  invite(docId: string, sessionId: string, email: string, permission: string) {
    return this.http.post<ApiResponse<Invitation>>(`${API_BASE}/documents/${docId}/collaboration/${sessionId}/invite`, { email, permission });
  }
  updatePermission(docId: string, sessionId: string, userId: string, permission: string) {
    return this.http.patch<ApiResponse<null>>(`${API_BASE}/documents/${docId}/collaboration/${sessionId}/user/${userId}`, { permission });
  }
  removeUser(docId: string, sessionId: string, userId: string) {
    return this.http.delete<ApiResponse<null>>(`${API_BASE}/documents/${docId}/collaboration/${sessionId}/user/${userId}`);
  }
  deleteSession(docId: string, sessionId: string) {
    return this.http.delete<ApiResponse<null>>(`${API_BASE}/documents/${docId}/collaboration/${sessionId}`);
  }

  // ── Operations ──
  forDocument(docId: string, page = 1, page_size = 50) {
    return this.http.get<ApiResponse<OperationLog[]>>(`${API_BASE}/documents/${docId}/operations`, { params: { page, page_size } });
  }

  // ── Admin ──
  adminStats() { return this.http.get<ApiResponse<AdminStats>>(`${API_BASE}/admin/stats`); }

  // ── GitHub OAuth & Import ──
  getAuthorizationUrl() { return this.http.get<ApiResponse<{ url: string }>>(`${API_BASE}/auth/github/authorize`); }
  callback(code: string, state: string) {
    return this.http.post<ApiResponse<TokenResponse & { user: User }>>(`${API_BASE}/auth/github/callback`, { code, state });
  }
  link(code: string, state: string) {
    return this.http.post<ApiResponse<null>>(`${API_BASE}/auth/github/link`, { code, state });
  }
  unlink() { return this.http.delete<ApiResponse<null>>(`${API_BASE}/auth/github/unlink`); }
  getAccounts() { return this.http.get<ApiResponse<OAuthAccount[]>>(`${API_BASE}/auth/oauth-accounts`); }
  listRepos(params?: { search?: string; page?: number; page_size?: number }) {
    return this.http.get<ApiResponse<GitHubRepo[]>>(`${API_BASE}/github/repos`, { params: params as any });
  }
  getContents(owner: string, repo: string, path?: string) {
    return this.http.get<ApiResponse<GitHubContent[]>>(`${API_BASE}/github/repos/${owner}/${repo}/contents`, { params: path ? { path } : {} });
  }
  getFile(owner: string, repo: string, path: string) {
    return this.http.get<ApiResponse<{ content: string }>>(`${API_BASE}/github/repos/${owner}/${repo}/file`, { params: { path } });
  }
  getReadme(owner: string, repo: string) {
    return this.http.get<ApiResponse<{ content: string }>>(`${API_BASE}/github/repos/${owner}/${repo}/readme`);
  }
  importFile(repoFullName: string, filePath: string, folder?: string) {
    return this.http.post<ApiResponse<Document>>(`${API_BASE}/github/import`, { repo_full_name: repoFullName, file_path: filePath, folder });
  }
  rateLimit() { return this.http.get<ApiResponse<GitHubRateLimit>>(`${API_BASE}/github/rate-limit`); }

  // ── Slides ──
  getSlides(docId: string) { return this.http.get<ApiResponse<SlidesResponse>>(`${API_BASE}/documents/${docId}/slides`); }
  getSlideImage(docId: string, slideIdx: number, imageIdx: number) {
    return this.http.get(`${API_BASE}/documents/${docId}/slides/${slideIdx}/images/${imageIdx}`, { responseType: 'blob' });
  }

  // ── Health ──
  healthCheck() { return this.http.get<{ status: string; version: string }>(`${API_BASE}/health`); }
  healthReady() { return this.http.get<{ status: string }>(`${API_BASE}/health/ready`); }
}
