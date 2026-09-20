import { T } from '../../config/theme';

export interface BarRow {
  /** 名称（左侧固定 64px） */
  name: string;
  /** 主数值（条形长度 + 右侧数值） */
  value: number;
  /** 次数值（再右侧一列，如订单量） */
  value2?: number;
  /** 主数值格式化后缀，如 'w' */
  suffix?: string;
  prefix?: string;
}

export interface BarCompareProps {
  data: BarRow[];
  /** 主色（默认朱砂） */
  color?: string;
  /** 次色（默认青） */
  color2?: string;
  /** 图例：[主色名, 次色名]，不传则不渲染图例 */
  legend?: [string, string];
}

const fmt = (n: number, prefix = '', suffix = '') =>
  `${prefix}${n.toLocaleString('en-US')}${suffix}`;

/**
 * 横向条形对比列表（原型 .bars）：名称 | 轨道条 | 主数值 | 次数值。
 * 与原型一致用手写 DOM/SVG，不引入图表库。
 * 注意：与 charts/VerticalBarChart（纵向单数值 SVG 条形图）是两种不同的图，切勿混淆。
 */
export const HorizontalBarList = ({
  data,
  color = T.accent,
  color2 = T.accent2,
  legend,
}: BarCompareProps) => {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 14 }}>
        {data.map((d) => (
          <div key={d.name}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
              <span
                style={{
                  width: 64,
                  color: T.ink2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={d.name}
              >
                {d.name}
              </span>
              <span
                style={{
                  flex: 1,
                  height: 14,
                  background: T.panel2,
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    height: '100%',
                    borderRadius: 4,
                    width: `${(d.value / max) * 100}%`,
                    background: color,
                  }}
                />
              </span>
              <span
                style={{
                  width: 58,
                  textAlign: 'right',
                  color: T.ink3,
                  fontSize: 12,
                  fontVariantNumeric: 'tabular-nums',
                  fontFamily: T.fontNum,
                }}
              >
                {fmt(d.value, d.prefix, d.suffix)}
              </span>
              {d.value2 != null && (
                <span
                  style={{
                    width: 56,
                    textAlign: 'right',
                    color: color2,
                    fontSize: 12,
                    fontVariantNumeric: 'tabular-nums',
                    fontFamily: T.fontNum,
                  }}
                >
                  {d.value2.toLocaleString('en-US')}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      {legend && (
        <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, color: T.ink2 }}>
          <span>
            <i
              style={{
                width: 9,
                height: 9,
                borderRadius: 2,
                display: 'inline-block',
                marginRight: 5,
                background: color,
              }}
            />
            {legend[0]}
          </span>
          <span>
            <i
              style={{
                width: 9,
                height: 9,
                borderRadius: 2,
                display: 'inline-block',
                marginRight: 5,
                background: color2,
              }}
            />
            {legend[1]}
          </span>
        </div>
      )}
    </>
  );
};

export default HorizontalBarList;
