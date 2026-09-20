import { useEffect, useState } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type { CountdownElement } from '@h5design/core';
import { getRemaining, getUnitLabels, padDigits } from './countdownShared';

interface CanvasCountdownProps {
  el: CountdownElement;
  common: Record<string, unknown>;
}

export default function CanvasCountdown({ el, common }: CanvasCountdownProps) {
  const { width, height, title, target, showTitle, bgColor, textColor, themeColor, digitBgColor, fontSize, shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY, shadowOpacity } = el;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const hasShadow = !!(shadowColor && shadowColor !== 'transparent');
  const shadowProps = hasShadow
    ? { shadowColor, shadowBlur: shadowBlur || 0, shadowOffsetX: shadowOffsetX || 0, shadowOffsetY: shadowOffsetY || 0, shadowOpacity: typeof shadowOpacity === 'number' ? shadowOpacity : 1 }
    : {};

  const remaining = getRemaining(target);
  const values = [remaining.days, remaining.hours, remaining.minutes, remaining.seconds];
  const labels = getUnitLabels('zh');

  const padding = 10;
  const innerW = width - padding * 2;
  const titleH = showTitle ? fontSize * 0.8 : 0;
  const blockAreaH = height - padding * 2 - titleH;
  const colonW = fontSize * 0.5;
  const gap = 6;
  const blockW = Math.min((innerW - 3 * colonW - 2 * gap) / 4, blockAreaH * 1.4);
  const blockH = Math.min(blockW * 1.05, blockAreaH);
  const totalW = 4 * blockW + 3 * colonW;
  const startX = padding + (innerW - totalW) / 2;
  const blocksY = padding + titleH + (blockAreaH - blockH) / 2;

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
      <Rect width={width} height={height} fill={bgColor || '#fff5f5'} cornerRadius={8} perfectDrawEnabled={false} shadowForStrokeEnabled={false} {...shadowProps} />

      {showTitle && (
        <Text x={padding} y={padding} width={innerW} text={title} fontSize={fontSize * 0.7} fontFamily="Microsoft YaHei, PingFang SC, sans-serif" fill={textColor || '#7f1d1d'} align="center" fontStyle="bold" listening={false} perfectDrawEnabled={false} shadowForStrokeEnabled={false} />
      )}

      {values.map((v, i) => {
        const x = startX + i * (blockW + colonW);
        const label = labels[i];
        const num = i === 0 ? padDigits(v, 2) : padDigits(v, 2);
        return (
          <Group key={i} listening={false}>
            <Rect x={x} y={blocksY} width={blockW} height={blockH} fill={digitBgColor || '#ef4444'} cornerRadius={6} perfectDrawEnabled={false} shadowForStrokeEnabled={false} />
            <Text x={x} y={blocksY} width={blockW} height={blockH} text={num} fontSize={fontSize} fontFamily="Microsoft YaHei, PingFang SC, sans-serif" fill="#ffffff" align="center" verticalAlign="middle" fontStyle="bold" perfectDrawEnabled={false} shadowForStrokeEnabled={false} />
            <Text x={x - colonW / 2} y={blocksY + blockH + 2} width={blockW + colonW} text={label} fontSize={fontSize * 0.35} fontFamily="Microsoft YaHei, PingFang SC, sans-serif" fill={themeColor || '#ef4444'} align="center" listening={false} perfectDrawEnabled={false} shadowForStrokeEnabled={false} />
            {i < 3 && (
              <Text x={x + blockW + (colonW - fontSize * 0.5) / 2} y={blocksY} width={colonW} height={blockH} text=":" fontSize={fontSize * 0.9} fontFamily="Microsoft YaHei, PingFang SC, sans-serif" fill={themeColor || '#ef4444'} align="center" verticalAlign="middle" fontStyle="bold" listening={false} perfectDrawEnabled={false} shadowForStrokeEnabled={false} />
            )}
          </Group>
        );
      })}
    </Group>
  );
}
