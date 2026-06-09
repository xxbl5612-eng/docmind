import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { searchApi } from '@/lib/api';
import type { ApiResponse, SearchResponseData, RAGQAResponseData } from '@/types';

type Mode = 'search' | 'qa';

interface Props {
  docId: string;
}

export default function SemanticSearch({ docId }: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('search');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResponseData | null>(null);
  const [ragAnswer, setRagAnswer] = useState<RAGQAResponseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || isLoading) return;
    setIsLoading(true);
    setError(null);
    setResults(null);
    setRagAnswer(null);

    try {
      if (mode === 'search') {
        const { data } = await searchApi.search(docId, query.trim());
        const resp = data as ApiResponse<SearchResponseData>;
        if (resp.success && resp.data) {
          setResults(resp.data);
        } else {
          setError(resp.message || t('editor.search_failed'));
        }
      } else {
        const { data } = await searchApi.searchQA(docId, query.trim());
        const resp = data as ApiResponse<RAGQAResponseData>;
        if (resp.success && resp.data) {
          setRagAnswer(resp.data);
        } else {
          setError(resp.message || t('editor.search_failed'));
        }
      }
    } catch {
      setError(t('editor.search_unavailable'));
    } finally {
      setIsLoading(false);
    }
  }, [query, mode, docId, isLoading, t]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 mb-3 bg-surface-100 rounded-lg p-1">
        <button
          onClick={() => setMode('search')}
          className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors cursor-pointer ${
            mode === 'search' ? 'bg-white text-primary-600 shadow-sm' : 'text-surface-500 hover:text-surface-700'
          }`}
        >
          {t('editor.search_tab')}
        </button>
        <button
          onClick={() => setMode('qa')}
          className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors cursor-pointer ${
            mode === 'qa' ? 'bg-white text-primary-600 shadow-sm' : 'text-surface-500 hover:text-surface-700'
          }`}
        >
          {t('editor.search_qa_tab')}
        </button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            mode === 'search'
              ? t('editor.search_placeholder')
              : t('editor.search_qa_placeholder')
          }
          disabled={isLoading}
          className="flex-1 px-3 py-2 rounded-lg border border-surface-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-surface-100"
        />
        <button
          onClick={handleSearch}
          disabled={!query.trim() || isLoading}
          className="px-4 py-2 rounded-lg bg-primary-500 text-white text-sm hover:bg-primary-600 disabled:bg-surface-200 disabled:text-surface-400 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          {isLoading ? '...' : mode === 'search' ? t('editor.search_btn') : t('editor.search_ask_btn')}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 mb-3">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-3">
        {results && (
          <div>
            <p className="text-xs text-surface-400 mb-2">
              {t('editor.search_found_chunks', { count: results.results.length })}
            </p>
            {results.results.length === 0 ? (
              <p className="text-sm text-surface-400 py-4 text-center">{t('editor.search_no_results')}</p>
            ) : (
              results.results.map((r) => (
                <div key={r.chunk_index} className="bg-white border border-surface-200 rounded-lg p-3 mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-surface-400">{t('editor.search_chunk')} {r.chunk_index}</span>
                    <span className="text-xs text-primary-500 font-medium">{(r.score * 100).toFixed(0)}%</span>
                  </div>
                  <p className="text-sm text-surface-600 leading-relaxed whitespace-pre-wrap line-clamp-5">{r.text}</p>
                </div>
              ))
            )}
          </div>
        )}

        {ragAnswer && (
          <div>
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 mb-3">
              <p className="text-xs text-primary-400 mb-1">{t('editor.search_answer')}</p>
              <p className="text-sm text-surface-700 leading-relaxed whitespace-pre-wrap">{ragAnswer.answer}</p>
              {ragAnswer.tokens_used && (
                <p className="text-xs text-surface-400 mt-2">
                  Tokens: {ragAnswer.tokens_used.total_tokens || 'N/A'}
                </p>
              )}
            </div>
            {ragAnswer.sources.length > 0 && (
              <div>
                <p className="text-xs text-surface-400 mb-2">
                  {t('editor.search_sources')} ({ragAnswer.sources.length})
                </p>
                {ragAnswer.sources.map((s, i) => (
                  <details key={i} className="bg-white border border-surface-200 rounded-lg p-2 mb-1">
                    <summary className="text-xs text-surface-500 cursor-pointer">
                      {t('editor.search_chunk')} {s.chunk_index} ({(s.score * 100).toFixed(0)}%) — {s.text_snippet.substring(0, 80)}...
                    </summary>
                    <p className="text-xs text-surface-600 mt-1 whitespace-pre-wrap">{s.text_snippet}</p>
                  </details>
                ))}
              </div>
            )}
          </div>
        )}

        {!results && !ragAnswer && !error && (
          <p className="text-sm text-surface-400 py-8 text-center">
            {mode === 'search'
              ? t('editor.search_empty_hint')
              : t('editor.search_qa_empty_hint')}
          </p>
        )}
      </div>
    </div>
  );
}
