import type { ReactNode, CSSProperties } from 'react';
import { T } from '../../config/theme';

export interface KpiCardProps {
  /** 指标名（原型 .kpi .k，12.5px 弱文） */
  label: ReactNode;
  /** 主数值（原型 .kpi .v，27px/750 等宽数字） */
  value: ReactNode;
  /** 趋势行（原型 .kpi .d）：up 绿 / dn 红 / 中性 */
  delta?: ReactNode;
  deltaTrend?: 'up' | 'down' | 'flat';
  /** 脚注（原型 .kpi .f，12px 弱文） */
  foot?: ReactNode;
  /** 主指标：朱砂描边 + 顶部内嵌 2px 色条 + 朱砂数值 */
  main?: boolean;
  /** 右下角迷你走势图（原型 .spark） */
  spark?: ReactNode;
  style?: CSSProperties;
}

/**
 * KPI 卡（原型 .kpi / .kpi.main）。
 * 设计要点：主指标大一号并用强调色标记，不搞四张一样大 —— 主卡独占 accent 边框与内嵌顶条。
 */
export const KpiCard = ({
  label,
  value,
  delta,
  deltaTrend = 'flat',
  foot,
  main,
  spark,
  style,
}: KpiCardProps) => {
  const deltaColor =
    deltaTrend === 'up' ? T.upInk : deltaTrend === 'down' ? T.downInk : T.ink3;

  return (
    <div
      style={{
        background: T.bg,
        border: `1px solid ${main ? T.accent : T.border}`,
        borderRadius: T.rMd,
        padding: '14px 16px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: main ? `inset 0 2px 0 ${T.accent}` : undefined,
        ...style,
      }}
    >
      <div style={{ color: T.ink3, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 27,
          fontWeight: 750,
          marginTop: 6,
          letterSpacing: '.01em',
          color: main ? T.accent : T.ink1,
          fontVariantNumeric: 'tabular-nums',
          fontFamily: T.fontNum,
        }}
      >
        {value}
      </div>
      {delta != null && (
        <div
          style={{
            fontSize: 12,
            marginTop: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: deltaColor,
          }}
        >
          {deltaTrend === 'up' && <ArrowUp />}
          {deltaTrend === 'down' && <ArrowDown />}
          {delta}
        </div>
      )}
      {foot != null && (
        <div style={{ fontSize: 12, color: T.ink3, marginTop: 4 }}>{foot}</div>
      )}
      {spark != null && (
        <div style={{ position: 'absolute', right: 12, bottom: 12, opacity: 0.9 }}>{spark}</div>
      )}
    </div>
  );
};

export const ArrowUp = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor" style={{ flex: 'none' }}>
    <path d="M205.66,117.66a8,8,0,0,1-11.32,0L136,59.31V216a8,8,0,0,1-16,0V59.31L61.66,117.66a8,8,0,0,1-11.32-11.32l72-72a8,8,0,0,1,11.32,0l72,72A8,8,0,0,1,205.66,117.66Z" />
  </svg>
);

export const ArrowDown = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor" style={{ flex: 'none' }}>
    <path d="M205.66,138.34a8,8,0,0,1-11.32,11.32L136,91.31V248a8,8,0,0,1-16,0V91.31L61.66,149.66a8,8,0,0,1-11.32-11.32l72-72a8,8,0,0,1,11.32,0l72,72A8,8,0,0,1,205.66,138.34Z" />
  </svg>
);

export default KpiCard;
