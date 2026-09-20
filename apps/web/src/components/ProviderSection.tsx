/**
 * 服务商专区（首页与我的作品页共用）
 * 6 类服务商卡片，跳转 /find-services 占位页
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export const PROVIDERS = [
  { key: 'design', icon: '🎨' },
  { key: 'photo', icon: '📷' },
  { key: 'venue', icon: '🏛️' },
  { key: 'floral', icon: '💐' },
  { key: 'ritual', icon: '🤵' },
  { key: 'show', icon: '🎤' },
] as const;

export default function ProviderSection() {
  const { t } = useTranslation('common');

  return (
    <section className="mx-auto max-w-7xl px-6 py-4">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900">{t('providers.title')}</h2>
          <p className="mt-1 text-sm text-gray-500">{t('providers.sub')}</p>
        </div>
        <Link
          to="/find-services"
          className="hidden text-sm font-semibold text-brand-600 hover:text-brand-700 sm:inline"
        >
          {t('providers.viewMore')}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {PROVIDERS.map((p) => {
          const name = t(`providers.${p.key}.name`);
          const tags = t(`providers.${p.key}.tags`, { returnObjects: true }) as unknown as string[];
          return (
            <Link
              to="/find-services"
              key={p.key}
              className="group rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-md"
            >
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-2xl">
                {p.icon}
              </div>
              <h3 className="text-base font-bold text-gray-900">{name}</h3>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {Array.isArray(tags) &&
                  tags.map((tag) => (
                    <li
                      key={tag}
                      className="rounded-md bg-gray-50 px-2 py-1 text-[11px] text-gray-500 group-hover:bg-brand-50 group-hover:text-brand-600"
                    >
                      {tag}
                    </li>
                  ))}
              </ul>
              <span className="mt-3 inline-block text-xs font-semibold text-brand-600">
                {t('providers.viewMore')}
              </span>
            </Link>
          );
        })}
      </div>

      <p className="mt-4 text-center text-xs text-gray-600">{t('providers.comingSoon')}</p>
    </section>
  );
}
