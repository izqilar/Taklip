import { Card, Typography } from 'antd';
import { T } from '../../config/theme';

export interface DonutDatum {
  label: string;
  value: number;
  color?: string;
}

export interface DonutShareProps {
  title?: string;
  data: DonutDatum[];
  size?: number;
}

/** 图形序列色板：优先复用原型语义色，末两位为补充的暖石深阶（原型未定义，按同族外推） */
const PALETTE = [T.accent, T.accent2, T.up, T.warn, '#9c6b4a', '#5b4632', T.ink3, T.down];

/**
 * 环形占比图（文档 §8.5 代理商辖区概览「服务类别占比」）。
 * 轻量内联 SVG 还原原型手写环形图。
 */
export const DonutShare = ({ title, data, size = 200 }: DonutShareProps) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = size / 2 - 18;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  let acc = 0;

  return (
    <Card size="small" title={title} styles={{ body: { padding: 12 } }}>
      {total === 0 ? (
        <Typography.Text type="secondary">暂无数据</Typography.Text>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img">
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.panel2} strokeWidth={16} />
            {data.map((d, i) => {
              const frac = d.value / total;
              const dash = frac * circ;
              const seg = (
                <circle
                  key={d.label}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={d.color ?? PALETTE[i % PALETTE.length]}
                  strokeWidth={16}
                  strokeDasharray={`${dash} ${circ - dash}`}
                  strokeDashoffset={-acc}
                  transform={`rotate(-90 ${cx} ${cy})`}
                />
              );
              acc += dash;
              return seg;
            })}
            <text x={cx} y={cy - 4} fontSize={16} textAnchor="middle" fill={T.ink1} fontWeight={600}>
              {total.toLocaleString('zh-CN')}
            </text>
            <text x={cx} y={cy + 14} fontSize={10} textAnchor="middle" fill={T.ink3}>
              合计
            </text>
          </svg>
          <div>
            {data.map((d, i) => (
              <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: d.color ?? PALETTE[i % PALETTE.length],
                    display: 'inline-block',
                  }}
                />
                <span>{d.label}</span>
                <span style={{ color: T.ink3 }}>
                  {(d.value / total * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};
