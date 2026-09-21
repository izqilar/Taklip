import { Tag, message, Drawer } from 'antd';
import { lazy, Suspense, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustom, useGetIdentity } from '@refinedev/core';
import { GenericListPage, type ChipFilter, type DetailFieldDef } from '../components/GenericListPage';
import { PageHead } from '../components/ui/PageHead';
import { KpiCard } from '../components/ui/KpiCard';
import { Panel } from '../components/ui/Panel';
import { DataTable } from '../components/ui/DataTable';
import { Pill } from '../components/ui/Pill';
import { ReviewModal } from '../components/ui/ReviewModal';
import { HomeSkeleton } from '../components/ui/HomeSkeleton';
import { StatusTag } from '../components/common/StatusTag';
import { EvalModal, type EvalTarget } from '../components/user/EvalModal';
import { WorkPreviewModal } from '../components/user/WorkPreviewModal';
import { AdjustUserModal, TIERS, TIER_PERKS, tierKeyOf, vipLevelOf } from '../components/user/AdjustUserModal';
import { useLayer } from '../providers/layerContext';
import { t } from '../i18n/t';
import { GRID, T } from '../config/theme';
import { serviceRolesText, msgTypeText, cleanCode } from '../config/labels';
import { TICKET_STATUS, ORDER_STATUS } from '../config/status';
import { formatCents, todayKey, API_URL, authHeaders, getStoredUser, WEB_BASE } from '../utility';
import { SchemaThumbnail } from '@h5design/render';
import { DesignGalleryCard, type DesignActionCaps } from '@h5design/ui';
import { WorkDetailPanel } from './providerDetailPages';
import { dataProvider } from '../providers/dataProvider';

/** 作品导出对话框（懒加载：内含 @h5design/editor 内核，体积大，禁止进首屏） */
const WorkExportDialog = lazy(
  () => import('../components/user/WorkExportDialog'),
);

/** 金额（分）渲染 */
const money = (v: any) => formatCents(v ?? 0);
/** 日期渲染 */
const dt = (v: any) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');
/** 短日期（MM-DD HH:mm） */
const dts = (v: any) => {
  if (!v) return '—';
  const d = new Date(v);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** id 兜底编号：cleanCode 对种子 id（如 test_order_1）会剥成「1」，过短时回退 */
const fallbackCode = (v?: any) => {
  if (!v) return '—';
  const c = cleanCode(String(v));
  if (c.length >= 6) return c;
  return `${String(v).slice(0, 2).toUpperCase()}…${String(v).slice(-4)}`;
};

/**
 * 订单编号（原型 QD…0316 截断展示）。
 * 优先取业务单号 orderNo（QD202608210316）→ 展示 QD…0316；
 * 无单号时退回 id 兜底，避免种子 id 被洗成「1」。
 */
const orderCode = (row: any) => {
  if (row && typeof row === 'object' && row.orderNo) {
    return `QD…${String(row.orderNo).slice(-4)}`;
  }
  return fallbackCode(typeof row === 'object' ? row?.id : row);
};

/** 订单履约态（原型 u-orders：待服务 / 履约中 / 已完成 / 已退款） */
const SERVICE_STATUS: Record<string, { key: string; tone: 'warn' | 'ac' | 'ok' | 'bad' }> = {
  pending_service: { key: 'pages.status.svcPending', tone: 'warn' },
  in_service: { key: 'status.PROCESSING', tone: 'ac' },
  completed: { key: 'pages.status.svcCompleted', tone: 'ok' },
  refunded: { key: 'status.REFUNDED', tone: 'bad' },
};


/** 反馈类型（原型：售后 / 建议 / 咨询 / 投诉 / 其他） */
const TICKET_TYPE: Record<string, string> = {
  COMPLAINT: 'pages.fb.complaint',
  PRAISE: 'pages.status.tkTypePraise',
  SUGGESTION: 'pages.fb.suggestion',
  CONSULT: 'pages.col.consult',
  APPEAL: 'pages.status.tkTypeAppeal',
  AFTERSALE: 'pages.status.tkTypeAftersale',
  OTHER: 'pages.status.tkTypeOther',
};


/** 星级渲染（原型 .num + ★ ，保留一位小数如 ★ 4.7） */
const stars = (n?: number | null) =>
  n ? (
    <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: T.fontNum }}>
      ★ {Number(n).toFixed(1)}
    </span>
  ) : (
    '—'
  );

/**
 * 业务消息「待处理 / 已处理」状态集合 —— 对齐原型 u-messages 的 chip v:[] 配置。
 * 平台 Message 模型目前只有已读回执，真实状态仅 未读 / 已读；集合按原型保留以便后续接入业务态。
 */
const MSG_TODO = ['未读', '待支付', '待确认收货', '待评价', '待回复', '处理中'];
const MSG_DONE = ['已读', '已完成', '已到账', '已退款', '已取消'];

/** 行内操作链接（原型 .acts） */
const actLink = (text: string, onClick: () => void, disabled?: boolean) => (
  <span
    onClick={disabled ? undefined : onClick}
    style={{
      color: disabled ? T.ink3 : T.accent,
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: 13,
      whiteSpace: 'nowrap',
    }}
  >
    {text}
  </span>
);

/** 从对象视角上下文取监督目标用户 id（未选则后端回落演示用户） */
const useScopeUserId = () => {
  const { objectScope } = useLayer();
  return objectScope?.id;
};

/** 监督视角 url（带 userId 查询） */
const scopeQs = (uid?: string) => (uid ? `?userId=${uid}` : '');

/** 提交评价（订单 / 服务商通用） */
async function postReview(uid: string | undefined, body: Record<string, unknown>) {
  const res = await fetch(`${API_URL}/user/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ ...body, ...(uid ? { userId: uid } : {}) }),
  });
  const b = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((b as any)?.message ?? '提交失败');
  return b;
}

interface UserStats {
  userId: string;
  profile: {
    id: string;
    nickname: string | null;
    realName: string | null;
    phone: string | null;
    vipLevel: number;
    regionName: string | null;
    createdAt: string;
  };
  orders: number;
  dealOrders: number;
  refundedOrders: number;
  dealRate: number;
  returnRate: number;
  refundRate: number;
  providers: number;
  coupons: number;
  totalSpentCents: number;
  balanceCents: number;
  points: number;
  pendingReviewOrders: number;
  reviewCount: number;
  feedback: number;
  messages: number;
  /** KPI 副标题（原型 .kpi .d）：本月充值 / 待服务 / 履约中 / 可兑券 */
  monthRechargeCents?: number;
  pendingServiceOrders?: number;
  inServiceOrders?: number;
  exchangeableCoupons?: number;
}

/* ══════════════════════════════════════════════════════════════
 * 我的工作台（原型 #pg-user-home）
 * 资料卡 + 等级测试台 + KPI 四联 + duo（我的订单 / 会员权益）
 * + trio（关注服务商 / 我的优惠券 / 我的评价）
 * ══════════════════════════════════════════════════════════════ */
export const UserDashboard = () => {
  const uid = useScopeUserId();
  const { readonly } = useLayer();
  const q = scopeQs(uid);
  const { data, isLoading, refetch } = useCustom<UserStats>({
    url: `user/dashboard${q}`,
    method: 'get',
    queryOptions: { retry: false },
  });
  const { data: ordData } = useCustom<{ items: any[] }>({
    url: `user/orders?pageSize=3${uid ? `&userId=${uid}` : ''}`,
    method: 'get',
    queryOptions: { retry: false },
  });
  const { data: provData } = useCustom<{ items: any[] }>({
    url: `user/providers?pageSize=3${uid ? `&userId=${uid}` : ''}`,
    method: 'get',
    queryOptions: { retry: false },
  });
  const { data: revData } = useCustom<{ items: any[] }>({
    url: `user/reviews?pageSize=3${uid ? `&userId=${uid}` : ''}`,
    method: 'get',
    queryOptions: { retry: false },
  });
  const { data: cpData } = useCustom<{ items: any[] }>({
    url: `user/coupons?pageSize=3${uid ? `&userId=${uid}` : ''}`,
    method: 'get',
    queryOptions: { retry: false },
  });

  const s = data?.data as UserStats | undefined;
  const orders = (ordData?.data as any)?.items ?? [];
  const favs = (provData?.data as any)?.items ?? [];
  const reviews = (revData?.data as any)?.items ?? [];
  const coupons = (cpData?.data as any)?.items ?? [];

  // 会员等级测试台（原型 #ltSwitch）：本地预览切换，不落库
  const [testTier, setTestTier] = useState<string | null>(null);
  const [adjOpen, setAdjOpen] = useState(false);
  // 登录者角色：普通 USER 是自助视角，无「调整用户数据」权限（服务端 /user/adjust 亦仅限 ADMIN）
  const operatorRole = getStoredUser<{ role?: string }>()?.role;
  // 用户视角默认只读（观测镜头），但「权限模式」切到超级管理员后可写，
  // 故「调整用户数据」写入口随 readonly 联动显隐（与代理商/服务商视角口径一致）
  const canAdjust = (operatorRole ?? 'ADMIN') !== 'USER' && !readonly;
  const baseTier = tierKeyOf(s?.profile.vipLevel);
  const tier = testTier ?? baseTier;

  if (isLoading || !s) return <HomeSkeleton title="我的工作台" />;

  const p = s.profile;
  const displayName = p.nickname || p.realName || p.phone || '未命名用户';
  const maskedPhone = p.phone ? `${p.phone.slice(0, 3)}****${p.phone.slice(-4)}` : '—';
  const shortId = p.id.length > 8 ? `${p.id.slice(0, 4)}…${p.id.slice(-4)}` : p.id;

  return (
    <>
      <PageHead
        title="我的工作台"
        sub={`${displayName} · ${tier} · 个人中心预览 · 截至今日 ${todayKey()}`}
        chip={`用户 · ${tier}`}
      />

      {/* ── 资料卡 + 等级测试台 + 调整用户数据（原型 .ucard） ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          background: T.bg,
          border: `1px solid ${T.border}`,
          borderRadius: T.rMd,
          padding: '14px 16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              width: 46,
              height: 46,
              borderRadius: '50%',
              background: T.avatarGrad,
              color: T.onAccent,
              display: 'grid',
              placeItems: 'center',
              fontSize: 19,
              fontWeight: 700,
              flex: 'none',
            }}
          >
            {String(displayName).slice(0, 1)}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <b style={{ fontSize: 16, color: T.ink1 }}>{displayName}</b>
            <Pill tone="ac">{tier}</Pill>
          </div>
        </div>

        <div style={{ fontSize: 12, color: T.ink3 }}>
          ID {shortId} · 手机 {maskedPhone} · {p.regionName ?? '未归属区域'} · 注册{' '}
          {p.createdAt ? new Date(p.createdAt).toLocaleDateString('zh-CN') : '—'}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: T.ink3, whiteSpace: 'nowrap' }}>会员等级</span>
          <span
            style={{
              display: 'flex',
              border: `1px solid ${T.border}`,
              borderRadius: T.rSm,
              overflow: 'hidden',
            }}
          >
            {TIERS.map((x, i) => {
              const on = tier === x.key;
              return (
                <button
                  key={x.key}
                  type="button"
                  onClick={() => setTestTier(on && testTier ? null : x.key)}
                  style={{
                    padding: '5px 12px',
                    fontSize: 12.5,
                    color: on ? T.onAccent : T.ink2,
                    background: on ? T.accent : T.page,
                    fontWeight: on ? 600 : 400,
                    border: 0,
                    borderLeft: i === 0 ? 0 : `1px solid ${T.border}`,
                    cursor: 'pointer',
                    minHeight: 0,
                    lineHeight: 1.6,
                  }}
                >
                  {x.label}
                </button>
              );
            })}
          </span>
          <span style={{ marginLeft: 'auto' }} />
          {canAdjust && (
            <button
              type="button"
              onClick={() => setAdjOpen(true)}
              style={{
                border: 0,
                borderRadius: T.rSm,
                padding: '6px 13px',
                background: T.up,
                color: '#fff',
                fontSize: 13,
                cursor: 'pointer',
                minHeight: 0,
                lineHeight: 1.6,
              }}
            >
              调整用户数据
            </button>
          )}
        </div>
      </div>

      {/* ── KPI 四联（原型 .kpis） ── */}
      <div className={GRID.kpis}>
        <KpiCard
          main
          label="账户余额"
          value={formatCents(s.balanceCents)}
          delta={
            s.monthRechargeCents
              ? `+ ${formatCents(s.monthRechargeCents)} 本月充值`
              : '本月暂无充值'
          }
          deltaTrend="up"
        />
        <KpiCard
          label="积分"
          value={(s.points ?? 0).toLocaleString('en-US')}
          delta={`可兑换 ${s.exchangeableCoupons ?? 0} 张券`}
        />
        <KpiCard
          label="进行中订单"
          value={(
            (s.pendingServiceOrders ?? 0) + (s.inServiceOrders ?? 0)
          ).toLocaleString('en-US')}
          delta={`待服务 ${s.pendingServiceOrders ?? 0} · 待评价 ${s.pendingReviewOrders ?? 0}`}
        />
        <KpiCard
          label="累计消费"
          value={formatCents(s.totalSpentCents)}
          delta={`共 ${s.dealOrders} 笔`}
          deltaTrend="up"
        />
      </div>

      {/* ── duo：我的订单 + 会员权益 ── */}
      <div className={GRID.duo}>
        <Panel title="我的订单" hint="最近订单 · 用户视角">
          <DataTable<any>
            rowKey="id"
            dataSource={orders}
            columns={[
              {
                title: '订单',
                dataIndex: 'id',
                ellipsis: true,
                render: (_v: string, r: any) => (
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: T.fontNum }}>
                    {orderCode(r)}
                  </span>
                ),
              },
              {
                title: '服务',
                dataIndex: ['template', 'name'],
                ellipsis: true,
                render: (v: string) => <span style={{ color: T.ink3 }}>{v || '—'}</span>,
              },
              {
                title: '服务商',
                dataIndex: ['template', 'author', 'nickname'],
                ellipsis: true,
                render: (v: string) => <span style={{ color: T.ink3 }}>{v || '—'}</span>,
              },
              {
                title: '金额',
                dataIndex: 'amount',
                align: 'right',
                render: (v: number) => (
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: T.fontNum }}>
                    {formatCents(v ?? 0)}
                  </span>
                ),
              },
              {
                title: '状态',
                dataIndex: 'serviceStatus',
                render: (v: string) =>
                  SERVICE_STATUS[v] ? (
                    <Pill tone={SERVICE_STATUS[v].tone}>{t(SERVICE_STATUS[v].key)}</Pill>
                  ) : (
                    <Tag color={ORDER_STATUS[v]?.color}>{ORDER_STATUS[v] ? t(ORDER_STATUS[v].key) : (v ?? '—')}</Tag>
                  ),
              },
            ]}
          />
        </Panel>

        <Panel title="会员权益" hint={`${tier} · 可享`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: '12px 16px' }}>
            {(TIER_PERKS[tier] ?? []).map((pk) => (
              <div
                key={pk}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  fontSize: 13,
                  color: T.ink2,
                  background: T.panel2,
                  borderRadius: T.rSm,
                  padding: '8px 12px',
                }}
              >
                <span
                  style={{ width: 8, height: 8, borderRadius: '50%', background: T.accent, flex: 'none' }}
                />
                {pk}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* ── trio：关注的服务商 / 我的优惠券 / 我的评价 ── */}
      <div className={GRID.trio}>
        <Panel title="关注的服务商" hint="我的服务商">
          <DataTable<any>
            rowKey="id"
            dataSource={favs}
            columns={[
              { title: '服务商', dataIndex: 'nickname', ellipsis: true },
              {
                title: '类型',
                dataIndex: 'serviceRoles',
                render: (v: string[]) => <span style={{ color: T.ink3 }}>{serviceRolesText(v)}</span>,
              },
              { title: '评分', dataIndex: 'rating', align: 'right', render: (v: number) => stars(v) },
            ]}
          />
        </Panel>

        <Panel title="我的优惠券" hint="优惠与权益">
          <DataTable<any>
            rowKey="id"
            dataSource={coupons}
            columns={[
              { title: '券', dataIndex: 'name', ellipsis: true },
              {
                title: '面额',
                dataIndex: 'amountCents',
                align: 'right',
                render: (v: number, r: any) =>
                  v > 0 ? (
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: T.fontNum }}>
                      {formatCents(v)}
                    </span>
                  ) : (
                    <span style={{ color: T.ink3 }}>{r.benefit ?? '—'}</span>
                  ),
              },
              {
                title: '状态',
                dataIndex: 'status',
                render: (v: string) => (
                  <Pill tone={v === '已使用' ? 'ok' : v === '已过期' ? 'mut' : 'warn'}>{v ?? '—'}</Pill>
                ),
              },
            ]}
          />
        </Panel>

        <Panel title="我的评价" hint="评价与反馈">
          <DataTable<any>
            rowKey="id"
            dataSource={reviews}
            columns={[
              { title: '服务', dataIndex: 'serviceName', ellipsis: true },
              { title: '评分', dataIndex: 'rating', align: 'right', render: (v: number) => stars(v) },
              {
                title: '状态',
                dataIndex: 'status',
                render: (v: string) => <Pill tone="ok">{v ?? '已发布'}</Pill>,
              },
            ]}
          />
        </Panel>
      </div>

      <AdjustUserModal
        open={adjOpen}
        target={{
          id: shortId,
          name: displayName,
          city: p.regionName,
          tierKey: tier,
          balance: (s.balanceCents ?? 0) / 100,
          points: s.points ?? 0,
        }}
        onClose={() => setAdjOpen(false)}
        onSubmit={async ({ vipLevel, balance, points }) => {
          const res = await fetch(`${API_URL}/user/adjust`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...authHeaders(),
            },
            body: JSON.stringify({ vipLevel, balance, points, ...(uid ? { userId: uid } : {}) }),
          });
          const b = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error((b as any)?.message ?? '保存失败');
          setTestTier(null);
          message.success('用户数据已调整');
          refetch();
        }}
      />
    </>
  );
};

/* ══════════════════════════════════════════════════════════════
 * 我的订单（原型 u-orders）
 * 表头：订单 / 服务 / 服务商 / 金额 / 时间 / 状态
 * 行操作：查看 + 评价（仅已完成；已评价 → 追评）
 * ══════════════════════════════════════════════════════════════ */
export const UserOrders = () => {
  const uid = useScopeUserId();
  const { readonly } = useLayer();
  const [detail, setDetail] = useState<any>(null);
  const [evalTarget, setEvalTarget] = useState<EvalTarget | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // 原型 u-orders 筛选：全部 / 待服务 / 已完成（平台按履约态细分出「履约中 / 已退款」）
  const filters: ChipFilter[] = [
    { label: '全部', value: 'all' },
    { label: '待服务', value: 'pending_service', field: 'serviceStatus' },
    { label: '履约中', value: 'in_service', field: 'serviceStatus' },
    { label: '已完成', value: 'completed', field: 'serviceStatus' },
    { label: '已退款', value: 'refunded', field: 'serviceStatus' },
  ];

  return (
    <>
      <GenericListPage
        key={reloadKey}
        title="我的订单"
        resource="user/orders"
        staticFilters={uid ? [{ field: 'userId', operator: 'eq', value: uid }] : undefined}
        searchable
        searchField={['template', 'name']}
        searchPlaceholder="搜索服务名称…"
        chipFilters={filters}
        detailTag="订单"
        detailTitle="订单详情"
        rowActions={(r) => (
          <>
            {actLink('查看', () => setDetail(r))}
            {/* 原型 evalOnlyDone：仅「已完成」可评价/追评 */}
            {r.serviceStatus === 'completed' &&
              actLink(
                r.reviewed ? '追评' : '评价',
                () =>
                  setEvalTarget({
                    orderId: r.id,
                    name: `${r.template?.name ?? '—'} · ${r.template?.author?.nickname ?? '—'}`,
                    rating: r.rating ?? null,
                    content: r.reviewContent ?? null,
                  }),
                readonly,
              )}
          </>
        )}
        columns={[
          {
            title: '订单',
            dataIndex: 'id',
            width: 150,
            ellipsis: true,
            render: (_v: string, r: any) => (
              <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: T.fontNum }}>
                {orderCode(r)}
              </span>
            ),
          },
          {
            title: '服务',
            dataIndex: ['template', 'name'],
            ellipsis: true,
            render: (v: string) => v || '—',
          },
          {
            title: '服务商',
            dataIndex: ['template', 'author', 'nickname'],
            width: 140,
            ellipsis: true,
            render: (v: string) => <span style={{ color: T.ink3 }}>{v || '—'}</span>,
          },
          { title: '金额', dataIndex: 'amount', width: 110, align: 'right', render: money },
          { title: '时间', dataIndex: 'createdAt', width: 130, render: dts },
          {
            title: '状态',
            dataIndex: 'serviceStatus',
            width: 100,
            render: (v: string) =>
              SERVICE_STATUS[v] ? (
                <Pill tone={SERVICE_STATUS[v].tone}>{t(SERVICE_STATUS[v].key)}</Pill>
              ) : (
                <Tag color={ORDER_STATUS[v]?.color}>{ORDER_STATUS[v] ? t(ORDER_STATUS[v].key) : (v ?? '—')}</Tag>
              ),
          },
        ]}
      />

      {/* 订单详情（原型：已评价时追加评价等级与评价内容） */}
      <ReviewModal
        open={!!detail}
        tag="订单"
        title="订单详情"
        onClose={() => setDetail(null)}
        fields={[
          // 原型 MODAL_META['u-orders'].labels：服务 / 服务商 / 金额 / 下单时间 / 订单号
          // （履约态为平台新增维度，追加在订单号之后）
          { label: '服务', value: detail?.template?.name ?? '—' },
          { label: '服务商', value: detail?.template?.author?.nickname ?? '—' },
          { label: '金额', value: money(detail?.amount) },
          { label: '下单时间', value: dt(detail?.createdAt) },
          { label: '订单号', value: detail ? orderCode(detail) : '—' },
          {
            label: '状态',
            value: (
              <Pill tone={SERVICE_STATUS[detail?.serviceStatus]?.tone}>
                {SERVICE_STATUS[detail?.serviceStatus]?.key ?? detail?.serviceStatus ?? '—'}
              </Pill>
            ),
          },
          ...(detail?.reviewed
            ? [
                { label: '评价等级', value: stars(detail.rating) },
                { label: '评价内容', value: detail.reviewContent ?? '—' },
              ]
            : []),
        ]}
      />

      <EvalModal
        open={!!evalTarget}
        kind="order"
        target={evalTarget}
        onClose={() => setEvalTarget(null)}
        onSubmit={async (body) => {
          await postReview(uid, body);
          setReloadKey((k) => k + 1);
        }}
      />
    </>
  );
};

/* ══════════════════════════════════════════════════════════════
 * 我的服务商（原型 u-providers）
 * 表头：编号 / 服务商 / 服务类型 / 评分 / 关注时间 / 状态
 * 行操作：查看 + 评价 / 追评
 * ══════════════════════════════════════════════════════════════ */
export const UserProviders = () => {
  const uid = useScopeUserId();
  const { readonly } = useLayer();
  const [detail, setDetail] = useState<any>(null);
  const [evalTarget, setEvalTarget] = useState<EvalTarget | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const filters: ChipFilter[] = [
    { label: '全部', value: 'all' },
    { label: '关注中', value: 'following', test: () => true },
  ];

  return (
    <>
      <GenericListPage
        key={reloadKey}
        title="我的服务商"
        resource="user/providers"
        staticFilters={uid ? [{ field: 'userId', operator: 'eq', value: uid }] : undefined}
        searchable
        searchField="nickname"
        searchPlaceholder="搜索服务商…"
        chipFilters={filters}
        detailTag="服务商"
        detailTitle="服务商详情"
        rowActions={(r) => (
          <>
            {actLink('查看', () => setDetail(r))}
            {actLink(
              r.reviewed ? '追评' : '评价',
              () =>
                setEvalTarget({
                  providerId: r.id,
                  name: `${r.code ?? '—'} · ${r.nickname ?? '—'}`,
                  rating: r.rating ?? null,
                  content: r.reviewContent ?? null,
                }),
              readonly,
            )}
          </>
        )}
        columns={[
          { title: '编号', dataIndex: 'code', width: 110 },
          { title: '服务商', dataIndex: 'nickname', width: 130, ellipsis: true },
          {
            title: '服务类型',
            dataIndex: 'serviceRoles',
            ellipsis: true,
            render: (v: string[]) => <span style={{ color: T.ink3 }}>{serviceRolesText(v)}</span>,
          },
          { title: '评分', dataIndex: 'rating', width: 90, align: 'right', render: (v: number) => stars(v) },
          { title: '关注时间', dataIndex: 'followedAt', width: 110, render: dts },
          {
            title: '状态',
            dataIndex: 'providerStatus',
            width: 100,
            render: () => <Pill tone="ok">关注中</Pill>,
          },
        ]}
      />

      <ReviewModal
        open={!!detail}
        tag="服务商"
        title="服务商详情"
        onClose={() => setDetail(null)}
        fields={[
          { label: '编号', value: detail?.code ?? '—' },
          { label: '服务商', value: detail?.nickname ?? '—' },
          { label: '服务类型', value: serviceRolesText(detail?.serviceRoles) },
          { label: '评分', value: stars(detail?.rating) },
          { label: '关注时间', value: dt(detail?.followedAt) },
        ]}
      />

      <EvalModal
        open={!!evalTarget}
        kind="provider"
        target={evalTarget}
        onClose={() => setEvalTarget(null)}
        onSubmit={async (body) => {
          await postReview(uid, body);
          setReloadKey((k) => k + 1);
        }}
      />
    </>
  );
};

/* ══════════════════════════════════════════════════════════════
 * 我的评价（原型 u-feedback）
 * 表头：订单编号 / 服务 / 评分 / 评价内容 / 时间 / 状态
 * ══════════════════════════════════════════════════════════════ */
export const UserReviews = () => {
  const uid = useScopeUserId();
  // 原型 MODAL_META['u-feedback'].labels：订单编号 / 服务 / 评分 / 评价内容 / 时间（状态恒为已发布，不入详情）
  const fields: DetailFieldDef[] = [
    { label: '订单编号', dataIndex: 'orderId', format: 'code' },
    { label: '服务', dataIndex: 'serviceName' },
    { label: '评分', dataIndex: 'rating' },
    { label: '评价内容', dataIndex: 'content' },
    { label: '时间', dataIndex: 'createdAt', format: 'date' },
  ];
  return (
    <GenericListPage
      title="我的评价"
      resource="user/reviews"
      staticFilters={uid ? [{ field: 'userId', operator: 'eq', value: uid }] : undefined}
      searchable
      searchField="serviceName"
      searchPlaceholder="搜索服务名称…"
      chipFilters={[
        { label: '全部', value: 'all' },
        { label: '已发布', value: '已发布', test: (r: any) => r.status === '已发布' },
      ]}
      detailTag="评价"
      detailTitle="评价详情"
      detailFields={fields}
      columns={[
        {
          title: '订单编号',
          dataIndex: 'orderId',
          width: 150,
          ellipsis: true,
          render: (v: string, r: any) =>
            v ? (
              <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: T.fontNum }}>
                {orderCode(r)}
              </span>
            ) : (
              '—'
            ),
        },
        { title: '服务', dataIndex: 'serviceName', width: 160, ellipsis: true },
        { title: '评分', dataIndex: 'rating', width: 90, align: 'right', render: (v: number) => stars(v) },
        { title: '评价内容', dataIndex: 'content', ellipsis: true },
        { title: '时间', dataIndex: 'createdAt', width: 130, render: dts },
        {
          title: '状态',
          dataIndex: 'status',
          width: 100,
          render: (v: string) => <Pill tone="ok">{v ?? '已发布'}</Pill>,
        },
      ]}
    />
  );
};

/* ══════════════════════════════════════════════════════════════
 * 我的反馈（原型 u-complaints）
 * 表头：编号 / 主题 / 类型 / 对象 / 时间 / 状态
 * 行操作：查看（跳反馈详情页）；新建（＋ 新增反馈）
 * ══════════════════════════════════════════════════════════════ */
export const UserComplaints = () => {
  const uid = useScopeUserId();
  const navigate = useNavigate();
  const { readonly } = useLayer();
  return (
    <GenericListPage
      title="我的反馈"
      resource="user/complaints"
      staticFilters={uid ? [{ field: 'userId', operator: 'eq', value: uid }] : undefined}
      searchable
      searchField="title"
      searchPlaceholder="搜索反馈主题…"
      createLabel="＋ 新增反馈"
      onCreate={readonly ? undefined : () => navigate('/user/complaints/new')}
      chipFilters={[
        { label: '全部', value: 'all' },
        { label: '待回复', value: 'OPEN', field: 'status' },
        { label: '已回复', value: 'CLOSED', field: 'status' },
      ]}
      detailTag="反馈"
      detailTitle="反馈详情"
      rowActions={(r) => actLink('查看', () => navigate(`/user/complaints/${r.id}`))}
      columns={[
        { title: '编号', dataIndex: 'code', width: 110 },
        { title: '主题', dataIndex: 'title', ellipsis: true },
        {
          title: '类型',
          dataIndex: 'type',
          width: 90,
          render: (v: string) => <span style={{ color: T.ink3 }}>{TICKET_TYPE[v] ?? v ?? '—'}</span>,
        },
        {
          title: '对象',
          dataIndex: ['target', 'nickname'],
          width: 140,
          ellipsis: true,
          render: (v: string) => <span style={{ color: T.ink3 }}>{v || '平台'}</span>,
        },
        { title: '时间', dataIndex: 'createdAt', width: 130, render: dts },
        {
          title: '状态',
          dataIndex: 'status',
          width: 100,
          render: (v: string) => (
            <Tag color={TICKET_STATUS[v]?.color}>{t(TICKET_STATUS[v]?.key ?? v ?? '—')}</Tag>
          ),
        },
      ]}
    />
  );
};

/* ══════════════════════════════════════════════════════════════
 * 通知公告（原型 u-notices）
 * 表头：编号 / 标题 / 类型 / 时间 / 状态
 * 行操作：查看；状态含「初审通过」时显示「填写资料」
 * ══════════════════════════════════════════════════════════════ */
export const UserNotices = () => {
  const uid = useScopeUserId();
  const navigate = useNavigate();
  const { readonly } = useLayer();
  const [detail, setDetail] = useState<any>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const markRead = async (row: any) => {
    if (row.kind !== 'message') return;
    try {
      await fetch(`${API_URL}/user/notices/${row.id}/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify(uid ? { userId: uid } : {}),
      });
      setReloadKey((k) => k + 1);
    } catch {
      /* 已读回执失败不影响查看 */
    }
  };

  return (
    <>
      <GenericListPage
        key={reloadKey}
        title="通知公告"
        resource="user/notices"
        staticFilters={uid ? [{ field: 'userId', operator: 'eq', value: uid }] : undefined}
        searchable
        searchField="title"
        searchPlaceholder="搜索公告标题…"
        detailTag="公告"
        detailTitle="公告详情"
        chipFilters={[
          { label: '全部', value: 'all' },
          { label: '未读', value: 'unread', test: (r: any) => r.status === '未读' },
          { label: '已读', value: 'read', test: (r: any) => r.status === '已读' },
          { label: '待补资料', value: 'fill', test: (r: any) => r.status === '初审通过' },
        ]}
        rowActions={(r) => (
          <>
            {actLink('查看', () => {
              setDetail(r);
              markRead(r);
            })}
            {r.fillKind && !readonly &&
              actLink('填写资料', () => navigate(`/user/notices/fill?kind=${r.fillKind}&id=${r.id}`))}
          </>
        )}
        columns={[
          { title: '编号', dataIndex: 'code', width: 100 },
          { title: '标题', dataIndex: 'title', ellipsis: true },
          {
            title: '类型',
            dataIndex: 'type',
            width: 100,
            render: (v: string) => <span style={{ color: T.ink3 }}>{v ?? '—'}</span>,
          },
          { title: '时间', dataIndex: 'createdAt', width: 130, render: dts },
          {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            render: (v: string) => (
              <Pill tone={v === '未读' ? 'warn' : v === '初审通过' ? 'ac' : 'ok'}>{v ?? '—'}</Pill>
            ),
          },
        ]}
      />

      <ReviewModal
        open={!!detail}
        tag="公告"
        title="公告详情"
        onClose={() => setDetail(null)}
        fields={[
          { label: '编号', value: detail?.code ?? '—' },
          { label: '标题', value: detail?.title ?? '—' },
          { label: '类型', value: detail?.type ?? '—' },
          { label: '时间', value: dt(detail?.createdAt) },
          { label: '内容', value: detail?.content ?? '—' },
        ]}
      />
    </>
  );
};

/* ══════════════════════════════════════════════════════════════
 * 业务消息（原型 u-messages）
 * 表头：编号 / 标题 / 类型 / 时间 / 状态
 * ══════════════════════════════════════════════════════════════ */
export const UserMessages = () => {
  const uid = useScopeUserId();
  return (
    <GenericListPage
      title="业务消息"
      resource="user/messages"
      staticFilters={uid ? [{ field: 'userId', operator: 'eq', value: uid }] : undefined}
      searchable
      searchField="title"
      searchPlaceholder="搜索消息标题…"
      detailTag="消息"
      detailTitle="消息详情"
      chipFilters={[
        { label: '全部', value: 'all' },
        { label: '待处理', value: 'todo', test: (r: any) => MSG_TODO.includes(r.status) },
        { label: '已处理', value: 'done', test: (r: any) => MSG_DONE.includes(r.status) },
      ]}
      rowActions={(r) => (
        <MessageViewAction id={r.id} title={r.title} type={r.type} time={r.createdAt} code={r.code} />
      )}
      columns={[
        { title: '编号', dataIndex: 'code', width: 100 },
        { title: '标题', dataIndex: 'title', ellipsis: true },
        {
          title: '类型',
          dataIndex: 'type',
          width: 100,
          render: (v: string) => <span style={{ color: T.ink3 }}>{msgTypeText(v)}</span>,
        },
        { title: '时间', dataIndex: 'createdAt', width: 130, render: dts },
        {
          title: '状态',
          dataIndex: 'status',
          width: 100,
          render: (v: string) => <Pill tone={v === '未读' ? 'warn' : 'ok'}>{v ?? '—'}</Pill>,
        },
      ]}
    />
  );
};

/** 业务消息「查看」：打开详情同时标记已读 */
const MessageViewAction = ({
  id,
  title,
  type,
  time,
  code,
}: {
  id: string;
  title: string;
  type: string;
  time: string;
  code: string;
}) => {
  const uid = useScopeUserId();
  const [open, setOpen] = useState(false);
  return (
    <>
      {actLink('查看', async () => {
        setOpen(true);
        try {
          await fetch(`${API_URL}/user/messages/${id}/read`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...authHeaders(),
            },
            body: JSON.stringify(uid ? { userId: uid } : {}),
          });
        } catch {
          /* 已读回执失败不影响查看 */
        }
      })}
      <ReviewModal
        open={open}
        tag="消息"
        title="消息详情"
        onClose={() => setOpen(false)}
        fields={[
          { label: '编号', value: code ?? '—' },
          { label: '标题', value: title ?? '—' },
          { label: '类型', value: msgTypeText(type) },
          { label: '时间', value: dt(time) },
        ]}
      />
    </>
  );
};

/* ══════════════════════════════════════════════════════════════
 * 我的钱包（原型 u-wallet）
 * 表头：流水号 / 时间 / 类型 / 金额 / 变动后余额 / 状态
 * 数据源：WalletLog（流水号 W-1001 起，最新在前）
 * ══════════════════════════════════════════════════════════════ */
export const UserWallet = () => {
  const uid = useScopeUserId();
  const { data } = useCustom<any>({
    url: `user/wallet${scopeQs(uid)}`,
    method: 'get',
    queryOptions: { retry: false },
  });
  const { data: dashData } = useCustom<UserStats>({
    url: `user/dashboard${scopeQs(uid)}`,
    method: 'get',
    queryOptions: { retry: false },
  });
  const w = data?.data as
    | { balanceCents?: number; totalSpentCents?: number; points?: number }
    | undefined;
  const s = dashData?.data as UserStats | undefined;

  return (
    <>
      <div className={GRID.kpis}>
        <KpiCard main label="账户余额" value={formatCents(w?.balanceCents ?? 0)} delta="钱包可用余额" deltaTrend="up" />
        <KpiCard label="累计消费" value={formatCents(w?.totalSpentCents ?? 0)} delta="已支付订单合计" />
        <KpiCard label="积分" value={(w?.points ?? 0).toLocaleString('en-US')} delta="积分余额" />
        <KpiCard label="可用优惠券" value={String(s?.coupons ?? 0)} delta="我的卡券" />
      </div>
      <GenericListPage
        title="我的钱包"
        sub="余额与流水 · 流水号 W-1001 起"
        resource="user/wallet/logs"
        staticFilters={uid ? [{ field: 'userId', operator: 'eq', value: uid }] : undefined}
        detailTag="流水"
        detailTitle="钱包流水"
        // 原型 MODAL_META['u-wallet'].labels：流水号 / 时间 / 类型 / 金额 / 变动后余额
        detailFields={[
          { label: '流水号', dataIndex: 'code' },
          { label: '时间', dataIndex: 'createdAt', format: 'date' },
          { label: '类型', dataIndex: 'type' },
          { label: '金额', dataIndex: 'amountCents', format: 'cents' },
          { label: '变动后余额', dataIndex: 'balanceCents', format: 'cents' },
        ]}
        chipFilters={[
          { label: '全部', value: 'all' },
          { label: '收入', value: 'in', test: (r: any) => (r.amountCents ?? 0) > 0 },
          { label: '支出', value: 'out', test: (r: any) => (r.amountCents ?? 0) < 0 },
        ]}
        columns={[
          { title: '流水号', dataIndex: 'code', width: 110 },
          { title: '时间', dataIndex: 'createdAt', width: 130, render: dts },
          { title: '类型', dataIndex: 'type', width: 100 },
          {
            title: '金额',
            dataIndex: 'amountCents',
            width: 110,
            align: 'right',
            render: (v: number) => (
              <span
                style={{
                  fontVariantNumeric: 'tabular-nums',
                  fontFamily: T.fontNum,
                  // 入账绿 / 出账红（中国区涨跌色惯例）
                  color: (v ?? 0) >= 0 ? T.up : T.down,
                }}
              >
                {(v ?? 0) >= 0 ? '+' : ''}
                {formatCents(v ?? 0)}
              </span>
            ),
          },
          {
            title: '变动后余额',
            dataIndex: 'balanceCents',
            width: 130,
            align: 'right',
            render: money,
          },
          {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            render: (v: string) => <Pill tone={v === '成功' ? 'ok' : v === '处理中' ? 'warn' : 'bad'}>{v ?? '—'}</Pill>,
          },
        ]}
      />
    </>
  );
};

/* ══════════════════════════════════════════════════════════════
 * 优惠与权益（原型 u-coupons）
 * 表头：编号 / 优惠券 / 面额 / 有效期 / 使用条件 / 状态
 * 数据源：Coupon + UserCoupon（券编号 CP-2001 起）
 * ══════════════════════════════════════════════════════════════ */
export const UserCoupons = () => {
  const uid = useScopeUserId();
  const { data } = useCustom<UserStats>({
    url: `user/dashboard${scopeQs(uid)}`,
    method: 'get',
    queryOptions: { retry: false },
  });
  const tier = tierKeyOf((data?.data as UserStats | undefined)?.profile?.vipLevel);
  return (
    <>
      <GenericListPage
        title="优惠与权益"
        sub="优惠券与会员权益 · 券编号 CP-2001 起"
        resource="user/coupons"
        staticFilters={uid ? [{ field: 'userId', operator: 'eq', value: uid }] : undefined}
        detailTag="券"
        detailTitle="优惠券详情"
        // 原型 MODAL_META['u-coupons'].labels：编号 / 优惠券 / 面额 / 有效期 / 使用条件
        detailFields={[
          { label: '编号', dataIndex: 'code' },
          { label: '优惠券', dataIndex: 'name' },
          { label: '面额', dataIndex: 'amountCents', format: 'cents' },
          { label: '有效期', dataIndex: 'validUntil', format: 'date' },
          { label: '使用条件', dataIndex: 'condition' },
        ]}
        chipFilters={[
          { label: '全部', value: 'all' },
          { label: '未使用', value: 'unused', test: (r: any) => r.status === '未使用' },
          { label: '已使用', value: 'used', test: (r: any) => r.status === '已使用' },
        ]}
        columns={[
          { title: '编号', dataIndex: 'code', width: 110 },
          { title: '优惠券', dataIndex: 'name', ellipsis: true },
          {
            title: '面额',
            dataIndex: 'amountCents',
            width: 110,
            align: 'right',
            render: (v: number, r: any) =>
              v > 0 ? (
                <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: T.fontNum }}>
                  {formatCents(v)}
                </span>
              ) : (
                <span style={{ color: T.ink3 }}>{r.benefit ?? '—'}</span>
              ),
          },
          {
            title: '有效期',
            dataIndex: 'validUntil',
            width: 130,
            render: (v: string) => (v ? new Date(v).toLocaleDateString('zh-CN') : '—'),
          },
          { title: '使用条件', dataIndex: 'condition', width: 140 },
          {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            render: (v: string) => (
              <Pill tone={v === '已使用' ? 'ok' : v === '已过期' ? 'mut' : 'warn'}>{v ?? '—'}</Pill>
            ),
          },
        ]}
      />
      <Panel title={`${tier} · 会员权益`} hint="当前等级可享">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 12, padding: '12px 16px' }}>
          {(TIER_PERKS[tier] ?? []).map((pk) => (
            <div
              key={pk}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                borderRadius: T.rSm,
                background: T.panel2,
                fontSize: 13,
                color: T.ink2,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.accent, flex: 'none' }} />
              {pk}
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
};

/** 兼容旧导出名（App.tsx 已切到 UserReviews / UserComplaints） */
export const UserFeedback = UserReviews;
export { vipLevelOf };

/* ══════════════════════════════════════════════════════════════
 * 我的作品（原型 u-works）— 展示该用户在前端编辑器设计的个人请柬作品
 * 卡片网格：封面（无封面用统一渲染器 SchemaThumbnail 真实渲染首屏，仍无 schema 则渐变占位 + 首字）
 * / 标题 / 状态（草稿·已发布）/ 访问量 / 更新时间；「预览作品」弹窗多页渲染 + 动画重播
 * （对标 web 端模板库预览，见 components/user/WorkPreviewModal.tsx）；已发布作品可跳转 H5。
 * 缩略图由 @h5design/render 的 SchemaThumbnail 消费后端返回的完整 schema，
 * 与 web 端「我的作品」像素一致（单一渲染器真源）。
 * ══════════════════════════════════════════════════════════════ */
export const UserWorks = () => {
  const uid = useScopeUserId();
  const { readonly } = useLayer();
  const navigate = useNavigate();
  const { data: identity } = useGetIdentity<{ role?: string }>();
  const role = identity?.role;
  const { data, isLoading, refetch } = useCustom<{ items: any[]; total: number }>({
    url: `user/works${uid ? `?userId=${uid}` : ''}`,
    method: 'get',
    queryOptions: { retry: false },
  });
  const items = (data?.data as any)?.items ?? [];

  // 作品预览：对标 web 端模板库预览弹窗（SchemaRenderer 多页渲染 + GSAP 动画重播）。
  // 列表行 schema 已按 effectiveSchema（draftSchema ?? schema）归一，草稿也能直接预览。
  const [previewWork, setPreviewWork] = useState<any>(null);
  // 作品导出：复用编辑器内核 PublishModal（图片 / 视频 / GIF）。
  const [exportFor, setExportFor] = useState<{ id: string; title: string; schema: unknown } | null>(
    null,
  );
  // 作品详情抽屉：复用 S1 抽取的 WorkDetailPanel（元数据 + 审计留痕）
  const [detailId, setDetailId] = useState<string | null>(null);

  // 取消发布：与 web 端「我的作品」行为对齐（方案 A draft/live）。
  // 监督镜像（admin 选定对象）通过 subject=uid 代该用户操作；自助视角 uid 为空则操作本人。
  // ⚠️ 这里是裸 fetch，不经过 dataProvider（没有 withSubject 兜底），因此必须自己拼一次
  //    ?subject= —— 且只能拼这一次。同页下方的 deleteWork 走 dataProvider.custom，
  //    由 withSubject 注入，就【不能】再手工拼（拼两次会变数组导致归属判定失效）。
  const doUnpublishWork = async (id: string) => {
    try {
      const res = await fetch(
        `${API_URL}/provider/works/${id}/publish${uid ? `?subject=${uid}` : ''}`,
        { method: 'DELETE', headers: authHeaders() },
      );
      if (!res.ok) throw new Error('unpublish failed');
      message.success('已取消发布');
      refetch();
    } catch {
      message.error('取消发布失败');
    }
  };

  // 删除作品：走 provider 域 DELETE works/:id（subjectId 归属解析）。
  // ADMIN 监督视角下 withSubject 自动注入 ?subject=uid 代删；旧实现走 web 域
  // projects/:id（仅认登录者），监督视角必 404「作品不存在」。
  const deleteWork = async (id: string) => {
    if (!window.confirm('确定删除此作品？不可恢复')) return;
    try {
      await dataProvider.custom!({ url: `provider/works/${id}`, method: 'delete' });
      message.success('作品已删除');
      refetch();
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || '删除失败');
    }
  };

  if (isLoading) return <HomeSkeleton title="我的作品" />;

  // 监督镜像：ADMIN / AGENT 未选定对象时，不应展示「演示用户」的作品（会误导为「我的作品」缺失），
  // 给出明确引导；USER 自助视角恒取本人，正常渲染。
  if (!uid && role && role !== 'USER') {
    return (
      <>
        <PageHead title="我的作品" sub="监督镜像 · 未选定对象" chip="作品" />
        <Panel>
          <div
            style={{
              padding: '56px 24px',
              textAlign: 'center',
              color: T.ink3,
              fontSize: 14,
              lineHeight: 1.9,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, color: T.ink1, marginBottom: 10 }}>
              请先在上方搜索框选择要查看的用户
            </div>
            当前为管理员 / 代理商监督视角，未选定对象时不展示任何用户的作品。
            <br />
            选择用户后，这里将显示该用户的个人请柬作品（与网页端该用户「我的作品」一致）。
          </div>
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHead
        title="我的作品"
        sub={`共 ${items.length} 件个人请柬作品${uid ? ' · 监督对象' : ''}`}
        chip="作品"
      />

      {items.length === 0 ? (
        <Panel>
          <div style={{ padding: '56px 0', textAlign: 'center', color: T.ink3, fontSize: 14 }}>
            暂无作品。前往前端编辑器创作你的第一份请柬吧。
          </div>
        </Panel>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          {items.map((w: any) => (
            <UserWorkCard
              key={w.id}
              w={w}
              readonly={readonly}
              onPreview={() => setPreviewWork(w)}
              onEdit={() => navigate(`/sp/works/${w.id}/editor`)}
              onExport={() =>
                setExportFor({ id: w.id, title: w.title || '未命名作品', schema: w.schema })
              }
              onDelete={() => deleteWork(w.id)}
              onUnpublish={() => doUnpublishWork(w.id)}
              onDetail={() => setDetailId(w.id)}
            />
          ))}
        </div>
      )}

      {/* 作品预览弹窗：对标 web 端模板库预览（多页渲染 + 动画重播） */}
      <WorkPreviewModal work={previewWork} onClose={() => setPreviewWork(null)} />

      {/* 作品导出弹窗：复用编辑器内核 PublishModal（图片 / 视频 / GIF） */}
      <Suspense fallback={null}>
        <WorkExportDialog target={exportFor} onClose={() => setExportFor(null)} />
      </Suspense>

      {/* 作品详情抽屉：元数据 + 审计留痕（复用 S1 WorkDetailPanel） */}
      {detailId && (
        <Drawer
          title="作品详情"
          width={480}
          open={!!detailId}
          onClose={() => setDetailId(null)}
        >
          <WorkDetailPanel id={detailId} />
        </Drawer>
      )}
    </>
  );
};

/**
 * 用户作品网格卡片（运营端用户视角）。
 *
 * 对齐 web 端「我的作品」(ProjectList WorkCard) 的 hover 行为：
 * - 运维管理员（只读）：hover 仅显示「预览作品」——只进行预览操作。
 * - 超级管理员（可写）：hover 中央显示「详情 / 编辑」，上方显示「导出 / 删除」
 *   （已发布作品额外保留「取消发布」）。
 * 编辑进入运营端作品编辑器 /sp/works/:id/editor；详情复用预览弹窗；导出复用内核 PublishModal。
 */
function UserWorkCard({
  w,
  readonly,
  onPreview,
  onEdit,
  onExport,
  onDelete,
  onUnpublish,
  onDetail,
}: {
  w: any;
  readonly: boolean;
  onPreview: () => void;
  onEdit: () => void;
  onExport: () => void;
  onDelete: () => void;
  onUnpublish: () => void;
  onDetail: () => void;
}) {
  const published = w.status === 'published';
  const canWrite = !readonly;

  // 封面：优先封面图；其次真实渲染首屏 schema；再回退渐变占位 + 首字
  const coverNode = w.cover ? (
    <img
      src={w.cover}
      alt={w.title}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
    />
  ) : w.schema ? (
    <SchemaThumbnail schema={w.schema} />
  ) : (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f3f4f6, #e5e7eb)',
      }}
    >
      <span style={{ fontSize: 30, fontWeight: 700, color: T.onAccent }}>
        {(w.title || '未命名作品').toString().slice(0, 1)}
      </span>
    </div>
  );

  // 权限外置（遵循统一规范）：只读态仅 详情/导出/预览；可写态全开（含 取消发布）。
  const capabilities: DesignActionCaps = {
    preview: true,
    detail: true,
    export: true,
    edit: canWrite,
    delete: canWrite,
    unpublish: canWrite && published,
  };

  const labels: Record<string, string> = {
    detail: '详情',
    preview: '预览',
    edit: '编辑',
    export: '导出',
    delete: '删除',
    unpublish: '取消发布',
  };

  const on: Partial<Record<keyof DesignActionCaps, (it: any) => void>> = {
    detail: () => onDetail(),
    preview: () => onPreview(),
    edit: () => onEdit(),
    export: () => onExport(),
    delete: () => {
      if (window.confirm('确定删除此作品？不可恢复')) onDelete();
    },
    unpublish: () => {
      if (window.confirm('确定取消发布（下架线上 H5）？')) onUnpublish();
    },
  };

  return (
    <div
      style={{
        position: 'relative',
        background: '#fff',
        border: `1px solid ${T.border}`,
        borderRadius: T.rMd,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(20,24,40,.05)',
        transition: 'box-shadow .18s, transform .18s',
      }}
    >
      <DesignGalleryCard
        kind="work"
        badgeLabel={t(published ? 'status.PUBLISHED' : 'status.draft')}
        capabilities={capabilities}
        labels={labels}
        item={w}
        coverNode={coverNode}
        on={on}
        aspectRatio="375 / 667"
      />

      {/* 信息区（常驻） */}
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: T.ink1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {w.title || '未命名作品'}
        </div>
        <div
          style={{
            fontSize: 12,
            color: T.ink3,
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span>👁 {w.viewCount ?? 0}</span>
          <span>{dts(w.updatedAt)}</span>
        </div>
        {published && w.publishCode && (
          <a
            href={`${WEB_BASE}/p/${w.publishCode}`}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 13, color: T.accent, marginTop: 2 }}
          >
            访问 H5（{w.publishCode}）→
          </a>
        )}
      </div>
    </div>
  );
}
