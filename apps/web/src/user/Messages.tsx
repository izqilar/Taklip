/**
 * 业务消息（原型 u-messages，与运营端用户视角一致）：
 * 表头 编号 / 标题 / 类型 / 时间 / 状态 + 胶囊筛选（待处理 / 已处理）
 * + 搜索 + 查看（打开详情同时标记已读）。
 * 数据：GET /api/user/messages、POST /api/user/messages/:id/read。
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import {
  StatusBadge,
  UserListPage,
  msgTypeText,
  type Column,
  type ChipFilterDef,
} from './shared';

export default function Messages() {
  const { t } = useTranslation();
  const [openId, setOpenId] = useState<string | null>(null);

  const columns: Column<any>[] = [
    { key: 'code', title: t('common:userCenter.messages.code'), render: (r) => <span className="font-mono text-[#4c4236]">{r.code}</span> },
    { key: 'title', title: t('common:userCenter.messages.titleCol'), render: (r) => <span className={`truncate ${r.read ? 'text-[#6e5f4a]' : 'font-medium text-[#2a2118]'}`}>{r.title}</span> },
    { key: 'type', title: t('common:userCenter.notices.type'), render: (r) => <span className="text-[#6e5f4a]">{msgTypeText(r.type)}</span> },
    { key: 'time', title: t('common:userCenter.messages.time'), render: (r) => <span className="text-xs text-[#6e5f4a]">{r.createdAt ? new Date(r.createdAt).toLocaleString('zh-CN', { hour12: false }) : '—'}</span> },
    { key: 'status', title: t('common:userCenter.messages.status'), render: (r) => <StatusBadge tone={r.read ? 'mut' : 'warn'}>{r.read ? t('common:userCenter.status.read') : t('common:userCenter.status.unread')}</StatusBadge> },
  ];

  const filters: ChipFilterDef[] = [
    { label: t('common:userCenter.filters.all'), value: 'all' },
    { label: t('common:userCenter.filters.todo'), value: 'todo', test: (r) => !r.read },
    { label: t('common:userCenter.filters.done'), value: 'done', test: (r) => !!r.read },
  ];

  return (
    <UserListPage
      title={t('common:userCenter.messages.title')}
      sub={t('common:userCenter.messages.subtitle')}
      columns={columns}
      fetcher={(page, pageSize, params) =>
        api.get<{ items: any[]; total: number }>('/api/user/messages', { page, pageSize, ...params })
      }

      filters={filters}
      searchable
      searchField="title"
      searchPlaceholder={t('common:userCenter.search.messages')}
      rowActions={(r) => (
        <button
          type="button"
          onClick={() => setOpenId(r.id)}
          className="text-[#c24b2e] hover:underline"
        >
          {t('common:button.detail')}
        </button>
      )}
      emptyText={t('common:userCenter.messages.empty')}
    >
      {openId && <MessageDetail id={openId} onClose={() => setOpenId(null)} />}
    </UserListPage>
  );
}

function MessageDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [m, setM] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .get<any>(`/api/user/messages/${id}`)
      .then((d) => alive && setM(d))
      .catch(() => alive && setM(null))
      .finally(() => alive && setLoading(false));
    // 标记已读
    api.post(`/api/user/messages/${id}/read`).catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded bg-[#14676b]/10 px-2 py-0.5 text-xs font-semibold text-[#14676b]">{t('common:userCenter.messages.title')}</span>
            <h3 className="text-[14.5px] font-semibold text-[#2a2118]">{m?.title ?? ''}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        {loading || !m ? (
          <div className="py-8 text-center text-sm text-gray-400">{t('common:userCenter.loading')}</div>
        ) : (
          <div className="space-y-2">
            <div className="text-sm text-[#6e5f4a]">{m.code} · {msgTypeText(m.type)} · {m.createdAt ? new Date(m.createdAt).toLocaleString('zh-CN', { hour12: false }) : '—'}</div>
            <div className="whitespace-pre-wrap rounded-lg bg-[#f3eee7] p-3 text-sm text-[#2a2118]">{m.content}</div>
          </div>
        )}
      </div>
    </div>
  );
}
