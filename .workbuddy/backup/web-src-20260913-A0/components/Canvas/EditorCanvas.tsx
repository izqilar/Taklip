import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Stage,
  Layer,
  Text,
  Rect,
  Circle,
  Line as KonvaLine,
  Star,
  RegularPolygon,
  Ellipse,
  Arrow as KonvaArrow,
  Image as KonvaImage,
  Transformer,
  Group,
} from 'react-konva';
import Konva from 'konva';
import { useEditorStore } from '@/store/editorStore';
import CanvasCalendar from '@/elements/calendar/CanvasCalendar';
import CanvasGallery from '@/elements/gallery/CanvasGallery';
import CanvasPuzzle from '@/elements/puzzle/CanvasPuzzle';
import CanvasCountdown from '@/elements/countdown/CanvasCountdown';
import CanvasMapNav from '@/elements/mapNav/CanvasMapNav';
import CanvasMessageBoard from '@/elements/messageBoard/CanvasMessageBoard';
import CanvasTimeline from '@/elements/timeline/CanvasTimeline';
import CanvasLike from '@/elements/like/CanvasLike';
import CanvasWidget from '@/elements/widget/CanvasWidget';
import GalleryEditorOverlay from '@/components/Canvas/GalleryEditorOverlay';
import type { Element, TextElement, ImageElement, RectElement, CircleElement, PolygonElement, ArrowElement, CornerRadius, ImageClip, CalendarElement, GalleryElement, PuzzleElement, CountdownElement, MapNavElement, MessageBoardElement, TimelineElement, LikeElement, WidgetElement } from '@h5design/core';
import { CANVAS_DEFAULT, toKonvaCornerRadius, normalizeCornerRadius, drawClipOnContext, normalizeImageClip } from '@h5design/core';

const CANVAS_W = CANVAS_DEFAULT.width;
const CANVAS_H = CANVAS_DEFAULT.height;
const SNAP_THRESHOLD = 6;
const RULER = 18;

/* ───────── 标尺 ───────── */

function Ruler({ orientation, length }: { orientation: 'h' | 'v'; length: number }) {
  const isH = orientation === 'h';
  const len = length;
  const ticks: React.ReactNode[] = [];
  for (let p = 0; p <= len; p += 50) {
    const major = p % 100 === 0;
    const x1 = isH ? p : 0;
    const y1 = isH ? (major ? RULER - 11 : RULER - 5) : p;
    const x2 = isH ? p : RULER;
    const y2 = isH ? RULER : p;
    ticks.push(
      <line
        key={`t-${p}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#9ca3af"
        strokeWidth={1}
      />,
    );
    if (major && p > 0) {
      ticks.push(
        <text
          key={`l-${p}`}
          x={isH ? p : RULER - 3}
          y={isH ? RULER - 12 : p + 3}
          fontSize={9}
          fill="#6b7280"
          textAnchor={isH ? 'middle' : 'end'}
        >
          {p}
        </text>,
      );
    }
  }
  return (
    <svg
      width={isH ? CANVAS_W : RULER}
      height={isH ? RULER : length}
      className="block"
    >
      {ticks}
    </svg>
  );
}

/* ───────── 对齐辅助线计算 ───────── */

interface Guide {
  points: number[];
  orientation: 'H' | 'V';
}

interface Edge {
  guide: number;
  offset: number;
  target: number;
}

function getSnappingEdges(el: Element): { vertical: Edge[]; horizontal: Edge[] } {
  const x = el.x;
  const y = el.y;
  const w = el.width;
  const h = el.height;
  return {
    vertical: [
      { guide: x, offset: 0, target: x },           // left
      { guide: x + w / 2, offset: w / 2, target: x + w / 2 }, // center
      { guide: x + w, offset: w, target: x + w },     // right
    ],
    horizontal: [
      { guide: y, offset: 0, target: y },
      { guide: y + h / 2, offset: h / 2, target: y + h / 2 },
      { guide: y + h, offset: h, target: y + h },
    ],
  };
}

function getTargetGuides(
  elements: Element[],
  canvasH: number,
): { vertical: number[]; horizontal: number[] } {
  const vertical: number[] = [0, CANVAS_W / 2, CANVAS_W];
  const horizontal: number[] = [0, canvasH / 2, canvasH];
  for (const el of elements) {
    vertical.push(el.x, el.x + el.width / 2, el.x + el.width);
    horizontal.push(el.y, el.y + el.height / 2, el.y + el.height);
  }
  return { vertical, horizontal };
}

function snapCalc(
  dragEl: Element,
  otherElements: Element[],
  canvasH: number,
): { snappedX: number | null; snappedY: number | null; guides: Guide[] } {
  const edges = getSnappingEdges(dragEl);
  const targets = getTargetGuides(otherElements, canvasH);
  const guides: Guide[] = [];
  let snappedX: number | null = null;
  let snappedY: number | null = null;

  // Vertical snapping (x-axis)
  for (const e of edges.vertical) {
    for (const t of targets.vertical) {
      const diff = Math.abs(e.guide - t);
      if (diff < SNAP_THRESHOLD) {
        snappedX = t - e.offset;
        guides.push({
          points: [t, 0, t, canvasH],
          orientation: 'V',
        });
        break;
      }
    }
    if (snappedX !== null) break;
  }

  // Horizontal snapping (y-axis)
  for (const e of edges.horizontal) {
    for (const t of targets.horizontal) {
      const diff = Math.abs(e.guide - t);
      if (diff < SNAP_THRESHOLD) {
        snappedY = t - e.offset;
        guides.push({
          points: [0, t, CANVAS_W, t],
          orientation: 'H',
        });
        break;
      }
    }
    if (snappedY !== null) break;
  }

  return { snappedX, snappedY, guides };
}

/* ───────── 元素渲染 ───────── */

interface RenderProps {
  el: Element;
  isSelected: boolean;
  onSelect: (e?: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onChange: (patch: Partial<Element>) => void;
  onDragStart: () => void;
  onTransformStart: () => void;
  onDoubleClick?: () => void;
  onMouseEnter: (id: string) => void;
  onMouseLeave: (id: string) => void;
  imageCache: Map<string, HTMLImageElement | null>;
}

function mapWordBreakToKonvaWrap(wordBreak: string | undefined): 'word' | 'char' | 'none' {
  switch (wordBreak) {
    case 'break-all':
      return 'char';
    case 'normal':
    case 'keep-all':
    case 'break-word':
    default:
      return 'word';
  }
}

/** 把 CSS 风格的 border-style 转成 Konva stroke dash 数组 */
function borderDashFromStyle(style?: string, width = 1): number[] | undefined {
  switch (style) {
    case 'dashed':
      return [6, 4];
    case 'dotted':
      return [2, 3];
    case 'double':
      // 双线通过绘制内外两条描边实现，这里不需要 dash
      return undefined;
    default:
      return undefined;
  }
}

/** 根据 object-fit 计算 Konva.Image 的显示位置、尺寸与裁剪区域 */
function computeImageLayout(
  img: HTMLImageElement,
  el: ImageElement,
): {
  x: number;
  y: number;
  width: number;
  height: number;
  crop: { x: number; y: number; width: number; height: number } | undefined;
} {
  const objectFit = el.objectFit ?? 'cover';
  const imgW = img.width || img.naturalWidth || 1;
  const imgH = img.height || img.naturalHeight || 1;

  // 用户自定义裁剪区域（归一化 → 源图像素）
  const userCrop = el.clip?.crop;
  const srcX = userCrop ? imgW * userCrop.x : 0;
  const srcY = userCrop ? imgH * userCrop.y : 0;
  const srcW = userCrop ? imgW * userCrop.width : imgW;
  const srcH = userCrop ? imgH * userCrop.height : imgH;

  if (objectFit === 'contain') {
    const scale = Math.min(el.width / srcW, el.height / srcH);
    const w = srcW * scale;
    const h = srcH * scale;
    return {
      x: (el.width - w) / 2,
      y: (el.height - h) / 2,
      width: w,
      height: h,
      crop: { x: srcX, y: srcY, width: srcW, height: srcH },
    };
  }

  // cover（默认）：按元素宽高比裁剪裁剪区中心区域，再拉伸填满元素
  const elRatio = el.width / el.height;
  const cropRatio = srcW / srcH;
  let crop: { x: number; y: number; width: number; height: number };
  if (cropRatio > elRatio) {
    const cropW = srcH * elRatio;
    crop = { x: srcX + (srcW - cropW) / 2, y: srcY, width: cropW, height: srcH };
  } else {
    const cropH = srcW / elRatio;
    crop = { x: srcX, y: srcY + (srcH - cropH) / 2, width: srcW, height: cropH };
  }
  return { x: 0, y: 0, width: el.width, height: el.height, crop };
}

type KonvaFilter = (typeof Konva.Filters)[keyof typeof Konva.Filters];

/** 自定义对比度滤镜（Konva 无内置 Contrast 滤镜）。
 *  contrast=100 无变化，<100 降低，>100 增强。
 */
function ContrastFilter(this: Konva.Image, imageData: ImageData) {
  // 注意：调用方传入的 contrast 已是倍率（filterContrast/100，100% => 1.0），
  // 切勿再除以 100，否则会退化为 ~0.01 使整张图片变成灰色。
  const contrast = (this as unknown as { contrast(): number }).contrast() ?? 1;
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    data[i] = Math.min(255, Math.max(0, (r - 128) * contrast + 128));
    data[i + 1] = Math.min(255, Math.max(0, (g - 128) * contrast + 128));
    data[i + 2] = Math.min(255, Math.max(0, (b - 128) * contrast + 128));
  }
}

/** 包装 Konva.Image，在图片加载完成 / 滤镜参数变化后强制 cache()，确保亮度、对比度、模糊滤镜生效 */
function FilteredImage({
  image,
  filters,
  brightness,
  blurRadius,
  contrast,
  cornerRadius,
  width,
  height,
  crop,
  ...props
}: Omit<React.ComponentProps<typeof KonvaImage>, 'image' | 'filters' | 'brightness' | 'blurRadius'> & {
  image: HTMLImageElement;
  filters?: KonvaFilter[];
  brightness?: number;
  blurRadius?: number;
  contrast?: number;
  cornerRadius?: number | number[];
  width?: number;
  height?: number;
  crop?: { x: number; y: number; width: number; height: number };
}) {
  const ref = useRef<Konva.Image>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // 仅当有滤镜时才需要缓存（Konva 的滤镜依赖 cache）。
    // 无滤镜时清除缓存，让圆角 / 裁剪 / 尺寸等属性走原生渲染，可实时更新。
    if (!filters || filters.length === 0) {
      try {
        node.clearCache();
      } catch {
        // 尚未缓存时 clearCache 可能抛错，忽略
      }
      node.getLayer()?.batchDraw();
      return;
    }

    // 延迟到下一帧，确保图片已解码到 canvas 后再 cache；
    // 圆角 / 尺寸 / 裁剪变化也要重新生成缓存，否则仍显示旧位图。
    const id = requestAnimationFrame(() => {
      try {
        node.cache();
        node.getLayer()?.batchDraw();
      } catch (e) {
        // 跨域/未解码完成等导致 cache 失败时静默回退，不影响正常显示
      }
    });
    return () => cancelAnimationFrame(id);
  }, [image, filters, brightness, blurRadius, contrast, cornerRadius, width, height, crop]);

  return (
    <KonvaImage
      ref={ref}
      image={image}
      filters={filters}
      brightness={brightness}
      blurRadius={blurRadius}
      contrast={contrast}
      cornerRadius={cornerRadius}
      width={width}
      height={height}
      crop={crop}
      {...props}
    />
  );
}

/**
 * 矩形四角圆角拖拽锚点（Figma / Illustrator 风格）。
 * - 默认拖拽：四角联动统一调节（cornerRadius 写单值）。
 * - 按住 Alt 拖拽：仅调节被拖动的单个角（cornerRadius 写为四角对象）。
 * 锚点坐标基于矩形几何中心 (cx, cy) 与 rotation，与 Konva Rect 节点变换一致，
 * 因此旋转后的矩形锚点也会跟随旋转。
 */
const ANCHOR_R = 4.5; // 锚点视觉半径（px）
const ANCHOR_INSET = 10; // 圆角锚点相对矩形角向内的固定偏移（px），避免与四角 resize 锚点重叠

// 每个角的「角点」局部坐标（相对几何中心）与「指向中心」的方向（每分量 ±1，
// 使锚点沿 45° 角平分线（即圆角半径方向）移动，对应 Figma 的对角线约束）
type CornerDef = { cx: number; cy: number; dx: number; dy: number };
const CORNER_DEFS: Record<keyof CornerRadius, CornerDef> = {
  topLeft: { cx: -1, cy: -1, dx: 1, dy: 1 },
  topRight: { cx: 1, cy: -1, dx: -1, dy: 1 },
  bottomRight: { cx: 1, cy: 1, dx: -1, dy: -1 },
  bottomLeft: { cx: -1, cy: 1, dx: 1, dy: -1 },
};
function cornerPointLocal(key: keyof CornerRadius, w: number, h: number) {
  const d = CORNER_DEFS[key];
  return { corner: { x: (d.cx * w) / 2, y: (d.cy * h) / 2 }, dir: { x: d.dx, y: d.dy } };
}
/** 将原始局部指针位置投影到该角的 45° 角平分线，返回约束后的位置与角半径 r */
function constrainToDiagonal(
  key: keyof CornerRadius,
  lx: number,
  ly: number,
  w: number,
  h: number,
  maxR: number,
): { x: number; y: number; r: number } {
  const { corner, dir } = cornerPointLocal(key, w, h);
  const offX = Math.abs(lx - corner.x);
  const offY = Math.abs(ly - corner.y);
  // 角平分线上 x、y 偏移量相等，取较小者即为圆角半径
  let r = Math.min(offX, offY);
  r = Math.max(0, Math.min(maxR, Math.round(r)));
  return { x: corner.x + dir.x * r, y: corner.y + dir.y * r, r };
}
/** 锚点显示位置：沿角平分线，半径取 max(ANCHOR_INSET, r) 以避免与 resize 锚点重叠 */
function cornerDisplayPos(key: keyof CornerRadius, r: number, w: number, h: number, maxR: number) {
  const { corner, dir } = cornerPointLocal(key, w, h);
  const rr = Math.min(maxR, Math.max(ANCHOR_INSET, r));
  return { x: corner.x + dir.x * rr, y: corner.y + dir.y * rr };
}

function RectCornerAnchors({
  el,
  onChange,
  onStart,
  onEnd,
  onMouseEnter,
  onMouseLeave,
}: {
  el: RectElement | ImageElement;
  onChange: (patch: Partial<Element>) => void;
  onStart: () => void;
  onEnd: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const w = el.width;
  const h = el.height;
  const cx = el.x + w / 2;
  const cy = el.y + h / 2;
  const cr = normalizeCornerRadius(el.cornerRadius ?? el.borderRadius);
  const maxR = Math.max(0, Math.min(w, h) / 2);

  // 直接持有四个锚点节点引用：拖拽时在同一帧内同步移动其余锚点，消除 re-render 滞后
  const anchorRefs = useRef<Record<string, Konva.Circle | null>>({});

  // 休息位：沿角平分线、至少向内偏移 ANCHOR_INSET（避免与四角 resize 锚点重叠）
  const anchors: { key: keyof CornerRadius; x: number; y: number }[] = (
    ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const
  ).map((key) => ({ key, ...cornerDisplayPos(key, cr[key], w, h, maxR) }));

  const handleDragStart =
    (key: keyof CornerRadius) => (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true; // 阻止触发底层矩形/画布的拖拽与选择
      onStart();
    };

  const handleDragMove =
    (key: keyof CornerRadius) => (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      const lx = node.x();
      const ly = node.y();
      // 1) 将锚点约束到该角的 45° 角平分线上（无法拖到矩形外任意位置）
      const { x, y, r } = constrainToDiagonal(key, lx, ly, w, h, maxR);
      node.position({ x, y });

      const altKey = !!(e.evt && (e.evt as MouseEvent | TouchEvent).altKey);
      if (altKey) {
        // 单角独立调节：仅更新当前角，其余三角保持原位
        const next: CornerRadius = { ...cr, [key]: r };
        onChange({ cornerRadius: next });
      } else {
        // 四角联动统一调节
        onChange({ cornerRadius: r });
        // 直接移动其余三个锚点（同帧、无滞后），让它们沿各自对角线同步移动
        (['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const).forEach((k) => {
          if (k === key) return;
          const ref = anchorRefs.current[k];
          if (ref) ref.position(cornerDisplayPos(k, r, w, h, maxR));
        });
      }
      node.getLayer()?.batchDraw();
    };

  const handleDragEnd = () => {
    onEnd();
  };

  return (
    <Group x={cx} y={cy} rotation={el.rotation} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {anchors.map((a) => (
        <Circle
          key={a.key}
          ref={(node: Konva.Circle | null) => {
            anchorRefs.current[a.key] = node;
          }}
          name={`corner-anchor-${a.key}`}
          x={a.x}
          y={a.y}
          radius={ANCHOR_R}
          fill="#111827"
          stroke="#ffffff"
          strokeWidth={1.5}
          shadowColor="rgba(0,0,0,0.25)"
          shadowBlur={2}
          shadowOffsetY={1}
          draggable
          onDragStart={handleDragStart(a.key)}
          onDragMove={handleDragMove(a.key)}
          onDragEnd={handleDragEnd}
        />
      ))}
    </Group>
  );
}

function renderElement({
  el,
  onSelect,
  onChange,
  onDragStart,
  onTransformStart,
  onDoubleClick,
  onMouseEnter,
  onMouseLeave,
  imageCache,
}: RenderProps) {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;

  const common = {
    id: el.id,
    x: cx,
    y: cy,
    rotation: el.rotation,
    opacity: el.opacity,
    // 图层显隐：visible=false 时整节点隐藏且不再响应点击/拖拽（对标 Figma）
    visible: el.visible !== false,
    listening: el.visible !== false,
    shadowColor: el.shadowColor && el.shadowColor !== 'transparent' ? el.shadowColor : undefined,
    shadowBlur: el.shadowBlur || 0,
    shadowOffsetX: el.shadowOffsetX || 0,
    shadowOffsetY: el.shadowOffsetY || 0,
    shadowOpacity: typeof el.shadowOpacity === 'number' ? el.shadowOpacity : 1,
    draggable: !el.locked,
    onClick: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => onSelect(e),
    onTap: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => onSelect(e),
    onDblClick: onDoubleClick,
    onMouseEnter: () => onMouseEnter(el.id),
    onMouseLeave: () => onMouseLeave(el.id),
    onDragStart,
    // Konva 节点 x/y 现在表示对象几何中心；写回数据模型时转回左上角。
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      onChange({
        x: node.x() - el.width / 2,
        y: node.y() - el.height / 2,
      });
    },
    onTransformStart,
    // 拖拽调整大小时实时把 scale 折算成 width/height，并立即归零 scale，
    // 同时保持旋转中心（几何中心）固定。
    onTransform: (e: Konva.KonvaEventObject<Event>) => {
      const node = e.target;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      if (scaleX === 1 && scaleY === 1) return;
      node.scaleX(1);
      node.scaleY(1);
      const newWidth = Math.max(5, Math.round((el.width || 0) * scaleX));
      const newHeight = Math.max(5, Math.round((el.height || 0) * scaleY));
      onChange({
        x: node.x() - newWidth / 2,
        y: node.y() - newHeight / 2,
        width: newWidth,
        height: newHeight,
      });
    },
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      const node = e.target;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      const newWidth = Math.max(5, Math.round((el.width || 0) * scaleX));
      const newHeight = Math.max(5, Math.round((el.height || 0) * scaleY));
      onChange({
        x: node.x() - newWidth / 2,
        y: node.y() - newHeight / 2,
        rotation: node.rotation(),
        width: newWidth,
        height: newHeight,
      });
    },
  };

  switch (el.type) {
    case 'text': {
      const textEl = el as TextElement;
      const hasBg = textEl.backgroundColor && textEl.backgroundColor !== 'transparent';
      const hasBorder = (textEl.borderWidth || 0) > 0;
      // Konva 不会把 Group 上的阴影渲染到子节点，阴影必须直接设在可见子节点上
      const textShadow =
        textEl.shadowColor && textEl.shadowColor !== 'transparent'
          ? {
              shadowColor: textEl.shadowColor,
              shadowBlur: textEl.shadowBlur || 0,
              shadowOffsetX: textEl.shadowOffsetX || 0,
              shadowOffsetY: textEl.shadowOffsetY || 0,
              shadowOpacity: typeof textEl.shadowOpacity === 'number' ? textEl.shadowOpacity : 1,
              shadowForStrokeEnabled: false,
            }
          : {};
      return (
        <Group
          key={el.id}
          {...common}
          offsetX={el.width / 2}
          offsetY={el.height / 2}
          shadowColor={undefined}
          shadowBlur={0}
          shadowOffsetX={0}
          shadowOffsetY={0}
          shadowOpacity={1}
        >
          {hasBorder && (
            <>
              <Rect
                width={el.width}
                height={el.height}
                fill="transparent"
                stroke={textEl.borderColor || '#000000'}
                strokeWidth={textEl.borderWidth}
                cornerRadius={textEl.borderRadius || 0}
                dash={borderDashFromStyle(textEl.borderStyle, textEl.borderWidth)}
                listening={false}
                perfectDrawEnabled={false}
                shadowForStrokeEnabled={false}
              />
              {textEl.borderStyle === 'double' && (
                <Rect
                  x={(textEl.borderWidth || 0) / 2}
                  y={(textEl.borderWidth || 0) / 2}
                  width={Math.max(0, el.width - (textEl.borderWidth || 0))}
                  height={Math.max(0, el.height - (textEl.borderWidth || 0))}
                  fill="transparent"
                  stroke={textEl.borderColor || '#000000'}
                  strokeWidth={Math.max(1, (textEl.borderWidth || 0) / 3)}
                  cornerRadius={Math.max(0, (textEl.borderRadius || 0) - (textEl.borderWidth || 0) / 2)}
                  listening={false}
                  perfectDrawEnabled={false}
                  shadowForStrokeEnabled={false}
                />
              )}
            </>
          )}
          {hasBg && (
            <Rect
              width={el.width}
              height={el.height}
              fill={textEl.backgroundColor}
              cornerRadius={textEl.borderRadius || 0}
              listening={false}
              perfectDrawEnabled={false}
              shadowForStrokeEnabled={false}
              {...textShadow}
            />
          )}
          <Text
            text={textEl.text}
            fontSize={textEl.fontSize}
            fontFamily={textEl.fontFamily}
            fill={textEl.fill}
            align={textEl.align}
            width={el.width}
            height={el.height}
            lineHeight={textEl.lineHeight}
            letterSpacing={textEl.letterSpacing}
            fontStyle={textEl.fontStyle}
            verticalAlign={textEl.verticalAlign}
            wrap={mapWordBreakToKonvaWrap(textEl.wordBreak)}
            listening={!textEl.locked}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
            {...textShadow}
          />
        </Group>
      );
    }

    case 'rect': {
      const rectEl = el as RectElement;
      const hasBorder = (rectEl.borderWidth || 0) > 0;
      return (
        <Rect
          key={el.id}
          {...common}
          offsetX={el.width / 2}
          offsetY={el.height / 2}
          width={el.width}
          height={el.height}
          fill={el.fill}
          cornerRadius={toKonvaCornerRadius(rectEl.cornerRadius ?? rectEl.borderRadius)}
          stroke={hasBorder ? rectEl.borderColor : rectEl.stroke}
          strokeWidth={hasBorder ? rectEl.borderWidth : rectEl.strokeWidth}
          perfectDrawEnabled={false}
          shadowForStrokeEnabled={false}
        />
      );
    }

    case 'circle': {
      const circleEl = el as CircleElement;
      const hasBorder = (circleEl.borderWidth || 0) > 0;
      return (
        <Circle
          key={el.id}
          {...common}
          x={el.x + el.radius}
          y={el.y + el.radius}
          radius={el.radius}
          fill={el.fill}
          stroke={hasBorder ? circleEl.borderColor : circleEl.stroke}
          strokeWidth={hasBorder ? circleEl.borderWidth : circleEl.strokeWidth}
          dash={dashFromLineStyle(circleEl.lineStyle)}
          perfectDrawEnabled={false}
          shadowForStrokeEnabled={false}
        />
      );
    }

    case 'line':
      return (
        <Group key={el.id} {...common} offsetX={el.width / 2} offsetY={el.height / 2}>
          <KonvaLine
            points={[0, 0, el.width, 0]}
            stroke={el.stroke}
            strokeWidth={el.strokeWidth}
            dash={dashFromLineStyle(el.lineStyle)}
            hitStrokeWidth={Math.max(18, el.strokeWidth * 2)}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />
        </Group>
      );

    case 'image': {
      const imgEl = el as ImageElement;
      const cached = imgEl.src ? imageCache.get(imgEl.src) : undefined;
      const hasBorder = (imgEl.borderWidth || 0) > 0;
      const cornerRadius = toKonvaCornerRadius(imgEl.cornerRadius ?? imgEl.borderRadius);
      const borderColor = imgEl.borderColor || '#000000';
      const borderWidth = imgEl.borderWidth || 0;

      // 加载失败：明确提示，避免用户误以为“只显示边框”
      if (cached === null) {
        return (
          <Group key={el.id} {...common} offsetX={el.width / 2} offsetY={el.height / 2}>
            <Rect
              width={el.width}
              height={el.height}
              fill="#fee2e2"
              stroke="#ef4444"
              strokeWidth={1}
              cornerRadius={cornerRadius}
              dash={[4, 4]}
              perfectDrawEnabled={false}
              shadowForStrokeEnabled={false}
            />
            <Text
              x={0}
              y={el.height / 2 - 7}
              width={el.width}
              height={14}
              text="图片加载失败"
              fontSize={10}
              fill="#b91c1c"
              align="center"
              listening={false}
              perfectDrawEnabled={false}
              shadowForStrokeEnabled={false}
            />
          </Group>
        );
      }

      if (cached) {
        const objectFit = imgEl.objectFit ?? 'cover';
        const isTiled = objectFit === 'repeat-x' || objectFit === 'repeat-y';
        const imgW = cached.naturalWidth || cached.width || 1;
        const imgH = cached.naturalHeight || cached.height || 1;

        // 平铺模式：用 Rect 的 fillPatternImage 实现，按元素对应边等比缩放单张图后沿轴平铺
        const tileScale = isTiled
          ? objectFit === 'repeat-x'
            ? el.height / imgH
            : el.width / imgW
          : 1;

        const filters: KonvaFilter[] = [];
        const brightness = (imgEl.filterBrightness ?? 100) / 100 - 1;
        const contrast = (imgEl.filterContrast ?? 100) / 100;
        const blurRadius = imgEl.filterBlur ?? 0;
        if (Math.abs(brightness) > 0.001) filters.push(Konva.Filters.Brighten);
        if (Math.abs(contrast - 1) > 0.001) filters.push(ContrastFilter as unknown as KonvaFilter);
        if (blurRadius > 0.001) filters.push(Konva.Filters.Blur);

        // 只要设置了阴影颜色（非 transparent）即投射阴影；与“形状”对象行为一致
        // （blur/offset 为 0 时阴影落在图片正下方，被图片本身遮挡，等同不可见）。
        const hasShadow = !!(imgEl.shadowColor && imgEl.shadowColor !== 'transparent');
        const shadowProps = hasShadow
          ? {
              shadowColor: imgEl.shadowColor,
              shadowBlur: imgEl.shadowBlur || 0,
              shadowOffsetX: imgEl.shadowOffsetX || 0,
              shadowOffsetY: imgEl.shadowOffsetY || 0,
              shadowOpacity: typeof imgEl.shadowOpacity === 'number' ? imgEl.shadowOpacity : 1,
            }
          : {};
        // 图片元素的阴影由“专用投射层”生成，避免 Group 阴影在含滤镜子节点时被裁剪/失效。
        // 关键点：投射层必须使用与图片“相同内容”的不透明填充（而非半透明白底），
        // 否则 Canvas 会把阴影有效不透明度乘以填充不透明度，导致彩色阴影被稀释到几乎不可见。
        const groupProps = {
          ...common,
          shadowColor: undefined,
          shadowBlur: 0,
          shadowOffsetX: 0,
          shadowOffsetY: 0,
          shadowOpacity: 1,
        };

        // 裁剪蒙版：形状遮罩（圆形/心形/星形等）作用于整个图片组（含边框与阴影），
        // 坐标基于元素局部盒子（0,0 左上角 → w,h 右下角），与发布态 DOM clip-path 对齐。
        const clipShape = normalizeImageClip(imgEl.clip).shape;
        const clipFunc =
          clipShape !== 'none'
            ? (ctx: Konva.Context) => drawClipOnContext(ctx, clipShape, el.width, el.height)
            : undefined;

        return (
          <Group key={el.id} {...groupProps} offsetX={el.width / 2} offsetY={el.height / 2} clipFunc={clipFunc}>
            {hasShadow && (
              // 阴影投射层：用与真实图片一致的像素内容（无滤镜、不缓存）投射阴影，
              // 保证阴影强度/颜色与“形状”对象一致；透明 PNG 处天然透明，不会出现白底方块。
              isTiled ? (
                <Rect
                  width={el.width}
                  height={el.height}
                  fillPatternImage={cached}
                  fillPatternRepeat={objectFit}
                  fillPatternScaleX={tileScale}
                  fillPatternScaleY={tileScale}
                  cornerRadius={cornerRadius}
                  listening={false}
                  perfectDrawEnabled={false}
                  shadowForStrokeEnabled={false}
                  {...shadowProps}
                />
              ) : (
                <KonvaImage
                  image={cached}
                  {...computeImageLayout(cached, imgEl)}
                  cornerRadius={cornerRadius}
                  listening={false}
                  perfectDrawEnabled={false}
                  shadowForStrokeEnabled={false}
                  {...shadowProps}
                />
              )
            )}
            {hasBorder && (
              <>
                <Rect
                  width={el.width}
                  height={el.height}
                  fill="transparent"
                  stroke={borderColor}
                  strokeWidth={borderWidth}
                  cornerRadius={cornerRadius}
                  dash={borderDashFromStyle(imgEl.borderStyle, borderWidth)}
                  listening={false}
                  perfectDrawEnabled={false}
                  shadowForStrokeEnabled={false}
                />
                {imgEl.borderStyle === 'double' && (
                  <Rect
                    x={borderWidth / 2}
                    y={borderWidth / 2}
                    width={Math.max(0, el.width - borderWidth)}
                    height={Math.max(0, el.height - borderWidth)}
                    fill="transparent"
                    stroke={borderColor}
                    strokeWidth={Math.max(1, borderWidth / 3)}
                    cornerRadius={Math.max(0, (Array.isArray(cornerRadius) ? cornerRadius[0] : cornerRadius) - borderWidth / 2)}
                    listening={false}
                    perfectDrawEnabled={false}
                    shadowForStrokeEnabled={false}
                  />
                )}
              </>
            )}
            {isTiled ? (
              <Rect
                width={el.width}
                height={el.height}
                fillPatternImage={cached}
                fillPatternRepeat={objectFit}
                fillPatternScaleX={tileScale}
                fillPatternScaleY={tileScale}
                cornerRadius={cornerRadius}
                filters={filters.length ? filters : undefined}
                brightness={brightness}
                contrast={contrast}
                blurRadius={blurRadius}
                perfectDrawEnabled={false}
                shadowForStrokeEnabled={false}
              />
            ) : (
              <FilteredImage
                image={cached}
                {...computeImageLayout(cached, imgEl)}
                cornerRadius={cornerRadius}
                filters={filters.length ? filters : undefined}
                brightness={brightness}
                blurRadius={blurRadius}
                contrast={contrast}
                perfectDrawEnabled={false}
                shadowForStrokeEnabled={false}
              />
            )}
          </Group>
        );
      }

      // 加载中占位
      return (
        <Group key={el.id} {...common} offsetX={el.width / 2} offsetY={el.height / 2}>
          <Rect
            width={el.width}
            height={el.height}
            fill="#e5e7eb"
            stroke="#9ca3af"
            strokeWidth={1}
            dash={[4, 4]}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />
        </Group>
      );
    }

    case 'button':
      return (
        <Group key={el.id} {...common} offsetX={el.width / 2} offsetY={el.height / 2}>
          <Rect
            width={el.width}
            height={el.height}
            fill={el.fill}
            cornerRadius={el.radius}
            listening={false}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />
          <Text
            width={el.width}
            height={el.height}
            text={el.text}
            fontSize={el.fontSize}
            fontFamily="sans-serif"
            fill={el.color}
            align="center"
            verticalAlign="middle"
            listening={false}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />
        </Group>
      );

    case 'video':
      return (
        <Group key={el.id} {...common} offsetX={el.width / 2} offsetY={el.height / 2}>
          {/* 占位 Rect 必须参与命中检测，否则 Group 整体无命中区，无法点选/拖拽 */}
          <Rect
            width={el.width}
            height={el.height}
            fill="#1f2937"
            cornerRadius={4}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />
          {/* 播放三角 */}
          <KonvaLine
            points={[
              el.width / 2 - 8,
              el.height / 2 - 12,
              el.width / 2 - 8,
              el.height / 2 + 12,
              el.width / 2 + 12,
              el.height / 2,
            ]}
            closed
            fill="#ffffff"
            listening={false}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />
        </Group>
      );

    case 'star':
      return (
        <Star
          key={el.id}
          {...common}
          x={el.x + el.width / 2}
          y={el.y + el.height / 2}
          numPoints={el.points ?? 5}
          innerRadius={el.width / 4}
          outerRadius={el.width / 2}
          fill={el.fill}
          stroke={el.stroke}
          strokeWidth={el.strokeWidth ?? 0}
          perfectDrawEnabled={false}
          shadowForStrokeEnabled={false}
        />
      );

    case 'triangle':
      return (
        <RegularPolygon
          key={el.id}
          {...common}
          x={el.x + el.width / 2}
          y={el.y + el.height / 2}
          sides={3}
          radius={el.width / 2}
          fill={el.fill}
          stroke={el.stroke}
          strokeWidth={el.strokeWidth ?? 0}
          dash={dashFromLineStyle(el.lineStyle)}
          perfectDrawEnabled={false}
          shadowForStrokeEnabled={false}
        />
      );

    case 'ellipse':
      return (
        <Ellipse
          key={el.id}
          {...common}
          x={el.x + el.width / 2}
          y={el.y + el.height / 2}
          radiusX={el.width / 2}
          radiusY={el.height / 2}
          fill={el.fill}
          stroke={el.stroke}
          strokeWidth={el.strokeWidth ?? 0}
          dash={dashFromLineStyle(el.lineStyle)}
          perfectDrawEnabled={false}
          shadowForStrokeEnabled={false}
        />
      );

    case 'polygon': {
      const polyEl = el as PolygonElement;
      return (
        <RegularPolygon
          key={el.id}
          {...common}
          x={el.x + el.width / 2}
          y={el.y + el.height / 2}
          sides={polyEl.sides ?? 5}
          radius={Math.min(el.width, el.height) / 2}
          fill={el.fill}
          stroke={el.stroke}
          strokeWidth={el.strokeWidth ?? 0}
          dash={dashFromLineStyle(el.lineStyle)}
          perfectDrawEnabled={false}
          shadowForStrokeEnabled={false}
        />
      );
    }

    case 'arrow': {
      const arrowEl = el as ArrowElement;
      const size = arrowEl.arrowSize ?? 16;
      return (
        <Group key={el.id} {...common} offsetX={el.width / 2} offsetY={el.height / 2}>
          <KonvaArrow
            points={[0, el.height / 2, el.width, el.height / 2]}
            stroke={el.stroke}
            strokeWidth={el.strokeWidth}
            fill={el.stroke}
            dash={dashFromLineStyle(el.lineStyle)}
            pointerLength={size}
            pointerWidth={size}
            pointerAtBeginning={arrowEl.arrowType === 'start' || arrowEl.arrowType === 'both'}
            pointerAtEnding={arrowEl.arrowType === 'end' || arrowEl.arrowType === 'both' || arrowEl.arrowType === undefined}
            hitStrokeWidth={Math.max(18, el.strokeWidth * 2)}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />
        </Group>
      );
    }

    case 'calendar':
      return <CanvasCalendar key={el.id} el={el as CalendarElement} common={common} />;

    case 'gallery':
      return <CanvasGallery key={el.id} el={el as GalleryElement} common={common} update={(patch) => onChange(patch as Partial<Element>)} />;

    case 'puzzle':
      return <CanvasPuzzle key={el.id} el={el as PuzzleElement} common={common} update={(patch) => onChange(patch as Partial<PuzzleElement>)} />;

    case 'countdown':
      return <CanvasCountdown key={el.id} el={el as CountdownElement} common={common} />;

    case 'mapNav':
      return <CanvasMapNav key={el.id} el={el as MapNavElement} common={common} />;

    case 'messageBoard':
      return <CanvasMessageBoard key={el.id} el={el as MessageBoardElement} common={common} />;

    case 'timeline':
      return <CanvasTimeline key={el.id} el={el as TimelineElement} common={common} />;

    case 'like':
      return <CanvasLike key={el.id} el={el as LikeElement} common={common} />;

    case 'widget':
      return <CanvasWidget key={el.id} el={el as WidgetElement} common={common} />;

    default:
      return null;
  }
}

function dashFromLineStyle(lineStyle?: string): number[] | undefined {
  switch (lineStyle) {
    case 'dashed':
      return [6, 4];
    case 'dotted':
      return [2, 4];
    default:
      return undefined;
  }
}

/* ───────── 页面背景图片渲染 ───────── */

interface PageBackgroundImageProps {
  image: HTMLImageElement;
  width: number;
  height: number;
  backgroundSize: string;
  backgroundRepeat: string;
}

function PageBackgroundImage({
  image,
  width,
  height,
  backgroundSize,
  backgroundRepeat,
}: PageBackgroundImageProps) {
  const imgW = image.naturalWidth || image.width || 1;
  const imgH = image.naturalHeight || image.height || 1;

  const repeat = backgroundRepeat || 'no-repeat';
  const size = backgroundSize || 'contain';

  if (repeat !== 'no-repeat') {
    let scaleX = 1;
    let scaleY = 1;
    if (size === 'cover') {
      const s = Math.max(width / imgW, height / imgH);
      scaleX = s;
      scaleY = s;
    } else if (size === 'contain') {
      const s = Math.min(width / imgW, height / imgH);
      scaleX = s;
      scaleY = s;
    } else if (size === '100%' || size === '100% auto') {
      scaleX = width / imgW;
      scaleY = 1;
    } else if (size === '100% 100%') {
      scaleX = width / imgW;
      scaleY = height / imgH;
    } else if (size === 'auto 100%') {
      scaleX = 1;
      scaleY = height / imgH;
    } else {
      scaleX = 1;
      scaleY = 1;
    }
    return (
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fillPatternImage={image}
        fillPatternRepeat={repeat as 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat'}
        fillPatternScale={{ x: scaleX, y: scaleY }}
        listening={false}
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
      />
    );
  }

  let drawW = imgW;
  let drawH = imgH;
  let x = 0;
  let y = 0;

  if (size === 'cover') {
    const s = Math.max(width / imgW, height / imgH);
    drawW = imgW * s;
    drawH = imgH * s;
    x = (width - drawW) / 2;
    y = (height - drawH) / 2;
  } else if (size === 'contain') {
    const s = Math.min(width / imgW, height / imgH);
    drawW = imgW * s;
    drawH = imgH * s;
    x = (width - drawW) / 2;
    y = (height - drawH) / 2;
  } else if (size === '100%' || size === '100% auto') {
    drawW = width;
    drawH = (width / imgW) * imgH;
  } else if (size === '100% 100%') {
    drawW = width;
    drawH = height;
  } else if (size === 'auto 100%') {
    drawW = (height / imgH) * imgW;
    drawH = height;
  } else {
    drawW = imgW;
    drawH = imgH;
  }

  return (
    <KonvaImage
      x={x}
      y={y}
      width={drawW}
      height={drawH}
      image={image}
      listening={false}
      perfectDrawEnabled={false}
      shadowForStrokeEnabled={false}
    />
  );
}

/* ───────── 主组件 ───────── */

interface EditorCanvasProps {
  onPreview?: () => void;
  onSave?: () => void;
  onSettings?: () => void;
  isSaving?: boolean;
}

export default function EditorCanvas({ onPreview, onSave, onSettings, isSaving }: EditorCanvasProps) {
  const { t } = useTranslation(['editor', 'common']);
  const project = useEditorStore((s) => s.project);
  const activePage = useEditorStore((s) => s.activePage);
  const pages = useEditorStore((s) => s.project.pages);
  const switchPage = useEditorStore((s) => s.switchPage);
  const addPage = useEditorStore((s) => s.addPage);
  const deletePage = useEditorStore((s) => s.deletePage);
  const selectedId = useEditorStore((s) => s.selectedId);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const select = useEditorStore((s) => s.select);
  const setSelection = useEditorStore((s) => s.setSelection);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const updateElement = useEditorStore((s) => s.updateElement);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  const trRef = useRef<Konva.Transformer>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const imageCache = useRef(new Map<string, HTMLImageElement | null>());
  const [guides, setGuides] = useState<Guide[]>([]);
  const [pageBgImage, setPageBgImage] = useState<HTMLImageElement | null>(null);
  // 图片资源异步加载完成后需要触发组件重渲染，否则仅 batchDraw 不会把
  // 已加载的 HTMLImageElement 反映到 React/Konva 树（图片会一直停留在灰色占位框）。
  const [, forceImgRedraw] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  // 浮动工具条：可拖拽位置 + 删除确认弹窗
  const toolbarRef = useRef<HTMLDivElement>(null);
  // tbPos 为 null 时使用画布右侧中间作为默认锚点；一旦拖拽即记录视口绝对坐标
  const [tbPos, setTbPos] = useState<{ x: number; y: number } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const dragState = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  const toggleToolbar = () => setCollapsed((c) => !c);

  const onToolbarDragStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const rect = toolbarRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: rect.left,
      baseY: rect.top,
    };
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragState.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      setTbPos({ x: d.baseX + dx, y: d.baseY + dy });
    };
    const onUp = () => {
      dragState.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const marqueeStart = useRef<{ x: number; y: number; additive: boolean } | null>(null);
  const finishMarqueeRef = useRef<() => void>(() => {});

  // 圆角锚点：鼠标悬停在矩形上时显示；用短延迟避免 rect→anchor 快速切换时闪烁
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [cornerDragging, setCornerDragging] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleElementMouseEnter = useCallback((id: string) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHoveredId(id);
  }, []);
  const handleElementMouseLeave = useCallback((id: string) => {
    hoverTimerRef.current = setTimeout(() => {
      setHoveredId((prev) => (prev === id ? null : prev));
    }, 50);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const page = project.pages[activePage];
  const canvasH = page.height ?? CANVAS_DEFAULT.height;

  // 默认将浮动工具条定位到画布右侧中间；用户拖拽后不再自动重置；窗口尺寸变化时重新吸附
  useEffect(() => {
    if (tbPos !== null) return;
    const init = () => {
      const wrap = canvasWrapRef.current;
      const toolbar = toolbarRef.current;
      if (!wrap || !toolbar) return;
      const wrapRect = wrap.getBoundingClientRect();
      const toolbarRect = toolbar.getBoundingClientRect();
      // 工具条位于画布右侧边界之外，保持约 20px 间距；窗口变化时该间距恒定
      const x = wrapRect.right + 20;
      const y = wrapRect.top + wrapRect.height / 2 - toolbarRect.height / 2;
      setTbPos({ x, y });
    };
    // 等待工具条首次渲染完成后再测量尺寸
    const raf = requestAnimationFrame(init);
    window.addEventListener('resize', init);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', init);
    };
  }, [canvasH, tbPos]);

  // 单选中「矩形 / 图片」时，供圆角锚点组件使用（多选/空选不显示锚点）。
  // 图片对象同样支持四角独立圆角的画布拖拽锚点（与矩形一致）。
  const selectedSingle =
    selectedId && selectedIds.length <= 1 ? page.elements.find((e) => e.id === selectedId) : undefined;
  const selectedCornerEl =
    selectedSingle && (selectedSingle.type === 'rect' || selectedSingle.type === 'image')
      ? (selectedSingle as RectElement | ImageElement)
      : undefined;
  const editingEl = editingId
    ? (page.elements.find((e) => e.id === editingId) as TextElement | undefined)
    : undefined;

  /* ── 加载图片资源 ── */
  useEffect(() => {
    const toLoad: string[] = [];
    for (const el of page.elements) {
      if (el.type === 'image' && el.src && !imageCache.current.has(el.src)) {
        toLoad.push(el.src);
      }
    }
    for (const src of toLoad) {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imageCache.current.set(src, img);
        forceImgRedraw((v) => v + 1);
      };
      img.onerror = () => {
        // 偶发：带 crossOrigin='anonymous' 的图片在服务器未返回 CORS 头时会被浏览器拦截
        // （表现为 onerror，画布显示「图片加载失败」）。降级为不带 crossOrigin 重新加载，
        // 保证图片至少能正常显示（滤镜所需的 canvas 去污染可能无法保证，但显示优先）。
        const fallback = new window.Image();
        fallback.onload = () => {
          imageCache.current.set(src, fallback);
          forceImgRedraw((v) => v + 1);
        };
        fallback.onerror = () => {
          // 两次加载均失败才标记为加载失败，避免无限重试
          imageCache.current.set(src, null);
          forceImgRedraw((v) => v + 1);
        };
        fallback.src = src;
      };
      img.src = src;
    }
  }, [page.elements]);

  /* ── 加载页面背景图片 ── */
  useEffect(() => {
    const src = page.backgroundImage;
    if (!src) {
      setPageBgImage(null);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    img.onload = () => {
      setPageBgImage(img);
      stageRef.current?.batchDraw();
    };
    img.onerror = () => setPageBgImage(null);
  }, [page.backgroundImage]);

  /* ── Transformer 绑定 ── */
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    const ids = selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];
    if (ids.length !== 1) {
      // 多选或空选时不使用单框 Transformer；多选时由下方独立选择框显示每个对象的边界
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const node = stage.findOne<Konva.Node>(`#${ids[0]}`);
    // 隐藏元素在画布上不可见，不绑定 Transformer（避免空框）
    if (node && node.visible()) {
      tr.nodes([node]);
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
    }
  }, [selectedId, selectedIds, page.elements]);

  /* ── 注册 Stage 引用到 store，供动画面板等外部组件访问 ── */
  useEffect(() => {
    const stage = stageRef.current;
    const setStageRef = useEditorStore.getState().setStageRef;
    setStageRef(stage);
    return () => {
      if (useEditorStore.getState().stageRef === stage) {
        setStageRef(null);
      }
    };
  }, []);

  /* ── 拖拽中吸附 ── */
  const handleDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      const el = page.elements.find((el) => el.id === node.id());
      if (!el) return;

      // 临时更新元素位置用于吸附计算
      const tempEl = { ...el, x: node.x(), y: node.y() };
      const others = page.elements.filter((el2) => el2.id !== el.id);
      const { snappedX, snappedY, guides: newGuides } = snapCalc(tempEl, others, canvasH);

      if (snappedX !== null) node.x(snappedX);
      if (snappedY !== null) node.y(snappedY);
      setGuides(newGuides);
    },
    [page.elements],
  );

  const handleDragEndClear = useCallback(() => {
    setGuides([]);
  }, []);

  /* ── 点击空白：启动框选（或清空选择） ── */
  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target !== e.target.getStage()) return; // 只处理画布空白处
    setEditingId(null);
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getRelativePointerPosition();
    if (!pos) return;
    const additive = !!(e.evt && (e.evt.shiftKey || (e.evt as MouseEvent).ctrlKey || (e.evt as MouseEvent).metaKey));
    marqueeStart.current = { x: pos.x, y: pos.y, additive };
    // 非叠加模式下，按下即清空当前选择（若之后拖出选框则重建选择）
    if (!additive) clearSelection();
  };

  /* ── 拖拽中更新框选矩形 ── */
  const handleStageMouseMove = () => {
    const start = marqueeStart.current;
    const stage = stageRef.current;
    if (!start || !stage) return;
    const pos = stage.getRelativePointerPosition();
    if (!pos) return;
    setMarquee({ x1: start.x, y1: start.y, x2: pos.x, y2: pos.y });
  };

  /* ── 释放：根据覆盖区域选中元素 ── */
  const finishMarquee = useCallback(() => {
    const start = marqueeStart.current;
    const box = marquee;
    marqueeStart.current = null;
    if (!start || !box) {
      setMarquee(null);
      return;
    }
    const mx1 = Math.min(box.x1, box.x2);
    const my1 = Math.min(box.y1, box.y2);
    const mx2 = Math.max(box.x1, box.x2);
    const my2 = Math.max(box.y1, box.y2);
    const moved = mx2 - mx1 > 3 || my2 - my1 > 3;
    setMarquee(null);
    if (!moved) return; // 视为单击空白，已清空选择
    const hits = page.elements
      .filter((el) => {
        const ex1 = el.x;
        const ey1 = el.y;
        const ex2 = el.x + el.width;
        const ey2 = el.y + el.height;
        return ex2 > mx1 && ex1 < mx2 && ey2 > my1 && ey1 < my2;
      })
      .map((el) => el.id);
    setSelection(hits, start.additive);
  }, [marquee, page.elements, setSelection]);

  // 始终指向最新的 finishMarquee，供 document 兜底监听调用
  finishMarqueeRef.current = finishMarquee;

  /* ── 兜底：鼠标在画布外释放时也能结束框选 ── */
  useEffect(() => {
    const onUp = () => {
      if (marqueeStart.current) finishMarqueeRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && marqueeStart.current) {
        marqueeStart.current = null;
        setMarquee(null);
      }
    };
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  /* ── 文本双击进入编辑 ── */
  const startTextEdit = useCallback((id: string) => {
    const el = page.elements.find((e) => e.id === id);
    if (!el || el.type !== 'text' || el.locked) return;
    setEditValue((el as TextElement).text ?? '');
    setEditingId(id);
  }, [page.elements]);

  const commitTextEdit = useCallback(() => {
    if (!editingId) return;
    pushHistory();
    updateElement(editingId, { text: editValue } as Partial<Element>);
    setEditingId(null);
  }, [editingId, editValue, pushHistory, updateElement]);

  const cancelTextEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  return (
    <div className="flex h-full items-center justify-center bg-gray-50">
      <div
        ref={canvasWrapRef}
        className="relative"
        style={{ width: CANVAS_W + RULER, height: canvasH + RULER }}
      >
        {/* 左上角 */}
        <div
          className="absolute left-0 top-0 border-b border-r border-gray-300 bg-gray-300"
          style={{ width: RULER, height: RULER }}
        />
        {/* 顶部标尺 */}
        <div
          className="absolute top-0 overflow-hidden border-b border-gray-300 bg-gray-100"
          style={{ left: RULER, width: CANVAS_W, height: RULER }}
        >
          <Ruler orientation="h" length={CANVAS_W} />
        </div>
        {/* 左侧标尺 */}
        <div
          className="absolute left-0 overflow-hidden border-r border-gray-300 bg-gray-100"
          style={{ top: RULER, width: RULER, height: canvasH }}
        >
          <Ruler orientation="v" length={canvasH} />
        </div>
        {/* 画布舞台 */}
        <div
          ref={containerRef}
          className="absolute overflow-hidden rounded-sm bg-white shadow-2xl"
          style={{ left: RULER, top: RULER, width: CANVAS_W, height: canvasH }}
        >
          <Stage
            ref={stageRef}
            width={CANVAS_W}
            height={canvasH}
            onMouseDown={handleStageMouseDown}
            onTouchStart={handleStageMouseDown}
            onMouseMove={handleStageMouseMove}
            onTouchMove={handleStageMouseMove}
            onMouseUp={finishMarquee}
            onTouchEnd={finishMarquee}
            onDragMove={handleDragMove}
          >
            <Layer>
              {/* 画布背景 */}
              <Rect
                x={0}
                y={0}
                width={CANVAS_W}
                height={canvasH}
                fill={page.background}
                listening={false}
                perfectDrawEnabled={false}
                shadowForStrokeEnabled={false}
              />

              {/* 页面背景图片 */}
              {pageBgImage && (
                <PageBackgroundImage
                  image={pageBgImage}
                  width={CANVAS_W}
                  height={canvasH}
                  backgroundSize={page.backgroundSize ?? 'contain'}
                  backgroundRepeat={page.backgroundRepeat ?? 'no-repeat'}
                />
              )}

              {/* 元素列表（按 zIndex 排序） */}
              {[...page.elements]
                .sort((a, b) => a.zIndex - b.zIndex)
                .map((el) =>
                  renderElement({
                    el,
                    isSelected: selectedIds.includes(el.id),
                    onSelect: (e) => {
                      const isMulti = !!(
                        e?.evt && (e.evt.ctrlKey || e.evt.metaKey || e.evt.shiftKey)
                      );
                      if (el.type === 'text' && el.id === selectedId && !isMulti) {
                        // 单击已选中文本不进入编辑，保持选中；双击才编辑
                        select(el.id);
                      } else {
                        select(el.id, isMulti ? { toggle: true } : undefined);
                        setEditingId(null);
                      }
                    },
                    onChange: (patch) => {
                      updateElement(el.id, patch);
                      setGuides([]);
                    },
                    onDragStart: () => pushHistory(),
                    onTransformStart: () => pushHistory(),
                    onDoubleClick: el.type === 'text' && !el.locked && selectedIds.length <= 1 ? () => startTextEdit(el.id) : undefined,
                    onMouseEnter: handleElementMouseEnter,
                    onMouseLeave: handleElementMouseLeave,
                    imageCache: imageCache.current,
                  }),
                )}

              {/* 多选时：每个选中对象单独显示边界框，便于区分 */}
              {selectedIds.length > 1 &&
                selectedIds
                  .map((id) => page.elements.find((e) => e.id === id))
                  .filter((e): e is Element => !!e)
                  .map((el) => (
                    <Rect
                      key={`sel-${el.id}`}
                      x={el.x + el.width / 2}
                      y={el.y + el.height / 2}
                      width={el.width}
                      height={el.height}
                      offsetX={el.width / 2}
                      offsetY={el.height / 2}
                      rotation={el.rotation}
                      fill="transparent"
                      stroke="#3b82f6"
                      strokeWidth={1}
                      listening={false}
                      perfectDrawEnabled={false}
                      shadowForStrokeEnabled={false}
                    />
                  ))}

              {/* 框选拖拽中的半透明选框 */}
              {marquee && (
                <Rect
                  x={Math.min(marquee.x1, marquee.x2)}
                  y={Math.min(marquee.y1, marquee.y2)}
                  width={Math.abs(marquee.x2 - marquee.x1)}
                  height={Math.abs(marquee.y2 - marquee.y1)}
                  fill="rgba(59,130,246,0.12)"
                  stroke="#3b82f6"
                  strokeWidth={1}
                  dash={[4, 3]}
                  listening={false}
                  perfectDrawEnabled={false}
                  shadowForStrokeEnabled={false}
                />
              )}

              {/* 对齐辅助线 */}
              {guides.map((g, i) => (
                <KonvaLine
                  key={`guide-${i}`}
                  points={g.points}
                  stroke="#00a1ff"
                  strokeWidth={1}
                  dash={[4, 4]}
                  listening={false}
                  perfectDrawEnabled={false}
                  shadowForStrokeEnabled={false}
                />
              ))}

              {/* 矩形/图片四角圆角拖拽锚点（Figma / Illustrator 风格）：
                  鼠标悬停到选中的矩形或图片上才出现，锚点向内偏离四角，避免与 resize 锚点重叠 */}
              {selectedCornerEl && (hoveredId === selectedCornerEl.id || cornerDragging) && (
                <RectCornerAnchors
                  el={selectedCornerEl}
                  onChange={(patch) => {
                    updateElement(selectedCornerEl.id, patch);
                    setGuides([]);
                  }}
                  onStart={() => {
                    pushHistory();
                    setCornerDragging(true);
                  }}
                  onEnd={() => setCornerDragging(false)}
                  onMouseEnter={() => handleElementMouseEnter(selectedCornerEl.id)}
                  onMouseLeave={() => handleElementMouseLeave(selectedCornerEl.id)}
                />
              )}

              {/* 变换器 */}
              <Transformer
                ref={trRef}
                rotateEnabled
                keepRatio={false}
                anchorSize={8}
                anchorStroke="#3b82f6"
                anchorFill="#ffffff"
                borderStroke="#3b82f6"
                boundBoxFunc={(oldBox, newBox) =>
                  newBox.width < 5 || newBox.height < 5 ? oldBox : newBox
                }
              />
            </Layer>
          </Stage>

          {/* 图集切换动画预览覆盖层：切换时叠加播放所选动画（pointer-events:none，不影响底层 Konva 交互） */}
          {page.elements
            .filter((e) => e.type === 'gallery')
            .map((e) => (
              <GalleryEditorOverlay key={e.id} el={e as GalleryElement} />
            ))}

          {/* 文本双击编辑覆盖层 */}
          {editingEl && (
            <textarea
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitTextEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  commitTextEdit();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelTextEdit();
                }
              }}
              className="absolute z-50 resize-none overflow-hidden border border-blue-500 bg-white/95 p-0 text-gray-800 outline-none"
              style={{
                left: editingEl.x,
                top: editingEl.y,
                width: editingEl.width,
                height: editingEl.height,
                fontSize: editingEl.fontSize,
                fontFamily: editingEl.fontFamily,
                color: editingEl.fill,
                backgroundColor:
                  editingEl.backgroundColor && editingEl.backgroundColor !== 'transparent'
                    ? editingEl.backgroundColor
                    : 'rgba(255,255,255,0.95)',
                textAlign: editingEl.align,
                fontStyle: editingEl.fontStyle.includes('italic') ? 'italic' : 'normal',
                fontWeight: editingEl.fontStyle.includes('bold') ? 'bold' : 'normal',
                lineHeight: editingEl.lineHeight,
                letterSpacing: editingEl.letterSpacing,
                textDecoration: editingEl.textDecoration,
                whiteSpace: 'pre-wrap',
                wordBreak: editingEl.wordBreak,
                transform: `rotate(${editingEl.rotation}deg)`,
                transformOrigin: 'top left',
              }}
            />
          )}
        </div>

        {/* 浮动工具条：可拖拽 + 可折叠 + 上一页 / 预览 / 下一页 / 新增空白页 / 删除当前页 */}
        <div
          ref={toolbarRef}
          className="fixed z-30 flex w-11 flex-col rounded-lg border border-gray-200 bg-white shadow-lg"
          style={
            tbPos
              ? { left: tbPos.x, top: tbPos.y, right: 'auto', transform: 'none' }
              : { right: 24, top: '50%', transform: 'translateY(-50%)' }
          }
        >
          {/* 标题区 / 拖拽手柄：双击折叠/展开，居中拖拽图标 */}
          <div
            onMouseDown={onToolbarDragStart}
            onDoubleClick={toggleToolbar}
            className={`flex cursor-move select-none items-center justify-center bg-gray-50 px-2 py-1.5 ${
              collapsed ? 'rounded-lg' : 'rounded-t-lg border-b border-gray-100'
            }`}
          >
            {collapsed ? (
              <svg className="h-4 w-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="9" cy="6" r="1.5" />
                <circle cx="15" cy="6" r="1.5" />
                <circle cx="9" cy="12" r="1.5" />
                <circle cx="15" cy="12" r="1.5" />
                <circle cx="9" cy="18" r="1.5" />
                <circle cx="15" cy="18" r="1.5" />
              </svg>
            )}
          </div>

          {!collapsed && (
            <>
              {/* 顶部功能按钮：设置 / 保存 / 预览 */}
              <div className="flex flex-col gap-1 p-1">
                <button
                  onClick={() => onSettings?.()}
                  title={t('editor:toolbar.settings')}
                  className="flex h-8 w-8 items-center justify-center rounded text-gray-600 transition hover:bg-blue-50 hover:text-blue-600"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
                <button
                  onClick={() => onSave?.()}
                  disabled={isSaving}
                  title={t('editor:toolbar.save')}
                  className="flex h-8 w-8 items-center justify-center rounded text-gray-600 transition hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10.2Z" />
                    <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
                    <path d="M7 3v4a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V3" />
                  </svg>
                </button>
                <button
                  onClick={() => onPreview?.()}
                  title={t('editor:toolbar.preview')}
                  className="flex h-8 w-8 items-center justify-center rounded text-gray-600 transition hover:bg-blue-50 hover:text-blue-600"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>

              {/* 分隔线 */}
              <div className="border-t border-gray-100" />

              {/* 页面操作按钮：上一页 / 下一页 / 新增空白页 / 删除 */}
              <div className="flex flex-col gap-1 p-1">
                <button
                  onClick={() => switchPage(Math.max(0, activePage - 1))}
                  disabled={activePage <= 0}
                  title={t('editor:page.prevPage')}
                  className="flex h-8 w-8 items-center justify-center rounded text-gray-600 transition hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5" />
                    <path d="m5 12 7-7 7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => switchPage(Math.min(pages.length - 1, activePage + 1))}
                  disabled={activePage >= pages.length - 1}
                  title={t('editor:page.nextPage')}
                  className="flex h-8 w-8 items-center justify-center rounded text-gray-600 transition hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14" />
                    <path d="m19 12-7 7-7-7" />
                  </svg>
                </button>
                <button
                  onClick={addPage}
                  title={t('editor:page.addBlankPage')}
                  className="flex h-8 w-8 items-center justify-center rounded text-gray-600 transition hover:bg-blue-50 hover:text-blue-600"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                </button>
                <button
                  onClick={() => setConfirmOpen(true)}
                  title={t('editor:page.deletePage')}
                  className="flex h-8 w-8 items-center justify-center rounded text-gray-600 transition hover:bg-red-50 hover:text-red-600"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>

        {/* 删除当前页确认弹窗 */}
        {confirmOpen && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/30"
            onClick={() => setConfirmOpen(false)}
          >
            <div
              className="w-80 rounded-lg bg-white p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-2 text-base font-semibold text-gray-800">
                {t('editor:page.deleteConfirmTitle')}
              </h3>
              <p className="mb-5 text-sm leading-relaxed text-gray-600">
                {t('editor:page.deleteConfirmMsg')}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmOpen(false)}
                  className="rounded border border-gray-200 px-4 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50"
                >
                  {t('editor:page.deleteCancel')}
                </button>
                <button
                  onClick={() => {
                    deletePage(activePage);
                    setConfirmOpen(false);
                  }}
                  disabled={pages.length <= 1}
                  className="rounded bg-red-600 px-4 py-1.5 text-sm text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {t('editor:page.deleteConfirm')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
