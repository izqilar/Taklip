/**
 * 我的钱包（原型 u-wallet，严格对齐运营端）：
 * KPI 四联（账户余额为主指标）+ 交易流水（流水号 W-1001 起）。
 * 胶囊筛选（全部 / 收入 / 支出）+ 详情（流水号 / 时间 / 类型 / 金额 / 变动后余额）。
 * 数据：GET /api/user/wallet、GET /api/user/dashboard、GET /api/user/wallet/logs。
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { formatCents, KpiCard, UserListPage, type Column, type ChipFilterDef, type DetailFieldDef } from './shared';

export default function Wallet() {
  const { t } = useTranslation();
  const [wallet, setWallet] = useState<any>(null);
  const [dash, setDash] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<any>('/api/user/wallet').catch(() => null),
      api.get<any>('/api/user/dashboard').catch(() => null),
    ])
      .then(([w, d]) => {
        setWallet(w);
        setDash(d);
      })
      .finally(() => setLoading(false));
  }, []);

  const logTone = (status?: string): 'ok' | 'warn' | 'bad' | 'default' =>
    status === '成功' ? 'ok' : status === '处理中' ? 'warn' : status === '失败' ? 'bad' : 'default';

  const columns: Column<any>[] = [
    { key: 'code', title: t('common:userCenter.wallet.logNo'), render: (r) => <span className="font-mono text-[#2a2118]">{r.code}</span> },
    { key: 'time', title: t('common:userCenter.wallet.logTime'), render: (r) => <span className="text-xs text-[#6e5f4a]">{r.createdAt ? new Date(r.createdAt).toLocaleString('zh-CN', { hour12: false }) : '—'}</span> },
    { key: 'type', title: t('common:userCenter.wallet.logType'), render: (r) => <span className="text-[#4c4236]">{r.type}</span> },
    {
      key: 'amount',
      title: t('common:userCenter.wallet.logAmount'),
      align: 'right',
      render: (r) => (
        <span className="font-mono tabular-nums" style={{ color: (r.amountCents ?? 0) >= 0 ? '#0f5a4e' : '#c02b33' }}>
          {(r.amountCents ?? 0) >= 0 ? '+' : ''}
          {formatCents(r.amountCents)}
        </span>
      ),
    },
    { key: 'balance', title: t('common:userCenter.wallet.logBalance'), align: 'right', render: (r) => <span className="font-mono tabular-nums text-[#6e5f4a]">{formatCents(r.balanceCents)}</span> },
    { key: 'status', title: t('common:userCenter.wallet.logStatus'), render: (r) => <span className="text-[#4c4236]">{r.status}</span> },
  ];

  const filters: ChipFilterDef[] = [
    { label: t('common:userCenter.filters.all'), value: 'all' },
    { label: t('common:userCenter.filters.income'), value: 'in', test: (r) => (r.amountCents ?? 0) > 0 },
    { label: t('common:userCenter.filters.expense'), value: 'out', test: (r) => (r.amountCents ?? 0) < 0 },
  ];

  const detailFields: DetailFieldDef[] = [
    { label: t('common:userCenter.wallet.logNo'), key: 'code' },
    { label: t('common:userCenter.wallet.logTime'), key: 'createdAt', format: 'date' },
    { label: t('common:userCenter.wallet.logType'), key: 'type' },
    { label: t('common:userCenter.wallet.logAmount'), key: 'amountCents', format: 'cents' },
    { label: t('common:userCenter.wallet.logBalance'), key: 'balanceCents', format: 'cents' },
  ];

  return (
    <div className="space-y-4">
      {loading && !wallet ? (
        <div className="py-12 text-center text-sm text-gray-400">{t('common:userCenter.loading')}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard main label={t('common:userCenter.wallet.balance')} value={formatCents(wallet?.balanceCents ?? 0)} delta={t('common:userCenter.wallet.balanceTip')} />
            <KpiCard label={t('common:userCenter.wallet.totalSpent')} value={formatCents(wallet?.totalSpentCents ?? 0)} delta={t('common:userCenter.wallet.totalSpentTip')} />
            <KpiCard label={t('common:userCenter.wallet.points')} value={(wallet?.points ?? 0).toLocaleString('en-US')} delta={t('common:userCenter.wallet.pointsTip')} />
            <KpiCard label={t('common:userCenter.wallet.availableCoupons')} value={String(dash?.coupons ?? 0)} delta={t('common:userCenter.wallet.availableCouponsTip')} />
          </div>

          <UserListPage
            title={t('common:userCenter.wallet.title')}
            sub="余额与流水 · 流水号 W-1001 起"
            columns={columns}
            filters={filters}
            fetcher={(page, pageSize, params) =>
              api.get<{ items: any[]; total: number }>('/api/user/wallet/logs', { page, pageSize, ...params })
            }
            detailFields={detailFields}
            emptyText={t('common:userCenter.wallet.noWallet')}
          />
        </>
      )}
    </div>
  );
}
