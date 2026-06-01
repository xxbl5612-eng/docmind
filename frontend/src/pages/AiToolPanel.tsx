import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { aiApi } from '@/lib/api';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import type { ApiResponse, AsyncTaskResponse, TaskStatus, Document } from '@/types';

type AiTool = 'proofread' | 'rewrite' | 'summarize' | 'extract' | 'convert' | 'qa';

const aiToolIcons: Record<AiTool, string> = {
  proofread: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  rewrite: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125',
  summarize: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5',
  extract: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z',
  convert: 'M7.5 7.5h-.75A2.25 2.25 0 004.5 9.75v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25-2.25v-7.5a2.25 2.25 0 00-2.25-2.25h-.75m-6 3.75l3-3m0 0l3 3m-3-3v10.5',
  qa: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

const aiTools: AiTool[] = ['proofread', 'rewrite', 'summarize', 'extract', 'convert', 'qa'];

function formatNumber(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function StatsCards({ stats }: { stats: Record<string, unknown> | null }) {
  const { t } = useTranslation();
  if (!stats) return null;
  const tokens = stats.tokens_used as Record<string, number> | undefined;
  const scalarEntries = Object.entries(stats).filter(([k]) => k !== 'tokens_used');
  return (
    <div className="space-y-3">
      {tokens && (
        <div className="bg-primary-50 rounded-lg p-3">
          <p className="text-xs font-medium text-primary-700 mb-2">{t('editor.token_usage')}</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white rounded-md p-2">
              <p className="text-lg font-bold text-surface-900">{formatNumber(tokens.prompt_tokens || 0)}</p>
              <p className="text-[10px] text-surface-400">{t('editor.prompt_tokens')}</p>
            </div>
            <div className="bg-white rounded-md p-2">
              <p className="text-lg font-bold text-surface-900">{formatNumber(tokens.completion_tokens || 0)}</p>
              <p className="text-[10px] text-surface-400">{t('editor.completion_tokens')}</p>
            </div>
            <div className="bg-white rounded-md p-2">
              <p className="text-lg font-bold text-primary-700">{formatNumber(tokens.total_tokens || 0)}</p>
              <p className="text-[10px] text-primary-500 font-medium">{t('editor.total_tokens')}</p>
            </div>
          </div>
        </div>
      )}
      {scalarEntries.length > 0 && (
        <div className="space-y-1.5">
          {scalarEntries.map(([k, v]) => {
            if (v && typeof v === 'object') return null;
            const label = k.replace(/_/g, ' ').replace(/ratio$/, 'rate').replace(/\b\w/g, (c) => c.toUpperCase());
            const display = k.includes('ratio') && typeof v === 'number'
              ? `${(v * 100).toFixed(1)}%`
              : k.includes('char_count') && typeof v === 'number'
                ? v.toLocaleString()
                : String(v ?? '-');
            return (
              <div key={k} className="flex items-center justify-between text-xs">
                <span className="text-surface-400">{label}</span>
                <span className="text-surface-700 font-mono">{display}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface Props {
  docId: string;
  doc: Document | null | undefined;
  onClose: () => void;
}

export default function AiToolPanel({ docId, doc, onClose }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [activeTool, setActiveTool] = useState<AiTool | null>(null);
  const [toolResult, setToolResult] = useState<string | null>(null);
  const [resultStats, setResultStats] = useState<Record<string, unknown> | null>(null);
  const [resultTab, setResultTab] = useState<'result' | 'stats'>('result');
  const [processing, setProcessing] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);

  const [proofreadOpts, setProofreadOpts] = useState({ language: 'auto', check_grammar: true, check_spelling: true, check_style: true });
  const [rewriteOpts, setRewriteOpts] = useState({ tone: 'professional', audience: 'general', length: 'similar' });
  const [summarizeOpts, setSummarizeOpts] = useState({ length: 'medium', format: 'paragraph' });
  const [extractType, setExtractType] = useState('entities');
  const [convertFormat, setConvertFormat] = useState('docx');
  const [question, setQuestion] = useState('');

  useEffect(() => {
    if (!taskId) return;
    const interval = setInterval(async () => {
      try {
        const { data } = await aiApi.taskStatus(docId, taskId);
        const res = data as ApiResponse<TaskStatus>;
        if (res.data) {
          setTaskStatus(res.data);
          if (res.data.status === 'completed' || res.data.status === 'failed') {
            clearInterval(interval);
            setProcessing(false);
            if (res.data.status === 'completed') {
              toast(t('editor.task_completed'), 'success');
              handleToolResult(res.data.result_summary);
            } else {
              toast(res.data.error_message || t('editor.task_failed'), 'error');
            }
          }
        }
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [taskId, docId, toast, t]);

  const handleToolResult = (result: Record<string, unknown> | null) => {
    if (!result) return;
    const contentKeys = ['summary', 'rewritten_text', 'proofread_text', 'extracted_data', 'answer', 'content', 'converted_content'];
    let displayContent = '';
    const stats: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(result)) {
      if (contentKeys.includes(key) || key === 'summary') {
        displayContent = String(val ?? '');
      } else {
        stats[key] = val;
      }
    }
    if (!displayContent) displayContent = JSON.stringify(result, null, 2);
    setToolResult(displayContent);
    if (Object.keys(stats).length > 0) setResultStats(stats);
  };

  const runAiTool = async () => {
    if (!docId) return;
    setProcessing(true);
    setToolResult(null);
    setResultStats(null);
    setResultTab('result');
    setTaskStatus(null);
    setTaskId(null);
    try {
      let payload: Record<string, unknown> = {};
      switch (activeTool) {
        case 'proofread': payload = proofreadOpts; break;
        case 'rewrite': payload = rewriteOpts; break;
        case 'summarize': payload = summarizeOpts; break;
        case 'extract': payload = { extract_type: extractType }; break;
        case 'convert': payload = { target_format: convertFormat }; break;
        case 'qa': payload = { question }; break;
      }
      if (doc && doc.char_count && doc.char_count > 20000) {
        let res;
        switch (activeTool) {
          case 'proofread': res = await aiApi.asyncProofread(docId, payload); break;
          case 'rewrite': res = await aiApi.asyncRewrite(docId, payload); break;
          case 'summarize': res = await aiApi.asyncSummarize(docId, payload); break;
          case 'extract': res = await aiApi.asyncExtract(docId, payload); break;
          case 'convert': res = await aiApi.asyncConvert(docId, payload); break;
          default: res = await aiApi.asyncSummarize(docId, payload);
        }
        const taskData = (res.data as ApiResponse<AsyncTaskResponse>).data;
        if (taskData) { setTaskId(taskData.task_id); toast(t('editor.task_started'), 'info'); }
      } else {
        let res;
        switch (activeTool) {
          case 'proofread': res = await aiApi.proofread(docId, payload); break;
          case 'rewrite': res = await aiApi.rewrite(docId, payload); break;
          case 'summarize': res = await aiApi.summarize(docId, payload); break;
          case 'extract': res = await aiApi.extract(docId, payload); break;
          case 'convert': res = await aiApi.convert(docId, payload); break;
          case 'qa': res = await aiApi.qa(docId, payload); break;
          default: throw new Error('Unknown tool');
        }
        const result = (res.data as ApiResponse<Record<string, unknown>>).data;
        handleToolResult(result);
        setProcessing(false);
        toast(`${t(`editor.${activeTool}`)} ${t('editor.completed')}`, 'success');
      }
    } catch {
      setProcessing(false);
      toast(t('editor.task_failed'), 'error');
    }
  };

  return (
    <div className="w-80 border-r border-surface-200 bg-white flex flex-col flex-shrink-0 overflow-y-auto">
      <div className="p-4 border-b border-surface-200 flex items-center justify-between">
        <h2 className="font-semibold text-surface-900 text-sm">{t('editor.ai_tools')}</h2>
        <button onClick={onClose} className="text-surface-400 hover:text-surface-600 cursor-pointer">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex-1 p-2 space-y-1">
        {aiTools.map((key) => (
          <button
            key={key}
            onClick={() => { setActiveTool(key); setToolResult(null); setTaskId(null); setTaskStatus(null); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${activeTool === key ? 'bg-primary-50 text-primary-700 font-medium' : 'text-surface-600 hover:bg-surface-50'}`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={aiToolIcons[key]} />
            </svg>
            {t(`editor.${key}`)}
          </button>
        ))}
      </div>

      {activeTool && (
        <div className="border-t border-surface-200 p-4 space-y-4">
          {activeTool === 'proofread' && (
            <>
              <select value={proofreadOpts.language} onChange={(e) => setProofreadOpts({ ...proofreadOpts, language: e.target.value })} className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm">
                <option value="auto">{t('editor.auto_detect')}</option>
                <option value="en">{t('editor.english')}</option>
                <option value="zh">{t('editor.chinese')}</option>
              </select>
              {(['check_grammar', 'check_spelling', 'check_style'] as const).map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm text-surface-700 cursor-pointer">
                  <input type="checkbox" checked={proofreadOpts[k]} onChange={(e) => setProofreadOpts({ ...proofreadOpts, [k]: e.target.checked })} className="rounded" />
                  {t(`editor.proofread_check_options.${k.replace('check_', '')}`)}
                </label>
              ))}
            </>
          )}
          {activeTool === 'rewrite' && (
            <>
              <div>
                <label className="block text-sm text-surface-600 mb-1">{t('editor.tone')}</label>
                <select value={rewriteOpts.tone} onChange={(e) => setRewriteOpts({ ...rewriteOpts, tone: e.target.value })} className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm">
                  {['formal', 'professional', 'casual', 'creative', 'academic'].map((v) => <option key={v} value={v}>{t(`editor.tone_options.${v}`)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-surface-600 mb-1">{t('editor.audience')}</label>
                <select value={rewriteOpts.audience} onChange={(e) => setRewriteOpts({ ...rewriteOpts, audience: e.target.value })} className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm">
                  {['general', 'expert', 'children', 'executive'].map((v) => <option key={v} value={v}>{t(`editor.audience_options.${v}`)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-surface-600 mb-1">{t('editor.length')}</label>
                <select value={rewriteOpts.length} onChange={(e) => setRewriteOpts({ ...rewriteOpts, length: e.target.value })} className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm">
                  {['shorter', 'similar', 'longer'].map((v) => <option key={v} value={v}>{t(`editor.length_options.${v}`)}</option>)}
                </select>
              </div>
            </>
          )}
          {activeTool === 'summarize' && (
            <>
              <div>
                <label className="block text-sm text-surface-600 mb-1">{t('editor.length')}</label>
                <select value={summarizeOpts.length} onChange={(e) => setSummarizeOpts({ ...summarizeOpts, length: e.target.value })} className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm">
                  {['short', 'medium', 'long'].map((v) => <option key={v} value={v}>{t(`editor.summarize_length_options.${v}`)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-surface-600 mb-1">{t('editor.format')}</label>
                <select value={summarizeOpts.format} onChange={(e) => setSummarizeOpts({ ...summarizeOpts, format: e.target.value })} className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm">
                  {['paragraph', 'bullets', 'structured'].map((v) => <option key={v} value={v}>{t(`editor.format_options.${v}`)}</option>)}
                </select>
              </div>
            </>
          )}
          {activeTool === 'extract' && (
            <div>
              <label className="block text-sm text-surface-600 mb-1">{t('editor.extract_type')}</label>
              <select value={extractType} onChange={(e) => setExtractType(e.target.value)} className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm">
                {['entities', 'tables', 'key_facts', 'custom'].map((v) => <option key={v} value={v}>{t(`editor.extract_type_options.${v}`)}</option>)}
              </select>
            </div>
          )}
          {activeTool === 'convert' && (
            <div>
              <label className="block text-sm text-surface-600 mb-1">{t('editor.target_format')}</label>
              <select value={convertFormat} onChange={(e) => setConvertFormat(e.target.value)} className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm">
                {['pdf', 'docx', 'md', 'html', 'txt', 'json', 'pptx', 'xlsx', 'csv'].map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
              </select>
            </div>
          )}
          {activeTool === 'qa' && (
            <div>
              <label className="block text-sm text-surface-600 mb-1">{t('editor.question')}</label>
              <textarea value={question} onChange={(e) => setQuestion(e.target.value)} className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm resize-none h-24" placeholder={t('editor.question_placeholder')} />
            </div>
          )}
          <Button onClick={runAiTool} loading={processing} className="w-full">{t('editor.run')} {t(`editor.${activeTool}`)}</Button>

          {taskStatus && (
            <div className="bg-surface-50 rounded-lg p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-surface-600">{taskStatus.job_type}</span>
                <Badge variant={taskStatus.status === 'completed' ? 'success' : taskStatus.status === 'failed' ? 'danger' : 'info'}>
                  {taskStatus.status === 'completed' ? t('common.status_completed') : taskStatus.status === 'failed' ? t('common.status_failed') : t('common.status_processing')}
                </Badge>
              </div>
              {taskStatus.status === 'processing' && (
                <div className="mt-2 w-full bg-surface-200 rounded-full h-2">
                  <div className="bg-primary-500 h-2 rounded-full transition-all" style={{ width: `${taskStatus.progress_pct}%` }} />
                </div>
              )}
            </div>
          )}

          {toolResult && (
            <div className="bg-white rounded-lg border border-surface-200">
              <div className="flex border-b border-surface-200">
                <button onClick={() => setResultTab('result')} className={`flex-1 px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${resultTab === 'result' ? 'text-primary-700 border-b-2 border-primary-500' : 'text-surface-500 hover:text-surface-700'}`}>
                  {t('editor.result')}
                </button>
                {resultStats && Object.keys(resultStats).length > 0 && (
                  <button onClick={() => setResultTab('stats')} className={`flex-1 px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${resultTab === 'stats' ? 'text-primary-700 border-b-2 border-primary-500' : 'text-surface-500 hover:text-surface-700'}`}>
                    {t('editor.stats')}
                  </button>
                )}
              </div>
              <div className="p-3 max-h-80 overflow-y-auto">
                {resultTab === 'result' ? (
                  <pre className="text-xs text-surface-600 whitespace-pre-wrap">{toolResult}</pre>
                ) : (
                  <StatsCards stats={resultStats} />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="p-4 border-t border-surface-200 space-y-2">
        <Link to={`/documents/${docId}/versions`} className="block text-sm text-surface-600 hover:text-primary-600">{t('editor.version_history')}</Link>
        <Link to={`/documents/${docId}/collaboration`} className="block text-sm text-surface-600 hover:text-primary-600">{t('editor.collaboration')}</Link>
      </div>
    </div>
  );
}
