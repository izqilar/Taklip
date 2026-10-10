import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_URL, STATIC_URL, authHeaders, jsonHeaders, clearSession } from '../../utility';
import { useLayer } from '../../providers/layerContext';

/**
 * 运营端（用户视角）· 请柬事务中心 公共数据层
 *
 * 支撑三个模块（模板字段设计 / 诚邀名单制作 / 请柬批量生成）共用同一套：
 *  - 绝对 `API_URL` + Bearer 鉴权（admin Vite 不代理 /api）；
 *  - `subject` 监督口径（ADMIN 视察某终端用户时 `?subject=` 落到该用户 SELF 作用域）；
 *  - 401 统一清登录态并抛出可分流异常；
 *  - 私密图（private-assets）带鉴权 fetch → Blob 预览。
 */

export type PerStatus = 'pending' | 'ok' | 'failed';

export interface PerResult {
  recordId: string;
  name: string | null;
  status: PerStatus;
  url: string | null;
  error: string | null;
}

export interface ProjectResults {
  projectId: string;
  total: number;
  results: PerResult[];
}

export interface WorkItem {
  id: string;
  title?: string;
  cover?: string | null;
  status?: string;
  pages?: unknown[];
  schema?: any;
  draftSchema?: any;
  updatedAt?: string;
}

export interface TemplateItem {
  id: string;
  name: string;
  ownerType: string;
  isSystem: boolean;
  seq: number;
  version: string;
  fieldCount: number;
}

export interface BatchProjectView {
  id: string;
  locked?: boolean;
  remaining?: number;
}

export interface GuestSelectionView {
  projectId?: string;
  selectedRecordIds?: string[];
}

export interface GuestRow {
  id: string;
  seq: number;
  data: Record<string, string | null>;
}

export interface GuestListRow {
  id: string;
  name: string;
  recordCount: number;
}

/**
 * 静态资源 URL 归一化（运营端专用）。
 *
 * admin 的 Vite **不代理** `/uploads`、`/public` 等后端路径，直接 `<img src="/uploads/x.png">`
 * 会打到 :5174 自身并返回 404。故相对路径一律补 `STATIC_URL` 前缀；
 * `data:` / `blob:` / `http(s):` 原样返回。
 */
export function absAssetUrl(raw?: string | null): string {
  if (!raw) return '';
  if (/^(data:|blob:|https?:)/i.test(raw)) return raw;
  return raw.startsWith('/') ? `${STATIC_URL}${raw}` : raw;
}

/** 统一异常：携带 HTTP 状态与业务 code，供上层做 401/402 分流 */
export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 0, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function handle(res: Response): Promise<void> {
  if (res.status === 401) {
    clearSession();
    throw new ApiError('登录态已失效，请重新登录', 401, 'UNAUTH');
  }
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new ApiError(d?.message || `HTTP ${res.status}`, res.status, d?.code);
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { headers: authHeaders() });
  await handle(res);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(body ?? {}),
  });
  await handle(res);
  return res.json() as Promise<T>;
}

export async function apiDelete<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
    headers: jsonHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  await handle(res);
  return res.json() as Promise<T>;
}

/** 带鉴权的私密图预览（private-assets 不公开暴露，<img src> 直链会 401） */
export function AuthImage({ path, scope, alt }: { path: string; scope: string; alt?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    let obj: string | null = null;
    setSrc(null);
    setErr(false);
    fetch(`${STATIC_URL}${path}${scope || ''}`, { headers: authHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.blob();
      })
      .then((b) => {
        obj = URL.createObjectURL(b);
        if (alive) setSrc(obj);
      })
      .catch(() => {
        if (alive) setErr(true);
      });
    return () => {
      alive = false;
      if (obj) URL.revokeObjectURL(obj);
    };
  }, [path, scope]);
  if (err) return <span style={{ fontSize: 11, color: '#c81e42' }}>预览失败</span>;
  if (!src) return <div style={{ width: 46, height: 62, background: '#f3f4f6', borderRadius: 4 }} />;
  return (
    <img
      src={src}
      alt={alt}
      style={{ width: 46, height: 62, objectFit: 'cover', borderRadius: 4, border: '1px solid #e5e7eb' }}
    />
  );
}

/**
 * 用户视角作用域：ADMIN 视察某终端用户时带 `subject`（服务端 subjectId 口径，等价该用户登录）；
 * 真实 USER 登录运营端（isOwnView）时不带。`readonly` 为观察镜头的只读开关。
 */
export function useSubjectScope() {
  const { objectScope, isOwnView, readonly } = useLayer();
  const subject = isOwnView ? undefined : objectScope?.id;
  const canWrite = isOwnView || !readonly;
  // ★ 必须 memo：q/subjBody 会被下游 hook 作为依赖，未 memo 会导致 effect 每轮重建 → 无限轮询
  const q = useCallback(
    (path: string) =>
      subject
        ? `${path}${path.includes('?') ? '&' : '?'}subject=${encodeURIComponent(subject)}`
        : path,
    [subject],
  );
  const subjBody = useMemo(() => (subject ? { subject } : {}), [subject]);
  const scopeForImage = useMemo(
    () => (subject ? `?subject=${encodeURIComponent(subject)}` : ''),
    [subject],
  );
  return { subject, canWrite, q, subjBody, scopeForImage };
}
