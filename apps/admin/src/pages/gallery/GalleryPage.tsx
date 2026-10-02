import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Button, message, Progress, Empty, Spin, Tooltip } from 'antd';
import { UploadOutlined, DeleteOutlined, EyeOutlined, ScissorOutlined, CopyOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons';
import { API_URL, authHeaders } from '../../utility';
import { t } from '../../i18n/t';

/** 图库单图硬上限 2MB（与后端 MAX_GALLERY_BYTES 一致；前端预压缩保证达标） */
const MAX_GALLERY_BYTES = 2 * 1024 * 1024;
/** 最长边上限，防超分辨率解压炸弹 */
const MAX_DIM = 4096;

export type GalleryLayer = 'provider' | 'user' | 'agent';

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
  /** 牌级（agent/provider 为 agentTier/providerTier 0..4；user 为 vipLevel 0..3） */
  tier?: number;
  /** 档位类型：agent / provider / user，前端据此渲染「见习代理/铜牌服务商/银卡用户」等名 */
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
async function fileToWebp(
  file: File,
): Promise<{ blob: Blob; width: number; height: number }> {
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
    const blob = await new Promise<Blob | null>((res) =>
      c.toBlob(res, 'image/webp', q),
    );
    if (blob) {
      last = { blob, w, h };
      if (blob.size <= MAX_GALLERY_BYTES) return { blob, width: w, height: h };
      // 仍超：先降质，降质到底再降维
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

/** 鉴权拉取私有图并生成本地 objectURL（带缓存，组件卸载统一回收） */
function usePrivateImage() {
  const cache = useRef<Map<string, string>>(new Map());
  const fetchUrl = useCallback(async (id: string): Promise<string> => {
    const hit = cache.current.get(id);
    if (hit) return hit;
    const res = await fetch(`${API_URL}/assets/${id}/file`, {
      headers: authHeaders(),
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

export function GalleryPage({ layer }: { layer?: GalleryLayer }) {
  const [list, setList] = useState<GalleryAsset[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [cropId, setCropId] = useState<string | null>(null);
  const { fetchUrl, revokeAll } = usePrivateImage();

  // 扩容落地页：独立「扩容套餐页」（文档要求跳转独立页，已实现 UpgradePage 占位）
  const upgradeHref =
    layer === 'provider' ? '/sp/upgrade' : layer === 'agent' ? '/agent/upgrade' : '/user/upgrade';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lRes, qRes] = await Promise.all([
        fetch(`${API_URL}/assets?type=image&galleryOnly=1`, { headers: authHeaders() }),
        fetch(`${API_URL}/assets/quota`, { headers: authHeaders() }),
      ]);
      if (lRes.ok) setList((await lRes.json()) as GalleryAsset[]);
      if (qRes.ok) setQuota((await qRes.json()) as Quota);
    } catch {
      message.error(t('gallery.loadErr', { defaultValue: '图库加载失败' }));
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
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_URL}/assets/upload?purpose=gallery&width=${width}&height=${height}`);
        const tk = authHeaders()['Authorization'];
        if (tk) xhr.setRequestHeader('Authorization', tk);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100));
        };
        const done = await new Promise<{ ok: boolean; status: number; data: any }>(
          (resolve) => {
            xhr.onload = () =>
              resolve({ ok: xhr.status < 300, status: xhr.status, data: safeJson(xhr.responseText) });
            xhr.onerror = () => resolve({ ok: false, status: 0, data: null });
            xhr.send(form);
          },
        );
        if (!done.ok) {
          if (done.status === 429) {
            message.warning(
              t('gallery.quotaHit', { defaultValue: '已达图片上限，请删除部分图片或购买扩容服务' }),
            );
          } else if (done.status === 400) {
            message.error(done.data?.message || t('gallery.badFormat', { defaultValue: '仅支持像素图片' }));
          } else {
            message.error(t('gallery.upErr', { defaultValue: '上传失败' }));
          }
          return;
        }
        message.success(t('gallery.upOk', { defaultValue: '已上传' }));
        await load();
      } catch {
        message.error(t('gallery.upErr', { defaultValue: '上传失败' }));
      } finally {
        setUploading(false);
        setUploadPct(0);
      }
    },
    [load],
  );

  const onDelete = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`${API_URL}/assets/${id}`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        if (res.status === 409) {
          const d = await res.json().catch(() => ({}));
          message.warning(
            d?.message ||
              t('gallery.inUse', { defaultValue: '该图片正被作品使用，无法删除' }),
          );
          return;
        }
        if (!res.ok) {
          message.error(t('gallery.delErr', { defaultValue: '删除失败' }));
          return;
        }
        message.success(t('gallery.delOk', { defaultValue: '已删除' }));
        await load();
      } catch {
        message.error(t('gallery.delErr', { defaultValue: '删除失败' }));
      }
    },
    [load],
  );

  const full = quota ? quota.used >= quota.limit : false;

  return (
    <div style={{ padding: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>{t('gallery.title', { defaultValue: '我的图库' })}</h2>
          <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
            {quota
              ? `${t('gallery.used', { defaultValue: '已用' })} ${quota.used} / ${quota.limit} · ${
                  tierLabel(quota) || (quota.plan === 'PAID'
                    ? t('gallery.paid', { defaultValue: '会员' })
                    : t('gallery.free', { defaultValue: '免费' }))
                }`
              : t('gallery.loading', { defaultValue: '配额加载中…' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {full && (
            <>
              <span style={{ color: '#c0392b', fontSize: 12 }}>
                {t('gallery.fullHint', { defaultValue: `已达上限 ${quota?.limit ?? 0} 张，扩容后可继续上传` })}
              </span>
              <Button type="link" href={upgradeHref}>
                {t('gallery.upgrade', { defaultValue: '去扩容' })}
              </Button>
            </>
          )}
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              background: full ? '#d9d9d9' : '#c24b2e',
              color: '#fff',
              borderRadius: 6,
              cursor: full ? 'not-allowed' : 'pointer',
              opacity: full ? 0.7 : 1,
            }}
          >
            <UploadOutlined />
            {t('gallery.upload', { defaultValue: '上传图片' })}
            <input
              type="file"
              accept="image/*"
              disabled={full || uploading}
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) doUpload(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>

      {uploading && (
        <div style={{ marginBottom: 12, maxWidth: 320 }}>
          <Progress percent={uploadPct} />
        </div>
      )}

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <Spin />
        </div>
      ) : list.length === 0 ? (
        <Empty description={t('gallery.empty', { defaultValue: '暂无图片，点击右上角上传' })} />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 12,
          }}
        >
          {list.map((a) => (
            <GalleryCard
              key={a.id}
              asset={a}
              fetchUrl={fetchUrl}
              onPreview={() => setPreviewId(a.id)}
              onDelete={() => onDelete(a.id)}
              onCrop={() => setCropId(a.id)}
              onCopy={() => {
                navigator.clipboard?.writeText(a.id).catch(() => {});
                message.success(t('gallery.copied', { defaultValue: '已复制图片引用' }));
              }}
            />
          ))}
        </div>
      )}

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
  onCopy,
}: {
  asset: GalleryAsset;
  fetchUrl: (id: string) => Promise<string>;
  onPreview: () => void;
  onDelete: () => void;
  onCrop: () => void;
  onCopy: () => void;
}) {
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

  return (
    <div
      style={{
        border: '1px solid #eee',
        borderRadius: 8,
        overflow: 'hidden',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        onClick={onPreview}
        style={{
          aspectRatio: '375 / 667',
          background: '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          position: 'relative',
        }}
      >
        {err ? (
          <span style={{ color: '#bbb', fontSize: 12 }}>—</span>
        ) : url ? (
          <img
            src={url}
            alt={asset.name}
            style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }}
          />
        ) : (
          <Spin size="small" />
        )}
      </div>
      <div style={{ padding: 8, fontSize: 12 }}>
        <div
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginBottom: 2,
          }}
          title={asset.name}
        >
          {asset.name}
        </div>
        <div style={{ color: '#999' }}>
          {asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ''}
          {fmtSize(asset.size)}
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
          <IconBtn title="预览" onClick={onPreview}>
            <EyeOutlined />
          </IconBtn>
          <IconBtn title="裁剪" onClick={onCrop}>
            <ScissorOutlined />
          </IconBtn>
          <IconBtn title="复制引用" onClick={onCopy}>
            <CopyOutlined />
          </IconBtn>
          <IconBtn title="删除" danger onClick={onDelete}>
            <DeleteOutlined />
          </IconBtn>
        </div>
      </div>
    </div>
  );
}

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
    <Tooltip title={title}>
      <button
        aria-label={title}
        onClick={onClick}
        style={{
          border: '1px solid #e0e0e0',
          background: '#fff',
          borderRadius: 6,
          width: 28,
          height: 28,
          cursor: 'pointer',
          color: danger ? '#c0392b' : '#555',
        }}
      >
        {children}
      </button>
    </Tooltip>
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
  const clampZoom = (z: number) => Math.max(0.2, Math.min(5, z));
  const onWheel = (e: React.WheelEvent) => {
    // 中键滚轮缩放（deltaY<0 放大，>0 缩小）
    e.preventDefault();
    setZoom((z) => clampZoom(z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
  };
  return (
    <Modal
      open
      title={t('gallery.preview', { defaultValue: '预览' })}
      footer={null}
      onCancel={onClose}
      width={760}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
        <Button
          icon={<ZoomOutOutlined />}
          onClick={() => setZoom((z) => clampZoom(z / 1.2))}
          disabled={zoom <= 0.2}
        />
        <span style={{ alignSelf: 'center', fontSize: 12, color: '#888' }}>
          {Math.round(zoom * 100)}%
        </span>
        <Button
          icon={<ZoomInOutlined />}
          onClick={() => setZoom((z) => clampZoom(z * 1.2))}
          disabled={zoom >= 5}
        />
      </div>
      <div
        onWheel={onWheel}
        style={{
          textAlign: 'center',
          background: '#1f1f1f',
          borderRadius: 8,
          padding: 8,
          overflow: 'auto',
          maxHeight: '70vh',
        }}
      >
        {url ? (
          <img
            src={url}
            alt="preview"
            draggable={false}
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'center',
              maxWidth: '100%',
              maxHeight: '70vh',
            }}
          />
        ) : (
          <Spin />
        )}
      </div>
      <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
        {t('gallery.zoomTip', { defaultValue: '点击 +/− 按钮或滚动鼠标中键滚轮可缩放预览。' })}
      </div>
    </Modal>
  );
}

/** 轻量裁剪：图片按显示尺寸框选区域，确认后裁出 WebP 派生新图（不破坏原图）。
 *  支持缩放：放大/缩小按钮 + 鼠标中键滚轮；框选坐标始终基于「舞台自身渲染矩形」换算，
 *  因此任意缩放级别下选区都能正确映射回原图像素。 */
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
  const [url, setUrl] = useState<string | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  // 缩放=1 时的 contain 适配尺寸；实际显示尺寸 = base * zoom
  const [base, setBase] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [sel, setSel] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const drag = useRef<{ sx: number; sy: number } | null>(null);

  // 鼠标中键滚轮缩放（非 passive 监听，避免 passive 警告 + 防止背后页面滚动）
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
          // contain 适配到最大视口
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

  const clampZoom = (z: number) => Math.max(0.2, Math.min(5, z));
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
      message.warning(t('gallery.cropHint', { defaultValue: '请先框选裁剪区域' }));
      return;
    }
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    // 显示坐标 → 原图坐标（rect.width 已是缩放后的实际显示宽，与 base*zoom 一致）
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
      message.error(t('gallery.cropErr', { defaultValue: '裁剪失败' }));
      return;
    }
    const form = new FormData();
    form.append('file', blob, 'cropped.webp');
    try {
      const tk = authHeaders()['Authorization'];
      const res = await fetch(
        `${API_URL}/assets/upload?purpose=gallery&derivedFrom=${id}&width=${c.width}&height=${c.height}`,
        {
          method: 'POST',
          headers: tk ? { Authorization: tk } : undefined,
          body: form,
        },
      );
      if (res.ok) {
        message.success(t('gallery.cropOk', { defaultValue: '已生成裁剪图' }));
        onDone();
      } else {
        message.error(t('gallery.cropErr', { defaultValue: '裁剪失败' }));
      }
    } catch {
      message.error(t('gallery.cropErr', { defaultValue: '裁剪失败' }));
    }
  };

  return (
    <Modal
      open
      title={t('gallery.crop', { defaultValue: '裁剪' })}
      onCancel={onClose}
      onOk={onConfirm}
      okText={t('gallery.cropConfirm', { defaultValue: '裁剪并保存为新图' })}
      width={760}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
        <Button
          icon={<ZoomOutOutlined />}
          onClick={() => setZoom((z) => clampZoom(z / 1.2))}
          disabled={zoom <= 0.2}
        />
        <span style={{ alignSelf: 'center', fontSize: 12, color: '#888' }}>
          {Math.round(zoom * 100)}%
        </span>
        <Button
          icon={<ZoomInOutlined />}
          onClick={() => setZoom((z) => clampZoom(z * 1.2))}
          disabled={zoom >= 5}
        />
      </div>
      <div
        ref={wrapRef}
        style={{
          background: '#222',
          borderRadius: 8,
          overflow: 'auto',
          maxHeight: '60vh',
          display: 'flex',
          justifyContent: 'center',
          userSelect: 'none',
        }}
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
            <div style={{ padding: 48, textAlign: 'center', width: 320 }}>
              <Spin />
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
      <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
        {t('gallery.cropTip', {
          defaultValue: '在图上按住拖动框选区域；点击 +/− 或滚动鼠标中键滚轮可缩放，确认后生成一张新图，原图保留。',
        })}
      </div>
    </Modal>
  );
}
