/**
 * AppLayout — 全站布局外壳
 * 顶部固定 SiteHeader 已合并底部导航功能；底部 TabBar 移除。
 */
import { Outlet } from 'react-router-dom';
import SiteHeader from '@/components/SiteHeader';

export default function AppLayout() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="pt-16">
        <Outlet />
      </main>
    </div>
  );
}
