/**
 * 角色落点单一真值源（Server）。
 *
 * 抽取自 auth/auth.service.ts，供以下场景共享（此前 auth.service 内的私有常量无法被守卫复用）：
 *  - 登录 / 刷新令牌：计算并下发 `home`；
 *  - RolesGuard：403 响应体里回带「当前权威身份」，使前端能零额外请求比对出资质漂移。
 *
 * `origin` 是逻辑端标识（web = 用户端 :5173；admin = 运营端 :5174），由各自前端映射为基址，
 * 服务端不硬编码域名；与本端一致时前端内部跳转，不一致时走跨端登录态桥接（?ticket=）。
 * 改这张表即可改变任意角色的落点，前端无需改动。
 */
export const ROLE_HOME: Record<string, { origin: 'web' | 'admin'; path: string }> = {
  USER: { origin: 'web', path: '/user/works' },
  SERVICE_PROVIDER: { origin: 'admin', path: '/sp/studio' },
  AGENT: { origin: 'admin', path: '/agent/dashboard' },
  ADMIN: { origin: 'admin', path: '/admin/dashboard' },
};

/**
 * P1（员工登录落点）：USER 身份 + 有效组织成员关系时，按主要成员关系所在层进入运营端工作台。
 * 员工沿用 USER 平台身份，不新增角色，故落点需由「组织成员关系」推导。
 */
export const STAFF_HOME: Record<'PROVIDER' | 'AGENT' | 'CONSOLE', { origin: 'web' | 'admin'; path: string }> = {
  PROVIDER: { origin: 'admin', path: '/sp/studio' },
  AGENT: { origin: 'admin', path: '/agent/dashboard' },
  CONSOLE: { origin: 'admin', path: '/admin/dashboard' },
};

interface StaffLike {
  orgType?: string;
}

/**
 * 计算某用户当前应落地的工作台。
 * 未知角色兜底为终端用户（web），与登录/刷新令牌保持同一口径。
 */
export function homeForRole(role: string | undefined | null, staff?: StaffLike[] | null): {
  origin: 'web' | 'admin';
  path: string;
} {
  if (role === 'USER' && staff && staff.length) {
    return STAFF_HOME[(staff[0]?.orgType as 'PROVIDER' | 'AGENT' | 'CONSOLE')] ?? ROLE_HOME.USER;
  }
  return ROLE_HOME[role ?? 'USER'] ?? ROLE_HOME.USER;
}
