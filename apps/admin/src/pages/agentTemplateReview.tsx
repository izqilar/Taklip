import { useState } from 'react';
import { useCustom, useCustomMutation } from '@refinedev/core';
import { message as antdMessage } from 'antd';
import { StatusTag } from '../components/common/StatusTag';
import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable } from '../components/ui/DataTable';
import { Pager } from '../components/ui/Pager';
import { Pill } from '../components/ui/Pill';
import { RedlineReviewModal, REDLINE_CATEGORIES, type KVField } from '../components/ui/RedlineReviewModal';
import { T } from '../config/theme';
import { useLayer } from '../providers/layerContext';
import { formatCents } from '../utility';
import { t } from '../i18n/t';

const STATUS_OPTIONS = [
  { label: t('pages.lbl.all'), value: 'all' },
  { label: t('pages.enum.pending'), value: 'PENDING' },
  { label: t('pages.enum.onSale'), value: 'APPROVED' },
  { label: t('pages.enum.rejected'), value: 'REJECTED' },
  { label: t('pages.enum.takenDown'), value: 'TAKEN_DOWN' },
];

interface TemplateRow {
  id: string;
  name: string;
  category: string;
  price: number;
  status: string;
  reviewNote?: string | null;
  reviewStage?: string | null;
  redlineCategory?: string | null;
  useCount: number;
  isOfficial: boolean;
  createdAt: string;
  author?: { id: string; nickname?: string; phone?: string; regionPath?: string } | null;
}

const redlineLabel = (k?: string | null) =>
  REDLINE_CATEGORIES.find((c) => c.key === k)?.label ?? (k ? k : '—');

const detailFieldsOf = (r: TemplateRow | null): KVField[] =>
  r
    ? [
        { label: t('pages.col.templateName'), value: r.name },
        { label: t('pages.col.type'), value: r.category },
        { label: t('pages.col.price'), value: formatCents(r.price) },
        { label: t('pages.col.author'), value: r.author?.nickname || r.author?.phone || '—' },
        { label: t('pages.col.region'), value: r.author?.regionPath || '—' },
        { label: t('pages.col.status'), value: <StatusTag value={r.status} /> },
        { label: t('pages.col.usageCount'), value: String(r.useCount ?? 0) },
        {
          label: t('pages.col.reviewNote'),
          value: r.reviewNote ? <span>{r.reviewNote}</span> : <span style={{ color: T.ink3 }}>—</span>,
        },
      ]
    : [];

export const AgentTemplateReview = () => {
  const { readonly } = useLayer();
  const [status, setStatus] = useState<string>('PENDING');
  const [kw, setKw] = useState('');
  const [page, setPage] = useState(1);
  const [current, setCurrent] = useState<TemplateRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, isLoading, refetch } = useCustom<{ items: TemplateRow[]; total: number }>({
    url: `agent/templates?status=${status}&keyword=${encodeURIComponent(kw)}&pageSize=20&page=${page}`,
    method: 'get',
    queryOptions: { retry: false },
  });
  const { mutateAsync: review } = useCustomMutation();

  const items = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;

  const open = (r: TemplateRow) => {
    setCurrent(r);
    setModalOpen(true);
  };

  const doReview = async (decision: 'APPROVED' | 'REJECTED', reason?: string, redlineCategory?: string) => {
    if (!current) return;
    if (decision === 'REJECTED' && (!reason?.trim() || !redlineCategory)) {
      antdMessage.error(t('pages.toast.redlineRequired'));
      return;
    }
    setBusy(true);
    try {
      await review({
        url: `agent/templates/${current.id}/review`,
        method: 'patch',
        values: { decision, reviewNote: reason?.trim() || undefined, redlineCategory },
      });
      antdMessage.success(decision === 'APPROVED' ? t('pages.enum.approvedOnSale') : t('pages.enum.rejected'));
      setModalOpen(false);
      refetch();
    } catch (e: any) {
      antdMessage.error(e?.response?.data?.message || e?.message || t('pages.toast.reviewFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead
        title={t('menu.agent.template-review', '模板审核')}
        sub="辖区服务商提交的请柬模板 · 红线闸口一审"
        chip="内容审核"
      />

      <FilterBar
        filters={STATUS_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
        activeFilter={status}
        onFilterChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
        searchable
        searchPlaceholder={t('common.search')}
        searchValue={kw}
        onSearchChange={setKw}
        onSearch={() => {
          setPage(1);
          refetch();
        }}
      />

      <Panel
        title={<span>{t('menu.agent.template-review', '模板审核')}</span>}
        hint={
          <>
            共 <b style={{ color: T.accent }}>{total}</b> 个 · 仅本辖区（regionPath 前缀隔离）
          </>
        }
      >
        <DataTable<TemplateRow>
          rowKey="id"
          loading={isLoading}
          dataSource={items}
          scroll={{ x: 920 }}
          columns={[
            {
              title: t('pages.col.template'),
              dataIndex: 'name',
              ellipsis: true,
              render: (_: any, r: TemplateRow) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {r.name}
                  {r.isOfficial && <Pill tone="ac">官方</Pill>}
                </span>
              ),
            },
            {
              title: t('pages.col.author'),
              dataIndex: ['author', 'nickname'],
              width: 130,
              render: (_: any, r: TemplateRow) => r.author?.nickname || r.author?.phone || '—',
            },
            {
              title: t('pages.col.type'),
              dataIndex: 'category',
              width: 110,
              render: (_: any, r: TemplateRow) => <span style={{ color: T.ink3 }}>{r.category}</span>,
            },
            {
              title: t('pages.col.price'),
              dataIndex: 'price',
              align: 'right',
              width: 110,
              render: (v: number) => (
                <span style={{ color: T.accent, fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontFamily: T.fontNum }}>
                  {formatCents(v)}
                </span>
              ),
            },
            {
              title: t('pages.col.status'),
              dataIndex: 'status',
              width: 100,
              render: (v: string) => <StatusTag value={v} />,
            },
            {
              title: t('pages.col.redline'),
              dataIndex: 'redlineCategory',
              width: 110,
              render: (_: any, r: TemplateRow) =>
                r.redlineCategory ? <Pill tone="bad">{redlineLabel(r.redlineCategory)}</Pill> : <span style={{ color: T.ink3 }}>—</span>,
            },
            {
              title: t('pages.col.action'),
              key: 'op',
              width: 90,
              render: (_: any, r: TemplateRow) => (
                <span style={{ color: T.ink2, cursor: 'pointer' }} onClick={() => open(r)}>
                  {t('common.view')}
                </span>
              ),
            },
          ]}
        />
        <Pager
          total={total}
          current={page}
          pageSize={20}
          onChange={(p) => {
            setPage(p);
            refetch();
          }}
        />
      </Panel>

      <RedlineReviewModal
        open={modalOpen}
        title={current ? `${t('pages.sec.templateReview')} · ${current.name}` : t('pages.sec.templateReview')}
        tag="辖区一审"
        readonly={readonly}
        loading={busy}
        fields={detailFieldsOf(current)}
        machineHits={current?.redlineCategory ? { words: [], categories: [current.redlineCategory] } : null}
        onApprove={(reason) => doReview('APPROVED', reason)}
        onReject={(reason, redlineCategory) => doReview('REJECTED', reason, redlineCategory)}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
};
