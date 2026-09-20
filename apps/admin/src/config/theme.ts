import type { ThemeConfig } from 'antd';
import type { CSSProperties } from 'react';

/**
 * 运营端设计令牌 —— 以 UI_Design/ui-run/console/index.html :root 为唯一真值。
 *
 * 设计基调（原型注释）：
 *   暖石底 + 朱砂主色 + 青副色，网格排版，静默动效；
 *   底色不纯白 / 强调色单角色 / 状态双角色（浅底深字）/ B 端靠线不靠阴影。
 *
 * 所有组件一律从这里取值，禁止在页面里硬编码颜色。
 */
/** 朱砂主色（T.accent）——头像渐变起点，先声明以便在 T 内复用 */
const ACCENT = '#D24830';
/** 头像渐变终点（= BRAND.markTo，#D24830 的派生深色 hover #B23A22） */
const MARK_TO = '#B23A22';

export const T = {
  /* ── 面 ── */
  page: '#f5f2ec', // 应用底（暖石）
  bg: '#fffefb', // 面板/卡片（暖白）
  panel2: '#f3eee7', // 次级面（表头、分组底、占位）
  panel3: '#ebe4d9', // 三级面（侧栏分组标题栏底 / 分组标题栏 hover）
  hover: '#faf7f1', // 行 hover
  scrim: 'rgba(30,24,16,.45)', // 遮罩

  /* ── 线 ── */
  border: 'rgba(74,60,42,.10)',

  /* ── 字（三级） ── */
  ink1: '#2a2118', // 主文
  ink2: '#4c4236', // 次文
  ink3: '#6e5f4a', // 弱文 / 表头 / hint

  /* ── 强调 ── */
  // 注意：这里必须写字面量 —— apps/admin/temp/verify-ui-tokens.mjs 直接扫源码比对色值，
  // 写成常量引用会让它读到「ACCENT」而误报不一致。下面的渐变可复用常量。
  accent: '#D24830', // 品牌主色（#D24830，与 web 端统一）
  accentHover: '#B23A22',
  accentSoft: 'rgba(210,72,48,.10)',
  accent2: '#14676b', // 青（副色）
  accent2Soft: 'rgba(20,103,107,.10)',
  onAccent: '#fff',

  /* ── 状态（双角色：浅底 + 深字） ── */
  up: '#1d7a6b',
  upInk: '#0f5a4e',
  down: '#c02b33',
  downInk: '#8f1d24',
  warn: '#b77a16',
  warnInk: '#7a4d07',

  /* ── 状态底（12%~14% 混透明） ── */
  upBg: 'rgba(29,122,107,.12)',
  downBg: 'rgba(192,43,51,.12)',
  warnBg: 'rgba(183,122,22,.14)',
  mutBg: '#f3eee7',

  /* ── 账号胶囊 / 账号下拉面板（原型 .acc / .accpanel） ── */
  /** 头像渐变（原型 .acc-av / .ap-avatar：135deg 朱砂 → 深赭） */
  avatarGrad: `linear-gradient(135deg,${ACCENT},${MARK_TO})`,
  /** 面板头暖底渐变（原型 .ap-head：#fdf8f5 → #faf3ee） */
  headGrad: 'linear-gradient(135deg,#fdf8f5,#faf3ee)',
  /** 退出登录文字色（原型 .ap-logout） */
  logoutInk: '#c0392b',
  /** 退出登录 hover 底（原型 .ap-logout:hover） */
  logoutSoft: '#fdf0ef',
  /** 弹出层阴影（原型 .accpanel） */
  shadowPop: '0 16px 48px rgba(42,33,24,.18)',

  /* ── 圆角 ── */
  rSm: 6,
  rMd: 10,
  rLg: 14,

  /* ── 尺度 ── */
  side: 240, // 侧栏宽
  sideCollapsed: 64,
  header: 56, // 顶栏高
  row: 46, // 表格行高
  gap: 16, // 主区纵向间距

  /* ── 字体 ── */
  font: "system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif",
  fontNum: "'Bahnschrift','DIN Alternate',Arial,system-ui,sans-serif",
} as const;

/** 品牌名「庆柬云」分色（庆柬=朱砂 / 云=强调），见原型 .brand */
export const BRAND = {
  red: ACCENT,
  gold: '#b8893a',
  markFrom: '#d2603f',
  markTo: MARK_TO,
};

/** antd ThemeConfig —— 把上述令牌映射进 antd 组件令牌 */
export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: T.accent,
    colorInfo: T.accent2,
    colorBgLayout: T.page,
    colorBgContainer: T.bg,
    colorBgElevated: T.bg,
    colorSuccess: T.up,
    colorError: T.down,
    colorWarning: T.warn,
    colorText: T.ink1,
    colorTextSecondary: T.ink2,
    colorTextTertiary: T.ink3,
    colorBorder: T.border,
    colorBorderSecondary: T.border,
    borderRadius: T.rSm,
    borderRadiusLG: T.rMd,
    controlHeight: 34,
    fontSize: 14,
    fontFamily: T.font,
    /** B 端靠线不靠阴影：关掉默认主按钮阴影 */
    boxShadowSecondary: '0 12px 32px rgba(42,33,24,.14)',
  },
  components: {
    Table: {
      headerBg: T.panel2,
      headerColor: T.ink3,
      headerSplitColor: 'transparent',
      borderColor: T.border,
      rowHoverBg: T.hover,
      cellPaddingBlock: 12,
      cellPaddingInline: 16,
      headerBorderRadius: 0,
    },
    Card: {
      borderRadiusLG: T.rMd,
      colorBorderSecondary: T.border,
      paddingLG: 0,
    },
    Tag: { borderRadiusSM: 999 },
    Button: { primaryShadow: 'none', defaultShadow: 'none', dangerShadow: 'none' },
    Menu: {
      itemBg: 'transparent',
      subMenuItemBg: 'transparent',
      itemSelectedBg: T.accentSoft,
      itemSelectedColor: T.accent,
      itemHoverBg: T.panel2,
      itemColor: T.ink2,
      itemBorderRadius: T.rSm,
      groupTitleColor: T.ink3,
      groupTitleFontSize: 11,
      iconSize: 18,
    },
    Segmented: {
      itemSelectedBg: T.bg,
      itemSelectedColor: T.accent,
      trackBg: T.page,
      trackPadding: 0,
    },
    Badge: { colorBgContainer: T.accent },
    Descriptions: { labelBg: T.panel2 },
    Modal: { borderRadiusLG: T.rLg, titleFontSize: 16 },
    Drawer: { paddingLG: 16 },
    Statistic: { contentFontSize: 27 },
    Input: { activeShadow: 'none' },
    Select: { optionSelectedBg: T.accentSoft },
    Pagination: { itemActiveBg: T.accent, borderRadius: T.rSm },
  },
};

/** 常用内联样式片段，避免各页重复拼装 */
export const S = {
  /** 主区容器（原型 .body） */
  body: {
    padding: '20px 24px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: T.gap,
    minWidth: 0,
  } as CSSProperties,
  /** 面板（原型 .panel） */
  panel: {
    background: T.bg,
    border: `1px solid ${T.border}`,
    borderRadius: T.rMd,
    overflow: 'hidden',
    minWidth: 0,
  } as CSSProperties,
  /** 面板头（原型 .panel>header） */
  panelHead: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    borderBottom: `1px solid ${T.border}`,
    fontWeight: 650,
    fontSize: 14.5,
  } as CSSProperties,
  /** 面板头右侧弱提示（原型 .hint） */
  hint: {
    marginLeft: 'auto',
    color: T.ink3,
    fontWeight: 400,
    fontSize: 12,
  } as CSSProperties,
  /** 等宽数字（原型 .num） */
  num: {
    fontVariantNumeric: 'tabular-nums',
    fontFamily: T.fontNum,
  } as CSSProperties,
  /** 角色标签（原型 .rolechip） */
  rolechip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    padding: '3px 10px',
    borderRadius: 999,
    background: T.accent2Soft,
    color: T.accent2,
    fontWeight: 600,
  } as CSSProperties,
  /** 只读态角色标签（原型 .rolechip.ro） */
  rolechipRo: {
    background: T.warnBg,
    color: T.warnInk,
  } as CSSProperties,
} as const;

/** 原型栅格：duo = 1.4fr / 1fr，trio = 1.2fr / 1fr / 1fr */
export const GRID = {
  duo: { display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: T.gap },
  trio: { display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: T.gap },
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 },
} as const;
