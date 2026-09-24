import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { T } from '../../config/theme';
import { LayerHeader } from './LayerHeader';
import { LayerSider } from './LayerSider';
import { ReadonlyBanner } from './ReadonlyBanner';
import { ObjectScopeBar } from './ObjectScopeBar';
import { StatePreview } from '../ui/StatePreview';
import { useLayer, viewOfRole } from '../../providers/layerContext';
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
 *
 * 2026-09-20 响应式（P3-⑥）：宽屏（≥900px）维持原 240px 固定侧栏 + 1fr 主区，外观不变；
 * 窄屏（<900px）侧栏改为 fixed 抽屉（由顶栏汉堡按钮开合，配半透明遮罩），主区单列，
 * 不再被固定 240px 侧栏挤压导致窄屏错乱。
 */
export const AdminLayout = ({ children }: { children: ReactNode }) => {
  const { view, preview, setPreview } = useLayer();
  const role = getStoredUser<{ role?: string }>()?.role;
  // 对象检索条（视察窗口）：仅在「非自身视角」显示 —— 即 ADMIN 视察他人，
  // 或真实 AGENT 在用户视角视察辖区用户。真实 SERVICE_PROVIDER/AGENT/USER 登录后的
  // 自身工作台（view 即等于自身角色）不显示检索条，因为他们就是对象本身。
  const showScopeBar = view !== viewOfRole(role);

  // 响应式断点：窄屏（≤900px）侧栏转抽屉；监听变化，回到宽屏自动收起抽屉
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches,
  );
  const [siderOpen, setSiderOpen] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const onChange = (e: MediaQueryListEvent) => {
      setNarrow(e.matches);
      if (!e.matches) setSiderOpen(false); // 回到宽屏自动收起抽屉，避免遮挡主区
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: narrow ? '1fr' : `${T.side}px 1fr`,
        minHeight: '100vh',
        background: T.page,
        overflowX: narrow ? 'hidden' : undefined,
        position: 'relative',
      }}
    >
      {/* ── 侧栏：宽屏 sticky 满高；窄屏 fixed 抽屉（siderOpen 控制滑入） ── */}
      <aside
        style={{
          background: T.bg,
          borderInlineEnd: `1px solid ${T.border}`,
          display: 'flex',
          flexDirection: 'column',
          position: narrow ? 'fixed' : 'sticky',
          top: 0,
          left: narrow ? 0 : undefined,
          height: '100vh',
          width: narrow ? '240px' : undefined,
          minWidth: 0,
          zIndex: narrow ? 100 : undefined,
          transform: narrow ? (siderOpen ? 'translateX(0)' : 'translateX(-100%)') : undefined,
          transition: narrow ? 'transform .2s ease' : undefined,
          boxShadow: narrow && siderOpen ? T.shadowPop : undefined,
        }}
      >
        <LayerSider onNavigate={narrow ? () => setSiderOpen(false) : undefined} />
      </aside>

      {/* ── 窄屏遮罩：点击关闭抽屉 ── */}
      {narrow && siderOpen && (
        <div
          onClick={() => setSiderOpen(false)}
          aria-hidden
          style={{ position: 'fixed', inset: 0, background: T.scrim, zIndex: 90 }}
        />
      )}

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
          <LayerHeader showMenu={narrow} onMenu={() => setSiderOpen((o) => !o)} />
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
