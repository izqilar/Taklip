/**
 * 运营端·请柬变量绑定 API 封装（S5）
 *
 * 对应 server `invitation.controller` 的 health / elements / mapping / element-bindings
 * 四个端点。与运营端既有 `apiPost/apiGet`（见 pages/spInvitationBatch、pages/user/invitationShared）
 * 保持一致：绝对 `API_URL` + Bearer 鉴权（admin Vite 不代理 /api）、401 清登录态、
 * 非 2xx 抛可分流异常。
 *
 * 作用域（与既有端点同源，server 的 `scope()` 解析）：
 *  - 用户视角监督窗口（UserInvitationCenter）带 `subject`（服务端 subjectId 口径）；
 *  - 服务商/运营端自营业主作用域带 `ownerType` + `clientId`（代客 CLIENT）；
 *  两端二选一透传即可，缺失时回落请求者自身身份。Save 类端点对 409（锁定后保存）
 * 由调用方按需容忍（S4 已移除 LOCKED 守卫）。
 */
import { API_URL, authHeaders, jsonHeaders, clearSession } from '../utility';
import type { InvitationHealth, ProjectElement, ElementBindings } from '@h5design/invitation-mapping';

export interface InvitationApiOpts {
  /** ADMIN 监督窗口：视察某终端用户项目时带 subject（服务端 subjectId 口径） */
  subject?: string;
  /** 服务商/运营端自营业主作用域；代客(CLIENT)时一并带 clientId */
  ownerType?: 'ORG' | 'CLIENT';
  clientId?: string;
}

/** 统一异常：携带 HTTP 状态与业务 code，供上层做 401/402 分流与 409 容忍 */
export class InvitationApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 0, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function scopeQuery(opts?: InvitationApiOpts): string {
  if (!opts) return '';
  const p = new URLSearchParams();
  if (opts.subject) p.set('subject', opts.subject);
  if (opts.ownerType) p.set('ownerType', opts.ownerType);
  if (opts.clientId) p.set('clientId', opts.clientId);
  const s = p.toString();
  return s ? `?${s}` : '';
}

function scopeBody(opts?: InvitationApiOpts): Record<string, string> {
  const b: Record<string, string> = {};
  if (opts?.subject) b.subject = opts.subject;
  if (opts?.ownerType) b.ownerType = opts.ownerType;
  if (opts?.clientId) b.clientId = opts.clientId;
  return b;
}

async function handle(res: Response): Promise<void> {
  if (res.status === 401) {
    clearSession();
    throw new InvitationApiError('登录态已失效，请重新登录', 401, 'UNAUTH');
  }
  if (!res.ok) {
    const d = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
    throw new InvitationApiError(d?.message || `HTTP ${res.status}`, res.status, d?.code);
  }
}

/** 生成前变量匹配体检（D4 反转：含映射改指向）。GET /api/invitations/projects/:id/health */
export async function getInvitationHealth(
  projectId: string,
  opts?: InvitationApiOpts,
): Promise<InvitationHealth> {
  const res = await fetch(`${API_URL}/invitations/projects/${projectId}/health${scopeQuery(opts)}`, {
    headers: authHeaders(),
  });
  await handle(res);
  return (await res.json()) as InvitationHealth;
}

/** 保存变量→名单列映射（variableMapping 持久化）。PUT /api/invitations/projects/:id/mapping */
export async function saveInvitationMapping(
  projectId: string,
  mapping: Record<string, string>,
  opts?: InvitationApiOpts,
): Promise<void> {
  const res = await fetch(`${API_URL}/invitations/projects/${projectId}/mapping`, {
    method: 'PUT',
    headers: jsonHeaders(),
    body: JSON.stringify({ mapping, ...scopeBody(opts) }),
  });
  await handle(res);
}

/** 生成期画布点选：模板可点选元素列表 + 预览 schema（D 方案）。GET /api/invitations/projects/:id/elements */
export async function getProjectElements(
  projectId: string,
  opts?: InvitationApiOpts,
): Promise<{ elements: ProjectElement[]; previewSchema: unknown }> {
  const res = await fetch(`${API_URL}/invitations/projects/${projectId}/elements${scopeQuery(opts)}`, {
    headers: authHeaders(),
  });
  await handle(res);
  const d = (await res.json()) as { elements?: ProjectElement[]; previewSchema?: unknown };
  return { elements: d.elements ?? [], previewSchema: d.previewSchema };
}

/** 保存元素级绑定（落 project.elementBindings，不回写模板）。PUT /api/invitations/projects/:id/element-bindings */
export async function saveElementBindings(
  projectId: string,
  elementBindings: ElementBindings,
  opts?: InvitationApiOpts,
): Promise<void> {
  const res = await fetch(`${API_URL}/invitations/projects/${projectId}/element-bindings`, {
    method: 'PUT',
    headers: jsonHeaders(),
    body: JSON.stringify({ elementBindings, ...scopeBody(opts) }),
  });
  await handle(res);
}
