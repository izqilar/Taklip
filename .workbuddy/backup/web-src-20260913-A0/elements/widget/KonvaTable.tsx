import type { ReactElement } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type { WidgetElement } from '@h5design/core';

interface KonvaTableProps {
  el: WidgetElement;
  common: Record<string, unknown>;
}

/**
 * 用 Konva 原语真绘制表格内容，等价于 widgetModules.tsx 的 TableDOM（所见即所得）。
 * 之前表格走通用 CanvasWidget 占位框，只画标题框不渲染内容，导致导出视频/画布里表格空白。
 */
function parseCsv(csv: unknown): string[][] {
  const lines = String(csv ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  return lines.map((line) => line.split(','));
}

const FONT = 'Microsoft YaHei, PingFang SC, sans-serif';
const BORDER = '#e5e7eb';
const ROW_H = 24;
const PAD = 6;

export default function KonvaTable({ el, common }: KonvaTableProps) {
  const { width, height, bgColor, textColor, borderWidth, borderColor, borderRadius, themeColor } =
    el as WidgetElement;

  const csv = (el.data?.csv as string) ?? '';
  const headerBg = themeColor || '#ef4444';
  const bodyBg = bgColor || '#ffffff';
  const fg = textColor || '#333333';

  const rows = parseCsv(csv);
  const innerW = Math.max(1, width - PAD * 2);
  const numCols = rows.reduce((m, r) => Math.max(m, r.length), 0) || 1;
  const colW = innerW / numCols;

  const cellText = (txt: string, x: number, y: number, w: number, fill: string, bold: boolean) => (
    <Text
      key={`t-${x}-${y}-${txt}`}
      x={x + 6}
      y={y}
      width={Math.max(1, w - 12)}
      height={ROW_H}
      text={txt}
      fontSize={12}
      fontFamily={FONT}
      fontStyle={bold ? 'bold' : 'normal'}
      fill={fill}
      align="center"
      verticalAlign="middle"
      ellipsis
      wrap="none"
      listening={false}
      perfectDrawEnabled={false}
      shadowForStrokeEnabled={false}
    />
  );

  const cells: ReactElement[] = [];

  if (rows.length === 0) {
    cells.push(
      <Text
        key="empty"
        x={PAD}
        y={0}
        width={Math.max(1, width - PAD * 2)}
        height={height}
        text="请在属性面板填写表格内容"
        fontSize={12}
        fontFamily={FONT}
        fill="#94a3b8"
        align="center"
        verticalAlign="middle"
        listening={false}
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
      />,
    );
  } else {
    rows.forEach((row, ri) => {
      const y = PAD + ri * ROW_H;
      const isHeader = ri === 0;
      row.forEach((cell, ci) => {
        const x = PAD + ci * colW;
        const fill = isHeader ? headerBg : ri % 2 ? '#fafafa' : '#ffffff';
        cells.push(
          <Rect
            key={`c-${ri}-${ci}`}
            x={x}
            y={y}
            width={colW}
            height={ROW_H}
            fill={fill}
            stroke={BORDER}
            strokeWidth={1}
            listening={false}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />,
        );
        cells.push(cellText(cell, x, y, colW, isHeader ? '#ffffff' : fg, isHeader));
      });
    });
  }

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
      clipX={0}
      clipY={0}
      clipWidth={width}
      clipHeight={height}
    >
      <Rect
        width={width}
        height={height}
        fill={bodyBg}
        cornerRadius={borderRadius || 8}
        stroke={borderWidth ? borderColor || '#000000' : undefined}
        strokeWidth={borderWidth || 0}
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
      />
      {cells}
    </Group>
  );
}
