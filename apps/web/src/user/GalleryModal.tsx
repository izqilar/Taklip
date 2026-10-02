/**
 * 编辑器内「图库选择器」弹窗。
 *
 * 复用 galleryParts.tsx 的全部能力（网格浏览 / 上传 / 预览 / 裁剪 / 删除 / 配额 + 扩容入口），
 * 并在此之上提供「选择」语义：点击图片缩略图即选中并关闭弹窗，把选中资产交还给编辑器内核。
 *
 * 挂载点：apps/web/src/pages/Editor.tsx（编辑器路由内）。
 * 通过 registerGalleryPicker 把自己注册到 galleryPicker 桥，供内核 openGalleryPicker() 调用。
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EmptyState } from './shared';
import {
  useGalleryData,
  usePrivateImage,
  GalleryCard,
  PreviewModal,
  CropModal,
  tierLabel,
} from './galleryParts';
import { registerGalleryPicker, PickedGalleryAsset } from './galleryPicker';

export default function GalleryModal() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<((a: PickedGalleryAsset | null) => void) | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [cropId, setCropId] = useState<string | null>(null);

  const { list, quota, loading, uploading, uploadPct, upload, remove, load, full } = useGalleryData();
  const { fetchUrl, revokeAll } = usePrivateImage();

  useEffect(() => {
    registerGalleryPicker((resolve) => {
      setPending(() => resolve);
      setOpen(true);
    });
    return () => {
      registerGalleryPicker(null);
      revokeAll();
    };
  }, [revokeAll]);

  const close = useCallback(
    (result: PickedGalleryAsset | null) => {
      setOpen(false);
      setPreviewId(null);
      setCropId(null);
      const r = pending;
      setPending(null);
      r?.(result);
    },
    [pending],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(30,24,16,0.6)] p-4"
      onClick={() => close(null)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-[14px] bg-[#fffefb] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h3 className="text-[15px] font-semibold text-[#2a2118]">
            {t('gallery.pickerTitle', { defaultValue: '选择图片' })}
          </h3>
          <button type="button" onClick={() => close(null)} className="text-[#6e5f4a] hover:text-[#4c4236]">
            ✕
          </button>
        </div>

        {/* 配额 + 上传 / 扩容 */}
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-2">
          <span className="text-xs text-gray-400">
            {quota
              ? `${t('gallery.used', { defaultValue: '已用' })} ${quota.used} / ${quota.limit} · ${
                  tierLabel(quota) || (quota.plan === 'PAID' ? '会员' : '免费')
                }`
              : ''}
            {full ? ` · ${t('gallery.fullHint', { defaultValue: '已达上限' })}` : ''}
          </span>
          <div className="flex items-center gap-2.5">
            {full && (
              <Link
                to="/user/upgrade"
                onClick={(e) => e.stopPropagation()}
                className="rounded-lg bg-[#D24830] px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-[#B23A22]"
              >
                {t('gallery.upgrade', { defaultValue: '去扩容' })}
              </Link>
            )}
            <label
              className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-1.5 text-[13px] font-medium text-white transition ${
                full || uploading ? 'cursor-not-allowed bg-gray-300' : 'bg-[#D24830] hover:bg-[#B23A22]'
              }`}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              {t('gallery.upload', { defaultValue: '上传图片' })}
              <input
                type="file"
                accept="image/*"
                disabled={full || uploading}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>

        {uploading && (
          <div className="h-1.5 w-full overflow-hidden rounded bg-gray-100">
            <div className="h-full bg-[#D24830] transition-all" style={{ width: `${uploadPct}%` }} />
          </div>
        )}

        {/* 图片网格 */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-500">
              {t('gallery.loading', { defaultValue: '加载中…' })}
            </div>
          ) : list.length === 0 ? (
            <EmptyState text={t('gallery.empty', { defaultValue: '暂无图片，点击右上角上传' })} />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {list.map((a) => (
                <GalleryCard
                  key={a.id}
                  asset={a}
                  fetchUrl={fetchUrl}
                  onSelect={() => close({ id: a.id, width: a.width, height: a.height })}
                  onPreview={() => setPreviewId(a.id)}
                  onDelete={() => remove(a.id)}
                  onCrop={() => setCropId(a.id)}
                />
              ))}
            </div>
          )}
        </div>

        <PreviewModal id={previewId} fetchUrl={fetchUrl} onClose={() => setPreviewId(null)} />
        <CropModal
          id={cropId}
          fetchUrl={fetchUrl}
          onClose={() => setCropId(null)}
          onDone={() => {
            setCropId(null);
            load();
          }}
        />
      </div>
    </div>
  );
}
