/**
 * SiteFooter — 全站页脚（多列结构，沿用红色主题；与首页一致）
 * 抽出为独立组件，供首页、我的作品等页面复用，避免重复维护。
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// 页脚「服务」列所需的服务商 key（名称取自 i18n）
const PROVIDER_KEYS = ['design', 'photo', 'venue', 'floral', 'ritual', 'show'] as const;

export default function SiteFooter() {
  const { t } = useTranslation('common');

  return (
    <footer className="mt-10 bg-gradient-to-b from-[#a3163a] to-[#7d1029] px-6 py-12 text-white">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-3">
        <div>
          <div className="text-xl font-extrabold tracking-tight">{t('app.name')}</div>
          <p className="mt-3 max-w-xs text-sm text-white/70">{t('footer.tagline')}</p>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-bold">{t('footer.design')}</h4>
          <ul className="space-y-2 text-sm text-white/70">
            <li>
              <Link to="/templates" className="transition hover:text-white">
                {t('footer.designWorkshop')}
              </Link>
            </li>
            <li>
              <Link to="/templates" className="transition hover:text-white">
                {t('footer.templates')}
              </Link>
            </li>
            <li>
              <Link to="/find-services" className="transition hover:text-white">
                {t('footer.custom')}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-bold">{t('footer.services')}</h4>
          <ul className="space-y-2 text-sm text-white/70">
            {PROVIDER_KEYS.map((key) => (
              <li key={key}>
                <Link to="/find-services" className="transition hover:text-white">
                  {t(`providers.${key}.name`)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

      </div>

      <div className="mx-auto mt-8 max-w-7xl border-t border-white/15 pt-5 text-center text-xs text-white/50">
        {t('home.footer')}
      </div>
    </footer>
  );
}
