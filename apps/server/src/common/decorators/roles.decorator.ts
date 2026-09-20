/**
 * @Roles() 装饰器 — 标记路由所需的最小角色权限。
 *
 * 用法：
 *   @Roles('ADMIN')
 *   @UseGuards(AuthGuard('jwt'), RolesGuard)
 *
 * 配合 RolesGuard 使用，后者通过 Reflect 读取此元数据并比对 req.user.role。
 * 路由不加 @Roles() 时视为公开接口，RolesGuard 直接放行。
 *
 * 注意：RolesGuard 作为方法级守卫与 AuthGuard('jwt') 一起使用，
 * 执行顺序为 AuthGuard 先行（写入 req.user），随后 RolesGuard 校验角色。
 * 这是因为 NestJS 全局守卫优先于方法级守卫执行，若 RolesGuard 注册全局，
 * 将无法保证 JWT 认证先于角色校验完成。
 */
import { SetMetadata } from '@nestjs/common';
import type { Role } from '../../../prisma/prisma-client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
