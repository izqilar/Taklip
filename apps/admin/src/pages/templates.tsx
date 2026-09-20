import { useState } from 'react';
import { useCustom, useCustomMutation } from '@refinedev/core';
import { Input, Typography, message as antdMessage } from 'antd';
import { StatusTag } from '../components/common/StatusTag';
import { PageHead } from '../components/ui/PageHead';
import { Panel } from '../components/ui/Panel';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable } from '../components/ui/DataTable';
import { Pager } from '../components/ui/Pager';
import { Pill } from '../components/ui/Pill';
import { ReviewModal } from '../components/ui/ReviewModal';
import { T } from '../config/theme';
import { useLayer } from '../providers/layerContext';
import { formatCents } from '../utility';
import { t } from "../i18n/t";

const { Text } = Typography;

const CATEGORY_LABELS: Record<string, string> = {
  wedding: 'pages.cat.wedding',
  birth_celebration: 'pages.cat.birthCelebration',
  birthday: 'pages.cat.birthday',
  festival: 'pages.cat.festCard',
  housewarming: 'pages.cat.houseMove',
  school_promotion: 'pages.cat.promoStudy',
  social_gathering: 'pages.cat.socialParty',
  memorial: 'pages.cat.memorial',
  brand: 'pages.cat.bizPromo',
  recruitment: 'pages.cat.recruit',
  conference: 'pages.cat.meeting',
  opening: 'pages.cat.opening',
  education: 'pages.cat.edu',
  biz_social: 'pages.cat.bizSocial',
  marketing: 'pages.cat.productMkt',
};

const STATUS_OPTIONS = [
  { label: t("pages.lbl.all"), value: 'all' },
  { label: t("pages.enum.onSale"), value: 'APPROVED' },
  { label: t("pages.enum.pending"), value: 'PENDING' },
  { label: t("pages.enum.rejected"), value: 'REJECTED' },
  { label: t("pages.enum.takenDown"), value: 'TAKEN_DOWN' },
];

interface TemplateRow {
  id: string;
  name: string;
  category: string;
  price: number;
  status: string;
  reviewNote?: string | null;
  useCount: number;
  isOfficial: boolean;
  createdAt: string;
  author?: { id: string; nickname?: string; phone?: string } | null;
}

const catLabel = (c: string) => (c ? t(CATEGORY_LABELS[c] ?? c) : '—');

/** 详情弹窗字段（原型 .modal .kv） */
const detailFieldsOf = (r: TemplateRow | null) =>
  r
    ? [
        { label: t("pages.col.templateName"), value: r.name },
        { label: t("pages.col.type"), value: catLabel(r.category) },
        { label: t("pages.col.price"), value: formatCents(r.price) },
        {
          label: t("pages.col.author"),
          value: r.author?.nickname || r.author?.phone || '—',
        },
        { label: t("pages.col.status"), value: <StatusTag value={r.status} /> },
        { label: t("pages.col.usageCount"), value: String(r.useCount ?? 0) },
        {
          label: t("pages.col.reviewNote"),
          value: r.reviewNote ? (
            <span>{r.reviewNote}</span>
          ) : (
            <span style={{ color: T.ink3 }}>—</span>
          ),
        },
      ]
    : [];

/** 行操作链接（原型 .acts .l） */
const actLink = (
  label: string,
  color: string,
  onClick: () => void,
  disabled?: boolean,
) => (
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

export const TemplateReviewList = () => {
  const { readonly } = useLayer();
  const [status, setStatus] = useState<string>('all');
  const [kw, setKw] = useState('');
  const [current, setCurrent] = useState<TemplateRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [takedownOpen, setTakedownOpen] = useState(false);
  const [takedownReason, setTakedownReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useCustom<{ items: TemplateRow[]; total: number }>({
    url: `templates/admin?status=${status}&keyword=${encodeURIComponent(kw)}&pageSize=20`,
    method: 'get',
    queryOptions: { retry: false },
  });
  const { mutateAsync: review } = useCustomMutation();
  const { mutateAsync: takedown } = useCustomMutation();

  const items = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;

  const open = (row: TemplateRow) => {
    setCurrent(row);
    setDrawerOpen(true);
  };

  const doReview = async (decision: 'APPROVED' | 'REJECTED', reason?: string) => {
    if (!current) return;
    if (decision === 'REJECTED' && !reason?.trim()) {
      antdMessage.error(t('common.reasonRequired'));
      return;
    }
    setBusy(true);
    try {
      await review({ url: `templates/${current.id}/review`, method: 'patch', values: { decision, reviewNote: reason?.trim() || undefined } });
      antdMessage.success(decision === 'APPROVED' ? t('pages.enum.approvedOnSale') : t('pages.enum.rejected'));
      setDrawerOpen(false);
      refetch();
    } catch (e: any) {
      antdMessage.error(e?.response?.data?.message || e?.message || t('pages.toast.reviewFailed'));
    } finally {
      setBusy(false);
    }
  };

  const confirmTakedown = async (reason: string) => {
    if (!current) return;
    if (!reason?.trim()) {
      antdMessage.error('下架必须填写原因');
      return;
    }
    setBusy(true);
    try {
      await takedown({
        url: `templates/${current.id}/takedown`,
        method: 'patch',
        values: { reason: reason.trim() },
      });
      antdMessage.success(t('pages.enum.takenDown'));
      setTakedownOpen(false);
      setTakedownReason('');
      setDrawerOpen(false);
      refetch();
    } catch (e: any) {
      antdMessage.error(e?.response?.data?.message || e?.message || t('pages.toast.takeDownFailed'));
    } finally {
      setBusy(false);
    }
  };

  /** 列表内「通过」快捷入口：无需原因直接上架 */
  const quickApprove = async (row: TemplateRow) => {
    try {
      await review({ url: `templates/${row.id}/review`, method: 'patch', values: { decision: 'APPROVED' } });
      antdMessage.success(t('pages.enum.approvedOnSale'));
      refetch();
    } catch (e: any) {
      antdMessage.error(e?.response?.data?.message || e?.message || t('pages.toast.actionFailed'));
    }
  };

  return (
    <>
      <PageHead
        title={t('menu.admin.templates')}
        sub="请柬模板 · 待审 / 已审 / 下架 / 申诉"
        chip="总台"
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
        onSearch={() => refetch()}
      />

      <Panel
        title={<span>{t('menu.admin.templates')}</span>}
        hint={
          <>
            共 <b style={{ color: T.accent }}>{total}</b> 个模板 · 数据隔离由后端强制
          </>
        }
      >
        <DataTable<TemplateRow>
          rowKey="id"
          loading={isLoading}
          dataSource={items}
          scroll={{ x: 900 }}
          columns={[
            {
              title: t("pages.col.template"),
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
              title: t("pages.col.author"),
              dataIndex: ['author', 'nickname'],
              width: 130,
              render: (_: any, r: TemplateRow) =>
                r.author?.nickname || r.author?.phone || '—',
            },
            {
              title: t("pages.col.type"),
              dataIndex: 'category',
              width: 110,
              render: (_: any, r: TemplateRow) => (
                <span style={{ color: T.ink3 }}>{catLabel(r.category)}</span>
              ),
            },
            {
              title: t("pages.col.price"),
              dataIndex: 'price',
              align: 'right',
              width: 110,
              render: (v: number) => (
                <span
                  style={{
                    color: T.accent,
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                    fontFamily: T.fontNum,
                  }}
                >
                  {formatCents(v)}
                </span>
              ),
            },
            {
              title: t("pages.col.usageCount"),
              dataIndex: 'useCount',
              align: 'right',
              width: 90,
              render: (v: number) => (
                <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: T.fontNum }}>
                  {v ?? 0}
                </span>
              ),
            },
            {
              title: t("pages.col.status"),
              dataIndex: 'status',
              width: 100,
              render: (v: string) => <StatusTag value={v} />,
            },
            {
              title: t("pages.col.action"),
              key: 'op',
              width: 148,
              render: (_: any, r: TemplateRow) => (
                <div style={{ display: 'flex', gap: 12 }}>
                  {actLink(t('common.view'), T.ink2, () => open(r))}
                  {r.status !== 'APPROVED' &&
                    actLink(t('common.approve'), T.upInk, () => quickApprove(r), readonly)}
                  {r.status !== 'TAKEN_DOWN' &&
                    r.status !== 'REJECTED' &&
                    actLink(t('common.reject'), T.downInk, () => open(r), readonly)}
                </div>
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

      <ReviewModal
        open={drawerOpen}
        tag="审核"
        title={current ? `${t('pages.sec.templateReview')} · ${current.name}` : t('pages.sec.templateReview')}
        readonly={readonly}
        loading={busy}
        opinion
        opinionRequired
        onApprove={(reason) => doReview('APPROVED', reason)}
        onReject={(reason) => doReview('REJECTED', reason)}
        onClose={() => setDrawerOpen(false)}
        fields={detailFieldsOf(current)}
      />

      <ReviewModal
        open={takedownOpen}
        tag="下架"
        title={t("pages.btn.violationTakeDown")}
        readonly={readonly}
        loading={busy}
        opinion
        opinionRequired
        approveText={t("pages.confirm.takeDown")}
        onApprove={(reason) => confirmTakedown(reason)}
        onClose={() => {
          setTakedownOpen(false);
          setTakedownReason('');
        }}
        fields={[]}
      />
    </>
  );
};
