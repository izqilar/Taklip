import { useEffect, useMemo, useState } from 'react';
import { Drawer, Descriptions, message as antdMessage } from 'antd';
import { dataProvider } from '../providers/dataProvider';
import { getStoredUser } from '../utility';
import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable } from '../components/ui/DataTable';
import { Pager } from '../components/ui/Pager';
import { Pill, type PillTone } from '../components/ui/Pill';
import { EmptyState } from '../components/common/EmptyState';
import { T } from '../config/theme';
import { t } from '../i18n/t';
import { TICKET_STATUS } from '../config/status';

const PAGE_SIZE = 15;

// 本地工单类型 → i18n 键（仅引用已存在且可解析的键，避免 providerConstants 中残留的空键）
const TICKET_TYPE: Record<string, string> = {
  COMPLAINT: 'pages.fb.complaint',
  PRAISE: 'pages.fb.praise',
  SUGGESTION: 'pages.fb.suggestion',
  CONSULT: 'pages.col.consult',
  APPEAL: 'pages.fb.appeal',
  AFTERSALE: 'pages.fb.aftersale',
  OTHER: 'pages.fb.other',
};

// 代理商「意见反馈」聚焦：投诉 / 建议 / 诉求 / 咨询类工单（与 agent/feedback 服务评价中心区分）
const COMPLAINT_TYPES = ['COMPLAINT', 'SUGGESTION', 'APPEAL', 'CONSULT', 'AFTERSALE', 'OTHER'];

const statusPill = (s: string) => {
  const m = TICKET_STATUS[s] ?? { key: s, tone: 'mut' as PillTone };
  return <Pill tone={m.tone}>{t(m.key)}</Pill>;
};

const dt = (v: string) => (v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '—');

const actLink = (label: string, color: string, onClick: () => void, disabled?: boolean) => (
  <span
    onClick={disabled ? undefined : onClick}
    style={{
      fontSize: 13,
      cursor: disabled ? 'not-allowed' : 'pointer',
      color: disabled ? T.ink3 : color,
      opacity: disabled ? 0.55 : 1,
      whiteSpace: 'nowrap',
    }}
  >
    {label}
  </span>
);

/**
 * 代理商 · 意见反馈（辖区工单，一线处理）。
 * 复用 GET /api/tickets：后端按代理商 regionPath 强制辖区隔离（scopeWhere）。
 * 代理商可「认领协商」（OPEN）/「升级转交总台」（OPEN、NEGOTIATING）；仲裁关闭仅总台。
 */
export const AgentComplaints = () => {
  const me = getStoredUser<{ role: string; regionPath?: string | null; id: string }>();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('not_closed');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [current, setCurrent] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      const { data } = await dataProvider.custom!({ url: `tickets?${params.toString()}`, method: 'get' });
      const all = Array.isArray(data) ? data : [];
      setRows(all.filter((r: any) => COMPLAINT_TYPES.includes(r.type)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const filtered = useMemo(
    () => (keyword ? rows.filter((r) => String(r.title ?? '').includes(keyword)) : rows),
    [rows, keyword],
  );
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handle = async (id: string, action: 'assign' | 'escalate') => {
    setBusy(true);
    try {
      await dataProvider.custom!({ url: `tickets/${id}/${action}`, method: 'patch', payload: {} });
      antdMessage.success(action === 'assign' ? t('pages.enum.pendingProcess') : t('pages.enum.escalated'));
      setOpen(false);
      setCurrent(null);
      load();
    } catch (e: any) {
      antdMessage.error(e?.message || t('pages.toast.actionFailed'));
    } finally {
      setBusy(false);
    }
  };

  const canAssign = (r: any) => r?.status === 'OPEN';
  const canEscalate = (r: any) => r?.status === 'OPEN' || r?.status === 'NEGOTIATING';

  const columns = [
    {
      title: t('pages.col.type'),
      dataIndex: 'type',
      width: 110,
      render: (ty: string) => <span style={{ color: T.ink3 }}>{t(TICKET_TYPE[ty] ?? ty)}</span>,
    },
    { title: t('pages.col.title'), dataIndex: 'title', ellipsis: true },
    { title: t('pages.col.status'), dataIndex: 'status', width: 110, render: (s: string) => statusPill(s) },
    {
      title: t('pages.col.initiator'),
      dataIndex: ['reporter', 'nickname'],
      width: 120,
      render: (_: any, r: any) => (r.reporter ? r.reporter.nickname || r.reporter.phone : '—'),
    },
    {
      title: t('pages.col.fbTarget'),
      dataIndex: ['target', 'nickname'],
      width: 120,
      render: (_: any, r: any) => (r.target ? r.target.nickname || r.target.phone : '—'),
    },
    { title: t('pages.col.time'), dataIndex: 'createdAt', width: 170, render: dt },
    {
      title: t('pages.col.action'),
      dataIndex: '__op',
      width: 90,
      render: (_: any, r: any) => (
        <div style={{ display: 'flex', gap: 12 }}>
          {actLink(t('common.detail'), T.ink2, () => {
            setCurrent(r);
            setOpen(true);
          })}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHead
        title={t('menu.agent.complaints')}
        sub="辖区工单一线处理 · 认领协商 / 升级转交总台 · 数据隔离由后端强制"
        chip="代理商 · 意见反馈"
      />

      <FilterBar
        filters={[
          { label: t('pages.enum.pendingProcess'), value: 'not_closed' },
          { label: t('pages.enum.all'), value: 'all' },
          { label: t('pages.enum.escalated'), value: 'ESCALATED' },
        ]}
        activeFilter={statusFilter}
        onFilterChange={(v) => {
          setStatusFilter(v);
          setPage(1);
        }}
        searchable
        searchPlaceholder="搜索反馈标题…"
        searchValue={keyword}
        onSearchChange={setKeyword}
        onSearch={setKeyword}
      />

      <Panel
        title={<span>{t('menu.agent.complaints')}</span>}
        hint={
          <>
            共 <b style={{ color: T.accent }}>{filtered.length}</b> 条 · 辖区可见
          </>
        }
      >
        <DataTable<any>
          rowKey="id"
          loading={loading}
          dataSource={paged}
          scroll={{ x: 900 }}
          locale={{ emptyText: <EmptyState description={t('pages.empty.noPendingNotice')} /> }}
          columns={columns}
        />
        <Pager total={filtered.length} current={page} pageSize={PAGE_SIZE} onChange={setPage} />
      </Panel>

      <Drawer
        title={current?.title || t('menu.agent.complaints')}
        open={open}
        width={520}
        onClose={() => setOpen(false)}
      >
        {current && (
          <>
            <Descriptions column={1} bordered size="small" styles={{ label: { width: 96 } }}>
              <Descriptions.Item label={t('pages.col.type')}>{t(TICKET_TYPE[current.type] ?? current.type)}</Descriptions.Item>
              <Descriptions.Item label={t('pages.col.status')}>{statusPill(current.status)}</Descriptions.Item>
              <Descriptions.Item label={t('pages.col.initiator')}>
                {current.reporter ? current.reporter.nickname || current.reporter.phone : '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('pages.col.fbTarget')}>
                {current.target ? current.target.nickname || current.target.phone : '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('pages.col.time')}>{dt(current.createdAt)}</Descriptions.Item>
              <Descriptions.Item label={t('pages.col.content')}>{current.content || '—'}</Descriptions.Item>
            </Descriptions>
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button
                type="button"
                disabled={!canAssign(current) || busy}
                onClick={() => handle(current.id, 'assign')}
                style={btnStyle(canAssign(current) && !busy)}
              >
                {t('pages.btn.claimNegotiate')}
              </button>
              <button
                type="button"
                disabled={!canEscalate(current) || busy}
                onClick={() => handle(current.id, 'escalate')}
                style={btnStyle(canEscalate(current) && !busy, true)}
              >
                {t('pages.btn.escalateAdmin')}
              </button>
            </div>
          </>
        )}
      </Drawer>
    </>
  );
};

function btnStyle(enabled: boolean, outline = false): React.CSSProperties {
  return {
    border: outline ? `1px solid ${T.accent}` : 'none',
    borderRadius: T.rSm,
    padding: '6px 14px',
    background: outline ? 'transparent' : T.accent,
    color: outline ? T.accent : T.onAccent,
    fontSize: 13,
    fontWeight: 600,
    cursor: enabled ? 'pointer' : 'not-allowed',
    opacity: enabled ? 1 : 0.45,
    minHeight: 0,
    lineHeight: 1.6,
  };
}
