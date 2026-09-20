import { Group, Rect, Text, Path } from 'react-konva';
import type { LikeElement } from '@h5design/core';

interface CanvasLikeProps {
  el: LikeElement;
  common: Record<string, unknown>;
}

const HEART_PATH = 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';

export default function CanvasLike({ el, common }: CanvasLikeProps) {
  const { width, height, text, themeColor, textColor, count, iconSize, shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY, shadowOpacity } = el;

  const hasShadow = !!(shadowColor && shadowColor !== 'transparent');
  const shadowProps = hasShadow
    ? { shadowColor, shadowBlur: shadowBlur || 0, shadowOffsetX: shadowOffsetX || 0, shadowOffsetY: shadowOffsetY || 0, shadowOpacity: typeof shadowOpacity === 'number' ? shadowOpacity : 1 }
    : {};

  const padding = 12;
  const fontSize = Math.min(16, iconSize * 0.7);
  const textStr = `${text}  ${count}`;
  const textW = width - padding * 2 - iconSize - 8;
  const cy = height / 2;

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
      <Rect width={width} height={height} fill="#ffffff" cornerRadius={30} perfectDrawEnabled={false} shadowForStrokeEnabled={false} {...shadowProps} />
      <Path data={HEART_PATH} x={padding} y={cy - iconSize / 2} scaleX={iconSize / 24} scaleY={iconSize / 24} fill={themeColor || '#ef4444'} listening={false} perfectDrawEnabled={false} shadowForStrokeEnabled={false} />
      <Text x={padding + iconSize + 8} y={cy - fontSize / 2} width={textW} height={fontSize} text={textStr} fontSize={fontSize} fontFamily="Microsoft YaHei, PingFang SC, sans-serif" fill={textColor || '#333333'} verticalAlign="middle" ellipsis listening={false} perfectDrawEnabled={false} shadowForStrokeEnabled={false} />
    </Group>
  );
}
