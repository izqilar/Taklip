/**
 * API 客户端 — 封装与 NestJS 后端的 HTTP 通信。
 * 自动携带 JWT Authorization header。
 */

import type { BackgroundMusic } from '@h5design/core';

const BASE_URL = ''; // 开发期走 vite proxy，生产期走 nginx 反代

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
  providerStatus: 'PENDING' | 'APPROVED';
  /** 角色管理管线（P0）：代理商管辖区域 */
  regionId?: string | null;
  agentId?: string | null;
  regionPath?: string | null;
  /** 账户启停状态（ACTIVE / DISABLED） */
  status?: 'ACTIVE' | 'DISABLED';
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserInfo;
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

/** 从 localStorage 获取 token */
function getToken(): string | null {
  return localStorage.getItem('access_token');
}

/** 存储 token 到 localStorage */
export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);
}

/** 清除 token */
export function clearTokens(): void {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

/** 获取当前 access token（跨端桥接时携带登录态使用） */
export function getStoredToken(): string | null {
  return localStorage.getItem('access_token');
}

/** 从 localStorage 获取 refresh token */
function getRefreshToken(): string | null {
  return localStorage.getItem('refresh_token');
}

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
    if (data.user) setStoredUser(data.user);
    return true;
  } catch {
    return false;
  }
}

/** 获取当前用户信息（从 localStorage） */
export function getStoredUser(): UserInfo | null {
  const raw = localStorage.getItem('user_info');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserInfo;
  } catch {
    return null;
  }
}

export function setStoredUser(user: UserInfo): void {
  localStorage.setItem('user_info', JSON.stringify(user));
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
    throw new Error('API 401: 登录已失效，请重新登录');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  // ── 认证 ──
  register: (phone: string, password: string, nickname?: string) =>
    request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ phone, password, nickname }),
    }),

  login: (phone: string, password: string) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    }),

  getMe: () =>
    request<UserInfo>('/api/auth/me', { method: 'POST' }),

  /** USER → SERVICE_PROVIDER 入驻（复合服务子角色多选） */
  applyForProvider: (serviceRoles: ServiceRole[]) =>
    request<UserInfo>('/api/auth/apply-provider', {
      method: 'POST',
      body: JSON.stringify({ serviceRoles }),
    }),

  /** 服务商提交资质审核（混合审核模型）：PENDING → APPROVED */
  submitProviderReview: () =>
    request<UserInfo>('/api/auth/submit-provider-review', { method: 'POST' }),

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

  /** 更新账户资料（昵称 / 头像 / 手机 / 真实姓名 / 简介 / 邮箱） */
  updateProfile: (dto: {
    nickname?: string;
    avatar?: string;
    phone?: string;
    realName?: string;
    bio?: string;
    email?: string;
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

  /** 设计师：列出自己提交的模板 */
  listMyTemplates: () => request<TemplateDetail[]>('/api/templates/mine'),

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
  uploadAsset: (file: File, meta?: { width?: number; height?: number }) => {
    const formData = new FormData();
    formData.append('file', file);
    const params = new URLSearchParams();
    if (meta?.width && meta.width > 0) params.set('width', String(Math.round(meta.width)));
    if (meta?.height && meta.height > 0) params.set('height', String(Math.round(meta.height)));
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
