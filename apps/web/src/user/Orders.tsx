/**
 * 我的订单（原型 u-orders，严格对齐运营端）：
 * 胶囊筛选（全部 / 待服务 / 履约中 / 已完成 / 已退款）+ 搜索 +
 * 表格（订单 / 服务 / 服务商 / 金额 / 时间 / 状态）+ 行操作（查看 / 评价·仅已完成）。
 * 详情（查看）与写回（评价）均镜像运营端。
 * 数据：GET /api/user/orders；提交评价：POST /api/user/reviews。
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import {
  formatCents,
  StatusBadge,
  Stars,
  UserListPage,
  DetailModal,
  ReviewEditor,
  type Column,
  type ChipFilterDef,
} from './shared';

const serviceStatusTone = (s?: string): 'warn' | 'accent' | 'ok' | 'bad' | 'default' => {
  if (s === 'pending_service') return 'warn';
  if (s === 'in_service') return 'accent';
  if (s === 'completed') return 'ok';
  if (s === 'refunded') return 'bad';
  return 'default';
};

const orderCode = (r: any) => (r && r.orderNo ? `QD…${String(r.orderNo).slice(-4)}` : r?.id ?? '—');

export default function Orders() {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<any>(null);
  const [reviewFor, setReviewFor] = useState<any>(null);

  const filters: ChipFilterDef[] = [
    { label: t('common:userCenter.filters.all'), value: 'all' },
    { label: t('common:userCenter.status.pending_service'), value: 'pending_service', field: 'serviceStatus' },
    { label: t('common:userCenter.status.in_service'), value: 'in_service', field: 'serviceStatus' },
    { label: t('common:userCenter.status.completed'), value: 'completed', field: 'serviceStatus' },
    { label: t('common:userCenter.status.refunded'), value: 'refunded', field: 'serviceStatus' },
  ];

  const columns: Column<any>[] = [
    { key: 'orderNo', title: t('common:userCenter.orders.orderNo'), render: (r) => <span className="font-mono tabular-nums text-[#2a2118]">{orderCode(r)}</span> },
    { key: 'service', title: t('common:userCenter.orders.service'), render: (r) => r.template?.name || '—' },
    { key: 'provider', title: t('common:userCenter.orders.provider'), render: (r) => <span className="text-[#4c4236]">{r.template?.author?.nickname || '—'}</span> },
    { key: 'amount', title: t('common:userCenter.orders.amount'), align: 'right', render: (r) => <span className="font-mono tabular-nums">{formatCents(r.amount)}</span> },
    { key: 'time', title: t('common:userCenter.orders.time'), render: (r) => <span className="text-xs text-[#6e5f4a]">{r.createdAt ? new Date(r.createdAt).toLocaleString('zh-CN', { hour12: false }) : '—'}</span> },
    {
      key: 'status',
      title: t('common:userCenter.orders.status'),
      render: (r) => (
        <StatusBadge tone={serviceStatusTone(r.serviceStatus)}>{t(`common:userCenter.status.${r.serviceStatus ?? 'paid'}`)}</StatusBadge>
      ),
    },
  ];

  const rowActions = (r: any) => (
    <>
      <button type="button" onClick={() => setDetail(r)} className="text-[#D24830] hover:underline">
        {t('common:button.detail')}
      </button>
      {r.serviceStatus === 'completed' && (
        <button
          type="button"
          onClick={() => setReviewFor(r)}
          className="text-[#D24830] hover:underline"
        >
          {r.reviewed ? t('common:userCenter.orders.appendReview') : t('common:userCenter.orders.addReview')}
        </button>
      )}
    </>
  );

  return (
    <>
      <UserListPage
        title={t('common:userCenter.orders.title')}
        sub={t('common:userCenter.orders.subtitle')}
        columns={columns}
        filters={filters}
        searchable
        searchPlaceholder="搜索服务名称…"
        searchField="template.name"
        fetcher={(page, pageSize, params) =>
          api.get<{ items: any[]; total: number }>('/api/user/orders', { page, pageSize, ...params })
        }
        rowActions={rowActions}
      />

      {detail && (
        <DetailModal
          tag={t('common:userCenter.orders.title')}
          title={t('common:userCenter.orders.detail')}
          onClose={() => setDetail(null)}
          fields={[
            { label: t('common:userCenter.orders.service'), value: detail?.template?.name || '—' },
            { label: t('common:userCenter.orders.provider'), value: detail?.template?.author?.nickname || '—' },
            { label: t('common:userCenter.orders.amount'), value: formatCents(detail?.amount) },
            { label: t('common:userCenter.orders.time'), value: detail?.createdAt ? new Date(detail.createdAt).toLocaleString('zh-CN', { hour12: false }) : '—' },
            { label: t('common:userCenter.orders.orderNo'), value: orderCode(detail) },
            {
              label: t('common:userCenter.orders.status'),
              value: <StatusBadge tone={serviceStatusTone(detail?.serviceStatus)}>{t(`common:userCenter.status.${detail?.serviceStatus ?? 'paid'}`)}</StatusBadge>,
            },
            ...(detail?.reviewed
              ? [
                  { label: t('common:userCenter.orders.rating'), value: <Stars rating={detail.rating} /> },
                  { label: t('common:userCenter.orders.reviewContent'), value: detail.reviewContent ?? '—' },
                ]
              : []),
          ]}
        />
      )}

      {reviewFor && (
        <ReviewEditor
          target={{ orderId: reviewFor.id, name: reviewFor.template?.name || t('common:userCenter.orders.review') }}
          initialRating={reviewFor.rating}
          initialContent={reviewFor.reviewContent}
          onClose={() => setReviewFor(null)}
          onSubmitted={() => setReviewFor(null)}
        />
      )}
    </>
  );
}
