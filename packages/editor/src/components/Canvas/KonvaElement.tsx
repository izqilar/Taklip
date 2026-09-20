/**
 * 离屏视频导出用的「非交互」Konva 渲染组件。
 *
 * 与 EditorCanvas 的 renderElement 同源（元素视觉表现一致），但：
 *  - 不挂载任何拖拽 / 选中 / 缩放交互（listening=false）；
 *  - 图片来源由 `images` 注入（预加载好的 HTMLImageElement），不依赖编辑器运行时缓存；
 *  - 复杂组件（calendar/gallery/...）沿用各自的 Canvas<X>.tsx，update 以 no-op 注入。
 *
 * 共享的「图片布局 / 滤镜 / 边框 dash」辅助来自 ./konvaShared，避免重复实现易错细节。
 */
import { Group, Rect, Text, Circle, Line, Image as KonvaImage, Star, RegularPolygon, Ellipse, Arrow as KonvaArrow } from 'react-konva';
import Konva from 'konva';
import type {
  Element,
  ImageElement,
  TextElement,
  RectElement,
  CircleElement,
  StarElement,
  TriangleElement,
  EllipseElement,
  PolygonElement,
  ArrowElement,
  ButtonElement,
  CalendarElement,
  GalleryElement,
  PuzzleElement,
  CountdownElement,
  MapNavElement,
  MessageBoardElement,
  TimelineElement,
  LikeElement,
  WidgetElement,
} from '@h5design/core';
import { toKonvaCornerRadius, normalizeImageClip, drawClipOnContext, hasRealShadow, kashidaForLetterSpacing } from '@h5design/core';
import {
  computeImageLayout,
  FilteredImage,
  ContrastFilter,
  type KonvaFilter,
  mapWordBreakToKonvaWrap,
  borderDashFromStyle,
  dashFromLineStyle,
  toKonvaAlign,
  installTextJustifySupport,
  toKonvaOutlineStrokeWidth,
  TEXT_OUTLINE_LINE_JOIN,
  useFontLoadEpoch,
} from './konvaShared';
import CanvasCalendar from '../../elements/calendar/CanvasCalendar';
import CanvasGallery from '../../elements/gallery/CanvasGallery';
import CanvasPuzzle from '../../elements/puzzle/CanvasPuzzle';
import CanvasCountdown from '../../elements/countdown/CanvasCountdown';
import CanvasMapNav from '../../elements/mapNav/CanvasMapNav';
import CanvasMessageBoard from '../../elements/messageBoard/CanvasMessageBoard';
import CanvasTimeline from '../../elements/timeline/CanvasTimeline';
import CanvasLike from '../../elements/like/CanvasLike';
import CanvasWidget from '../../elements/widget/CanvasWidget';
import KonvaTable from '../../elements/widget/KonvaTable';

type ImagesMap = Map<string, HTMLImageElement | null>;

export interface KonvaElementProps {
  el: Element;
  images: ImagesMap;
  /** 离屏放大系数（如 2.88）。用于把 CSS 单位滤镜（模糊）按输出分辨率等比放大，保持与编辑器一致 */
  scaleK?: number;
  update?: (patch: Partial<Element>) => void;
  /** 字体加载纪元：字体异步加载完成后 +1，拼进文本节点 key 强制 Konva 重建重测折行 */
  fontEpoch?: number;
}

const noop = () => {};

export default function KonvaElement({ el, images, scaleK = 1, update = noop, fontEpoch = 0 }: KonvaElementProps) {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;

  // 非交互共用属性：保留阴影/可见性，关闭监听
  const common = {
    id: el.id,
    x: cx,
    y: cy,
    rotation: el.rotation,
    opacity: el.opacity ?? 1,
    visible: el.visible !== false,
    listening: false,
    shadowColor: hasRealShadow(el) ? el.shadowColor : undefined,
    shadowBlur: el.shadowBlur || 0,
    shadowOffsetX: el.shadowOffsetX || 0,
    shadowOffsetY: el.shadowOffsetY || 0,
    shadowOpacity: typeof el.shadowOpacity === 'number' ? el.shadowOpacity : 1,
  };

  switch (el.type) {
    case 'text': {
      const textEl = el as TextElement;
      const hasBg = textEl.backgroundColor && textEl.backgroundColor !== 'transparent';
      const hasBorder = (textEl.borderWidth || 0) > 0;
      // 轮廓由独立「只描边」层负责（见下方），不再用 fillAfterStrokeEnabled：
      // 那样虽然只留外框，但阴影会在描边后与填充后各投一次，第二次会盖掉部分轮廓。
      const hasTextOutline = (textEl.outlineWidth || 0) > 0 && !!textEl.outlineColor;
      // 阿拉伯文等连写文字：用 kashida 延长符（Tatweel）增加字间距，避免 letterSpacing 直接拆散字母连接。
      const kashida = kashidaForLetterSpacing(textEl.text, textEl.letterSpacing ?? 0, textEl.fontSize ?? 16, true);
      // 背景矩形用的阴影；文本阴影改由独立的阴影剪影层负责
      const textShadow = hasRealShadow(textEl)
        ? {
            shadowColor: textEl.shadowColor,
            shadowBlur: textEl.shadowBlur || 0,
            shadowOffsetX: textEl.shadowOffsetX || 0,
            shadowOffsetY: textEl.shadowOffsetY || 0,
            shadowOpacity: typeof textEl.shadowOpacity === 'number' ? textEl.shadowOpacity : 1,
          }
        : {};
      const outlineStrokeWidth = toKonvaOutlineStrokeWidth(textEl.outlineWidth);
      // 三层（阴影剪影 / 轮廓 / 填充）共用的排版参数，必须逐层一致否则会错位
      const textLayerProps = {
        text: kashida.text,
        fontSize: textEl.fontSize,
        fontFamily: textEl.fontFamily,
        align: toKonvaAlign(textEl.align, textEl.direction === 'rtl' ? 'rtl' : 'ltr'),
        width: el.width,
        height: el.height,
        lineHeight: textEl.lineHeight,
        letterSpacing: kashida.letterSpacing,
        fontStyle: textEl.fontStyle,
        verticalAlign: textEl.verticalAlign,
        wrap: mapWordBreakToKonvaWrap(textEl.wordBreak),
        direction: textEl.direction === 'rtl' ? 'rtl' : 'inherit',
        perfectDrawEnabled: false,
      };
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
          {/* ① 阴影剪影层（最底）：字形 + 轮廓同色加粗 = 贴纸整体剪影，再整体偏移投阴影 */}
          {hasRealShadow(textEl) && (
            <Text
              key={`${el.id}-shadow-${fontEpoch}`}
              {...textLayerProps}
              fill={textEl.shadowColor}
              stroke={hasTextOutline ? textEl.shadowColor : undefined}
              strokeWidth={hasTextOutline ? outlineStrokeWidth : 0}
              lineJoin={TEXT_OUTLINE_LINE_JOIN}
              x={textEl.shadowOffsetX || 0}
              y={textEl.shadowOffsetY || 0}
              opacity={typeof textEl.shadowOpacity === 'number' ? textEl.shadowOpacity : 1}
              shadowColor={textEl.shadowColor}
              shadowBlur={textEl.shadowBlur || 0}
              shadowOpacity={1}
              shadowOffsetX={0}
              shadowOffsetY={0}
              shadowForStrokeEnabled={false}
              listening={false}
              ref={(node) => installTextJustifySupport(node, textEl.align)}
            />
          )}
          {/* ② 轮廓层：只描边不填充 → 外框宽度恒为 outlineWidth，且不会被上层覆盖 */}
          {hasTextOutline && (
            <Text
              key={`${el.id}-outline-${fontEpoch}`}
              {...textLayerProps}
              fill={undefined}
              stroke={textEl.outlineColor}
              strokeWidth={outlineStrokeWidth}
              lineJoin={TEXT_OUTLINE_LINE_JOIN}
              dash={borderDashFromStyle(textEl.outlineStyle)}
              listening={false}
              ref={(node) => installTextJustifySupport(node, textEl.align)}
            />
          )}
          {/* ③ 填充层（最上） */}
          <Text
            key={`${el.id}-fill-${fontEpoch}`}
            {...textLayerProps}
            fill={textEl.fill}
            listening={false}
            ref={(node) => installTextJustifySupport(node, textEl.align)}
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
          x={el.x + circleEl.radius}
          y={el.y + circleEl.radius}
          radius={circleEl.radius}
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
          <Line
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
      const cached = imgEl.src ? images.get(imgEl.src) : undefined;
      const hasBorder = (imgEl.borderWidth || 0) > 0;
      const cornerRadius = toKonvaCornerRadius(imgEl.cornerRadius ?? imgEl.borderRadius);
      const borderColor = imgEl.borderColor || '#000000';
      const borderWidth = imgEl.borderWidth || 0;

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

        const tileScale = isTiled
          ? objectFit === 'repeat-x'
            ? el.height / imgH
            : el.width / imgW
          : 1;

        const filters: KonvaFilter[] = [];
        const brightness = (imgEl.filterBrightness ?? 100) / 100 - 1;
        const contrast = (imgEl.filterContrast ?? 100) / 100;
        // 高分辨率离屏下，按 scaleK 放大模糊半径，保持与编辑器（像素比 1）一致的观感
        const blurRadius = (imgEl.filterBlur ?? 0) * scaleK;
        if (Math.abs(brightness) > 0.001) filters.push(Konva.Filters.Brighten);
        if (Math.abs(contrast - 1) > 0.001) filters.push(ContrastFilter as unknown as KonvaFilter);
        if (blurRadius > 0.001) filters.push(Konva.Filters.Blur);

        const hasShadow = hasRealShadow(imgEl);
        const shadowProps = hasShadow
          ? {
              shadowColor: imgEl.shadowColor,
              shadowBlur: imgEl.shadowBlur || 0,
              shadowOffsetX: imgEl.shadowOffsetX || 0,
              shadowOffsetY: imgEl.shadowOffsetY || 0,
              shadowOpacity: typeof imgEl.shadowOpacity === 'number' ? imgEl.shadowOpacity : 1,
            }
          : {};
        const groupProps = {
          ...common,
          shadowColor: undefined,
          shadowBlur: 0,
          shadowOffsetX: 0,
          shadowOffsetY: 0,
          shadowOpacity: 1,
        };

        const clipShape = normalizeImageClip(imgEl.clip).shape;
        const clipFunc =
          clipShape !== 'none'
            ? (ctx: Konva.Context) => drawClipOnContext(ctx, clipShape, el.width, el.height)
            : undefined;

        return (
          <Group key={el.id} {...groupProps} offsetX={el.width / 2} offsetY={el.height / 2} clipFunc={clipFunc}>
            {hasShadow && (
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
                    cornerRadius={Math.max(0, (Array.isArray(cornerRadius) ? cornerRadius[0] : cornerRadius ? 0 : cornerRadius) - borderWidth / 2)}
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

    case 'button': {
      const btnEl = el as ButtonElement;
      return (
        <Group key={el.id} {...common} offsetX={el.width / 2} offsetY={el.height / 2}>
          <Rect
            width={el.width}
            height={el.height}
            fill={btnEl.fill}
            cornerRadius={btnEl.radius}
            listening={false}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />
          <Text
            width={el.width}
            height={el.height}
            text={btnEl.text}
            fontSize={btnEl.fontSize}
            fontFamily="sans-serif"
            fill={btnEl.color}
            align="center"
            verticalAlign="middle"
            listening={false}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />
        </Group>
      );
    }

    case 'video':
      return (
        <Group key={el.id} {...common} offsetX={el.width / 2} offsetY={el.height / 2}>
          <Rect
            width={el.width}
            height={el.height}
            fill="#1f2937"
            cornerRadius={4}
            listening={false}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />
          <Line
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

    case 'star': {
      const starEl = el as StarElement;
      return (
        <Star
          key={el.id}
          {...common}
          x={el.x + el.width / 2}
          y={el.y + el.height / 2}
          numPoints={starEl.points ?? 5}
          innerRadius={el.width / 4}
          outerRadius={el.width / 2}
          fill={el.fill}
          stroke={el.stroke}
          strokeWidth={el.strokeWidth ?? 0}
          perfectDrawEnabled={false}
          shadowForStrokeEnabled={false}
        />
      );
    }

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
      return <CanvasGallery key={el.id} el={el as GalleryElement} common={common} update={update} />;

    case 'puzzle':
      return <CanvasPuzzle key={el.id} el={el as PuzzleElement} common={common} update={update} />;

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

    case 'widget': {
      const wEl = el as WidgetElement;
      if (wEl.widget === 'table') {
        return <KonvaTable key={el.id} el={wEl} common={common} />;
      }
      return <CanvasWidget key={el.id} el={wEl} common={common} />;
    }

    default:
      return null;
  }
}
