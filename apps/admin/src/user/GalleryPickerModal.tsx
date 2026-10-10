/**
 * 编辑器内「图库选择器」弹窗（运营端）。
 *
 * 复用 galleryShared 的全部能力（网格浏览 / 上传 / 预览 / 裁剪 / 删除 / 配额 + 扩容入口），
 * 并在此之上提供「选择」语义：点击图片缩略图即选中并关闭弹窗，把选中资产交还给编辑器内核。
 *
 * 挂载点：运营端编辑器宿主页（SPWorkEditor / SPTemplateEditor），挂载即注册到 galleryPicker 桥，
 * 供内核 services.openAssetPicker() 调用。挂载后内核不再回退到原生文件上传，
 * 从而让「免费用户最多 6 张」等配额限制对编辑器内插入图片同样生效。
 *
 * 选中回传：图库原图是私有资产，编辑器渲染依赖公开 URL，故选中后把私有图转存为公开 media 副本
 * （不占图库配额，与 web 端一致），并把公开 url 一并返回。
 */
import { useCallback, useEffect, useState } from 'react';
import { message } from 'antd';
import { t } from '../i18n/t';
import { API_URL, authHeaders } from '../utility';
import {
  GalleryCard,
  PreviewModal,
  CropModal,
  useGalleryData,
  useInspectSubject,
  withSubject,
  tierLabel,
} from '../gallery/galleryShared';
import type { GalleryLayer } from '../gallery/galleryShared';
import { registerGalleryPicker, type PickedGalleryAsset } from './galleryPicker';

/** 会话内缓存：同一张图库图只转存一次公开 media URL，避免重复占用存储 */
const galleryPublicUrlCache = new Map<string, string>();

type ResolveFn = (asset: PickedGalleryAsset | null) => void;

/** 把私有图库图转存为公开 media URL（归属 subject 用户，便于作品渲染与数据隔离） */
async function toPublicMediaUrl(
  galleryId: string,
  width: number | null,
  height: number | null,
  subject: string | null,
): Promise<string> {
  const cached = galleryPublicUrlCache.get(galleryId);
  if (cached) return cached;
  const tk = authHeaders()['Authorization'];
  const fileRes = await fetch(withSubject(`${API_URL}/assets/${galleryId}/file`, subject), {
    headers: authHeaders(),
  });
  if (!fileRes.ok) throw new Error('load gallery asset failed');
  const blob = await fileRes.blob();
  const file = new File([blob], 'image.webp', { type: 'image/webp' });
  const form = new FormData();
  form.append('file', file);
  const qs = `?width=${width ?? ''}&height=${height ?? ''}`;
  const upRes = await fetch(withSubject(`${API_URL}/assets/upload${qs}`, subject), {
    method: 'POST',
    headers: tk ? { Authorization: tk } : undefined,
    body: form,
  });
  if (!upRes.ok) throw new Error('upload media failed');
  const data = (await upRes.json()) as { url: string };
  galleryPublicUrlCache.set(galleryId, data.url);
  return data.url;
}

export default function GalleryPickerModal({ layer = 'user' }: { layer?: GalleryLayer }) {
  const subject = useInspectSubject();
  // 被视察对象（ADMIN 用户视角）一定是「用户」，其余（服务商/代理自助）按宿主 layer 判定扩容入口
  const resolvedLayer: GalleryLayer = subject ? 'user' : layer;
  const {
    list,
    quota,
    loading,
    uploading,
    uploadPct,
    previewId,
    setPreviewId,
    cropId,
    setCropId,
    full,
    upgradeHref,
    fetchUrl,
    upload,
    confirmRemove,
    load,
  } = useGalleryData(subject, resolvedLayer);

  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<ResolveFn | null>(null);

  useEffect(() => {
    registerGalleryPicker((resolve) => {
      // 每次打开都静默重拉一次：上次打开后图片可能已被选入作品（引用关系变化），
      // 保证「已使用 / 未使用」状态标签每次打开都与最新作品引用关系一致。
      load(true);
      setPending(() => resolve);
      setOpen(true);
    });
    return () => {
      registerGalleryPicker(null);
    };
  }, [load]);

  const close = useCallback(
    (result: PickedGalleryAsset | null) => {
      setOpen(false);
      setPreviewId(null);
      setCropId(null);
      const r = pending;
      setPending(null);
      r?.(result);
    },
    [pending, setPreviewId, setCropId],
  );

  const onSelect = useCallback(
    async (a: { id: string; width: number | null; height: number | null }) => {
      try {
        const url = await toPublicMediaUrl(a.id, a.width, a.height, subject);
        close({ id: a.id, url, width: a.width ?? undefined, height: a.height ?? undefined });
      } catch (err) {
        if (import.meta.env.DEV) console.error('[galleryPicker] pick failed', err);
        message.error(t('gallery.pickErr', { defaultValue: '选择失败，请重试' }));
      }
    },
    [subject, close],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-[rgba(30,24,16,0.6)] p-4"
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
              <a
                href={upgradeHref}
                onClick={(e) => e.stopPropagation()}
                className="rounded-lg bg-[#D24830] px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-[#B23A22]"
              >
                {t('gallery.upgrade', { defaultValue: '去扩容' })}
              </a>
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
            <div className="py-12 text-center text-sm text-gray-500">
              {t('gallery.empty', { defaultValue: '暂无图片，点击右上角上传' })}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {list.map((a) => (
                <GalleryCard
                  key={a.id}
                  asset={a}
                  fetchUrl={fetchUrl}
                  onSelect={() => onSelect(a)}
                  onPreview={() => setPreviewId(a.id)}
                  onDelete={() => confirmRemove(a)}
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
          subject={subject}
          quota={quota}
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
