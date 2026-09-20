import { Suspense, type ReactNode } from 'react';
import { T } from '../../config/theme';
import { LayerHeader } from './LayerHeader';
import { LayerSider } from './LayerSider';
import { ReadonlyBanner } from './ReadonlyBanner';
import { ObjectScopeBar } from './ObjectScopeBar';
import { StatePreview } from '../ui/StatePreview';
import { useLayer } from '../../providers/layerContext';
import { getStoredUser } from '../../utility';

/** 懒加载页面的统一占位（配色取主题令牌，不硬编码） */
const PageLoading = () => (
  <div
    style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 240,
      color: T.ink3,
      fontSize: 13,
    }}
  >
    …
  </div>
);

/**
 * 三段式布局（原型 .app）：左导航 240 + 右主区，主区内 顶栏 sticky → 对象工具栏 → 内容。
 * 文档 §6.1；尺寸/配色全部取自 config/theme 令牌，不在此硬编码。
 */
export const AdminLayout = ({ children }: { children: ReactNode }) => {
  const { view, preview, setPreview } = useLayer();
  const role = getStoredUser<{ role?: string }>()?.role;
  const isAdmin = role === 'ADMIN';
  const viewAs = view === 'agent' || view === 'provider' || view === 'user';
  // 对象检索条（视察窗口）仅 ADMIN 可见：服务商/Agent/用户自身登录即是对象，无需检索。
  const showScopeBar = viewAs && isAdmin;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `${T.side}px 1fr`,
        minHeight: '100vh',
        background: T.page,
      }}
    >
      {/* ── 侧栏：sticky 满高，品牌区 + 导航 + 底部署名 ── */}
      <aside
        style={{
          background: T.bg,
          borderInlineEnd: `1px solid ${T.border}`,
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
          minWidth: 0,
        }}
      >
        <LayerSider />
      </aside>

      {/* ── 主区：顶栏 +（对象工具栏）+ 内容 ── */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 24px',
            borderBottom: `1px solid ${T.border}`,
            background: T.bg,
            position: 'sticky',
            top: 0,
            zIndex: 20,
            minHeight: T.header,
            flexWrap: 'wrap',
          }}
        >
          <LayerHeader />
        </header>

        {showScopeBar && <ObjectScopeBar />}

        <main
          style={{
            padding: '20px 24px 32px',
            display: 'flex',
            flexDirection: 'column',
            gap: T.gap,
            minWidth: 0,
          }}
        >
          <ReadonlyBanner />
          {preview === 'data' ? (
            // 页面组件均为 React.lazy 按需加载（见 App.tsx），Suspense 放在内容区而非整个布局外：
            // 切换路由时侧栏/顶栏不闪、不重建，只有主区显示占位。
            <Suspense fallback={<PageLoading />}>{children}</Suspense>
          ) : (
            <StatePreview
              state={preview}
              onRetry={() => setPreview('data')}
              onCreate={() => setPreview('data')}
            />
          )}
        </main>
      </div>
    </div>
  );
};
