/**
 * 找服务页（规划 v2「找服务」Tab）— 服务商列表，功能即将上线占位
 */
import { useTranslation } from 'react-i18next';

export default function FindServices() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-50 text-4xl">
          🔍
        </div>
        <h1 className="mb-2 text-2xl font-bold">{t('common:nav.findServices')}</h1>
        <p className="text-gray-500">{t('common:placeholder.comingSoon')}</p>
      </main>
    </div>
  );
}
