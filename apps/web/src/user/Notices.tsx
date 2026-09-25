/**
 * 通知公告（原型 u-notices，与运营端用户视角一致）：
 * 表头 编号 / 标题 / 类型 / 时间 / 状态 + 胶囊筛选（未读 / 已读 / 待补资料）
 * + 搜索 + 查看（标记已读）+ 填写资料（fillKind 时）。
 * 数据：GET /api/user/notices、POST /api/user/notices/:id/read。
 *
 * 详情 / 填写资料不再用弹窗（旧弹窗依赖并不存在的 GET /api/user/notices/:id 接口，
 * 永远停在「加载中」），改为整页路由：
 *  - 「查看」→ /user/notices/:id（NoticeDetailPage，携带 state 即时渲染）
 *  - 「填写资料」→ /user/notices/fill?kind=&id=（NoticeFillPage）
 */
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import {
  StatusBadge,
  UserListPage,
  type Column,
  type ChipFilterDef,
} from './shared';

const noticeTone = (status?: string): 'warn' | 'accent' | 'ok' => {
  if (status === '未读') return 'warn';
  if (status === '初审通过') return 'accent';
  return 'ok';
};

export default function Notices() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const columns: Column<any>[] = [
    { key: 'code', title: t('common:userCenter.notices.code'), render: (r) => <span className="font-mono text-[#4c4236]">{r.code}</span> },
    { key: 'title', title: t('common:userCenter.notices.titleCol'), render: (r) => <span className={`truncate ${r.status === '未读' ? 'font-medium text-[#2a2118]' : 'text-[#6e5f4a]'}`}>{r.title}</span> },
    { key: 'type', title: t('common:userCenter.notices.type'), render: (r) => <span className="text-[#6e5f4a]">{r.type || '—'}</span> },
    { key: 'time', title: t('common:userCenter.notices.time'), render: (r) => <span className="text-xs text-[#6e5f4a]">{r.createdAt ? new Date(r.createdAt).toLocaleString('zh-CN', { hour12: false }) : '—'}</span> },
    { key: 'status', title: t('common:userCenter.notices.status'), render: (r) => <StatusBadge tone={noticeTone(r.status)}>{r.status}</StatusBadge> },
  ];

  const filters: ChipFilterDef[] = [
    { label: t('common:userCenter.filters.all'), value: 'all' },
    { label: t('common:userCenter.status.unread'), value: 'unread', test: (r) => r.status === '未读' },
    { label: t('common:userCenter.status.read'), value: 'read', test: (r) => r.status === '已读' },
    { label: t('common:userCenter.filters.fillNeeded'), value: 'fill', test: (r) => r.status === '初审通过' },
  ];

  return (
    <UserListPage
      title={t('common:userCenter.notices.title')}
      sub={t('common:userCenter.notices.subtitle')}
      columns={columns}
      fetcher={(page, pageSize, params) =>
        api.get<{ items: any[]; total: number }>('/api/user/notices', { page, pageSize, ...params })
      }
      filters={filters}
      searchable
      searchField="title"
      searchPlaceholder={t('common:userCenter.search.notices')}
      rowActions={(r) => (
        <>
          <button
            type="button"
            onClick={() => navigate(`/user/notices/${r.id}`, { state: { notice: r } })}
            className="text-[#D24830] hover:underline"
          >
            {t('common:button.detail')}
          </button>
          {r.fillKind && (
            <button
              type="button"
              onClick={() =>
                navigate(`/user/notices/fill?kind=${encodeURIComponent(r.fillKind)}&id=${encodeURIComponent(r.id)}`)
              }
              className="text-[#14676b] hover:underline"
            >
              {t('common:userCenter.notices.fill')}
            </button>
          )}
        </>
      )}
      emptyText={t('common:userCenter.notices.empty')}
    />
  );
}
