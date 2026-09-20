import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DownOutlined, RightOutlined } from '@ant-design/icons';
import { T, BRAND } from '../../config/theme';
import { useBadges } from '../../hooks/useBadges';
import { useLayer } from '../../providers/layerContext';
import {
  resources,
  GROUP_ORDER,
  GROUP_LABEL,
  type MenuGroupKey,
  type ResourceMeta,
} from '../../config/resources';
import { t } from '../../i18n/t';

type MenuNode = (typeof resources)[number];

const metaOf = (r: MenuNode) => r.meta as ResourceMeta | undefined;

/** 分组标题栏字号 —— 与二级菜单 .mi .lbl 一致（原型 13.5px），仅以字重/底色区分层级 */
const GROUP_FONT_SIZE = 13.5;

/** 折叠态持久化键（按视角分别记忆，避免四层视角互相干扰） */
const foldKey = (view: string) => `sider.fold.${view}`;

const readFold = (view: string): Record<string, boolean> => {
  try {
    const raw = localStorage.getItem(foldKey(view));
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
};

/**
 * 判断菜单项是否命中当前路由（含子路由前缀）。
 * 抽成模块级纯函数，便于分组自动展开复用。
 */
const isActivePath = (r: MenuNode, pathname: string) => {
  const p = r.list as string;
  return pathname === p || (p != null && pathname.startsWith(`${p}/`));
};

/**
 * 侧栏（原型 .side）：品牌区 + 分组导航。
 * 账号身份已统一收进顶部右侧胶囊（LayerHeader），侧栏不再重复。
 *
 * 2026-09-01 调整：
 *  - 分组行升级为可折叠/展开的「标题栏」（暖石底 + 左侧朱砂竖条 + 右端折叠箭头）；
 *  - 分组名字号与二级菜单一致（13.5px）并加粗，靠底色区分层级而非靠字号；
 *  - 折叠态在分组行右侧汇总展示该组待办数，收起后仍能看到待处理量；
 *  - 折叠状态按视角持久化到 localStorage，路由命中被折叠的分组时自动展开。
 *
 * 菜单项样式还原原型 .mi：hover 暖石底，选中朱砂软底 + 左侧 3px 竖条 + 朱砂字。
 */
export const LayerSider = () => {
  const { view } = useLayer();
  const location = useLocation();
  const navigate = useNavigate();

  // 侧栏角标（菜单名 + 真实待办数），按当前角色作用域统计，路由变化/轮询自动回落
  const badges = useBadges();

  const [folded, setFolded] = useState<Record<string, boolean>>(() => readFold(view));

  // 切换视角：按该视角重新读取折叠态
  useEffect(() => {
    setFolded(readFold(view));
  }, [view]);

  // 折叠态持久化（隐私模式下 localStorage 写入失败时静默忽略）
  useEffect(() => {
    try {
      localStorage.setItem(foldKey(view), JSON.stringify(folded));
    } catch {
      /* noop */
    }
  }, [folded, view]);

  // 按当前视角投影，并按 meta.group 分组；分组顺序固定为 GROUP_ORDER
  const { grouped, groupKeys, ungrouped } = useMemo(() => {
    const layerItems = resources.filter((r) => metaOf(r)?.layer === view && r.list);
    const map = new Map<MenuGroupKey, MenuNode[]>();
    const rest: MenuNode[] = [];
    for (const r of layerItems) {
      const g = metaOf(r)?.group;
      if (g) {
        if (!map.has(g)) map.set(g, []);
        map.get(g)!.push(r);
      } else {
        rest.push(r);
      }
    }
    const keys = [...map.keys()].sort((a, b) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b));
    return { grouped: map, groupKeys: keys, ungrouped: rest };
  }, [view]);

  // 命中的分组自动展开：避免折叠后跟随路由跳转却看不到当前项
  useEffect(() => {
    const hit = groupKeys.find((k) => (grouped.get(k) ?? []).some((r) => isActivePath(r, location.pathname)));
    if (hit) setFolded((f) => (f[hit] ? { ...f, [hit]: false } : f));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, view]);

  const isActive = (r: MenuNode) => isActivePath(r, location.pathname);

  const renderItem = (r: MenuNode) => {
    const m = metaOf(r)!;
    const on = isActive(r);
    const labelText = t(`menu.${r.name.replace(/\//g, '.')}`, m.label);
    // 角标 = 菜单名 + 该菜单待办数（真实业务统计，非装饰性数字）
    const badge = m.badgeKey ? badges[m.badgeKey] : 0;
    const badgeText = badge > 99 ? '99+' : String(badge);
    return (
      <div
        key={r.name}
        data-menu={r.name}
        onClick={() => navigate(r.list as string)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 11px',
          borderRadius: T.rSm,
          color: on ? T.accent : T.ink2,
          background: on ? T.accentSoft : 'transparent',
          fontWeight: on ? 600 : 400,
          cursor: 'pointer',
          userSelect: 'none',
          position: 'relative',
          transition: 'background .12s',
        }}
        onMouseEnter={(e) => {
          if (!on) e.currentTarget.style.background = T.panel2;
        }}
        onMouseLeave={(e) => {
          if (!on) e.currentTarget.style.background = 'transparent';
        }}
      >
        {on && (
          <span
            style={{
              position: 'absolute',
              insetInlineStart: -10,
              top: 7,
              bottom: 7,
              width: 3,
              borderRadius: 3,
              background: T.accent,
            }}
          />
        )}
        <span style={{ width: 18, height: 18, opacity: 0.85, display: 'grid', placeItems: 'center', flex: 'none' }}>
          {m.icon}
        </span>
        <span className="lbl" style={{ flex: 1, fontSize: 13.5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {labelText}
        </span>
        {badge > 0 && (
          <span
            title={labelText + ' · 待处理 ' + badge + ' 项'}
            style={{
              minWidth: 18,
              height: 18,
              padding: '0 5px',
              borderRadius: 999,
              fontSize: 11,
              background: T.accent,
              color: T.onAccent,
              display: 'grid',
              placeItems: 'center',
              fontWeight: 700,
              flex: 'none',
            }}
          >
            {badgeText}
          </span>
        )}
      </div>
    );
  };

  /** 分组标题栏：可折叠/展开，右端折叠箭头；折叠时汇总该组待办数 */
  const renderGroup = (key: MenuGroupKey, items: MenuNode[], idx: number) => {
    const collapsed = !!folded[key];
    const labelText = t(`group.${key}`, GROUP_LABEL[key]);
    const sum = items.reduce((n, r) => {
      const bk = metaOf(r)?.badgeKey;
      return n + (bk ? badges[bk] : 0);
    }, 0);
    const sumText = sum > 99 ? '99+' : String(sum);
    return (
      <div key={key}>
        <div
          className="sgrp"
          data-group={key}
          data-collapsed={collapsed ? '1' : '0'}
          onClick={() => setFolded((f) => ({ ...f, [key]: !f[key] }))}
          title={labelText + (sum > 0 ? ` · 待处理 ${sum} 项` : '')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 10px',
            margin: idx === 0 ? '2px 0 6px' : '14px 0 6px',
            borderRadius: T.rSm,
            background: T.panel2,
            color: T.ink1,
            fontSize: GROUP_FONT_SIZE,
            fontWeight: 700,
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'background .12s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = T.panel3;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = T.panel2;
          }}
        >
          {/* 左侧朱砂竖条：标题栏标识，与选中菜单项的 3px 竖条同语汇 */}
          <span
            style={{
              width: 3,
              height: 13,
              borderRadius: 2,
              background: T.accent,
              flex: 'none',
            }}
          />
          <span
            className="sgrp-lbl"
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {labelText}
          </span>
          {sum > 0 && collapsed && (
            <span
              className="bdg"
              title={labelText + ' · 待处理 ' + sum + ' 项'}
              style={{
                minWidth: 18,
                height: 18,
                padding: '0 5px',
                borderRadius: 999,
                fontSize: 11,
                background: T.accent,
                color: T.onAccent,
                display: 'grid',
                placeItems: 'center',
                fontWeight: 700,
                flex: 'none',
              }}
            >
              {sumText}
            </span>
          )}
          <span
            className="sgrp-arrow"
            style={{
              width: 14,
              display: 'grid',
              placeItems: 'center',
              color: T.ink3,
              fontSize: 11,
              flex: 'none',
            }}
          >
            {collapsed ? <RightOutlined /> : <DownOutlined />}
          </span>
        </div>
        {!collapsed && items.map(renderItem)}
      </div>
    );
  };

  return (
    <>
      {/* ── 品牌区 ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '18px 18px 14px',
          borderBottom: `1px solid ${T.border}`,
          flex: 'none',
        }}
      >
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: `linear-gradient(135deg,${BRAND.markFrom},${BRAND.markTo})`,
            display: 'grid',
            placeItems: 'center',
            color: T.onAccent,
            flex: 'none',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor">
            <path d="M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48Zm-96,85.15L52.57,64H203.43ZM98.71,128,40,181.81V74.19Zm11.84,10.85,12,11.05a8,8,0,0,0,10.82,0l12-11.05,58,53.15H52.57ZM157.29,128,216,74.18V181.82Z" />
          </svg>
        </span>
        <span style={{ minWidth: 0 }}>
          <b style={{ fontSize: 16, letterSpacing: '.02em', display: 'block', lineHeight: 1.2, color: T.ink1 }}>
            庆柬云
          </b>
          <small style={{ fontSize: 11, color: T.ink3, letterSpacing: '.14em' }}>管理后台</small>
        </span>
      </div>

      {/* ── 导航 ── */}
      <nav style={{ flex: 1, overflow: 'auto', padding: '10px 10px 16px' }}>
        {ungrouped.map(renderItem)}
        {groupKeys.map((k, i) => renderGroup(k, grouped.get(k)!, i))}
      </nav>
    </>
  );
};
