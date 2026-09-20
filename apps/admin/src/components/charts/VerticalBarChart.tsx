import { Card, Typography } from 'antd';
import { T, BRAND } from '../../config/theme';

export interface BarDatum {
  label: string;
  value: number;
}

export interface BarCompareProps {
  title?: string;
  data: BarDatum[];
  /** 数值单位后缀，如 '元' / '单' */
  unit?: string;
  color?: string;
  height?: number;
}

/**
 * 纵向条形对比图（文档 §8.5 总台经营总览「区域对比条形图」）。
 * 轻量内联 SVG 还原原型手写条形图，避免引入重型图表依赖。
 * 注意：与 ui/HorizontalBarList（横向双数值条形列表）是两种不同的图，切勿混淆。
 */
export const VerticalBarChart = ({ title, data, unit = '', color = BRAND.red, height = 200 }: BarCompareProps) => {
  const max = Math.max(1, ...data.map((d) => d.value));
  const width = 520;
  const padB = 28;
  const padT = 12;
  const plotH = height - padB - padT;
  const gap = 16;
  const barW = data.length ? Math.min(48, (width - gap * (data.length + 1)) / data.length) : 0;

  return (
    <Card size="small" title={title} styles={{ body: { padding: 12 } }}>
      {data.length === 0 ? (
        <Typography.Text type="secondary">暂无数据</Typography.Text>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img">
          {data.map((d, i) => {
            const h = (d.value / max) * plotH;
            const x = gap + i * (barW + gap);
            const y = padT + (plotH - h);
            return (
              <g key={d.label}>
                <rect x={x} y={y} width={barW} height={h} rx={4} fill={color} />
                <text x={x + barW / 2} y={y - 4} fontSize={10} textAnchor="middle" fill={T.ink2}>
                  {d.value.toLocaleString('zh-CN')}
                  {unit}
                </text>
                <text x={x + barW / 2} y={height - 10} fontSize={10} textAnchor="middle" fill={T.ink3}>
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </Card>
  );
};
