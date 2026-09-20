/**
 * 我的评价（原型 u-feedback / reviews，严格对齐运营端）：
 * 表格（订单编号 / 服务 / 评分 / 评价内容 / 时间 / 状态）+ 胶囊筛选（全部 / 已发布）+ 详情。
 * 数据：GET /api/user/reviews。
 */
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { Stars, StatusBadge, UserListPage, type Column, type ChipFilterDef, type DetailFieldDef } from './shared';

const orderCode = (r: any) => (r && r.orderNo ? `QD…${String(r.orderNo).slice(-4)}` : r?.orderId || '—');

export default function Reviews() {
  const { t } = useTranslation();

  const columns: Column<any>[] = [
    { key: 'orderNo', title: t('common:userCenter.reviews.orderNo'), render: (r) => <span className="font-mono tabular-nums text-[#2a2118]">{orderCode(r)}</span> },
    { key: 'service', title: t('common:userCenter.reviews.service'), render: (r) => r.serviceName || '—' },
    { key: 'rating', title: t('common:userCenter.reviews.rating'), align: 'right', render: (r) => <Stars rating={r.rating} /> },
    { key: 'content', title: t('common:userCenter.reviews.content'), render: (r) => <span className="text-[#4c4236]">{r.content || '—'}</span> },
    { key: 'time', title: t('common:userCenter.reviews.time'), render: (r) => <span className="text-xs text-[#6e5f4a]">{r.createdAt ? new Date(r.createdAt).toLocaleString('zh-CN', { hour12: false }) : '—'}</span> },
    { key: 'status', title: t('common:userCenter.reviews.status'), render: (r) => <StatusBadge tone="ok">{r.status || '已发布'}</StatusBadge> },
  ];

  const filters: ChipFilterDef[] = [
    { label: t('common:userCenter.filters.all'), value: 'all' },
    { label: t('common:userCenter.filters.published'), value: 'published', test: (r) => (r.status ?? '已发布') === '已发布' },
  ];

  const detailFields: DetailFieldDef[] = [
    { label: t('common:userCenter.reviews.orderNo'), key: 'orderNo', format: 'text' },
    { label: t('common:userCenter.reviews.service'), key: 'serviceName' },
    { label: t('common:userCenter.reviews.rating'), key: 'rating', format: 'stars' },
    { label: t('common:userCenter.reviews.content'), key: 'content' },
    { label: t('common:userCenter.reviews.time'), key: 'createdAt', format: 'date' },
  ];

  return (
    <UserListPage
      title={t('common:userCenter.reviews.title')}
      sub={t('common:userCenter.reviews.subtitle')}
      columns={columns}
      filters={filters}
      fetcher={(page, pageSize, params) =>
        api.get<{ items: any[]; total: number }>('/api/user/reviews', { page, pageSize, ...params })
      }
      detailFields={detailFields}
      emptyText={t('common:userCenter.empty')}
    />
  );
}
