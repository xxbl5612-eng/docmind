import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { slideApi } from '@/lib/api';
import type { ApiResponse, SlidesResponse, SlideData, SlideShape, SlideParagraph } from '@/types';

interface Props {
  docId: string;
}

function SlideImage({ docId, slideIdx }: { docId: string; slideIdx: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const res = await fetch(`/api/v1/documents/${docId}/slides/render/${slideIdx}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed');
        const blob = await res.blob();
        if (!cancelled) setUrl(URL.createObjectURL(blob));
      } catch {
        if (!cancelled) setError(true);
      }
    };
    load();
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [docId, slideIdx]);

  if (error) return <div className="flex items-center justify-center h-full text-surface-400 text-sm">加载失败</div>;
  if (!url) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-2 border-slate-300 border-t-primary-500 rounded-full animate-spin" /></div>;
  return <img src={url} alt={`Slide ${slideIdx + 1}`} className="max-w-full max-h-full shadow-xl rounded" />;
}

function ShapeImage({ docId, slideIdx, imageIdx, maxW, maxH }: {
  docId: string; slideIdx: number; imageIdx: number; maxW: number; maxH: number;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const load = async () => {
      try {
        const { data } = await slideApi.getSlideImage(docId, slideIdx, imageIdx);
        if (!cancelled) {
          objectUrl = URL.createObjectURL(data as Blob);
          setUrl(objectUrl);
          setError(false);
        }
      } catch {
        if (!cancelled) {
          // Retry once after 500ms
          if (retryCount < 1) {
            setTimeout(() => { if (!cancelled) setRetryCount(c => c + 1); }, 500);
          } else {
            setError(true);
          }
        }
      }
    };

    load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [docId, slideIdx, imageIdx, retryCount]);

  if (error) {
    return (
      <div className="flex items-center justify-center bg-slate-100/50 text-slate-400 text-xs border border-dashed border-slate-300 rounded"
        style={{ width: maxW, height: maxH }}>
        <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex items-center justify-center bg-slate-100/50"
        style={{ width: maxW, height: maxH }}>
        <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt="slide"
      className="w-full h-full object-contain"
      draggable={false}
    />
  );
}

function RichParagraph({ p, defaultFontSize, scale }: {
  p: SlideParagraph; defaultFontSize: number; scale: number;
}) {
  const fontSize = defaultFontSize * scale;
  const indent = (p.level || 0) * 16;
  const bullet = p.bullet_type === 'bullet' ? (p.bullet_char || '●') : null;

  const textAlign = (p.alignment as 'left' | 'center' | 'right' | 'justify') || 'left';

  const content = p.runs && p.runs.length > 0 ? (
    p.runs.map((r, i) => (
      <span
        key={i}
        style={{
          fontWeight: r.bold ? 700 : 400,
          fontStyle: r.italic ? 'italic' : 'normal',
          fontSize: (r.font_size ?? defaultFontSize) * scale,
          color: r.color?.startsWith('#') ? r.color : undefined,
          fontFamily: r.font_name ?? undefined,
        }}
      >
        {r.text}
      </span>
    ))
  ) : p.text;

  if (!content) return null;

  return (
    <p style={{ textAlign, fontSize, margin: 0, lineHeight: 1.3, marginLeft: indent }}>
      {bullet && <span style={{ marginRight: 6, fontSize: fontSize * 0.7 }}>{bullet}</span>}
      {content}
    </p>
  );
}

function buildShapeStyle(shape: SlideShape, scale: number): React.CSSProperties {
  const l = shape.left * scale;
  const t = shape.top * scale;
  const w = shape.width * scale;
  const h = shape.height * scale;

  const style: React.CSSProperties = {
    position: 'absolute',
    left: l,
    top: t,
    width: w,
    height: h,
    overflow: 'hidden',
    wordBreak: 'break-word',
    boxSizing: 'border-box',
  };

  // Fill
  if (shape.fill_type === 'solid' && shape.fill_color) {
    style.backgroundColor = shape.fill_color;
  } else if (shape.fill_type === 'gradient' && shape.gradient_stops?.length) {
    const stops = shape.gradient_stops
      .map(s => `${s.color} ${Math.round(s.position * 100)}%`)
      .join(', ');
    style.background = `linear-gradient(${shape.gradient_angle || 0}deg, ${stops})`;
  }

  // Border
  if (shape.border_color) {
    style.borderColor = shape.border_color;
    style.borderWidth = `${shape.border_width || 1}px`;
    style.borderStyle = (shape.border_style as any) || 'solid';
  }
  if (shape.border_radius) {
    style.borderRadius = `${shape.border_radius}px`;
  }

  // Effects
  if (shape.rotation) {
    style.transform = `rotate(${shape.rotation}deg)`;
  }
  if (shape.shadow) {
    style.boxShadow = '2px 3px 8px rgba(0,0,0,0.18)';
  }

  return style;
}

function ShapeElement({ shape, docId, slideIdx, scale }: {
  shape: SlideShape; docId: string; slideIdx: number; scale: number;
}) {
  const w = shape.width * scale;
  const h = shape.height * scale;
  const style = buildShapeStyle(shape, scale);

  switch (shape.shape_type) {
    case 'picture':
      return (
        <div style={{ ...style, padding: 0 }}>
          <ShapeImage docId={docId} slideIdx={slideIdx} imageIdx={shape.image_index!} maxW={w} maxH={h} />
        </div>
      );

    case 'table': {
      const td = shape.table_data;
      if (!td?.rows) return null;
      return (
        <div style={{ ...style, overflow: 'auto', padding: 0 }}>
          <table className="w-full border-collapse text-[10px]">
            {td.col_widths && (
              <colgroup>{td.col_widths.map((cw, i) => <col key={i} style={{ width: `${cw * 100}%` }} />)}</colgroup>
            )}
            <tbody>
              {td.rows.map((row, ri) => (
                <tr key={ri} className={ri < (td.header_count || 0) ? 'font-bold' : ''}>
                  {row.map((cell, ci) => {
                    const styl = td.cell_styles?.find(s => s.row === ri && s.col === ci);
                    if (styl && (styl.colspan === 0 || styl.rowspan === 0)) return null;
                    return (
                      <td key={ci}
                        colSpan={styl?.colspan || 1}
                        rowSpan={styl?.rowspan || 1}
                        style={{
                          border: '1px solid #cbd5e1',
                          padding: '1px 4px',
                          backgroundColor: (ri < (td.header_count || 0)) ? '#f1f5f9' : (styl?.bg_color || undefined),
                          fontWeight: (ri < (td.header_count || 0)) ? 700 : (styl?.bold ? 700 : 400),
                          textAlign: (styl?.align as any) || 'left',
                        }}
                      >
                        {cell}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    default: {
      const fontSize = shape.font_size ?? 18;
      const titleScale = shape.is_title ? 1.1 : 1;
      const textStyle = { ...style, padding: '2px 4px' };

      return (
        <div style={textStyle}>
          {shape.paragraphs.length > 0 ? (
            shape.paragraphs.map((p, pi) => (
              <RichParagraph key={pi} p={p} defaultFontSize={fontSize * titleScale} scale={scale} />
            ))
          ) : shape.text ? (
            <p style={{
              fontSize: fontSize * scale * titleScale,
              fontWeight: shape.font_bold ? 700 : 400,
              fontStyle: shape.font_italic ? 'italic' : 'normal',
              color: shape.font_color?.startsWith('#') ? shape.font_color : undefined,
              fontFamily: shape.font_name ?? undefined,
              textAlign: (shape.alignment as 'left' | 'center' | 'right' | 'justify') || 'left',
              margin: 0,
              lineHeight: 1.3,
            }}>
              {shape.text}
            </p>
          ) : null}
        </div>
      );
    }
  }
}

function SlideRenderer({ slide, docId }: { slide: SlideData; docId: string }) {
  const maxW = 960;
  const scale = Math.min(1, maxW / slide.width_px);
  const w = slide.width_px * scale;
  const h = slide.height_px * scale;

  let bgStyle: string = slide.bg_color || '#ffffff';
  if (slide.bg_fill_type === 'gradient' && slide.bg_gradient_stops?.length >= 2) {
    const stops = slide.bg_gradient_stops
      .map(s => `${s.color} ${Math.round(s.position * 100)}%`)
      .join(', ');
    bgStyle = `linear-gradient(${slide.bg_gradient_angle || 0}deg, ${stops})`;
  }

  return (
    <div
      className="relative mx-auto shadow-xl"
      style={{
        width: w,
        height: h,
        overflow: 'hidden',
        background: bgStyle,
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 2,
      }}
    >
      {slide.shapes.map((shape) => (
        <ShapeElement key={shape.shape_idx} shape={shape} docId={docId} slideIdx={slide.slide_index} scale={scale} />
      ))}
      <div className="absolute bottom-2 right-3 text-[10px] text-slate-400 select-none">
        {slide.slide_index + 1}
      </div>
    </div>
  );
}

export default function PptxViewer({ docId }: Props) {
  const { t } = useTranslation();
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renderMode, setRenderMode] = useState<'interactive' | 'pandoc' | 'images'>('images');
  const [pandocHtml, setPandocHtml] = useState<string | null>(null);
  const [pandocLoading, setPandocLoading] = useState(false);
  const [slideImageCount, setSlideImageCount] = useState(0);
  const [imageSlides, setImageSlides] = useState<number[]>([]);

  // Load rendered slide count on mount
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    fetch(`/api/v1/documents/${docId}/slides/render-count`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        if (d.data?.count) {
          setSlideImageCount(d.data.count);
          setImageSlides(Array.from({ length: d.data.count }, (_, i) => i));
        }
      })
      .catch(() => {});
  }, [docId]);

  const loadPandocRender = useCallback(async () => {
    if (pandocHtml) { setRenderMode('pandoc'); return; }
    setPandocLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`/api/v1/documents/${docId}/pandoc-render`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPandocHtml(await res.text());
        setRenderMode('pandoc');
      }
    } catch { /* ignore */ }
    finally { setPandocLoading(false); }
  }, [docId, pandocHtml]);

  // Build slide image URL
  const slideImageUrl = (idx: number) => {
    const token = localStorage.getItem('access_token');
    return `/api/v1/documents/${docId}/slides/render/${idx}`;
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    slideApi.getSlides(docId)
      .then(({ data }) => {
        const res = data as ApiResponse<SlidesResponse>;
        if (res.data?.slides) {
          setSlides(res.data.slides);
          setCurrentSlide(0);
        }
      })
      .catch((err) => {
        setError(err?.response?.data?.detail || err?.message || 'Failed to load slides');
      })
      .finally(() => setLoading(false));
  }, [docId]);

  const goTo = useCallback((idx: number) => {
    if (idx >= 0 && idx < slides.length) setCurrentSlide(idx);
  }, [slides.length]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') goTo(currentSlide - 1);
    else if (e.key === 'ArrowRight') goTo(currentSlide + 1);
    else if (e.key === 'Home') goTo(0);
    else if (e.key === 'End') goTo(slides.length - 1);
  }, [currentSlide, goTo, slides.length]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        <p className="text-surface-500 text-sm">{t('common.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-surface-500">
        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-surface-400 text-sm">
        No slides
      </div>
    );
  }

  const slide = slides[currentSlide];

  // Image rendering mode: high-fidelity PNG images via Pandoc + PyMuPDF
  // Image render mode: PowerPoint COM → PNG, displayed via authenticated fetch
  if (renderMode === 'images') {
    const totalSlides = slides.length || slideImageCount;
    return (
      <div className="flex flex-col h-full bg-slate-100">
        <div className="flex flex-1 overflow-hidden">
          {/* Thumbnail numbers */}
          <div className="w-32 flex-shrink-0 overflow-y-auto bg-slate-200/70 border-r border-slate-200 p-2 space-y-1 hidden sm:block">
            {Array.from({ length: totalSlides }, (_, i) => (
              <div key={i} onClick={() => goTo(i)}
                className={`cursor-pointer rounded-lg px-3 py-2 text-center text-sm font-medium transition-all ${
                  i === currentSlide ? 'bg-primary-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-300/50'
                }`}>
                {i + 1}
              </div>
            ))}
          </div>
          {/* Main slide - PowerPoint rendered PNG */}
          <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-start justify-center bg-slate-50">
            <SlideImage docId={docId} slideIdx={currentSlide} />
          </div>
        </div>
        {/* Nav */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 bg-white">
          <div className="flex items-center gap-2">
            <button onClick={() => goTo(0)} disabled={currentSlide === 0}
              className="px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 rounded disabled:opacity-30 cursor-pointer">|&lt;</button>
            <button onClick={() => goTo(currentSlide - 1)} disabled={currentSlide === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              {t('editor.prev')}
            </button>
            <button onClick={() => goTo(currentSlide + 1)} disabled={currentSlide >= totalSlides - 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer">
              {t('editor.next')}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
            <button onClick={() => goTo(totalSlides - 1)} disabled={currentSlide >= totalSlides - 1}
              className="px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 rounded disabled:opacity-30 cursor-pointer">&gt;|</button>
          </div>
          <span className="text-sm font-medium text-slate-600 tabular-nums">{currentSlide + 1} / {totalSlides}</span>
          <button onClick={() => setRenderMode('interactive')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 cursor-pointer">交互模式</button>
        </div>
      </div>
    );
  }

  // Pandoc render mode: high-fidelity HTML in iframe
  if (renderMode === 'pandoc') {
    if (pandocLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-surface-500 text-sm">Pandoc 渲染中...</p>
        </div>
      );
    }
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-surface-200 bg-surface-50">
          <button
            onClick={() => setRenderMode('interactive')}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium cursor-pointer"
          >
            &larr; 返回交互模式
          </button>
          <span className="text-xs text-surface-400 ml-auto">Pandoc 高保真渲染</span>
        </div>
        <iframe
          srcDoc={pandocHtml || ''}
          className="flex-1 w-full border-0"
          title="Pandoc Render"
          sandbox="allow-same-origin"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-100">
      {/* Slide thumbnails sidebar + main view */}
      <div className="flex flex-1 overflow-hidden">
        {/* Thumbnail strip */}
        <div className="w-40 flex-shrink-0 overflow-y-auto bg-slate-200/70 border-r border-slate-200 p-2 space-y-2 hidden sm:block">
          {slides.map((s, i) => (
            <div
              key={s.slide_index}
              onClick={() => goTo(i)}
              className={`cursor-pointer rounded overflow-hidden border-2 transition-all ${
                i === currentSlide
                  ? 'border-primary-500 ring-2 ring-primary-200'
                  : 'border-transparent hover:border-slate-300'
              }`}
              style={{
                aspectRatio: `${s.width_px}/${s.height_px}`,
                background: s.bg_color || '#fff',
              }}
            >
              <div className="p-1 text-[8px] leading-tight text-slate-500 truncate">
                {s.shapes.find(sh => sh.text)?.text?.slice(0, 30) || `Slide ${i + 1}`}
              </div>
              <div className="text-[9px] text-slate-400 text-right pr-1 pb-0.5">
                {i + 1}
              </div>
            </div>
          ))}
        </div>

        {/* Main slide */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-start justify-center">
          <SlideRenderer slide={slide} docId={docId} />
        </div>
      </div>

      {/* Navigation bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <button
            onClick={() => goTo(currentSlide - 1)}
            disabled={currentSlide === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-default transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('editor.prev')}
          </button>
          <button
            onClick={() => goTo(currentSlide + 1)}
            disabled={currentSlide >= slides.length - 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-default transition-colors cursor-pointer"
          >
            {t('editor.next')}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-600 tabular-nums">
            {currentSlide + 1} / {slides.length}
          </span>
          <select
            value={currentSlide}
            onChange={(e) => goTo(Number(e.target.value))}
            className="text-sm border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            {slides.map((_, i) => (
              <option key={i} value={i}>
                Slide {i + 1}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => slideImageCount > 0 ? setRenderMode('images') : loadPandocRender()}
          disabled={pandocLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 transition-colors cursor-pointer"
          title="高保真渲染 - 接近 PowerPoint 的显示效果"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          高保真
        </button>
      </div>
    </div>
  );
}
