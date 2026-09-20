/**
 * 用户中心外壳：左侧导航 + 右侧内容（Outlet）。
 * 嵌套在 AppLayout 内（顶部 SiteHeader 固定，高度 4rem）。
 *
 * 布局口径对齐运营端 AdminLayout（apps/admin/src/components/layout/AdminLayout.tsx）：
 *   - 外层 `grid grid-cols-[240px_1fr]`，**不再**用 `max-w-7xl mx-auto px-6` —— 那会在
 *     宽屏上把左右两侧撑出大片留白，导致详情内容被挤窄。
 *   - 侧栏 sticky 满高 + 右侧 1px 分隔线，与右区内容顶边对齐、两边贴边。
 *   - 主区内边距 20/24/32、纵向间距 16，与运营端 `<main>` 完全一致。
 *   - 根容器 fontSize:14 —— 与运营端 antd 全局 `fontSize:14` 对齐，未显式指定字号的
 *     文本不再继承浏览器默认的 16px，侧栏与详情页视觉字号统一。
 */
import { useMemo, useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { USER_CENTER_NAV, type NavItem } from './shared';

const FOLD_KEY = 'uc.sider.fold';

/** 分组标题字号（与运营端 LayerSider GROUP_FONT_SIZE 同值：分组与菜单项同字号，层级靠字重/底色区分） */
const GROUP_FONT_SIZE = 13.5;

export default function UserCenterLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const activeKey = (to: string, out?: boolean) =>
    out ? location.pathname === to : location.pathname === to || (to !== '/user' && location.pathname.startsWith(to));

  const renderItem = (item: NavItem) => {
    const active = activeKey(item.to, item.out);
    return (
      <Link
        key={item.to}
        to={item.to}
        className={`relative flex items-center gap-2.5 rounded-md px-[11px] py-2 transition ${
          active
            ? 'bg-[rgba(194,75,46,0.10)] text-[#c24b2e]'
            : 'text-[#4c4236] hover:bg-[#f3eee7]'
        }`}
        style={{ fontWeight: active ? 600 : 400 }}
      >
        {active && (
          <span className="absolute start-[-10px] top-[7px] bottom-[7px] w-[3px] rounded-[3px] bg-[#c24b2e]" />
        )}
        <span className="flex h-[18px] w-[18px] items-center justify-center opacity-85">{item.icon}</span>
        <span className="min-w-0 flex-1 truncate text-[13.5px]">{t(item.labelKey)}</span>
      </Link>
    );
  };

  // 分组（与运营端 LayerSider 同口径：按 group 聚合，保持 USER_CENTER_NAV 顺序）
  const groups = useMemo<[string, NavItem[]][]>(() => {
    const map = new Map<string, NavItem[]>();
    for (const it of USER_CENTER_NAV) {
      const g = it.group ?? '';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(it);
    }
    return [...map.entries()];
  }, []);

  // 折叠态：按分组名记忆到 localStorage（个人中心视角唯一，无需按视角区分）
  const [folded, setFolded] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(FOLD_KEY) || '{}') as Record<string, boolean>;
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(FOLD_KEY, JSON.stringify(folded));
    } catch {
      /* noop */
    }
  }, [folded]);

  // 命中当前路由的分组自动展开：避免折叠后跟随路由跳转看不到当前项。
  // ⚠️ 依赖只放 activeGroup（即"路由变了"）——若把 folded 也放进依赖，用户手动折叠当前分组时
  //    会被这个 effect 立刻重新展开，表现为"点了没反应"。
  const activeGroup =
    groups.find(([k, items]) => items.some((i) => activeKey(i.to, i.out)))?.[0] ?? null;
  useEffect(() => {
    if (!activeGroup) return;
    setFolded((f) => (f[activeGroup] ? { ...f, [activeGroup]: false } : f));
  }, [activeGroup]);

  return (
    <div
      className="grid grid-cols-1 bg-[#f5f2ec] md:grid-cols-[240px_1fr]"
      style={{ minHeight: 'calc(100vh - 4rem)', fontSize: 14 }}
    >
      {/* 侧边导航（对齐运营端 LayerSider：240 宽 + sticky 满高 + 右侧分隔线 + 品牌区 + 可折叠分组标题） */}
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] min-w-0 flex-col overflow-y-auto border-e border-[rgba(74,60,42,0.10)] bg-[#fffefb] md:flex">
        {/* 品牌区 */}
        <div className="flex flex-none items-center gap-2.5 border-b border-[rgba(74,60,42,0.10)] px-[18px] py-[14px]">
          <span
            className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] text-white"
            style={{ background: 'linear-gradient(135deg,#d2603f,#a93a20)' }}
          >
            <svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor">
              <path d="M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48Zm-96,85.15L52.57,64H203.43ZM98.71,128,40,181.81V74.19Zm11.84,10.85,12,11.05a8,8,0,0,0,10.82,0l12-11.05,58,53.15H52.57ZM157.29,128,216,74.18V181.82Z" />
            </svg>
          </span>
          <span className="min-w-0">
            <b className="block text-[16px] leading-[1.2] tracking-[.02em] text-[#2a2118]">庆柬云</b>
            <small className="text-[11px] tracking-[.14em] text-[#6e5f4a]">个人中心</small>
          </span>
        </div>

        {/* 导航：分组标题可点击折叠/展开（对齐运营端） */}
        <nav className="flex flex-1 flex-col px-[10px] py-[10px]">
          {groups.map(([key, items], idx) => {
            const collapsed = !!folded[key];
            return (
              <div key={key}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={!collapsed}
                  title={key}
                  onClick={() => setFolded((f) => ({ ...f, [key]: !f[key] }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setFolded((f) => ({ ...f, [key]: !f[key] }));
                    }
                  }}
                  className="flex cursor-pointer select-none items-center gap-2 rounded-md bg-[#f3eee7] px-[10px] py-[7px] transition hover:bg-[#ebe4d9]"
                  style={{
                    margin: idx === 0 ? '2px 0 6px' : '14px 0 6px',
                    fontSize: GROUP_FONT_SIZE,
                    fontWeight: 700,
                    color: '#2a2118',
                  }}
                >
                  {/* 左侧朱砂竖条：与选中菜单项的 3px 竖条同一语汇 */}
                  <span className="h-[13px] w-[3px] flex-none rounded-[2px] bg-[#c24b2e]" />
                  <span className="min-w-0 flex-1 truncate">{key}</span>
                  {/* 折叠角标：与运营端 DownOutlined / RightOutlined 同语义 */}
                  <span className="flex-none text-[11px] leading-none text-[#6e5f4a]">
                    {collapsed ? '›' : '⌄'}
                  </span>
                </div>
                {!collapsed && items.map(renderItem)}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* 内容区（对齐运营端 main：padding 20/24/32 + gap 16） */}
      <main className="flex min-w-0 flex-col gap-4 px-6 pb-8 pt-5">
        {/* 移动端顶部下拉导航（md 以下显示，按分组 optgroup） */}
        <div className="md:hidden">
          <select
            className="w-full rounded-lg border border-[rgba(74,60,42,0.16)] bg-[#fffefb] px-3 py-2 text-sm text-[#4c4236] outline-none"
            value={location.pathname}
            onChange={(e) => (window.location.href = e.target.value)}
          >
            {USER_CENTER_NAV.reduce<{ group: string; items: NavItem[] }[]>((acc, item) => {
              const last = acc[acc.length - 1];
              if (!last || last.group !== item.group) acc.push({ group: item.group ?? '', items: [item] });
              else last.items.push(item);
              return acc;
            }, []).map((g) => (
              <optgroup key={g.group || 'default'} label={g.group}>
                {g.items.map((item) => (
                  <option key={item.to} value={item.to}>
                    {t(item.labelKey)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
