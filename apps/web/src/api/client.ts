/**
 * API 客户端 — 封装与 NestJS 后端的 HTTP 通信。
 * 自动携带 JWT Authorization header。
 */

import type { BackgroundMusic, GuestFieldDef } from '@h5design/core';

/**
 * 身份漂移守卫（静态引入安全：它对 client 只有「类型依赖」，运行时不反向引用，
 * 因此不存在 ESM 循环初始化问题；它与 client 之间的运行时公共依赖都在 ./session）。
 */
import {
  ROLE_MISMATCH_CODE,
  IDENTITY_CHANGED_MESSAGE,
  reportFromServerIdentity,
} from '../store/identityDrift';

const BASE_URL = ''; // 开发期走 vite proxy，生产期走 nginx 反代

/**
 * 结构化 API 错误：携带 HTTP 状态码与服务端消息，供上层按状态码给出精确文案
 *（例如 401=账号密码错误、429=限流、5xx=服务端异常），避免把所有失败都误报成「账号密码错误」。
 */
export class ApiError extends Error {
  statusCode: number;
  serverMessage?: string;
  constructor(statusCode: number, message: string, serverMessage?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.serverMessage = serverMessage;
  }
}

export type UserRole = 'USER' | 'SERVICE_PROVIDER' | 'AGENT' | 'ADMIN';

/** 服务商复合服务子角色（User.serviceRoles 为 1..n 列表，仅 role=SERVICE_PROVIDER 时有意义） */
export type ServiceRole = 'DESIGN' | 'PHOTO' | 'VENUE' | 'FLORAL' | 'STEWARD' | 'PERFORM';

/** 入驻时可选服务类型（前端展示用；value 与后端 ServiceRole 枚举一一对应） */
export const SERVICE_ROLES: { value: ServiceRole; labelKey: string }[] = [
  { value: 'DESIGN', labelKey: 'common:providers.design.name' },
  { value: 'PHOTO', labelKey: 'common:providers.photo.name' },
  { value: 'VENUE', labelKey: 'common:providers.venue.name' },
  { value: 'FLORAL', labelKey: 'common:providers.floral.name' },
  { value: 'STEWARD', labelKey: 'common:providers.ritual.name' },
  { value: 'PERFORM', labelKey: 'common:providers.show.name' },
];

export interface UserInfo {
  id: string;
  phone: string | null;
  nickname: string | null;
  avatar: string | null;
  realName: string | null;
  bio: string | null;
  email: string | null;
  vipLevel: number;
  locale: string;
  role: UserRole;
  /** 服务商复合服务子角色（已审核通过） */
  serviceRoles: ServiceRole[];
  /** 服务商申请的额外子角色（正在审核中） */
  pendingServiceRoles?: ServiceRole[];
  /** 服务商资质审核状态（混合审核模型；仅 role=SERVICE_PROVIDER 时有意义） */
  providerStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  /** 实名认证状态（顶栏账号胶囊「已实名/未实名」标签需要，登录响应带回） */
  realNameStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  /** 角色管理管线（P0）：代理商管辖区域 */
  regionId?: string | null;
  agentId?: string | null;
  regionPath?: string | null;
  /** 账户启停状态（ACTIVE / DISABLED） */
  status?: 'ACTIVE' | 'DISABLED';
  /** 微信 openid（第三方账号绑定占位：有值即视为已绑定微信） */
  wxOpenid?: string | null;
  /** 身份证号（实名认证；账户详情「身份认证资料」区块使用） */
  idCard?: string | null;
  /** 身份证人像面 / 国徽面影像 URL */
  idCardFront?: string | null;
  idCardBack?: string | null;
  /**
   * 登录后应落地的工作台（服务端 ROLE_HOME 单一真值，登录/注册/刷新令牌均带回）。
   * origin 为逻辑端标识：web = 用户端(:5173)；admin = 运营端(:5174)。
   * 与本端一致时内部跳转，不一致时跨端桥接（?ticket= 一次性票据）。
   */
  home?: { origin: 'web' | 'admin'; path: string };
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserInfo;
  /**
   * 登录后应落地的工作台（服务端 ROLE_HOME 单一真值，与 user 平级下发）。
   * authStore 会把它并入 user 后再落 localStorage，使刷新后仍可读。
   */
  home?: UserInfo['home'];
}

export interface ProjectListItem {
  id: string;
  title: string;
  cover: string | null;
  status: 'draft' | 'published';
  version: number;
  createdAt: string;
  updatedAt: string;
  publishCode?: string | null;
  /** 完整作品 Schema（用于仪表盘缩略图渲染第一页） */
  schema: unknown;
}

export interface ProjectDetail extends ProjectListItem {
  schema: unknown;
}

export type TemplateStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'TAKEN_DOWN';

export interface TemplateListItem {
  id: string;
  name: string;
  category: string;
  tags: string[];
  cover: string | null;
  isOfficial: boolean;
  useCount: number;
  price: number;
  currency: string;
  schema: unknown;
}

/** 后端完整返回的模板对象（含作者、审核字段） */
export interface TemplateDetail {
  id: string;
  name: string;
  category: string;
  tags: string[];
  cover: string | null;
  schema: unknown;
  isOfficial: boolean;
  useCount: number;
  price: number;
  currency: string;
  authorId: string | null;
  status: TemplateStatus;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author?: {
    id: string;
    nickname: string | null;
    avatar: string | null;
    phone?: string | null;
  } | null;
}

/** 提交模板到审核队列的请求体 */
export interface CreateTemplateRequest {
  name: string;
  category: string;
  tags?: string[];
  schema: unknown;
  cover?: string;
  price?: number;
  currency?: string;
}

/** 审核决定 */
export type ReviewDecision = 'APPROVED' | 'REJECTED';

/** 审核请求体 */
export interface ReviewTemplateRequest {
  decision: ReviewDecision;
  reviewNote?: string;
}

/** 付费模板购买订单 */
export interface TemplateOrderInfo {
  id: string;
  buyerId: string;
  templateId: string;
  amount: number; // 实付金额（分）
  platformFee: number; // 平台抽成（分）
  designerIncome: number; // 服务商实得（分）
  status: string; // paid | refunded
  createdAt: string;
  template?: {
    name: string;
    cover: string | null;
    category: string;
    price: number;
    currency: string;
  } | null;
}

/** 服务商钱包 / 收益 */
export interface WalletInfo {
  id: string;
  providerId: string;
  balance: number; // 可提现余额（分）
  totalIncome: number; // 累计收入（分）
  withdrawn: number; // 已提现（分）
  updatedAt: string;
}

/** 提现记录 */
export interface WithdrawalInfo {
  id: string;
  providerId: string;
  walletId: string;
  amount: number; // 提现金额（分）
  currency: string;
  status: string; // pending | paid | failed
  createdAt: string;
  updatedAt: string;
}

/** 模板违规申诉 */
export interface AppealInfo {
  id: string;
  templateId: string;
  providerId: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  template?: {
    id: string;
    name: string;
    category: string;
    cover: string | null;
    status: string;
  } | null;
  provider?: {
    id: string;
    nickname: string | null;
    avatar: string | null;
    phone?: string | null;
  } | null;
}

/** 申诉审核决定 */
export type AppealDecision = 'approved' | 'rejected';

export interface PublishResult {
  id: string;
  title: string;
  status: string;
  publishCode: string;
  url: string;
}

export interface AssetItem {
  id: string;
  url: string;
  type: string;
  size: number;
  width: number | null;
  height: number | null;
  createdAt: string;
}

/* ── 批量请柬（名单 / 项目 / 任务）── 字段口径见规范 §9/§10 ── */
export interface GuestListRow {
  id: string;
  name: string;
  ownerType: string;
  clientId: string | null;
  recordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GuestRecordPage {
  listId: string;
  page: number;
  size: number;
  total: number;
  /** 名单字段定义（名单创建时快照的模板字段，如婚礼模板为 ext_husband/ext_wife）；服务人员名单弹窗据此渲染表头与取数 */
  columnDefs?: GuestFieldDef[];
  records: { id: string; seq: number; data: Record<string, string | null> }[];
}

export interface BatchProjectView {
  id: string;
  state: 'DRAFT' | 'LOCKED' | 'PAID';
  freeRendered: number;
  paidRendered: number;
  purchasedHeadcount: number;
  totalRenderable: number;
  alreadyRendered: number;
  remaining: number;
  locked: boolean;
}

export interface GuestSelectionView {
  projectId: string;
  listId: string;
  selectedRecordIds: string[];
}

export interface RenderJobRow {
  id: string;
  projectId: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL';
  mode: 'FREE_SAMPLE' | 'PAID' | 'RERENDER';
  progress: number;
  total: number;
  error: string | null;
  createdAt: string;
}

/** 项目级逐人渲染状态（跨 job 聚合，§18.3） */
export interface ProjectResultRow {
  recordId: string;
  name: string | null;
  status: 'ok' | 'failed' | 'pending';
  url: string | null;
  error: string | null;
  /**
   * 该宾客「尚未渲染且已超出剩余额度」→ 需购买人次（后端 L1264 恒返回布尔值）。
   * 已渲染行 / 失败行恒为 false（失败行配额已回退，可续跑/重渲）。
   * UI 上须区别于 status:'failed'：paywalled 既无图也不是失败，不应复用失败态红色样式。
   */
  paywalled?: boolean;
}

export interface ProjectResultsView {
  projectId: string;
  total: number;
  results: ProjectResultRow[];
}

/** 生成前变量匹配体检（D4 反转：含映射改指向，§2.5） */
export interface BindingHealth {
  projectId: string;
  templateId: string;
  listId: string;
  mapping: Record<string, string>;
  /** 模板变量视图（S5 新增） */
  vars: { key: string; name?: string | null; label: string; elementIds: string[]; isStandard?: boolean }[];
  /** 名单可用列（S5 新增，D 模式候选项） */
  candidates: { key: string; label: string }[];
  matched: { key: string; label: string; name?: string | null }[];
  missing: { key: string; label: string; name?: string | null; critical: boolean; remapTargets: string[] }[];
  emptyHits: { key: string; label: string; rows: number }[];
  unusedFields: { key: string; label: string }[];
  /** 字体覆盖体检（非阻断，琥珀色建议）：所选字体未覆盖实际数据字符 */
  fontCoverage: {
    elementId: string;
    fontFamily: string;
    bindingKey?: string;
    missingChars: string[];
    missingCodepoints: number[];
    affectedRecords: number;
    totalRecords: number;
    /** true=仅维吾尔文缺字，已由整段确定性回退处理（设计预期，非缺陷） */
    uyghurFallback?: boolean;
  }[];
  blocked: boolean;
  /** S5 新增：孤儿变量（模板有、名单无关） */
  orphaned: string[];
  /** S5 新增：被取代字段（旧映射指向已重命名的列） */
  superseded: string[];
}

/**
 * 令牌 / 本地用户快照的读写已迁到 ./session（单一真值源），
 * 这里统一再导出，保持既有 import 路径不变（authStore 等大量依赖此处的导出）。
 */
import {
  getToken,
  getStoredToken,
  getRefreshToken,
  getStoredUser,
  setStoredUser,
  setTokens,
  clearTokens,
} from './session';

export {
  getToken,
  getStoredToken,
  getRefreshToken,
  getStoredUser,
  setStoredUser,
  setTokens,
  clearTokens,
};

/** ------ ↑ 会话存储 ↓ 业务 API ------ */

/**
 * 用 refresh token 换取新的 access/refresh token。
 * 成功返回 true 并写入 localStorage；失败（无 refresh token / 已过期）返回 false。
 * 注意：这里用裸 fetch，避免与 request 内部的 401 逻辑形成递归。
 */
async function refreshAccessToken(): Promise<boolean> {
  const rt = getRefreshToken();
  if (!rt) return false;
  try {
    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data?.accessToken) return false;
    setTokens(data.accessToken, data.refreshToken ?? rt);
    // home 与 user 平级下发；刷新令牌时若新响应带回则更新，否则沿用旧值（别把它抹掉）
    if (data.user) {
      setStoredUser(data.home ? { ...data.user, home: data.home } : { ...getStoredUser(), ...data.user });
    }
    return true;
  } catch {
    return false;
  }
}

// getStoredUser / setStoredUser 的实现已迁到 ./session（见文件顶部批量再导出）。

/** 运营端（管理后台）基址：跨端跳转统一从这里取，避免多处硬编码漂移 */
export const ADMIN_BASE = 'http://localhost:5174';

/**
 * 向服务端申请一次性跨端票据（需已登录）。
 * 用于把登录态从 Web 端安全带到运营端，避免把 JWT 明文放进 URL。
 * 失败返回 null（调用方应降级为不带登录态的跳转，让用户到对端重新登录）。
 */
export async function issueBridgeTicket(): Promise<string | null> {
  const token = getStoredToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/auth/ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.ticket ?? null;
  } catch {
    return null;
  }
}

/**
 * 构造携带登录态的运营端 URL（?ticket=<一次性票据>）。
 * 运营端(5174) 的 bootstrap.ts 在启动最早阶段用票据调 /api/auth/exchange
 * 换取登录令牌并写入它自己的登录态存储（h5_admin_token / h5_admin_user），
 * 实现 Web 端 → 运营端免二次登录（跨端 SSO 桥接）。
 */
export async function buildAdminUrl(path = ''): Promise<string> {
  const ticket = await issueBridgeTicket();
  return ticket
    ? `${ADMIN_BASE}${path}?ticket=${encodeURIComponent(ticket)}`
    : `${ADMIN_BASE}${path}`;
}

async function request<T>(
  path: string,
  options?: RequestInit,
  _retry = false,
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    headers,
    ...options,
  });

  // 访问令牌过期（401）：尝试用 refresh token 静默刷新后重试一次，避免用户被静默登出
  if (res.status === 401 && !_retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return request<T>(path, options, true);
    }
    // 刷新也失败：清理整个会话（含 user_info），使 UI 登录态与存储一致
    clearTokens();
    localStorage.removeItem('user_info');
    throw new ApiError(401, 'API 401: 登录已失效，请重新登录', '登录已失效，请重新登录');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);

    // 解析服务端业务消息（Nest 统一错误体形如 { statusCode, message }）
    let body: any = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = {};
    }
    const serverMessage =
      typeof body?.message === 'string'
        ? body.message
        : typeof body?.error === 'string'
          ? body.error
          : undefined;

    // ★ 账号资质变更（403 + code=ROLE_MISMATCH）：这是前端唯一的统一入口。
    // 服务端 RolesGuard 已在响应体回带当前权威身份，零额外请求即可比对本地快照；
    // 命中后由漂移守卫弹友好提示并安排「清登录态 → 跳登录页」，此处不再把原始错误抛给业务页。
    if (res.status === 403 && body?.code === ROLE_MISMATCH_CODE && body?.identity) {
      reportFromServerIdentity(body.identity);
      throw new Error(IDENTITY_CHANGED_MESSAGE);
    }

    // 结构化抛出：携带状态码与服务端消息，让上层（如登录页）按状态码给出精确文案，
    // 而不是把所有失败都误报成「账号或密码错误」。
    throw new ApiError(res.status, `API ${res.status}: ${text}`, serverMessage);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * 带登录态的裸 fetch —— 供「需要自行处理响应体」的页面使用
 *（下载 Blob、FormData 上传、需要读自定义状态码/自定义错误体等场景）。
 *
 * ★ 铁律（P0 缺陷修复，2026-10-05）：任何打后端 `/api` 的请求都必须走
 *   `request()` 或本函数，**不得在页面里手搓 `Authorization` 头 + 裸 `fetch`**。
 *
 * 历史缺陷：`TemplateFieldDesignPage` / `GuestLists` / `GuestListEditor` 三个页面
 * 各自手搓 `authHeaders()` 后直接 `fetch()`，绕过了 `request()` 里的
 * 「401 → refresh token 静默续期 → 重试一次」管线。后果：
 *   - access token（TTL 2h）过期或被清掉时，这些页面的 GET/POST 直接拿到
 *     `401 {"message":"Unauthorized"}`，页面把服务端原文当业务错误抛给用户
 *     （「新建模板」保存时弹出 "Unauthorized"、配置无法保存）；
 *   - 而走 api client 的其它页面会静默续期、用户毫无感知 ⇒ 表现为「只有这个页面坏」。
 *
 * 本函数与 `request()` 共享同一条鉴权策略：注入 Authorization → 401 静默续期重试一次
 * → 续期也失败则清理会话并抛「登录已失效，请重新登录」（不再把原始 "Unauthorized" 暴露给用户）。
 * 注意：**不覆盖调用方显式提供的 header**（如 FormData 上传不得强设 Content-Type）。
 */
export async function authFetch(
  path: string,
  options: RequestInit = {},
  _retry = false,
): Promise<Response> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  // 访问令牌过期（401）：静默续期后重试一次，避免用户被静默登出
  if (res.status === 401 && !_retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return authFetch(path, options, true);
    // 续期也失败（refresh token 缺失/过期）：清理整个会话，使 UI 登录态与存储一致
    clearTokens();
    localStorage.removeItem('user_info');
    throw new ApiError(401, 'API 401: 登录已失效，请重新登录', '登录已失效，请重新登录');
  }

  return res;
}

/**
 * 二进制响应请求（服务端导出图片/视频 / 打包下载）：带 JWT、返回 Blob，不做 JSON 解析。
 * 走 authFetch ⇒ 与 request() 同享「401 静默续期」策略（历史上这里也是裸 fetch，同样会 401）。
 */
async function requestBlob(path: string, body: unknown): Promise<Blob> {
  const res = await authFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `请求失败 ${res.status}`;
    try {
      const j = await res.json();
      if (j?.message) msg = Array.isArray(j.message) ? j.message.join('; ') : j.message;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.blob();
}

/** 二进制 GET 请求（如打包下载 Zip）：带 JWT、返回 Blob */
async function requestBlobGet(path: string): Promise<Blob> {
  const res = await authFetch(path, { method: 'GET' });
  if (!res.ok) {
    let msg = `请求失败 ${res.status}`;
    try {
      const j = await res.json();
      if (j?.message) msg = Array.isArray(j.message) ? j.message.join('; ') : j.message;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.blob();
}

export const api = {
  // ── 认证 ──
  /**
   * 注册（可扩展入驻意图）。
   * extra.intent 仅为引导/统计语义（user|provider|agent），**不会**改变 role；
   * 资质材料不由此无鉴权接口承载，注册后走 /onboarding 提交入驻申请。
   */
  register: (
    phone: string,
    password: string,
    nickname?: string,
    extra?: { realName?: string; intent?: 'user' | 'provider' | 'agent' },
  ) =>
    request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ phone, password, nickname, ...(extra ?? {}) }),
    }),

  login: (phone: string, password: string) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    }),

  getMe: () =>
    request<UserInfo>('/api/auth/me', { method: 'POST' }),

  /**
   * 通用 GET —— 用于 /api/user/* 等尚未逐一封装的端点。
   * 自动拼接查询参数，并忽略 undefined / null / 空字符串（避免拼出 key=undefined）。
   */
  get: <T>(path: string, params?: Record<string, unknown>) => {
    const qs = params
      ? '?' +
        new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined && v !== null && v !== '')
            .map(([k, v]) => [k, String(v)]),
        ).toString()
      : '';
    return request<T>(`${path}${qs}`);
  },

  /** 通用 POST —— 用于 /api/user/* 等尚未逐一封装的端点 */
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),

  /** 通用 DELETE —— 用于撤回申请等尚未逐一封装的端点 */
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),

  /** 字体目录（自定义 / 艺术字体），供编辑器字体选择器拉取 */
  // ⚠️ 必须走 `/api` 前缀：web 端 BASE_URL=''，vite 只代理 /api、/uploads、/public，
  // 写 `/fonts` 会打到 dev server 上拿到 index.html（JSON 解析失败被静默吞掉）。
  fonts: () => request<any[]>('/api/fonts'),

  /** 服务端导出准备：做字体授权判定并颁发一次性 token */
  exportPrepare: (projectId: string, source: 'draft' | 'published' = 'draft') =>
    request<{
      token: string;
      licensed: boolean;
      missing: string[];
      pageCount: number;
      width: number;
      height: number;
    }>('/api/export/prepare', {
      method: 'POST',
      body: JSON.stringify({ projectId, source }),
    }),

  /** 服务端导出图片（导出硬门槛：分辨率/水印由服务端按授权决定） */
  exportImage: (o: {
    token: string;
    page: number;
    mode: 'current' | 'all';
    format: 'png' | 'jpeg' | 'webp';
    filename?: string;
  }) => requestBlob('/api/export/image', o),

  /** 服务端导出视频（逐页截图 + ffmpeg 合成） */
  exportVideo: (o: { token: string; secondsPerPage?: number; filename?: string }) =>
    requestBlob('/api/export/video', o),

  /**
   * 申请入驻服务商（复合服务子角色多选）。
   * ⚠️ 语义变更：不再即时升级身份，仅提交入驻申请进入两段审管线（代理商一审 → 总台终审）。
   * 返回入驻申请（QualificationApplication）而非更新后的 UserInfo。
   */
  applyForProvider: (serviceRoles: ServiceRole[]) =>
    request<{ id: string; status: string; duplicated?: boolean }>('/api/auth/apply-provider', {
      method: 'POST',
      body: JSON.stringify({ serviceRoles }),
    }),

  // ⚠️ submitProviderReview 已随后端自批端点一并下线：资质审核改由总台终审落地，禁止自助通过。

  /** 已通过审核的服务商申请扩展业务（增加服务子角色，进入 pendingServiceRoles） */
  expandServices: (serviceRoles: ServiceRole[]) =>
    request<UserInfo>('/api/auth/provider/expand-services', {
      method: 'POST',
      body: JSON.stringify({ serviceRoles }),
    }),

  /** 管理员批准服务商的 pendingServiceRoles（仅 ADMIN） */
  approveServiceRoles: (userId: string) =>
    request<UserInfo>('/api/auth/provider/approve-services', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  /** 更新账户资料（昵称 / 头像 / 手机 / 真实姓名 / 简介 / 邮箱 / 证件号 / 证件影像） */
  updateProfile: (dto: {
    nickname?: string;
    avatar?: string;
    phone?: string;
    realName?: string;
    bio?: string;
    email?: string;
    idCard?: string;
    idCardFront?: string;
    idCardBack?: string;
  }) =>
    request<UserInfo>('/api/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),

  /** 修改密码 */
  changePassword: (oldPassword: string, newPassword: string) =>
    request<UserInfo>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    }),

  // ── 作品 ──
  listProjects: () => request<ProjectListItem[]>('/api/projects'),

  getProject: (id: string) => request<ProjectDetail>(`/api/projects/${id}`),

  createProject: (title: string, templateId?: string) =>
    request<ProjectDetail>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ title, templateId }),
    }),

  updateProject: (
    id: string,
    data: { title?: string; schema?: unknown; status?: string; snapshot?: boolean },
  ) =>
    request<ProjectDetail>(`/api/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /**
   * 编辑器保存草稿（方案 A draft/live）—— 仅写 Project.draftSchema，不动线上 schema。
   * 与 updateProject（写 live schema + 版本号）区分：编辑器每次保存都走这里。
   */
  saveProjectDraft: (
    id: string,
    data: { title?: string; schema?: unknown; snapshot?: boolean },
  ) =>
    request<ProjectDetail>(`/api/projects/${id}/draft`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /** 列出某作品的历史版本（按创建时间倒序） */
  listVersions: (projectId: string) =>
    request<{ id: string; createdAt: string }[]>(`/api/projects/${projectId}/versions`),

  /** 回滚到指定历史版本 */
  rollback: (projectId: string, versionId: string) =>
    request<ProjectDetail>(`/api/projects/${projectId}/versions/${versionId}/rollback`, {
      method: 'POST',
    }),

  deleteProject: (id: string) =>
    request<void>(`/api/projects/${id}`, { method: 'DELETE' }),

  // ── 数据看板 ──
  getStatsOverview: () =>
    request<{
      totalViews: number;
      totalProjects: number;
      publishedProjects: number;
      totalTemplates: number;
    }>('/api/stats/overview'),

  getStatsProjects: () =>
    request<
      {
        id: string;
        title: string;
        status: string;
        viewCount: number;
        publishCode: string | null;
        updatedAt: string;
      }[]
    >('/api/stats/projects'),

  // ── 模板 ──
  listTemplates: (category?: string, search?: string) =>
    request<TemplateListItem[]>(
      `/api/templates${category ? `?category=${category}` : ''}${search ? `${category ? '&' : '?'}search=${search}` : ''}`,
    ),

  getTemplate: (id: string) => request<{ id: string; name: string; schema: unknown }>(`/api/templates/${id}`),

  getTemplateCategories: () => request<string[]>('/api/templates/categories'),

  useTemplate: (templateId: string, title?: string) =>
    request<ProjectDetail>(`/api/templates/${templateId}/use`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),

  /** 设计师：提交模板到审核队列（状态为 PENDING） */
  createTemplate: (data: CreateTemplateRequest) =>
    request<TemplateDetail>('/api/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * 沙盒→闸门桥接（阶段 D）：把「个人作品 Project」提交为「服务商模板 Template（PENDING）」，
   * 进入运营端审核队列。仅服务商可调用。
   */
  submitAsTemplate: (
    projectId: string,
    data: { name?: string; category?: string; tags?: string[]; price?: number; intro?: string; cover?: string },
  ) =>
    request<TemplateDetail>('/api/provider/from-project', {
      method: 'POST',
      body: JSON.stringify({ projectId, ...data }),
    }),

  /** 设计师：列出自己提交的模板 */
  listMyTemplates: () => request<TemplateDetail[]>('/api/templates/mine'),

  /** 设计师：删除自己的模板（仅服务商/管理员） */
  deleteTemplate: (id: string) =>
    request<{ ok: boolean }>(`/api/provider/services/${id}`, { method: 'DELETE' }),

  /** 管理员：获取待审核模板列表（含作者信息） */
  listPendingTemplates: () => request<TemplateDetail[]>('/api/templates/pending'),

  /** 管理员：审核模板（通过 / 驳回） */
  reviewTemplate: (templateId: string, decision: ReviewDecision, reviewNote?: string) =>
    request<TemplateDetail>(`/api/templates/${templateId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ decision, reviewNote }),
    }),

  /** 管理员：违规下架已通过的模板 */
  takedownTemplate: (templateId: string, reason: string) =>
    request<TemplateDetail>(`/api/templates/${templateId}/takedown`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),

  /** 设计师：对下架/驳回的模板提交申诉 */
  createAppeal: (templateId: string, reason: string) =>
    request<AppealInfo>(`/api/templates/${templateId}/appeal`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  /** 管理员：获取申诉列表（默认仅 pending） */
  listAppeals: (status?: string) =>
    request<AppealInfo[]>(`/api/templates/appeals${status ? `?status=${status}` : ''}`),

  /** 管理员：审核申诉（approve → 恢复上架；reject → 维持下架） */
  reviewAppeal: (appealId: string, decision: AppealDecision, adminNote?: string) =>
    request<AppealInfo>(`/api/templates/appeals/${appealId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ decision, adminNote }),
    }),

  /** 买家：购买付费模板（幂等，已购直接返回原订单） */
  purchaseTemplate: (templateId: string) =>
    request<TemplateOrderInfo>(`/api/templates/${templateId}/purchase`, {
      method: 'POST',
    }),

  // ── 订单 ──
  /** 买家：列出自己的购买订单 */
  listOrders: () => request<TemplateOrderInfo[]>('/api/orders'),

  // ── 钱包 / 收益 ──
  /** 服务商：获取自己的钱包 */
  getMyWallet: () => request<WalletInfo>('/api/wallet/mine'),

  /** 服务商：申请提现（amount 单位：分） */
  withdrawWallet: (amount: number) =>
    request<WithdrawalInfo>('/api/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),

  /** 服务商：提现记录列表 */
  listWithdrawals: () => request<WithdrawalInfo[]>('/api/wallet/withdrawals'),

  // ── 发布 ──
  publish: (projectId: string) =>
    request<PublishResult>(`/api/publish/${projectId}`, { method: 'POST' }),

  unpublish: (projectId: string) =>
    request<void>(`/api/publish/${projectId}`, { method: 'DELETE' }),

  getPublished: (publishCode: string) =>
    request<{ title: string; schema: unknown }>(`/api/p/${publishCode}`),

  // ── 健康检查 ──
  health: () => request<{ status: string; timestamp: string }>('/health'),

  // ── 素材 ──
  uploadAsset: (
    file: File,
    meta?: { width?: number; height?: number; derivedFrom?: string },
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    const params = new URLSearchParams();
    if (meta?.width && meta.width > 0) params.set('width', String(Math.round(meta.width)));
    if (meta?.height && meta.height > 0) params.set('height', String(Math.round(meta.height)));
    // 图库图经编辑器选择器转存为公开 media 副本时回带源图库图 id，
    // 使副本可追溯（asset.derivedFrom），支撑「图库图被作品使用」的级联保护与「使用中 N」计数。
    if (meta?.derivedFrom) params.set('derivedFrom', meta.derivedFrom);
    const qs = params.toString();
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(`${BASE_URL}/api/assets/upload${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      headers,
      body: formData,
    }).then(async (res) => {
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      return res.json() as Promise<AssetItem>;
    });
  },

  listAssets: (type?: string) =>
    request<AssetItem[]>(`/api/assets${type ? `?type=${type}` : ''}`),

  deleteAsset: (id: string) =>
    request<void>(`/api/assets/${id}`, { method: 'DELETE' }),

  // ── 背景音乐 ──
  /** 获取平台预置的系统背景音乐列表（公开接口） */
  getSystemMusic: () => request<BackgroundMusic[]>('/api/music/system'),

  // ── 批量请柬（名单导入与个性化渲染，§10 接口清单）──
  /** 名单列表（归属由后端按 ownerType/clientId 收窄，前端不自行拼租户条件） */
  listGuestLists: (params?: { ownerType?: string; clientId?: string }) => {
    const q = new URLSearchParams();
    if (params?.ownerType) q.set('ownerType', params.ownerType);
    if (params?.clientId) q.set('clientId', params.clientId);
    const s = q.toString();
    return request<GuestListRow[]>(`/api/guest-lists${s ? `?${s}` : ''}`);
  },

  /** 分页读取名单人员 */
  listGuestRecords: (listId: string, page = 1, size = 50) =>
    request<GuestRecordPage>(`/api/guest-lists/${listId}/records?page=${page}&size=${size}`),

  /**
   * 创建/复用批量渲染项目（模板 + 名单）。
   * `projectId` 可选：显式传入既有项目 id 时后端**强制复用**该项目（模板一致才复用，
   * 不一致回退常规路径且不抛错），用于「换名单 / 追加名单」场景 —— 否则按 (templateId, listId)
   * 命中才复用，换名单会新建项目导致已购人次作废。不传则行为与旧版逐字一致。
   */
  createBatchProject: (payload: {
    templateId: string;
    listId: string;
    projectId?: string;
    ownerType?: string;
    clientId?: string;
  }) =>
    request<BatchProjectView>('/api/invitations/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /** 购买渲染人次（提升批量请柬可渲染上限） */
  purchaseInvitation: (payload: { projectId: string; headcount: number }) =>
    request<BatchProjectView>('/api/invitations/purchase', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /** 读取项目状态与配额 */
  getBatchProject: (projectId: string) =>
    request<BatchProjectView>(`/api/invitations/projects/${projectId}`),

  /** 读取当前勾选子集 */
  getGuestSelection: (projectId: string) =>
    request<GuestSelectionView>(`/api/invitations/projects/${projectId}/selection`),

  /** 保存勾选子集（有序）。返回「已锁定 ids ∪ 本次提交 ids」的并集，调用方须以响应体为准回写本地勾选 */
  setGuestSelection: (payload: {
    projectId: string;
    listId: string;
    selectedRecordIds: string[];
  }) =>
    request<{
      projectId: string;
      listId: string;
      selectedRecordIds: string[];
      count: number;
    }>(`/api/invitations/projects/${payload.projectId}/selection`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /** 发起批量渲染（FREE_SAMPLE 首渲 / PAID 续渲 / RERENDER 重渲） */
  batchGenerate: (payload: {
    projectId: string;
    mode?: 'FREE_SAMPLE' | 'PAID' | 'RERENDER';
    targetRecordIds?: string[];
  }) =>
    request<{ jobId: string; total: number }>('/api/invitations/batch-generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /** 生成前变量匹配体检（D4 反转：含映射改指向） */
  getInvitationHealth: (projectId: string) =>
    request<BindingHealth>(`/api/invitations/projects/${projectId}/health`),

  /**
   * 占位符注册表（只读，供编辑器绑定）。
   * 返回全部 visible 占位符；编辑器按元素类型本地过滤。
   * 端点：`GET /api/console/placeholders`（任意已登录角色可读）。
   */
  listPlaceholders: () =>
    request<{ items: any[]; total: number }>('/api/console/placeholders'),

  /** 保存变量映射（D4 反转：variableMapping 持久化） */
  saveInvitationMapping: (projectId: string, mapping: Record<string, string>) =>
    request<{ projectId: string; variableMapping: Record<string, string> }>(
      `/api/invitations/projects/${projectId}/mapping`,
      { method: 'PUT', body: JSON.stringify({ mapping }) },
    ),

  /** 获取项目生成期画布元素（D 模式点选用，§2.5） */
  getProjectElements: (projectId: string) =>
    request<{
      projectId: string;
      templateId: string;
      previewSchema: unknown;
      elements: Array<{ id: string; type: string; pageIndex: number; text?: string; bindingKey?: string }>;
    }>(`/api/invitations/projects/${projectId}/elements`),

  /** 保存 D 模式元素级绑定（project.elementBindings，不回写模板，§2.5） */
  saveElementBindings: (
    projectId: string,
    elementBindings: Record<string, { key: string; name?: string; listField?: string }>,
  ) =>
    request<{ projectId: string; elementBindings: unknown }>(
      `/api/invitations/projects/${projectId}/element-bindings`,
      { method: 'PUT', body: JSON.stringify({ elementBindings }) },
    ),

  /** 渲染任务列表（进度 / 结果） */
  listInvitationJobs: (projectId?: string) =>
    request<RenderJobRow[]>(`/api/invitations/jobs${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`),

  /** 跨 job 聚合某项目的逐人渲染状态（按锁定快照顺序，§18.3） */
  projectResults: (projectId: string) =>
    request<ProjectResultsView>(`/api/invitations/projects/${projectId}/results`),

  /** 跨 job 按 ?recordIds= 子集（或不传=全部）打包 Zip（§18.4） */
  downloadProjectZip: (projectId: string, recordIds?: string[]) => {
    const q = recordIds?.length ? `?recordIds=${recordIds.join(',')}` : '';
    return requestBlobGet(`/api/invitations/projects/${projectId}/download${q}`);
  },

  /** 删除指定 recordIds 的生成记录（不退配额，§18.4） */
  deleteProjectResults: (payload: { projectId: string; recordIds: string[] }) =>
    request<void>(`/api/invitations/projects/${payload.projectId}/results`, {
      method: 'DELETE',
      body: JSON.stringify({ recordIds: payload.recordIds }),
    }),

  /** 单条生成图鉴权下载（逐人预览，§18.3） */
  downloadJobFile: (jobId: string, recordId: string) =>
    requestBlobGet(`/api/invitations/jobs/${jobId}/files/${recordId}`),

  /** 断点续跑：仅重渲某 job 内失败/缺失的记录（T6） */
  resumeInvitationJob: (jobId: string) =>
    request<{ jobId: string; projectId: string; mode: string; total: number; resumedFrom: string }>(
      `/api/invitations/jobs/${jobId}/resume`,
      { method: 'POST', body: JSON.stringify({}) },
    ),

  // ── 代理商工作台（辖区内数据，依赖后端 DataScopeInterceptor 的 REGION 作用域）──
  /** 行政区划树（用于把 agent.regionPath 解析成「省/市/区」可读名） */
  getRegionTree: () => request<RegionNode[]>('/api/regions/tree'),

  /**
   * 辖区内用户/服务商列表（AGENT 调用会被后端按 regionPath 前缀自动收窄到辖区）。
   * 返回 { items, total, page, pageSize }，与 admin 端一致。
   */
  listAgentUsers: (role?: string, pageSize = 50) =>
    request<{ items: AgentUserRow[]; total: number; page: number; pageSize: number }>(
      `/api/admin/users${role ? `?role=${role}&pageSize=${pageSize}` : `?pageSize=${pageSize}`}`,
    ),

  /** 辖区内待审服务商资质（pendingServiceRoles 非空者，已按辖区收窄） */
  listAgentProviderReviews: () => request<AgentReviewRow[]>('/api/admin/provider-review'),

  /** 代理商批准服务商扩展业务（AGENT/ADMIN 均可） */
  approveProviderReview: (userId: string) =>
    request<AgentReviewRow>(`/api/admin/provider-review/${userId}/approve`, { method: 'POST' }),

  /** 代理商驳回服务商扩展业务 */
  rejectProviderReview: (userId: string) =>
    request<AgentReviewRow>(`/api/admin/provider-review/${userId}/reject`, { method: 'POST' }),

  // ── 服务商控制台（与「管理总台 · 服务商视角」共用同一批端点）──
  /** 我的工作台看板：钱包 / 订单 / 服务 / 反馈 + 成交订单六口径 */
  providerDashboard: () => request<ProviderDashboard>('/api/provider/dashboard'),

  /** 服务管理：我发布的模板（服务供给） */
  providerServices: (page = 1, pageSize = 20) =>
    request<{ items: ProviderServiceRow[]; total: number; page: number; pageSize: number }>(
      `/api/provider/services?page=${page}&pageSize=${pageSize}`,
    ),

  /** 订单处理：我提供的模板产生的订单 */
  providerOrders: (page = 1, pageSize = 10, status?: string) =>
    request<{ items: ProviderOrderRow[]; total: number; page: number; pageSize: number }>(
      `/api/provider/orders?page=${page}&pageSize=${pageSize}${status ? `&status=${status}` : ''}`,
    ),

  /** 资质管理：当前服务商的资质状态与业务子角色 */
  providerQualification: () => request<ProviderQualification>('/api/provider/qualification'),

  // ── 工单（评价与反馈中心）──
  /** 列表；status 传 not_closed 表示「待处理（未关闭）」 */
  listTickets: (status?: string) =>
    request<TicketRow[]>(`/api/tickets${status ? `?status=${status}` : ''}`),

  createTicket: (payload: { type: string; title: string; content: string; targetId?: string }) =>
    request<TicketRow>('/api/tickets', { method: 'POST', body: JSON.stringify(payload) }),

  /** 工单流转：assign 认领协商 / escalate 升级转总台 / resolve 仲裁关闭 */
  actTicket: (id: string, action: 'assign' | 'escalate' | 'resolve', note?: string) =>
    request<TicketRow>(`/api/tickets/${id}/${action}`, {
      method: 'PATCH',
      body: JSON.stringify(note ? { note } : {}),
    }),

  // ── 消息中心 ──
  listMessages: () => request<MessageRow[]>('/api/messages'),

  /**
   * 发布消息。范围由角色固定：服务商只能发普通消息（scope=OWN + targetRole）。
   * 代理商发辖区公告需总台审核，见 messages/audit。
   */
  createMessage: (payload: {
    type: string;
    scope: string;
    title: string;
    content: string;
    targetRole?: string;
    regionPath?: string;
  }) => request<MessageRow>('/api/messages', { method: 'POST', body: JSON.stringify(payload) }),
};

/** 服务商看板（/api/provider/dashboard 响应） */
export interface ProviderDashboard {
  balanceCents: number;
  totalIncomeCents: number;
  withdrawnCents: number;
  orderCount: number;
  dealOrders: number;
  refundedOrders: number;
  dealRate: number;
  returnRate: number;
  refundRate: number;
  serviceCount: number;
  feedbackCount: number;
  serviceCategoryShare: { category: string; count: number }[];
  monthlyRevenue: { month: string; amountCents: number }[];
}

/** 服务管理行（我发布的模板） */
export interface ProviderServiceRow {
  id: string;
  name: string;
  category: string;
  status: string;
  useCount: number;
  price: number;
  createdAt: string;
}

/** 订单处理行 */
export interface ProviderOrderRow {
  id: string;
  orderNo?: string | null;
  amount: number;
  platformFee: number;
  designerIncome?: number;
  status: string;
  createdAt: string;
  buyer?: { id: string; nickname: string | null; phone: string | null } | null;
  template?: { id: string; name: string; category: string; cover: string | null } | null;
}

/** 资质信息 */
export interface ProviderQualification {
  id: string;
  nickname: string | null;
  phone: string | null;
  realName: string | null;
  providerStatus: 'PENDING' | 'APPROVED';
  serviceRoles: string[];
  pendingServiceRoles: string[];
}

/** 工单行 */
export interface TicketRow {
  id: string;
  type: string;
  title: string;
  content?: string;
  status: string;
  createdAt: string;
  reporter?: { id: string; nickname?: string | null; phone?: string | null } | null;
  target?: { id: string; nickname?: string | null; phone?: string | null } | null;
}

/** 消息行 */
export interface MessageRow {
  id: string;
  title: string;
  content?: string;
  type?: string;
  status?: string;
  createdAt?: string;
  read?: boolean;
}

/** 行政区划树节点（与后端 RegionService.getTree 对齐） */
export interface RegionNode {
  id: string;
  code: string;
  name: string;
  level: number;
  parentId: string | null;
  regionPath: string | null;
  children: RegionNode[];
}

/** 代理商辖区内用户/服务商行（与后端 admin.service.userListSelect 对齐） */
export interface AgentUserRow {
  id: string;
  phone: string | null;
  nickname: string | null;
  role: UserRole;
  serviceRoles: ServiceRole[];
  pendingServiceRoles?: ServiceRole[];
  providerStatus?: 'PENDING' | 'APPROVED';
  status?: 'ACTIVE' | 'DISABLED';
  regionPath?: string | null;
  region?: { id: string; code: string; name: string; regionPath: string | null } | null;
}

/** 代理商辖区内待审服务商资质行 */
export interface AgentReviewRow {
  id: string;
  phone: string | null;
  nickname: string | null;
  realName: string | null;
  serviceRoles: ServiceRole[];
  pendingServiceRoles: ServiceRole[];
  providerStatus?: 'PENDING' | 'APPROVED';
  regionPath?: string | null;
  region?: { id: string; name: string; regionPath: string | null } | null;
}
