import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { slideApi } from '@/lib/api';
import type { ApiResponse, SlidesResponse, SlideData, SlideShape, SlideParagraph } from '@/types';

interface Props {
  docId: string;
}

function ShapeImage({ docId, slideIdx, imageIdx, maxW, maxH }: {
  docId: string; slideIdx: number; imageIdx: number; maxW: number; maxH: number;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    slideApi.getSlideImage(docId, slideIdx, imageIdx)
      .then(({ data }) => {
        if (!cancelled) {
          setUrl(URL.createObjectURL(data as Blob));
        }
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [docId, slideIdx, imageIdx]);

  if (error) {
    return (
      <div className="flex items-center justify-center bg-slate-100 text-slate-400 text-xs"
        style={{ width: maxW, height: maxH }}>
        [Image]
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex items-center justify-center bg-slate-100 animate-pulse"
        style={{ width: maxW, height: maxH }}>
        <div className="w-8 h-8 bg-slate-200 rounded" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt="slide"
      style={{ maxWidth: maxW, maxHeight: maxH, objectFit: 'contain' }}
    />
  );
}

function RichParagraph({ p, defaultFontSize, scale }: {
  p: SlideParagraph; defaultFontSize: number; scale: number;
}) {
  const fontSize = defaultFontSize * scale;

  if (!p.runs || p.runs.length === 0) {
    if (!p.text) return null;
    return (
      <p style={{
        textAlign: (p.alignment as 'left' | 'center' | 'right' | 'justify') || 'left',
        fontSize,
        margin: 0,
        lineHeight: 1.3,
      }}>
        {p.text}
      </p>
    );
  }

  return (
    <p style={{
      textAlign: (p.alignment as 'left' | 'center' | 'right' | 'justify') || 'left',
      fontSize,
      margin: 0,
      lineHeight: 1.3,
    }}>
      {p.runs.map((r, i) => (
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
      ))}
    </p>
  );
}

function ShapeElement({ shape, docId, slideIdx, scale }: {
  shape: SlideShape; docId: string; slideIdx: number; scale: number;
}) {
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
    padding: '2px 4px',
    overflow: 'hidden',
    wordBreak: 'break-word',
    boxSizing: 'border-box',
  };

  if (shape.fill_color) {
    style.backgroundColor = shape.fill_color;
  }

  switch (shape.shape_type) {
    case 'picture':
      return (
        <div style={{ ...style, padding: 0 }}>
          <ShapeImage docId={docId} slideIdx={slideIdx} imageIdx={shape.image_index!} maxW={w} maxH={h} />
        </div>
      );

    case 'table':
      return (
        <div style={{ ...style, overflow: 'auto', padding: 0 }}>
          {shape.table_rows && (
            <table className="w-full border-collapse text-[10px]">
              <tbody>
                {shape.table_rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="border border-slate-300 px-1 py-0.5">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      );

    default: {
      const fontSize = shape.font_size ?? 18;
      const titleScale = shape.is_title ? 1.1 : 1;

      return (
        <div style={style}>
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

  return (
    <div
      className="relative mx-auto shadow-xl"
      style={{
        width: w,
        height: h,
        overflow: 'hidden',
        background: slide.bg_color || 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 2,
      }}
    >
      {/* Subtle slide border decoration */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-400 via-primary-500 to-primary-600 opacity-70" />
      {slide.shapes.map((shape) => (
        <ShapeElement key={shape.shape_idx} shape={shape} docId={docId} slideIdx={slide.slide_index} scale={scale} />
      ))}
      {/* Slide number */}
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
        Non-slides
      </div>
    );
  }

  const slide = slides[currentSlide];

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
    </div>
  );
}
