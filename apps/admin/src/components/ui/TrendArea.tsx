import { useId } from 'react';
import { T } from '../../config/theme';

export interface TrendAreaProps {
  /** 数值序列（等距横轴） */
  data: number[];
  /** 图例：[名称, 右侧峰值说明] */
  legend?: [string, string?];
  height?: number;
}

/**
 * 资金流水趋势面积图（原型内嵌 SVG 折线 + 渐变填充）。
 * viewBox 与原型一致（400×170），保证视觉比例 1:1。
 */
export const TrendArea = ({ data, legend, height = 170 }: TrendAreaProps) => {
  const gid = useId().replace(/:/g, '');
  const W = 400;
  const H = 170;
  if (data.length < 2) {
    return <div style={{ color: T.ink3, fontSize: 12, padding: '24px 0' }}>暂无趋势数据</div>;
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = Math.max(1, max - min);
  // 顶部留 24px、底部基线 150（与原型一致）
  const top = 24;
  const base = 150;
  const step = W / (data.length - 1);

  const pts = data.map((v, i) => {
    const x = i * step;
    const y = top + (1 - (v - min) / span) * (base - top);
    return [x, y] as const;
  });

  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `M${pts[0][0].toFixed(1)},${base} L${line.split(' ').join(' L')} L${W},${base} L0,${base} Z`;

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', marginTop: 12 }} aria-label="流水趋势">
        <defs>
          <linearGradient id={`lg-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={T.accent} stopOpacity=".25" />
            <stop offset="1" stopColor={T.accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#lg-${gid})`} />
        <polyline
          points={line}
          fill="none"
          stroke={T.accent}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line x1="0" y1={base} x2={W} y2={base} stroke={T.border} />
      </svg>
      {legend && (
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: T.ink2 }}>
          <span>
            <i
              style={{
                width: 9,
                height: 9,
                borderRadius: 2,
                display: 'inline-block',
                marginRight: 5,
                background: T.accent,
              }}
            />
            {legend[0]}
          </span>
          {legend[1] && <span style={{ marginLeft: 'auto' }}>{legend[1]}</span>}
        </div>
      )}
    </>
  );
};

export default TrendArea;
