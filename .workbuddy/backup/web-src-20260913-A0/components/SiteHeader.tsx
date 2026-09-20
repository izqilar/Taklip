/**
 * SiteHeader — 新版固定顶部导航栏（红色主题）
 * Logo「庆柬」金+「云」白；导航 首页/模板库/设计工坊/服务云（带二级菜单）；
 * 金色「服务商入住」按钮；登录前显示 登录/注册，登录后显示头像下拉。
 * 底部 6 Tab 已合并至此，全局固定顶部。
 */
import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { api, getStoredToken } from '@/api/client';
import { useEditorStore } from '@/store/editorStore';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const NAV_LINKS = [
  { to: '/', key: 'home' },
  { to: '/templates', key: 'templates' },
  { to: '/templates', key: 'designStudio' },
  { to: '/find-services', key: 'findServices' },
] as const;

const SERVICE_CLOUD_ITEMS = [
  {
    key: 'design',
    labelKey: 'common:providers.design.name',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19l7-7 3 3-7 7-3-3z" />
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
        <path d="M2 2l7.586 7.586" />
        <circle cx="11" cy="11" r="2" />
      </svg>
    ),
  },
  {
    key: 'photo',
    labelKey: 'common:providers.photo.name',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
        <circle cx="12" cy="13" r="3" />
      </svg>
    ),
  },
  {
    key: 'venue',
    labelKey: 'common:providers.venue.name',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 18v-7" />
        <path d="M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z" />
        <path d="M14 18v-7" />
        <path d="M18 18v-7" />
        <path d="M3 22h18" />
        <path d="M6 18v-7" />
      </svg>
    ),
  },
  {
    key: 'floral',
    labelKey: 'common:providers.floral.name',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 7v14" />
        <path d="M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8" />
        <path d="M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5" />
        <rect x="3" y="7" width="18" height="4" rx="1" />
      </svg>
    ),
  },
  {
    key: 'ritual',
    labelKey: 'common:providers.ritual.name',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
        <path d="m12.474 5.943 1.567 5.34a1 1 0 0 0 1.75.328l2.616-3.402" />
        <path d="m20 9-3 9" />
        <path d="m5.594 8.209 2.615 3.403a1 1 0 0 0 1.75-.329l1.567-5.34" />
        <path d="M7 18 4 9" />
        <circle cx="12" cy="4" r="2" />
        <circle cx="20" cy="7" r="2" />
        <circle cx="4" cy="7" r="2" />
      </svg>
    ),
  },
  {
    key: 'show',
    labelKey: 'common:providers.show.name',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
  },
] as const;

// 运营端（管理后台）地址：点「我的工作台」直接跳转过去
const ADMIN_BASE = 'http://localhost:5174';

// 账号下拉菜单：仅保留 我的作品 / 我的工作台 / 退出 三项。
// 其余菜单项（我的订单、我的消息、服务商/代理商工作台、账号设置等）按需求清理。
const USER_MENU_ITEMS = [
  {
    kind: 'link' as const,
    key: 'common:nav.myWorks',
    to: '/dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2" />
        <circle cx="14" cy="15" r="1" />
      </svg>
    ),
  },
  {
    kind: 'external' as const,
    key: 'common:nav.myWorkbench',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="14" x="2" y="3" rx="2" />
        <line x1="8" x2="16" y1="21" y2="21" />
        <line x1="12" x2="12" y1="17" y2="21" />
      </svg>
    ),
  },
  {
    kind: 'logout' as const,
    key: 'common:nav.logout',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    ),
  },
] as const;

export default function SiteHeader() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const initial = (user?.nickname || user?.phone || 'U').toString().slice(0, 1);

  // 普通 USER（未登录或角色为 USER）不显示「服务商入住」金色按钮
  const isPlainUser = !user || user.role === 'USER';

  const newProject = useEditorStore((s) => s.newProject);

  // 点击「设计工坊」：登录后创建新作品并进入编辑器（处于新建空白 H5 状态）
  const handleDesignStudio = useCallback(async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/design-studio' } });
      return;
    }
    try {
      const res = await api.createProject(t('common:status.untitled'));
      newProject();
      navigate(`/editor/${res.id}`);
    } catch {
      alert(t('errors:dashboard.createFailed'));
    }
  }, [isAuthenticated, navigate, newProject, t]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="fixed left-0 right-0 top-0 z-50 bg-[#c81e42] text-white shadow-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
        {/* Logo：庆柬（金）+ 云（白） */}
        <Link to="/" className="flex flex-shrink-0 items-center gap-0.5 text-2xl font-extrabold tracking-tight">
          <span className="text-yellow-400 drop-shadow-sm">庆柬</span>
          <span className="text-white drop-shadow-sm">云</span>
        </Link>

        {/* 主导航 */}
        <nav className="hidden items-center text-sm font-medium lg:flex">
          {NAV_LINKS.map((link, idx) => {
            const isLast = idx === NAV_LINKS.length - 1;
            const dividerClass = isLast ? '' : 'border-r border-white/20';

            if (link.key === 'designStudio') {
              return (
                <button
                  key={link.key}
                  type="button"
                  onClick={handleDesignStudio}
                  className={`px-3 py-2 text-left transition hover:text-yellow-200 ${dividerClass}`}
                >
                  {t(`common:nav.${link.key}`)}
                </button>
              );
            }

            if (link.key === 'findServices') {
              return (
                <div key={link.key} className={`group relative px-3 py-2 ${dividerClass}`}>
                  <Link
                    to={link.to}
                    className="flex items-center gap-1 transition hover:text-yellow-200"
                  >
                    {t(`common:nav.${link.key}`)}
                    <svg className="h-3 w-3 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </Link>
                  {/* 二级菜单：鼠标停靠弹出 */}
                  <div className="absolute left-0 top-full hidden w-40 rounded-b-lg border border-white/10 bg-[#c81e42] py-2 shadow-xl group-hover:block">
                    {SERVICE_CLOUD_ITEMS.map((item) => (
                      <Link
                        key={item.key}
                        to="/find-services"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-white transition hover:bg-white/10 hover:text-yellow-200"
                      >
                        <span className="flex h-5 w-5 items-center justify-center opacity-90">{item.icon}</span>
                        {t(item.labelKey)}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <Link
                key={link.key}
                to={link.to}
                className={`px-3 py-2 transition hover:text-yellow-200 ${dividerClass}`}
              >
                {t(`common:nav.${link.key}`)}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => navigate('/quick-make')}
            className="flex items-center gap-1 px-3 py-2 font-semibold text-yellow-200 transition hover:text-white"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-land-plot h-4 w-4"
            >
              <path d="m12 8 6-3-6-3v10" />
              <path d="m8 11.99-5.5 3.14a1 1 0 0 0 0 1.74l8.5 4.86a2 2 0 0 0 2 0l8.5-4.86a1 1 0 0 0 0-1.74L16 12" />
              <path d="m6.49 12.85 11.02 6.3" />
              <path d="M17.51 12.85 6.5 19.15" />
            </svg>
            {t('common:nav.quickMake')}
          </button>
          {/* 我的作品：与账号菜单同名项功能一致，点击跳转到我的作品页 /dashboard */}
          <Link
            to="/dashboard"
            className="ml-1 flex items-center gap-1 rounded-full bg-white px-4 py-1.5 text-sm font-bold text-[#c81e42] shadow-sm transition hover:bg-gray-100"
          >
            {/* 文件夹图标：与账号菜单「我的作品」同名项前的图标一致 */}
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2" />
              <circle cx="14" cy="15" r="1" />
            </svg>
            {t('common:nav.myWorks')}
          </Link>
        </nav>

        {/* 右侧操作区 */}
        <div className="flex flex-shrink-0 items-center gap-3">
          {/* 服务商入住（金色药丸按钮）：普通 USER 不显示 */}
          {!isPlainUser && (
            <Link
              to="/find-services"
              className="hidden rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-4 py-1.5 text-sm font-sans font-normal text-[#c81e42] shadow-sm transition hover:from-amber-500 hover:to-yellow-600 md:inline-flex"
            >
              {t('common:nav.providerEntry')}
            </Link>
          )}

          {isAuthenticated ? (
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 font-sans text-sm font-normal uppercase text-white transition hover:bg-white/30"
                aria-label="user menu"
              >
                {initial}
              </button>
              {menuOpen && (
                <div className="absolute end-0 z-50 mt-2 w-44 rounded-lg border border-white/10 bg-[#c81e42] py-2 shadow-xl">
                  {USER_MENU_ITEMS.map((item) => {
                    const iconNode = (
                      <span className="flex h-5 w-5 items-center justify-center">{item.icon}</span>
                    );

                    // 退出：先清登录态，再整页跳回 web 端公开首页。
                    // 用整页刷新而非 SPA 内 navigate，避免仍停留在受保护路由时 ProtectedRoute 把目标重定向到 /login。
                    if (item.kind === 'logout') {
                      return (
                        <button
                          key={item.key}
                          onClick={() => {
                            setMenuOpen(false);
                            logout();
                            window.location.href = '/';
                          }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-start text-sm text-white transition hover:bg-white/10 hover:text-yellow-200"
                        >
                          {iconNode}
                          {t(item.key)}
                        </button>
                      );
                    }

                    // 我的工作台：跨域在新窗口打开运营端（管理后台）首页，
                    // 并带上当前登录态（JWT + 用户信息）以保持登录状态。
                    if (item.kind === 'external') {
                      const tok = getStoredToken();
                      const userPart = user
                        ? `&user=${encodeURIComponent(JSON.stringify(user))}`
                        : '';
                      const href = tok
                        ? `${ADMIN_BASE}?token=${encodeURIComponent(tok)}${userPart}`
                        : ADMIN_BASE;
                      return (
                        <a
                          key={item.key}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-white transition hover:bg-white/10 hover:text-yellow-200"
                        >
                          {iconNode}
                          {t(item.key)}
                        </a>
                      );
                    }

                    // 我的作品：跳转到原有我的作品页
                    const active = location.pathname === item.to;
                    return (
                      <Link
                        key={item.key}
                        to={item.to}
                        onClick={() => setMenuOpen(false)}
                        className={`flex items-center gap-3 px-4 py-2.5 text-sm transition ${
                          active
                            ? 'bg-white/10 text-yellow-200'
                            : 'text-white hover:bg-white/10 hover:text-yellow-200'
                        }`}
                      >
                        {iconNode}
                        {t(item.key)}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="rounded-full border border-white/60 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-white/10"
              >
                {t('common:nav.login')}
              </Link>
              <Link
                to="/register"
                className="rounded-full bg-white px-4 py-1.5 text-sm font-bold text-[#c81e42] shadow-sm transition hover:bg-gray-100"
              >
                {t('common:nav.register')}
              </Link>
            </div>
          )}

          <LanguageSwitcher variant="globe" />
        </div>
      </div>
    </header>
  );
}
