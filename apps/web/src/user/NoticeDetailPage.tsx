/**
 * 通知公告详情页（路由 /user/notices/:id）
 *
 * 取代旧版自绘弹窗（原弹窗调用并不存在的 GET /api/user/notices/:id 后端接口，
 * 永远停在「加载中」——即用户反馈的空弹窗）。本页改为整页路由：
 *  - 优先读取导航 state 中携带的公告对象（列表跳转即时渲染，无需二次请求）；
 *  - 缺失时（直接深链 / 刷新）回退到列表接口本地按 id 查找；
 *  - 公告类（kind=message）调用 POST /api/user/notices/:id/read 标记已读；
 *  - 资格通知（kind=qualification，含 fillKind）提供「填写资料」入口 → /user/notices/fill。
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import { PageHead, StatusBadge } from './shared';

const noticeTone = (status?: string): 'warn' | 'accent' | 'ok' => {
  if (status === '未读') return 'warn';
  if (status === '初审通过') return 'accent';
  return 'ok';
};

type NoticeItem = {
  id: string;
  kind: 'message' | 'qualification';
  title: string;
  type?: string;
  content?: string;
  createdAt?: string;
  status?: string;
  fillKind?: string;
  code?: string;
  /** 资格通知携带的底层申请 id（与列表 id 同源），详情页透传给填写资料页 */
  qualId?: string;
};

export default function NoticeDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [n, setN] = useState<NoticeItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const fromState = (location.state as any)?.notice as NoticeItem | undefined;

    const markRead = (item?: NoticeItem) => {
      // 仅公告类需要回执；资格通知无关联 message，标记会落脏数据（且可能触外键约束）
      if (id && (item?.kind ?? fromState?.kind) === 'message') {
        api.post(`/api/user/notices/${id}/read`).catch(() => {});
      }
    };

    if (fromState && fromState.id === id) {
      setN(fromState);
      setLoading(false);
      markRead(fromState);
      return () => {
        alive = false;
      };
    }

    setLoading(true);
    api
      .get<{ items: NoticeItem[]; total: number }>('/api/user/notices', { page: 1, pageSize: 200 })
      .then((d) => {
        if (!alive) return;
        const found = (d?.items ?? []).find((x) => x.id === id) ?? null;
        setN(found);
        setLoading(false);
        markRead(found ?? undefined);
      })
      .catch(() => {
        if (!alive) return;
        setN(null);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
    // 仅依赖 id 与导航 state（state 在路由生命周期内稳定）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, location.state]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/user/notices')}
          className="rounded-lg border border-[rgba(74,60,42,0.16)] px-3 py-1.5 text-[13px] text-[#4c4236] transition hover:border-[#D24830]/40 hover:text-[#D24830]"
        >
          ← {t('common:userCenter.notices.back', { defaultValue: '返回通知公告' })}
        </button>
      </div>

      <PageHead
        title={t('common:userCenter.notices.detailTitle', { defaultValue: '通知详情' })}
        sub={t('common:userCenter.notices.subtitle')}
      />

      <div className="rounded-[12px] border border-[rgba(74,60,42,0.10)] bg-[#faf7f1] p-4">
        {loading ? (
          <div className="py-10 text-center text-[13px] text-[#6e5f4a]">{t('common:userCenter.loading')}</div>
        ) : !n ? (
          <div className="py-10 text-center text-[13px] text-[#6e5f4a]">
            {t('common:userCenter.notices.empty', { defaultValue: '未找到该通知' })}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {n.code && <span className="font-mono text-[12.5px] text-[#4c4236]">{n.code}</span>}
              <StatusBadge tone={noticeTone(n.status)}>{n.status}</StatusBadge>
              {n.type && <span className="text-[13px] text-[#6e5f4a]">{n.type}</span>}
              {n.createdAt && (
                <span className="text-xs text-[#6e5f4a]">
                  {new Date(n.createdAt).toLocaleString('zh-CN', { hour12: false })}
                </span>
              )}
            </div>
            <h3 className="text-[16px] font-semibold text-[#2a2118]">{n.title}</h3>
            <div className="whitespace-pre-wrap rounded-lg bg-[#f3eee7] p-3 text-[13.5px] leading-relaxed text-[#2a2118]">
              {n.content}
            </div>
            {n.fillKind && (
              <div className="rounded-[10px] border border-[#14676b]/30 bg-[rgba(20,103,107,0.06)] p-3">
                <p className="mb-2 text-[13px] text-[#14676b]">
                  {t('common:userCenter.notices.fillHint', {
                    defaultValue: '初审已通过，请补充完整资料后进入管理总台终审。',
                  })}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/user/notices/fill?kind=${encodeURIComponent(n.fillKind!)}&id=${encodeURIComponent(n.id)}`,
                    )
                  }
                  className="rounded-lg bg-[#14676b] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0f4f53]"
                >
                  {t('common:userCenter.notices.fill', { defaultValue: '填写资料' })}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
