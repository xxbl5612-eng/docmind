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
  is_shared?: boolean;
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

// GitHub OAuth & Import
export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  default_branch: string;
}

export interface GitHubContent {
  name: string;
  path: string;
  type: 'file' | 'dir';
  sha: string;
  size: number;
  html_url: string;
}

export interface OAuthAccount {
  provider: string;
  provider_login: string | null;
  provider_email: string | null;
  linked_at: string;
}

export interface GitHubRateLimit {
  remaining: number;
  limit: number;
  reset: number;
}

// Viewer architecture
export interface ViewerConfig {
  formats: string[];
  component: React.ComponentType<ViewerProps>;
  defaultView: 'preview' | 'text';
  label: string;
  icon: string;
}

export interface ViewerProps {
  docId: string;
  content: string;
  onContentChange: (content: string) => void;
}

// PPTX Slide types
export interface SlideParagraphRun {
  text: string;
  font_size: number | null;
  bold: boolean;
  italic: boolean;
  color: string | null;
  font_name: string | null;
}

export interface SlideParagraph {
  text: string;
  runs: SlideParagraphRun[];
  alignment: string;
  level: number;
  bullet_type: string | null;
  bullet_char: string | null;
}

export interface GradientStop {
  color: string;
  position: number;
}

export interface TableCellStyle {
  row: number;
  col: number;
  bg_color: string | null;
  bold: boolean;
  align: string;
  colspan: number;
  rowspan: number;
}

export interface TableData {
  rows: string[][];
  col_widths: number[] | null;
  header_count: number;
  cell_styles: TableCellStyle[];
  row_count: number;
  col_count: number;
}

export interface SlideShape {
  shape_idx: number;
  shape_type: string;
  left: number;
  top: number;
  width: number;
  height: number;
  text: string | null;
  font_size: number | null;
  font_name: string | null;
  font_bold: boolean;
  font_italic: boolean;
  font_color: string | null;
  fill_color: string | null;
  alignment: string | null;
  has_image: boolean;
  image_index: number | null;
  table_rows: string[][] | null;
  paragraphs: SlideParagraph[];
  is_title: boolean;
  fill_type: string | null;
  gradient_angle: number | null;
  gradient_stops: GradientStop[];
  border_color: string | null;
  border_width: number | null;
  border_style: string | null;
  border_radius: number | null;
  shadow: boolean;
  rotation: number | null;
  table_data: TableData | null;
}

export interface SlideData {
  slide_index: number;
  width_emu: number;
  height_emu: number;
  width_px: number;
  height_px: number;
  shapes: SlideShape[];
  bg_color: string | null;
  bg_fill_type: string | null;
  bg_gradient_stops: GradientStop[];
  bg_gradient_angle: number | null;
}

export interface SlidesResponse {
  slides: SlideData[];
  image_count: number;
  total_slides: number;
}

// PDF operations
export interface PdfCompressRequest {
  quality: 'screen' | 'ebook' | 'printer' | 'prepress';
}

export interface PdfWatermarkRequest {
  text: string;
  opacity?: number;
  rotation?: number;
}

export interface PdfEncryptRequest {
  password: string;
}

export interface PdfMergeRequest {
  document_ids: string[];
}

export interface PdfOperationResponse {
  download_path: string;
  size_bytes: number;
  original_size_bytes: number;
  compression_ratio: number | null;
}

// Semantic Search
export interface SearchRequest {
  query: string;
  top_k?: number;
  threshold?: number;
}

export interface SearchResultItem {
  chunk_index: number;
  text: string;
  score: number;
}

export interface SearchResponseData {
  query: string;
  results: SearchResultItem[];
  total_chunks_searched: number;
}

export interface SearchQARequest {
  question: string;
  top_k?: number;
}

export interface SearchSourceItem {
  chunk_index: number;
  text_snippet: string;
  score: number;
}

export interface RAGQAResponseData {
  question: string;
  answer: string;
  sources: SearchSourceItem[];
  tokens_used: Record<string, number>;
}

// AI Chat Assistant
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  document_id?: string | null;
}

export interface ChatResponseData {
  message: string;
  tokens_used: Record<string, number> | null;
}
