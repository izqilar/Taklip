import type { CSSProperties } from 'react';
import type { PuzzleElement } from '@h5design/core';
import { getPuzzleLayout, getShapePathD } from './puzzleLayouts';

interface DOMPuzzleProps {
  el: PuzzleElement;
  style: CSSProperties;
  dataAttrs?: Record<string, string>;
}

/**
 * 拼图（照片墙）发布态渲染。
 * 复用与编辑态相同的 PuzzleLayout 几何数据，保证所见即所得。
 * 每块图块：外层绝对定位容器 + 内层 SVG（clipPath 裁剪形状 + <image> 填充图片）。
 */
export default function DOMPuzzle({ el, style, dataAttrs }: DOMPuzzleProps) {
  const { width, height, layout, images, gap, padding, bgColor, placeholderColor } = el;
  const layoutDef = getPuzzleLayout(layout);

  const innerW = Math.max(0, width - padding * 2);
  const innerH = Math.max(0, height - padding * 2);

  const containerStyle: CSSProperties = {
    ...style,
    background: bgColor,
    overflow: 'hidden',
  };

  return (
    <div {...dataAttrs} style={containerStyle}>
      {layoutDef.pieces.map((piece, idx) => {
        const px = padding + piece.x * innerW;
        const py = padding + piece.y * innerH;
        const pw = piece.w * innerW - gap;
        const ph = piece.h * innerH - gap;
        if (pw <= 0 || ph <= 0) return null;

        const src = images[idx];
        const clipId = `puzzle-clip-${el.id}-${idx}`.replace(/[^a-zA-Z0-9_-]/g, '');
        const d = getShapePathD(piece);

        return (
          <div
            key={idx}
            style={{
              position: 'absolute',
              left: px,
              top: py,
              width: pw,
              height: ph,
              overflow: 'hidden',
            }}
          >
            <svg width={pw} height={ph} viewBox="0 0 1 1" preserveAspectRatio="none" style={{ display: 'block' }}>
              <defs>
                <clipPath id={clipId}>
                  <path d={d} />
                </clipPath>
              </defs>
              {src ? (
                <image
                  href={src}
                  x={0}
                  y={0}
                  width={1}
                  height={1}
                  preserveAspectRatio="xMidYMid slice"
                  clipPath={`url(#${clipId})`}
                />
              ) : (
                <path d={d} fill={placeholderColor} />
              )}
            </svg>
          </div>
        );
      })}
    </div>
  );
}
