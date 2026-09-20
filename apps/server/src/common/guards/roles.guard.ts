/**
 * RolesGuard — 基于 @Roles() 装饰器的 RBAC 守卫。
 *
 * 配合 JWT 认证守卫一起使用（@UseGuards(AuthGuard('jwt'), RolesGuard)），
 * 确保 JWT 先行填充 req.user，随后才进行角色比对。
 */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { Role } from '../../../prisma/prisma-client';

interface AuthenticatedRequest {
  user?: {
    id: string;
    role: Role;
    [key: string]: unknown;
  };
}

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
    const userRole = request.user?.role;

    if (!userRole) {
      // 此时 JWT auth guard 应已执行。若 user 仍为空，说明未认证
      throw new ForbiddenException('需要登录后访问');
    }

    if (!requiredRoles.includes(userRole)) {
      throw new ForbiddenException('权限不足，无法访问此资源');
    }

    return true;
  }
}
