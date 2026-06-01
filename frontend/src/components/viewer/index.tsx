import { registerViewer } from './ViewerRegistry';
import PptxViewer from './PptxViewer';
import ImageViewer from './ImageViewer';
import PdfViewer from './PdfViewer';
import TextViewer from './TextViewer';
import type { ViewerProps } from '@/types';

// PPTX - slides with text toggle
registerViewer({
  formats: ['pptx'],
  component: ({ docId }: ViewerProps) => <PptxViewer docId={docId} />,
  defaultView: 'preview',
  label: 'Slide View',
  icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
});

// Images - image with zoom + text toggle
registerViewer({
  formats: ['png', 'jpg', 'jpeg'],
  component: ({ docId }: ViewerProps) => <ImageViewer docId={docId} />,
  defaultView: 'preview',
  label: 'Image View',
  icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
});

// PDF - canvas rendering
registerViewer({
  formats: ['pdf'],
  component: ({ docId }: ViewerProps) => <PdfViewer docId={docId} />,
  defaultView: 'preview',
  label: 'PDF View',
  icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
});

// Text-based formats
const textFormats = ['docx', 'xlsx', 'csv', 'txt', 'md', 'html', 'doc'];
registerViewer({
  formats: textFormats,
  component: ({ content, onContentChange }: ViewerProps) => (
    <TextViewer content={content} onContentChange={onContentChange} />
  ),
  defaultView: 'text',
  label: 'Text View',
  icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
});
