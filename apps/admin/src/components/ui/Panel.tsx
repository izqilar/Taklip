import type { ReactNode, CSSProperties } from 'react';
import { T } from '../../config/theme';

export interface PanelProps {
  /** 面板头标题（原型 .panel>header，14.5px/650） */
  title?: ReactNode;
  /** 头部右侧弱提示（原型 .hint，自动右对齐） */
  hint?: ReactNode;
  /** 无头面板（纯容器） */
  bare?: boolean;
  children?: ReactNode;
  style?: CSSProperties;
  bodyStyle?: CSSProperties;
  className?: string;
}

/**
 * 面板（原型 .panel）：白底 + 1px 线 + 10px 圆角，头部带底部分隔线。
 * B 端靠线不靠阴影 —— 全局不使用 elevation。
 */
export const Panel = ({
  title,
  hint,
  bare,
  children,
  style,
  bodyStyle,
  className,
}: PanelProps) => (
  <section
    className={className}
    style={{
      background: T.bg,
      border: `1px solid ${T.border}`,
      borderRadius: T.rMd,
      overflow: 'hidden',
      minWidth: 0,
      ...style,
    }}
  >
    {!bare && (title != null || hint != null) && (
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          borderBottom: `1px solid ${T.border}`,
          fontWeight: 650,
          fontSize: 14.5,
          color: T.ink1,
        }}
      >
        {title}
        {hint != null && (
          <span style={{ marginLeft: 'auto', color: T.ink3, fontWeight: 400, fontSize: 12 }}>
            {hint}
          </span>
        )}
      </header>
    )}
    <div style={bodyStyle}>{children}</div>
  </section>
);

export default Panel;
