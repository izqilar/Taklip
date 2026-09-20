import { useEffect, useState } from 'react';
import { Group, Rect, Image } from 'react-konva';
import type { PuzzleElement } from '@h5design/core';
import { getPuzzleLayout, drawShapeInClip } from '@h5design/render';

interface CanvasPuzzleProps {
  el: PuzzleElement;
  common?: Record<string, unknown>;
  update?: (patch: Partial<PuzzleElement>) => void;
}

/** 预加载图片列表，返回 src -> HTMLImageElement 的映射 */
function useLoadedImages(srcs: string[]) {
  const [map, setMap] = useState<Record<string, HTMLImageElement>>({});
  useEffect(() => {
    let cancelled = false;
    const next: Record<string, HTMLImageElement> = {};
    const loads = srcs.map((src) => {
      return new Promise<void>((resolve) => {
        if (!src) {
          resolve();
          return;
        }
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          next[src] = img;
          resolve();
        };
        img.onerror = () => resolve();
        img.src = src;
      });
    });
    Promise.all(loads).then(() => {
      if (!cancelled) setMap(next);
    });
    return () => {
      cancelled = true;
    };
  }, [srcs.join(',')]);
  return map;
}

export default function CanvasPuzzle({ el, common = {}, update }: CanvasPuzzleProps) {
  const {
    width,
    height,
    layout,
    images,
    gap,
    padding,
    bgColor,
    placeholderColor,
    shadowColor,
    shadowBlur,
    shadowOffsetX,
    shadowOffsetY,
    shadowOpacity,
  } = el;

  const layoutDef = getPuzzleLayout(layout);
  const loadedMap = useLoadedImages(images);

  const innerW = Math.max(0, width - padding * 2);
  const innerH = Math.max(0, height - padding * 2);

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

  // common 使用中心坐标 (cx, cy)，需配合 offsetX/offsetY = width/2, height/2
  const groupProps = {
    ...common,
    offsetX: width / 2,
    offsetY: height / 2,
    // 在 Group 上清除阴影，避免 Konva 对 Group 设阴影导致子节点裁剪异常
    shadowColor: undefined,
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    shadowOpacity: 1,
  };

  return (
    <Group {...groupProps}>
      {/* 背景（含内边距区域）— 阴影投射层 */}
      <Rect
        width={width}
        height={height}
        fill={bgColor}
        listening={true}
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
        {...shadowProps}
      />

      {/* 每个拼图块：Group 用 clipFunc 裁剪形状，内部 Image 填充图片 */}
      {layoutDef.pieces.map((piece, idx) => {
        const px = padding + piece.x * innerW;
        const py = padding + piece.y * innerH;
        const pw = piece.w * innerW - gap;
        const ph = piece.h * innerH - gap;
        if (pw <= 0 || ph <= 0) return null;

        const src = images[idx];
        const img = src ? loadedMap[src] : undefined;

        return (
          <Group
            key={idx}
            x={px}
            y={py}
            width={pw}
            height={ph}
            clipFunc={(ctx) => drawShapeInClip(ctx as unknown as CanvasRenderingContext2D, piece, pw, ph)}
            listening={false}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          >
            {img ? (
              <Image
                image={img}
                width={pw}
                height={ph}
                objectFit="cover"
                listening={false}
                perfectDrawEnabled={false}
                shadowForStrokeEnabled={false}
              />
            ) : (
              <Rect
                width={pw}
                height={ph}
                fill={placeholderColor}
                listening={false}
                perfectDrawEnabled={false}
                shadowForStrokeEnabled={false}
              />
            )}
          </Group>
        );
      })}
    </Group>
  );
}
