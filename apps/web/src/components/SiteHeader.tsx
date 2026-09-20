/**
 * SiteHeader — 新版固定顶部导航栏（红色主题）
 * Logo「庆柬」金+「云」白；导航 首页/模板库/服务云/设计工坊（带二级菜单）；
 * 金色「服务商入住」按钮；登录前显示 登录/注册，登录后显示账号胶囊（红底白边）+ 账号下拉面板。
 * 底部 6 Tab 已合并至此，全局固定顶部。
 */
import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { api, type UserInfo } from '@/api/client';
import { cleanCode } from '@h5design/core';
// 只取 store（轻量）——切勿从 '@h5design/editor' 主入口导入，
// 那会把整个画布内核（Konva/GSAP，约 4MB）拖进全站顶部导航的首屏依赖。
import {useEditorStore} from '@h5design/editor/store';
import LanguageSwitcher from '@/components/LanguageSwitcher';
// 账号胶囊 + 账号下拉面板样式：镜像运营端 apps/admin/src/styles/account-panel.css
import '@/styles/account-panel.css';

// 顺序口径：首页 / 模板库 / 服务云 / 设计工坊（服务云与设计工坊互换后的结果）
const NAV_LINKS = [
  { to: '/', key: 'home' },
  { to: '/templates', key: 'templates' },
  { to: '/find-services', key: 'findServices' },
  { to: '/templates', key: 'designStudio' },
] as const;

/** 移动端抽屉导航内容（与主航一致；窄屏时主航隐藏，由此提供入口） */
const MOBILE_NAV: { type: 'link' | 'action'; to?: string; key: string }[] = [
  { type: 'link', to: '/', key: 'home' },
  { type: 'link', to: '/templates', key: 'templates' },
  { type: 'link', to: '/find-services', key: 'findServices' },
  { type: 'action', key: 'designStudio' },
  { type: 'action', key: 'quickMake' },
  { type: 'link', to: '/user/works', key: 'myWorks' },
];

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

/** 手机号脱敏：11 位手机号保留前 3 后 4，中间以 **** 遮蔽；其余原样返回。 */
function maskPhone(phone?: string | null): string {
  if (!phone) return '';
  const s = String(phone);
  return /^1\d{10}$/.test(s) ? `${s.slice(0, 3)}****${s.slice(-4)}` : s;
}

/**
 * 认证标签：服务商看资质状态，其余看实名状态（与运营端 AccountPill.authTag 同口径）。
 * cls 直接取运营端 account-panel.css 的语义类名（ok/warn/bad/mut），
 * 由 account-panel.css 提供「浅底深字」配色，两端观感一致。
 */
function authTag(user: UserInfo | null): { key: string; cls: string } {
  if (user?.role === 'SERVICE_PROVIDER') {
    switch (user.providerStatus) {
      case 'APPROVED':
        return { key: 'common:account.provider.APPROVED', cls: 'ok' };
      case 'PENDING':
        return { key: 'common:account.provider.PENDING', cls: 'warn' };
      case 'REJECTED':
        return { key: 'common:account.provider.REJECTED', cls: 'bad' };
      default:
        return { key: 'common:account.provider.NONE', cls: 'mut' };
    }
  }
  switch (user?.realNameStatus) {
    case 'APPROVED':
      return { key: 'common:account.realName.APPROVED', cls: 'ok' };
    case 'PENDING':
      return { key: 'common:account.realName.PENDING', cls: 'warn' };
    case 'REJECTED':
      return { key: 'common:account.realName.REJECTED', cls: 'bad' };
    default:
      return { key: 'common:account.realName.NONE', cls: 'mut' };
  }
}

/**
 * 账号下拉菜单内容 —— 对齐运营端 `config/accountPanel.tsx` 的 `ACCOUNT_NAV.user`：
 *   ④ 快捷入口 = 我的订单 / 优惠与权益 / 我的钱包
 *   ⑤ 底部工具 = 我的服务商 / 评价反馈 / 消息中心 / 账户详情
 *
 * web 端的两点增删（按需求）：
 *   + 「个人中心」置于快捷入口首位（终端用户的一站式入口）
 *   − 去掉运营端的「返回Web端首页」；去掉原「我的工作台」（不再放行 :5174 运营端）
 *
 * 口径：终端用户的全部操作都在 web（:5173）完成，运营端的工作台只留给超级管理员
 *      从四层角色视角观察/修改数据，故此处不提供任何通往 :5174 的入口。
 */
const ACCOUNT_LINKS: { key: string; to: string; icon: ReactNode }[] = [
  {
    key: 'common:userCenter.title',
    to: '/user',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    key: 'common:userCenter.menu.orders',
    to: '/user/orders',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    ),
  },
  {
    key: 'common:userCenter.menu.coupons',
    to: '/user/coupons',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="8" width="18" height="13" rx="2" />
        <path d="M12 8v13" />
        <path d="M19 12v-2a3 3 0 0 0-3-3h-1.5a2.5 2.5 0 0 1 0-5H17a3 3 0 0 1 2 1" />
        <path d="M7.5 8a2.5 2.5 0 0 1 0-5H9" />
      </svg>
    ),
  },
  {
    key: 'common:userCenter.menu.wallet',
    to: '/user/wallet',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" />
        <path d="M16 12h.01" />
      </svg>
    ),
  },
];

/** 底部工具（纯文字横排，原型 .ap-tool）；文案与运营端 ACCOUNT_NAV.user.tools 逐字一致 */
const ACCOUNT_TOOLS: { key: string; to: string }[] = [
  { key: 'common:userCenter.menu.providers', to: '/user/providers' },
  { key: 'common:userCenter.panel.feedback', to: '/user/feedback' },
  { key: 'common:userCenter.panel.messages', to: '/user/messages' },
  { key: 'common:userCenter.menu.account', to: '/user/account' },
];

export default function SiteHeader() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const initial = (user?.nickname || user?.phone || 'U').toString().slice(0, 1);
  const displayName =
    user?.nickname || user?.realName || (user?.phone ? maskPhone(user.phone) : '未命名');
  const accountId = cleanCode(user?.id);
  const roleLabel = t(`common:role.${user?.role ?? 'USER'}`);
  const auth = authTag(user);

  const copyId = async () => {
    const text = accountId;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 非安全上下文（http）下 clipboard 不可用，退回选中提示即可，不臆造成功
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  // 普通 USER（未登录或角色为 USER）不显示「服务商入住」金色按钮
  const isPlainUser = !user || user.role === 'USER';

  // 退出登录：先清登录态，再整页跳回 web 端公开首页。
  // 用整页刷新而非 SPA 内 navigate，避免仍停留在受保护路由时 ProtectedRoute 把目标重定向到 /login。
  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    window.location.href = '/';
  };

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

  // 切回桌面宽度（≥1024px）时自动收起移动抽屉，避免回到大屏后抽屉残留
  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 1024) setMobileNavOpen(false);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <header className="fixed start-0 end-0 top-0 z-50 bg-[#c81e42] text-white shadow-md">
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
            const dividerClass = isLast ? '' : 'border-e border-white/20';

            if (link.key === 'designStudio') {
              return (
                <button
                  key={link.key}
                  type="button"
                  onClick={handleDesignStudio}
                  className={`px-3 py-2 text-start transition hover:text-yellow-200 ${dividerClass}`}
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
                  <div className="absolute start-0 top-full hidden w-40 rounded-b-lg border border-white/10 bg-[#c81e42] py-2 shadow-xl group-hover:block">
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
          {/* 我的作品：与其他导航项同款「菜单项」样式（图标 + 文字均为白色，hover 转金色）。
              点击跳转到个人中心内的我的作品页 /user/works。 */}
          <Link
            to="/user/works"
            className="flex items-center gap-1 px-3 py-2 transition hover:text-yellow-200"
          >
            {/* 文件夹图标：与账号菜单「我的作品」同名项前的图标一致（currentColor 继承白色） */}
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2" />
              <circle cx="14" cy="15" r="1" />
            </svg>
            {t('common:nav.myWorks')}
          </Link>
        </nav>

        {/* 右侧操作区 */}
        <div className="flex flex-shrink-0 items-center gap-3">
          {/* 移动端汉堡菜单：主航在 <lg 隐藏，此处提供入口（lg 及以上隐藏） */}
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-white transition hover:bg-white/10 lg:hidden"
            aria-label={t('common:nav.toggleMenu')}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((o) => !o)}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {mobileNavOpen ? (
                <path d="M18 6 6 18M6 6l12 12" />
              ) : (
                <>
                  <path d="M3 12h18" />
                  <path d="M3 6h18" />
                  <path d="M3 18h18" />
                </>
              )}
            </svg>
          </button>
          {/* 服务商入住（金色药丸按钮）：普通 USER 不显示 */}
          {!isPlainUser && (
            <Link
              to="/find-services"
              className="hidden rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-4 py-1.5 text-sm font-sans font-normal text-[#c81e42] shadow-sm transition hover:from-amber-500 hover:to-yellow-600 md:inline-flex"
            >
              {t('common:nav.providerEntry')}
            </Link>
          )}

          {/* 语种菜单（地球图标）：与运营端一致，排在账号胶囊左侧 */}
          <LanguageSwitcher variant="globe" />

          {isAuthenticated ? (
            <div ref={menuRef} className="h5-acc-scope relative">
              {/*
                账号胶囊（.acc）：结构/令牌取自运营端 AccountPill 的触发器，
                但底色按需求改为红底 + 白描边，对齐站内未登录态的「登录」按钮
                （border-white/60 + 红底 + 白字）；展开时描边转纯白。
                30px 白底红字首字母头像 + 13/600 白字姓名(最多 120px 省略)
                + 11px 半透明白角色标签 + 22px 半透明白下拉钮（展开旋转 180°）。
              */}
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="user menu"
                aria-expanded={menuOpen}
                className={`acc${menuOpen ? ' on' : ''}`}
              >
                <span className="acc-trigger">
                  <span className="acc-av">
                    {user?.avatar ? <img src={user.avatar} alt="" /> : initial}
                  </span>
                  <span className="acc-tinfo">
                    <span title={displayName}>{displayName}</span>
                    <span className="tag write">{roleLabel}</span>
                  </span>
                  <span className="dd">⌄</span>
                </span>
              </button>

              {/* 下拉面板（.accpanel）：逐条复刻运营端 account-panel.css 的五段式结构。
                  本端去掉「权限模式 / 待办事项 / 返回Web端首页」三段（均为运营端专属）。 */}
              {menuOpen && (
                <div className="accpanel absolute end-0 z-50 mt-2">
                  {/* ① 账号头部：头像 52 + 姓名 + 账号 ID（可复制）+ 角色/认证标签 */}
                  <div className="ap-head">
                    <div className="ap-avatar">
                      {user?.avatar ? <img src={user.avatar} alt="" /> : initial}
                    </div>
                    <div className="ap-user">
                      <div className="ap-name" title={displayName}>
                        {displayName}
                      </div>
                      <div className="ap-id">
                        <span>{t('common:account.accountId')}：</span>
                        <span title={accountId}>{accountId}</span>
                        <button
                          type="button"
                          className="ap-copy"
                          onClick={copyId}
                          title={copied ? t('common:account.copied') : t('common:account.copyId')}
                        >
                          {copied ? '✓' : '⧉'}
                        </button>
                      </div>
                      <div className="ap-tags">
                        <span className="tag ac">{roleLabel}</span>
                        <span className={`tag ${auth.cls}`}>{t(auth.key)}</span>
                      </div>
                    </div>
                  </div>

                  {/* ④ 快捷入口：个人中心（本端新增置首）+ 我的订单 / 优惠与权益 / 我的钱包 */}
                  <div className="ap-section">
                    <div className="ap-sec-title">{t('common:userCenter.panel.quickLinks')}</div>
                    <div className="ap-links">
                      {ACCOUNT_LINKS.map((l) => (
                        <Link
                          key={l.to}
                          to={l.to}
                          className="ap-link"
                          onClick={() => setMenuOpen(false)}
                        >
                          <span className="ic">{l.icon}</span>
                          <span>{t(l.key)}</span>
                        </Link>
                      ))}
                    </div>
                  </div>

                  {/* ⑤ 底部工具 + 退出登录（无「返回Web端首页」：web 即终端用户唯一入口） */}
                  <div className="ap-footer">
                    <div className="ap-tools">
                      {ACCOUNT_TOOLS.map((item) => (
                        <Link
                          key={item.to}
                          to={item.to}
                          className="ap-tool"
                          onClick={() => setMenuOpen(false)}
                        >
                          {t(item.key)}
                        </Link>
                      ))}
                    </div>
                    <button type="button" className="ap-logout" onClick={handleLogout}>
                      {t('common:userCenter.panel.logout')}
                    </button>
                  </div>
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
        </div>
      </div>

      {/* 移动端导航抽屉：<lg 时展开，竖向罗列主航入口；≥lg 隐藏 */}
      {mobileNavOpen && (
        <div className="absolute inset-x-0 top-full border-t border-white/10 bg-[#c81e42] shadow-xl lg:hidden">
          <div className="flex flex-col py-1">
            {MOBILE_NAV.map((item) => {
              if (item.type === 'action') {
                const run = item.key === 'designStudio'
                  ? handleDesignStudio
                  : () => navigate('/quick-make');
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setMobileNavOpen(false);
                      void run();
                    }}
                    className="px-6 py-3 text-start text-sm font-medium text-white transition hover:bg-white/10 hover:text-yellow-200"
                  >
                    {t(`common:nav.${item.key}`)}
                  </button>
                );
              }
              return (
                <Link
                  key={item.key}
                  to={item.to ?? '/'}
                  onClick={() => setMobileNavOpen(false)}
                  className="px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10 hover:text-yellow-200"
                >
                  {t(`common:nav.${item.key}`)}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
