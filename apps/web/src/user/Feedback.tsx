/**
 * 我的反馈（原型 u-complaints，与运营端用户视角一致）：
 * 表头 编号 / 主题 / 类型 / 对象 / 时间 / 状态 + 胶囊筛选（待回复 / 已回复）
 * + 搜索 + ＋ 新增反馈；详情弹窗含回复记录。
 * 数据：GET /api/user/complaints、POST /api/user/complaints、GET /api/user/complaints/:id。
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import {
  StatusBadge,
  UserListPage,
  type Column,
  type ChipFilterDef,
} from './shared';

/** 反馈状态 → 双角色徽章（镜像运营端 TICKET_STATUS 色语义） */
const ticketTone = (status?: string): 'warn' | 'accent' | 'bad' | 'ok' => {
  if (status === 'CLOSED') return 'ok';
  if (status === 'ESCALATED' || status === 'ARBITRATING') return 'bad';
  if (status === 'NEGOTIATING') return 'accent';
  return 'warn';
};

const TYPES = ['CONSULT', 'SUGGESTION', 'COMPLAINT', 'PRAISE', 'APPEAL', 'AFTERSALE', 'OTHER'];

export default function Feedback() {
  const { t } = useTranslation();
  const [showNew, setShowNew] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const columns: Column<any>[] = [
    { key: 'code', title: t('common:userCenter.feedback.code'), render: (r) => <span className="font-mono text-[#4c4236]">{r.code}</span> },
    { key: 'title', title: t('common:userCenter.feedback.subject'), render: (r) => <span className="font-medium text-[#2a2118]">{r.title}</span> },
    { key: 'type', title: t('common:userCenter.feedback.type'), render: (r) => <span className="text-[#4c4236]">{t(`common:userCenter.ticketType.${r.type}`)}</span> },
    { key: 'target', title: t('common:userCenter.feedback.target'), render: (r) => <span className="text-[#6e5f4a]">{r.target?.nickname || '平台'}</span> },
    { key: 'time', title: t('common:userCenter.feedback.time'), render: (r) => <span className="text-xs text-[#6e5f4a]">{r.createdAt ? new Date(r.createdAt).toLocaleString('zh-CN', { hour12: false }) : '—'}</span> },
    { key: 'status', title: t('common:userCenter.feedback.status'), render: (r) => <StatusBadge tone={ticketTone(r.status)}>{t(`common:userCenter.status.${r.status}`)}</StatusBadge> },
  ];

  const filters: ChipFilterDef[] = [
    { label: t('common:userCenter.filters.all'), value: 'all' },
    { label: t('common:userCenter.status.OPEN'), value: 'OPEN', field: 'status' },
    { label: t('common:userCenter.status.CLOSED'), value: 'CLOSED', field: 'status' },
  ];

  return (
    <UserListPage
      title={t('common:userCenter.feedback.title')}
      sub={t('common:userCenter.feedback.subtitle')}
      columns={columns}
      fetcher={(page, pageSize, params) =>
        api.get<{ items: any[]; total: number }>('/api/user/complaints', { page, pageSize, ...params })
      }

      filters={filters}
      searchable
      searchField="title"
      searchPlaceholder={t('common:userCenter.search.feedback')}
      createLabel={`＋ ${t('common:userCenter.feedback.new')}`}
      onCreate={() => setShowNew(true)}
      rowActions={(r) => (
        <button
          type="button"
          onClick={() => setDetailId(r.id)}
          className="text-[#c24b2e] hover:underline"
        >
          {t('common:button.detail')}
        </button>
      )}
      emptyText={t('common:userCenter.empty')}
    >
      {showNew && <NewFeedbackModal onClose={() => setShowNew(false)} onSubmitted={() => setShowNew(false)} />}
      {detailId && <FeedbackDetail id={detailId} onClose={() => setDetailId(null)} />}
    </UserListPage>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-20 shrink-0 text-[#6e5f4a]">{label}</span>
      <span className="min-w-0 flex-1 text-[#2a2118]">{value || '—'}</span>
    </div>
  );
}

function NewFeedbackModal({ onClose, onSubmitted }: { onClose: () => void; onSubmitted: () => void }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [type, setType] = useState('CONSULT');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    if (!title.trim()) { setErr(t('common:userCenter.feedback.titlePlaceholder')); return; }
    if (!content.trim()) { setErr(t('common:userCenter.feedback.contentPlaceholder')); return; }
    setSaving(true);
    try {
      await api.post('/api/user/complaints', { title, type, content });
      onSubmitted();
    } catch (e: any) {
      setErr(e?.message || 'failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-[14.5px] font-semibold text-[#2a2118]">{t('common:userCenter.feedback.newTitle')}</h3>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('common:userCenter.feedback.titlePlaceholder')}
          className="mb-3 w-full rounded-lg border border-[rgba(74,60,42,0.16)] p-2.5 text-sm outline-none focus:border-[#c24b2e]"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="mb-3 w-full rounded-lg border border-[rgba(74,60,42,0.16)] p-2.5 text-sm outline-none focus:border-[#c24b2e]"
        >
          {TYPES.map((tp) => (
            <option key={tp} value={tp}>{t(`common:userCenter.ticketType.${tp}`)}</option>
          ))}
        </select>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          placeholder={t('common:userCenter.feedback.contentPlaceholder')}
          className="w-full rounded-lg border border-[rgba(74,60,42,0.16)] p-3 text-sm outline-none focus:border-[#c24b2e]"
        />
        {err && <p className="mt-1 text-xs text-red-500">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600">{t('common:button.cancel')}</button>
          <button type="button" disabled={saving} onClick={submit} className="rounded-lg bg-[#c24b2e] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {saving ? t('common:userCenter.loading') : t('common:userCenter.feedback.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}

function FeedbackDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .get<any>(`/api/user/complaints/${id}`)
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded bg-[#14676b]/10 px-2 py-0.5 text-xs font-semibold text-[#14676b]">{t('common:userCenter.feedback.detail')}</span>
            <h3 className="text-[14.5px] font-semibold text-[#2a2118]">{data?.title ?? ''}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        {loading || !data ? (
          <div className="py-8 text-center text-sm text-gray-400">{t('common:userCenter.loading')}</div>
        ) : (
          <div className="space-y-2">
            <Field label={t('common:userCenter.feedback.code')} value={data.code} />
            <Field label={t('common:userCenter.feedback.type')} value={t(`common:userCenter.ticketType.${data.type}`)} />
            <Field label={t('common:userCenter.feedback.target')} value={data.target?.nickname || '平台'} />
            <Field label={t('common:userCenter.feedback.status')} value={t(`common:userCenter.status.${data.status}`)} />
            <Field label={t('common:userCenter.feedback.time')} value={data.createdAt ? new Date(data.createdAt).toLocaleString('zh-CN', { hour12: false }) : '—'} />
            <div className="rounded-lg bg-[#f3eee7] p-3 text-sm text-[#2a2118]">{data.content}</div>
            {Array.isArray(data.replies) && data.replies.length > 0 && (
              <div className="mt-3">
                <div className="mb-1 text-xs font-medium text-[#6e5f4a]">{t('common:userCenter.feedback.replies')}</div>
                {data.replies.map((rp: any, i: number) => (
                  <div key={i} className="mb-1 rounded-lg bg-[#fffefb] p-2 text-sm text-[#2a2118] ring-1 ring-[rgba(74,60,42,0.10)]">
                    <span className="text-xs text-[#6e5f4a]">{rp.author?.nickname || '平台'} · </span>
                    {rp.content}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
