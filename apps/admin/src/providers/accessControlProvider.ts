import type { AccessControlProvider } from '@refinedev/core';
import { API_URL, authHeaders, type AccessInfo } from '../utility';

let cache: AccessInfo | null = null;

/** 登录/退出后调用，使下次 can() 重新拉取权限摘要 */
export function invalidateAccessCache() {
  cache = null;
}

function permFor(resource: string, action: string): string | null {
  // 自定义动作（来自资源 meta.action），用于细粒度（如角色分配）
  if (action === 'user:role') return 'user:role';
  if (resource === 'admin/users') {
    if (action === 'edit') return 'user:update';
    return 'user:read';
  }
  if (resource === 'admin/provider-review') return 'provider:review';
  if (resource === 'admin/agents') return 'agent:manage';
  if (resource === 'admin/regions') return 'region:read';
  if (resource === 'admin/wallets') return 'wallet:read';
  if (resource === 'admin/withdrawals') return 'wallet:manage';
  if (resource === 'admin/orders') return 'order:read';
  if (resource === 'admin/dashboard') return 'user:read';
  // 评价与反馈中心
  if (resource === 'admin/feedback') return 'feedback:read';
  if (resource === 'admin/feedback-review') return 'feedback:review';
  if (resource === 'agent/feedback') return 'feedback:agent';
  if (resource === 'sp/feedback') return 'feedback:own';
  // 消息中心
  if (resource === 'admin/messages') return 'message:read';
  if (resource === 'admin/message-audit') return 'message:audit';
  if (resource === 'agent/messages') return 'message:agent';
  if (resource === 'sp/messages') return 'message:own';
  return null;
}

function canSeeByRole(resource: string | undefined, role: string | undefined): boolean | null {
  if (!resource) return null;
  // 总台根 / 财务中心 / 系统级资源（字体、模板审核、角色权限、系统设置、操作日志）：
  // 仅 ADMIN。避免 USER / 代理商 / 服务商等非管理角色误见运营菜单（fail-closed）。
  if (
    resource === 'admin/console' ||
    resource === 'admin/finance' ||
    resource === 'admin/fonts' ||
    resource === 'admin/templates' ||
    resource === 'admin/roles' ||
    resource === 'admin/settings' ||
    resource === 'admin/audit-logs'
  ) {
    return role === 'ADMIN';
  }
  // 代理商中心资源：限 代理商 / 管理员
  if (resource.startsWith('agent/')) {
    return role === 'AGENT' || role === 'ADMIN';
  }
  // 服务商中心资源：限 服务商 / 管理员
  if (resource.startsWith('sp/')) {
    return role === 'SERVICE_PROVIDER' || role === 'ADMIN';
  }
  // 其余（user/*、account/* 等自作用域资源）不按角色拦截，交由 permFor / 兜底判定
  return null;
}

export const accessControlProvider: AccessControlProvider = {
  can: async ({ resource, action }) => {
    if (!cache) {
      try {
        const res = await fetch(`${API_URL}/auth/access`, {
          headers: authHeaders(),
        });
        if (res.ok) {
          cache = (await res.json()) as AccessInfo;
        } else {
          cache = { id: '', role: 'USER', regionId: null, regionPath: null, scope: 'SELF', permissions: [] };
        }
      } catch {
        cache = { id: '', role: 'USER', regionId: null, regionPath: null, scope: 'SELF', permissions: [] };
      }
    }
    const res = resource ?? '';
    // 1) 角色层显隐（前端菜单显隐，数据权限仍由后端强制）
    const roleDecision = canSeeByRole(res, cache?.role);
    if (roleDecision !== null) return { can: roleDecision };
    // 2) 细粒度权限：已显式映射的资源按权限串判定，缺失权限即拒绝（fail-closed）
    const perm = permFor(res, String(action));
    if (perm) return { can: cache!.permissions.includes(perm) };
    // 3) 兜底：
    //    - 管理后台（admin/*）未显式映射的资源默认【拒绝】，避免非管理角色误入运营菜单；
    //    - user/agent/sp/account 等自作用域资源默认可见，数据权限由后端强制。
    if (res.startsWith('admin/')) return { can: false };
    return { can: true };
  },
};

// 登录成功后由 authProvider 调用，使下次 can() 重新拉取权限摘要
export function onAuthChanged() {
  cache = null;
}
