import type { GitHubRepo } from '@/types';

interface RepoListProps {
  repos: GitHubRepo[];
  onSelect: (repo: GitHubRepo) => void;
  isLoading: boolean;
  searchQuery?: string;
}

export default function RepoList({ repos, onSelect, isLoading }: RepoListProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-surface-200 p-5 animate-pulse">
            <div className="h-4 bg-surface-100 rounded w-3/4 mb-3" />
            <div className="h-3 bg-surface-100 rounded w-full mb-2" />
            <div className="h-3 bg-surface-100 rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  if (repos.length === 0) {
    return (
      <div className="text-center py-12 text-surface-500">
        <p>No repositories found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {repos.map((repo) => (
        <button
          key={repo.id}
          onClick={() => onSelect(repo)}
          className="bg-white rounded-xl border border-surface-200 p-5 text-left hover:border-primary-300 hover:shadow-sm transition-all cursor-pointer"
        >
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-surface-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            <h3 className="font-semibold text-surface-900 truncate">{repo.name}</h3>
            {repo.private && (
              <span className="text-surface-300 flex-shrink-0">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z"/></svg>
              </span>
            )}
          </div>
          {repo.description && (
            <p className="text-sm text-surface-500 line-clamp-2 mb-3">{repo.description}</p>
          )}
          <span className="text-xs text-surface-400 bg-surface-50 px-2 py-1 rounded">{repo.default_branch}</span>
        </button>
      ))}
    </div>
  );
}
