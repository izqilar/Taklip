import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { GalleryElement, GalleryTransition } from '@h5design/core';
import { resolveTransition, getTransitionTotalMs, default as GalleryTransitionLayer } from './galleryTransitionLayer';

interface DOMGalleryProps {
  el: GalleryElement;
  style: CSSProperties;
  dataAttrs?: Record<string, string>;
}

export default function DOMGallery({ el, style, dataAttrs }: DOMGalleryProps) {
  const {
    width,
    height,
    images,
    currentIndex: propIndex,
    switchMode,
    switchInterval,
    transition: rawTransition,
    autoplay,
  } = el;

  const [currentIndex, setCurrentIndex] = useState(propIndex);
  const [transition, setTransition] = useState<GalleryTransition | null>(null);
  const [targetIndex, setTargetIndex] = useState(propIndex);
  const [hovered, setHovered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animatingRef = useRef(false);

  useEffect(() => {
    setCurrentIndex(propIndex);
    setTargetIndex(propIndex);
  }, [propIndex]);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!autoplay || switchMode !== 'auto' || images.length <= 1) return;
    timerRef.current = setInterval(() => {
      if (animatingRef.current) return; // 动画进行中，跳过本次轮播
      // ⚠️ 不可在 setState 的 updater 函数里再调 setState（不纯，StrictMode 下会被
      // 重复调用导致 transition 被重复设置）。先置过渡、再纯函数推进索引。
      setTransition(resolveTransition(rawTransition));
      setTargetIndex((prev) => (prev + 1) % images.length);
    }, Math.max(switchInterval * 1000, 3000));
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [autoplay, switchMode, switchInterval, images.length, rawTransition]);

  /** 兜底 timeout：比 CSS 动画多给 200ms 余量，确保 CSS 先完成 */
  useEffect(() => {
    if (targetIndex === currentIndex) return;
    animatingRef.current = true;
    const totalMs = getTransitionTotalMs(transition ?? 'fade');
    const id = setTimeout(() => {
      setCurrentIndex(targetIndex);
      setTransition(null);
      animatingRef.current = false;
    }, totalMs);
    return () => {
      clearTimeout(id);
      animatingRef.current = false;
    };
  }, [targetIndex, currentIndex, transition]);

  const currentSrc = images[currentIndex];
  const nextSrc = images[targetIndex];

  const containerStyle: CSSProperties = {
    ...style,
    position: 'absolute',
    overflow: 'hidden',
    background: '#e5e7eb',
  };

  const goPrev = () => {
    if (images.length <= 1 || transition) return;
    setTransition(resolveTransition(rawTransition));
    setTargetIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const goNext = () => {
    if (images.length <= 1 || transition) return;
    setTransition(resolveTransition(rawTransition));
    setTargetIndex((prev) => (prev + 1) % images.length);
  };

  const btnSize = Math.min(width, height) * 0.13;
  const btnStyle: CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: btnSize,
    height: btnSize,
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.55)',
    color: '#fff',
    opacity: 0.6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    cursor: 'pointer',
    zIndex: 10,
    fontSize: btnSize * 0.5,
    fontWeight: 700,
    lineHeight: 1,
  };

  return (
    <div
      {...dataAttrs}
      style={containerStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 当前底图（无叠加效果） */}
      {currentSrc && <img src={currentSrc} alt="" style={{ position: 'absolute', inset: 0, width, height, objectFit: 'cover' }} />}

      {/* 切换动画层（复用共享过渡组件，与编辑态预览一致） */}
      <GalleryTransitionLayer transition={transition} currentSrc={currentSrc} nextSrc={nextSrc} width={width} height={height} />

      {/* 控制按钮：仅鼠标停靠在组件上方时显示 */}
      {hovered && images.length > 1 && (
        <>
          <button type="button" style={{ ...btnStyle, left: btnSize * 0.6 }} onClick={goPrev} aria-label="prev">
            <svg width={btnSize * 0.5} height={btnSize * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="m14 16-4-4 4-4" />
            </svg>
          </button>
          <button type="button" style={{ ...btnStyle, right: btnSize * 0.6 }} onClick={goNext} aria-label="next">
            <svg width={btnSize * 0.5} height={btnSize * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="m10 8 4 4-4 4" />
            </svg>
          </button>
        </>
      )}

      {/* 中间暂停/播放按钮：仅悬停时显示 */}
      {hovered && (
        <button
          type="button"
          onClick={() => {}}
          style={{
            ...btnStyle,
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
          aria-label={autoplay ? 'pause' : 'play'}
        >
          {autoplay ? (
            // circle-pause：白色描边圆环 + 两条竖线
            <svg width={btnSize * 0.5} height={btnSize * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="10" x2="10" y1="15" y2="9" />
              <line x1="14" x2="14" y1="15" y2="9" />
            </svg>
          ) : (
            // circle-play：白色描边圆环 + 填充播放三角
            <svg width={btnSize * 0.5} height={btnSize * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9 9.003a1 1 0 0 1 1.517-.859l4.997 2.997a1 1 0 0 1 0 1.718l-4.997 2.997A1 1 0 0 1 9 14.996z" fill="currentColor" stroke="none" />
            </svg>
          )}
        </button>
      )}

      {/* 指示器 */}
      {images.length > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: btnSize * 0.5,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 6,
            zIndex: 10,
          }}
        >
          {images.map((_, idx) => (
            <span
              key={idx}
              style={{
                width: btnSize * 0.16,
                height: btnSize * 0.16,
                borderRadius: '50%',
                background: idx === currentIndex ? '#fff' : 'rgba(255,255,255,0.5)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
