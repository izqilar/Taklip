import type { ReactNode } from 'react';
import { T } from '../../config/theme';

export type PillTone = 'ok' | 'warn' | 'bad' | 'mut' | 'ac';

const TONE: Record<PillTone, { bg: string; fg: string }> = {
  ok: { bg: T.upBg, fg: T.upInk },
  warn: { bg: T.warnBg, fg: T.warnInk },
  bad: { bg: T.downBg, fg: T.downInk },
  mut: { bg: T.mutBg, fg: T.ink3 },
  ac: { bg: T.accentSoft, fg: T.accent },
};

export interface PillProps {
  tone?: PillTone;
  children?: ReactNode;
  style?: React.CSSProperties;
}

/**
 * 状态标签（原型 .tag）：状态双角色 —— 浅底 + 深字，不用纯色块。
 * ok=绿 warn=琥珀 bad=红 mut=灰 ac=朱砂（强调/进行中）
 */
export const Pill = ({ tone = 'mut', children, style }: PillProps) => (
  <span
    style={{
      display: 'inline-block',
      padding: '2px 9px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 500,
      background: TONE[tone].bg,
      color: TONE[tone].fg,
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    {children}
  </span>
);

export default Pill;
