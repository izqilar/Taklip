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
}
