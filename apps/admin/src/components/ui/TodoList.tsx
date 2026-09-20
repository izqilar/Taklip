import type { ReactNode } from 'react';
import { T } from '../../config/theme';

export interface TodoItem {
  /** 主文案 */
  title: ReactNode;
  /** 副文案（所在模块） */
  desc?: ReactNode;
  /** 右侧计数（待办数） */
  count?: ReactNode;
  /** 图标位文字（原型用单字：¥ / 审 / ⭐ / ✉） */
  icon?: ReactNode;
  /** 图标配色：a=朱砂 b=青 c=琥珀 */
  tone?: 'a' | 'b' | 'c';
  onClick?: () => void;
}

const TONE_BG: Record<string, string> = {
  a: T.accentSoft,
  b: T.accent2Soft,
  c: T.warnBg,
};
const TONE_FG: Record<string, string> = {
  a: T.accent,
  b: T.accent2,
  c: T.warnInk,
};

/**
 * 待办与预警列表（原型 .todo）：30px 圆角方图标 + 标题/说明 + 右侧大号计数，点按直达。
 */
export const TodoList = ({ items }: { items: TodoItem[] }) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    {items.map((it, i) => (
      <div
        key={i}
        onClick={it.onClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '11px 16px',
          borderBottom: i === items.length - 1 ? 0 : `1px solid ${T.border}`,
          cursor: it.onClick ? 'pointer' : 'default',
        }}
        onMouseEnter={(e) => {
          if (it.onClick) e.currentTarget.style.background = T.hover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            display: 'grid',
            placeItems: 'center',
            flex: 'none',
            fontSize: 14,
            background: TONE_BG[it.tone ?? 'a'],
            color: TONE_FG[it.tone ?? 'a'],
          }}
        >
          {it.icon}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{it.title}</b>
          {it.desc != null && (
            <span style={{ fontSize: 12, color: T.ink3 }}>{it.desc}</span>
          )}
        </span>
        <span
          style={{
            fontSize: 20,
            fontWeight: 750,
            color: T.accent,
            fontVariantNumeric: 'tabular-nums',
            fontFamily: T.fontNum,
          }}
        >
          {it.count}
        </span>
      </div>
    ))}
  </div>
);

export default TodoList;
