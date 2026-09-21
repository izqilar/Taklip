/**
 * @OrgAccess() 装饰器 — 标记路由「允许哪些组织层进入」（P1 员工登录门控）。
 *
 * 设计动机（docs/平台角色边界规范化.md §3.2 / §10.1）：
 *   员工沿用现有 USER 平台身份，靠 OrgStaff 成员关系提权进入对应层控制台。
 *   因此单纯按 User.role 的 RolesGuard 会拒绝 USER 身份的员工 —— 需要一套
 *   「legacy 角色 或 有效员工关系」二选一的门控。
 *
 * 用法：
 *   @OrgAccess('PROVIDER')                                  // 读：本层 legacy 角色 或 任意 ACTIVE 员工
 *   @OrgAccess('PROVIDER', { requirePerm: 'team:manage' })  // 写：本层 legacy 角色 或 持有该权限的员工
 *   @UseGuards(OrgAccessGuard)
 *
 * 由 OrgAccessGuard 读取此元数据执行判定。
 */
import { SetMetadata } from '@nestjs/common';

export type OrgLayer = 'PROVIDER' | 'AGENT' | 'CONSOLE';

export interface OrgAccessMeta {
  layer: OrgLayer;
  /** 需要的员工功能权限（写操作通常传 team:manage）。省略则任意 ACTIVE 员工即可。 */
  requirePerm?: string;
}

export const ORG_ACCESS_KEY = 'orgAccess';
export const OrgAccess = (layer: OrgLayer, opts?: { requirePerm?: string }) =>
  SetMetadata(ORG_ACCESS_KEY, { layer, requirePerm: opts?.requirePerm } as OrgAccessMeta);
