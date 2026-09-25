import type { AccessControlProvider } from '@refinedev/core';
import { API_URL, authHeaders, type AccessInfo, type StaffMembershipLite } from '../utility';

let cache: AccessInfo | null = null;

/** 登录/退出后调用，使下次 can() 重新拉取权限摘要 */
export function invalidateAccessCache() {
  cache = null;
}

function permFor(resource: string, action: string): string | null {
  // P1：团队写操作门控（与服务端 OrgAccess requirePerm 同源）。仅成员关系 + team:manage 可写，
  // 其余动作（读/列表）对成员开放，交由 canSeeByRole 判定显隐。
  if (resource.endsWith('/team')) {
    if (action === 'create' || action === 'edit' || action === 'delete') return 'team:manage';
    return null;
  }
  // 自定义动作（来自资源 meta.action），用于细粒度（如角色分配）
  if (action === 'user:role') return 'user:role';
  if (resource === 'admin/users') {
    if (action === 'delete') return 'user:delete';
    if (action === 'edit') return 'user:update';
    return 'user:read';
  }
  // 回收站（僵尸用户）：仅具备 user:delete 权限的管理员可见（与用户管理·删除同源门控）
  if (resource === 'admin/zombie-users') return 'user:delete';
  if (resource === 'admin/provider-review') return 'provider:review';
  if (resource === 'admin/agents') return 'agent:manage';
  if (resource === 'admin/regions') return 'region:read';
  if (resource === 'admin/wallets') return 'wallet:read';
  if (resource === 'admin/withdrawals') return 'wallet:manage';
  if (resource === 'admin/orders') return 'order:read';
  if (resource === 'admin/dashboard') return 'user:read';
  // 平台合同管理：编辑 / 作废均属总台合同治理，统一由 contract:manage 门控
  if (resource === 'admin/contracts') return 'contract:manage';
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

function canSeeByRole(resource: string | undefined, role: string | undefined, staff?: StaffMembershipLite[]): boolean | null {
  if (!resource) return null;
  const inLayer = (layer: StaffMembershipLite['orgType']) => (staff ?? []).some((s) => s.orgType === layer);
  // 总台根 / 财务中心 / 系统级资源（字体、模板审核、角色权限、系统设置、操作日志）：
  // 仅 ADMIN。员工（含总台员工）即便有 CONSOLE 成员关系也不开放系统级菜单（R-03 防越权）。
  if (
    resource === 'admin/console' ||
    resource === 'admin/finance' ||
    resource === 'admin/fonts' ||
    resource === 'admin/templates' ||
    // 入驻审批台：用户资格升级（USER → 服务商 / 代理商）由总台 ADMIN 独家裁定
    resource === 'admin/qualifications' ||
    resource === 'admin/roles' ||
    resource === 'admin/settings' ||
    resource === 'admin/audit-logs'
  ) {
    return role === 'ADMIN';
  }
  // 总台「我的团队」+ 总台首页：ADMIN 或 总台内部员工（OrgStaff orgType=CONSOLE）
  if (resource === 'admin/team' || resource === 'admin/dashboard') {
    return role === 'ADMIN' || inLayer('CONSOLE');
  }
  // 代理商中心资源：代理商 / 管理员 / 代理商内部员工
  if (resource.startsWith('agent/')) {
    return role === 'AGENT' || role === 'ADMIN' || inLayer('AGENT');
  }
  // 服务商中心资源：服务商 / 管理员 / 服务商内部员工
  if (resource.startsWith('sp/')) {
    return role === 'SERVICE_PROVIDER' || role === 'ADMIN' || inLayer('PROVIDER');
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
    const staff = cache?.staff;
    const role = cache?.role;
    // 0) 团队写操作门控（与服务端 OrgAccess requirePerm 同源）：
    //    - 该层拥有者（legacy 角色）天然可写；
    //    - 员工须具备 team:manage 权限（由 funcPerms 推导）。
    if (res.endsWith('/team') && (action === 'create' || action === 'edit' || action === 'delete')) {
      // 注意：资源名是后端 API 路径，服务商层是 `provider/team`（不是 `sp/team`；`sp/` 只是前端路由前缀）。
      // 早期只判 `sp/` → 服务商老板被误判成 CONSOLE 层而遭拒绝（写按钮消失），此处补齐双写。
      const layer = res.startsWith('agent/')
        ? 'AGENT'
        : res.startsWith('provider/') || res.startsWith('sp/')
          ? 'PROVIDER'
          : 'CONSOLE';
      const isOwner =
        (layer === 'CONSOLE' && role === 'ADMIN') ||
        (layer === 'AGENT' && (role === 'AGENT' || role === 'ADMIN')) ||
        (layer === 'PROVIDER' && (role === 'SERVICE_PROVIDER' || role === 'ADMIN'));
      if (isOwner) return { can: true };
      return { can: (cache?.permissions ?? []).includes('team:manage') };
    }
    // 1) 角色层显隐（前端菜单显隐，数据权限仍由后端强制）
    const roleDecision = canSeeByRole(res, role, staff);
    if (roleDecision !== null) return { can: roleDecision };
    // 2) 细粒度权限：已显式映射的资源按权限串判定，缺失权限即拒绝（fail-closed）
    const perm = permFor(res, String(action));
    if (perm) return { can: (cache?.permissions ?? []).includes(perm) };
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
