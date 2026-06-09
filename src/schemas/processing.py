"""AI processing request/response schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ProofreadRequest(BaseModel):
    language: str = Field(default="auto")
    style_guide: str | None = None
    check_grammar: bool = True
    check_spelling: bool = True
    check_style: bool = True


class ProofreadResponse(BaseModel):
    original_text: str
    corrected_text: str
    diff: list[dict]
    suggestions: list[dict]
    summary: str


class RewriteRequest(BaseModel):
    tone: str = Field(default="professional", pattern=r"^(formal|professional|casual|creative|academic)$")
    audience: str = Field(default="general", pattern=r"^(general|expert|children|executive)$")
    length: str = Field(default="similar", pattern=r"^(shorter|similar|longer)$")
    instructions: str | None = None


class RewriteResponse(BaseModel):
    rewritten_text: str
    changes_summary: str


class SummarizeRequest(BaseModel):
    length: str = Field(default="medium", pattern=r"^(short|medium|long)$")
    format: str = Field(default="paragraph", pattern=r"^(paragraph|bullets|structured)$")
    focus: str | None = None


class SummarizeResponse(BaseModel):
    summary: str
    original_char_count: int
    summary_char_count: int
    compression_ratio: float


class ExtractRequest(BaseModel):
    extract_type: str = Field(pattern=r"^(entities|tables|key_facts|custom)$")
    custom_schema: dict | None = None
    language: str = Field(default="auto")


class ExtractResponse(BaseModel):
    result: dict
    extract_type: str


class ConvertRequest(BaseModel):
    target_format: str = Field(pattern=r"^(pdf|docx|md|html|txt|json|pptx|xlsx|csv)$")
    preserve_structure: bool = True
    options: dict | None = None


class QARequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    context_chunks: int = Field(default=3, ge=1, le=10)


class QAResponse(BaseModel):
    question: str
    answer: str
    sources: list[dict]


class AsyncTaskResponse(BaseModel):
    task_id: str
    status: str
    message: str


class TaskStatusResponse(BaseModel):
    task_id: str
    job_type: str
    status: str
    progress_pct: int
    chunks_total: int | None
    chunks_completed: int | None
    tokens_used: int | None
    cost_estimate: float | None
    error_message: str | None
    result_summary: dict | None
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class OCRRequest(BaseModel):
    engine: str = Field(default="auto", pattern=r"^(paddle|easyocr|auto)$")
    language: str = Field(default="auto", pattern=r"^(auto|ch|en|ch_en)$")
    detect_tables: bool = True
    table_format: str = Field(default="cells", pattern=r"^(cells|csv|markdown)$")
    min_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    detect_barcodes: bool = False


class OCRResponse(BaseModel):
    text: str
    engine_used: str
    detected_language: str | None = None
    page_count: int | None = None
    tables: list[dict] | None = None
    barcodes: list[dict] | None = None
    char_count: int
    lines: list[dict] | None = None


class ChatMessage(BaseModel):
    role: str = Field(pattern=r"^(user|assistant|system)$")
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    document_id: str | None = None


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=50)
    threshold: float = Field(default=0.3, ge=0.0, le=1.0)


class SearchResultItem(BaseModel):
    chunk_index: int
    text: str
    score: float


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResultItem]
    total_chunks_searched: int


class SearchQARequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=20)


class SearchSourceItem(BaseModel):
    chunk_index: int
    text_snippet: str
    score: float


class RAGQAResponse(BaseModel):
    question: str
    answer: str
    sources: list[SearchSourceItem]
    tokens_used: dict


class ChatResponse(BaseModel):
    message: str
    tokens_used: dict | None = None
