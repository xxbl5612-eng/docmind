import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse } from '@/types';

const API_BASE = '/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const { data } = await axios.post<ApiResponse<{
            access_token: string;
            refresh_token: string;
            expires_in: number;
          }>>(`${API_BASE}/auth/refresh`, { refresh_token: refreshToken });
          if (data.success && data.data) {
            localStorage.setItem('access_token', data.data.access_token);
            localStorage.setItem('refresh_token', data.data.refresh_token);
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${data.data.access_token}`;
            }
            return api(originalRequest);
          }
        } catch {
          // refresh failed
        }
      }
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  register: (email: string, password: string, display_name: string) =>
    api.post('/auth/register', { email, password, display_name }),
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  refresh: (refresh_token: string) =>
    api.post('/auth/refresh', { refresh_token }),
  logout: (refresh_token: string) =>
    api.post('/auth/logout', { refresh_token }),
};

// Users
export const userApi = {
  me: () => api.get('/users/me'),
  updateMe: (data: { display_name?: string; avatar_url?: string; preferences?: Record<string, unknown> }) =>
    api.patch('/users/me', data),
  usage: () => api.get('/users/me/usage'),
  upgradeTier: (target_tier: string) =>
    api.put('/users/me/tier', { target_tier }),
  myOperations: (page = 1, page_size = 50) =>
    api.get('/users/me/operations', { params: { page, page_size } }),
};

// Documents
export const documentApi = {
  list: (params?: { page?: number; page_size?: number; status_filter?: string; doc_type?: string }) =>
    api.get('/documents/', { params }),
  upload: (file: File, folder?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (folder) form.append('folder', folder);
    return api.post('/documents/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  get: (id: string) => api.get(`/documents/${id}`),
  update: (id: string, data: { title?: string; tags?: string[]; folder?: string }) =>
    api.patch(`/documents/${id}`, data),
  delete: (id: string) => api.delete(`/documents/${id}`),
  getContent: (id: string) => api.get(`/documents/${id}/content`),
  updateContent: (id: string, content: string, change_summary?: string) =>
    api.put(`/documents/${id}/content`, { content, change_summary }),
  export: (id: string, target_format: string, options?: Record<string, unknown>) =>
    api.post(`/documents/${id}/export`, { target_format, options }),
};

// AI Processing
export const aiApi = {
  proofread: (docId: string, data: Record<string, unknown>) =>
    api.post(`/documents/${docId}/ai/proofread`, data),
  rewrite: (docId: string, data: Record<string, unknown>) =>
    api.post(`/documents/${docId}/ai/rewrite`, data),
  summarize: (docId: string, data: Record<string, unknown>) =>
    api.post(`/documents/${docId}/ai/summarize`, data),
  extract: (docId: string, data: Record<string, unknown>) =>
    api.post(`/documents/${docId}/ai/extract`, data),
  convert: (docId: string, data: Record<string, unknown>) =>
    api.post(`/documents/${docId}/ai/convert`, data),
  qa: (docId: string, data: Record<string, unknown>) =>
    api.post(`/documents/${docId}/ai/qa`, data),
  // Async
  asyncProofread: (docId: string, data: Record<string, unknown>) =>
    api.post(`/documents/${docId}/ai/async/proofread`, data),
  asyncRewrite: (docId: string, data: Record<string, unknown>) =>
    api.post(`/documents/${docId}/ai/async/rewrite`, data),
  asyncSummarize: (docId: string, data: Record<string, unknown>) =>
    api.post(`/documents/${docId}/ai/async/summarize`, data),
  asyncExtract: (docId: string, data: Record<string, unknown>) =>
    api.post(`/documents/${docId}/ai/async/extract`, data),
  asyncConvert: (docId: string, data: Record<string, unknown>) =>
    api.post(`/documents/${docId}/ai/async/convert`, data),
  taskStatus: (docId: string, taskId: string) =>
    api.get(`/documents/${docId}/ai/tasks/${taskId}`),
  tasksList: (docId: string) =>
    api.get(`/documents/${docId}/ai/tasks`),
};

// Versions
export const versionApi = {
  list: (docId: string) => api.get(`/documents/${docId}/versions/`),
  get: (docId: string, versionId: string) =>
    api.get(`/documents/${docId}/versions/${versionId}`),
  restore: (docId: string, versionId: string) =>
    api.post(`/documents/${docId}/versions/${versionId}/restore`),
  diff: (docId: string, verA: string, verB: string) =>
    api.get(`/documents/${docId}/versions/${verA}/diff/${verB}`),
};

// Collaboration
export const collabApi = {
  createSession: (docId: string, data?: { max_collaborators?: number; expires_in_hours?: number }) =>
    api.post(`/documents/${docId}/collaboration/`, data || {}),
  listSessions: (docId: string) =>
    api.get(`/documents/${docId}/collaboration/`),
  invite: (docId: string, sessionId: string, email: string, permission: string) =>
    api.post(`/documents/${docId}/collaboration/${sessionId}/invite`, { email, permission }),
  updatePermission: (docId: string, sessionId: string, userId: string, permission: string) =>
    api.patch(`/documents/${docId}/collaboration/${sessionId}/user/${userId}`, { permission }),
  removeUser: (docId: string, sessionId: string, userId: string) =>
    api.delete(`/documents/${docId}/collaboration/${sessionId}/user/${userId}`),
  deleteSession: (docId: string, sessionId: string) =>
    api.delete(`/documents/${docId}/collaboration/${sessionId}`),
  leave: (docId: string) =>
    api.delete(`/documents/${docId}/collaboration/leave`),
};

// Invitations
export const invitationApi = {
  list: () => api.get('/collaboration/invitations/'),
  accept: (id: string) => api.post(`/collaboration/invitations/${id}/accept`),
  reject: (id: string) => api.post(`/collaboration/invitations/${id}/reject`),
};

// Operations
export const operationsApi = {
  forDocument: (docId: string, page = 1, page_size = 50) =>
    api.get(`/documents/${docId}/operations`, { params: { page, page_size } }),
};

// Admin
export const adminApi = {
  stats: () => api.get('/admin/stats'),
};

// GitHub OAuth & Import
export const githubApi = {
  getAuthorizationUrl: () => api.get('/auth/github/authorize'),
  callback: (code: string, state: string) =>
    api.post('/auth/github/callback', { code, state }),
  link: (code: string, state: string) =>
    api.post('/auth/github/link', { code, state }),
  unlink: () => api.delete('/auth/github/unlink'),
  getAccounts: () => api.get('/auth/oauth-accounts'),
  listRepos: (params?: { search?: string; page?: number; page_size?: number }) =>
    api.get('/github/repos', { params }),
  getContents: (owner: string, repo: string, path?: string) =>
    api.get(`/github/repos/${owner}/${repo}/contents`, { params: { path } }),
  getFile: (owner: string, repo: string, path: string) =>
    api.get(`/github/repos/${owner}/${repo}/file`, { params: { path } }),
  getReadme: (owner: string, repo: string) =>
    api.get(`/github/repos/${owner}/${repo}/readme`),
  importFile: (repoFullName: string, filePath: string, folder?: string) =>
    api.post('/github/import', { repo_full_name: repoFullName, file_path: filePath, folder }),
  rateLimit: () => api.get('/github/rate-limit'),
};

// Slides (PPTX preview)
export const slideApi = {
  getSlides: (docId: string) => api.get(`/documents/${docId}/slides`),
  getSlideImage: (docId: string, slideIdx: number, imageIdx: number) =>
    api.get(`/documents/${docId}/slides/${slideIdx}/images/${imageIdx}`, { responseType: 'blob' }),
};

// PDF Operations
export const pdfApi = {
  compress: (docId: string, quality: string = 'screen') =>
    api.post(`/documents/${docId}/pdf/compress`, { quality }),
  watermark: (docId: string, text: string, opacity?: number, rotation?: number) =>
    api.post(`/documents/${docId}/pdf/watermark`, { text, opacity, rotation }),
  encrypt: (docId: string, password: string) =>
    api.post(`/documents/${docId}/pdf/encrypt`, { password }),
  merge: (document_ids: string[]) =>
    api.post('/documents/pdf/merge', { document_ids }),
};

// Health
export const healthApi = {
  check: () => api.get('/health'),
  ready: () => api.get('/health/ready'),
};

// Semantic Search
export const searchApi = {
  search: (docId: string, query: string, top_k?: number) =>
    api.post(`/documents/${docId}/ai/search`, { query, top_k }),
  searchQA: (docId: string, question: string, top_k?: number) =>
    api.post(`/documents/${docId}/ai/search/qa`, { question, top_k }),
  buildIndex: (docId: string) =>
    api.post(`/documents/${docId}/ai/search/index`),
  deleteIndex: (docId: string) =>
    api.delete(`/documents/${docId}/ai/search/index`),
};

// AI Chat Assistant
export const chatApi = {
  send: (messages: { role: string; content: string }[], documentId?: string | null) =>
    api.post('/ai/chat', { messages, document_id: documentId }),
};

export default api;
