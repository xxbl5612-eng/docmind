import { cn } from '@/lib/utils';

const formatStyles: Record<string, string> = {
  pdf: 'bg-red-100 text-red-600',
  docx: 'bg-blue-100 text-blue-600',
  doc: 'bg-blue-100 text-blue-600',
  pptx: 'bg-orange-100 text-orange-600',
  xlsx: 'bg-green-100 text-green-600',
  csv: 'bg-green-100 text-green-600',
  png: 'bg-purple-100 text-purple-600',
  jpg: 'bg-purple-100 text-purple-600',
  jpeg: 'bg-purple-100 text-purple-600',
  txt: 'bg-slate-100 text-slate-600',
  md: 'bg-amber-100 text-amber-600',
  html: 'bg-cyan-100 text-cyan-600',
};

const formatLabels: Record<string, string> = {
  pdf: 'PDF', docx: 'DOC', doc: 'DOC', pptx: 'PPT', xlsx: 'XLS', csv: 'CSV',
  png: 'IMG', jpg: 'IMG', jpeg: 'IMG', txt: 'TXT', md: 'MD', html: 'HTML',
};

interface Props { format: string; className?: string; }

export default function FileIcon({ format, className }: Props) {
  const fmt = format.toLowerCase();
  const style = formatStyles[fmt] || 'bg-gray-100 text-gray-600';
  const label = formatLabels[fmt] || fmt.toUpperCase().slice(0, 3);
  return (
    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0', style, className)}>
      {label}
    </div>
  );
}

export { formatStyles, formatLabels };
