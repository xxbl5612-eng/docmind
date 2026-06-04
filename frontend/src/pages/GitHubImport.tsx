import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { githubApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import RepoList from '@/components/github/RepoList';
import FileBrowser from '@/components/github/FileBrowser';
import FilePreview from '@/components/github/FilePreview';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import type { GitHubRepo, ApiResponse } from '@/types';

type Step = 'repos' | 'files' | 'preview';

export default function GitHubImport() {
  const { t } = useTranslation();
  const { githubAccounts } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('repos');
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [selectedFile, setSelectedFile] = useState('');
  const [search, setSearch] = useState('');

  const hasGitHubLinked = githubAccounts.some(a => a.provider === 'github');

  const { data: repos, isLoading } = useQuery({
    queryKey: ['github-repos', search],
    queryFn: async () => {
      const params: { search?: string; page?: number; page_size?: number } = { page_size: 30 };
      if (search) params.search = search;
      const { data } = await githubApi.listRepos(params);
      return (data as ApiResponse<GitHubRepo[]>).data || [];
    },
    staleTime: 300_000,
  });

  if (!hasGitHubLinked) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <svg className="w-16 h-16 mx-auto mb-4 text-surface-300" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
        <h1 className="text-2xl font-bold text-surface-900 mb-2">{t('github.connect_github_first')}</h1>
        <p className="text-surface-500 mb-6">{t('github.connect_github_first_desc')}</p>
        <Button onClick={() => navigate('/settings')}>{t('github.go_to_settings')}</Button>
      </div>
    );
  }

  const handleRepoSelect = (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    setStep('files');
  };

  const handleFileSelect = (filePath: string) => {
    setSelectedFile(filePath);
    setStep('preview');
  };

  const handleBackToFiles = () => setStep('files');
  const handleBackToRepos = () => {
    setStep('repos');
    setSelectedRepo(null);
    setSelectedFile('');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{t('github.title')}</h1>
          <p className="text-sm text-surface-500 mt-1">{t('github.subtitle')}</p>
        </div>
        {step !== 'repos' && (
          <Button variant="outline" size="sm" onClick={handleBackToRepos}>
            {t('github.back_to_repos')}
          </Button>
        )}
      </div>

      {step === 'repos' && (
        <>
          <div className="mb-6">
            <Input
              placeholder={t('github.search_repos')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <RepoList repos={repos || []} onSelect={handleRepoSelect} isLoading={isLoading} />
        </>
      )}

      {step === 'files' && selectedRepo && (
        <div className="bg-white rounded-xl border border-surface-200 p-6">
          <h2 className="font-semibold text-lg text-surface-900 mb-4">{selectedRepo.full_name}</h2>
          <FileBrowser
            owner={selectedRepo.full_name.split('/')[0]}
            repo={selectedRepo.name}
            onImport={handleFileSelect}
          />
        </div>
      )}

      {step === 'preview' && selectedRepo && (
        <div className="bg-white rounded-xl border border-surface-200 p-6">
          <h2 className="font-semibold text-lg text-surface-900 mb-4">
            {t('github.file_preview')}: {selectedFile}
          </h2>
          <FilePreview
            owner={selectedRepo.full_name.split('/')[0]}
            repo={selectedRepo.name}
            filePath={selectedFile}
            onBack={handleBackToFiles}
            onImported={() => navigate('/dashboard')}
          />
        </div>
      )}
    </div>
  );
}
