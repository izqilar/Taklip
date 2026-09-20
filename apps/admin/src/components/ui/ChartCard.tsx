import type { ReactNode } from 'react';
import { T } from '../../config/theme';

export interface ChartCardProps {
  title?: ReactNode;
  /** 标题右侧弱提示（自动右对齐） */
  hint?: ReactNode;
  children?: ReactNode;
  style?: React.CSSProperties;
}

/**
 * 图表面板（原型 .chart）：与 Panel 同底同线，但头部无分隔线、内边距 14/16。
 */
export const ChartCard = ({ title, hint, children, style }: ChartCardProps) => (
  <section
    style={{
      background: T.bg,
      border: `1px solid ${T.border}`,
      borderRadius: T.rMd,
      padding: '14px 16px',
      minWidth: 0,
      ...style,
    }}
  >
    {(title != null || hint != null) && (
      <h4
        style={{
          margin: 0,
          fontSize: 14.5,
          fontWeight: 650,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: T.ink1,
        }}
      >
        {title}
        {hint != null && (
          <span style={{ marginLeft: 'auto', color: T.ink3, fontSize: 12, fontWeight: 400 }}>
            {hint}
          </span>
        )}
      </h4>
    )}
    {children}
  </section>
);

export default ChartCard;
