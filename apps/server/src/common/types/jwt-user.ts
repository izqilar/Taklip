/**
 * JwtUser — JWT 策略 (jwt.strategy.ts) validate() 返回的已认证用户画像。
 *
 * 该类型被 DataScopeInterceptor、各管理控制器、accessControlProvider 等共用，
 * 作为「当前操作者」的统一形状。角色管理管线（P0）在其中注入了区域维度字段：
 * regionId / agentId / regionPath / status。
 */
import type { Role, ServiceRole, ProviderStatus, UserStatus } from '../../../prisma/prisma-client';

export interface JwtUser {
  id: string;
  phone?: string | null;
  nickname?: string | null;
  avatar?: string | null;
  vipLevel?: number;
  locale?: string | null;
  role: Role;
  serviceRoles?: ServiceRole[];
  pendingServiceRoles?: ServiceRole[];
  providerStatus?: ProviderStatus;
  // —— 角色管理管线（P0）区域维度 ——
  regionId?: string | null;
  agentId?: string | null;
  regionPath?: string | null;
  status: UserStatus;
  realName?: string | null;
  bio?: string | null;
  email?: string | null;
  // —— 角色管理管线（P1）组织内员工上下文 ——
  // 仅含 ACTIVE 成员关系（DISABLED 已被剔除，R-05/R-06）。
  // 员工沿用 USER 平台身份，靠此数组「组织成员关系」提权进入对应层控制台。
  staff?: StaffMembership[];
}

/**
 * 组织内员工成员关系（注入 JWT / req.user，P1）。
 * 由 jwt.strategy + auth.service 在登录 / 每次请求时从 OrgStaff 实时计算。
 */
export interface StaffMembership {
  sid: string; // OrgStaff.id
  orgType: 'PROVIDER' | 'AGENT' | 'CONSOLE';
  orgId: string;
  staffRole: string;
  funcPerms: string[];
  dataScope: string;
  accountStatus: string;
}
