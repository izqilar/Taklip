/**
 * 用户图库「共享逻辑 + 视图」模块。
 *
 * 同时被两处复用（避免重复实现）：
 *  - apps/web/src/user/Gallery.tsx      → 我的图库整页
 *  - apps/web/src/user/GalleryModal.tsx → 编辑器内「图库选择器」弹窗
 *
 * 这里集中图库的数据拉取、上传(WebP 预压缩)、删除(级联保护)、裁剪(框选+可缩放)
 * 以及卡片 / 预览弹窗 / 裁剪弹窗视图。编辑器统一从这里取「添加 / 删除 / 裁剪」能力，
 * 保证两端行为一致。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, getStoredToken } from '@/api/client';

/** 图库单图硬上限 2MB（与后端 MAX_GALLERY_BYTES 一致；前端预压缩保证达标） */
export const MAX_GALLERY_BYTES = 2 * 1024 * 1024;
/** 最长边上限，防超分辨率解压炸弹 */
export const MAX_DIM = 4096;

export interface GalleryAsset {
  id: string;
  name: string;
  type: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  createdAt: string;
  /** 被作品使用的次数（编辑器选择器把本图转存为 media 副本嵌入作品即计 1）。>0 时禁止删除。 */
  usedInWorks?: number;
  /** 内容哈希：用于裁剪「原位替换原图」后让缩略图缓存失效并刷新（与后端 sha256 一致） */
  sha256?: string;
}

export interface Quota {
  used: number;
  limit: number;
  role?: string;
  plan?: string;
  tier?: number;
  tierKind?: 'agent' | 'provider' | 'user';
}

/** 档位中文名：索引即 tier（agent/provider 0..4，user 0..3） */
export const TIER_LABELS: Record<'agent' | 'provider' | 'user', string[]> = {
  agent: ['见习代理', '铜牌代理', '银牌代理', '金牌代理', '钻石代理'],
  provider: ['新锐服务商', '铜牌服务商', '银牌服务商', '金牌服务商', '钻石服务商'],
  user: ['免费用户', '银卡用户', '金卡用户', '黑金用户'],
};
export function tierLabel(q?: Quota | null): string {
  if (!q || q.tierKind == null) return '';
  const arr = TIER_LABELS[q.tierKind];
  if (!arr) return '';
  return arr[Math.max(0, Math.min(arr.length - 1, q.tier ?? 0))] ?? '';
}

/** 把任意像素图片转成 ≤2MB 的 WebP（质量/降维自适应） */
export async function fileToWebp(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const srcW = bitmap.width;
  const srcH = bitmap.height;
  let scale = 1;
  if (Math.max(srcW, srcH) > MAX_DIM) scale = MAX_DIM / Math.max(srcW, srcH);
  let q = 0.92;
  let last: { blob: Blob; w: number; h: number } | null = null;
  for (let i = 0; i < 8; i++) {
    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('canvas unavailable');
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/webp', q));
    if (blob) {
      last = { blob, w, h };
      if (blob.size <= MAX_GALLERY_BYTES) return { blob, width: w, height: h };
      q *= 0.85;
      if (q < 0.5) {
        q = 0.5;
        scale *= 0.9;
      }
    } else {
      throw new Error('webp encode failed');
    }
  }
  if (last) return { blob: last.blob, width: last.w, height: last.h };
  throw new Error('webp encode failed');
}

export const fmtSize = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};

/** 鉴权拉取私有图并生成本地 objectURL（组件卸载统一回收） */
export function usePrivateImage() {
  const cache = useRef<Map<string, string>>(new Map());
  const fetchUrl = useCallback(async (id: string, rev?: string): Promise<string> => {
    // rev（图库图的内容哈希）变化 → 缓存键 + URL 查询串同步变化，
    // 使「裁剪→原位替换原图」后缩略图能拿到新内容（绕过内存缓存与浏览器 HTTP 缓存）。
    const key = rev ? `${id}:${rev}` : id;
    const hit = cache.current.get(key);
    if (hit) return hit;
    const tk = getStoredToken();
    const res = await fetch(`/api/assets/${id}/file${rev ? `?v=${rev}` : ''}`, {
      headers: tk ? { Authorization: `Bearer ${tk}` } : {},
    });
    if (!res.ok) throw new Error('load failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    cache.current.set(key, url);
    return url;
  }, []);
  const revokeAll = useCallback(() => {
    cache.current.forEach((u) => URL.revokeObjectURL(u));
    cache.current.clear();
  }, []);
  return { fetchUrl, revokeAll };
}

function safeJson(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** 图库数据 + 操作（添加 / 删除 / 裁剪后重载），页面与弹窗共用 */
export function useGalleryData() {
  const { t } = useTranslation();
  const [list, setList] = useState<GalleryAsset[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);

  /** silent=true 时不切换 loading 态（用于焦点/可见性静默刷新，避免整页闪烁、避免误清空列表） */
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [lRes, qRes] = await Promise.all([
        api.get<GalleryAsset[]>('/api/assets?type=image&galleryOnly=1'),
        api.get<Quota>('/api/assets/quota'),
      ]);
      setList(lRes ?? []);
      setQuota(qRes ?? null);
    } catch {
      if (!silent) {
        setList([]);
        setQuota(null);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // 「已使用 / 未使用」实时化：作品引用关系由编辑器在别处写入（图库图被选入作品时会
    // 新建一条 derivedFrom=本图的 media 副本），本页感知不到。故在窗口重新聚焦 /
    // 标签页重新可见时静默重拉一次，保证标签状态与真实作品引用关系一致。
    const refresh = () => load(true);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load(true);
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      setUploadPct(0);
      try {
        const { blob, width, height } = await fileToWebp(file);
        const form = new FormData();
        form.append('file', blob, 'image.webp');
        const tk = getStoredToken();
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/assets/upload?purpose=gallery&width=${width}&height=${height}`);
        if (tk) xhr.setRequestHeader('Authorization', `Bearer ${tk}`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100));
        };
        const done = await new Promise<{ ok: boolean; status: number; data: any }>((resolve) => {
          xhr.onload = () =>
            resolve({ ok: xhr.status < 300, status: xhr.status, data: safeJson(xhr.responseText) });
          xhr.onerror = () => resolve({ ok: false, status: 0, data: null });
          xhr.send(form);
        });
        if (!done.ok) {
          if (done.status === 429) {
            alert(t('gallery.quotaHit', { defaultValue: '已达图片上限，请删除部分图片或购买扩容服务' }));
          } else if (done.status === 400) {
            alert(done.data?.message || t('gallery.badFormat', { defaultValue: '仅支持像素图片' }));
          } else {
            alert(t('gallery.upErr', { defaultValue: '上传失败' }));
          }
          return;
        }
        await load();
      } catch {
        alert(t('gallery.upErr', { defaultValue: '上传失败' }));
      } finally {
        setUploading(false);
        setUploadPct(0);
      }
    },
    [load, t],
  );

  const remove = useCallback(
    async (id: string, force = false) => {
      try {
        await api.del(`/api/assets/${id}${force ? '?force=1' : ''}`);
        await load();
        return true;
      } catch (e: any) {
        if (e?.statusCode === 409) {
          window.alert(
            e?.serverMessage ||
              t('gallery.inUse', { defaultValue: '该图片正被作品使用，无法删除' }),
          );
        } else {
          window.alert(t('gallery.delErr', { defaultValue: '删除失败' }));
        }
        return false;
      }
    },
    [load, t],
  );

  /**
   * 删除入口：二次确认后再执行（与服务商端 apps/admin GalleryPage 行为一致）。
   * - 普通图片：常规确认，说明会同时移除磁盘文件且不可恢复。
   * - 被作品使用（usedInWorks>0）：额外点名作品数，警示作品内该图可能失效；
   *   用户确认后带 force=1 强制删除（服务端默认仍以 409 兜底硬保护）。
   * 注：web 端不引入 antd（该包无此依赖），用原生 confirm 保持零新增依赖。
   */
  const confirmRemove = useCallback(
    (asset: GalleryAsset) => {
      const inUse = (asset.usedInWorks ?? 0) > 0;
      const name = asset.name || t('gallery.thisImage', { defaultValue: '该图片' });
      const content = inUse
        ? t('gallery.delConfirmInUse', {
            count: asset.usedInWorks ?? 0,
            defaultValue: `「${name}」正被 ${asset.usedInWorks ?? 0} 个作品使用。\n删除后图库图片与磁盘文件将被移除，作品内该图片可能显示异常。`,
          })
        : t('gallery.delConfirm', {
            defaultValue: `「${name}」将从图库和磁盘中永久删除，且无法恢复。`,
          });
      if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
        void remove(asset.id, inUse);
        return;
      }
      if (window.confirm(`${t('gallery.delConfirmTitle', { defaultValue: '确认删除图片？' })}\n\n${content}`)) {
        void remove(asset.id, inUse);
      }
    },
    [remove, t],
  );

  const full = quota ? quota.used >= quota.limit : false;

  return { list, quota, loading, uploading, uploadPct, upload, remove, confirmRemove, load, full };
}

/** 裁剪选区最小边长（px，显示坐标）；与锚点拖拽的边界夹取共用 */
const MIN_SEL = 8;

/** 裁剪选区的 8 个调整锚点标识：nw/n/ne/e/se/s/sw/w */
export type CropHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** 锚点 → 鼠标光标 + 在选区内的相对位置（0..1 比例），供两端裁剪框共用 */
export const CROP_HANDLES: { h: CropHandle; fx: number; fy: number; cursor: string }[] = [
  { h: 'nw', fx: 0, fy: 0, cursor: 'nwse-resize' },
  { h: 'n', fx: 0.5, fy: 0, cursor: 'ns-resize' },
  { h: 'ne', fx: 1, fy: 0, cursor: 'nesw-resize' },
  { h: 'e', fx: 1, fy: 0.5, cursor: 'ew-resize' },
  { h: 'se', fx: 1, fy: 1, cursor: 'nwse-resize' },
  { h: 's', fx: 0.5, fy: 1, cursor: 'ns-resize' },
  { h: 'sw', fx: 0, fy: 1, cursor: 'nesw-resize' },
  { h: 'w', fx: 0, fy: 0.5, cursor: 'ew-resize' },
];

/**
 * 「作品引用状态」标签：已使用（品牌红）/ 未使用（中性灰）。
 *
 * 视觉规格与运营端 apps/admin/src/pages/gallery/GalleryPage.tsx 的 UsageTag **逐像素一致**
 * （圆角 10 / 11px / 600 / 行高 16 / 内边距 1px 8px / 圆点 6px / 同色值），
 * 两端改动必须同步，否则卡片状态标签会出现跨端差异。
 */
export function UsageTag({ inUse, count }: { inUse: boolean; count: number }) {
  const { t } = useTranslation();
  return (
    <span
      title={
        inUse
          ? t('gallery.statusUsedTip', { n: count, defaultValue: `已被 ${count} 个作品使用` })
          : t('gallery.statusUnusedTip', { defaultValue: '尚未被任何作品使用' })
      }
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        flex: 'none',
        borderRadius: 10,
        padding: '1px 8px',
        fontSize: 11,
        fontWeight: 600,
        lineHeight: '16px',
        background: inUse ? 'rgba(210,72,48,0.12)' : 'rgba(0,0,0,0.05)',
        color: inUse ? '#D24830' : '#8c8c8c',
      }}
    >
      <i
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'currentColor',
          display: 'block',
        }}
      />
      {inUse
        ? t('gallery.statusUsed', { defaultValue: '已使用' })
        : t('gallery.statusUnused', { defaultValue: '未使用' })}
    </span>
  );
}

export function GalleryCard({
  asset,
  fetchUrl,
  onPreview,
  onDelete,
  onCrop,
  onSelect,
}: {
  asset: GalleryAsset;
  fetchUrl: (id: string, rev?: string) => Promise<string>;
  onPreview: () => void;
  onDelete: () => void;
  onCrop: () => void;
  /** 弹窗模式提供：点击缩略图即选中并关闭弹窗 */
  onSelect?: () => void;
}) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  const inUse = (asset.usedInWorks ?? 0) > 0;
  useEffect(() => {
    let alive = true;
    fetchUrl(asset.id, asset.sha256)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [asset.id, asset.sha256, fetchUrl]);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={onSelect ?? onPreview}
        className="block w-full bg-gray-100"
        style={{ aspectRatio: '375 / 667' }}
        aria-label={t('gallery.preview', { defaultValue: '预览' })}
        title={asset.name}
      >
        {err ? (
          <span className="flex h-full w-full items-center justify-center text-xs text-gray-300">—</span>
        ) : url ? (
          <img src={url} alt={asset.name} className="h-full w-full object-contain p-2" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs text-gray-300">…</span>
        )}
      </button>
      <div className="p-2" style={{ fontSize: 12 }}>
        {/* 原先展示的图片文件名，按需求替换为「作品引用状态」标签（显著位置：缩略图正下方首行）；
            文件名下沉到缩略图 title，悬停仍可查看，避免信息丢失。 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <UsageTag inUse={inUse} count={asset.usedInWorks ?? 0} />
        </div>
        <div style={{ color: '#999' }}>
          {asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ''}
          {fmtSize(asset.size)}
        </div>
        {/* 操作按钮组：与服务商端（apps/admin GalleryPage）IconBtn 保持完全一致的
            尺寸 / 圆角 / 边框 / 间距 / 排布 / hover / danger 表现 */}
        <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
          <IconBtn title={t('gallery.preview', { defaultValue: '预览' })} onClick={onPreview}>
            <EyeIcon />
          </IconBtn>
          <IconBtn title={t('gallery.crop', { defaultValue: '裁剪' })} onClick={onCrop}>
            <ScissorIcon />
          </IconBtn>
          <IconBtn title={t('gallery.delete', { defaultValue: '删除' })} danger onClick={onDelete}>
            <TrashIcon />
          </IconBtn>
        </div>
      </div>
    </div>
  );
}

/* —— 图库卡片图标：与运营端 antd 图标视觉对齐（1.6 描边、currentColor、14px）——
   web 端未引入 @ant-design/icons（无该依赖），此处以内联 SVG 复刻 antd
   EyeOutlined / ScissorOutlined / DeleteOutlined 的形状与描边，保持两端按钮观感一致。 */
const ICON_SIZE = 14;
const ICON_STROKE = 1.6;

function EyeIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={ICON_STROKE} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ScissorIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={ICON_STROKE} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={ICON_STROKE} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

/** 图库卡片操作按钮（web / 运营端视觉一致：28×28、radius 6、border #e0e0e0、gap 4） */
function IconBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      onClick={onClick}
      style={{
        border: '1px solid #e0e0e0',
        background: '#fff',
        borderRadius: 6,
        width: 28,
        height: 28,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: danger ? '#c0392b' : '#555',
        transition: 'border-color .2s, color .2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = danger ? '#c0392b' : '#c24b2e';
        e.currentTarget.style.color = danger ? '#c0392b' : '#c24b2e';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#e0e0e0';
        e.currentTarget.style.color = danger ? '#c0392b' : '#555';
      }}
    >
      {children}
    </button>
  );
}

export function ZoomControls({
  zoom,
  setZoom,
  suffix = '%',
}: {
  zoom: number;
  setZoom: (z: number) => void;
  suffix?: string;
}) {
  const clamp = (z: number) => Math.max(0.2, Math.min(5, z));
  return (
    <div className="mb-2 flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => setZoom(clamp(zoom / 1.2))}
        disabled={zoom <= 0.2}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-[#555] disabled:opacity-40 hover:text-[#D24830]"
        aria-label="缩小"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12h14" />
        </svg>
      </button>
      <span className="w-12 text-center text-xs tabular-nums text-gray-500">{Math.round(zoom * 100)}{suffix}</span>
      <button
        type="button"
        onClick={() => setZoom(clamp(zoom * 1.2))}
        disabled={zoom >= 5}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-[#555] disabled:opacity-40 hover:text-[#D24830]"
        aria-label="放大"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
}

export function PreviewModal({
  id,
  fetchUrl,
  onClose,
}: {
  id: string | null;
  fetchUrl: (id: string) => Promise<string>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    if (!id) return;
    setZoom(1);
    let alive = true;
    fetchUrl(id)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setUrl(null));
    return () => {
      alive = false;
    };
  }, [id, fetchUrl]);
  if (!id) return null;
  const clamp = (z: number) => Math.max(0.2, Math.min(5, z));
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => clamp(z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(30,24,16,0.55)] p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-[14px] bg-[#fffefb] p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[14.5px] font-semibold text-[#2a2118]">{t('gallery.preview', { defaultValue: '预览' })}</h3>
          <button type="button" onClick={onClose} className="text-[#6e5f4a] hover:text-[#4c4236]">
            ✕
          </button>
        </div>
        <ZoomControls zoom={zoom} setZoom={setZoom} />
        <div onWheel={onWheel} className="flex max-h-[70vh] justify-center overflow-auto rounded-lg bg-[#1f1f1f] p-2">
          {url ? (
            <img
              src={url}
              alt="preview"
              draggable={false}
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center', maxWidth: '100%', maxHeight: '70vh' }}
            />
          ) : (
            <div className="py-16 text-sm text-gray-400">…</div>
          )}
        </div>
        <div className="mt-2 text-xs text-gray-400">
          {t('gallery.zoomTip', { defaultValue: '点击 +/− 或滚动鼠标中键滚轮可缩放预览。' })}
        </div>
      </div>
    </div>
  );
}

export function CropModal({
  id,
  fetchUrl,
  onClose,
  onDone,
  quota,
}: {
  id: string | null;
  fetchUrl: (id: string, rev?: string) => Promise<string>;
  onClose: () => void;
  onDone: () => void;
  /** 图库配额（used/limit）；用于「保存为新图」在配额满时拦截并提示，不触发裁剪 */
  quota?: Quota | null;
}) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [base, setBase] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [sel, setSel] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const drag = useRef<
    | { mode: 'new'; sx: number; sy: number }
    | { mode: 'move'; sx: number; sy: number; orig: { x: number; y: number; w: number; h: number } }
    | {
        mode: 'resize';
        handle: CropHandle;
        sx: number;
        sy: number;
        orig: { x: number; y: number; w: number; h: number };
      }
    | null
  >(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.max(0.2, Math.min(5, z * (e.deltaY < 0 ? 1.15 : 1 / 1.15))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [url]);

  useEffect(() => {
    if (!id) return;
    setZoom(1);
    setSel(null);
    let alive = true;
    fetchUrl(id)
      .then(async (u) => {
        if (!alive) return;
        setUrl(u);
        const img = new Image();
        img.onload = () => {
          if (!alive) return;
          setNat({ w: img.naturalWidth, h: img.naturalHeight });
          const MAX_W = 560;
          const MAX_H = 380;
          const r = Math.min(MAX_W / img.naturalWidth, MAX_H / img.naturalHeight, 1);
          setBase({ w: Math.round(img.naturalWidth * r), h: Math.round(img.naturalHeight * r) });
        };
        img.src = u;
      })
      .catch(() => alive && setUrl(null));
    return () => {
      alive = false;
    };
  }, [id, fetchUrl]);

  if (!id) return null;
  const clamp = (z: number) => Math.max(0.2, Math.min(5, z));
  const dispW = base ? Math.round(base.w * zoom) : 0;
  const dispH = base ? Math.round(base.h * zoom) : 0;

  const localPoint = (e: React.MouseEvent) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, rect };
  };
  // 新建选区：若按下点落在既有选区内部，则进入「整体移动」模式而非重画
  const onDown = (e: React.MouseEvent) => {
    if (!base) return;
    const p = localPoint(e);
    if (!p) return;
    if (sel && p.x >= sel.x && p.x <= sel.x + sel.w && p.y >= sel.y && p.y <= sel.y + sel.h) {
      drag.current = {
        mode: 'move',
        sx: p.x,
        sy: p.y,
        orig: { ...sel },
      };
      return;
    }
    drag.current = { mode: 'new', sx: p.x, sy: p.y };
    setSel({ x: p.x, y: p.y, w: 0, h: 0 });
  };
  const onMove = (e: React.MouseEvent) => {
    if (!drag.current || !base) return;
    const p = localPoint(e);
    if (!p) return;
    const rect = p.rect;
    const x = Math.max(0, Math.min(rect.width, p.x));
    const y = Math.max(0, Math.min(rect.height, p.y));
    const d = drag.current;
    if (d.mode === 'move') {
      // 整体平移：保持尺寸，夹取在舞台内
      const nx = Math.max(0, Math.min(rect.width - d.orig.w, p.x - d.sx + d.orig.x));
      const ny = Math.max(0, Math.min(rect.height - d.orig.h, p.y - d.sy + d.orig.y));
      setSel({ x: nx, y: ny, w: d.orig.w, h: d.orig.h });
      return;
    }
    if (d.mode === 'resize' && d.orig && d.handle) {
      // 拖动锚点：仅移动被拖拽的那条边，对边冻结。
      // 关键修复：resize 逻辑挂在舞台 onMouseMove 上（覆盖整张图），
      // 即使指针离开 10×10 的小锚点也能持续跟随，解决「锚点拖不动」问题。
      const o = d.orig;
      const h = d.handle;
      let x1 = o.x;
      let y1 = o.y;
      let x2 = o.x + o.w;
      let y2 = o.y + o.h;
      if (h.includes('w')) x1 = Math.max(0, Math.min(x2 - MIN_SEL, p.x));
      if (h.includes('e')) x2 = Math.min(rect.width, Math.max(x1 + MIN_SEL, p.x));
      if (h.includes('n')) y1 = Math.max(0, Math.min(y2 - MIN_SEL, p.y));
      if (h.includes('s')) y2 = Math.min(rect.height, Math.max(y1 + MIN_SEL, p.y));
      setSel({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
      return;
    }
    setSel({
      x: Math.min(d.sx, x),
      y: Math.min(d.sy, y),
      w: Math.abs(x - d.sx),
      h: Math.abs(y - d.sy),
    });
  };
  const onUp = () => {
    drag.current = null;
  };

  // —— 8 个调整锚点：按下时冻结「对手边」，拖动只改两条边 ——
  const startResize = (e: React.MouseEvent, h: CropHandle) => {
    if (!sel) return;
    e.preventDefault();
    e.stopPropagation();
    const p = localPoint(e);
    if (!p) return;
    drag.current = { mode: 'resize', handle: h, sx: p.x, sy: p.y, orig: { ...sel } };
  };
  const cropToBlob = async (): Promise<{ blob: Blob; w: number; h: number } | null> => {
    if (!url || !sel || sel.w < 8 || sel.h < 8 || !nat || !base) {
      alert(t('gallery.cropHint', { defaultValue: '请先框选裁剪区域' }));
      return null;
    }
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    const sx = (sel.x / rect.width) * nat.w;
    const sy = (sel.y / rect.height) * nat.h;
    const sw = (sel.w / rect.width) * nat.w;
    const sh = (sel.h / rect.height) * nat.h;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(sw));
    c.height = Math.max(1, Math.round(sh));
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    const img = new Image();
    img.src = url;
    await new Promise((res) => {
      if (img.complete) res(null);
      else img.onload = () => res(null);
    });
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/webp', 0.92));
    if (!blob) {
      alert(t('gallery.cropErr', { defaultValue: '裁剪失败' }));
      return null;
    }
    return { blob, w: c.width, h: c.height };
  };

  const toForm = (blob: Blob) => {
    const form = new FormData();
    form.append('file', blob, 'cropped.webp');
    return form;
  };

  // 「裁剪」：直接替换原图（不占配额，配额满也可点）
  const onCropReplace = async () => {
    const r = await cropToBlob();
    if (!r) return;
    try {
      const tk = getStoredToken();
      const res = await fetch(`/api/assets/${id}/replace?width=${r.w}&height=${r.h}`, {
        method: 'POST',
        headers: tk ? { Authorization: `Bearer ${tk}` } : undefined,
        body: toForm(r.blob),
      });
      if (res.ok) {
        onDone();
      } else {
        alert(t('gallery.cropErr', { defaultValue: '裁剪失败' }));
      }
    } catch {
      alert(t('gallery.cropErr', { defaultValue: '裁剪失败' }));
    }
  };

  // 「保存为新图」：生成裁剪后的新图（占配额）；配额不足时提示且不裁剪
  const onSaveAsNew = async () => {
    if (quota && quota.used >= quota.limit) {
      alert(
        t('gallery.cropQuotaHit', {
          defaultValue: '你可使用的图片数量达到最大数量限制，请购买服务或删除一张图片。',
        }),
      );
      return;
    }
    const r = await cropToBlob();
    if (!r) return;
    try {
      const tk = getStoredToken();
      const res = await fetch(
        `/api/assets/upload?purpose=gallery&derivedFrom=${id}&width=${r.w}&height=${r.h}`,
        {
          method: 'POST',
          headers: tk ? { Authorization: `Bearer ${tk}` } : undefined,
          body: toForm(r.blob),
        },
      );
      if (res.ok) {
        onDone();
      } else if (res.status === 429) {
        alert(
          t('gallery.cropQuotaHit', {
            defaultValue: '你可使用的图片数量达到最大数量限制，请购买服务或删除一张图片。',
          }),
        );
      } else {
        alert(t('gallery.cropErr', { defaultValue: '裁剪失败' }));
      }
    } catch {
      alert(t('gallery.cropErr', { defaultValue: '裁剪失败' }));
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(30,24,16,0.55)] p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-[14px] bg-[#fffefb] p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[14.5px] font-semibold text-[#2a2118]">{t('gallery.crop', { defaultValue: '裁剪' })}</h3>
          <button type="button" onClick={onClose} className="text-[#6e5f4a] hover:text-[#4c4236]">
            ✕
          </button>
        </div>
        <ZoomControls zoom={zoom} setZoom={setZoom} />
        <div
          ref={wrapRef}
          className="flex max-h-[60vh] justify-center overflow-auto rounded-lg bg-[#222]"
          style={{ userSelect: 'none' }}
        >
          <div
            ref={stageRef}
            onMouseDown={onDown}
            onMouseMove={onMove}
            onMouseUp={onUp}
            onMouseLeave={onUp}
            style={{
              position: 'relative',
              width: dispW || '100%',
              height: dispH || 'auto',
              lineHeight: 0,
              cursor: 'crosshair',
              flex: 'none',
            }}
          >
            {url && base ? (
              <img
                src={url}
                alt="crop"
                draggable={false}
                style={{ width: '100%', height: '100%', display: 'block', opacity: 0.85 }}
              />
            ) : (
              <div className="py-16 text-center text-sm text-gray-400" style={{ width: 320 }}>
                …
              </div>
            )}
            {sel && (
              <>
                <div
                  style={{
                    position: 'absolute',
                    left: sel.x,
                    top: sel.y,
                    width: sel.w,
                    height: sel.h,
                    border: '2px dashed #c24b2e',
                    background: 'rgba(194,75,46,0.12)',
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
                    cursor: 'move',
                  }}
                  onMouseDown={(e) => {
                    // 选区内部按下 → 整体移动（不在此处 preventDefault，交由 onDown 判定）
                    e.stopPropagation();
                    onDown(e);
                  }}
                />
                {/* 8 个调整锚点：精细调整裁剪范围 */}
                {CROP_HANDLES.map(({ h, fx, fy, cursor }) => (
                  <span
                    key={h}
                    role="presentation"
                    data-crop-handle={h}
                    onMouseDown={(e) => startResize(e, h)}
                    style={{
                      position: 'absolute',
                      left: sel.x + sel.w * fx,
                      top: sel.y + sel.h * fy,
                      width: 10,
                      height: 10,
                      marginLeft: -5,
                      marginTop: -5,
                      borderRadius: 2,
                      background: '#fff',
                      border: '1.5px solid #c24b2e',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                      cursor,
                      zIndex: 2,
                      pointerEvents: 'auto',
                    }}
                  />
                ))}
              </>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-gray-400">
          {t('gallery.cropTip', {
            defaultValue: '在图上按住拖动框选区域；拖动选区四角/四边锚点可精细调整范围，拖动选区内部可整体移动；点击 +/− 或滚动鼠标中键滚轮可缩放。「裁剪」直接替换原图（不占配额），「保存为新图」生成新图并占配额（配额满时不可用）。',
          })}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="whitespace-nowrap rounded-lg border border-gray-300 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            {t('common:button.cancel', { defaultValue: '取消' })}
          </button>
          <button
            type="button"
            onClick={onCropReplace}
            className="whitespace-nowrap rounded-lg border border-[#D24830] px-4 py-1.5 text-sm font-medium text-[#D24830] hover:bg-[#fdeee9]"
          >
            {t('gallery.cropReplace', { defaultValue: '裁剪' })}
          </button>
          <button
            type="button"
            onClick={onSaveAsNew}
            className="whitespace-nowrap rounded-lg bg-[#D24830] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#B23A22]"
          >
            {t('gallery.cropSaveNew', { defaultValue: '保存为新图' })}
          </button>
        </div>
      </div>
    </div>
  );
}
