/**
 * 优惠与权益（原型 u-coupons，严格对齐运营端）：
 * 表格（编号 / 优惠券 / 面额 / 有效期 / 使用条件 / 状态）+ 胶囊筛选（全部 / 未使用 / 已使用）
 * + 详情 + 底部「会员权益」面板。数据：GET /api/user/coupons、GET /api/user/dashboard（等级）。
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import {
  formatCents,
  StatusBadge,
  UserListPage,
  Panel,
  tierKeyOf,
  TIER_PERKS,
  type Column,
  type ChipFilterDef,
  type DetailFieldDef,
} from './shared';

export default function Coupons() {
  const { t } = useTranslation();
  const [tier, setTier] = useState('普通用户');

  useEffect(() => {
    api
      .get<any>('/api/user/dashboard')
      .then((d) => setTier(tierKeyOf(d?.profile?.vipLevel)))
      .catch(() => setTier('普通用户'));
  }, []);

  const columns: Column<any>[] = [
    { key: 'code', title: t('common:userCenter.coupons.code'), render: (r) => <span className="font-mono text-[#2a2118]">{r.code}</span> },
    { key: 'name', title: t('common:userCenter.coupons.name'), render: (r) => r.name || '—' },
    {
      key: 'amount',
      title: t('common:userCenter.coupons.amount'),
      align: 'right',
      render: (r) =>
        r.amountCents > 0 ? (
          <span className="font-mono tabular-nums">{formatCents(r.amountCents)}</span>
        ) : (
          <span className="text-[#4c4236]">{r.benefit || '—'}</span>
        ),
    },
    { key: 'validUntil', title: t('common:userCenter.coupons.validUntil'), render: (r) => (r.validUntil ? new Date(r.validUntil).toLocaleDateString('zh-CN') : '—') },
    { key: 'condition', title: t('common:userCenter.coupons.condition'), render: (r) => <span className="text-[#4c4236]">{r.condition || '—'}</span> },
    { key: 'status', title: t('common:userCenter.coupons.status'), render: (r) => <StatusBadge tone={r.status === '已使用' ? 'ok' : r.status === '已过期' ? 'mut' : 'warn'}>{r.status}</StatusBadge> },
  ];

  const filters: ChipFilterDef[] = [
    { label: t('common:userCenter.filters.all'), value: 'all' },
    { label: t('common:userCenter.status.UNUSED'), value: 'unused', test: (r) => r.status === '未使用' },
    { label: t('common:userCenter.status.USED'), value: 'used', test: (r) => r.status === '已使用' },
  ];

  const detailFields: DetailFieldDef[] = [
    { label: t('common:userCenter.coupons.code'), key: 'code' },
    { label: t('common:userCenter.coupons.name'), key: 'name' },
    { label: t('common:userCenter.coupons.amount'), key: 'amountCents', format: 'cents' },
    { label: t('common:userCenter.coupons.validUntil'), key: 'validUntil', format: 'date' },
    { label: t('common:userCenter.coupons.condition'), key: 'condition' },
  ];

  return (
    <div className="space-y-4">
      <UserListPage
        title={t('common:userCenter.coupons.title')}
        sub="优惠券与会员权益 · 券编号 CP-2001 起"
        columns={columns}
        filters={filters}
        fetcher={(page, pageSize, params) =>
          api.get<{ items: any[]; total: number }>('/api/user/coupons', { page, pageSize, ...params })
        }
        detailFields={detailFields}
        emptyText={t('common:userCenter.coupons.empty')}
      />

      <Panel title={`${tier} · ${t('common:userCenter.overview.memberBenefits')}`} hint="当前等级可享">
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {(TIER_PERKS[tier] ?? []).map((pk) => (
            <div key={pk} className="flex items-center gap-2 rounded-[6px] bg-[#f3eee7] p-3 text-sm text-[#4c4236]">
              <span className="h-1.5 w-1.5 flex-none rounded-full bg-[#c24b2e]" />
              {pk}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
