import { Link } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';

const enFeatures: Record<string, string[]> = {
  novice: ['10 documents/month', '20 AI calls/month', '100 MB storage', 'Basic file types', 'Up to 50K chars/doc'],
  white_collar: ['50 documents/month', '100 AI calls/month', '500 MB storage', 'Image support', 'Async processing', 'Collaboration (up to 3)', 'Up to 200K chars/doc'],
  professional: ['200 documents/month', '500 AI calls/month', '2 GB storage', 'No char limit', 'Collaboration (up to 10)', 'Priority processing'],
  enterprise: ['Unlimited documents', 'Unlimited AI calls', '50 GB storage', 'API access', 'Unlimited collaborators', 'Custom integrations'],
};

const zhFeatures: Record<string, string[]> = {
  novice: ['每月10份文档', '每月20次AI调用', '100 MB存储空间', '基础文件类型', '每篇最多5万字符'],
  white_collar: ['每月50份文档', '每月100次AI调用', '500 MB存储空间', '支持图片文件', '异步处理', '协作功能（最多3人）', '每篇最多20万字符'],
  professional: ['每月200份文档', '每月500次AI调用', '2 GB存储空间', '无字符限制', '协作功能（最多10人）', '优先处理队列'],
  enterprise: ['文档数量无限制', 'AI调用无限制', '50 GB存储空间', 'API接口访问', '协作者数量无限制', '自定义集成'],
};

const featureKeys = ['feature_1', 'feature_2', 'feature_3', 'feature_4'] as const;

const featureIcons = [
  <svg key="f1" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>,
  <svg key="f2" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
  </svg>,
  <svg key="f3" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
  </svg>,
  <svg key="f4" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>,
];

const tierKeys = ['novice', 'white_collar', 'professional', 'enterprise'] as const;

export default function Landing() {
  const { t, i18n } = useTranslation();
  const { isAuthenticated } = useAuth();
  const featureMap = i18n.language?.startsWith('zh') ? zhFeatures : enFeatures;

  const tierPrices = [t('landing.price_free'), '$9.99/mo', '$29.99/mo', '$99.99/mo'];
  const tierPopular = [false, true, false, false];

  return (
    <div>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32 text-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-surface-900">
          <Trans i18nKey="landing.hero_title">
            Your Documents, <span className="text-primary-600">Intelligently</span> Transformed
          </Trans>
        </h1>
        <p className="mt-6 text-lg md:text-xl text-surface-500 max-w-2xl mx-auto leading-relaxed">
          {t('landing.hero_desc')}
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          {isAuthenticated ? (
            <Link to="/dashboard"><Button size="lg">{t('landing.go_dashboard')}</Button></Link>
          ) : (
            <>
              <Link to="/register"><Button size="lg">{t('landing.start_free')}</Button></Link>
              <Link to="/login"><Button variant="outline" size="lg">{t('nav.signIn')}</Button></Link>
            </>
          )}
        </div>
      </section>

      <section className="bg-white border-y border-surface-200 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-surface-900">{t('landing.features_title')}</h2>
          <p className="mt-4 text-center text-surface-500 max-w-xl mx-auto">{t('landing.features_desc')}</p>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {featureKeys.map((key, i) => (
              <div key={key} className="text-center">
                <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center mx-auto">
                  {featureIcons[i]}
                </div>
                <h3 className="mt-4 font-semibold text-surface-900">{t(`landing.${key}_title`)}</h3>
                <p className="mt-2 text-sm text-surface-500 leading-relaxed">{t(`landing.${key}_desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-surface-900">{t('landing.pricing_title')}</h2>
          <p className="mt-4 text-center text-surface-500">{t('landing.pricing_desc')}</p>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {tierKeys.map((key, i) => (
              <div key={key} className={`relative rounded-xl border p-6 ${tierPopular[i] ? 'border-primary-500 ring-2 ring-primary-500' : 'border-surface-200'}`}>
                {tierPopular[i] && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-600 text-white text-xs font-medium px-3 py-1 rounded-full">
                    {t('landing.popular')}
                  </span>
                )}
                <h3 className="text-lg font-semibold text-surface-900">{t(`landing.tier_${key}`)}</h3>
                <p className="mt-2 text-3xl font-bold text-surface-900">{tierPrices[i]}</p>
                <ul className="mt-6 space-y-3">
                  {featureMap[key].map((f: string) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-surface-600">
                      <svg className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-primary-600 py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white">{t('landing.cta_title')}</h2>
          <p className="mt-4 text-primary-100 text-lg">{t('landing.cta_desc')}</p>
          <div className="mt-8">
            <Link to="/register">
              <Button size="lg" className="bg-white !text-primary-600 hover:bg-primary-50">{t('landing.cta_button')}</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
