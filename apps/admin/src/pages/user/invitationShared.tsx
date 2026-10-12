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
  /**
   * 已勾选但剩余渲染额度耗尽、尚未渲染（B5）。
   * 既不是成功也不是失败 —— UI 需区别于红色失败态，提示「待解锁 / 需购买人次」。
   * 后端恒返回布尔值；已渲染行与失败行恒为 false。
   */
  paywalled?: boolean;
  /** 该记录已被「重新生成」的次数（后端按历史 RERENDER job 推导，清理历史后归零） */
  rerenders?: number;
  /** 任务队列名（后端按生成任务分组回填，§变量绑定 优化2） */
  taskName?: string;
  /** 宾客信息字段（label/value 展示对，§变量绑定 优化4） */
  fields?: { key: string; label: string; value: string }[];
  /** 原始记录数据（编辑弹窗回填用，对应名单行 data，§变量绑定 优化2） */
  data?: Record<string, unknown>;
}

export interface ProjectResults {
  projectId: string;
  total: number;
  rerenderLimit?: number;
  results: PerResult[];
  /** 已编辑记录 id 列表（§变量绑定 优化2 上限闸门） */
  editedRecordIds?: string[];
  /** 可编辑记录上限（§变量绑定 优化2 上限闸门） */
  editLimit?: number;
  /** 购买重渲额度（item3：服务端持久化，超出免费上限后消耗的购买次数） */
  purchasedRerender?: number;
  /** 全局剩余渲染额度（超出上限后的确认/耗尽弹窗以此为准） */
  remaining?: number;
}

/** 每条记录重渲染次数上限（与后端 RERENDER_LIMIT 保持一致） */
export const RERENDER_LIMIT = 5;

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
  state?: 'DRAFT' | 'LOCKED' | 'PAID';
  freeSampleCap?: number;
  purchasedHeadcount?: number;
  totalRenderable?: number;
  alreadyRendered?: number;
  purchasedRerender?: number;
  remaining?: number;
  locked?: boolean;
  /** 所属宾客名单 id（「配对记录」选中其他项目时，按它拉逐人预览的记录源） */
  listId?: string;
  /** 模板名（GET /invitations/projects 列表项，「配对记录」行卡展示） */
  templateTitle?: string;
  /** 名单名（同上） */
  listName?: string;
  /** 配对数（同上） */
  pairCount?: number;
  /** 任务编号（cmv，同上） */
  projectCode?: string;
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
  /** 非 2xx 响应体原文（如 402 QUOTA_EXCEEDED 的 { remaining }），供上层重算缺购缺口 */
  body?: unknown;
  constructor(message: string, status = 0, code?: string, body?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

async function handle(res: Response): Promise<void> {
  if (res.status === 401) {
    clearSession();
    throw new ApiError('登录态已失效，请重新登录', 401, 'UNAUTH');
  }
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new ApiError(d?.message || `HTTP ${res.status}`, res.status, d?.code, d);
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

/**
 * 编辑单条宾客记录的人次字段（§变量绑定 优化2）。
 * POST /api/invitations/projects/:id/records/:recordId/edit
 */
export async function editInvitationRecord(
  projectId: string,
  recordId: string,
  data: Record<string, string>,
): Promise<{ recordId: string; ok: boolean }> {
  return apiPost<{ recordId: string; ok: boolean }>(
    `/invitations/projects/${projectId}/records/${recordId}/edit`,
    data,
  );
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

/**
 * 服务商（SP）作用域：在监督 `subject` 基础上叠加 ORG/CLIENT 归属（ownerType/clientId）。
 *
 * 与服务端 `guest-list` / `invitation` 控制器的 `scope(req, ownerType, clientId, subject)` 同口径：
 *  - 真实 SP 登录（isOwnView，subject 空）：仅凭自身 JWT 身份即可用 `ownerType=ORG/CLIENT`；
 *  - ADMIN 监督某 SP（subject 非空）：`effUser(req, subject)` 把 user 改写为被视察 SP
 *    → `isSp=true` → `ownerType=ORG/CLIENT` 合法（原 SP 页硬编码 ownerType 不带 subject，
 *    对 ADMIN 主体恒抛 `FORBIDDEN_OWNER_TYPE` 400，根因在此）。
 *
 * 用法：`scopeQuery('/guest-lists', ownerType, clientId)` 拼 query；`scopeBody` 拼 body。
 */
export function useSpScope() {
  const { subject } = useSubjectScope();
  const scopeQuery = useCallback(
    (path: string, ownerType?: string, clientId?: string) => {
      const params = new URLSearchParams();
      if (ownerType) params.set('ownerType', ownerType);
      if (clientId) params.set('clientId', clientId);
      if (subject) params.set('subject', subject);
      const qs = params.toString();
      // ★ 若 path 已含 '?'（如 '/guest-lists/:id/records?page=1&size=200'、'/invitations/jobs?projectId='），
      //   必须用 '&' 接续，否则双 '?' 会把 ownerType/clientId/subject 整体吞进上一个参数值里（如 size=200?ownerType=ORG），
      //   导致 SP 视角与作用域监督窗口的名单记录拉取 / 续跑失败项静默失效。对齐 useSubjectScope.q 的既有合并口径。
      return qs ? `${path}${path.includes('?') ? '&' : '?'}${qs}` : path;
    },
    [subject],
  );
  const scopeBody = useMemo(() => (subject ? { subject } : {}), [subject]);
  /**
   * 拼图用的 query 串（含 ownerType/clientId/subject，不含 path 前缀的 `?`）。
   * `AuthImage` 组件用 `${STATIC_URL}${path}${scope}` 拼接私密图地址，故返回 `?...` 形式。
   * 无任一参数时返回空串（用户视角不带 subject 时退化为 ''，与改造前一致）。
   */
  const scopeForImage = useCallback(
    (ownerType?: string, clientId?: string) => {
      const params = new URLSearchParams();
      if (ownerType) params.set('ownerType', ownerType);
      if (clientId) params.set('clientId', clientId);
      if (subject) params.set('subject', subject);
      const qs = params.toString();
      return qs ? `?${qs}` : '';
    },
    [subject],
  );
  return { subject, scopeQuery, scopeBody, scopeForImage };
}
