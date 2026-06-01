import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { githubApi } from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import ReactMarkdown from 'react-markdown';
import type { ApiResponse } from '@/types';

interface FilePreviewProps {
  owner: string;
  repo: string;
  filePath: string;
  onBack: () => void;
  onImported: () => void;
}

export default function FilePreview({ owner, repo, filePath, onBack, onImported }: FilePreviewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [folder, setFolder] = useState('');

  const { data: fileContent, isLoading } = useQuery({
    queryKey: ['github-file', owner, repo, filePath],
    queryFn: async () => {
      const { data } = await githubApi.getFile(owner, repo, filePath);
      return (data as ApiResponse<{ path: string; content: string; sha: string; size: number }>).data;
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      await githubApi.importFile(`${owner}/${repo}`, filePath, folder || undefined);
    },
    onSuccess: () => {
      toast('File imported successfully', 'success');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      onImported();
    },
    onError: () => {
      toast('Failed to import file', 'error');
    },
  });

  const preview = fileContent?.content ? fileContent.content.slice(0, 500) : '';

  return (
    <div>
      <button onClick={onBack} className="text-sm text-surface-500 hover:text-primary-600 mb-4 flex items-center gap-1 transition-colors">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
        Back to file list
      </button>

      <div className="bg-white rounded-xl border border-surface-200 p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-surface-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z"/></svg>
          <h3 className="font-semibold text-surface-900">{filePath.split('/').pop()}</h3>
          {fileContent && <span className="text-xs text-surface-400">{fileContent.size} bytes</span>}
        </div>

        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-3 bg-surface-100 rounded w-full" />
            <div className="h-3 bg-surface-100 rounded w-5/6" />
            <div className="h-3 bg-surface-100 rounded w-4/6" />
          </div>
        ) : (
          <div className="prose prose-sm max-h-48 overflow-y-auto bg-surface-50 rounded-lg p-4">
            {preview ? (
              <ReactMarkdown>{preview}</ReactMarkdown>
            ) : (
              <p className="text-surface-400">No preview available</p>
            )}
            {fileContent?.content && fileContent.content.length > 500 && (
              <p className="text-xs text-surface-400 mt-2">Showing first 500 characters...</p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Input
            label="DocMind folder (optional)"
            placeholder="e.g. imported/github"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
          />
        </div>
        <Button onClick={() => importMutation.mutate()} loading={importMutation.isPending}>
          Import to DocMind
        </Button>
      </div>
    </div>
  );
}
