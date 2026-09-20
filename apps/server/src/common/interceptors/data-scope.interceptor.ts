/**
 * DataScopeInterceptor — 数据权限作用域拦截器（角色管理管线 P1）。
 *
 * 在 JWT 守卫填充 req.user 之后运行，依据操作者的角色+区域维度计算「数据作用域」，
 * 并将其挂到 req.dataScope（一个 Prisma.UserWhereInput 片段）。各管理 service 在
 * 构造查询时把 scope 合并进 where，从而保证「数据权限的唯一真相源在后端」。
 *
 * 作用域规则：
 *   - ADMIN   → {}              全量（不限区域）
 *   - AGENT   → regionPath 前缀匹配其辖区
 *   - 其他    → { id: 本人 }    仅自己（管理接口本就不对该类角色开放）
 *
 * 注意：前端（Refine accessControlProvider）只做菜单/按钮显隐，绝非安全屏障；
 * 真正越权防护靠本拦截器注入的 where 条件 + RolesGuard 角色级校验。
 */
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { Prisma } from '../../../prisma/prisma-client';
import type { JwtUser } from '../types/jwt-user';

/** 计算数据作用域 where 片段（纯函数，便于单测与 service 直接复用） */
export function buildDataScope(user: JwtUser): Prisma.UserWhereInput {
  if (user.role === 'ADMIN') {
    return {};
  }
  if (user.role === 'AGENT' && user.regionPath) {
    return { regionPath: { startsWith: user.regionPath } };
  }
  // 普通用户/未绑定区域的代理商：仅能看到自己
  return { id: user.id };
}

@Injectable()
export class DataScopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ user?: JwtUser; dataScope?: Prisma.UserWhereInput }>();
    if (req.user) {
      req.dataScope = buildDataScope(req.user);
    }
    return next.handle();
  }
}
