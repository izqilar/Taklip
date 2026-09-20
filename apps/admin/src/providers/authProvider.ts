import type { AuthProvider } from '@refinedev/core';
import { API_URL, WEB_BASE, setSession, clearSession, getToken, getStoredUser, issueBridgeTicket } from '../utility';
import { onAuthChanged } from './accessControlProvider';

/**
 * 运营端准入角色（文档 §4.1 / §2.3）。
 * - ADMIN / AGENT：用户视角（/user/*）是「监督镜像」，可切换监督对象查看他人；
 * - SERVICE_PROVIDER：服务商视角；
 * - USER：终端用户**不进运营端** —— 改走 web 端（:5173）作为唯一功能性家，
 *   运营端的用户视角仅作服务商/代理商/总台的支持观测镜头（默认只读，可经「权限模式」切为超级管理员解除）。
 */
const CONSOLE_ROLES = ['ADMIN', 'AGENT', 'SERVICE_PROVIDER'];

/** 服务端下发的落点（登录响应的 home 字段，服务端 ROLE_HOME 为单一真值） */
type LoginHome = { origin?: 'web' | 'admin'; path?: string };

/**
 * 跨端一次性票据桥接：用当前（刚登录得到的）accessToken 向服务端申请一次性票据，
 * 把票据交给 web 端，由 web 端 bootstrap.ts 调 /auth/exchange 换回登录态，免二次登录。
 * URL 里不再是明文 JWT。
 */
async function buildWebBridge(accessToken: string, path: string): Promise<string> {
  const ticket = await issueBridgeTicket(accessToken);
  return ticket
    ? `${WEB_BASE}${path}?ticket=${encodeURIComponent(ticket)}`
    : `${WEB_BASE}${path}`;
}

/**
 * 权限探测请求（accessControlProvider.can() → GET /api/auth/access）的路径特征。
 *
 * Refine 在**渲染每个资源之前**都会先跑一次权限探测，因此它是全局最频繁的请求。
 * 若把它的失败也当成「会话过期」，一次探测抖动就会把用户整页踢到登录页。
 */
const PERMISSION_PROBE_RE = /\/auth\/(access|permissions?|menus)(\?|$|\/)/;

/** 判断错误是否来自权限探测请求 */
function isPermissionProbe(error: any): boolean {
  const url: unknown =
    error?.url ?? error?.config?.url ?? error?.response?.url ?? error?.response?.config?.url;
  return typeof url === 'string' && PERMISSION_PROBE_RE.test(url);
}

export const authProvider: AuthProvider = {
  login: async ({ phone, password }) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.accessToken) {
      return { success: false, error: { message: body?.message || '登录失败', statusCode: 401 } };
    }

    // 统一登录入口：落点由服务端 ROLE_HOME（登录响应 home）决定，本端只做分发。
    const role: string | undefined = body?.user?.role;
    const home = body?.home as LoginHome | undefined;

    // 运营端面向内部与合作方运营者（ADMIN / AGENT / SERVICE_PROVIDER）。
    // 终端用户（USER）不在准入范围 —— 账号密码是对的，只是走错了门：
    // 【不写运营端任何会话、也不提示】，直接把登录态桥接给 web 端个人中心静默送回。
    if (!CONSOLE_ROLES.includes(role ?? '')) {
      const isTerminalUser = role === 'USER';
      const bridge = isTerminalUser
        ? await buildWebBridge(body.accessToken, home?.path ?? '/user/works')
        : null;
      return {
        success: false,
        error: {
          // 用展开写入额外字段，避免 Refine 的 HttpError 精确类型拒绝它们。
          // Login 页只认 bridge：有值就静默跳转（不展示 message）。
          ...(bridge ? { bridge } : {}),
          message: isTerminalUser
            ? '终端用户请使用 web 端（:5173）登录，运营端仅对管理员 / 代理商 / 服务商开放'
            : '该账号无运营端访问权限（仅限管理员 / 代理商 / 服务商）',
          statusCode: 403,
        },
      };
    }

    // 会话里一并存下落点，供 HomeRedirect 优先使用（服务端缺失时仍按角色兜底）
    setSession(body.accessToken, { ...(body.user ?? {}), home });
    onAuthChanged();
    // origin=admin 时用服务端给的落点（/sp/studio、/agent/dashboard、/admin/dashboard）；
    // 否则不指定 redirectTo，交由根路由 HomeRedirect 兜底。
    return {
      success: true,
      ...(home?.origin === 'admin' && home?.path ? { redirectTo: home.path } : {}),
    };
  },

  logout: async () => {
    clearSession();
    onAuthChanged();
    return { success: true };
  },

  check: async () => {
    const token = getToken();
    if (!token) {
      return { authenticated: false, redirectTo: '/login' };
    }
    return { authenticated: true };
  },

  getPermissions: async () => {
    const user = getStoredUser<{ role?: string }>();
    return user?.role ?? null;
  },

  getIdentity: async () => {
    return getStoredUser();
  },

  onError: async (error: any) => {
    const status = error?.statusCode ?? error?.response?.status ?? error?.status;
    if (status === 401) {
      // 例外的例外：权限探测请求失败不登出、不跳登录页。
      // 探测结果在 accessControlProvider.can() 内部已有降级（失败 → 无权限），
      // 交给 Refine 渲染常规错误/空态即可，不能因此清空会话把用户踢出去。
      if (isPermissionProbe(error)) return { error };
      clearSession();
      return { error, logout: true, redirectTo: '/login' };
    }
    return { error };
  },
};
