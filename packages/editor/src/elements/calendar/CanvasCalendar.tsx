import { useEffect, useRef } from 'react';
import { Group, Rect, Text, Path, Line, RegularPolygon, Star } from 'react-konva';
import Konva from 'konva';
import type { CalendarElement, CalendarMarker } from '@h5design/core';
import { getCalendarGrid, WEEKDAYS_EN, WEEKDAYS_ZH } from '@h5design/render';

interface CanvasCalendarProps {
  el: CalendarElement;
  common: Record<string, unknown>;
}

/** 渲染高亮标记形状 */
function MarkerShape({
  marker,
  x,
  y,
  size,
  color,
}: {
  marker: CalendarMarker;
  x: number;
  y: number;
  size: number;
  color: string;
}) {
  switch (marker) {
    case 'heart': {
      // 心形路径，中心在 x,y
      const s = size * 0.5;
      const path = `M ${x} ${y + s * 0.3}
                    C ${x} ${y - s * 0.4}, ${x - s} ${y - s * 0.6}, ${x - s} ${y}
                    C ${x - s} ${y + s * 0.5}, ${x} ${y + s * 0.9}, ${x} ${y + s * 0.9}
                    C ${x} ${y + s * 0.9}, ${x + s} ${y + s * 0.5}, ${x + s} ${y}
                    C ${x + s} ${y - s * 0.6}, ${x} ${y - s * 0.4}, ${x} ${y + s * 0.3} Z`;
      return <Path data={path} fill={color} listening={false} perfectDrawEnabled={false} shadowForStrokeEnabled={false} />;
    }
    case 'star':
      return (
        <Star
          x={x}
          y={y}
          numPoints={5}
          innerRadius={size * 0.22}
          outerRadius={size * 0.45}
          fill={color}
          listening={false}
          perfectDrawEnabled={false}
          shadowForStrokeEnabled={false}
        />
      );
    case 'flower':
      return (
        <Group x={x} y={y} listening={false}>
          {Array.from({ length: 6 }).map((_, i) => (
            <RegularPolygon
              key={i}
              x={Math.cos((i * Math.PI) / 3) * size * 0.22}
              y={Math.sin((i * Math.PI) / 3) * size * 0.22}
              sides={6}
              radius={size * 0.18}
              fill={color}
              perfectDrawEnabled={false}
              shadowForStrokeEnabled={false}
            />
          ))}
          <RegularPolygon sides={6} radius={size * 0.15} fill={color} perfectDrawEnabled={false} shadowForStrokeEnabled={false} />
        </Group>
      );
    case 'diamond':
      return (
        <RegularPolygon
          x={x}
          y={y}
          sides={4}
          radius={size * 0.42}
          fill={color}
          rotation={45}
          listening={false}
          perfectDrawEnabled={false}
          shadowForStrokeEnabled={false}
        />
      );
    case 'circle':
      return (
        <RegularPolygon
          x={x}
          y={y}
          sides={32}
          radius={size * 0.42}
          fill={color}
          listening={false}
          perfectDrawEnabled={false}
          shadowForStrokeEnabled={false}
        />
      );
    case 'snow':
      return (
        <Group x={x} y={y} listening={false}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Line
              key={i}
              points={[0, -size * 0.45, 0, size * 0.45]}
              stroke={color}
              strokeWidth={2}
              rotation={i * 60}
              perfectDrawEnabled={false}
              shadowForStrokeEnabled={false}
            />
          ))}
          <RegularPolygon sides={6} radius={size * 0.12} fill={color} perfectDrawEnabled={false} shadowForStrokeEnabled={false} />
        </Group>
      );
    default:
      return null;
  }
}

export default function CanvasCalendar({ el, common }: CanvasCalendarProps) {
  const {
    width,
    height,
    year,
    month,
    highlightDay,
    locale,
    marker,
    themeColor,
    dayColor,
    iconColor,
    textColor,
    bgColor,
    fontFamily,
    iconAnimation,
    shadowColor,
    shadowBlur,
    shadowOffsetX,
    shadowOffsetY,
    shadowOpacity,
  } = el;

  // Konva 不会在 Group 上渲染阴影，必须将阴影属性设在可见子形状上
  const hasShadow = !!(shadowColor && shadowColor !== 'transparent');
  const shadowProps = hasShadow
    ? {
        shadowColor,
        shadowBlur: shadowBlur || 0,
        shadowOffsetX: shadowOffsetX || 0,
        shadowOffsetY: shadowOffsetY || 0,
        shadowOpacity: typeof shadowOpacity === 'number' ? shadowOpacity : 1,
      }
    : {};

  const highlightRef = useRef<Konva.Group>(null);

  // 图标动画：选中日期的标记做脉冲缩放（围绕单元格中心，避免位移）
  useEffect(() => {
    const node = highlightRef.current;
    if (!node) return;
    node.scaleX(1);
    node.scaleY(1);
    if (!iconAnimation) return;
    const tween = new Konva.Tween({
      node,
      scaleX: 1.18,
      scaleY: 1.18,
      duration: 0.7,
      yoyo: true,
      repeat: -1,
      easing: Konva.Easings.EaseInOut,
    });
    tween.play();
    return () => {
      tween.destroy();
    };
  }, [iconAnimation, year, month, highlightDay]);

  const padding = Math.min(width, height) * 0.05;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const headerH = innerH * 0.22;
  const weekdayH = innerH * 0.1;
  const gridTop = headerH + weekdayH;
  const gridH = innerH - gridTop;
  const cellW = innerW / 7;
  const cellH = gridH / 6;

  const weekdays = locale === 'en' ? WEEKDAYS_EN : WEEKDAYS_ZH;
  const grid = getCalendarGrid(year, month);
  const monthLabel = `${month}`;
  const dayLabel = String(highlightDay).padStart(2, '0');
  const ff = fontFamily || 'Microsoft YaHei, PingFang SC, sans-serif';

  return (
    <Group
      {...common}
      offsetX={width / 2}
      offsetY={height / 2}
      shadowColor={undefined}
      shadowBlur={0}
      shadowOffsetX={0}
      shadowOffsetY={0}
      shadowOpacity={1}
    >
      {/* 背景：作为整块日历的命中目标，必须保持可点击/可拖拽（不能设 listening=false）+ 阴影投射层 */}
      <Rect
        width={width}
        height={height}
        fill={bgColor || '#ffffff'}
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
        {...shadowProps}
      />

      {/* 顶部标题区 */}
      <Group x={padding} y={padding}>
        {/* 左侧大日期 8 / 18 */}
        <Text
          x={0}
          y={headerH * 0.1}
          text={`${monthLabel} / ${dayLabel}`}
          fontSize={headerH * 0.55}
          fontFamily={ff}
          fill={themeColor}
          fontStyle="bold"
          listening={false}
          perfectDrawEnabled={false}
          shadowForStrokeEnabled={false}
        />
        {/* 右侧年份：给定 width + align right，避免文字向右溢出 */}
        <Text
          x={0}
          y={headerH * 0.15}
          width={innerW}
          text={String(year)}
          fontSize={headerH * 0.5}
          fontFamily={ff}
          fill={themeColor}
          fontStyle="bold"
          align="right"
          listening={false}
          perfectDrawEnabled={false}
          shadowForStrokeEnabled={false}
        />
      </Group>

      {/* 分隔线 */}
      <Line
        points={[padding, padding + headerH, width - padding, padding + headerH]}
        stroke={themeColor}
        strokeWidth={1}
        opacity={0.4}
        listening={false}
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
      />

      {/* 星期行 */}
      <Group x={padding} y={padding + headerH}>
        {weekdays.map((wd, i) => (
          <Text
            key={wd}
            x={i * cellW}
            y={0}
            width={cellW}
            height={weekdayH}
            text={wd}
            fontSize={weekdayH * 0.45}
            fontFamily={ff}
            fill={themeColor}
            align="center"
            verticalAlign="middle"
            listening={false}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />
        ))}
      </Group>

      {/* 日期网格 */}
      <Group x={padding} y={padding + gridTop}>
        {grid.map((cell, idx) => {
          const cx = cell.col * cellW + cellW / 2;
          const cy = cell.row * cellH + cellH / 2;
          const isHighlight = cell.isCurrentMonth && cell.day === highlightDay;
          const textColorForCell = isHighlight ? textColor : cell.isCurrentMonth ? dayColor : '#d1d5db';
          const fontSize = Math.min(cellW, cellH) * 0.42;

          if (isHighlight) {
            return (
              <Group key={idx} x={cx} y={cy} ref={highlightRef}>
                <MarkerShape marker={marker} x={0} y={0} size={Math.min(cellW, cellH) * 0.82} color={iconColor} />
                <Text
                  x={-cellW / 2}
                  y={-cellH / 2}
                  width={cellW}
                  height={cellH}
                  text={String(cell.day)}
                  fontSize={fontSize}
                  fontFamily={ff}
                  fill={textColorForCell}
                  align="center"
                  verticalAlign="middle"
                  listening={false}
                  perfectDrawEnabled={false}
                  shadowForStrokeEnabled={false}
                />
              </Group>
            );
          }

          return (
            <Group key={idx}>
              <Text
                x={cell.col * cellW}
                y={cell.row * cellH}
                width={cellW}
                height={cellH}
                text={String(cell.day)}
                fontSize={fontSize}
                fontFamily={ff}
                fill={textColorForCell}
                align="center"
                verticalAlign="middle"
                listening={false}
                perfectDrawEnabled={false}
                shadowForStrokeEnabled={false}
              />
            </Group>
          );
        })}
      </Group>
    </Group>
  );
}
