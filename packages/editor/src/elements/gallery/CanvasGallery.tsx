import { useEffect, useRef, useState } from 'react';
import { Group, Rect, Image, Text, Circle, Line } from 'react-konva';
import Konva from 'konva';
import type { GalleryElement } from '@h5design/core';

interface CanvasGalleryProps {
  el: GalleryElement;
  common: Record<string, unknown>;
  update?: (patch: Partial<GalleryElement>) => void;
}

/**
 * 计算 cover 裁剪区域（源图像素坐标）。
 * 与 DOM 端 objectFit:'cover' 完全一致：等比缩放铺满目标框，超出部分居中裁掉。
 */
function coverCrop(
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): { x: number; y: number; width: number; height: number } | undefined {
  if (!sw || !sh || !dw || !dh) return undefined;
  const scale = Math.max(dw / sw, dh / sh);
  const w = dw / scale;
  const h = dh / scale;
  return { x: (sw - w) / 2, y: (sh - h) / 2, width: w, height: h };
}

/** 预加载图片，返回 HTMLImageElement | null */
function useLoadedImage(src: string) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) return;
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.src = src;
    image.onload = () => setImg(image);
    image.onerror = () => setImg(null);
    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [src]);
  return img;
}

export default function CanvasGallery({ el, common, update }: CanvasGalleryProps) {
  const { width, height, images, currentIndex, switchMode, switchInterval, autoplay } = el;
  const currentSrc = images[currentIndex] ?? '';
  const currentImage = useLoadedImage(currentSrc);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 悬停状态：仅当鼠标停靠在组件上方时显示控制按钮
  const [hovered, setHovered] = useState(false);

  // Konva 不会在 Group 上渲染阴影，必须将阴影属性设在可见子形状上
  const hasShadow = !!(el.shadowColor && el.shadowColor !== 'transparent');
  const shadowProps = hasShadow
    ? {
        shadowColor: el.shadowColor,
        shadowBlur: el.shadowBlur || 0,
        shadowOffsetX: el.shadowOffsetX || 0,
        shadowOffsetY: el.shadowOffsetY || 0,
        shadowOpacity: typeof el.shadowOpacity === 'number' ? el.shadowOpacity : 1,
      }
    : {};

  // 自动轮播（仅在编辑态 autoplay 为 true 且 switchMode 为 auto 时）
  useEffect(() => {
    if (!autoplay || switchMode !== 'auto' || !update) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    timerRef.current = setInterval(() => {
      const next = (currentIndex + 1) % Math.max(images.length, 1);
      update({ currentIndex: next });
    }, Math.max(switchInterval * 1000, 3000));
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [autoplay, switchMode, switchInterval, currentIndex, images.length, update]);

  const btnSize = Math.min(width, height) * 0.13;
  const btnY = height / 2;
  const btnColor = 'rgba(0,0,0,0.55)';
  const arrowColor = '#ffffff';
  // 图标以 24x24 视图为基准，按按钮尺寸缩放
  const s = btnSize / 24;
  const iconStroke = Math.max(btnSize * 0.08, 2);

  const handlePrev = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    if (!update || images.length <= 1) return;
    const prev = (currentIndex - 1 + images.length) % images.length;
    update({ currentIndex: prev });
  };

  const handleNext = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    if (!update || images.length <= 1) return;
    const next = (currentIndex + 1) % images.length;
    update({ currentIndex: next });
  };

  const handleTogglePlay = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    update?.({ autoplay: !autoplay });
  };

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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 背景：作为命中目标 + 阴影投射层 */}
      <Rect
        width={width}
        height={height}
        fill="#e5e7eb"
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
        {...shadowProps}
      />

      {/* 当前图片（无叠加效果，按 cover 等比裁剪铺满边界框） */}
      {currentImage && (
        <Image
          image={currentImage}
          x={0}
          y={0}
          width={width}
          height={height}
          crop={coverCrop(currentImage.width, currentImage.height, width, height)}
          listening={false}
          perfectDrawEnabled={false}
          shadowForStrokeEnabled={false}
        />
      )}

      {/* 控制按钮：仅鼠标停靠时显示 */}
      {hovered && (
        <>
          {/* 左侧切换按钮：circle-chevron-left */}
          <Group x={btnSize} y={btnY} opacity={0.6} onClick={handlePrev} onTap={handlePrev}>
            <Circle radius={btnSize / 2} fill={btnColor} listening={true} perfectDrawEnabled={false} shadowForStrokeEnabled={false} />
            <Circle radius={10 * s} stroke={arrowColor} strokeWidth={iconStroke} listening={false} perfectDrawEnabled={false} shadowForStrokeEnabled={false} />
            <Line
              points={[2 * s, 4 * s, -2 * s, 0, 2 * s, -4 * s]}
              stroke={arrowColor}
              strokeWidth={iconStroke}
              lineCap="round"
              lineJoin="round"
              listening={false}
              perfectDrawEnabled={false}
              shadowForStrokeEnabled={false}
            />
          </Group>

          {/* 右侧切换按钮：circle-chevron-right */}
          <Group x={width - btnSize} y={btnY} opacity={0.6} onClick={handleNext} onTap={handleNext}>
            <Circle radius={btnSize / 2} fill={btnColor} listening={true} perfectDrawEnabled={false} shadowForStrokeEnabled={false} />
            <Circle radius={10 * s} stroke={arrowColor} strokeWidth={iconStroke} listening={false} perfectDrawEnabled={false} shadowForStrokeEnabled={false} />
            <Line
              points={[-2 * s, -4 * s, 2 * s, 0, -2 * s, 4 * s]}
              stroke={arrowColor}
              strokeWidth={iconStroke}
              lineCap="round"
              lineJoin="round"
              listening={false}
              perfectDrawEnabled={false}
              shadowForStrokeEnabled={false}
            />
          </Group>
        </>
      )}

      {/* 中间暂停/播放按钮：仅鼠标停靠时显示 */}
      {hovered && (
        <Group x={width / 2} y={btnY} opacity={0.6} onClick={handleTogglePlay} onTap={handleTogglePlay}>
          <Circle radius={btnSize / 2} fill={btnColor} listening={true} perfectDrawEnabled={false} shadowForStrokeEnabled={false} />
          <Circle radius={10 * s} stroke={arrowColor} strokeWidth={iconStroke} listening={false} perfectDrawEnabled={false} shadowForStrokeEnabled={false} />
          {autoplay ? (
            <>
              {/* circle-pause：两条竖线 */}
              <Line points={[-2 * s, 3 * s, -2 * s, -3 * s]} stroke={arrowColor} strokeWidth={iconStroke} lineCap="round" listening={false} perfectDrawEnabled={false} shadowForStrokeEnabled={false} />
              <Line points={[2 * s, 3 * s, 2 * s, -3 * s]} stroke={arrowColor} strokeWidth={iconStroke} lineCap="round" listening={false} perfectDrawEnabled={false} shadowForStrokeEnabled={false} />
            </>
          ) : (
            /* circle-play：播放三角 */
            <Line
              points={[-3 * s, -3 * s, 3 * s, 0, -3 * s, 3 * s, -3 * s, -3 * s]}
              closed
              fill={arrowColor}
              listening={false}
              perfectDrawEnabled={false}
              shadowForStrokeEnabled={false}
            />
          )}
        </Group>
      )}

      {/* 指示器（始终显示，便于了解当前帧位置） */}
      {images.length > 1 && (
        <Group x={width / 2} y={height - btnSize * 0.6}>
          {images.map((_, idx) => {
            const r = btnSize * 0.08;
            const gap = btnSize * 0.28;
            const totalW = images.length * gap - (gap - r * 2);
            return (
              <Circle
                key={idx}
                x={idx * gap - totalW / 2 + r}
                y={0}
                radius={r}
                fill={idx === currentIndex ? '#ffffff' : 'rgba(255,255,255,0.5)'}
                listening={false}
                perfectDrawEnabled={false}
                shadowForStrokeEnabled={false}
              />
            );
          })}
        </Group>
      )}

      {/* 空状态提示 */}
      {images.length === 0 && (
        <Text
          x={0}
          y={height / 2 - 10}
          width={width}
          text="图集"
          fontSize={18}
          fill="#9ca3af"
          align="center"
          listening={false}
          perfectDrawEnabled={false}
          shadowForStrokeEnabled={false}
        />
      )}
    </Group>
  );
}
