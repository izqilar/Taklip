import {
  Tag,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Modal,
  Button,
  Upload,
  Space,
  Divider,
  message,
} from 'antd';
import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustom } from '@refinedev/core';
import { GenericListPage } from '../components/GenericListPage';
import { ConsoleView } from '../components/ConsoleView';
import { PageHead } from '../components/ui/PageHead';
import { ReviewModal } from '../components/ui/ReviewModal';
import { KpiCard } from '../components/ui/KpiCard';
import { Panel } from '../components/ui/Panel';
import { DealOrdersPanel } from '../components/ui/DealOrdersPanel';
import { ChartCard } from '../components/ui/ChartCard';
import { HorizontalBarList } from '../components/ui/HorizontalBarList';
import { TodoList } from '../components/ui/TodoList';
import { DataTable } from '../components/ui/DataTable';
import { HomeSkeleton } from '../components/ui/HomeSkeleton';
import { StatusTag } from '../components/common/StatusTag';
import { Pill, type PillTone } from '../components/ui/Pill';
import { GRID, T } from '../config/theme';
import { categoryText, serviceRolesText, roleText, cleanCode } from '../config/labels';
import { ORDER_STATUS } from '../config/status';
import { formatCents, todayKey, API_URL, authHeaders } from '../utility';
import { dataProvider } from '../providers/dataProvider';
import { t } from "../i18n/t";

const today = todayKey;

/** 代理商辖区概览聚合响应 */
interface AgentStats {
  users: number;
  providers: number;
  orderTotal: number;
  dealOrders: number;
  refundedOrders: number;
  dealRate: number;
  returnRate: number;
  refundRate: number;
  tickets: number;
  totalRevenueCents: number;
  platformFeeCents: number;
  serviceCategoryShare: { category: string; count: number }[];
  monthlyRevenue: { month: string; amountCents: number }[];
}

/** 辖区服务商行 */
interface AgentProviderRow {
  id: string;
  nickname?: string | null;
  realName?: string | null;
  phone?: string | null;
  serviceRoles: string[];
  providerStatus: string;
}

/** 服务商工作台聚合响应 */
interface ProviderStats {
  balanceCents: number;
  totalIncomeCents: number;
  withdrawnCents: number;
  orderCount: number;
  dealOrders: number;
  refundedOrders: number;
  dealRate: number;
  returnRate: number;
  refundRate: number;
  serviceCount: number;
  feedbackCount: number;
  serviceCategoryShare: { category: string; count: number }[];
  monthlyRevenue: { month: string; amountCents: number }[];
}

/** 金额（分）渲染 */
const money = (v: any) => formatCents(v ?? 0);
/** 日期渲染 */
const dt = (v: any) =>
  v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—';
/** 数组拼接渲染 */
const arr = (v: any) => (Array.isArray(v) && v.length ? v.join('、') : '—');

const byMap =
  (map: Record<string, { key: string; color: string }>) => (v: string) =>
    v ? <Tag color={map[v]?.color}>{t(map[v]?.key ?? '未知状态')}</Tag> : '—';

/** 用户账户状态 */
const USER_STATUS: Record<string, { key: string; color: string }> = {
  ACTIVE: { key: 'pages.enum.normal', color: 'green' },
  DISABLED: { key: 'pages.enum.disabled', color: 'red' },
  INACTIVE: { key: 'pages.enum.inactive', color: 'default' },
  PENDING: { key: 'pages.enum.pending', color: 'gold' },
};

/* ===================== 代理商中心（AGENT 辖区视角） ===================== */

/** 辖区概览（原型 #pg-agent-home）：辖区 KPI + 待办 + 服务商构成 + 辖区服务商表 */
export const AgentDashboard = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useCustom<AgentStats>({
    url: 'agent/dashboard',
    method: 'get',
    queryOptions: { retry: false },
  });
  const { data: provData } = useCustom<{ items: AgentProviderRow[]; total: number }>({
    url: 'agent/providers?pageSize=5',
    method: 'get',
    queryOptions: { retry: false },
  });
  const s = data?.data as AgentStats | undefined;
  const providers = (provData?.data as any)?.items ?? [];
  const pending = providers.filter((p: AgentProviderRow) => p.providerStatus === 'PENDING').length;

  if (isLoading || !s) return <HomeSkeleton title="辖区概览" />;

  return (
    <>
      <PageHead
        title="辖区概览"
        sub={`辖区经营指标 · 截至今日 ${today()}`}
        chip="代理商 · 辖区作用域"
      />

      <div className={GRID.kpis}>
        <KpiCard
          main
          label="辖区流水"
          value={formatCents(s.totalRevenueCents)}
          delta="较上周"
          deltaTrend="up"
          foot={`辖区抽成 ${formatCents(s.platformFeeCents)}`}
        />
        <KpiCard label="辖区用户" value={s.users.toLocaleString('en-US')} delta="累计" deltaTrend="up" />
        <KpiCard
          label="辖区服务商"
          value={s.providers.toLocaleString('en-US')}
          delta="累计"
          deltaTrend="up"
          foot={
            <>
              入驻待初审 <b style={{ color: T.accent }}>{pending}</b> 家
            </>
          }
        />
        <KpiCard
          label="成交订单"
          value={s.dealOrders.toLocaleString('en-US')}
          delta="辖区有效成交"
          deltaTrend="up"
          foot={`成交率 ${s.dealRate}% · 退单率 ${s.returnRate}%`}
        />
      </div>

      {/* ── 成交订单构成（六指标口径统一） ── */}
      <DealOrdersPanel
        stats={{
          orderTotal: s.orderTotal,
          dealOrders: s.dealOrders,
          refundedOrders: s.refundedOrders,
          dealRate: s.dealRate,
          returnRate: s.returnRate,
          refundRate: s.refundRate,
        }}
      />

      <div className={GRID.duo}>
        <Panel title="待办事项" hint="辖区可办 · 点按直达">
          <TodoList
            items={[
              {
                icon: '审',
                tone: 'b',
                title: '服务商入驻待初审',
                desc: '辖区服务商 · 入驻初审',
                count: pending,
                onClick: () => navigate('/agent/providers'),
              },
              {
                icon: '⭐',
                tone: 'a',
                title: '辖区协商反馈',
                desc: '评价与反馈中心 · 协商中',
                count: s.tickets,
                onClick: () => navigate('/agent/feedback'),
              },
              {
                icon: '✉',
                tone: 'a',
                title: '我的待审公告',
                desc: '消息中心 · 发布待审',
                count: 0,
                onClick: () => navigate('/agent/messages'),
              },
            ]}
          />
        </Panel>

        <ChartCard title="辖区服务商构成" hint="按服务类型">
          <HorizontalBarList
            data={(s.serviceCategoryShare ?? []).map((c) => ({
              name: categoryText(c.category),
              value: c.count,
            }))}
            legend={['服务数量', '']}
          />
        </ChartCard>
      </div>

      <Panel title="辖区服务商" hint="数据按辖区隔离 · 仅本辖区可见">
        <DataTable<AgentProviderRow>
          dense
          rowKey="id"
          dataSource={providers}
          columns={[
            {
              title: '服务商',
              dataIndex: 'nickname',
              ellipsis: true,
              render: (v: string, r: AgentProviderRow) => v || r.realName || r.phone || '—',
            },
            {
              title: '服务类型',
              dataIndex: 'serviceRoles',
              render: (v: string[]) => (
                <span style={{ color: T.ink3 }}>{serviceRolesText(v)}</span>
              ),
            },
            {
              title: '资质',
              dataIndex: 'providerStatus',
              render: (v: string) => <StatusTag value={v} />,
            },
            {
              title: '',
              dataIndex: '__op',
              width: 56,
              render: () => (
                <span
                  onClick={() => navigate('/agent/providers')}
                  style={{ color: T.accent, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}
                >
                  查看
                </span>
              ),
            },
          ]}
        />
      </Panel>
    </>
  );
};

/** 辖区用户（role=USER） */
export const AgentUsers = () => (
  <GenericListPage
    title={t("pages.sec.regionUsers")}
    resource="agent/users"
    searchable
    searchField="nickname"
    searchPlaceholder={t("pages.ph.searchNickPhone")}
    columns={[
      { title: t("pages.col.nickname"), dataIndex: 'nickname', width: 130 },
      { title: t("pages.col.phone"), dataIndex: 'phone', width: 140 },
      { title: t("pages.field.role"), dataIndex: 'role', width: 120, render: (v: string) => roleText(v) },
      { title: t("pages.field.jurisdiction"), dataIndex: 'regionPath', width: 150 },
      { title: t("pages.col.status"), dataIndex: 'status', width: 100, render: byMap(USER_STATUS) },
      { title: t("pages.col.registeredAt"), dataIndex: 'createdAt', width: 170, render: dt },
    ]}
    detailFields={[
      { label: 'ID', dataIndex: 'id' },
      { label: t("pages.col.phone"), dataIndex: 'phone' },
      { label: t("pages.col.nickname"), dataIndex: 'nickname' },
      { label: t("pages.col.realName"), dataIndex: 'realName' },
      { label: t("pages.field.role"), dataIndex: 'role', format: 'role' },
      { label: t("pages.col.openedServices"), dataIndex: 'serviceRoles' },
      { label: t("pages.col.pendingServices"), dataIndex: 'pendingServiceRoles' },
      { label: t("pages.col.qualificationStatus"), dataIndex: 'providerStatus' },
      { label: t("pages.col.accountStatus"), dataIndex: 'status' },
      { label: t("pages.field.jurisdiction"), dataIndex: 'regionPath' },
      { label: t("pages.col.agentId"), dataIndex: 'agentId' },
      { label: t("pages.col.registeredAt"), dataIndex: 'createdAt', format: 'date' },
    ]}
  />
);

/** 辖区服务商（role=SERVICE_PROVIDER） */
export const AgentProviders = () => (
  <GenericListPage
    title={t("pages.sec.regionProviders")}
    resource="agent/providers"
    searchable
    searchField="nickname"
    searchPlaceholder={t("pages.ph.searchNickPhoneName")}
    columns={[
      { title: t("pages.col.nickname"), dataIndex: 'nickname', width: 130 },
      { title: t("pages.col.phone"), dataIndex: 'phone', width: 140 },
      { title: t("pages.col.realName"), dataIndex: 'realName', width: 120 },
      { title: t("pages.col.qualification"), dataIndex: 'providerStatus', width: 100, render: (v: any) => <StatusTag value={v} /> },
      { title: t("pages.col.serviceSubRole"), dataIndex: 'serviceRoles', render: serviceRolesText },
      { title: t("pages.field.jurisdiction"), dataIndex: 'regionPath', width: 150 },
    ]}
    detailFields={[
      { label: 'ID', dataIndex: 'id' },
      { label: t("pages.col.phone"), dataIndex: 'phone' },
      { label: t("pages.col.nickname"), dataIndex: 'nickname' },
      { label: t("pages.col.realName"), dataIndex: 'realName' },
      { label: t("pages.col.qualificationStatus"), dataIndex: 'providerStatus', format: 'status' },
      { label: t("pages.col.openedServices"), dataIndex: 'serviceRoles', format: 'roles' },
      { label: t("pages.col.pendingServices"), dataIndex: 'pendingServiceRoles', format: 'roles' },
      { label: t("pages.col.accountStatus"), dataIndex: 'status' },
      { label: t("pages.field.jurisdiction"), dataIndex: 'regionPath' },
      { label: t("pages.col.registeredAt"), dataIndex: 'createdAt', format: 'date' },
    ]}
  />
);

/** 辖区订单（买家落在辖区） */
export const AgentOrders = () => (
  <GenericListPage
    title={t("pages.sec.regionOrders")}
    resource="agent/orders"
    columns={[
      { title: t("pages.col.orderNo"), dataIndex: 'id', width: 200, ellipsis: true, render: (v: any) => cleanCode(v) },
      { title: t("pages.col.buyer"), dataIndex: ['buyer', 'nickname'], width: 120 },
      { title: t("pages.col.template"), dataIndex: ['template', 'name'], ellipsis: true },
      { title: t("pages.col.amount"), dataIndex: 'amount', width: 110, render: money },
      { title: t("pages.col.platformFee"), dataIndex: 'platformFee', width: 110, render: money },
      { title: t("pages.col.status"), dataIndex: 'status', width: 100, render: byMap(ORDER_STATUS) },
      { title: t("pages.col.orderAt"), dataIndex: 'createdAt', width: 170, render: dt },
    ]}
    detailFields={[
      { label: t("pages.col.orderNo"), dataIndex: 'id', format: 'code' },
      { label: t("pages.col.buyer"), dataIndex: ['buyer', 'nickname'] },
      { label: t("pages.col.buyerPhone"), dataIndex: ['buyer', 'phone'] },
      { label: t("pages.col.template"), dataIndex: ['template', 'name'] },
      { label: t("pages.col.templateCategory"), dataIndex: ['template', 'category'], format: 'category' },
      { label: t("pages.col.paidAmount"), dataIndex: 'amount', format: 'cents' },
      { label: t("pages.col.platformCommission"), dataIndex: 'platformFee', format: 'cents' },
      { label: t("pages.col.status"), dataIndex: 'status' },
      { label: t("pages.col.orderAt"), dataIndex: 'createdAt', format: 'date' },
    ]}
  />
);

interface AgentWalletStats {
  providerCount: number;
  balanceCents: number;
  totalIncomeCents: number;
  withdrawnCents: number;
}

interface AgentWalletProvider {
  id: string;
  nickname?: string | null;
  realName?: string | null;
  phone?: string | null;
  serviceRoles: string[];
  providerStatus: string;
}

/** 总台全平台资金口径（复用 admin/stats，供「结算总览」补全区级/平台级财务指标） */
interface AdminStats {
  users: number;
  providers: number;
  agents: number;
  orders: number;
  pendingWithdrawals: number;
  totalRevenueCents: number;
  platformFeeCents: number;
  totalWithdrawnCents: number;
}

/** 辖区结算与钱包（真实落地）：KPI 总览 + 辖区服务商钱包明细 */
export const AgentWallet = ({ variant = 'agent' }: { variant?: 'agent' | 'admin' }) => {
  const navigate = useNavigate();
  const isAdmin = variant === 'admin';
  const { data, isLoading } = useCustom<AgentWalletStats>({
    url: 'agent/wallet',
    method: 'get',
    queryOptions: { retry: false },
  });
  const { data: provData, isLoading: provLoading } = useCustom<{ items: AgentWalletProvider[]; total: number }>({
    url: 'agent/providers?pageSize=50',
    method: 'get',
    queryOptions: { retry: false },
  });
  const s = data?.data as AgentWalletStats | undefined;
  const providers = (provData?.data as any)?.items ?? [];
  // 总台「结算总览」额外复用 admin/stats：补全区级之上的全平台资金口径
  // （总流水 / 平台抽成 / 累计已提现 / 待处理提现）。仅总台视角拉取。
  const { data: statsData } = useCustom<AdminStats>({
    url: 'admin/stats',
    method: 'get',
    queryOptions: { retry: false, enabled: isAdmin },
  });
  const st = statsData?.data as AdminStats | undefined;

  const title = isAdmin ? t('pages.sec.settleAdmin', '结算总览 · 全平台') : t('pages.sec.settleWallet');
  const sub = isAdmin
    ? t('pages.desc.settleAdminSub', '全平台服务商可提现余额与累计收益汇总')
    : '辖区服务商可提现余额与累计收益汇总';
  const chip = isAdmin ? '总台 · 全盘治理' : '代理商 · 辖区作用域';
  const detailPath = isAdmin ? '/admin/provider-review' : '/agent/providers';

  if (isLoading || provLoading) {
    return (
      <>
        <PageHead title={title} sub={isAdmin ? sub : '辖区服务商资金汇总'} chip={chip} />
        <HomeSkeleton title={title} />
      </>
    );
  }

  return (
    <>
      <PageHead title={title} sub={sub} chip={chip} />

      <div className={GRID.kpis}>
        <KpiCard
          main
          label={isAdmin ? t('pages.col.platformWithdrawable') : t('pages.col.regionWithdrawable')}
          value={formatCents(s?.balanceCents ?? 0)}
          delta={isAdmin ? '全平台服务商可提现总额' : '辖区服务商可提现总额'}
          deltaTrend="up"
        />
        <KpiCard
          label={t('pages.col.totalIncome')}
          value={formatCents(s?.totalIncomeCents ?? 0)}
          delta="累计收入"
          deltaTrend="up"
        />
        <KpiCard
          label={t('pages.col.withdrawn')}
          value={formatCents(s?.withdrawnCents ?? 0)}
          delta="已提现"
        />
        <KpiCard
          label={t('pages.col.regionProviderCount')}
          value={(s?.providerCount ?? 0).toLocaleString('en-US')}
          delta={isAdmin ? '全平台在营服务商' : '辖区在营服务商'}
          deltaTrend="up"
        />
      </div>

      {isAdmin && st && (
        <Panel
          title={t('pages.sec.platformSettleStats', '平台资金总览')}
          hint={t('pages.desc.platformSettleStatsHint', '复用总台看板口径，与「数据看板」严格一致')}
        >
          <div className={GRID.kpis}>
            <KpiCard
              main
              label={t('pages.col.platformRevenue', '平台总流水')}
              value={formatCents(st.totalRevenueCents ?? 0)}
              delta="全平台累计成交金额"
              deltaTrend="up"
            />
            <KpiCard
              label={t('pages.col.platformFeeIncome', '平台抽成')}
              value={formatCents(st.platformFeeCents ?? 0)}
              delta="按分账费率累计抽取"
              deltaTrend="up"
            />
            <KpiCard
              label={t('pages.col.totalWithdrawn', '累计已提现')}
              value={formatCents(st.totalWithdrawnCents ?? 0)}
              delta="服务商已提现总额"
            />
            <KpiCard
              label={t('pages.col.pendingWithdrawals', '待处理提现')}
              value={(st.pendingWithdrawals ?? 0).toLocaleString('en-US')}
              delta="笔待审核"
            />
          </div>
        </Panel>
      )}

      <Panel title={isAdmin ? t('pages.sec.settleAdminDetail', '全平台服务商钱包明细') : '辖区服务商钱包明细'} hint="按服务子角色与资质状态">
        <DataTable<AgentWalletProvider>
          rowKey="id"
          dataSource={providers}
          scroll={{ x: 800 }}
          columns={[
            {
              title: '服务商',
              dataIndex: 'nickname',
              ellipsis: true,
              render: (v: string, r: AgentWalletProvider) => v || r.realName || r.phone || '—',
            },
            {
              title: '手机号',
              dataIndex: 'phone',
              width: 140,
              render: (v: string) => <span style={{ color: T.ink3 }}>{v || '—'}</span>,
            },
            {
              title: '服务子角色',
              dataIndex: 'serviceRoles',
              render: (v: string[]) => <span style={{ color: T.ink3 }}>{serviceRolesText(v)}</span>,
            },
            {
              title: '资质',
              dataIndex: 'providerStatus',
              width: 100,
              render: (v: string) => <StatusTag value={v} />,
            },
            {
              title: '',
              dataIndex: '__op',
              width: 56,
              render: () => (
                <span
                  onClick={() => navigate(detailPath)}
                  style={{ color: T.accent, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}
                >
                  查看
                </span>
              ),
            },
          ]}
        />
      </Panel>
    </>
  );
};

/* ===================== 服务商中心（SERVICE_PROVIDER 自身视角） ===================== */

/** 我的工作台（原型 #pg-provider-home）：收益 KPI + 订单待办 + 我的服务 + 最近订单 */
export const SPStudio = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useCustom<ProviderStats>({
    url: 'provider/dashboard',
    method: 'get',
    queryOptions: { retry: false },
  });
  const { data: svcData } = useCustom<{ items: any[] }>({
    url: 'provider/services?pageSize=5',
    method: 'get',
    queryOptions: { retry: false },
  });
  const { data: ordData } = useCustom<{ items: any[] }>({
    url: 'provider/orders?pageSize=5',
    method: 'get',
    queryOptions: { retry: false },
  });
  const s = data?.data as ProviderStats | undefined;
  const services = (svcData?.data as any)?.items ?? [];
  const orders = (ordData?.data as any)?.items ?? [];

  if (isLoading || !s) return <HomeSkeleton title="我的工作台" />;

  /** 本月收益取近 6 月序列末位（服务端按自然月聚合，缺失补 0） */
  const monthIncome = s.monthlyRevenue?.[s.monthlyRevenue.length - 1]?.amountCents ?? 0;

  return (
    <>
      <PageHead
        title="我的工作台"
        sub={`供给经营 · 截至今日 ${today()}`}
        chip="服务商 · 自身作用域"
      />

      <div className={GRID.kpis}>
        <KpiCard
          main
          label="可提现收益"
          value={formatCents(s.balanceCents)}
          delta={`累计收益 ${formatCents(s.totalIncomeCents)}`}
          deltaTrend="up"
          foot={`已提现 ${formatCents(s.withdrawnCents)}`}
        />
        <KpiCard label="在售服务" value={s.serviceCount.toLocaleString('en-US')} delta="我的服务" />
        <KpiCard
          label="累计接单"
          value={s.orderCount.toLocaleString('en-US')}
          delta="订单处理"
          foot={
            <>
              待处理反馈 <b style={{ color: T.accent }}>{s.feedbackCount}</b> 条
            </>
          }
        />
        <KpiCard label="本月收益" value={formatCents(monthIncome)} delta="近 6 月趋势" deltaTrend="up" />
      </div>

      {/* ── 成交订单构成（六指标口径统一） ── */}
      <DealOrdersPanel
        stats={{
          orderTotal: s.orderCount,
          dealOrders: s.dealOrders,
          refundedOrders: s.refundedOrders,
          dealRate: s.dealRate,
          returnRate: s.returnRate,
          refundRate: s.refundRate,
        }}
      />

      <div className={GRID.trio}>
        <Panel title="订单待办" hint="点按直达">
          <TodoList
            items={[
              {
                icon: '接',
                tone: 'a',
                title: '我的订单',
                desc: '订单处理 · 全部',
                count: s.orderCount,
                onClick: () => navigate('/sp/orders'),
              },
              {
                icon: '⭐',
                tone: 'b',
                title: '被诉回应',
                desc: '评价与反馈中心',
                count: s.feedbackCount,
                onClick: () => navigate('/sp/feedback'),
              },
              {
                icon: '服',
                tone: 'a',
                title: '我的服务',
                desc: '服务管理 · 上架/下架',
                count: s.serviceCount,
                onClick: () => navigate('/sp/services'),
              },
            ]}
          />
        </Panel>

        <Panel title="我的服务" hint="服务管理">
          <DataTable<any>
            dense
            rowKey="id"
            dataSource={services}
            columns={[
              { title: '服务', dataIndex: 'name', ellipsis: true },
              {
                title: '价格',
                dataIndex: 'price',
                align: 'right',
                render: (v: number) => (
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: T.fontNum }}>
                    {formatCents(v ?? 0)}
                  </span>
                ),
              },
              {
                title: '状态',
                dataIndex: 'status',
                render: (v: string) => <StatusTag value={v} />,
              },
            ]}
          />
        </Panel>

        <Panel title="最近订单" hint="订单处理">
          <DataTable<any>
            dense
            rowKey="id"
            dataSource={orders}
            columns={[
              {
                title: '订单',
                dataIndex: 'id',
                ellipsis: true,
                render: (v: string) => (
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: T.fontNum }}>
                    {String(v ?? '').slice(0, 10)}
                  </span>
                ),
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
                dataIndex: 'status',
                render: (v: string) => <StatusTag value={v} />,
              },
            ]}
          />
        </Panel>
      </div>
    </>
  );
};

/** 服务管理：我发布的模板（服务供给）· 列表 + 新建/编辑整页（pg-svccfg） */
export const SPServices = () => {
  const nav = useNavigate();
  const [sel, setSel] = useState<any>(null);
  const [tick, setTick] = useState(0);
  const buildFields = (r: any) => [
    { label: '编号', value: cleanCode(r.id) },
    { label: t('pages.col.name'), value: r.name || '—' },
    { label: t('pages.col.category'), value: categoryText(r.category) },
    { label: t('pages.col.status'), value: <StatusTag value={r.status} /> },
    { label: t('pages.col.tags'), value: Array.isArray(r.tags) && r.tags.length ? r.tags.join('、') : '—' },
    { label: t('pages.col.usageCount'), value: String(r.useCount ?? 0) },
    { label: t('pages.col.price'), value: money(r.price) },
    { label: t('pages.col.createdAt'), value: dt(r.createdAt) },
  ];
  const link = { color: T.accent, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' } as const;
  return (
    <>
      <GenericListPage
        title={t("pages.sec.serviceManage")}
        sub="服务发布 / 上架下架 · 前端服务专区即时同步"
        chip="服务商 · 自身作用域"
        resource="provider/services"
        rowKey="id"
        pageSize={20}
        key={tick}
        createLabel="＋ 新建服务"
        onCreate={() => nav('/sp/services/new')}
        searchable
        searchField="name"
        searchPlaceholder="搜索服务名称…"
        chipFilters={[
          { label: '全部', value: 'all' },
          { label: '在售', value: 'approved', test: (r: any) => r.status === 'APPROVED' },
          { label: '草稿', value: 'pending', test: (r: any) => r.status === 'PENDING' },
          { label: '已下架', value: 'down', test: (r: any) => r.status === 'TAKEN_DOWN' },
        ]}
        columns={[
          { title: t("pages.col.name"), dataIndex: 'name', ellipsis: true },
          { title: t('pages.col.category'), dataIndex: 'category', width: 120, render: categoryText },
          { title: t("pages.col.status"), dataIndex: 'status', width: 100, render: (v: any) => <StatusTag value={v} /> },
          { title: t("pages.col.usageCount"), dataIndex: 'useCount', width: 100 },
          { title: t("pages.col.price"), dataIndex: 'price', width: 120, render: money },
          { title: t("pages.col.createdAt"), dataIndex: 'createdAt', width: 170, render: dt },
        ]}
        rowActions={(r: any) => (
          <>
            <span onClick={() => setSel(r)} style={link}>查看</span>
            <span onClick={() => nav(`/sp/services/${r.id}`)} style={{ ...link, marginLeft: 12 }}>编辑</span>
          </>
        )}
      />
      <ReviewModal open={!!sel} tag="服务" title={sel ? `服务详情 · ${sel.name}` : ''} onClose={() => setSel(null)} fields={sel ? buildFields(sel) : []} />
    </>
  );
};

/** 订单履约状态（serviceStatus）映射 */
const SERVICE_STATUS: Record<string, { key: string; tone: PillTone }> = {
  pending_service: { key: 'pages.status.svcPending', tone: 'warn' },
  in_service: { key: 'status.PROCESSING', tone: 'ac' },
  completed: { key: 'pages.status.svcCompleted', tone: 'ok' },
  refunded: { key: 'status.REFUNDED', tone: 'bad' },
};

/** 订单处理：我提供的模板产生的订单（接单 / 完成交付 / 拒单 三态履约） */
export const SPOrders = () => {
  const [sel, setSel] = useState<any>(null);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);

  const act = async (id: string, action: string) => {
    // 连点保护：进行中的动作不允许再次触发，避免重复提交同一履约动作
    if (busy) return;
    setBusy(true);
    try {
      await dataProvider.custom!({
        url: `provider/orders/${id}/action`,
        method: 'patch',
        payload: { action },
      });
      message.success('操作成功');
      setSel(null);
      setTick((t) => t + 1);
    } catch (e: any) {
      // 必须显式报错：之前只有 finally，服务端 404/400 会变成未处理 rejection，
      // 界面停在「点了没反应 / 好像成功了」的假状态。
      message.error(e?.message || '操作失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  const rowActions = (r: any) => {
    const ss = r.serviceStatus ?? 'pending_service';
    return (
      <div style={{ display: 'flex', gap: 12 }}>
        <span
          onClick={() => setSel(r)}
          style={{ color: T.accent, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}
        >
          查看
        </span>
        {ss === 'pending_service' && (
          <>
            <span onClick={() => act(r.id, 'accept')} style={{ color: T.up, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>
              接单
            </span>
            <span onClick={() => act(r.id, 'reject')} style={{ color: T.downInk, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>
              拒单
            </span>
          </>
        )}
        {ss === 'in_service' && (
          <>
            <span onClick={() => act(r.id, 'complete')} style={{ color: T.up, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>
              完成
            </span>
            <span onClick={() => act(r.id, 'reject')} style={{ color: T.downInk, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>
              拒单
            </span>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <GenericListPage
        key={tick}
        title={t('pages.sec.orderHandle')}
        sub="接单 → 履约 → 交付 · 服务商三态履约"
        chip="服务商 · 自身作用域"
        resource="provider/orders"
        rowActions={rowActions}
        columns={[
          { title: t('pages.col.orderNo'), dataIndex: 'id', width: 200, ellipsis: true, render: (v: any) => cleanCode(v) },
          { title: t('pages.col.buyer'), dataIndex: ['buyer', 'nickname'], width: 120 },
          { title: t('pages.col.template'), dataIndex: ['template', 'name'], ellipsis: true },
          { title: t('pages.col.amount'), dataIndex: 'amount', width: 110, render: money },
          { title: t('pages.col.platformFee'), dataIndex: 'platformFee', width: 110, render: money },
          { title: '履约状态', dataIndex: 'serviceStatus', width: 100, render: (v: any) => <Pill tone={(SERVICE_STATUS[v] ?? SERVICE_STATUS.pending_service).tone}>{t((SERVICE_STATUS[v] ?? SERVICE_STATUS.pending_service).key)}</Pill> },
          { title: t('pages.col.status'), dataIndex: 'status', width: 100, render: byMap(ORDER_STATUS) },
          { title: t('pages.col.orderAt'), dataIndex: 'createdAt', width: 170, render: dt },
        ]}
      />
      <ReviewModal
        open={!!sel}
        tag="订单"
        title={sel ? `订单详情 · ${cleanCode(sel.id)}` : '订单详情'}
        loading={busy}
        onClose={() => setSel(null)}
        fields={
          sel
            ? [
                { label: t('pages.col.orderNo'), value: cleanCode(sel.id) },
                { label: t('pages.col.buyer'), value: sel.buyer?.nickname || '—' },
                { label: t('pages.col.buyerPhone'), value: sel.buyer?.phone || '—' },
                { label: t('pages.col.template'), value: sel.template?.name || '—' },
                { label: t('pages.col.templateCategory'), value: categoryText(sel.template?.category) },
                { label: t('pages.col.paidAmount'), value: money(sel.amount) },
                { label: t('pages.col.platformCommission'), value: money(sel.platformFee) },
                { label: '履约状态', value: <Pill tone={(SERVICE_STATUS[sel.serviceStatus] ?? SERVICE_STATUS.pending_service).tone}>{t((SERVICE_STATUS[sel.serviceStatus] ?? SERVICE_STATUS.pending_service).key)}</Pill> },
                { label: t('pages.col.status'), value: byMap(ORDER_STATUS)(sel.status) },
                { label: t('pages.col.orderAt'), value: dt(sel.createdAt) },
              ]
            : []
        }
      />
    </>
  );
};

/** 资质管理：当前服务商的资质状态与业务子角色 */
const LICENSE_TYPES = ['营业执照', '经营许可证', '居民身份证', '演出许可', '资质证书', '其他'].map((v) => ({ value: v, label: v }));
const LICENSE_STATUS = ['待审核', '有效', '已过期', '已驳回'].map((v) => ({ value: v, label: v }));
const REMIND_OPTS = [
  { value: '提前30天', label: '提前30天' },
  { value: '提前90天', label: '提前90天' },
  { value: '不提醒', label: '不提醒' },
];
const Q_CHIP_FILTERS = [
  { label: '全部', value: 'all' },
  { label: '有效', value: 'valid', test: (r: any) => r.status === '有效' },
  { label: '待审核', value: 'pending', test: (r: any) => r.status === '待审核' },
  { label: '已过期', value: 'expired', test: (r: any) => r.status === '已过期' },
];
const maskCert = (no: string) => (!no ? '—' : no.length <= 8 ? no : no.slice(0, 4) + '****' + no.slice(-4));
const licenseStatusTone = (s: string): PillTone =>
  s === '有效' ? 'ok' : s === '待审核' ? 'ac' : s === '已过期' ? 'warn' : 'bad';

/** 资质管理 / 资质详情设置页（pg-qualc · 证照预览 + 脱敏编号 + 附件上传） */
export const SPQualification = () => {
  const nav = useNavigate();
  const [tick, setTick] = useState(0);

  const columns:any[] = [
    { title: '编号', dataIndex: 'licNo', width: 110, render: (v: any) => cleanCode(v) },
    { title: '资质名称', dataIndex: 'name', width: 140, ellipsis: true },
    { title: '证件编号', dataIndex: 'certNo', width: 150, render: (v: any) => maskCert(v) },
    { title: '有效期', dataIndex: 'validTo', width: 120, render: (v: any, r: any) => r.longTerm ? '长期有效' : (v ? String(v).slice(0, 10) : '—') },
    { title: '审核状态', dataIndex: 'status', width: 100, render: (v: any) => <Pill tone={licenseStatusTone(v)}>{v}</Pill> },
    { title: '资质类型', dataIndex: 'type', width: 120 },
    { title: '发证机关', dataIndex: 'issuer', width: 130, ellipsis: true },
    { title: '资质说明', dataIndex: 'description', width: 160, ellipsis: true },
    { title: '附件名', dataIndex: 'attachments', width: 120, render: (v: any) => (Array.isArray(v) && v.length ? v[0].name : '—') },
  ];

  return (
    <GenericListPage
      key={tick}
      title={t('pages.sec.qualification')}
      sub="资质 / 实名 / 服务角色"
      resource="provider/qualifications"
      columns={columns}
      chipFilters={Q_CHIP_FILTERS}
      rowKey="id"
      createLabel="＋ 新增资质"
      onCreate={() => nav('/sp/qualification/new')}
      rowActions={(r: any) => (
        <span onClick={() => nav(`/sp/qualification/${r.id}`)} style={{ color: T.accent, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>查看 / 编辑</span>
      )}
    />
  );
};

interface SPWalletData {
  id: string;
  balance: number;
  totalIncome: number;
  withdrawn: number;
  updatedAt: string;
}

/** 钱包与提现：服务商本人的钱包（兼容钱包未创建时的空态，避免 404 白屏） */
export const SPWallet = () => {
  const { data, isLoading, isError, error } = useCustom<SPWalletData>({
    url: 'wallet/mine',
    method: 'get',
    queryOptions: { retry: false },
  });
  const wallet = (data?.data ?? data) as SPWalletData | undefined;

  const empty: SPWalletData = {
    id: '—',
    balance: 0,
    totalIncome: 0,
    withdrawn: 0,
    updatedAt: '',
  };
  const w = wallet ?? empty;
  const notCreated = isError && ((error as any)?.statusCode === 404 || (error as any)?.response?.status === 404);

  if (isLoading) {
    return (
      <>
        <PageHead title={t('pages.sec.walletWithdraw')} sub="我的钱包与收益" chip="服务商 · 自身作用域" />
        <HomeSkeleton title={t('pages.sec.walletWithdraw')} />
      </>
    );
  }

  return (
    <>
      <PageHead
        title={t('pages.sec.walletWithdraw')}
        sub="收益总览 · 可提现余额与累计收入"
        chip="服务商 · 自身作用域"
      />

      <div className={GRID.kpis}>
        <KpiCard
          main
          label={t('pages.col.withdrawable')}
          value={formatCents(w.balance)}
          delta="当前可提现"
          deltaTrend="up"
        />
        <KpiCard
          label={t('pages.col.totalIncome')}
          value={formatCents(w.totalIncome)}
          delta="累计收入"
          deltaTrend="up"
        />
        <KpiCard
          label={t('pages.col.withdrawn')}
          value={formatCents(w.withdrawn)}
          delta="已提现"
        />
        <KpiCard
          label={t('pages.col.walletId')}
          value={String(w.id).slice(0, 12)}
          delta={w.updatedAt ? new Date(w.updatedAt).toLocaleString('zh-CN', { hour12: false }) : '—'}
        />
      </div>

      <Panel title="钱包明细">
        {notCreated ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: T.ink3, fontSize: 13 }}>
            暂无钱包记录，完成首笔服务收益后将自动开通钱包。
            <div style={{ marginTop: 6, fontSize: 12 }}>当前展示为零值占位。</div>
          </div>
        ) : isError ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: T.downInk, fontSize: 13 }}>
            钱包加载失败，请稍后重试。
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.ink2 }}>
              <span>钱包状态</span>
              <span style={{ color: T.up, fontWeight: 600 }}>正常</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.ink2 }}>
              <span>可提现余额</span>
              <span style={{ color: T.accent, fontWeight: 600 }}>{formatCents(w.balance)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.ink2 }}>
              <span>累计收入</span>
              <span style={{ fontWeight: 600 }}>{formatCents(w.totalIncome)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.ink2 }}>
              <span>已提现</span>
              <span style={{ fontWeight: 600 }}>{formatCents(w.withdrawn)}</span>
            </div>
          </div>
        )}
      </Panel>
    </>
  );
};

/* ===================== 财务中心 · 分账费率（总台） ===================== */

/** 平台分账费率配置（全局单例，id 恒为 'default'） */
interface FeeConfig {
  id: string;
  platformRate: number;
  agentRate: number;
  providerRate: number;
  settlePeriod: string;
  categoryRates: Record<string, number> | null;
  minWithdrawCents: number;
  updatedBy?: string | null;
  updatedAt?: string;
}

/** 结算周期选项（术语与合同页 settleMonth / settleHalfMonth / settleWeek 保持一致） */
const SETTLE_PERIOD_OPTIONS = [
  { value: 'MONTH', label: '月结' },
  { value: 'HALF_MONTH', label: '半月结' },
  { value: 'WEEK', label: '周结' },
];

const settlePeriodText = (v?: string) =>
  SETTLE_PERIOD_OPTIONS.find((o) => o.value === v)?.label ?? '—';

/**
 * 分账费率配置页（总台 · 财务中心）。
 * 三区块：平台抽成比 / 服务商分账规则 / 类目费率，与原占位页 sections 一一对应。
 * 计算口径：providerRate = 100 - platformRate - agentRate（服务端同式推导并落库，
 * 此处仅做前端即时校验与试算，避免提交非法比例）。
 */
export const FeeConfigPage = () => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<FeeConfig | null>(null);
  /** 分账试算样本金额（分），默认 100.00 元 */
  const [sampleCents, setSampleCents] = useState(10000);

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await dataProvider.custom!({ url: 'admin/fee-config', method: 'get' });
      const cfg: FeeConfig = res?.data?.data ?? res?.data;
      setConfig(cfg);
      form.setFieldsValue({
        platformRate: cfg?.platformRate ?? 10,
        agentRate: cfg?.agentRate ?? 0,
        settlePeriod: cfg?.settlePeriod ?? 'MONTH',
        minWithdrawYuan: (cfg?.minWithdrawCents ?? 0) / 100,
        categoryRates: Object.entries(cfg?.categoryRates ?? {}).map(([category, rate]) => ({
          category,
          rate,
        })),
      });
    } catch (e: any) {
      message.error(e?.message || '费率配置加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const platformRate = Number(Form.useWatch('platformRate', form) ?? config?.platformRate ?? 0);
  const agentRate = Number(Form.useWatch('agentRate', form) ?? config?.agentRate ?? 0);
  const providerRate = 100 - platformRate - agentRate;
  const rateValid = providerRate >= 0;

  const samplePlatform = Math.round((sampleCents * platformRate) / 100);
  const sampleAgent = Math.round((sampleCents * agentRate) / 100);
  const sampleProvider = sampleCents - samplePlatform - sampleAgent;

  const save = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    const p = Number(values.platformRate ?? 0);
    const a = Number(values.agentRate ?? 0);
    if (p + a > 100) {
      message.error(t('pages.msg.feeRateOverflow', '平台抽成与代理商分账之和不能超过 100%'));
      return;
    }
    const categoryRates: Record<string, number> = {};
    (values.categoryRates ?? []).forEach((r: any) => {
      if (r?.category) categoryRates[String(r.category)] = Number(r.rate ?? 0);
    });
    setSaving(true);
    try {
      await dataProvider.custom!({
        url: 'admin/fee-config',
        method: 'put',
        payload: {
          platformRate: p,
          agentRate: a,
          settlePeriod: values.settlePeriod,
          minWithdrawCents: Math.round(Number(values.minWithdrawYuan ?? 0) * 100),
          categoryRates,
        },
      });
      message.success(t('pages.msg.feeConfigSaved', '分账费率已保存'));
      await load();
    } catch (e: any) {
      message.error(e?.message || t('pages.msg.opFailed', '操作失败'));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !config) {
    return (
      <>
        <PageHead title={t('pages.sec.feeConfig', '分账费率')} chip="财务中心" />
        <HomeSkeleton title={t('pages.sec.feeConfig', '分账费率')} />
      </>
    );
  }

  return (
    <>
      <PageHead
        title={t('pages.sec.feeConfig', '分账费率')}
        sub={t('pages.desc.feeConfigSub', '平台抽成比、服务商分账规则与类目费率的全局配置，作为新签合同的默认取价')}
        chip="财务中心 · 分账费率"
        extra={
          <Button type="primary" loading={saving} onClick={save}>
            {t('common.save', '保存')}
          </Button>
        }
      />

      <Form form={form} layout="vertical" requiredMark={false}>
        {/* ── 区块一：平台抽成比 ── */}
        <Panel
          title={t('pages.sec.platformFeeRate', '平台抽成比')}
          hint={t('pages.desc.platformFeeRateHint', '三方比例之和恒为 100%，服务商分账由系统自动推导')}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <Form.Item
              name="platformRate"
              label={t('pages.field.platformRate', '平台抽成比例')}
              rules={[{ required: true, message: '请输入平台抽成比例' }]}
            >
              <InputNumber min={0} max={100} precision={0} suffix="%" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="agentRate"
              label={t('pages.field.agentRate', '代理商分账比例')}
              rules={[{ required: true, message: '请输入代理商分账比例' }]}
            >
              <InputNumber min={0} max={100} precision={0} suffix="%" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label={t('pages.field.providerRate', '服务商分账比例')}>
              <div
                style={{
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  fontWeight: 600,
                  color: rateValid ? T.ink1 : T.down,
                }}
              >
                {rateValid ? `${providerRate}%` : `${providerRate}%（比例非法）`}
              </div>
              <div style={{ fontSize: 12, color: T.ink3 }}>
                {t('pages.note.providerRateDerived', '= 100% − 平台抽成 − 代理商分账，不可手工编辑')}
              </div>
            </Form.Item>
          </div>
        </Panel>

        {/* ── 区块二：服务商分账规则 ── */}
        <Panel
          title={t('pages.sec.providerSplitRule', '服务商分账规则')}
          hint={t('pages.desc.providerSplitRuleHint', '结算周期与提现门槛，并对当前费率做分账试算')}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <Form.Item
              name="settlePeriod"
              label={t('pages.field.settlePeriod', '结算周期')}
              rules={[{ required: true, message: '请选择结算周期' }]}
            >
              <Select options={SETTLE_PERIOD_OPTIONS} placeholder="请选择结算周期" />
            </Form.Item>
            <Form.Item
              name="minWithdrawYuan"
              label={t('pages.field.minWithdraw', '最低提现门槛（元）')}
              extra={t('pages.note.minWithdrawZero', '填 0 表示不限制')}
            >
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <Divider orientation="left" style={{ margin: '8px 0 12px' }}>
            {t('pages.sec.splitTrial', '分账试算')}
          </Divider>
          <Space align="start" size={24} wrap>
            <div>
              <div style={{ fontSize: 12, color: T.ink3, marginBottom: 4 }}>
                {t('pages.field.sampleAmount', '样本订单金额（元）')}
              </div>
              <InputNumber
                min={0}
                precision={2}
                value={sampleCents / 100}
                onChange={(v) => setSampleCents(Math.round(Number(v ?? 0) * 100))}
                style={{ width: 160 }}
              />
            </div>
            <div style={{ fontSize: 13, color: T.ink2, lineHeight: '22px' }}>
              <div>
                {t('pages.col.platformShare', '平台抽成')}
                {'：'}
                <b style={{ color: T.accent }}>{formatCents(samplePlatform)}</b>
                {'（'}
                {platformRate}%）
              </div>
              <div>
                {t('pages.col.agentShare', '代理商分账')}
                {'：'}
                <b>{formatCents(sampleAgent)}</b>
                {'（'}
                {agentRate}%）
              </div>
              <div>
                {t('pages.col.providerShare', '服务商实收')}
                {'：'}
                <b>{formatCents(sampleProvider)}</b>
                {'（'}
                {providerRate}%）
              </div>
            </div>
          </Space>
        </Panel>

        {/* ── 区块三：类目费率 ── */}
        <Panel
          title={t('pages.sec.categoryFeeRate', '类目费率')}
          hint={t('pages.desc.categoryFeeRateHint', '按服务品类覆盖平台抽成；未命中的类目回落到全局平台抽成比')}
        >
          <Form.List name="categoryRates">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Space key={field.key} align="baseline" style={{ marginBottom: 8 }}>
                    <Form.Item
                      {...field}
                      name={[field.name, 'category']}
                      rules={[{ required: true, message: '请输入品类' }]}
                      style={{ marginBottom: 0 }}
                    >
                      <Input placeholder={t('pages.ph.category', '服务品类')} style={{ width: 180 }} />
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, 'rate']}
                      rules={[{ required: true, message: '请输入费率' }]}
                      style={{ marginBottom: 0 }}
                    >
                      <InputNumber min={0} max={100} precision={0} suffix="%" style={{ width: 140 }} />
                    </Form.Item>
                    <Button type="link" danger onClick={() => remove(field.name)}>
                      {t('common.delete', '删除')}
                    </Button>
                  </Space>
                ))}
                <Button type="dashed" block onClick={() => add({ category: '', rate: 10 })}>
                  {t('pages.btn.addCategoryRate', '＋ 新增类目费率')}
                </Button>
              </>
            )}
          </Form.List>
        </Panel>
      </Form>

      {config?.updatedAt && (
        <div style={{ marginTop: 8, fontSize: 12, color: T.ink3 }}>
          {t('pages.field.lastUpdated', '最近更新')}
          {'：'}
          {new Date(config.updatedAt).toLocaleString('zh-CN', { hour12: false })}
          {config?.updatedBy ? `（${t('pages.field.operator', '操作人')} ${config.updatedBy}）` : ''}
        </div>
      )}
    </>
  );
};
