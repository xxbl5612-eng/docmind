export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  tier: string;
  tier_expires_at: string | null;
  is_verified: boolean;
  is_superuser: boolean;
  preferences: Record<string, unknown> | null;
  created_at: string | null;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface Document {
  id: string;
  owner_id: string;
  title: string;
  input_format: string;
  output_format: string | null;
  mime_type: string | null;
  file_size_bytes: number;
  page_count: number | null;
  char_count: number | null;
  status: string;
  metadata_: Record<string, unknown> | null;
  tags: string[] | null;
  folder: string | null;
  checksum_sha256: string | null;
  current_version_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface DocumentContent {
  id: string;
  content: string;
  char_count: number;
  version_id: string;
}

export interface DocumentListResponse {
  items: Document[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface Version {
  id: string;
  document_id: string;
  version_number: number;
  char_count: number;
  change_summary: string | null;
  source: string;
  created_by: string | null;
  created_at: string;
}

export interface VersionListResponse {
  items: Version[];
  total: number;
}

export interface VersionContent {
  id: string;
  version_number: number;
  content: string;
  char_count: number;
}

export interface DiffResponse {
  version_a: number;
  version_b: number;
  diff_text: string;
  changes_count: number;
  additions: number;
  deletions: number;
}

export interface CollaborationSession {
  id: string;
  document_id: string;
  owner_id: string;
  status: string;
  settings: Record<string, unknown>;
  collaborators: Collaborator[];
  created_at: string;
  expires_at: string | null;
}

export interface Collaborator {
  id: string;
  user_id: string;
  display_name: string | null;
  permission: string;
  cursor_color: string | null;
  joined_at: string | null;
  last_active_at: string | null;
}

export interface Invitation {
  id: string;
  session_id: string;
  inviter_id: string;
  invitee_email: string;
  permission: string;
  status: string;
  token: string;
  expires_at: string;
  created_at: string;
}

export interface AsyncTaskResponse {
  task_id: string;
  status: string;
  message: string;
}

export interface TaskStatus {
  task_id: string;
  job_type: string;
  status: string;
  progress_pct: number;
  chunks_total: number | null;
  chunks_completed: number | null;
  tokens_used: number | null;
  error_message: string | null;
  result_summary: Record<string, unknown> | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface UsageData {
  tier: string;
  quota_used_docs: number;
  quota_used_ai_calls: number;
  quota_used_storage_bytes: number;
  quota_period_start: string;
  tier_limits: Record<string, number>;
}

export interface AdminStats {
  total_users: number;
  total_documents: number;
  total_characters: number;
  supported_formats: { input: string[]; output: string[] };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface OperationLog {
  id: string;
  user_id: string;
  document_id: string;
  action: string;
  action_category: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

// AI request types
export interface ProofreadRequest {
  language?: string;
  style_guide?: string;
  check_grammar?: boolean;
  check_spelling?: boolean;
  check_style?: boolean;
}

export interface RewriteRequest {
  tone?: string;
  audience?: string;
  length?: string;
  instructions?: string;
}

export interface SummarizeRequest {
  length?: string;
  format?: string;
  focus?: string;
}

export interface ExtractRequest {
  extract_type: string;
  custom_schema?: Record<string, unknown>;
  language?: string;
}

export interface ConvertRequest {
  target_format: string;
  preserve_structure?: boolean;
  options?: Record<string, unknown>;
}

export interface QARequest {
  question: string;
  context_chunks?: number;
}
