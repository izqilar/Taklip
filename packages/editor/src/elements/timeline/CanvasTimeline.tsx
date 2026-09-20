import { Group, Rect, Line, Circle, Text } from 'react-konva';
import type { TimelineElement } from '@h5design/core';

interface CanvasTimelineProps {
  el: TimelineElement;
  common: Record<string, unknown>;
}

const FONT = 'Microsoft YaHei, PingFang SC, sans-serif';

/**
 * 婚礼当天流程时间轴（编辑态 Konva 渲染）。
 * 竖向轴线 + 节点圆点 + 时间/标题/描述。
 * 背景透明（组件无 bgColor 字段），阴影无法作用于 Group，故在 Group 上清空。
 */
export default function CanvasTimeline({ el, common }: CanvasTimelineProps) {
  const { width, height, nodes, themeColor, textColor } = el;
  const pad = 14;
  const dotX = pad + 6;
  const lineTop = pad + 6;
  const lineBottom = height - pad - 6;
  const count = nodes.length || 1;
  const segH = (lineBottom - lineTop) / count;

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
      {/* 透明全尺寸命中区：组件无背景，但需保证整块区域可点击选中/拖拽。
          该 Rect 不设 listening=false，作为 Konva 命中区域（对标 messageBoard/like 的白色底 Rect）。 */}
      <Rect
        width={width}
        height={height}
        fill="transparent"
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
      />
      <Line
        points={[dotX, lineTop, dotX, lineBottom]}
        stroke={themeColor || '#ef4444'}
        strokeWidth={2}
        listening={false}
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
      />
      {nodes.map((n, i) => {
        const cy = lineTop + segH * (i + 0.5);
        return (
          <Group key={`${n.time}-${i}`} listening={false}>
            <Circle
              x={dotX}
              y={cy}
              radius={6}
              fill={themeColor || '#ef4444'}
              perfectDrawEnabled={false}
              shadowForStrokeEnabled={false}
            />
            <Text
              x={dotX + 18}
              y={cy - 16}
              text={n.time}
              fontSize={13}
              fontStyle="bold"
              fontFamily={FONT}
              fill={themeColor || '#ef4444'}
              listening={false}
              perfectDrawEnabled={false}
              shadowForStrokeEnabled={false}
            />
            <Text
              x={dotX + 18}
              y={cy - 2}
              text={n.title}
              fontSize={13}
              fontFamily={FONT}
              fill={textColor || '#333333'}
              listening={false}
              perfectDrawEnabled={false}
              shadowForStrokeEnabled={false}
            />
            <Text
              x={dotX + 18}
              y={cy + 14}
              width={width - dotX - 18 - pad}
              text={n.desc}
              fontSize={11}
              fontFamily={FONT}
              fill={textColor || '#333333'}
              opacity={0.7}
              wrap="word"
              listening={false}
              perfectDrawEnabled={false}
              shadowForStrokeEnabled={false}
            />
          </Group>
        );
      })}
    </Group>
  );
}
