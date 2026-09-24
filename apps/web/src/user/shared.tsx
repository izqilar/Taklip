/**
 * 用户中心共享组件 / 导航 / Hook。
 * Phase 2（2.4）：把运营端 user/* 模块的 UI 在 web 端以原生 Tailwind 形式复刻，
 * 数据全部来自后端 /api/user/*（USER 角色自动取本人，零后端改动）。
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';
import i18n from '@/i18n';

/** 金额（分）→ ¥ 字符串（统一真值源见 @h5design/core，本处 import 后 re-export 以兼容既有 import + 本模块内部使用） */
import { formatCents } from '@h5design/core';
export { formatCents };

// 统一真值源已收敛到 @h5design/core（见 packages/core/src/code.ts），此处仅 re-export 以兼容既有 import。
export { cleanCode } from '@h5design/core';

/** 手机号脱敏：11 位手机号保留前 3 后 4，中间以 **** 遮蔽；其余原样返回（与运营端 maskPhone 同口径） */
export function maskPhone(phone?: string | null): string {
  if (!phone) return '—';
  const s = String(phone);
  return /^1\d{10}$/.test(s) ? `${s.slice(0, 3)}****${s.slice(-4)}` : s;
}

/** 星级渲染：★ 4.7（对齐运营端 stars：主色数值字 + 朱砂星，等宽） */
export const Stars = ({ rating }: { rating?: number | null }) =>
  rating ? (
    <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: "'Bahnschrift','DIN Alternate',Arial,system-ui,sans-serif", color: '#D24830' }}>
      ★ {Number(rating).toFixed(1)}
    </span>
  ) : (
    <span className="text-[#6e5f4a]">—</span>
  );

/** 状态徽章（原型 .pill / antd Pill 同口径；双角色：浅底 + 深字） */
export function StatusBadge({
  tone = 'default',
  children,
}: {
  tone?: 'default' | 'warn' | 'accent' | 'ok' | 'bad' | 'mut';
  children: ReactNode;
}) {
  // 对齐运营端 theme.ts 状态色：绿 up / 红 down / 琥珀 warn / 朱砂 accent / 灰 mut
  const map: Record<string, string> = {
    default: 'bg-[#f3eee7] text-[#6e5f4a]',
    mut: 'bg-[#f3eee7] text-[#6e5f4a]',
    ok: 'bg-[rgba(29,122,107,0.12)] text-[#0f5a4e]',
    warn: 'bg-[rgba(183,122,22,0.14)] text-[#7a4d07]',
    bad: 'bg-[rgba(192,43,51,0.12)] text-[#8f1d24]',
    accent: 'bg-[rgba(210,72,48,0.10)] text-[#D24830]',
  };
  return (
    <span className={`inline-flex rounded-full px-[9px] py-0.5 text-xs font-medium ${map[tone]}`}>
      {children}
    </span>
  );
}

/** 卡片容器（原型 Panel） */
export function Section({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 ${className}`}>
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          <div>
            {title && <h3 className="text-[14.5px] font-semibold text-gray-800">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-gray-600">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/** 空态 */
export function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-gray-600">
      <svg className="h-10 w-10 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 9h18" />
      </svg>
      {text}
    </div>
  );
}

/** 加载骨架行 */
export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2 py-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-9 animate-pulse rounded bg-gray-100" />
      ))}
    </div>
  );
}

/**
 * 错误态（带重试入口）。
 * 请求失败时必须给用户可见反馈 + 重试动作，不能让界面停在永久 loading
 * （历史问题：Overview 的 dashboard 请求失败后 s 恒为 null，整页一直转圈且无任何提示）。
 */
export function ErrorState({ text, onRetry }: { text: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-gray-600">
      <svg
        className="h-10 w-10 opacity-40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5" />
        <circle cx="12" cy="16.6" r="0.9" fill="currentColor" stroke="none" />
      </svg>
      {text}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-[rgba(74,60,42,0.16)] px-3 py-1.5 text-[13px] text-[#4c4236] transition hover:border-[#D24830]/40 hover:text-[#D24830]"
        >
          {t('common:button.retry')}
        </button>
      )}
    </div>
  );
}

/** 整页加载占位 */
export function LoadingDots() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-gray-600">
      {t('common:userCenter.loading')}
    </div>
  );
}

export interface Column<T> {
  key: string;
  title: string;
  align?: 'left' | 'right' | 'center';
  className?: string;
  render?: (row: T) => ReactNode;
}

/** 通用表格（镜像 admin DataTable：表头暖石底 / 46px 行高 / 16px 内距 / nowrap+省略 / 行 hover #faf7f1） */
export function UserTable<T extends { id?: string }>({
  columns,
  rows,
  loading,
  emptyText,
}: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  emptyText?: string;
}) {
  const { t } = useTranslation();
  const alignCls = (a?: string) =>
    a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`h-[46px] whitespace-nowrap border-b border-[rgba(74,60,42,0.10)] bg-[#f3eee7] px-4 text-[12.5px] font-medium tracking-[.02em] text-[#6e5f4a] ${alignCls(c.align)}`}
              >
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-4">
                <TableSkeleton />
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-6">
                <EmptyState text={emptyText ?? t('common:userCenter.empty')} />
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={r.id ?? i} className="border-b border-[rgba(74,60,42,0.10)] hover:bg-[#faf7f1]">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`h-[46px] whitespace-nowrap overflow-hidden px-4 text-[#2a2118] text-ellipsis ${alignCls(c.align)} ${c.className ?? ''}`}
                  >
                    {c.render ? c.render(r) : ((r as any)[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/** 导航项配置（图标内联 SVG） */
export interface NavItem {
  to: string;
  labelKey: string;
  icon: ReactNode;
  /** 是否指向 /user 之外的路由（个人中心所有菜单项现已统一挂在 /user 下，此字段预留） */
  out?: boolean;
  /** 分组标题（与运营端用户视角四组一致：交易中心 / 评价与反馈 / 消息中心 / 个人中心） */
  group?: string;
}

const I = (path: ReactNode) => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {path}
  </svg>
);

/**
 * 用户中心导航（与运营端 resources.tsx「用户视角」四组十一项顺序、分组一致）：
 * 交易中心：我的工作台 / 我的服务商 / 我的订单 / 我的作品
 * 评价与反馈：我的评价 / 我的反馈
 * 消息中心：通知公告 / 业务消息
 * 个人中心：我的钱包 / 优惠与权益 / 账户详情
 */
export const USER_CENTER_NAV: NavItem[] = [
  { to: '/user', labelKey: 'common:userCenter.menu.overview', group: '交易中心', icon: I(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>) },
  { to: '/user/providers', labelKey: 'common:userCenter.menu.providers', group: '交易中心', icon: I(<><path d="M3 21V8l9-5 9 5v13" /><path d="M9 21v-6h6v6" /></>) },
  { to: '/user/orders', labelKey: 'common:userCenter.menu.orders', group: '交易中心', icon: I(<><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></>) },
  { to: '/user/works', labelKey: 'common:userCenter.menu.works', group: '交易中心', icon: I(<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></>) },
  { to: '/user/reviews', labelKey: 'common:userCenter.menu.reviews', group: '评价与反馈', icon: I(<><path d="M12 2 9.2 8.6 2 9.3l5.5 4.8L5.8 21 12 17l6.2 4-1.7-6.9L22 9.3l-7.2-.7Z" /></>) },
  { to: '/user/feedback', labelKey: 'common:userCenter.menu.feedback', group: '评价与反馈', icon: I(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M9 13h6M9 17h6" /></>) },
  { to: '/user/notices', labelKey: 'common:userCenter.menu.notices', group: '消息中心', icon: I(<><path d="M3 11l18-5v12L3 14v-3Z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></>) },
  { to: '/user/messages', labelKey: 'common:userCenter.menu.messages', group: '消息中心', icon: I(<><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" /><path d="m4 6 8 6 8-6" /></>) },
  { to: '/user/wallet', labelKey: 'common:userCenter.menu.wallet', group: '个人中心', icon: I(<><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>) },
  { to: '/user/coupons', labelKey: 'common:userCenter.menu.coupons', group: '个人中心', icon: I(<><path d="M20 12V8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v4a2 2 0 0 0 0 4v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2a2 2 0 0 0 0-4Z" /><path d="M12 6v16" /></>) },
  // 入驻申请：加入团队（身份不变）/ 入驻（资格升级）双隧道入口
  // 位置：排在「账户详情」之前（2026-09-24 调整），与运营端用户视角「个人中心」分组顺序一致
  { to: '/user/apply', labelKey: 'common:userCenter.menu.apply', group: '个人中心', icon: I(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></>) },
  { to: '/user/account', labelKey: 'common:userCenter.menu.account', group: '个人中心', icon: I(<><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 12 0v1" /></>) },
];

/** 会员等级（与运营端 AdjustUserModal 同源；0=普通用户 1=银卡 2=金卡 3=黑金） */
export const TIERS: { key: string; label: string; value: number }[] = [
  { key: '普通用户', label: '普通', value: 0 },
  { key: '银卡会员', label: '银卡', value: 1 },
  { key: '金卡会员', label: '金卡', value: 2 },
  { key: '黑金会员', label: '黑金', value: 3 },
];

/** 等级 key ↔ vipLevel 互转 */
export const tierKeyOf = (vipLevel?: number | null): string =>
  TIERS.find((x) => x.value === (vipLevel ?? 0))?.key ?? '普通用户';

/** 各等级权益（原型 .perks，与运营端一致） */
export const TIER_PERKS: Record<string, string[]> = {
  普通用户: ['新人礼包 ¥20', '在线浏览 · 搜索服务商', '提交预约申请', '基础在线客服'],
  银卡会员: ['含普通用户全部权益', '生日券', '全场服务 9.8 折', '专属客服'],
  金卡会员: ['含银卡会员全部权益', '优先券 / 免排期', '全场服务 9.5 折', '优先排期'],
  黑金会员: ['含金卡会员全部权益', '季度礼 / 专属管家', '全场服务 9 折', '金牌管家 1 对 1'],
};

/**
 * 服务子角色 → i18n 键（镜像运营端 config/labels SERVICE_ROLE_KEYS；运营端为该映射的 canonical 真值源）。
 * 此处仅持有「枚举 → 键」映射，文案在调用时由 web 端 i18n 解析，随语言切换，不再冻结为 zh-CN。
 * 键集合（svc.design … svc.perform）需与运营端 SERVICE_ROLE_KEYS 保持一致。
 */
export const SERVICE_ROLE_KEYS: Record<string, string> = {
  DESIGN: 'svc.design',
  PHOTO: 'svc.photo',
  VENUE: 'svc.venue',
  FLORAL: 'svc.floral',
  STEWARD: 'svc.steward',
  PERFORM: 'svc.perform',
};
export const serviceRolesText = (roles?: string[] | null): string =>
  !roles?.length ? '—' : roles.map((r) => (SERVICE_ROLE_KEYS[r] ? i18n.t(SERVICE_ROLE_KEYS[r]) : r)).join('、');

/**
 * 消息类型标签（web 用户端视图，标签与运营端控制台有意不同：用户见「平台公告 / 普通消息 / 申诉」，
 * 控制台见「权威公告 / 一般消息 / 诉求」）。统一存 i18n key，调用时解析，避免冻结语言。
 */
export const MSG_TYPE_KEYS: Record<string, string> = {
  ANNOUNCEMENT: 'userCenter.msgType.ANNOUNCEMENT',
  ANNOUNCED: 'userCenter.msgType.ANNOUNCED',
  NOTICE: 'userCenter.msgType.NOTICE',
  APPEAL: 'userCenter.ticketType.APPEAL',
};
export const msgTypeText = (type?: string | null): string =>
  type == null ? '—' : (MSG_TYPE_KEYS[type] ? i18n.t(MSG_TYPE_KEYS[type]) : type);

/* ══════════════════════════════════════════════════════════════
 * 以下 UI 原语镜像运营端用户视角（apps/admin 的 PageHead / Panel /
 * KpiCard / Pill / DataTable / GenericListPage），颜色令牌取自运营端
 * theme.ts：暖白底 #fffefb、朱砂 #D24830、青副 #14676b、三级字
 * #2a2118/#4c4236/#6e5f4a，圆角 10/6。「B 端靠线不靠阴影」。
 * ══════════════════════════════════════════════════════════════ */

/** 页面头（镜像 admin PageHead）：主标题 + 副标题 + 右侧角色标签 */
export function PageHead({ title, sub, chip }: { title: ReactNode; sub?: ReactNode; chip?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-3">
      <div className="min-w-0">
        <h2 className="m-0 text-[18px] font-[750] text-[#2a2118]">{title}</h2>
        {sub != null && <div className="mt-0.5 text-[13px] text-[#6e5f4a]">{sub}</div>}
      </div>
      <span className="ml-auto" />
      {chip != null && (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#14676b]/10 px-2.5 py-[3px] text-xs font-semibold text-[#14676b]">
          {chip}
        </span>
      )}
    </div>
  );
}

/** 面板（镜像 admin Panel）：暖白底 + 1px 线 + 10px 圆角，头部带底部分隔线 */
export function Panel({
  title,
  hint,
  children,
  className = '',
}: {
  title?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-[10px] border border-[rgba(74,60,42,0.10)] bg-[#fffefb] ${className}`}>
      {(title != null || hint != null) && (
        <header className="flex items-center gap-2.5 border-b border-[rgba(74,60,42,0.10)] px-4 py-3 text-[14.5px] font-[650] text-[#2a2118]">
          {title}
          {hint != null && <span className="ml-auto text-xs font-normal text-[#6e5f4a]">{hint}</span>}
        </header>
      )}
      {children}
    </section>
  );
}

/** KPI 卡（镜像 admin KpiCard）：主指标朱砂描边 + 内嵌顶条 + 等宽数字 + 趋势箭头 */
export function KpiCard({
  label,
  value,
  delta,
  deltaTrend = 'flat',
  main,
}: {
  label: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
  deltaTrend?: 'up' | 'down' | 'flat';
  main?: boolean;
}) {
  const deltaColor = deltaTrend === 'up' ? '#0f5a4e' : deltaTrend === 'down' ? '#8f1d24' : '#6e5f4a';
  return (
      <div
        className={`relative overflow-hidden rounded-[10px] border bg-[#fffefb] px-4 py-3.5 ${
          main ? 'border-[#D24830]' : 'border-[rgba(74,60,42,0.10)]'
        }`}
        style={main ? { boxShadow: 'inset 0 2px 0 #D24830' } : undefined}
      >
        <div className="flex items-center gap-1.5 text-[12.5px] text-[#6e5f4a]">{label}</div>
        <div
          className={`mt-1.5 text-[27px] font-[750] tabular-nums tracking-[.01em] ${
            main ? 'text-[#D24830]' : 'text-[#2a2118]'
          }`}
          style={{ fontFamily: "'Bahnschrift','DIN Alternate',Arial,system-ui,sans-serif" }}
        >
        {value}
      </div>
      {delta != null && (
        <div className="mt-1 flex items-center gap-1 text-xs" style={{ color: deltaColor }}>
          {deltaTrend === 'up' && (
            <svg width={13} height={13} viewBox="0 0 256 256" fill="currentColor" className="flex-none">
              <path d="M205.66,117.66a8,8,0,0,1-11.32,0L136,59.31V216a8,8,0,0,1-16,0V59.31L61.66,117.66a8,8,0,0,1-11.32-11.32l72-72a8,8,0,0,1,11.32,0l72,72A8,8,0,0,1,205.66,117.66Z" />
            </svg>
          )}
          {deltaTrend === 'down' && (
            <svg width={13} height={13} viewBox="0 0 256 256" fill="currentColor" className="flex-none">
              <path d="M205.66,138.34a8,8,0,0,1-11.32,11.32L136,91.31V248a8,8,0,0,1-16,0V91.31L61.66,149.66a8,8,0,0,1-11.32-11.32l72-72a8,8,0,0,1,11.32,0l72,72A8,8,0,0,1,205.66,138.34Z" />
            </svg>
          )}
          {delta}
        </div>
      )}
    </div>
  );
}

/** 详情/字段弹窗（镜像 admin ReviewModal：左上标签 + 标题 + dl 字段 + 关闭） */
export function DetailModal({
  tag,
  title,
  fields,
  onClose,
}: {
  tag?: ReactNode;
  title?: ReactNode;
  fields: { label: ReactNode; value: ReactNode }[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(30,24,16,0.45)] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-[14px] bg-[#fffefb] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {tag != null && (
              <span className="rounded bg-[#14676b]/10 px-2.5 py-[3px] text-xs font-semibold text-[#14676b]">{tag}</span>
            )}
            <h3 className="text-[14.5px] font-semibold text-[#2a2118]">{title}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-[#6e5f4a] hover:text-[#4c4236]">✕</button>
        </div>
        <dl className="grid grid-cols-[86px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
          {fields.map((f, i) => (
            <div key={i} className="contents">
              <dt className="text-[#6e5f4a]">{f.label}</dt>
              <dd className="font-semibold text-[#2a2118]">{f.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[rgba(74,60,42,0.16)] px-4 py-1.5 text-sm text-[#4c4236] transition hover:bg-[#f5f2ec]"
          >
            {t('common:button.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 胶囊筛选（镜像 admin ChipFilter） */
export interface ChipFilterDef {
  label: string;
  value: string;
  /** 命中后作为查询参数下发后端（如 serviceStatus） */
  field?: string;
  match?: string;
  /** 无后端字段时的客户端过滤谓词（如 未读/已读 按 read 回执判定） */
  test?: (row: any) => boolean;
}

function FilterBar({
  filters,
  active,
  onFilter,
  searchable,
  searchValue,
  onSearch,
  createLabel,
  onCreate,
}: {
  filters?: ChipFilterDef[];
  active: string;
  onFilter: (v: string) => void;
  searchable?: boolean;
  searchValue: string;
  onSearch: (v: string) => void;
  createLabel?: string;
  onCreate?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {filters && filters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-[rgba(74,60,42,0.10)] bg-[#fffefb] px-3 py-2.5">
          {filters.map((f) => {
            const on = active === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => onFilter(on ? 'all' : f.value)}
                className={`rounded-full border px-3 py-1 text-[12.5px] transition ${
                  on
                    ? 'border-[#D24830] bg-[rgba(210,72,48,0.10)] font-semibold text-[#D24830]'
                    : 'border-[rgba(74,60,42,0.10)] bg-transparent text-[#4c4236] hover:border-[#D24830]/40'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      )}
      <span className="ml-auto" />
      {searchable && (
        <input
          value={searchValue}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="搜索…"
          className="h-[34px] w-56 rounded-md border border-[rgba(74,60,42,0.16)] px-3 text-sm outline-none focus:border-[#D24830]"
        />
      )}
      {searchable && (
        <button
          type="button"
          onClick={() => onSearch(searchValue)}
          className="h-[34px] rounded-md border border-[rgba(74,60,42,0.16)] px-3 text-sm text-[#4c4236] transition hover:bg-[#f5f2ec]"
        >
          搜索
        </button>
      )}
      {onCreate && (
        <button
          type="button"
          onClick={onCreate}
          className="rounded-lg bg-[#D24830] px-4 py-1.5 text-sm font-medium text-white transition hover:bg-[#B23A22]"
        >
          {createLabel}
        </button>
      )}
    </div>
  );
}

/** 分页列表 Hook（镜像 GenericListPage 的 paged 取数）：按页替换 rows */
export function useUserPage<T>(
  fetcher: (page: number, pageSize: number, params: Record<string, unknown>) => Promise<{ items: T[]; total: number }>,
  pageSize = 10,
) {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 请求序号：慢响应回来时若已有更新的请求，丢弃陈旧结果，避免覆盖新数据
  const reqId = useRef(0);
  const load = (p: number, params: Record<string, unknown> = {}) => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    fetcher(p, pageSize, params)
      .then((r) => {
        if (id !== reqId.current) return;
        setRows(r.items ?? []);
        setTotal(r.total ?? 0);
        setPage(p);
      })
      .catch((e: any) => {
        if (id !== reqId.current) return;
        setRows([]);
        setTotal(0);
        setError(e?.message || '加载失败');
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false);
      });
  };
  return { page, rows, total, loading, error, load, setPage, reload: (params?: Record<string, unknown>) => load(page, params) };
}

/** 列表页详情字段（镜像 GenericListPage DetailFieldDef） */
export interface DetailFieldDef {
  label: ReactNode;
  key: string;
  format?: 'cents' | 'date' | 'text' | 'stars' | 'status' | 'roles';
}

/**
 * 通用列表页（镜像 admin GenericListPage #pg-list）：
 * PageHead → FilterBar（胶囊 + 搜索 + 新建）→ Panel（共 N 条）→ DataTable → 分页条；
 * 提供 detailFields 时自动追加「详情」列并弹出 DetailModal；提供 rowActions 时追加自定义操作列。
 */
export function UserListPage<T extends { id?: string }>({
  title,
  sub,
  chip,
  columns,
  fetcher,
  pageSize = 10,
  filters,
  searchable,
  searchPlaceholder,
  searchServerField,
  searchField,
  detailFields,
  rowActions,
  createLabel,
  onCreate,
  emptyText,
  onViewDetail,
  initialParams,
  children,
}: {
  title: string;
  sub?: string;
  chip?: ReactNode;
  columns: Column<T>[];
  fetcher: (page: number, pageSize: number, params: Record<string, unknown>) => Promise<{ items: T[]; total: number }>;
  pageSize?: number;
  filters?: ChipFilterDef[];
  searchable?: boolean;
  searchPlaceholder?: string;
  searchServerField?: string;
  searchField?: string;
  detailFields?: DetailFieldDef[];
  rowActions?: (row: T) => ReactNode;
  createLabel?: string;
  onCreate?: () => void;
  emptyText?: string;
  onViewDetail?: (row: T) => void;
  initialParams?: Record<string, unknown>;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState<T | null>(null);

  const activeChip = filters?.find((f) => f.value === activeFilter && f.value !== 'all');
  const serverParams: Record<string, unknown> = {
    ...(initialParams ?? {}),
    ...(activeChip?.field ? { [activeChip.field]: activeChip.match ?? activeChip.value } : {}),
    ...(searchServerField && keyword ? { [searchServerField]: keyword } : {}),
  };

  const { page, rows, total, loading, error, load, setPage } = useUserPage<T>(fetcher, pageSize);

  // 过滤条件变化 → 回到第 1 页重新取数
  useEffect(() => {
    load(1, serverParams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter, keyword]);

  const keywordOnServer = !!searchServerField;
  const clientFiltered = (!keywordOnServer && keyword) || !!activeChip?.test;
  const dataSource = rows.filter((r: any) => {
    if (activeChip?.test && !activeChip.test(r)) return false;
    if (!keywordOnServer && searchable && keyword) {
      const v = searchField
        ? searchField.split('.').reduce((acc: any, k) => (acc == null ? acc : acc[k]), r as any)
        : ((r as any).title ?? (r as any).name ?? (r as any).subject);
      if (!(v != null && String(v).includes(keyword))) return false;
    }
    return true;
  });
  const shownTotal = clientFiltered ? dataSource.length : total;
  const totalPages = Math.max(1, Math.ceil(shownTotal / pageSize));

  const openDetail = (row: T) => {
    setSelected(row);
    onViewDetail?.(row);
  };

  const displayColumns: Column<T>[] = [
    ...columns,
    ...(rowActions || detailFields
      ? [
          {
            key: '__op',
            title: t('common:button.detail'),
            align: 'right' as const,
            render: (r: T) => (
              <div className="flex justify-end gap-3">
                {rowActions ? rowActions(r) : null}
                {detailFields ? (
                  <button
                    type="button"
                    onClick={() => openDetail(r)}
                    className="text-[#D24830] hover:underline"
                  >
                    {t('common:button.detail')}
                  </button>
                ) : null}
              </div>
            ),
          },
        ]
      : []),
  ];

  const fmt = (v: any, format?: string) => {
    if (format === 'cents') return formatCents(v ?? 0);
    if (format === 'date') return v ? new Date(v).toLocaleDateString('zh-CN') : '—';
    if (format === 'stars') return <Stars rating={v} />;
    if (format === 'status') return v ?? '—';
    if (format === 'roles') return serviceRolesText(v);
    return v ?? '—';
  };

  const detailValues =
    detailFields?.map((f) => {
      const raw = f.key.split('.').reduce((acc: any, k) => (acc == null ? acc : acc[k]), selected as any);
      return { label: f.label, value: fmt(raw, f.format) };
    }) ?? [];

  const goPage = (p: number) => {
    setPage(p);
    load(p, serverParams);
  };

  return (
    <div className="space-y-4">
      <PageHead title={title} sub={sub} chip={chip} />
      <FilterBar
        filters={filters}
        active={activeFilter}
        onFilter={setActiveFilter}
        searchable={searchable}
        searchValue={keyword}
        onSearch={setKeyword}
        createLabel={createLabel}
        onCreate={onCreate}
      />
      <Panel
        title={title}
        hint={
          <>
            共 <b className="text-[#D24830]">{shownTotal}</b> 条 · 数据隔离由后端强制
          </>
        }
      >
        {error && !loading ? (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <p className="text-sm text-[#6e5f4a]">{error}</p>
            <button
              type="button"
              onClick={() => load(1, serverParams)}
              className="rounded-lg bg-[#D24830] px-4 py-1.5 text-sm font-medium text-white transition hover:bg-[#B23A22]"
            >
              {t('common:button.retry')}
            </button>
          </div>
        ) : (
          <UserTable columns={displayColumns} rows={dataSource} loading={loading} emptyText={emptyText ?? t('common:userCenter.empty')} />
        )}
        <div className="flex items-center justify-end gap-1.5 border-t border-[rgba(74,60,42,0.10)] px-4 py-2.5 text-[12.5px] text-[#6e5f4a]">
          <span>
            共{' '}
            <b className="text-[#2a2118] tabular-nums" style={{ fontFamily: "'Bahnschrift','DIN Alternate',Arial,system-ui,sans-serif" }}>
              {shownTotal}
            </b>{' '}
            条
          </span>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => goPage(page - 1)}
            className="rounded px-2.5 py-[3px] text-[12.5px] text-[#4c4236] disabled:opacity-40 hover:bg-[#f5f2ec]"
          >
            ‹ 上一页
          </button>
          <span className="text-[#6e5f4a]">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => goPage(page + 1)}
            className="rounded px-2.5 py-[3px] text-[12.5px] text-[#4c4236] disabled:opacity-40 hover:bg-[#f5f2ec]"
          >
            下一页 ›
          </button>
        </div>
      </Panel>
      {detailFields && selected && (
        <DetailModal tag={chip} title={title} fields={detailValues} onClose={() => setSelected(null)} />
      )}
      {children}
    </div>
  );
}

/** 评价编辑器（镜像 admin EvalModal）：提交到 POST /api/user/reviews（订单或服务商） */
export function ReviewEditor({
  target,
  initialRating,
  initialContent,
  onClose,
  onSubmitted,
}: {
  target: { orderId?: string; providerId?: string; name?: string };
  initialRating?: number | null;
  initialContent?: string | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(initialRating ?? 5);
  const [content, setContent] = useState(initialContent ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    if (!content.trim()) {
      setErr(t('common:userCenter.feedback.contentPlaceholder'));
      return;
    }
    setSaving(true);
    try {
      await api.post('/api/user/reviews', {
        ...(target.orderId ? { orderId: target.orderId } : {}),
        ...(target.providerId ? { providerId: target.providerId } : {}),
        rating,
        content,
      });
      onSubmitted();
    } catch (e: any) {
      setErr(e?.message || 'failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(30,24,16,0.45)] p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-[14px] bg-[#fffefb] p-5 shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3 className="mb-3 text-[14.5px] font-semibold text-[#2a2118]">{target.name || t('common:userCenter.orders.review')}</h3>
        <div className="mb-3 flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              className={n <= rating ? 'text-2xl text-amber-500' : 'text-2xl text-gray-300'}
            >
              ★
            </button>
          ))}
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          placeholder={t('common:userCenter.feedback.contentPlaceholder')}
          className="w-full rounded-lg border border-gray-200 p-3 text-sm outline-none focus:border-[#D24830]"
        />
        {err && <p className="mt-1 text-xs text-red-500">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600"
          >
            {t('common:button.cancel')}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={submit}
            className="rounded-lg bg-[#D24830] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? t('common:userCenter.loading') : t('common:button.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
