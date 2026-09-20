/**
 * 我的工作台（个人中心首页）：严格对齐运营端 UserDashboard。
 * 资料卡 + 会员等级 + KPI 四联（主指标朱砂）+ duo（我的订单 / 会员权益）+ trio（关注的服务商 / 我的优惠券 / 我的评价）。
 * 数据：/api/user/dashboard + 各列表接口（pageSize=3）。
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import {
  formatCents,
  Stars,
  StatusBadge,
  LoadingDots,
  PageHead,
  Panel,
  KpiCard,
  UserTable,
  type Column,
  tierKeyOf,
  TIER_PERKS,
} from './shared';

interface DashboardStats {
  profile: {
    id?: string;
    nickname: string | null;
    realName: string | null;
    phone: string | null;
    vipLevel: number;
    regionName: string | null;
    createdAt: string;
  };
  balanceCents: number;
  points: number;
  pendingServiceOrders?: number;
  inServiceOrders?: number;
  totalSpentCents: number;
  monthRechargeCents?: number;
  exchangeableCoupons?: number;
  pendingReviewOrders: number;
  orders: number;
  providers: number;
  coupons: number;
  dealOrders: number;
  feedback: number;
  messages: number;
}

const orderCode = (r: any) =>
  r && r.orderNo ? `QD…${String(r.orderNo).slice(-4)}` : r?.id ?? '—';

const serviceStatusTone = (s?: string): 'warn' | 'accent' | 'ok' | 'bad' | 'default' => {
  if (s === 'pending_service') return 'warn';
  if (s === 'in_service') return 'accent';
  if (s === 'completed') return 'ok';
  if (s === 'refunded') return 'bad';
  return 'default';
};

export default function Overview() {
  const { t } = useTranslation();
  const [s, setS] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<{ orders: any[]; providers: any[]; reviews: any[]; coupons: any[] }>({
    orders: [],
    providers: [],
    reviews: [],
    coupons: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const dash = await api.get<DashboardStats>('/api/user/dashboard');
        setS(dash);
        const [o, p, r, c] = await Promise.all([
          api.get<{ items: any[] }>('/api/user/orders', { pageSize: 3 }),
          api.get<{ items: any[] }>('/api/user/providers', { pageSize: 3 }),
          api.get<{ items: any[] }>('/api/user/reviews', { pageSize: 3 }),
          api.get<{ items: any[] }>('/api/user/coupons', { pageSize: 3 }),
        ]);
        setRecent({ orders: o.items, providers: p.items, reviews: r.items, coupons: c.items });
      } catch (e: any) {
        setError(e?.message || '加载失败，请点击重试');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingDots />;
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <p className="text-sm text-[#6e5f4a]">{error}</p>
        <button
          type="button"
          onClick={load}
          className="rounded-lg bg-[#D24830] px-4 py-1.5 text-sm font-medium text-white transition hover:bg-[#B23A22]"
        >
          {t('common:button.retry')}
        </button>
      </div>
    );
  }
  if (!s) return <LoadingDots />;
  const p = s.profile;
  const tier = tierKeyOf(p.vipLevel);
  const name = p.nickname || p.realName || p.phone || t('common:userCenter.accountFallback');
  const shortId = p.id && p.id.length > 8 ? `${p.id.slice(0, 4)}…${p.id.slice(-4)}` : p.id ?? '—';
  const maskedPhone = p.phone ? `${p.phone.slice(0, 3)}****${p.phone.slice(-4)}` : '—';

  const orderCols: Column<any>[] = [
    { key: 'orderNo', title: t('common:userCenter.orders.orderNo'), render: (r) => <span className="font-mono tabular-nums text-[#2a2118]">{orderCode(r)}</span> },
    { key: 'service', title: t('common:userCenter.orders.service'), render: (r) => r.template?.name || '—' },
    { key: 'provider', title: t('common:userCenter.orders.provider'), render: (r) => r.template?.author?.nickname || '—' },
    { key: 'amount', title: t('common:userCenter.orders.amount'), align: 'right', render: (r) => <span className="font-mono tabular-nums">{formatCents(r.amount)}</span> },
    {
      key: 'status',
      title: t('common:userCenter.orders.status'),
      render: (r) => (
        <StatusBadge tone={serviceStatusTone(r.serviceStatus)}>{t(`common:userCenter.status.${r.serviceStatus ?? 'paid'}`)}</StatusBadge>
      ),
    },
  ];

  const providerCols: Column<any>[] = [
    { key: 'name', title: t('common:userCenter.providers.name'), render: (r) => r.nickname || r.realName || r.phone || '—' },
    { key: 'type', title: t('common:userCenter.providers.type'), render: (r) => <span className="text-[#4c4236]">{(r.serviceRoles || []).join(' / ') || '—'}</span> },
    { key: 'rating', title: t('common:userCenter.providers.rating'), align: 'right', render: (r) => (r.reviewed ? <Stars rating={r.rating} /> : <span className="text-xs text-[#6e5f4a]">—</span>) },
  ];

  const couponCols: Column<any>[] = [
    { key: 'name', title: t('common:userCenter.coupons.name'), render: (r) => r.name || '—' },
    { key: 'amount', title: t('common:userCenter.coupons.amount'), align: 'right', render: (r) => (r.amountCents > 0 ? <span className="font-mono tabular-nums">{formatCents(r.amountCents)}</span> : <span className="text-[#4c4236]">{r.benefit || '—'}</span>) },
    { key: 'status', title: t('common:userCenter.coupons.status'), render: (r) => <StatusBadge tone={r.status === '已使用' ? 'ok' : r.status === '已过期' ? 'mut' : 'warn'}>{r.status}</StatusBadge> },
  ];

  const reviewCols: Column<any>[] = [
    { key: 'service', title: t('common:userCenter.reviews.service'), render: (r) => r.serviceName || '—' },
    { key: 'rating', title: t('common:userCenter.reviews.rating'), align: 'right', render: (r) => <Stars rating={r.rating} /> },
    { key: 'status', title: t('common:userCenter.reviews.status'), render: (r) => <StatusBadge tone="ok">{r.status || '已发布'}</StatusBadge> },
  ];

  return (
    <div className="space-y-4">
      <PageHead
        title={t('common:userCenter.menu.overview')}
        sub={`${name} · ${tier} · 个人中心预览`}
        chip={`用户 · ${tier}`}
      />

      {/* 资料卡（原型 .ucard：暖白底 + 1px 线 + 朱砂渐变头像 + 等级 Pill + 信息行） */}
      <div className="flex flex-col gap-3 rounded-[10px] border border-[rgba(74,60,42,0.10)] bg-[#fffefb] p-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-full text-[19px] font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#D24830,#B23A22)' }}
          >
            {(name ?? 'U').slice(0, 1)}
          </span>
          <div className="flex min-w-0 items-center gap-2">
            <b className="text-[16px] text-[#2a2118]">{name}</b>
            <StatusBadge tone="accent">{tier}</StatusBadge>
          </div>
        </div>
        <div className="text-xs text-[#6e5f4a]">
          {t('common:account.accountId')} {shortId} · {t('common:userCenter.account.phone')} {maskedPhone} ·{' '}
          {p.regionName ?? t('common:userCenter.account.region')} ·{' '}
          {p.createdAt ? new Date(p.createdAt).toLocaleDateString('zh-CN') : '—'}
        </div>
      </div>

      {/* KPI 四联（与运营端同口径；主指标朱砂；间距 14px） */}
      <div className="grid grid-cols-2 gap-[14px] lg:grid-cols-4">
        <KpiCard
          main
          label={t('common:userCenter.overview.balance')}
          value={formatCents(s.balanceCents)}
          delta={s.monthRechargeCents ? `+ ${formatCents(s.monthRechargeCents)} ${t('common:userCenter.overview.monthRecharge')}` : t('common:userCenter.overview.noRecharge')}
          deltaTrend="up"
        />
        <KpiCard label={t('common:userCenter.overview.points')} value={(s.points ?? 0).toLocaleString('en-US')} delta={t('common:userCenter.overview.exchangeableCoupons', { n: s.exchangeableCoupons ?? 0 })} />
        <KpiCard
          label={t('common:userCenter.overview.activeOrders')}
          value={((s.pendingServiceOrders ?? 0) + (s.inServiceOrders ?? 0)).toString()}
          delta={`${t('common:userCenter.status.pending_service')} ${s.pendingServiceOrders ?? 0} · ${t('common:userCenter.overview.pendingReview')} ${s.pendingReviewOrders}`}
        />
        <KpiCard label={t('common:userCenter.overview.totalSpent')} value={formatCents(s.totalSpentCents)} delta={`${t('common:userCenter.menu.orders')} ${s.dealOrders}`} deltaTrend="up" />
      </div>

      {/* duo：我的订单 + 会员权益（原型 1.4fr / 1fr） */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel title={t('common:userCenter.menu.orders')} hint="最近订单 · 用户视角">
          <UserTable columns={orderCols} rows={recent.orders} loading={false} emptyText={t('common:userCenter.empty')} />
        </Panel>
        <Panel title={t('common:userCenter.overview.memberBenefits')} hint={`${tier} · 可享`}>
          <div className="flex flex-col gap-2 p-4">
            {(TIER_PERKS[tier] ?? []).map((pk) => (
              <div
                key={pk}
                className="flex items-center gap-2 rounded-md bg-[#f3eee7] px-3 py-2 text-[13px] text-[#4c4236]"
              >
                <span className="h-2 w-2 flex-none rounded-full bg-[#D24830]" />
                {pk}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* trio：关注的服务商 / 我的优惠券 / 我的评价（原型 1.2fr / 1fr / 1fr） */}
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
        <Panel title={t('common:userCenter.menu.providers')} hint="我的服务商">
          <UserTable columns={providerCols} rows={recent.providers} loading={false} emptyText={t('common:userCenter.empty')} />
        </Panel>
        <Panel title={t('common:userCenter.menu.coupons')} hint="优惠与权益">
          <UserTable columns={couponCols} rows={recent.coupons} loading={false} emptyText={t('common:userCenter.empty')} />
        </Panel>
        <Panel title={t('common:userCenter.menu.reviews')} hint="评价与反馈">
          <UserTable columns={reviewCols} rows={recent.reviews} loading={false} emptyText={t('common:userCenter.empty')} />
        </Panel>
      </div>
    </div>
  );
}
