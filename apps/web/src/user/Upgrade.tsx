/**
 * 终端用户图库扩容套餐页（文档要求「达到上限后跳转独立扩容套餐页」）。
 * 套餐口径与后端 getLimit USER 分支一致：免费 4 / 银卡 6 / 金卡 10 / 黑金 16。
 * 下单能力尚未实现，统一以「该功能即将上线」占位。
 */
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PageHead, Panel } from './shared';

export default function Upgrade() {
  const { t } = useTranslation();
  const packages = [
    { name: t('upgrade.user.free', { defaultValue: '免费用户' }), limit: 4 },
    { name: t('upgrade.user.silver', { defaultValue: '银卡用户' }), limit: 6 },
    { name: t('upgrade.user.gold', { defaultValue: '金卡用户' }), limit: 10, highlight: true },
    { name: t('upgrade.user.black', { defaultValue: '黑金用户' }), limit: 16 },
  ];

  return (
    <div className="space-y-4">
      <PageHead title={t('upgrade.title', { defaultValue: '图库扩容套餐' })} sub={t('upgrade.sub', { defaultValue: '当前图库已达上限，升级会员档位可提升图片存储上限。' })} />

      <Panel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {packages.map((p) => (
            <div
              key={p.name}
              className={`rounded-xl border p-4 ${
                p.highlight ? 'border-[#D24830] bg-[rgba(210,72,48,0.04)]' : 'border-gray-100 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <b className="text-[14px] text-[#2a2118]">{p.name}</b>
                {p.highlight && (
                  <span className="rounded-full bg-[#D24830]/10 px-2 py-0.5 text-xs font-medium text-[#D24830]">
                    {t('upgrade.recommend', { defaultValue: '推荐' })}
                  </span>
                )}
              </div>
              <div className="mt-2 text-[26px] font-[750] tabular-nums text-[#D24830]" style={{ fontFamily: "'Bahnschrift','DIN Alternate',Arial,system-ui,sans-serif" }}>
                {p.limit}
                <span className="ml-1 text-[13px] font-normal text-gray-400">张</span>
              </div>
              <div className="mt-1 text-xs text-gray-400">{t('upgrade.cap', { defaultValue: '图片存储上限' })}</div>
              <button
                type="button"
                disabled
                className="mt-3 w-full cursor-not-allowed rounded-lg border border-gray-200 py-1.5 text-[13px] text-gray-400"
              >
                {t('upgrade.soon', { defaultValue: '即将上线' })}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-[#f3d6cd] bg-[#fff7f5] p-4 text-[13px] text-[#8f1d24]">
          {t('upgrade.notice', { defaultValue: '扩容下单能力即将上线，如需立即扩容请联系您的专属服务商或代理商。' })}{' '}
          <Link to="/user/gallery" className="font-medium text-[#D24830]">
            {t('upgrade.back', { defaultValue: '返回图库' })}
          </Link>
        </div>
      </Panel>
    </div>
  );
}
