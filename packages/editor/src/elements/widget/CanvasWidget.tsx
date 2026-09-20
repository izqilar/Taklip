import { Group, Rect, Text } from 'react-konva';
import type { WidgetElement } from '@h5design/core';
import { useTranslation } from 'react-i18next';
import { WIDGET_REGISTRY } from '@h5design/render';

interface CanvasWidgetProps {
  el: WidgetElement;
  common: Record<string, unknown>;
}

export default function CanvasWidget({ el, common }: CanvasWidgetProps) {
  const { t } = useTranslation('editor');
  const { width, height, bgColor, textColor, borderWidth, borderColor, borderRadius } = el;
  const def = WIDGET_REGISTRY[el.widget];

  const sc = common.shadowColor as string | undefined;
  const hasShadow = !!sc && sc !== 'transparent';
  const shadowProps = hasShadow
    ? {
        shadowColor: sc,
        shadowBlur: Number(common.shadowBlur) || 0,
        shadowOffsetX: Number(common.shadowOffsetX) || 0,
        shadowOffsetY: Number(common.shadowOffsetY) || 0,
        shadowOpacity: typeof common.shadowOpacity === 'number' ? common.shadowOpacity : 1,
      }
    : {};

  const padding = 10;
  const iconSize = Math.min(24, Math.max(16, height * 0.3));
  const label = t(def?.labelKey ?? 'editor:element.widget');
  const title = el.title || label;

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
      <Rect
        width={width}
        height={height}
        fill={bgColor || '#ffffff'}
        cornerRadius={borderRadius || 8}
        stroke={borderWidth ? borderColor || '#000000' : undefined}
        strokeWidth={borderWidth || 0}
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
        {...shadowProps}
      />
      {el.title || !def?.icon ? (
        <Text
          x={padding}
          y={(height - 16) / 2}
          width={width - padding * 2}
          text={title}
          fontSize={14}
          fontFamily="Microsoft YaHei, PingFang SC, sans-serif"
          fill={textColor || '#333333'}
          verticalAlign="middle"
          ellipsis
          listening={false}
          perfectDrawEnabled={false}
          shadowForStrokeEnabled={false}
        />
      ) : (
        <>
          <Text
            x={padding}
            y={(height - iconSize) / 2}
            text={def.icon}
            fontSize={iconSize}
            listening={false}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />
          <Text
            x={padding + iconSize + 8}
            y={(height - 14) / 2}
            width={width - padding * 2 - iconSize - 8}
            text={title}
            fontSize={13}
            fontFamily="Microsoft YaHei, PingFang SC, sans-serif"
            fill={textColor || '#333333'}
            verticalAlign="middle"
            ellipsis
            listening={false}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />
        </>
      )}
    </Group>
  );
}
