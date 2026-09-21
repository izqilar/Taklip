/**
 * OrgAccessGuard — 组织层进入门控（P1 员工登录核心 guard）。
 *
 * 判定（文档 §3.2 / §9 / §10.1）：
 *   满足任一即放行 ——
 *   1) legacy 角色命中：PROVIDER 层 → SERVICE_PROVIDER/ADMIN；AGENT 层 → AGENT/ADMIN；
 *      CONSOLE 层 → ADMIN（这些角色天然是该组织的拥有者 / 视察者，拥有完整权限）；
 *   2) 有效员工关系：req.user.staff 中含 orgType === layer 的 ACTIVE 成员
 *      - 无 requirePerm → 任意 ACTIVE 员工可进入（读操作）
 *      - 有 requirePerm → 该员工 funcPerms 必须含该权限（写操作，落实 R-03 防自我提权）
 *
 * 与 RolesGuard 的差异：RolesGuard 只看 User.role，会把 USER 身份的员工挡在门外；
 * 本 guard 额外消费 req.user.staff（由 jwt.strategy 实时注入的 OrgStaff 上下文），
 * 即「guard 消费权限」。
 *
 * 注意：DISSCOPE / 数据范围在 StaffService 内按层白名单校验，本 guard 只负责「能否进入该层」。
 */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ORG_ACCESS_KEY, type OrgAccessMeta, type OrgLayer } from '../decorators/org-access.decorator';
import type { Role } from '../../../prisma/prisma-client';
import type { JwtUser } from '../types/jwt-user';

/** 各层 legacy 角色白名单（拥有者 / 平台视察者） */
const LEGACY_ROLES: Record<OrgLayer, Role[]> = {
  PROVIDER: ['SERVICE_PROVIDER', 'ADMIN'],
  AGENT: ['AGENT', 'ADMIN'],
  CONSOLE: ['ADMIN'],
};

@Injectable()
export class OrgAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const meta = this.reflector.getAllAndOverride<OrgAccessMeta>(ORG_ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // 未标注 @OrgAccess → 不归本 guard 管辖，交由其它守卫 / 公开策略处理
    if (!meta) return true;

    const req = context.switchToHttp().getRequest<{ user?: JwtUser }>();
    const user = req.user;
    if (!user || !user.id) {
      throw new UnauthorizedException('需要登录后访问');
    }

    // 1) legacy 角色命中 → 放行（拥有者拥有完整权限，不受 requirePerm 限制）
    if (meta.layer && LEGACY_ROLES[meta.layer]?.includes(user.role)) {
      return true;
    }

    // 2) 有效员工关系（仅 ACTIVE；DISABLED 已被 jwt.strategy 剔除）
    const memberships = user.staff ?? [];
    const inLayer = memberships.filter((m) => m.orgType === meta.layer);
    if (inLayer.length === 0) {
      throw new ForbiddenException('权限不足：你不是该组织的有效成员');
    }
    if (meta.requirePerm) {
      const ok = inLayer.some((m) => (m.funcPerms ?? []).includes(meta.requirePerm!));
      if (!ok) {
        // R-03：写操作需 team:manage 等所有者权限，员工默认不具备
        throw new ForbiddenException(`权限不足：需要组织权限 ${meta.requirePerm}`);
      }
    }
    return true;
  }
}

/**
 * 解析「当前操作者在其员工关系中所属某层的组织 id」。
 *
 * - legacy 拥有者（SERVICE_PROVIDER / AGENT / ADMIN）本身即组织，返回 null（由调用方用
 *   subjectId / req.user.id / CONSOLE_ORG_ID 取组织 id）；
 * - 员工（USER 身份）返回其 OrgStaff 成员关系中匹配 layer 的 orgId，供 team 列表按正确
 *   组织查询；无匹配则返回 null（guard 会先拦截，此处兜底）。
 */
export function staffOrgIdOf(user: JwtUser | undefined, layer: OrgLayer): string | null {
  if (!user) return null;
  const m = (user.staff ?? []).find((s) => s.orgType === layer);
  return m?.orgId ?? null;
}
