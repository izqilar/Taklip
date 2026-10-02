import { useEffect, useState, type ReactNode } from 'react';
import { T } from '../../config/theme';
import { t } from '../../i18n/t';
import { dataProvider } from '../../providers/dataProvider';
import { formatCents } from '../../utility';
import { TierBadge } from './TierBadge';

interface TierBreakdown {
  role: string | null;
  tier: number;
  score: number;
  updatedAt: string | null;
  agent?: { gmvCents: number; effectiveProviders: number };
  provider?: { gmvCents: number; completedOrders: number; avgRating: number; reviewCount: number };
}

/**
 * 贡献明细卡（只读）：调用 GET admin/tier-metrics/:id，展示当前牌级 + 关键贡献指标。
 * 金额统一走 formatCents（¥），涨用红（T.upInk）。无评价时评分显示「—」。
 * 缺失 i18n 键走 defaultValue 兜底（pages.tier.* 已入库，新键以 defaultValue 保证不出现原键）。
 */
export function TierBreakdownCard({ userId, kind }: { userId: string; kind: 'agent' | 'provider' }) {
  const [data, setData] = useState<TierBreakdown | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setLoading(true);
    dataProvider
      .custom!({ url: `admin/tier-metrics/${userId}`, method: 'get' })
      .then((r: any) => {
        if (alive) setData(r?.data ?? r ?? null);
      })
      .catch(() => {
        if (alive) setData(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  if (loading) {
    return (
      <div style={{ marginTop: 10, fontSize: 12.5, color: T.ink3 }}>{t('common.loading', '加载中…')}</div>
    );
  }
  if (!data) return null;

  const rows: { label: string; value: ReactNode }[] =
    kind === 'agent'
      ? [
          {
            label: t('pages.col.platformGmv'),
            value: <b style={{ color: T.upInk }}>{formatCents(data.agent?.gmvCents ?? 0)}</b>,
          },
          {
            label: t('pages.tier.effectiveProviders', '有效下属'),
            value: data.agent?.effectiveProviders ?? 0,
          },
        ]
      : [
          {
            label: t('pages.col.platformGmv'),
            value: <b style={{ color: T.upInk }}>{formatCents(data.provider?.gmvCents ?? 0)}</b>,
          },
          { label: t('pages.col.dealOrders'), value: data.provider?.completedOrders ?? 0 },
          {
            label: t('pages.tier.avgRating', '平均评分'),
            value:
              data.provider && data.provider.reviewCount > 0 ? data.provider.avgRating.toFixed(2) : '—',
          },
        ];

  return (
    <div
      style={{
        marginTop: 10,
        padding: 12,
        borderRadius: 10,
        background: T.accentSoft,
        border: `1px solid ${T.accentSoft}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: T.ink2 }}>
          {t('pages.tier.contribution', '贡献等级')}
        </span>
        <TierBadge kind={kind} tier={data.tier} size="sm" />
      </div>
      <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: 12.5, margin: 0 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'contents' }}>
            <dt style={{ color: T.ink3 }}>{r.label}</dt>
            <dd style={{ color: T.ink1, fontWeight: 600, margin: 0 }}>{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default TierBreakdownCard;
