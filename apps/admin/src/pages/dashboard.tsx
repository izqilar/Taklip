import { useCustom } from '@refinedev/core';
import { useNavigate } from 'react-router-dom';
import { PageHead } from '../components/ui/PageHead';
import { KpiCard } from '../components/ui/KpiCard';
import { Panel } from '../components/ui/Panel';
import { DealOrdersPanel } from '../components/ui/DealOrdersPanel';
import { ChartCard } from '../components/ui/ChartCard';
import { BarCompare } from '../components/ui/BarCompare';
import { TrendArea } from '../components/ui/TrendArea';
import { TodoList } from '../components/ui/TodoList';
import { Pill } from '../components/ui/Pill';
import { DataTable } from '../components/ui/DataTable';
import { GRID, T } from '../config/theme';
import { formatCents } from '../utility';
import { serviceRolesText } from '../config/labels';

interface AgentTop {
  id: string;
  name: string;
  region: string;
  revenueCents: number;
  orders: number;
}

interface ReviewMini {
  id: string;
  name: string;
  serviceRoles: string[];
  region: string;
  createdAt: string;
}

interface ConsoleStats {
  users: number;
  providers: number;
  pendingProviders: number;
  orderTotal: number;
  dealOrders: number;
  refundedOrders: number;
  dealRate: number;
  returnRate: number;
  pendingWithdrawals: number;
  totalRevenueCents: number;
  platformFeeCents: number;
  refundRate: number;
  regionBars: { name: string; revenueCents: number; orders: number }[];
  trend14d: { day: string; amountCents: number }[];
  agentTop: AgentTop[];
  reviewMini: ReviewMini[];
  todos: {
    pendingWithdrawals: number;
    pendingProviders: number;
    escalatedTickets: number;
    pendingAnnouncements: number;
  };
}

const today = () => {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * 管理总台 · 经营总览（原型 #pg-console-home）。
 * 结构：pghead → KPI 四联（首张为主卡）→ duo（区域对比 + 流水趋势）→ trio（绩效 / 待办 / 入驻审核）
 */
export const Dashboard = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useCustom<ConsoleStats>({
    url: 'console/dashboard',
    method: 'get',
    queryOptions: { retry: false },
  });
  const s = data?.data as ConsoleStats | undefined;

  // 首屏骨架（原型 loading 态：面板内 5 条骨架行）
  if (isLoading || !s) {
    return (
      <>
        <PageHead title="经营总览" sub={`平台运营核心指标 · 截至今日 ${today()}`} chip="总台 · 全盘治理" />
        <div style={GRID.kpis}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                background: T.bg,
                border: `1px solid ${T.border}`,
                borderRadius: T.rMd,
                height: 104,
              }}
            />
          ))}
        </div>
      </>
    );
  }

  const peakCents = Math.max(...s.trend14d.map((d) => d.amountCents), 0);

  /** 区域对比：≥1 万折为万元（原型口径），否则按元展示，避免小额取整为 0 */
  const wan = (cents: number) => Math.round((cents / 100 / 10000) * 10) / 10;
  const useWan = Math.max(...s.regionBars.map((r) => r.revenueCents), 0) >= 1_000_000;
  const regionBars = s.regionBars.map((r) => ({
    name: r.name,
    value: useWan ? wan(r.revenueCents) : Math.round((r.revenueCents / 100) * 100) / 100,
    value2: r.orders,
    prefix: '¥',
    suffix: useWan ? 'w' : '',
  }));

  return (
    <>
      <PageHead
        title="经营总览"
        sub={`平台运营核心指标 · 截至今日 ${today()}`}
        chip="总台 · 全盘治理"
      />

      {/* ── KPI 四联：主指标大一号，不搞四张一样大 ── */}
      <div style={GRID.kpis}>
        <KpiCard
          main
          label="平台总流水"
          value={formatCents(s.totalRevenueCents)}
          delta="较上周"
          deltaTrend="up"
          foot={`抽成 ${formatCents(s.platformFeeCents)}（10%）`}
        />
        <KpiCard label="注册用户" value={s.users.toLocaleString('en-US')} delta="累计" deltaTrend="up" />
        <KpiCard
          label="在营服务商"
          value={s.providers.toLocaleString('en-US')}
          delta="累计"
          deltaTrend="up"
          foot={
            <>
              待入驻审核 <b style={{ color: T.accent }}>{s.pendingProviders}</b> 家
            </>
          }
        />
        <KpiCard
          label="成交订单"
          value={s.dealOrders.toLocaleString('en-US')}
          delta="有效成交"
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

      {/* ── duo：区域经营对比 + 资金流水趋势 ── */}
      <div style={GRID.duo}>
        <ChartCard title="区域经营对比" hint="近 30 日 · 按流水排序">
          <BarCompare
            data={regionBars}
            legend={[useWan ? '平台流水（万元）' : '平台流水（元）', '订单量']}
          />
        </ChartCard>
        <ChartCard title="资金流水趋势" hint="近 14 日">
          <TrendArea
            data={s.trend14d.map((d) => d.amountCents)}
            legend={['总流水（万元）', `峰值 ${formatCents(peakCents)}`]}
          />
        </ChartCard>
      </div>

      {/* ── trio：绩效 / 待办 / 入驻审核 ── */}
      <div style={GRID.trio}>
        <Panel title="代理商绩效 前五名" hint="按月流水">
          <DataTable<AgentTop>
            dense
            rowKey="id"
            dataSource={s.agentTop}
            columns={[
              { title: '代理商', dataIndex: 'name', ellipsis: true },
              {
                title: '辖区',
                dataIndex: 'region',
                render: (v: string) => <span style={{ color: T.ink3 }}>{v || '—'}</span>,
              },
              {
                title: '流水',
                dataIndex: 'revenueCents',
                align: 'right',
                render: (v: number) => (
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: T.fontNum }}>
                    {formatCents(v)}
                  </span>
                ),
              },
              {
                title: '订单',
                dataIndex: 'orders',
                align: 'right',
                render: (v: number) => (
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: T.fontNum }}>
                    {v.toLocaleString('en-US')}
                  </span>
                ),
              },
            ]}
          />
        </Panel>

        <Panel title="待办与预警" hint="点按直达">
          <TodoList
            items={[
              {
                icon: '¥',
                tone: 'a',
                title: '待审核提现',
                desc: '财务中心 · 提现审核队列',
                count: s.todos.pendingWithdrawals,
                onClick: () => navigate('/admin/withdrawals'),
              },
              {
                icon: '审',
                tone: 'b',
                title: '服务商入驻待审',
                desc: '服务商管理 · 入驻审核队列',
                count: s.todos.pendingProviders,
                onClick: () => navigate('/admin/provider-review'),
              },
              {
                icon: '⭐',
                tone: 'c',
                title: '升级反馈待仲裁',
                desc: '评价与反馈中心',
                count: s.todos.escalatedTickets,
                onClick: () => navigate('/admin/feedback'),
              },
              {
                icon: '✉',
                tone: 'a',
                title: '权威公告待审',
                desc: '消息中心 · 公告审核',
                count: s.todos.pendingAnnouncements,
                onClick: () => navigate('/admin/messages'),
              },
            ]}
          />
        </Panel>

        <Panel
          title="服务商入驻审核"
          hint={
            <>
              待审 <b style={{ color: T.accent }}>{s.pendingProviders}</b> · 点按处理
            </>
          }
        >
          <DataTable<ReviewMini>
            dense
            rowKey="id"
            dataSource={s.reviewMini}
            columns={[
              { title: '申请人', dataIndex: 'name', ellipsis: true },
              {
                title: '类型',
                dataIndex: 'serviceRoles',
                render: (v: string[]) => (
                  <span style={{ color: T.ink3 }}>
                    {serviceRolesText(v)}
                  </span>
                ),
              },
              {
                title: '区域',
                dataIndex: 'region',
                render: (v: string) => <span style={{ color: T.ink3 }}>{v || '—'}</span>,
              },
              {
                title: '状态',
                dataIndex: 'createdAt',
                render: (v: string) => <Pill tone="warn">待审核</Pill>,
              },
              {
                title: '',
                dataIndex: '__op',
                width: 56,
                render: () => (
                  <span
                    onClick={() => navigate('/admin/provider-review')}
                    style={{ color: T.accent, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}
                  >
                    处理
                  </span>
                ),
              },
            ]}
          />
        </Panel>
      </div>
    </>
  );
};

export default Dashboard;
