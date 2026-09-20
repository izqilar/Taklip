/**
 * 角色路由守卫 — 在 ProtectedRoute 基础上增加角色校验。
 * 未登录 → 跳转登录页；角色不符 → 跳转首页。
 */
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import type { UserRole } from '@/api/client';

export default function RoleRoute({
  children,
  requiredRoles,
}: {
  children: ReactNode;
  /** 允许访问的角色列表。为空时仅要求登录。 */
  requiredRoles?: UserRole[];
}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userRole = useAuthStore((s) => s.user?.role);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles && !requiredRoles.includes(userRole as UserRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
