/**
 * RolesGuard — 基于 @Roles() 装饰器的 RBAC 守卫。
 *
 * 配合 JWT 认证守卫一起使用（@UseGuards(AuthGuard('jwt'), RolesGuard)），
 * 确保 JWT 先行填充 req.user，随后才进行角色比对。
 *
 * ⚠️ 角色/资质漂移（identity drift）：
 * JWT 每次请求都由 JwtStrategy 从数据库重读角色（role / providerStatus 始终为权威值），
 * 但**前端缓存的是登录那一刻的快照**。当账号资质在后台被变更时：
 *   - 普通用户升级为服务商 → /api/user/*（@Roles ADMIN|AGENT|USER）开始 403；
 *   - 服务商/代理商降级为普通用户 → /api/provider/*、/api/agent/* 开始 403。
 * 因此本守卫在 403 响应体额外回带「当前权威身份」（code=ROLE_MISMATCH + identity），
 * 前端响应拦截层据此与本地快照比对即可判定漂移，无需再发一次自查请求。
 *
 * 注意：message 保持为字符串 —— 既有前端 dataProvider.parse() 会把数组 join、把对象当文本，
 * 附加字段（code / identity）与它正交，不影响原有错误提示链路。
 */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { homeForRole } from '../identity/role-home';
import type { Role } from '../../../prisma/prisma-client';

interface AuthenticatedRequest {
  user?: {
    id: string;
    role: Role;
    providerStatus?: string | null;
    serviceRoles?: string[];
    staff?: { orgType?: string }[];
    [key: string]: unknown;
  };
}

/** 机器可读错误码：供前端区分「权限不足」与「账号资质已变更」 */
export const ROLE_MISMATCH_CODE = 'ROLE_MISMATCH';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 无 @Roles() 元数据 → 公开路由，直接放行
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    const userRole = user?.role;

    if (!userRole) {
      // 此时 JWT auth guard 应已执行。若 user 仍为空，说明未认证
      throw new ForbiddenException('需要登录后访问');
    }

    if (!requiredRoles.includes(userRole)) {
      throw new ForbiddenException({
        message: '权限不足，无法访问此资源',
        code: ROLE_MISMATCH_CODE,
        identity: {
          id: user?.id ?? null,
          role: userRole,
          providerStatus: user?.providerStatus ?? null,
          serviceRoles: user?.serviceRoles ?? [],
          // 当前资质应落地的工作台（origin 决定该账号本该去哪个端）
          home: homeForRole(userRole, user?.staff),
        },
      });
    }

    return true;
  }
}
