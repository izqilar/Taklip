import { useEffect, useRef, useState } from 'react';
import type { GalleryElement } from '@h5design/core';
import { resolveTransition, getTransitionTotalMs, default as GalleryTransitionLayer } from '../../elements/gallery/galleryTransitionLayer';

/**
 * 编辑态图集切换动画预览覆盖层。
 * - 仅当 el.currentIndex 发生变化时，在图集元素上方叠加一层 DOM 过渡动画，
 *   复用与发布态完全相同的 GalleryTransitionLayer，做到所见即所得。
 * - pointer-events: none，不拦截鼠标，编辑/拖拽/选中仍由底层 Konva 画布处理。
 * - 平时不渲染（返回 null），仅切换动画播放期间出现，避免遮挡 Konva 的悬停按钮。
 */
export default function GalleryEditorOverlay({ el }: { el: GalleryElement }) {
  const { images, currentIndex, transition, width, height, x, y, rotation } = el;
  const prevIndexRef = useRef(currentIndex);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [anim, setAnim] = useState<{
    from: number;
    to: number;
    t: ReturnType<typeof resolveTransition>;
  } | null>(null);

  useEffect(() => {
    if (currentIndex === prevIndexRef.current) return;
    const from = prevIndexRef.current;
    prevIndexRef.current = currentIndex;
    const t = resolveTransition(transition);
    setAnim({ from, to: currentIndex, t });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setAnim(null), getTransitionTotalMs(t));
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentIndex, transition]);

  if (!anim) return null;

  const baseSrc = images[anim.from] ?? images[currentIndex] ?? '';
  const nextSrc = images[anim.to] ?? images[currentIndex] ?? '';

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        transform: `rotate(${rotation || 0}deg)`,
        transformOrigin: 'center',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      {/* 旧图底图（动画过程中保持在底层） */}
      <img
        src={baseSrc}
        alt=""
        style={{ position: 'absolute', inset: 0, width, height, objectFit: 'cover' }}
      />
      {/* 共享切换动画层（新图以所选动画效果进入） */}
      <GalleryTransitionLayer
        transition={anim.t}
        currentSrc={baseSrc}
        nextSrc={nextSrc}
        width={width}
        height={height}
      />
    </div>
  );
}
