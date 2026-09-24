import { useState } from 'react';
import { useCustom, useCustomMutation } from '@refinedev/core';
import { message as antdMessage } from 'antd';
import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable } from '../components/ui/DataTable';
import { Pager } from '../components/ui/Pager';
import { Pill } from '../components/ui/Pill';
import { RedlineReviewModal, REDLINE_CATEGORIES, type KVField } from '../components/ui/RedlineReviewModal';
import { T } from '../config/theme';
import { useLayer } from '../providers/layerContext';
import { t } from '../i18n/t';

const STATUS_OPTIONS = [
  { label: t('pages.lbl.all'), value: 'all' },
  { label: t('pages.enum.pending'), value: 'review_pending' },
  { label: t('pages.enum.onSale'), value: 'approved' },
  { label: t('pages.enum.rejected'), value: 'rejected' },
];

interface ProjectRow {
  id: string;
  title: string;
  status: string;
  reviewStatus: string;
  reviewStage?: string | null;
  redlineCategory?: string | null;
  reviewNote?: string | null;
  createdAt: string;
  user?: { id: string; nickname?: string; phone?: string; regionPath?: string } | null;
}

const redlineLabel = (k?: string | null) =>
  REVIEW_CATEGORIES_FALLBACK(k);

// 复用同一份红线类别标签
function REVIEW_CATEGORIES_FALLBACK(k?: string | null) {
  return REDLINE_CATEGORIES.find((c) => c.key === k)?.label ?? (k ? k : '—');
}

const detailFieldsOf = (r: ProjectRow | null): KVField[] =>
  r
    ? [
        { label: t('pages.col.workTitle'), value: r.title },
        { label: t('pages.col.author'), value: r.user?.nickname || r.user?.phone || '—' },
        { label: t('pages.col.region'), value: r.user?.regionPath || '—' },
        { label: t('pages.col.reviewStatus'), value: <Pill tone={r.reviewStatus === 'approved' ? 'ok' : r.reviewStatus === 'rejected' ? 'bad' : 'ac'}>{r.reviewStatus}</Pill> },
        {
          label: t('pages.col.reviewNote'),
          value: r.reviewNote ? <span>{r.reviewNote}</span> : <span style={{ color: T.ink3 }}>—</span>,
        },
      ]
    : [];

export const AgentServiceReview = () => {
  const { readonly } = useLayer();
  const [status, setStatus] = useState<string>('review_pending');
  const [kw, setKw] = useState('');
  const [page, setPage] = useState(1);
  const [current, setCurrent] = useState<ProjectRow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, isLoading, refetch } = useCustom<{ items: ProjectRow[]; total: number }>({
    url: `agent/projects?status=${status}&keyword=${encodeURIComponent(kw)}&pageSize=20&page=${page}`,
    method: 'get',
    queryOptions: { retry: false },
  });
  const { mutateAsync: review } = useCustomMutation();

  const items = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;

  const open = (r: ProjectRow) => {
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
        url: `agent/projects/${current.id}/review`,
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
        title={t('menu.agent.service-review', '服务审核')}
        sub="辖区服务商发布的服务/作品 · 红线闸口一审（机审→待审→放行）"
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
        title={<span>{t('menu.agent.service-review', '服务审核')}</span>}
        hint={
          <>
            共 <b style={{ color: T.accent }}>{total}</b> 个 · 仅本辖区服务商作品
          </>
        }
      >
        <DataTable<ProjectRow>
          rowKey="id"
          loading={isLoading}
          dataSource={items}
          scroll={{ x: 860 }}
          columns={[
            {
              title: t('pages.col.workTitle'),
              dataIndex: 'title',
              ellipsis: true,
            },
            {
              title: t('pages.col.author'),
              dataIndex: ['user', 'nickname'],
              width: 130,
              render: (_: any, r: ProjectRow) => r.user?.nickname || r.user?.phone || '—',
            },
            {
              title: t('pages.col.region'),
              dataIndex: ['user', 'regionPath'],
              width: 140,
              ellipsis: true,
              render: (_: any, r: ProjectRow) => <span style={{ color: T.ink3 }}>{r.user?.regionPath || '—'}</span>,
            },
            {
              title: t('pages.col.reviewStatus'),
              dataIndex: 'reviewStatus',
              width: 130,
              render: (v: string) => (
                <Pill tone={v === 'approved' ? 'ok' : v === 'rejected' ? 'bad' : 'ac'}>{v}</Pill>
              ),
            },
            {
              title: t('pages.col.redline'),
              dataIndex: 'redlineCategory',
              width: 110,
              render: (_: any, r: ProjectRow) =>
                r.redlineCategory ? <Pill tone="bad">{redlineLabel(r.redlineCategory)}</Pill> : <span style={{ color: T.ink3 }}>—</span>,
            },
            {
              title: t('pages.col.action'),
              key: 'op',
              width: 90,
              render: (_: any, r: ProjectRow) => (
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
        title={current ? `${t('pages.sec.serviceReview')} · ${current.title}` : t('pages.sec.serviceReview')}
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
