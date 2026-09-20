/**
 * AppLayout — 全站布局外壳
 * 顶部固定 SiteHeader 已合并底部导航功能；底部 TabBar 移除。
 */
import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import SiteHeader from '@/components/SiteHeader';

/**
 * 路由页面多为 React.lazy 按需加载（详见 App.tsx 中的说明）。
 * Suspense 放在 <Outlet /> 外侧而非整个布局外层：这样切换路由时
 * 顶部 SiteHeader 不闪、不重建，只有内容区显示占位。
 */
export default function AppLayout() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="pt-16">
        <Suspense
          fallback={<div className="flex min-h-[60vh] items-center justify-center text-sm text-gray-400">…</div>}
        >
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
