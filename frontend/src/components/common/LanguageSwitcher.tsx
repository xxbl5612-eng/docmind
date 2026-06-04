import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language?.startsWith('zh') ? 'zh' : 'en';

  const toggle = () => {
    const next = currentLang === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(next);
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 text-sm text-surface-600 hover:text-surface-900 transition-colors cursor-pointer px-2 py-1 rounded-md hover:bg-surface-100"
      aria-label={currentLang === 'zh' ? 'Switch to English' : '切换到中文'}
    >
      <span className="text-base">{currentLang === 'zh' ? '中' : 'EN'}</span>
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    </button>
  );
}
