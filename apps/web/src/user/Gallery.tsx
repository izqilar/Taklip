/**
 * 终端用户图库整页（文档 §2.2「资源中心 · 我的图库」）。
 * 数据 / 添加 / 删除 / 裁剪 / 预览逻辑全部复用 galleryParts.tsx，
 * 与编辑器内「图库选择器」弹窗（GalleryModal.tsx）保持一致。
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PageHead, Panel, EmptyState } from './shared';
import {
  useGalleryData,
  usePrivateImage,
  GalleryCard,
  PreviewModal,
  CropModal,
  tierLabel,
} from './galleryParts';

export default function Gallery() {
  const { t } = useTranslation();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [cropId, setCropId] = useState<string | null>(null);
  const { list, quota, loading, uploading, uploadPct, upload, remove, load, full } = useGalleryData();
  const { fetchUrl, revokeAll } = usePrivateImage();

  useEffect(() => {
    return () => revokeAll();
  }, [revokeAll]);

  return (
    <div className="space-y-4">
      <PageHead
        title={t('gallery.title', { defaultValue: '我的图库' })}
        sub={
          quota
            ? `${t('gallery.used', { defaultValue: '已用' })} ${quota.used} / ${quota.limit} · ${
                tierLabel(quota) || (quota.plan === 'PAID' ? '会员' : '免费')
              }`
            : t('gallery.loading', { defaultValue: '配额加载中…' })
        }
      />

      <Panel
        hint={
          full ? (
            <span className="text-[#b42318]">
              {t('gallery.fullHint', { defaultValue: `已达上限 ${quota?.limit ?? 0} 张，扩容后可继续上传` })}
            </span>
          ) : null
        }
      >
        <div className="flex items-center justify-end gap-2.5 px-4 pb-3">
          {full && (
            <Link
              to="/user/upgrade"
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

        {uploading && (
          <div className="mb-3 h-1.5 w-full max-w-xs overflow-hidden rounded bg-gray-100">
            <div className="h-full bg-[#D24830] transition-all" style={{ width: `${uploadPct}%` }} />
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-500">{t('gallery.loading', { defaultValue: '加载中…' })}</div>
        ) : list.length === 0 ? (
          <EmptyState text={t('gallery.empty', { defaultValue: '暂无图片，点击右上角上传' })} />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {list.map((a) => (
              <GalleryCard
                key={a.id}
                asset={a}
                fetchUrl={fetchUrl}
                onPreview={() => setPreviewId(a.id)}
                onDelete={() => remove(a.id)}
                onCrop={() => setCropId(a.id)}
              />
            ))}
          </div>
        )}
      </Panel>

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
  );
}
