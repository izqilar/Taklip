/**
 * 通知公告（原型 u-notices，与运营端用户视角一致）：
 * 表头 编号 / 标题 / 类型 / 时间 / 状态 + 胶囊筛选（未读 / 已读 / 待补资料）
 * + 搜索 + 查看（标记已读）+ 填写资料（fillKind 时）。
 * 数据：GET /api/user/notices、POST /api/user/notices/:id/read。
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const [openId, setOpenId] = useState<string | null>(null);

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
            onClick={() => setOpenId(r.id)}
            className="text-[#c24b2e] hover:underline"
          >
            {t('common:button.detail')}
          </button>
          {r.fillKind && (
            <button
              type="button"
              onClick={() => setOpenId(r.id)}
              className="text-[#14676b] hover:underline"
            >
              {t('common:userCenter.notices.fill')}
            </button>
          )}
        </>
      )}
      emptyText={t('common:userCenter.notices.empty')}
    >
      {openId && <NoticeDetail id={openId} onClose={() => setOpenId(null)} />}
    </UserListPage>
  );
}

function NoticeDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const [n, setN] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .get<any>(`/api/user/notices/${id}`)
      .then((d) => alive && setN(d))
      .catch(() => alive && setN(null))
      .finally(() => alive && setLoading(false));
    api.post(`/api/user/notices/${id}/read`).catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded bg-[#14676b]/10 px-2 py-0.5 text-xs font-semibold text-[#14676b]">{t('common:userCenter.notices.title')}</span>
            <h3 className="text-[14.5px] font-semibold text-[#2a2118]">{n?.title ?? ''}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-gray-600 hover:text-gray-600">✕</button>
        </div>
        {loading || !n ? (
          <div className="py-8 text-center text-sm text-gray-600">{t('common:userCenter.loading')}</div>
        ) : (
          <div className="space-y-2">
            <div className="text-sm text-[#6e5f4a]">{n.code} · {n.type} · {n.createdAt ? new Date(n.createdAt).toLocaleString('zh-CN', { hour12: false }) : '—'}</div>
            {n.fillKind && (
              <div className="rounded-lg bg-[#14676b]/10 p-2 text-xs text-[#14676b]">{t('common:userCenter.notices.fill')}：{n.fillKind}</div>
            )}
            <div className="whitespace-pre-wrap rounded-lg bg-[#f3eee7] p-3 text-sm text-[#2a2118]">{n.content}</div>
          </div>
        )}
      </div>
    </div>
  );
}
