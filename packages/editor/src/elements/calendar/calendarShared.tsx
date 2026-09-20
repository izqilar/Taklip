import type { CalendarMarker } from '@h5design/core';

export interface CalendarCell {
  day: number;
  isCurrentMonth: boolean;
  row: number;
  col: number;
}

/** 计算某年某月的日历网格（固定 6 行 x 7 列，含前后月补位）。编辑态与发布态共用，保证所见即所得。 */
export function getCalendarGrid(year: number, month: number): CalendarCell[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();

  const cells: CalendarCell[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push({
      day: prevMonthDays - firstDayOfWeek + 1 + i,
      isCurrentMonth: false,
      row: 0,
      col: i,
    });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      isCurrentMonth: true,
      row: Math.floor((firstDayOfWeek + d - 1) / 7),
      col: (firstDayOfWeek + d - 1) % 7,
    });
  }
  let nextDay = 1;
  while (cells.length < 42) {
    cells.push({
      day: nextDay++,
      isCurrentMonth: false,
      row: Math.floor(cells.length / 7),
      col: cells.length % 7,
    });
  }
  return cells;
}

export const WEEKDAYS_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export const WEEKDAYS_ZH = ['日', '一', '二', '三', '四', '五', '六'];

function starPoints(cx: number, cy: number, outer: number, inner: number, points: number): string {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const ang = -Math.PI / 2 + (i * Math.PI) / points;
    pts.push(`${(cx + r * Math.cos(ang)).toFixed(2)},${(cy + r * Math.sin(ang)).toFixed(2)}`);
  }
  return pts.join(' ');
}

/** 渲染高亮标记形状（SVG，中心位于 size/2, size/2）。供发布态 DOM 渲染使用。 */
export function CalendarMarkerSvg({
  marker,
  size,
  color,
}: {
  marker: CalendarMarker;
  size: number;
  color: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  switch (marker) {
    case 'heart': {
      const s = size * 0.5;
      const path = `M ${cx} ${cy + s * 0.3}
        C ${cx} ${cy - s * 0.4}, ${cx - s} ${cy - s * 0.6}, ${cx - s} ${cy}
        C ${cx - s} ${cy + s * 0.5}, ${cx} ${cy + s * 0.9}, ${cx} ${cy + s * 0.9}
        C ${cx} ${cy + s * 0.9}, ${cx + s} ${cy + s * 0.5}, ${cx + s} ${cy}
        C ${cx + s} ${cy - s * 0.6}, ${cx} ${cy - s * 0.4}, ${cx} ${cy + s * 0.3} Z`;
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <path d={path} fill={color} />
        </svg>
      );
    }
    case 'star':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <polygon points={starPoints(cx, cy, size * 0.45, size * 0.22, 5)} fill={color} />
        </svg>
      );
    case 'flower': {
      const petals = Array.from({ length: 6 }).map((_, i) => {
        const ang = (i * Math.PI) / 3;
        const px = cx + Math.cos(ang) * size * 0.22;
        const py = cy + Math.sin(ang) * size * 0.22;
        return <circle key={i} cx={px} cy={py} r={size * 0.18} fill={color} />;
      });
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {petals}
          <circle cx={cx} cy={cy} r={size * 0.15} fill={color} />
        </svg>
      );
    }
    case 'diamond': {
      const r = size * 0.42;
      const pts = `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <polygon points={pts} fill={color} />
        </svg>
      );
    }
    case 'circle':
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={size * 0.42} fill={color} />
        </svg>
      );
    case 'snow': {
      const lines = Array.from({ length: 6 }).map((_, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy - size * 0.45}
          x2={cx}
          y2={cy + size * 0.45}
          stroke={color}
          strokeWidth={2}
          transform={`rotate(${i * 60} ${cx} ${cy})`}
        />
      ));
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {lines}
          <circle cx={cx} cy={cy} r={size * 0.12} fill={color} />
        </svg>
      );
    }
    default:
      return null;
  }
}

/** 发布态图标动画所需的 keyframes（图标脉冲） */
export const CALENDAR_PULSE_KEYFRAMES =
  '@keyframes calendar-marker-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.18); } }';
