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
          const blobUrl = URL.createObjectURL(data as Blob);
          setUrl(blobUrl);
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
      <div className="flex items-center justify-center bg-surface-100 text-surface-400 text-xs"
        style={{ width: maxW, height: maxH }}>
        [Image]
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex items-center justify-center bg-surface-100 animate-pulse"
        style={{ width: maxW, height: maxH }}>
        <div className="w-8 h-8 bg-surface-200 rounded" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt="slide image"
      style={{ maxWidth: maxW, maxHeight: maxH, objectFit: 'contain' }}
    />
  );
}

function RichParagraph({ p, defaultFontSize }: { p: SlideParagraph; defaultFontSize: number }) {
  if (!p.runs || p.runs.length === 0) {
    if (!p.text) return null;
    return (
      <p style={{
        textAlign: p.alignment as 'left' | 'center' | 'right' | 'justify',
        fontSize: defaultFontSize,
        margin: 0,
        lineHeight: 1.5,
      }}>
        {p.text}
      </p>
    );
  }

  return (
    <p style={{
      textAlign: p.alignment as 'left' | 'center' | 'right' | 'justify',
      fontSize: defaultFontSize,
      margin: 0,
      lineHeight: 1.5,
    }}>
      {p.runs.map((r, i) => (
        <span
          key={i}
          style={{
            fontWeight: r.bold ? 700 : 400,
            fontStyle: r.italic ? 'italic' : 'normal',
            fontSize: r.font_size ?? defaultFontSize,
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

function SlideRenderer({ slide, docId }: { slide: SlideData; docId: string }) {
  const scaleFactor = Math.min(1, 960 / slide.width_px);
  const w = slide.width_px * scaleFactor;
  const h = slide.height_px * scaleFactor;

  return (
    <div
      className="relative bg-white shadow-lg ring-1 ring-black/5 mx-auto"
      style={{ width: w, height: h, overflow: 'hidden' }}
    >
      {slide.shapes.map((shape) => (
        <ShapeElement key={shape.shape_idx} shape={shape} docId={docId} slideIdx={slide.slide_index} scaleFactor={scaleFactor} />
      ))}
    </div>
  );
}

function ShapeElement({ shape, docId, slideIdx, scaleFactor }: {
  shape: SlideShape; docId: string; slideIdx: number; scaleFactor: number;
}) {
  const l = shape.left * scaleFactor;
  const t = shape.top * scaleFactor;
  const w = shape.width * scaleFactor;
  const h = shape.height * scaleFactor;

  const style: React.CSSProperties = {
    position: 'absolute',
    left: l,
    top: t,
    width: w,
    height: h,
    padding: shape.shape_type === 'text' ? '2px 4px' : 0,
    overflow: 'hidden',
    wordBreak: 'break-word',
  };

  switch (shape.shape_type) {
    case 'picture':
      return (
        <div style={style}>
          <ShapeImage docId={docId} slideIdx={slideIdx} imageIdx={shape.image_index!} maxW={w} maxH={h} />
        </div>
      );

    case 'table':
      return (
        <div style={{ ...style, overflow: 'auto' }}>
          {shape.table_rows && (
            <table className="w-full border-collapse text-[10px]">
              <tbody>
                {shape.table_rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="border border-surface-300 px-1 py-0.5">
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

    case 'text':
    default: {
      if (shape.fill_color) {
        style.backgroundColor = shape.fill_color;
      }
      const fontSize = (shape.font_size ?? 14) * scaleFactor;

      return (
        <div style={style}>
          {shape.paragraphs.length > 0 ? (
            shape.paragraphs.map((p, pi) => (
              <RichParagraph key={pi} p={p} defaultFontSize={fontSize} />
            ))
          ) : shape.text ? (
            <p style={{
              fontSize,
              fontWeight: shape.font_bold ? 700 : 400,
              fontStyle: shape.font_italic ? 'italic' : 'normal',
              color: shape.font_color?.startsWith('#') ? shape.font_color : undefined,
              fontFamily: shape.font_name ?? undefined,
              textAlign: (shape.alignment as 'left' | 'center' | 'right' | 'justify') || 'left',
              margin: 0,
              lineHeight: 1.5,
            }}>
              {shape.text}
            </p>
          ) : null}
        </div>
      );
    }
  }
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
  }, [currentSlide, goTo]);

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
        {t('editor.no_slides') ?? 'No slides found'}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Slide area */}
      <div className="flex-1 overflow-auto bg-surface-100 p-6 flex items-start justify-center">
        <SlideRenderer slide={slides[currentSlide]} docId={docId} />
      </div>

      {/* Navigation bar */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-surface-200 bg-white">
        <button
          onClick={() => goTo(currentSlide - 1)}
          disabled={currentSlide === 0}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-surface-700 hover:bg-surface-100 disabled:opacity-30 disabled:cursor-default transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t('editor.prev')}
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm text-surface-600">
            {currentSlide + 1} / {slides.length}
          </span>
          <select
            value={currentSlide}
            onChange={(e) => goTo(Number(e.target.value))}
            className="text-sm border border-surface-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
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
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-surface-700 hover:bg-surface-100 disabled:opacity-30 disabled:cursor-default transition-colors cursor-pointer"
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
