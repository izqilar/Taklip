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
    { key: 'title', title: t('common:userCenter.messages.titleCol'), render: (r) => {
      const n = parseTierNotice(r.content);
      if (!n) {
        return <span className={`truncate ${r.read ? 'text-[#6e5f4a]' : 'font-medium text-[#2a2118]'}`}>{r.title}</span>;
      }
      const dir = tierDir(n);
      const color = TIER_DIR_COLOR[dir];
      const arrow = TIER_DIR_ARROW[dir];
      const roleLabel = t(n.role === 'provider' ? 'common:tierUi.providerTier' : 'common:tierUi.agentTier');
      return (
        <span className="inline-flex max-w-full items-center gap-1.5">
          <span
            className="inline-flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full text-[10px] font-bold"
            style={{ background: dir === 'up' ? 'rgba(29,122,107,0.14)' : dir === 'down' ? 'rgba(192,43,51,0.14)' : 'rgba(155,146,134,0.14)', color }}
          >
            {arrow}
          </span>
          <span className={`truncate ${r.read ? 'text-[#6e5f4a]' : 'font-medium text-[#2a2118]'}`}>{r.title}</span>
          <span className="flex-none text-[11px]" style={{ color }}>{roleLabel}</span>
        </span>
      );
    } },
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
      rowClassName={(r) => {
        const n = parseTierNotice(r.content);
        return n ? tierRowClass(n) : '';
      }}
      rowActions={(r) => (
        <button
          type="button"
          onClick={() => setOpenId(r.id)}
          className="text-[#D24830] hover:underline"
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

/**
 * 解析贡献等级变更通知正文：{ kind:'tier_change', role, old, new }。
 * 解析失败或非此类通知返回 null（按纯文本渲染）。
 */
function parseTierNotice(content: any): { role: 'agent' | 'provider'; old: number; new: number } | null {
  if (typeof content !== 'string') return null;
  try {
    const p = JSON.parse(content);
    if (p && p.kind === 'tier_change' && (p.role === 'agent' || p.role === 'provider')) {
      return { role: p.role, old: Number(p.old) || 0, new: Number(p.new) || 0 };
    }
  } catch {
    /* 非 JSON 正文按纯文本渲染 */
  }
  return null;
}

/** 等级变更方向：升档 up / 降档 down / 持平 flat */
function tierDir(n: { old: number; new: number }): 'up' | 'down' | 'flat' {
  return n.new > n.old ? 'up' : n.new < n.old ? 'down' : 'flat';
}
const TIER_DIR_ARROW = { up: '▲', down: '▼', flat: '→' } as const;
const TIER_DIR_COLOR = { up: '#0f5a4e', down: '#8f1d24', flat: '#6e5f4a' } as const;

/** 列表行高亮 class：左侧强调边 + 浅底色（hover 仍保留方向提示）。 */
function tierRowClass(n: { old: number; new: number }): string {
  const dir = tierDir(n);
  if (dir === 'up') return 'border-l-[3px] border-l-[#1d7a6b] bg-[rgba(29,122,107,0.07)] hover:bg-[rgba(29,122,107,0.12)]';
  if (dir === 'down') return 'border-l-[3px] border-l-[#8f1d24] bg-[rgba(192,43,51,0.07)] hover:bg-[rgba(192,43,51,0.12)]';
  return 'border-l-[3px] border-l-[#9b9286] bg-[rgba(155,146,134,0.07)] hover:bg-[rgba(155,146,134,0.12)]';
}

/**
 * 贡献等级变更通知：内容体为 JSON { kind:'tier_change', role, old, new }，
 * 解析为「旧等级 ▲/▼ 新等级」的本地化语句，升档绿 / 降档红 / 持平灰。
 */
function TierChangeNotice({ notice, t }: { notice: { role: 'agent' | 'provider'; old: number; new: number }; t: (k: string, o?: any) => string }) {
  const dir = tierDir(notice);
  const roleLabel = t(notice.role === 'provider' ? 'common:tierUi.providerTier' : 'common:tierUi.agentTier');
  const oldName = t(`common:tierNames.${notice.role}.L${Math.max(0, Math.min(4, notice.old))}`);
  const newName = t(`common:tierNames.${notice.role}.L${Math.max(0, Math.min(4, notice.new))}`);
  const arrow = TIER_DIR_ARROW[dir];
  const color = TIER_DIR_COLOR[dir];
  return (
    <div className="rounded-lg border border-[rgba(74,60,42,0.12)] bg-white p-3 text-sm">
      <div className="mb-1 text-xs text-[#6e5f4a]">{roleLabel} · {t('common:tierUi.myContrib')}</div>
      <div className="flex items-center gap-2">
        <span className="text-[#6e5f4a]">{oldName}</span>
        <span style={{ color }}>{arrow}</span>
        <span className="font-semibold" style={{ color }}>{newName}</span>
      </div>
    </div>
  );
}

function MessageDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
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
          <button type="button" onClick={onClose} className="text-gray-600 hover:text-gray-600">✕</button>
        </div>
        {loading || !m ? (
          <div className="py-8 text-center text-sm text-gray-600">{t('common:userCenter.loading')}</div>
        ) : (
          <div className="space-y-2">
            <div className="text-sm text-[#6e5f4a]">{m.code} · {msgTypeText(m.type)} · {m.createdAt ? new Date(m.createdAt).toLocaleString('zh-CN', { hour12: false }) : '—'}</div>
            {(() => {
              const notice = parseTierNotice(m.content);
              return notice ? (
                <TierChangeNotice notice={notice} t={t} />
              ) : (
                <div className="whitespace-pre-wrap rounded-lg bg-[#f3eee7] p-3 text-sm text-[#2a2118]">{m.content}</div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
