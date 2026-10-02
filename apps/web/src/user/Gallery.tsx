/**
 * 终端用户图库（文档 §2.2「资源中心 · 我的图库」）。
 * 与运营端 GalleryPage 同一套后端 /api/assets 端点，仅归属人取当前会话用户。
 * 能力：网格浏览 / 上传(前端 WebP 预压缩) / 预览(可缩放) / 裁剪(框选+可缩放) / 删除(级联保护) /
 * 分级配额(免费4 / 银卡6 / 金卡10 / 黑金16) / 满额禁用上传 + 跳转独立扩容套餐页。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api, getStoredToken } from '@/api/client';
import { PageHead, Panel, EmptyState } from './shared';

/** 图库单图硬上限 2MB（与后端 MAX_GALLERY_BYTES 一致；前端预压缩保证达标） */
const MAX_GALLERY_BYTES = 2 * 1024 * 1024;
/** 最长边上限，防超分辨率解压炸弹 */
const MAX_DIM = 4096;

interface GalleryAsset {
  id: string;
  name: string;
  type: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  createdAt: string;
}

interface Quota {
  used: number;
  limit: number;
  role?: string;
  plan?: string;
  tier?: number;
  tierKind?: 'agent' | 'provider' | 'user';
}

/** 档位中文名：索引即 tier（agent/provider 0..4，user 0..3） */
const TIER_LABELS: Record<'agent' | 'provider' | 'user', string[]> = {
  agent: ['见习代理', '铜牌代理', '银牌代理', '金牌代理', '钻石代理'],
  provider: ['新锐服务商', '铜牌服务商', '银牌服务商', '金牌服务商', '钻石服务商'],
  user: ['免费用户', '银卡用户', '金卡用户', '黑金用户'],
};
function tierLabel(q?: Quota | null): string {
  if (!q || q.tierKind == null) return '';
  const arr = TIER_LABELS[q.tierKind];
  if (!arr) return '';
  return arr[Math.max(0, Math.min(arr.length - 1, q.tier ?? 0))] ?? '';
}

/** 把任意像素图片转成 ≤2MB 的 WebP（质量/降维自适应） */
async function fileToWebp(file: File): Promise<{ blob: Blob; width: number; height: number }> {
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

const fmtSize = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};

/** 鉴权拉取私有图并生成本地 objectURL（组件卸载统一回收） */
function usePrivateImage() {
  const cache = useRef<Map<string, string>>(new Map());
  const fetchUrl = useCallback(async (id: string): Promise<string> => {
    const hit = cache.current.get(id);
    if (hit) return hit;
    const tk = getStoredToken();
    const res = await fetch(`/api/assets/${id}/file`, {
      headers: tk ? { Authorization: `Bearer ${tk}` } : {},
    });
    if (!res.ok) throw new Error('load failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    cache.current.set(id, url);
    return url;
  }, []);
  const revokeAll = useCallback(() => {
    cache.current.forEach((u) => URL.revokeObjectURL(u));
    cache.current.clear();
  }, []);
  return { fetchUrl, revokeAll };
}

export default function Gallery() {
  const { t } = useTranslation();
  const [list, setList] = useState<GalleryAsset[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [cropId, setCropId] = useState<string | null>(null);
  const { fetchUrl, revokeAll } = usePrivateImage();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lRes, qRes] = await Promise.all([
        api.get<GalleryAsset[]>('/api/assets?type=image'),
        api.get<Quota>('/api/assets/quota'),
      ]);
      setList(lRes ?? []);
      setQuota(qRes ?? null);
    } catch {
      setList([]);
      setQuota(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    return () => revokeAll();
  }, [load, revokeAll]);

  const doUpload = useCallback(
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

  const onDelete = useCallback(
    async (id: string) => {
      try {
        await api.del(`/api/assets/${id}`);
        await load();
      } catch (e: any) {
        if (e?.statusCode === 409) {
          alert(
            e?.serverMessage ||
              t('gallery.inUse', { defaultValue: '该图片正被作品使用，无法删除' }),
          );
        } else {
          alert(t('gallery.delErr', { defaultValue: '删除失败' }));
        }
      }
    },
    [load, t],
  );

  const full = quota ? quota.used >= quota.limit : false;

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
                if (f) doUpload(f);
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {list.map((a) => (
              <GalleryCard
                key={a.id}
                asset={a}
                fetchUrl={fetchUrl}
                onPreview={() => setPreviewId(a.id)}
                onDelete={() => onDelete(a.id)}
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

function safeJson(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function GalleryCard({
  asset,
  fetchUrl,
  onPreview,
  onDelete,
  onCrop,
}: {
  asset: GalleryAsset;
  fetchUrl: (id: string) => Promise<string>;
  onPreview: () => void;
  onDelete: () => void;
  onCrop: () => void;
}) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    fetchUrl(asset.id)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [asset.id, fetchUrl]);

  const btn =
    'flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-[#555] transition hover:border-[#D24830]/40 hover:text-[#D24830]';

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={onPreview}
        className="block h-32 w-full bg-gray-100"
        aria-label={t('gallery.preview', { defaultValue: '预览' })}
      >
        {err ? (
          <span className="flex h-full items-center justify-center text-xs text-gray-300">—</span>
        ) : url ? (
          <img src={url} alt={asset.name} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center text-xs text-gray-300">…</span>
        )}
      </button>
      <div className="p-2">
        <div className="truncate text-[12.5px] text-[#2a2118]" title={asset.name}>
          {asset.name}
        </div>
        <div className="mt-0.5 text-[11.5px] text-gray-400">
          {asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ''}
          {fmtSize(asset.size)}
        </div>
        <div className="mt-2 flex gap-1.5">
          <button type="button" className={btn} title={t('gallery.preview', { defaultValue: '预览' })} onClick={onPreview}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <button type="button" className={btn} title={t('gallery.crop', { defaultValue: '裁剪' })} onClick={onCrop}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 2v14a2 2 0 0 0 2 2h14" />
              <path d="M6 2l14 14" />
            </svg>
          </button>
          <button
            type="button"
            className={`${btn} ml-auto text-[#b42318] hover:border-[#b42318]/40 hover:text-[#b42318]`}
            title={t('gallery.delete', { defaultValue: '删除' })}
            onClick={onDelete}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function ZoomControls({
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

function PreviewModal({
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

function CropModal({
  id,
  fetchUrl,
  onClose,
  onDone,
}: {
  id: string | null;
  fetchUrl: (id: string) => Promise<string>;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [base, setBase] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [sel, setSel] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const drag = useRef<{ sx: number; sy: number } | null>(null);

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
  const onDown = (e: React.MouseEvent) => {
    if (!base) return;
    const p = localPoint(e);
    if (!p) return;
    drag.current = { sx: p.x, sy: p.y };
    setSel({ x: p.x, y: p.y, w: 0, h: 0 });
  };
  const onMove = (e: React.MouseEvent) => {
    if (!drag.current || !base) return;
    const p = localPoint(e);
    if (!p) return;
    const x = Math.max(0, Math.min(p.rect.width, p.x));
    const y = Math.max(0, Math.min(p.rect.height, p.y));
    setSel({
      x: Math.min(drag.current.sx, x),
      y: Math.min(drag.current.sy, y),
      w: Math.abs(x - drag.current.sx),
      h: Math.abs(y - drag.current.sy),
    });
  };
  const onUp = () => {
    drag.current = null;
  };

  const onConfirm = async () => {
    if (!url || !sel || sel.w < 8 || sel.h < 8 || !nat || !base) {
      alert(t('gallery.cropHint', { defaultValue: '请先框选裁剪区域' }));
      return;
    }
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const sx = (sel.x / rect.width) * nat.w;
    const sy = (sel.y / rect.height) * nat.h;
    const sw = (sel.w / rect.width) * nat.w;
    const sh = (sel.h / rect.height) * nat.h;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(sw));
    c.height = Math.max(1, Math.round(sh));
    const ctx = c.getContext('2d');
    if (!ctx) return;
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
      return;
    }
    const form = new FormData();
    form.append('file', blob, 'cropped.webp');
    try {
      const tk = getStoredToken();
      const res = await fetch(
        `/api/assets/upload?purpose=gallery&derivedFrom=${id}&width=${c.width}&height=${c.height}`,
        {
          method: 'POST',
          headers: tk ? { Authorization: `Bearer ${tk}` } : undefined,
          body: form,
        },
      );
      if (res.ok) {
        onDone();
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
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {t('gallery.cropTip', {
              defaultValue: '在图上按住拖动框选区域；点击 +/− 或滚动鼠标中键滚轮可缩放，确认后生成一张新图，原图保留。',
            })}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              {t('common:button.cancel', { defaultValue: '取消' })}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-lg bg-[#D24830] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#B23A22]"
            >
              {t('gallery.cropConfirm', { defaultValue: '裁剪并保存为新图' })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
