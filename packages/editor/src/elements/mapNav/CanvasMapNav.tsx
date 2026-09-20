import { Group, Rect, Text, Path } from 'react-konva';
import type { MapNavElement } from '@h5design/core';

interface CanvasMapNavProps {
  el: MapNavElement;
  common: Record<string, unknown>;
}

const PIN_PATH = 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z';

export default function CanvasMapNav({ el, common }: CanvasMapNavProps) {
  const { width, height, venue, address, buttonText, themeColor, textColor, shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY, shadowOpacity } = el;

  const hasShadow = !!(shadowColor && shadowColor !== 'transparent');
  const shadowProps = hasShadow
    ? { shadowColor, shadowBlur: shadowBlur || 0, shadowOffsetX: shadowOffsetX || 0, shadowOffsetY: shadowOffsetY || 0, shadowOpacity: typeof shadowOpacity === 'number' ? shadowOpacity : 1 }
    : {};

  const padding = 12;
  const iconSize = 28;
  const textX = padding + iconSize + 10;
  const textW = width - textX - padding;
  const btnH = 32;
  const btnY = height - padding - btnH;
  const innerW = width - padding * 2;

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
      <Rect width={width} height={height} fill="#ffffff" cornerRadius={10} perfectDrawEnabled={false} shadowForStrokeEnabled={false} {...shadowProps} />

      <Path data={PIN_PATH} x={padding} y={padding} scaleX={iconSize / 24} scaleY={iconSize / 24} fill={themeColor || '#ef4444'} listening={false} perfectDrawEnabled={false} shadowForStrokeEnabled={false} />

      <Text x={textX} y={padding} width={textW} text={venue} fontSize={16} fontFamily="Microsoft YaHei, PingFang SC, sans-serif" fill={textColor || '#333333'} fontStyle="bold" ellipsis listening={false} perfectDrawEnabled={false} shadowForStrokeEnabled={false} />
      <Text x={textX} y={padding + 24} width={textW} text={address} fontSize={12} fontFamily="Microsoft YaHei, PingFang SC, sans-serif" fill="#6b7280" wrap="word" listening={false} perfectDrawEnabled={false} shadowForStrokeEnabled={false} />

      <Rect x={padding} y={btnY} width={innerW} height={btnH} fill={themeColor || '#ef4444'} cornerRadius={btnH / 2} listening={false} perfectDrawEnabled={false} shadowForStrokeEnabled={false} />
      <Text x={padding} y={btnY} width={innerW} height={btnH} text={buttonText} fontSize={14} fontFamily="Microsoft YaHei, PingFang SC, sans-serif" fill="#ffffff" align="center" verticalAlign="middle" fontStyle="bold" listening={false} perfectDrawEnabled={false} shadowForStrokeEnabled={false} />
    </Group>
  );
}
