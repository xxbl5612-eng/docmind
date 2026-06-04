interface TextViewerProps {
  content: string;
  onContentChange: (content: string) => void;
}

export default function TextViewer({ content, onContentChange }: TextViewerProps) {
  return (
    <div className="p-6 overflow-y-auto h-full">
      <textarea
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        className="w-full h-full min-h-[500px] p-4 rounded-lg border border-surface-200 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
        placeholder="Document content will appear here..."
      />
    </div>
  );
}
