import { useEffect, useMemo, useState } from 'react';
import { Select, Input, Form } from 'antd';
import { dataProvider } from '../providers/dataProvider';
import { getStoredUser } from '../utility';
import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable } from '../components/ui/DataTable';
import { Pager } from '../components/ui/Pager';
import { ReviewModal } from '../components/ui/ReviewModal';
import { Pill, type PillTone } from '../components/ui/Pill';
import { EmptyState } from '../components/common/EmptyState';
import { T } from '../config/theme';
import { useLayer } from '../providers/layerContext';
import { t } from '../i18n/t';
import { TICKET_STATUS } from '../config/status';

const TICKET_TYPE: Record<string, string> = {
  COMPLAINT: t("pages.fb.complaint"),
  PRAISE: t("pages.fb.praise"),
  SUGGESTION: t("pages.fb.suggestion"),
  CONSULT: t("pages.col.consult"),
  APPEAL: t("pages.fb.appeal"),
};


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
 * 评价与反馈中心（原型 总台 · 评价与反馈中心）。
 * 全部反馈 / 升级仲裁 同业务两段合一：胶囊筛选切换，处理动作走审核弹窗。
 */
export const FeedbackList = () => {
  const { readonly } = useLayer();
  const me = getStoredUser<{ role: string; regionPath?: string | null; id: string }>();
  const role = me?.role;
  const isAdmin = role === 'ADMIN';
  const isAgent = role === 'AGENT';
  const canHandle = isAdmin || isAgent;

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  // 默认进入「待处理（未关闭）」视图：与侧栏角标 feedback 的待办口径一致，打开即见待处理数
  const [statusFilter, setStatusFilter] = useState<any>('not_closed');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [current, setCurrent] = useState<any>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (isAdmin && statusFilter === 'ESCALATED') params.set('escalated', 'true');
      const { data } = await dataProvider.custom!({
        url: `tickets?${params.toString()}`,
        method: 'get',
      });
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleAct = async (id: string, action: 'assign' | 'escalate' | 'resolve') => {
    setBusy(true);
    try {
      await dataProvider.custom!({
        url: `tickets/${id}/${action}`,
        method: 'patch',
        payload: note ? { note } : {},
      });
      setCurrent(null);
      setNote('');
      load();
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    const v = await form.validateFields();
    setSubmitting(true);
    try {
      await dataProvider.custom!({ url: 'tickets', method: 'post', payload: v });
      setCreateOpen(false);
      form.resetFields();
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = useMemo(
    () =>
      rows.filter((r) =>
        keyword ? String(r.title ?? '').includes(keyword) : true,
      ),
    [rows, keyword],
  );

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const columns = [
    {
      title: t("pages.col.type"),
      dataIndex: 'type',
      width: 110,
      render: (ty: string) => <span style={{ color: T.ink3 }}>{TICKET_TYPE[ty] ?? ty}</span>,
    },
    { title: t("pages.col.title"), dataIndex: 'title', ellipsis: true },
    {
      title: t("pages.col.status"),
      dataIndex: 'status',
      width: 110,
      render: (s: string) => statusPill(s),
    },
    {
      title: t("pages.col.initiator"),
      dataIndex: ['reporter', 'nickname'],
      width: 130,
      render: (_: any, r: any) =>
        r.reporter ? r.reporter.nickname || r.reporter.phone : '—',
    },
    {
      title: t("pages.col.fbTarget"),
      dataIndex: ['target', 'nickname'],
      width: 130,
      render: (_: any, r: any) => (r.target ? r.target.nickname || r.target.phone : '—'),
    },
    { title: t("pages.col.createdAt"), dataIndex: 'createdAt', width: 170, render: dt },
    ...(canHandle
      ? [
          {
            title: t("pages.col.action"),
            dataIndex: '__op',
            width: 72,
            render: (_: any, r: any) => (
              <div style={{ display: 'flex', gap: 12 }}>
                {actLink(t("common.detail"), T.ink2, () => {
                  setCurrent(r);
                  setNote('');
                }, readonly)}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHead
        title={t('menu.admin.feedback')}
        sub="待处理(未关闭)优先 · 全部反馈可切换"
        chip={isAdmin ? '总台' : '代理商 · 辖区作用域'}
      />

      <FilterBar
        filters={[
          { label: '待处理', value: 'not_closed' },
          { label: '全部反馈', value: 'all' },
          { label: '升级仲裁', value: 'ESCALATED' },
          { label: '协商中', value: 'NEGOTIATING' },
          { label: '已关闭', value: 'CLOSED' },
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
        actions={
          <button
            type="button"
            disabled={readonly}
            onClick={() => setCreateOpen(true)}
            style={{
              border: `1px solid ${T.accent}`,
              borderRadius: T.rSm,
              padding: '6px 13px',
              background: T.accent,
              color: T.onAccent,
              fontSize: 13,
              fontWeight: 600,
              cursor: readonly ? 'not-allowed' : 'pointer',
              opacity: readonly ? 0.45 : 1,
              minHeight: 0,
              lineHeight: 1.6,
            }}
          >
            ＋ 发起反馈
          </button>
        }
      />

      <Panel
        title={<span>{t('menu.admin.feedback')}</span>}
        hint={
          <>
            共 <b style={{ color: T.accent }}>{filtered.length}</b> 条 · 数据隔离由后端强制
          </>
        }
      >
        <DataTable<any>
          rowKey="id"
          loading={loading}
          dataSource={paged}
          scroll={{ x: 900 }}
          locale={{ emptyText: <EmptyState /> }}
          columns={columns}
        />
        <Pager total={filtered.length} current={page} pageSize={pageSize} onChange={setPage} />
      </Panel>

      {/* 处理弹窗：查看 + 状态流转（认领协商 / 升级转总台 / 仲裁关闭） */}
      <ReviewModal
        open={!!current}
        tag="反馈"
        title={current ? `反馈处理 · ${current.title}` : '反馈处理'}
        readonly={readonly || !canHandle}
        loading={busy}
        onClose={() => setCurrent(null)}
        fields={
          current
            ? [
                { label: t("pages.col.type"), value: TICKET_TYPE[current.type] ?? current.type },
                { label: t("pages.col.title"), value: current.title },
                { label: t("pages.col.status"), value: statusPill(current.status) },
                {
                  label: t("pages.col.initiator"),
                  value: current.reporter?.nickname || current.reporter?.phone || '—',
                },
                {
                  label: t("pages.col.fbTarget"),
                  value: current.target?.nickname || current.target?.phone || '—',
                },
                { label: t("pages.col.createdAt"), value: dt(current.createdAt) },
                { label: t("pages.col.content"), value: current.content || '—' },
              ]
            : []
        }
        approveText="仲裁关闭"
        rejectText="升级转总台"
        onApprove={
          isAdmin && current && current.status !== 'CLOSED'
            ? (n) => {
                setNote(n);
                handleAct(current.id, 'resolve');
              }
            : undefined
        }
        onReject={
          isAgent && current && (current.status === 'OPEN' || current.status === 'NEGOTIATING')
            ? (n) => {
                setNote(n);
                handleAct(current.id, 'escalate');
              }
            : undefined
        }
        onEdit={
          isAgent && current && current.status === 'OPEN'
            ? () => handleAct(current.id, 'assign')
            : undefined
        }
        editText="认领协商"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
          <label style={{ fontSize: 12.5, color: T.ink2, fontWeight: 600 }}>
            处理意见（留痕）
          </label>
          <Input.TextArea
            rows={3}
            maxLength={2000}
            value={note}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
            placeholder={t("pages.field.escalationNote")}
          />
        </div>
      </ReviewModal>

      {/* 发起反馈弹窗 */}
      <ReviewModal
        open={createOpen}
        tag="新建"
        title="发起反馈"
        onClose={() => setCreateOpen(false)}
        approveText="提交"
        loading={submitting}
        onApprove={submit}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 14 }}>
          <Form.Item
            label={t("pages.col.type")}
            name="type"
            rules={[{ required: true, message: '请选择类型' }]}
            style={{ marginBottom: 12 }}
          >
            <Select
              placeholder={t("pages.ph.pleaseSelect")}
              options={Object.entries(TICKET_TYPE).map(([v, l]) => ({ value: v, label: l }))}
            />
          </Form.Item>
          <Form.Item
            label={t("pages.col.title")}
            name="title"
            rules={[{ required: true, message: '请输入标题' }]}
            style={{ marginBottom: 12 }}
          >
            <Input maxLength={120} placeholder={t("pages.field.brief")} />
          </Form.Item>
          <Form.Item
            label={t("pages.col.content")}
            name="content"
            rules={[{ required: true, message: t('pages.msg.plsInputContent') }]}
            style={{ marginBottom: 12 }}
          >
            <Input.TextArea rows={5} maxLength={2000} placeholder={t("pages.field.detailDesc")} />
          </Form.Item>
          <Form.Item
            label={t("pages.field.targetUserId")}
            name="targetId"
            tooltip={t("pages.field.providerUserIdHint")}
            style={{ marginBottom: 0 }}
          >
            <Input placeholder={t("pages.ph.blankMeansRecord")} />
          </Form.Item>
        </Form>
        <div style={{ fontSize: 12, color: T.ink3, marginTop: 10 }}>
          {isAgent ? t('pages.note.fbAgent') : isAdmin ? t('pages.note.fbAdmin') : t('pages.note.fbUser')}
        </div>
      </ReviewModal>
    </>
  );
};

export default FeedbackList;
