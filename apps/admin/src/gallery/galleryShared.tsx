/**
 * 运营端图库「共享逻辑 + 视图」模块。
 *
 * 同时被两处复用（避免重复实现、保证两端行为完全一致）：
 *  - apps/admin/src/pages/gallery/GalleryPage.tsx   → 我的图库整页
 *  - apps/admin/src/user/GalleryPickerModal.tsx      → 编辑器内「选择图片」弹窗
 *
 * 这里集中图库的数据拉取、配额(used/limit)、上传(WebP 预压缩 + 配额 429 拦截)、
 * 删除(级联保护)、裁剪(框选+可缩放) 以及卡片 / 预览弹窗 / 裁剪弹窗视图。
 * 编辑器统一从这里取「添加 / 删除 / 裁剪」能力，保证整页与编辑器内弹窗行为一致。
 *
 * 配额口径与 web 端 apps/web/src/user/galleryParts.tsx 同源：
 *  - 免费用户 6 张（USER_GALLERY_LIMIT[vip=0]=4？以服务端为准；前端只渲染 used/limit）
 *  - 其余用户(会员/服务商/代理)按已购/牌级上限，由服务端 /assets/quota 返回
 *  - 达上限时上传按钮禁用 + 「去扩容」入口；裁剪「保存为新图」在配额满时拦截
 *
 * ⚠️ 关键：所有写操作(列表/上传/删除/裁剪)都通过 withSubject(base, subject) 拼接待视察对象，
 * 使运营端「用户视角」编辑时被视察账号的图库数据，与 TA 自己登录时严格一致。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, message, Progress, Empty, Spin, Tooltip } from 'antd';
import { UploadOutlined, DeleteOutlined, EyeOutlined, ScissorOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons';
import { API_URL, authHeaders, getStoredUser } from '../utility';
import { t } from '../i18n/t';
import { useLayer } from '../providers/layerContext';

/** 图库单图硬上限 2MB（与后端 MAX_GALLERY_BYTES 一致；前端预压缩保证达标） */
export const MAX_GALLERY_BYTES = 2 * 1024 * 1024;
/** 最长边上限，防超分辨率解压炸弹 */
export const MAX_DIM = 4096;

export type GalleryLayer = 'provider' | 'user' | 'agent';

export interface GalleryAsset {
  id: string;
  name: string;
  type: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  createdAt: string;
  /** 被作品使用的次数（编辑器选择器把本图库图转存为 media 副本嵌入作品即计 1）。>0 时禁止删除。 */
  usedInWorks?: number;
  /** 内容哈希：裁剪「原位替换原图」后让缩略图缓存失效并刷新（与后端 sha256 一致） */
  sha256?: string;
}

export interface Quota {
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

export const fmtSize = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};

/**
 * 视察视角主体（与 dataProvider.withSubject 同口径，但仅 ADMIN 生效）：
 * ADMIN 在「服务商/代理商/用户视角」下选中的被视察对象；其余角色自身登录时为空，
 * 后端按 req.user.id 处理，即「谁登录看谁的数据」。
 * 用于让运营端图库与被视察账号自己登录时的数据严格一致。
 */
export function useInspectSubject(): string | null {
  const { objectScope } = useLayer();
  const role = getStoredUser<{ role?: string }>()?.role;
  return role === 'ADMIN' ? objectScope?.id ?? null : null;
}

/** 鉴权拉取私有图并生成本地 objectURL（带缓存，组件卸载统一回收） */
export function usePrivateImage(subject?: string | null) {
  const cache = useRef<Map<string, string>>(new Map());
  const fetchUrl = useCallback(
    async (id: string, rev?: string): Promise<string> => {
      // rev（内容哈希）变化 → 缓存键 + URL 查询串同步变化，使「裁剪→原位替换原图」后缩略图刷新
      const key = rev ? `${id}:${rev}` : id;
      const hit = cache.current.get(key);
      if (hit) return hit;
      const res = await fetch(withSubject(`${API_URL}/assets/${id}/file${rev ? `?v=${rev}` : ''}`, subject), {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('load failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      cache.current.set(key, url);
      return url;
    },
    [subject],
  );
  const revokeAll = useCallback(() => {
    cache.current.forEach((u) => URL.revokeObjectURL(u));
    cache.current.clear();
  }, []);
  return { fetchUrl, revokeAll };
}

/**
 * 把视察对象拼到 URL 查询串。
 * 关键：base 已含 `?` 时用 `&` 衔接，否则用 `?` —— 否则会出现 `?a=1?subject=`（双重问号），
 * 浏览器 / NestJS 仅解析第一个 `?`，导致 subject 被吞进上一个参数值里、永远取不到，
 * 视察视角的列表/上传/裁剪请求就退化成「以 ADMIN 自身身份」执行（返回 ADMIN 自己的数据）。
 * 无 subject 时原样返回 base，保证自助视角 URL 与 web 端字面一致。
 */
export function withSubject(base: string, subject?: string | null): string {
  if (!subject) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}subject=${encodeURIComponent(subject)}`;
}

function safeJson(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** 图库数据 + 操作（列表 / 配额 / 上传 / 删除 / 裁剪后重载），页面与弹窗共用 */
export function useGalleryData(subject: string | null, layer?: GalleryLayer) {
  const [list, setList] = useState<GalleryAsset[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [cropId, setCropId] = useState<string | null>(null);
  const { fetchUrl, revokeAll } = usePrivateImage(subject);
  // 切换视察对象时清空 objectURL 缓存：旧对象的内存 blob 不可复用到新对象
  useEffect(() => {
    revokeAll();
  }, [subject, revokeAll]);

  // 扩容落地页：独立「扩容套餐页」（文档要求跳转独立页，已实现 UpgradePage 占位）
  const upgradeHref =
    layer === 'provider' ? '/sp/upgrade' : layer === 'agent' ? '/agent/upgrade' : '/user/upgrade';

  /** silent=true 时不切换 loading 态、不弹错误提示（用于焦点/可见性静默刷新，避免闪烁与噪音） */
  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [lRes, qRes] = await Promise.all([
          fetch(withSubject(`${API_URL}/assets?type=image&galleryOnly=1`, subject), {
            headers: authHeaders(),
          }),
          fetch(withSubject(`${API_URL}/assets/quota`, subject), { headers: authHeaders() }),
        ]);
        if (lRes.ok) setList((await lRes.json()) as GalleryAsset[]);
        if (qRes.ok) setQuota((await qRes.json()) as Quota);
      } catch {
        if (!silent) message.error(t('gallery.loadErr', { defaultValue: '图库加载失败' }));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [subject],
  );

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
      revokeAll();
    };
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
        xhr.open(
          'POST',
          withSubject(
            `${API_URL}/assets/upload?purpose=gallery&width=${width}&height=${height}`,
            subject,
          ),
        );
        const tk = authHeaders()['Authorization'];
        if (tk) xhr.setRequestHeader('Authorization', tk);
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
    [load, subject],
  );

  /** 真正执行删除（已过确认环节）。inUse 时带 force=1，由用户确认后强制删除。 */
  const doDelete = useCallback(
    async (id: string, force = false) => {
      try {
        const qs = `${force ? '?force=1' : ''}${subject ? `${force ? '&' : '?'}subject=${encodeURIComponent(subject)}` : ''}`;
        const res = await fetch(`${API_URL}/assets/${id}${qs}`, {
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
    [load, subject],
  );

  /**
   * 删除入口：先二次确认再执行。
   * - 普通图片：常规二次确认（说明会同时删除磁盘文件，不可恢复）。
   * - 被作品使用（usedInWorks>0）：额外点名作品数量，警示删除后作品内该图将失效。
   *   注：服务端仍以 409 IN_USE 兜底硬保护，此处确认仅用于「用户已知情」的软性预警。
   */
  const onDelete = useCallback(
    (a: GalleryAsset) => {
      const inUse = (a.usedInWorks ?? 0) > 0;
      const name = a.name || t('gallery.thisImage', { defaultValue: '该图片' });
      Modal.confirm({
        title: t('gallery.delConfirmTitle', { defaultValue: '确认删除图片？' }),
        content: inUse
          ? t('gallery.delConfirmInUse', {
              count: a.usedInWorks ?? 0,
              defaultValue: `「${name}」正被 ${a.usedInWorks ?? 0} 个作品使用。删除后图库图片与磁盘文件将被移除，作品内该图片可能显示异常。`,
            })
          : t('gallery.delConfirm', {
              defaultValue: `「${name}」将从图库和磁盘中永久删除，且无法恢复。`,
            }),
        okText: t('gallery.delOk', { defaultValue: '删除' }),
        okButtonProps: { danger: true },
        cancelText: t('common:button.cancel', { defaultValue: '取消' }),
        onOk: () => doDelete(a.id, inUse),
      });
    },
    [doDelete],
  );

  const full = quota ? quota.used >= quota.limit : false;

  return {
    list,
    quota,
    loading,
    uploading,
    uploadPct,
    previewId,
    setPreviewId,
    cropId,
    setCropId,
    subject,
    full,
    upgradeHref,
    fetchUrl,
    revokeAll,
    load,
    upload: doUpload,
    remove: doDelete,
    confirmRemove: onDelete,
  };
}

/**
 * 「作品引用状态」标签：已使用（品牌红）/ 未使用（中性灰）。
 *
 * 视觉规格与用户端 apps/web/src/user/galleryParts.tsx 的 UsageTag **逐像素一致**
 * （圆角 10 / 11px / 600 / 行高 16 / 内边距 1px 8px / 圆点 6px / 同色值），
 * 两端改动必须同步，否则卡片状态标签会出现跨端差异。
 */
export function UsageTag({ inUse, count }: { inUse: boolean; count: number }) {
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
        onClick={onSelect ?? onPreview}
        title={asset.name}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <UsageTag inUse={inUse} count={asset.usedInWorks ?? 0} />
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
          <IconBtn title="删除" danger onClick={onDelete}>
            <DeleteOutlined />
          </IconBtn>
        </div>
      </div>
    </div>
  );
}

export function IconBtn({
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

export function PreviewModal({
  id,
  fetchUrl,
  onClose,
}: {
  id: string | null;
  fetchUrl: (id: string, rev?: string) => Promise<string>;
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
    e.preventDefault();
    setZoom((z) => clampZoom(z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
  };
  return (
    <Modal open title={t('gallery.preview', { defaultValue: '预览' })} footer={null} onCancel={onClose} width={760} zIndex={1200}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
        <button
          type="button"
          onClick={() => setZoom((z) => clampZoom(z / 1.2))}
          disabled={zoom <= 0.2}
          style={zoomBtnStyle}
        >
          <ZoomOutOutlined />
        </button>
        <span style={{ alignSelf: 'center', fontSize: 12, color: '#888' }}>{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          onClick={() => setZoom((z) => clampZoom(z * 1.2))}
          disabled={zoom >= 5}
          style={zoomBtnStyle}
        >
          <ZoomInOutlined />
        </button>
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

const zoomBtnStyle: React.CSSProperties = {
  border: '1px solid #e0e0e0',
  background: '#fff',
  borderRadius: 6,
  width: 28,
  height: 28,
  cursor: 'pointer',
  color: '#555',
};

/** 裁剪选区最小边长（px，显示坐标）；与锚点拖拽的边界夹取共用 */
const MIN_SEL = 8;

/** 裁剪选区的 8 个调整锚点标识：nw/n/ne/e/se/s/sw/w */
type CropHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** 锚点 → 鼠标光标 + 在选区内的相对位置（0..1 比例），与 web 端保持一致 */
const CROP_HANDLES: { h: CropHandle; fx: number; fy: number; cursor: string }[] = [
  { h: 'nw', fx: 0, fy: 0, cursor: 'nwse-resize' },
  { h: 'n', fx: 0.5, fy: 0, cursor: 'ns-resize' },
  { h: 'ne', fx: 1, fy: 0, cursor: 'nesw-resize' },
  { h: 'e', fx: 1, fy: 0.5, cursor: 'ew-resize' },
  { h: 'se', fx: 1, fy: 1, cursor: 'nwse-resize' },
  { h: 's', fx: 0.5, fy: 1, cursor: 'ns-resize' },
  { h: 'sw', fx: 0, fy: 1, cursor: 'sw-resize' },
  { h: 'w', fx: 0, fy: 0.5, cursor: 'ew-resize' },
];

/** 轻量裁剪：图片按显示尺寸框选区域，确认后裁出 WebP 派生新图（不破坏原图）。
 *  支持缩放：放大/缩小按钮 + 鼠标中键滚轮；框选坐标始终基于「舞台自身渲染矩形」换算，
 *  因此任意缩放级别下选区都能正确映射回原图像素。 */
export function CropModal({
  id,
  fetchUrl,
  subject,
  onClose,
  onDone,
  quota,
}: {
  id: string | null;
  fetchUrl: (id: string, rev?: string) => Promise<string>;
  subject?: string | null;
  onClose: () => void;
  onDone: () => void;
  /** 图库配额（used/limit）；用于「保存为新图」在配额满时拦截并提示，不触发裁剪 */
  quota?: Quota | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  // 缩放=1 时的 contain 适配尺寸；实际显示尺寸 = base * zoom
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

  // 新建选区：按下点落在既有选区内部 → 整体移动；否则重画
  const onDown = (e: React.MouseEvent) => {
    if (!base) return;
    const p = localPoint(e);
    if (!p) return;
    if (sel && p.x >= sel.x && p.x <= sel.x + sel.w && p.y >= sel.y && p.y <= sel.y + sel.h) {
      drag.current = { mode: 'move', sx: p.x, sy: p.y, orig: { ...sel } };
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
      const nx = Math.max(0, Math.min(rect.width - d.orig.w, p.x - d.sx + d.orig.x));
      const ny = Math.max(0, Math.min(rect.height - d.orig.h, p.y - d.sy + d.orig.y));
      setSel({ x: nx, y: ny, w: d.orig.w, h: d.orig.h });
      return;
    }
    if (d.mode === 'resize' && d.orig && d.handle) {
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

  // —— 8 个调整锚点：按下时冻结「对手边」，拖动只改两条边（与 web 端逻辑一致）——
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
      message.warning(t('gallery.cropHint', { defaultValue: '请先框选裁剪区域' }));
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
      message.error(t('gallery.cropErr', { defaultValue: '裁剪失败' }));
      return null;
    }
    return { blob, w: c.width, h: c.height };
  };

  // 「裁剪」：直接替换原图（不占配额，配额满也可点）
  const onCropReplace = async () => {
    const r = await cropToBlob();
    if (!r) return;
    const form = new FormData();
    form.append('file', r.blob, 'cropped.webp');
    try {
      const tk = authHeaders()['Authorization'];
      const res = await fetch(
        withSubject(`${API_URL}/assets/${id}/replace?width=${r.w}&height=${r.h}`, subject),
        { method: 'POST', headers: tk ? { Authorization: tk } : undefined, body: form },
      );
      if (res.ok) {
        message.success(t('gallery.cropReplaced', { defaultValue: '已替换原图' }));
        onDone();
      } else {
        message.error(t('gallery.cropErr', { defaultValue: '裁剪失败' }));
      }
    } catch {
      message.error(t('gallery.cropErr', { defaultValue: '裁剪失败' }));
    }
  };

  // 「保存为新图」：生成裁剪后的新图（占配额）；配额不足时提示且不裁剪
  const onSaveAsNew = async () => {
    if (quota && quota.used >= quota.limit) {
      message.error(
        t('gallery.cropQuotaHit', {
          defaultValue: '你可使用的图片数量达到最大数量限制，请购买服务或删除一张图片。',
        }),
      );
      return;
    }
    const r = await cropToBlob();
    if (!r) return;
    const form = new FormData();
    form.append('file', r.blob, 'cropped.webp');
    try {
      const tk = authHeaders()['Authorization'];
      const res = await fetch(
        withSubject(
          `${API_URL}/assets/upload?purpose=gallery&derivedFrom=${id}&width=${r.w}&height=${r.h}`,
          subject,
        ),
        { method: 'POST', headers: tk ? { Authorization: tk } : undefined, body: form },
      );
      if (res.ok) {
        message.success(t('gallery.cropOk', { defaultValue: '已生成裁剪图' }));
        onDone();
      } else if (res.status === 429) {
        message.error(
          t('gallery.cropQuotaHit', {
            defaultValue: '你可使用的图片数量达到最大数量限制，请购买服务或删除一张图片。',
          }),
        );
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
      zIndex={1200}
      footer={[
        <button key="cancel" type="button" onClick={onClose} style={modalBtnStyle}>
          {t('common:button.cancel', { defaultValue: '取消' })}
        </button>,
        <button
          key="replace"
          type="button"
          onClick={onCropReplace}
          style={{ ...modalBtnStyle, color: '#D24830', borderColor: '#D24830' }}
        >
          {t('gallery.cropReplace', { defaultValue: '裁剪' })}
        </button>,
        <button
          key="save"
          type="button"
          onClick={onSaveAsNew}
          style={{ ...modalBtnStyle, background: '#D24830', borderColor: '#D24830', color: '#fff' }}
        >
          {t('gallery.cropSaveNew', { defaultValue: '保存为新图' })}
        </button>,
      ]}
      width={760}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
        <button type="button" onClick={() => setZoom((z) => clampZoom(z / 1.2))} disabled={zoom <= 0.2} style={zoomBtnStyle}>
          <ZoomOutOutlined />
        </button>
        <span style={{ alignSelf: 'center', fontSize: 12, color: '#888' }}>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom((z) => clampZoom(z * 1.2))} disabled={zoom >= 5} style={zoomBtnStyle}>
          <ZoomInOutlined />
        </button>
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
                  e.stopPropagation();
                  onDown(e);
                }}
              />
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
      <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
        {t('gallery.cropTip', {
          defaultValue:
            '在图上按住拖动框选区域；拖动选区四角/四边锚点可精细调整范围，拖动选区内部可整体移动；点击 +/− 或滚动鼠标中键滚轮可缩放。「裁剪」直接替换原图（不占配额），「保存为新图」生成新图并占配额（配额满时不可用）。',
        })}
      </div>
    </Modal>
  );
}

const modalBtnStyle: React.CSSProperties = {
  padding: '4px 12px',
  borderRadius: 6,
  border: '1px solid #d9d9d9',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 14,
};
