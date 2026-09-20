/**
 * 作品只读详情弹窗（web 端）
 *
 * 用途：web 端作品卡片 hover 的「详情」按钮打开此弹窗。
 * 设计约束（来自需求）：详情在 web 端为**完全只读**展示；若需编辑，必须前往运营端（管理后台）。
 * 因此本弹窗不提供任何编辑入口，仅提供「前往运营端编辑」的跳转按钮。
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SchemaThumbnail } from '@/components/SchemaThumbnail';
import { buildShareUrl, generateQrDataUrl } from '@/utils/share';

export type WorkDetailItem = {
  id: string;
  title: string;
  cover: string | null;
  status: 'draft' | 'published';
  updatedAt: string;
  publishCode?: string | null;
  schema: unknown;
  viewCount: number;
};

export function WorkDetailModal({
  item,
  onClose,
  onEdit,
  editIsExternal,
}: {
  item: WorkDetailItem;
  onClose: () => void;
  /** 点击「编辑」回调（父级按角色分流：普通用户进 web 编辑器，服务商跳运营端） */
  onEdit?: (item: WorkDetailItem) => void;
  /** true：编辑动作会跳转到运营端编辑器；false：在 web 端编辑器内编辑 */
  editIsExternal?: boolean;
}) {
  const { t } = useTranslation(['common', 'errors']);
  const [qr, setQr] = useState<string | null>(null);

  const isPublished = item.status === 'published' && !!item.publishCode;
  const shareUrl = isPublished ? buildShareUrl(item.publishCode as string) : '';

  useEffect(() => {
    let alive = true;
    if (isPublished) {
      generateQrDataUrl(shareUrl)
        .then((url) => {
          if (alive) setQr(url);
        })
        .catch(() => {});
    } else {
      setQr(null);
    }
    return () => {
      alive = false;
    };
  }, [isPublished, shareUrl]);

  // 点击遮罩 / ESC 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const statusLabel =
    item.status === 'published'
      ? t('common:status.publishedBadge')
      : t('common:status.draftBadge');

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <div className="min-w-0">
            <div className="truncate text-[14.5px] font-semibold text-gray-900">
              {item.title || t('common:status.untitled')}
            </div>
            <div className="mt-0.5 text-xs text-gray-600">{t('common:badge.work')}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-gray-600 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label={t('common:button.close')}
          >
            ✕
          </button>
        </div>

        {/* 内容（只读） */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* 预览：relative 必须保留 —— SchemaThumbnail 根节点是 absolute inset-0，
              缺少定位父级时会向上逃逸到弹窗根(fixed inset-0)铺满整个视口，盖住弹窗本体 */}
          <div className="relative mx-auto mb-4 flex aspect-[375/667] w-40 items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-gray-50 shadow-inner">
            {item.cover ? (
              <img src={item.cover} alt={item.title} className="h-full w-full object-cover" />
            ) : (
              <SchemaThumbnail schema={item.schema} />
            )}
          </div>

          {/* 只读属性表 */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-gray-600">{t('common:detail.id')}</dt>
              <dd className="mt-0.5 break-all font-mono text-xs text-gray-700">{item.id}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-600">{t('common:detail.status')}</dt>
              <dd className="mt-0.5">
                <span
                  className={`rounded px-1.5 py-0.5 text-xs ${
                    item.status === 'published'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {statusLabel}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-600">{t('common:detail.views')}</dt>
              <dd className="mt-0.5 text-gray-700">👁 {item.viewCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-600">{t('common:detail.updatedAt')}</dt>
              <dd className="mt-0.5 text-gray-700">{new Date(item.updatedAt).toLocaleString()}</dd>
            </div>
          </dl>

          {/* 已发布：展示发布页链接 + 二维码（只读） */}
          {isPublished && (
            <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="text-xs font-medium text-gray-600">{t('common:published.qrTitle')}</div>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex h-24 w-24 items-center justify-center rounded bg-white p-1">
                  {qr ? (
                    <img src={qr} alt="QR" className="h-full w-full" />
                  ) : (
                    <span className="text-xs text-gray-300">...</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <a
                    href={shareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block break-all text-xs text-brand-600 underline"
                  >
                    {shareUrl}
                  </a>
                  <div className="mt-1 text-[11px] text-gray-600">
                    {t('common:published.viewHint')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 只读提示：预览本身只读；普通用户可点「编辑」进入 web 端编辑器直接改 */}
          <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {editIsExternal
              ? t('common:detail.readonlyHint')
              : t('common:detail.readonlyHintWebEdit', {
                  defaultValue: '此页为只读预览，点击「编辑」可在 web 端编辑器内直接修改。',
                })}
          </div>
        </div>

        {/* 底部：编辑（按角色分流——普通用户进 web 编辑器，服务商跳运营端） */}
        <div className="flex gap-2 border-t border-gray-100 px-5 py-3">
          <button
            type="button"
            onClick={() => onEdit?.(item)}
            className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            {editIsExternal ? t('common:detail.editInAdmin') : t('common:button.edit')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
          >
            {t('common:button.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
