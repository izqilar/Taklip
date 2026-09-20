import { Group, Rect, Text } from 'react-konva';
import type { MessageBoardElement } from '@h5design/core';

interface CanvasMessageBoardProps {
  el: MessageBoardElement;
  common: Record<string, unknown>;
}

const FONT = 'Microsoft YaHei, PingFang SC, sans-serif';

/**
 * 留言板（编辑态 Konva 预览，非交互）。
 * 白色卡片 + 标题 + 留言列表 + 底部输入/发送条（仅展示）。
 */
export default function CanvasMessageBoard({ el, common }: CanvasMessageBoardProps) {
  const { width, height, title, themeColor, textColor, messages, allowPost, placeholder } = el;
  const pad = 12;
  const titleH = 26;
  const barH = allowPost ? 34 : 0;
  const listTop = pad + titleH;
  const listBottom = height - pad - barH;
  const rowH = 40;
  const maxRows = Math.max(1, Math.floor((listBottom - listTop) / rowH));
  const visible = messages.slice(0, maxRows);

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
      <Rect width={width} height={height} fill="#ffffff" cornerRadius={10} stroke="#f1f1f1" strokeWidth={1} perfectDrawEnabled={false} shadowForStrokeEnabled={false} />

      <Text
        x={pad}
        y={pad}
        text={title}
        fontSize={16}
        fontStyle="bold"
        fontFamily={FONT}
        fill={themeColor || '#ef4444'}
        listening={false}
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
      />

      {visible.length === 0 && (
        <Text
          x={pad}
          y={listTop + 10}
          width={width - pad * 2}
          text="（暂无留言）"
          fontSize={12}
          fontFamily={FONT}
          fill="#9ca3af"
          opacity={0.7}
          listening={false}
          perfectDrawEnabled={false}
          shadowForStrokeEnabled={false}
        />
      )}

      {visible.map((m, i) => {
        const y = listTop + i * rowH;
        return (
          <Group key={m.id} listening={false}>
            <Text
              x={pad}
              y={y}
              text={m.name}
              fontSize={12}
              fontStyle="bold"
              fontFamily={FONT}
              fill={themeColor || '#ef4444'}
              listening={false}
              perfectDrawEnabled={false}
              shadowForStrokeEnabled={false}
            />
            <Text
              x={pad}
              y={y + 16}
              width={width - pad * 2}
              text={m.text}
              fontSize={13}
              fontFamily={FONT}
              fill={textColor || '#333333'}
              wrap="word"
              listening={false}
              perfectDrawEnabled={false}
              shadowForStrokeEnabled={false}
            />
          </Group>
        );
      })}

      {allowPost && (
        <Group listening={false}>
          <Rect
            x={pad}
            y={listBottom + 4}
            width={width - pad * 2 - 56}
            height={barH - 8}
            fill="#ffffff"
            stroke="#d1d5db"
            strokeWidth={1}
            cornerRadius={6}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />
          <Text
            x={pad + 8}
            y={listBottom + 4 + (barH - 8) / 2 - 7}
            text={placeholder}
            fontSize={12}
            fontFamily={FONT}
            fill="#9ca3af"
            listening={false}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />
          <Rect
            x={width - pad - 48}
            y={listBottom + 4}
            width={48}
            height={barH - 8}
            fill={themeColor || '#ef4444'}
            cornerRadius={6}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />
          <Text
            x={width - pad - 48}
            y={listBottom + 4 + (barH - 8) / 2 - 7}
            width={48}
            text="发送"
            fontSize={12}
            fontFamily={FONT}
            fill="#ffffff"
            align="center"
            listening={false}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />
        </Group>
      )}
    </Group>
  );
}
