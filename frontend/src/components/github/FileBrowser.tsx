import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { githubApi } from '@/lib/api';
import { formatBytes } from '@/lib/utils';
import type { GitHubContent, ApiResponse } from '@/types';

interface FileBrowserProps {
  owner: string;
  repo: string;
  onImport: (path: string) => void;
}

export default function FileBrowser({ owner, repo, onImport }: FileBrowserProps) {
  const [path, setPath] = useState('');

  const { data: contents, isLoading } = useQuery({
    queryKey: ['github-contents', owner, repo, path],
    queryFn: async () => {
      const { data } = await githubApi.getContents(owner, repo, path);
      return (data as ApiResponse<GitHubContent[]>).data || [];
    },
    enabled: !!owner && !!repo,
  });

  const breadcrumbs = path ? path.split('/').filter(Boolean) : [];

  const navigateTo = (newPath: string) => setPath(newPath);
  const goUp = () => {
    const parts = path.split('/').filter(Boolean);
    parts.pop();
    setPath(parts.join('/'));
  };

  const isTextFile = (name: string) => {
    const ext = name.toLowerCase();
    return ext.endsWith('.md') || ext.endsWith('.txt') || ext.endsWith('.rst') || ext.endsWith('.html') || ext.endsWith('.adoc') || ext.endsWith('.markdown') || name === 'README' || name === 'README.md';
  };

  return (
    <div>
      <div className="flex items-center gap-2 text-sm mb-4 flex-wrap">
        <button
          onClick={() => navigateTo('')}
          className={`hover:text-primary-600 transition-colors ${!path ? 'font-semibold text-primary-700' : 'text-surface-500'}`}
        >
          {owner}/{repo}
        </button>
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="text-surface-300">/</span>
            <button
              onClick={() => navigateTo(breadcrumbs.slice(0, i + 1).join('/'))}
              className={`hover:text-primary-600 transition-colors ${i === breadcrumbs.length - 1 ? 'font-semibold text-primary-700' : 'text-surface-500'}`}
            >
              {crumb}
            </button>
          </span>
        ))}
      </div>

      {path && (
        <button onClick={goUp} className="text-sm text-surface-500 hover:text-primary-600 mb-3 flex items-center gap-1 transition-colors">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          Up
        </button>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-surface-50 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="border border-surface-200 rounded-lg overflow-hidden">
          {contents?.map((item) => (
            <div
              key={item.sha}
              className="flex items-center justify-between px-4 py-3 border-b border-surface-100 last:border-b-0 hover:bg-surface-50 transition-colors"
            >
              <button
                onClick={() => item.type === 'dir' ? navigateTo(item.path) : undefined}
                className={`flex items-center gap-3 min-w-0 ${item.type === 'dir' ? 'cursor-pointer' : ''}`}
              >
                {item.type === 'dir' ? (
                  <svg className="w-5 h-5 text-amber-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                ) : (
                  <svg className="w-5 h-5 text-surface-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z"/><path d="M14 2v6h6"/></svg>
                )}
                <span className="truncate text-surface-900">{item.name}</span>
              </button>
              <div className="flex items-center gap-3 flex-shrink-0">
                {item.type === 'file' && <span className="text-xs text-surface-400">{formatBytes(item.size)}</span>}
                {item.type === 'file' && isTextFile(item.name) && (
                  <button
                    onClick={() => onImport(item.path)}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium px-2 py-1 bg-primary-50 rounded hover:bg-primary-100 transition-colors cursor-pointer"
                  >
                    Import
                  </button>
                )}
              </div>
            </div>
          ))}
          {(!contents || contents.length === 0) && (
            <div className="px-4 py-8 text-center text-surface-400">Empty directory</div>
          )}
        </div>
      )}
    </div>
  );
}
