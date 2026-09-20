import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { GalleryElement, GalleryTransition } from '@h5design/core';

// 切片动画的两条原则（确保图片「完全适配」边界框、且不变形）：
// 1) 外层 strip 只负责裁出画廊的一小片区域（overflow:hidden）。
// 2) 内层 inner 是一张完整覆盖画廊的 background（background-size:cover），
//    通过负偏移把整图对齐到画廊原点，再由 strip 裁出当前片。
// 这样每个切片都按与底图 objectFit:'cover' 完全一致的方式铺满边界框，
// 既不会错位破碎，也不会像之前 backgroundSize: WxH 那样被拉伸变形。
function sliceStripStyle(
  leftPct: number,
  topPct: number,
  wPct: number,
  hPct: number,
): CSSProperties {
  return {
    position: 'absolute',
    left: `${leftPct}%`,
    top: `${topPct}%`,
    width: `${wPct}%`,
    height: `${hPct}%`,
    overflow: 'hidden',
  };
}

function sliceInnerStyle(
  nextSrc: string,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
): CSSProperties {
  return {
    position: 'absolute',
    left: -offsetX,
    top: -offsetY,
    width,
    height,
    backgroundImage: `url("${nextSrc}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };
}

const PRESETS: GalleryTransition[] = [
  'random',
  'blinds',
  'blinds3d',
  'randomBlocks',
  'blocks',
  'flipBook',
  'camera',
  'concentric',
  'cube',
  'explode',
  'fade',
  'fall',
  'transition',
  'circle',
  'slide',
  'swipe',
  'twist',
  'waterfall',
  'wave',
  'zipper',
];

export function resolveTransition(t: GalleryTransition): GalleryTransition {
  if (t !== 'random') return t;
  const keys = PRESETS.filter((k) => k !== 'random');
  return keys[Math.floor(Math.random() * keys.length)];
}

/**
 * 每种切换动画的单片 CSS 动画时长（base）、分片之间的交错延迟（delay）、分片数量（count）。
 * getTransitionTotalMs 用于计算完整的动画总时长，确保 JS 收尾 timeout 不会在 CSS 动画结束前提前清理。
 */
const TRANSITION_TIMING: Record<string, { base: number; delay: number; count: number }> = {
  blinds: { base: 1400, delay: 50, count: 10 },
  blinds3d: { base: 1400, delay: 50, count: 10 },
  blocks: { base: 1300, delay: 30, count: 24 },
  randomBlocks: { base: 1300, delay: 30, count: 24 },
  cube: { base: 1300, delay: 0, count: 1 },
  flipBook: { base: 1300, delay: 0, count: 1 },
  slide: { base: 1100, delay: 0, count: 1 },
  swipe: { base: 1100, delay: 0, count: 1 },
  fall: { base: 1200, delay: 0, count: 1 },
  explode: { base: 1200, delay: 0, count: 1 },
  circle: { base: 1300, delay: 0, count: 1 },
  camera: { base: 1200, delay: 0, count: 1 },
  concentric: { base: 1300, delay: 90, count: 4 },
  transition: { base: 1200, delay: 0, count: 1 },
  twist: { base: 1200, delay: 0, count: 1 },
  waterfall: { base: 1400, delay: 60, count: 8 },
  wave: { base: 1400, delay: 60, count: 10 },
  zipper: { base: 1200, delay: 0, count: 1 },
  fade: { base: 1100, delay: 0, count: 1 },
};

/**
 * 某切换动画从开始到完整结束的预估总时长。
 * 公式：单片动画时长 + 最后一片的延迟 + 安全余量。
 * 安全余量 400ms 确保浏览器有足够时间渲染最后一帧，避免 JS 在 CSS 动画完成前提前清理。
 */
export function getTransitionTotalMs(t: GalleryTransition): number {
  const tm = TRANSITION_TIMING[t] ?? { base: 1100, delay: 0, count: 1 };
  return tm.base + (tm.count - 1) * tm.delay + 400;
}

interface GalleryTransitionLayerProps {
  transition: GalleryTransition | null;
  currentSrc: string;
  nextSrc: string;
  width: number;
  height: number;
}

/**
 * 图集切换动画的可复用渲染层。
 * - 发布态（DOMGallery）与编辑态预览（GalleryEditorOverlay）共用，保证所见即所得。
 * - transition 为 null 时不触发切换，返回 null。
 *
 * 关键修复点：
 * 1. 所有 animation 使用 fill-mode: both（不只是 forwards），确保 animation-delay 期间
 *    元素保持 keyframes 的 from 状态，避免 delay 期间露出最终状态造成闪烁。
 * 2. 多分片动画的容器/分片元素自带初始 CSS 状态（opacity:0 等），防止 delay 期间可见。
 * 3. 增大单片动画时长与安全余量，确保最后一片有充足时间完成。
 */
export default function GalleryTransitionLayer({
  transition,
  currentSrc,
  nextSrc,
  width,
  height,
}: GalleryTransitionLayerProps) {
  const layer = useMemo(() => {
    if (!transition) return null;
    const common: CSSProperties = {
      position: 'absolute',
      inset: 0,
      width,
      height,
    };
    const baseImg: CSSProperties = {
      position: 'absolute',
      inset: 0,
      width,
      height,
      objectFit: 'cover',
    };

    switch (transition) {
      case 'blinds': {
        // 竖向百叶：把下一图切成 count 条竖向切片，每条从中心向两侧（scaleX）展开。
        // 每条自带内联初始 transform: scaleX(0)，不依赖 animation-fill-mode 的 backwards 填充。
        const tm = TRANSITION_TIMING.blinds;
        const count = tm.count;
        const dur = `${tm.base / 1000}s`;
        const delayStep = tm.delay / 1000;
        return (
          <div style={common}>
            {Array.from({ length: count }).map((_, i) => (
              <div
                key={i}
                style={{
                  ...sliceStripStyle((i / count) * 100, 0, 100 / count, 100),
                  transform: 'scaleX(0)',
                  transformOrigin: 'center',
                  animation: `gallery-blinds ${dur} ease both`,
                  animationDelay: `${i * delayStep}s`,
                }}
              >
                <div style={sliceInnerStyle(nextSrc, width, height, (i * width) / count, 0)} />
              </div>
            ))}
          </div>
        );
      }
      case 'blinds3d': {
        // 竖向百叶 3D 版：每条绕顶部横轴从 -90° 翻转到 0°，形成立体翻页感。
        // 内联初始 transform: rotateX(-90deg) 保证 delay 期间侧立不可见。
        const tm = TRANSITION_TIMING.blinds3d;
        const count = tm.count;
        const dur = `${tm.base / 1000}s`;
        const delayStep = tm.delay / 1000;
        return (
          <div style={{ ...common, perspective: Math.max(width * 2, 600) }}>
            {Array.from({ length: count }).map((_, i) => (
              <div
                key={i}
                style={{
                  ...sliceStripStyle((i / count) * 100, 0, 100 / count, 100),
                  transformOrigin: 'center top',
                  transform: 'rotateX(-90deg)',
                  backfaceVisibility: 'hidden',
                  animation: `gallery-blinds3d ${dur} ease both`,
                  animationDelay: `${i * delayStep}s`,
                }}
              >
                <div style={sliceInnerStyle(nextSrc, width, height, (i * width) / count, 0)} />
              </div>
            ))}
          </div>
        );
      }
      case 'blocks':
      case 'randomBlocks': {
        // 网格方块：把下一图切成 cols×rows 格子，逐格缩放淡入。
        // 每个格子自带内联 opacity:0 + scale(0.4)，不依赖 fill-mode backwards。
        const tm = TRANSITION_TIMING[transition] ?? TRANSITION_TIMING.blocks;
        const cols = 6;
        const rows = 4;
        const dur = `${tm.base / 1000}s`;
        const delayStep = tm.delay / 1000;
        const cells = Array.from({ length: cols * rows }).map((_, i) => i);
        if (transition === 'randomBlocks') cells.sort(() => Math.random() - 0.5);
        return (
          <div style={common}>
            {cells.map((i, order) => {
              const col = i % cols;
              const row = Math.floor(i / cols);
              return (
                <div
                  key={i}
                  style={{
                    ...sliceStripStyle((col / cols) * 100, (row / rows) * 100, 100 / cols, 100 / rows),
                    opacity: 0,
                    transform: 'scale(0.4)',
                    animation: `gallery-block ${dur} ease both`,
                    animationDelay: `${order * delayStep}s`,
                  }}
                >
                  <div
                    style={sliceInnerStyle(nextSrc, width, height, (col * width) / cols, (row * height) / rows)}
                  />
                </div>
              );
            })}
          </div>
        );
      }
      case 'cube': {
        return (
          <div style={{ ...common, perspective: width * 1.5 }}>
            <div
              style={{
                width: '100%',
                height: '100%',
                transformStyle: 'preserve-3d',
                transform: 'rotateY(0deg)',
                animation: 'gallery-cube 1.3s ease both',
              }}
            >
              <img src={currentSrc} alt="" style={{ ...baseImg, backfaceVisibility: 'hidden' }} />
              <img src={nextSrc} alt="" style={{ ...baseImg, transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }} />
            </div>
          </div>
        );
      }
      case 'flipBook': {
        return (
          <div style={{ ...common, perspective: width * 2 }}>
            <div
              style={{
                width: '100%',
                height: '100%',
                transformStyle: 'preserve-3d',
                transformOrigin: 'left center',
                transform: 'rotateY(0deg)',
                animation: 'gallery-flip 1.3s ease both',
              }}
            >
              <img src={currentSrc} alt="" style={{ ...baseImg, backfaceVisibility: 'hidden' }} />
              <img src={nextSrc} alt="" style={{ ...baseImg, transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }} />
            </div>
          </div>
        );
      }
      case 'slide':
      case 'swipe': {
        return (
          <img
            src={nextSrc}
            alt=""
            style={{
              ...common,
              objectFit: 'cover',
              transform: 'translateX(100%)',
              animation: `gallery-slide 1.1s ease both`,
            }}
          />
        );
      }
      case 'fall': {
        return (
          <img
            src={nextSrc}
            alt=""
            style={{
              ...common,
              objectFit: 'cover',
              opacity: 0,
              transform: 'translateY(-100%) scale(0.8)',
              animation: 'gallery-fall 1.2s ease both',
            }}
          />
        );
      }
      case 'explode': {
        return (
          <img
            src={nextSrc}
            alt=""
            style={{
              ...common,
              objectFit: 'cover',
              opacity: 0,
              transform: 'scale(1.5)',
              animation: 'gallery-explode 1.2s ease both',
            }}
          />
        );
      }
      case 'circle': {
        return (
          <div
            style={{
              ...common,
              clipPath: 'circle(0% at 50% 50%)',
              animation: 'gallery-circle 1.3s ease both',
            }}
          >
            <img src={nextSrc} alt="" style={{ width, height, objectFit: 'cover' }} />
          </div>
        );
      }
      case 'camera': {
        return (
          <div style={common}>
            <img src={nextSrc} alt="" style={{ ...baseImg, opacity: 0, transform: 'scale(1.12)', animation: 'gallery-camera 1.2s ease both' }} />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: '#ffffff',
                opacity: 0,
                pointerEvents: 'none',
                animation: 'gallery-flash 0.6s ease both',
              }}
            />
          </div>
        );
      }
      case 'concentric': {
        const rings = 4;
        return (
          <div style={common}>
            <img src={nextSrc} alt="" style={{ ...baseImg, opacity: 0, transform: 'scale(1.1)', animation: 'gallery-concentric 1.3s ease both' }} />
            {Array.from({ length: rings }).map((_, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: 0,
                  height: 0,
                  borderRadius: '50%',
                  border: '3px solid rgba(255,255,255,0.85)',
                  transform: 'translate(-50%,-50%) scale(0)',
                  opacity: 0.9,
                  animation: 'gallery-ring 1.3s ease both',
                  animationDelay: `${i * 0.09}s`,
                }}
              />
            ))}
          </div>
        );
      }
      case 'transition': {
        return (
          <div
            style={{
              ...common,
              clipPath: 'inset(0 100% 0 0)',
              animation: 'gallery-wipe 1.2s ease both',
            }}
          >
            <img src={nextSrc} alt="" style={{ ...baseImg }} />
          </div>
        );
      }
      case 'twist': {
        return (
          <img
            src={nextSrc}
            alt=""
            style={{
              ...common,
              objectFit: 'cover',
              opacity: 0,
              transform: 'perspective(800px) rotateY(80deg) skewX(15deg)',
              animation: 'gallery-twist 1.2s ease both',
            }}
          />
        );
      }
      case 'waterfall': {
        // 瀑布：竖向列依次从顶部落下铺满。
        // 内联初始 transform: translateY(-100%) 保证 delay 期间位于画廊上方（被外层 overflow 裁掉）。
        const tm = TRANSITION_TIMING.waterfall;
        const count = tm.count;
        const dur = `${tm.base / 1000}s`;
        const delayStep = tm.delay / 1000;
        return (
          <div style={common}>
            {Array.from({ length: count }).map((_, i) => (
              <div
                key={i}
                style={{
                  ...sliceStripStyle((i / count) * 100, 0, 100 / count, 100),
                  transform: 'translateY(-100%)',
                  animation: `gallery-waterfall ${dur} ease both`,
                  animationDelay: `${i * delayStep}s`,
                }}
              >
                <div style={sliceInnerStyle(nextSrc, width, height, (i * width) / count, 0)} />
              </div>
            ))}
          </div>
        );
      }
      case 'wave': {
        // 波浪：把下一图切成 count 条横向条带，自上而下错峰以水平位移涟漪进入。
        // 内联初始 transform: translateX(-30%) + opacity:0 保证 delay 期间不可见。
        const tm = TRANSITION_TIMING.wave;
        const count = tm.count;
        const dur = `${tm.base / 1000}s`;
        const delayStep = tm.delay / 1000;
        return (
          <div style={common}>
            {Array.from({ length: count }).map((_, i) => (
              <div
                key={i}
                style={{
                  ...sliceStripStyle(0, (i / count) * 100, 100, 100 / count),
                  opacity: 0,
                  transform: 'translateX(-30%)',
                  animation: `gallery-wave ${dur} ease both`,
                  animationDelay: `${i * delayStep}s`,
                }}
              >
                <div style={sliceInnerStyle(nextSrc, width, height, 0, (i * height) / count)} />
              </div>
            ))}
          </div>
        );
      }
      case 'zipper': {
        return (
          <div style={common}>
            <img src={nextSrc} alt="" style={{ ...baseImg }} />
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '50%',
                height: '100%',
                overflow: 'hidden',
                transform: 'translateX(0)',
                animation: 'gallery-zipper-left 1.2s ease both',
              }}
            >
              <img src={currentSrc} alt="" style={{ position: 'absolute', left: 0, top: 0, width, height, objectFit: 'cover' }} />
            </div>
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                width: '50%',
                height: '100%',
                overflow: 'hidden',
                transform: 'translateX(0)',
                animation: 'gallery-zipper-right 1.2s ease both',
              }}
            >
              <img src={currentSrc} alt="" style={{ position: 'absolute', right: 0, top: 0, width, height, objectFit: 'cover' }} />
            </div>
          </div>
        );
      }
      case 'fade':
      default: {
        return (
          <img
            src={nextSrc}
            alt=""
            style={{
              ...common,
              objectFit: 'cover',
              opacity: 0,
              animation: 'gallery-fade 1.1s ease both',
            }}
          />
        );
      }
    }
  }, [transition, currentSrc, nextSrc, width, height]);

  if (!layer) return null;

  return (
    <>
      {layer}
      <style>{`
        @keyframes gallery-blinds {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @keyframes gallery-blinds3d {
          from { transform: rotateX(-90deg); }
          to { transform: rotateX(0deg); }
        }
        @keyframes gallery-block {
          from { opacity: 0; transform: scale(0.4); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes gallery-cube {
          from { transform: rotateY(0deg); }
          to { transform: rotateY(180deg); }
        }
        @keyframes gallery-flip {
          from { transform: rotateY(0deg); }
          to { transform: rotateY(-180deg); }
        }
        @keyframes gallery-slide {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes gallery-fall {
          from { opacity: 0; transform: translateY(-100%) scale(0.8); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes gallery-explode {
          from { opacity: 0; transform: scale(1.5); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes gallery-circle {
          from { clip-path: circle(0% at 50% 50%); }
          to { clip-path: circle(150% at 50% 50%); }
        }
        @keyframes gallery-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes gallery-camera {
          from { opacity: 0; transform: scale(1.12); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes gallery-flash {
          0% { opacity: 0; }
          40% { opacity: 0.7; }
          100% { opacity: 0; }
        }
        @keyframes gallery-concentric {
          from { opacity: 0; transform: scale(1.1); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes gallery-ring {
          from { transform: translate(-50%, -50%) scale(0); opacity: 0.9; }
          to { transform: translate(-50%, -50%) scale(45); opacity: 0; }
        }
        @keyframes gallery-wipe {
          from { clip-path: inset(0 100% 0 0); }
          to { clip-path: inset(0 0 0 0); }
        }
        @keyframes gallery-twist {
          from { opacity: 0; transform: perspective(800px) rotateY(80deg) skewX(15deg); }
          to { opacity: 1; transform: perspective(800px) rotateY(0deg) skewX(0deg); }
        }
        @keyframes gallery-waterfall {
          from { transform: translateY(-100%); }
          to { transform: translateY(0); }
        }
        @keyframes gallery-wave {
          0% { transform: translateX(-30%); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateX(0) rotate(0deg); opacity: 1; }
        }
        @keyframes gallery-zipper-left {
          from { transform: translateX(0); }
          to { transform: translateX(-100%); }
        }
        @keyframes gallery-zipper-right {
          from { transform: translateX(0); }
          to { transform: translateX(100%); }
        }
      `}</style>
    </>
  );
}
