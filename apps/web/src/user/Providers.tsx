/**
 * 我的服务商（原型 u-providers，与运营端用户视角一致）：
 * 表头 编号 / 服务商 / 服务类型 / 评分 / 关注时间 / 状态
 * + 搜索 + 详情 + 评价 / 追评（POST /api/user/reviews）。
 * 数据：GET /api/user/providers。
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import {
  Stars,
  StatusBadge,
  UserListPage,
  ReviewEditor,
  serviceRolesText,
  type Column,
  type ChipFilterDef,
  type DetailFieldDef,
} from './shared';

export default function Providers() {
  const { t } = useTranslation();
  const [evalTarget, setEvalTarget] = useState<{ providerId?: string; name?: string; rating?: number | null; content?: string | null } | null>(null);

  const columns: Column<any>[] = [
    { key: 'code', title: t('common:userCenter.providers.code'), render: (r) => <span className="font-mono text-[#4c4236]">{r.code}</span> },
    { key: 'name', title: t('common:userCenter.providers.name'), render: (r) => <span className="font-medium text-[#2a2118]">{r.nickname || r.realName || r.phone || '—'}</span> },
    { key: 'type', title: t('common:userCenter.providers.type'), render: (r) => <span className="text-[#6e5f4a]">{serviceRolesText(r.serviceRoles)}</span> },
    { key: 'rating', title: t('common:userCenter.providers.rating'), align: 'right', render: (r) => <Stars rating={r.rating} /> },
    { key: 'followedAt', title: t('common:userCenter.providers.followedAt'), render: (r) => <span className="text-xs text-[#6e5f4a]">{r.followedAt ? new Date(r.followedAt).toLocaleDateString('zh-CN') : '—'}</span> },
    { key: 'status', title: t('common:userCenter.feedback.status'), render: () => <StatusBadge tone="ok">{t('common:userCenter.providers.following')}</StatusBadge> },
  ];

  const filters: ChipFilterDef[] = [
    { label: t('common:userCenter.filters.all'), value: 'all' },
    { label: t('common:userCenter.providers.following'), value: 'following', test: () => true },
  ];

  const detailFields: DetailFieldDef[] = [
    { label: t('common:userCenter.providers.code'), key: 'code' },
    { label: t('common:userCenter.providers.name'), key: 'nickname' },
    { label: t('common:userCenter.providers.type'), key: 'serviceRoles', format: 'roles' },
    { label: t('common:userCenter.providers.rating'), key: 'rating', format: 'stars' },
    { label: t('common:userCenter.providers.followedAt'), key: 'followedAt', format: 'date' },
  ];

  return (
    <UserListPage
      title={t('common:userCenter.providers.title')}
      sub={t('common:userCenter.providers.subtitle')}
      columns={columns}
      fetcher={(page, pageSize, params) =>
        api.get<{ items: any[]; total: number }>('/api/user/providers', { page, pageSize, ...params })
      }

      filters={filters}
      searchable
      searchField="nickname"
      searchPlaceholder={t('common:userCenter.search.providers')}
      detailFields={detailFields}
      rowActions={(r) => (
        <button
          type="button"
          onClick={() =>
            setEvalTarget({
              providerId: r.id,
              name: `${r.code ?? '—'} · ${r.nickname ?? '—'}`,
              rating: r.rating ?? null,
              content: r.reviewContent ?? null,
            })
          }
          className="text-[#c24b2e] hover:underline"
        >
          {r.reviewed ? t('common:userCenter.orders.appendReview') : t('common:userCenter.orders.addReview')}
        </button>
      )}
      emptyText={t('common:userCenter.empty')}
    >
      {evalTarget && (
        <ReviewEditor
          target={{ providerId: evalTarget.providerId, name: evalTarget.name }}
          initialRating={evalTarget.rating}
          initialContent={evalTarget.content}
          onClose={() => setEvalTarget(null)}
          onSubmitted={() => setEvalTarget(null)}
        />
      )}
    </UserListPage>
  );
}
