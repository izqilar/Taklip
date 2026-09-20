/**
 * 图片裁剪对话框：左侧预览 + 右侧形状/比例，支持拖拽裁剪框与锚点调整宽高。
 * - 形状：原图 / 圆形 / 椭圆 / 三角形 / 六边形 / 星形 / 心形（作为可视蒙版 clip）
 * - 比例：原图比例 / 1:1 / 3:4 / 4:3 / 9:16 / 16:9 / 自定义
 * 裁剪区域以归一化坐标存储于 ImageClip.crop，编辑/发布态共用同一套 clip 路径生成逻辑。
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { ImageElement, ImageClipShape, ImageClip } from '@h5design/core';
import { buildClipSvgPath } from '@h5design/core';

const SHAPES: ImageClipShape[] = ['none', 'circle', 'ellipse', 'triangle', 'hexagon', 'star', 'heart'];

const CONTAINER_SIZE = 360;

interface RatioDef {
  key: string;
  label: string;
  /** 视觉宽高比（预览框最终显示的 width/height），null 表示自由/原图 */
  value: number | null;
  hint?: string;
}

type HandleDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

type DragMode = { type: 'move' } | { type: 'resize'; handle: HandleDir };

interface Props {
  open: boolean;
  el: ImageElement;
  onApply: (clip: ImageClip, size?: { width: number; height: number }) => void;
  onClose: () => void;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeCrop(crop: { x: number; y: number; width: number; height: number }) {
  // 先独立约束宽高（与位置解耦），再约束位置让整体留在 [0,1] 内。
  // 否则在靠近右/下边界移动时 width 会被 1-x 钳小，破坏裁剪尺寸。
  const width = clamp(crop.width, 0.01, 1);
  const height = clamp(crop.height, 0.01, 1);
  const x = clamp(crop.x, 0, 1 - width);
  const y = clamp(crop.y, 0, 1 - height);
  return { x, y, width, height };
}

function getImageAspect(el: ImageElement) {
  const nw = el.naturalWidth || el.width || 1;
  const nh = el.naturalHeight || el.height || 1;
  return nw / nh;
}

/** 按目标“裁剪坐标系宽高比”在图片归一化范围 [0,1]² 内最大化居中裁剪框。
 * 注意：crop 存储的是源图归一化坐标，因此视觉比例 = ratio × 图片原始宽高比。
 */
function fitCropToRatio(ratio: number) {
  let w: number;
  let h: number;
  if (ratio >= 1) {
    w = 1;
    h = w / ratio;
    if (h > 1) {
      h = 1;
      w = h * ratio;
    }
  } else {
    h = 1;
    w = h * ratio;
    if (w > 1) {
      w = 1;
      h = w / ratio;
    }
  }
  return { x: (1 - w) / 2, y: (1 - h) / 2, width: w, height: h };
}

function ShapeIcon({ shape }: { shape: ImageClipShape }) {
  if (shape === 'none') {
    return (
      <svg viewBox="0 0 100 100" className="h-6 w-6">
        <rect x="12" y="12" width="76" height="76" rx="8" fill="none" stroke="currentColor" strokeWidth="6" />
      </svg>
    );
  }
  const d = buildClipSvgPath(shape, 100, 100);
  return (
    <svg viewBox="0 0 100 100" className="h-6 w-6">
      <path d={d} fill="currentColor" />
    </svg>
  );
}

export default function ImageCropDialog({ open, el, onApply, onClose }: Props) {
  const { t } = useTranslation(['editor']);

  const [shape, setShape] = useState<ImageClipShape>(el.clip?.shape ?? 'none');
  const [ratioKey, setRatioKey] = useState<string>('custom');
  const [crop, setCrop] = useState<{ x: number; y: number; width: number; height: number }>(
    el.clip?.crop ? { ...el.clip.crop } : { x: 0, y: 0, width: 1, height: 1 },
  );
  const [dragging, setDragging] = useState<DragMode | null>(null);

  const didResetRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    crop: { x: number; y: number; width: number; height: number };
    dispW: number;
    dispH: number;
  } | null>(null);

  // 每次打开弹窗时重置为当前元素状态
  useEffect(() => {
    if (open && !didResetRef.current) {
      setShape(el.clip?.shape ?? 'none');
      setCrop(el.clip?.crop ? { ...el.clip.crop } : { x: 0, y: 0, width: 1, height: 1 });
      setRatioKey('custom');
      didResetRef.current = true;
    }
    if (!open) didResetRef.current = false;
  }, [open, el.clip]);

  const ratios: RatioDef[] = [
    {
      key: 'original',
      label: t('editor:property.cropRatioOriginal'),
      value: null,
      hint: t('editor:property.cropRatioOriginalHint', { defaultValue: '' }) || undefined,
    },
    { key: '1:1', label: '1:1', value: 1 },
    { key: '3:4', label: '3:4', value: 3 / 4 },
    { key: '4:3', label: '4:3', value: 4 / 3 },
    { key: 'standard', label: '9:16', value: 9 / 16 },
    { key: 'fullscreen', label: '16:9', value: 16 / 9 },
    { key: 'custom', label: t('editor:property.cropFree'), value: null },
  ];

  const aspect = getImageAspect(el);
  let dispW = CONTAINER_SIZE;
  let dispH = CONTAINER_SIZE / aspect;
  if (dispH > CONTAINER_SIZE) {
    dispH = CONTAINER_SIZE;
    dispW = CONTAINER_SIZE * aspect;
  }
  dispW = Math.round(dispW);
  dispH = Math.round(dispH);
  const dispX = (CONTAINER_SIZE - dispW) / 2;
  const dispY = (CONTAINER_SIZE - dispH) / 2;

  const boxX = dispX + crop.x * dispW;
  const boxY = dispY + crop.y * dispH;
  const boxW = crop.width * dispW;
  const boxH = crop.height * dispH;

  const clipPath = shape !== 'none' ? `path("${buildClipSvgPath(shape, boxW, boxH)}")` : undefined;

  const imageAspect = getImageAspect(el);

  const handleRatioChange = (key: string) => {
    setRatioKey(key);
    if (key === 'original') {
      // 原比例 = 整张图，视觉比例等于图片原始宽高比；裁剪坐标系里就是 1:1
      setCrop(normalizeCrop(fitCropToRatio(1)));
    } else {
      const def = ratios.find((r) => r.key === key);
      if (def && def.value != null) {
        // 视觉比例 R 需要转换为裁剪坐标系比例 R / imageAspect
        setCrop(normalizeCrop(fitCropToRatio(def.value / imageAspect)));
      }
    }
  };

  /** 返回裁剪坐标系下应保持的宽高比（视觉比例 / imageAspect），用于拖拽锚点时锁定比例 */
  const targetRatio = useCallback(() => {
    if (ratioKey === 'original') return 1;
    const def = ratios.find((r) => r.key === ratioKey);
    return def?.value != null ? def.value / imageAspect : null;
  }, [ratioKey, imageAspect, ratios]);

  const handlePointerDown = (e: React.PointerEvent, mode: DragMode) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(mode);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      crop: { ...crop },
      dispW,
      dispH,
    };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragging || !dragStartRef.current) return;
      const { clientX, clientY, crop: startCrop, dispW, dispH } = dragStartRef.current;
      const dx = e.clientX - clientX;
      const dy = e.clientY - clientY;
      const dnx = dx / dispW;
      const dny = dy / dispH;

      let next = { ...startCrop };

      if (dragging.type === 'move') {
        next.x = startCrop.x + dnx;
        next.y = startCrop.y + dny;
      } else {
        const h = dragging.handle;
        const ratio = targetRatio();

        if (h.includes('e')) next.width = startCrop.width + dnx;
        if (h.includes('w')) {
          next.width = startCrop.width - dnx;
          next.x = startCrop.x + dnx;
        }
        if (h.includes('s')) next.height = startCrop.height + dny;
        if (h.includes('n')) {
          next.height = startCrop.height - dny;
          next.y = startCrop.y + dny;
        }

        if (ratio && ratioKey !== 'custom') {
          // 保持比例：以变化更大的边为准
          const absDx = Math.abs(dnx);
          const absDy = Math.abs(dny);
          if (['e', 'w'].includes(h) && !['n', 's'].includes(h)) {
            next.height = next.width / ratio;
          } else if (['n', 's'].includes(h) && !['e', 'w'].includes(h)) {
            next.width = next.height * ratio;
          } else {
            if (absDx > absDy) {
              next.height = next.width / ratio;
            } else {
              next.width = next.height * ratio;
            }
          }
        }
      }

      setCrop(normalizeCrop(next));
    },
    [dragging, dispW, dispH, ratioKey, targetRatio],
  );

  const handlePointerUp = useCallback(() => {
    setDragging(null);
    dragStartRef.current = null;
  }, []);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragging, handlePointerMove, handlePointerUp]);

  const handleApply = () => {
    const normalized = normalizeCrop(crop);
    const clip: ImageClip = { shape, crop: normalized };

    let size: { width: number; height: number } | undefined;
    if (el.width && el.height) {
      const area = el.width * el.height;
      // crop 是源图归一化坐标，其视觉宽高比 = (width/height) × 图片原始宽高比
      const visualRatio = (normalized.width / normalized.height) * imageAspect;
      let nw = Math.sqrt(area * visualRatio);
      let nh = nw / visualRatio;
      const maxW = 320;
      const maxH = 480;
      const s = Math.min(nw > maxW ? maxW / nw : 1, nh > maxH ? maxH / nh : 1);
      size = { width: Math.round(nw * s), height: Math.round(nh * s) };
    }

    onApply(clip, size);
  };

  const shapeLabel: Record<ImageClipShape, string> = {
    none: t('editor:property.shapeNone'),
    circle: t('editor:property.shapeCircle'),
    ellipse: t('editor:property.shapeEllipse'),
    triangle: t('editor:property.shapeTriangle'),
    hexagon: t('editor:property.shapeHexagon'),
    star: t('editor:property.shapeStar'),
    heart: t('editor:property.shapeHeart'),
  };

  const anchorBase =
    'absolute z-10 h-3 w-3 rounded-sm border border-white bg-blue-500 shadow-sm';

  const anchors: { dir: HandleDir; className: string }[] = [
    { dir: 'nw', className: '-left-1.5 -top-1.5 cursor-nw-resize' },
    { dir: 'n', className: 'left-1/2 -top-1.5 -translate-x-1/2 cursor-n-resize' },
    { dir: 'ne', className: '-right-1.5 -top-1.5 cursor-ne-resize' },
    { dir: 'e', className: 'right-[-6px] top-1/2 -translate-y-1/2 cursor-e-resize' },
    { dir: 'se', className: '-right-1.5 -bottom-1.5 cursor-se-resize' },
    { dir: 's', className: 'bottom-[-6px] left-1/2 -translate-x-1/2 cursor-s-resize' },
    { dir: 'sw', className: '-left-1.5 -bottom-1.5 cursor-sw-resize' },
    { dir: 'w', className: '-left-1.5 top-1/2 -translate-y-1/2 cursor-w-resize' },
  ];

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-3xl flex-col rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <span className="text-base font-semibold text-gray-800">{t('editor:property.crop')}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label={t('editor:property.cropCancel')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex gap-6 p-5">
          {/* 左侧预览 */}
          <div className="flex flex-col items-center gap-2">
            <div
              ref={containerRef}
              className="relative overflow-hidden rounded border border-gray-200"
              style={{
                width: CONTAINER_SIZE,
                height: CONTAINER_SIZE,
                backgroundColor: '#e5e7eb',
                backgroundImage:
                  'linear-gradient(45deg,#d1d5db 25%,transparent 25%,transparent 75%,#d1d5db 75%,#d1d5db),linear-gradient(45deg,#d1d5db 25%,transparent 25%,transparent 75%,#d1d5db 75%,#d1d5db)',
                backgroundSize: '16px 16px',
                backgroundPosition: '0 0, 8px 8px',
              }}
            >
              {/* 裁剪结果实时预览 */}
              {el.src ? (
                <div
                  className="absolute overflow-hidden"
                  style={{
                    left: boxX,
                    top: boxY,
                    width: boxW,
                    height: boxH,
                    clipPath,
                  }}
                >
                  <img
                    src={el.src}
                    alt=""
                    className="absolute max-w-none"
                    style={{
                      left: -crop.x * dispW,
                      top: -crop.y * dispH,
                      width: dispW,
                      height: dispH,
                      pointerEvents: 'none',
                    }}
                    draggable={false}
                  />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-gray-400">
                  {t('editor:element.image')}
                </div>
              )}

              {/* 裁剪框与拖拽层 */}
              {el.src && (
                <div
                  className="absolute border-2 border-blue-500"
                  style={{
                    left: boxX,
                    top: boxY,
                    width: boxW,
                    height: boxH,
                    cursor: dragging?.type === 'move' ? 'grabbing' : 'grab',
                  }}
                >
                  {/* 移动热区 */}
                  <div
                    className="absolute inset-0 z-0"
                    onPointerDown={(e) => handlePointerDown(e, { type: 'move' })}
                  />
                  {/* 锚点 */}
                  {anchors.map((a) => (
                    <div
                      key={a.dir}
                      className={`${anchorBase} ${a.className}`}
                      onPointerDown={(e) => handlePointerDown(e, { type: 'resize', handle: a.dir })}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="text-xs text-gray-400">{t('editor:property.cropPreview')}</div>
          </div>

          {/* 右侧控制 */}
          <div className="flex flex-1 flex-col gap-5">
            {/* 形状 */}
            <div>
              <div className="mb-2 text-sm font-medium text-gray-700">{t('editor:property.cropShape')}</div>
              <div className="grid grid-cols-4 gap-2">
                {SHAPES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setShape(s)}
                    className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-xs transition ${
                      shape === s
                        ? 'border-blue-500 bg-blue-50 text-blue-600'
                        : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-500'
                    }`}
                    title={shapeLabel[s]}
                  >
                    <ShapeIcon shape={s} />
                    <span className="truncate">{shapeLabel[s]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 比例 */}
            <div className="flex-1">
              <div className="mb-2 text-sm font-medium text-gray-700">{t('editor:property.cropRatio')}</div>
              <div className="grid grid-cols-2 gap-2">
                {ratios.map((r) => (
                  <label
                    key={r.key}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                      ratioKey === r.key
                        ? 'border-blue-500 bg-blue-50 text-blue-600'
                        : 'border-gray-200 text-gray-700 hover:border-blue-300'
                    }`}
                    title={r.hint}
                  >
                    <input
                      type="radio"
                      name="crop-ratio"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                      checked={ratioKey === r.key}
                      onChange={() => handleRatioChange(r.key)}
                    />
                    <span className="flex-1">{r.label}</span>
                    {r.hint && <span className="text-xs text-gray-400">?</span>}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 px-5 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50"
          >
            {t('editor:property.cropCancel')}
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="rounded bg-blue-500 px-5 py-1.5 text-sm text-white transition hover:bg-blue-600"
          >
            {t('editor:property.cropApply')}
          </button>
        </div>
      </div>
    </div>
  );
}
