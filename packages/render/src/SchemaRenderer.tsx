/**
 * SchemaRenderer — 将 JSON Schema 渲染为 DOM + CSS（发布态）。
 * 框架无关的纯 React 渲染器，供 Web 端、运营端、微信小程序（web-view）共用，保证「设计一次，三端一致」。
 *
 * 动画解耦：元素入场/循环动画通过可选的 `animationPlayer` 注入（默认 no-op）。
 * 共享包本身不依赖 GSAP；Web 端把自己的 playElementAnimation 注入进来即可。
 * 缩略图场景传入 animated=false，直接跳过播放逻辑。
 *
 * 迁移自 apps/web/src/components/Preview/DOMRenderer.tsx（DOMRenderer）。
 */
import { useState, useRef, useEffect, type CSSProperties, type ReactNode, type SyntheticEvent } from 'react';
import type {
  Element,
  Page,
  Project,
  AnimationConfig,
  TextElement,
  RectElement,
  CircleElement,
  ImageElement,
  PolygonElement,
  ArrowElement,
  VideoElement,
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
import { cornerRadiusToCss, normalizeCornerRadius, buildClipSvgPath, normalizeImageClip, resolveShadow, resolveShadowColor, hasRealShadow, subscribeFontLoad } from '@h5design/core';
import { clearTextMeasureCache } from './lib/textLayout';
import { safeLink, safeMedia, safeBackgroundImage } from './lib/sanitize';
import {
  layoutText,
  mapWordBreakToKonvaWrap,
  resolveLineOffset,
  resolveVerticalOffset,
} from './lib/textLayout';
import { resolveExternalVideo } from './lib/externalVideo';
import { rgbaToCss, parseCssColor } from './lib/color';
import DOMCalendar from './elements/calendar/DOMCalendar';
import DOMGallery from './elements/gallery/DOMGallery';
import DOMPuzzle from './elements/puzzle/DOMPuzzle';
import DOMCountdown from './elements/countdown/DOMCountdown';
import DOMMapNav from './elements/mapNav/DOMMapNav';
import DOMMessageBoard from './elements/messageBoard/DOMMessageBoard';
import DOMTimeline from './elements/timeline/DOMTimeline';
import DOMLike from './elements/like/DOMLike';
import DOMWidget from './elements/widget/DOMWidget';
import MusicPlayer from './components/Preview/MusicPlayer';

/** 动画播放器注入签名：给定 DOM 节点与元素动画配置，返回可选的清理函数。 */
export type AnimationPlayer = (
  el: HTMLElement,
  config: AnimationConfig | undefined,
) => void | (() => void) | null;

/** 默认 no-op：不播放任何动画（缩略图 / 未注入时）。 */
const noopPlayer: AnimationPlayer = () => undefined;

/** 生成 n 角星的 SVG polygon 点集 */
function starPoints(w: number, h: number, n: number): string {
  const cx = w / 2;
  const cy = h / 2;
  const outer = Math.min(w, h) / 2;
  const inner = outer / 2;
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const ang = -Math.PI / 2 + (i * Math.PI) / n;
    pts.push(`${(cx + r * Math.cos(ang)).toFixed(1)},${(cy + r * Math.sin(ang)).toFixed(1)}`);
  }
  return pts.join(' ');
}

/** 把统一的 borderStyle 转为 CSS border-style 字符串；双线用 double */
function cssBorderStyle(style?: string): 'solid' | 'dashed' | 'dotted' | 'double' | 'none' {
  switch (style) {
    case 'dashed':
      return 'dashed';
    case 'dotted':
      return 'dotted';
    case 'double':
      return 'double';
    case 'solid':
      return 'solid';
    default:
      return 'solid';
  }
}

/**
 * 图片元素视图（发布态）。
 * 用 onLoad 拿到真实 naturalWidth/Height 后再做裁剪换算，
 * 保证即便元素未落库 naturalWidth，裁剪也基于真实像素，所见即所得。
 */
function ImageElementView({
  el,
  commonStyle,
  dataAttrs,
}: {
  el: ImageElement;
  commonStyle: CSSProperties;
  dataAttrs: Record<string, string>;
}) {
  const [natural, setNatural] = useState<{ w: number; h: number }>({
    w: el.naturalWidth || el.width,
    h: el.naturalHeight || el.height,
  });

  // 元素数据变化时重置 fallback，避免旧 natural 残留
  useEffect(() => {
    setNatural({
      w: el.naturalWidth || el.width,
      h: el.naturalHeight || el.height,
    });
  }, [el.src, el.naturalWidth, el.naturalHeight, el.width, el.height]);

  const hasBorder = (el.borderWidth || 0) > 0;
  const filterParts: string[] = [];
  if ((el.filterBrightness ?? 100) !== 100) filterParts.push(`brightness(${el.filterBrightness}%)`);
  if ((el.filterContrast ?? 100) !== 100) filterParts.push(`contrast(${el.filterContrast}%)`);
  if ((el.filterBlur ?? 0) > 0) filterParts.push(`blur(${el.filterBlur}px)`);
  const cr = normalizeCornerRadius(el.cornerRadius ?? el.borderRadius);
  const cornerRadiusSum = cr.topLeft + cr.topRight + cr.bottomRight + cr.bottomLeft;
  const clipShape = normalizeImageClip(el.clip).shape;
  const clipPath = clipShape !== 'none' ? `path("${buildClipSvgPath(clipShape, el.width, el.height)}")` : undefined;

  const placeholderStyle: CSSProperties = {
    ...commonStyle,
    backgroundColor: '#f0f0f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#999',
    fontSize: 14,
    border: hasBorder
      ? `${el.borderWidth}px ${cssBorderStyle(el.borderStyle)} ${el.borderColor || '#000000'}`
      : undefined,
    borderRadius: cornerRadiusSum > 0 ? cornerRadiusToCss(cr) : undefined,
    clipPath,
    overflow: 'hidden',
    filter: filterParts.length ? filterParts.join(' ') : undefined,
  };

  if (!el.src) {
    return (
      <div key={el.id} {...dataAttrs} style={placeholderStyle}>
        Image
      </div>
    );
  }

  const imgSrc = safeMedia(el.src);
  // safeMedia 可能把非图片 dataURL（如 data:text/html）过滤为空，此时仍渲染 <img src=""> 会让
  // html-to-image 内部 fetch 当前页面 HTML 并当作图片 src，触发 onImageErrorHandler 且图片框空白。
  if (!imgSrc) {
    return (
      <div key={el.id} {...dataAttrs} style={placeholderStyle}>
        Image
      </div>
    );
  }
  const objectFit = el.objectFit ?? 'cover';
  const isTiled = objectFit === 'repeat-x' || objectFit === 'repeat-y';

  const wrapperStyle: CSSProperties = {
    ...commonStyle,
    border: hasBorder
      ? `${el.borderWidth}px ${cssBorderStyle(el.borderStyle)} ${el.borderColor || '#000000'}`
      : undefined,
    borderRadius: cornerRadiusSum > 0 ? cornerRadiusToCss(cr) : undefined,
    clipPath,
    overflow: 'hidden',
    filter: filterParts.length ? filterParts.join(' ') : undefined,
  };

  const handleLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    const iw = e.currentTarget.naturalWidth;
    const ih = e.currentTarget.naturalHeight;
    if (iw && ih) setNatural({ w: iw, h: ih });
  };

  // 平铺模式：直接用背景图
  if (isTiled) {
    return (
      <div key={el.id} {...dataAttrs} style={wrapperStyle}>
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundImage: `url(${imgSrc})`,
            backgroundRepeat: objectFit as 'repeat-x' | 'repeat-y',
            backgroundSize: objectFit === 'repeat-x' ? 'auto 100%' : '100% auto',
          }}
        />
      </div>
    );
  }

  // 按编辑态 computeImageLayout 的语义计算：源图裁剪区 + 显示窗口
  const naturalW = natural.w || el.width;
  const naturalH = natural.h || el.height;
  const userCrop = el.clip?.crop;
  const srcX = userCrop ? naturalW * userCrop.x : 0;
  const srcY = userCrop ? naturalH * userCrop.y : 0;
  const srcW = userCrop ? naturalW * userCrop.width : naturalW;
  const srcH = userCrop ? naturalH * userCrop.height : naturalH;

  let cropX = srcX;
  let cropY = srcY;
  let cropW = srcW;
  let cropH = srcH;
  let displayX = 0;
  let displayY = 0;
  let displayW = el.width;
  let displayH = el.height;
  let scale = 1;

  if (objectFit === 'contain') {
    scale = Math.min(el.width / srcW, el.height / srcH) || 1;
    displayW = srcW * scale;
    displayH = srcH * scale;
    displayX = (el.width - displayW) / 2;
    displayY = (el.height - displayH) / 2;
  } else {
    // cover（默认）
    const elRatio = el.width / el.height;
    const cropRatio = srcW / srcH;
    if (cropRatio > elRatio) {
      cropW = srcH * elRatio;
      cropX = srcX + (srcW - cropW) / 2;
    } else {
      cropH = srcW / elRatio;
      cropY = srcY + (srcH - cropH) / 2;
    }
    scale = (cropW > 0 ? el.width / cropW : 1) || 1;
  }

  const frameStyle: CSSProperties = {
    position: 'absolute',
    left: displayX,
    top: displayY,
    width: displayW,
    height: displayH,
    overflow: 'hidden',
  };

  const imgStyle: CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    width: naturalW * scale,
    height: naturalH * scale,
    marginLeft: -cropX * scale,
    marginTop: -cropY * scale,
    // 关键：必须用 fill 让 <img> 内容缩放到我们手工算出的框（naturalW*scale × naturalH*scale），
    // 再配合负 margin 偏移，使源图指定区域精确映射到元素框，与 Konva.Image.crop 语义完全一致。
    // 不能用 object-fit:none —— none 会保留图片固有尺寸、不做缩放，导致只露出左上角局部、内容错位。
    objectFit: 'fill',
  };

  return (
    <div key={el.id} {...dataAttrs} style={wrapperStyle}>
      <div style={frameStyle}>
        <img
          src={imgSrc}
          alt={el.name ?? ''}
          crossOrigin="anonymous"
          decoding="sync"
          onLoad={handleLoad}
          style={imgStyle}
        />
      </div>
    </div>
  );
}

/**
 * 文本元素视图（发布态）。
 *
 * 关键：不使用 CSS 的自动换行/裁剪，而是用 `layoutText()` 复刻 Konva.Text 的排版，
 * 再按行绝对定位渲染。原因见 lib/textLayout.ts 顶部注释：
 *  - CSS letter-spacing 含尾部间距 → 换行阈值与居中偏移都与 Konva 不同；
 *  - Konva 不裁剪溢出、且高度不足时丢弃后续行 → 必须由我们自己控制。
 * 这样编辑器画布与页面展示才能逐像素一致。
 */
function TextElementView({
  el,
  commonStyle,
  dataAttrs,
  shadowCss,
}: {
  el: TextElement;
  commonStyle: CSSProperties;
  dataAttrs: Record<string, string>;
  shadowCss?: string;
}) {
  // 自定义字体异步加载完成后重新排版（加载前 measureText 用的是回退字体，宽度会有偏差）
  const [fontEpoch, setFontEpoch] = useState(0);
  useEffect(() => {
    const fonts = typeof document !== 'undefined'
      ? (document as Document & { fonts?: FontFaceSet }).fonts
      : undefined;
    if (!fonts) return;
    let alive = true;
    const bump = () => {
      if (alive) setFontEpoch((v) => v + 1);
    };
    // bump 前必须先清空文本测量缓存：缓存里可能还留着「回退字体」量出的宽度，
    // 不清的话重排版依旧用错误度量（这正是列表缩略图排版错乱的根因之一）。
    const bumpWithCacheClear = () => {
      clearTextMeasureCache();
      bump();
    };
    fonts.ready.then(bump).catch(() => undefined);
    // ⚠️ `fonts.ready` 是一次性 Promise：若字体在本组件挂载**之后**才被 FontFace
    // 动态注册（发布页 / 导出渲染页都是这样），它已经 resolve 过了，不会再触发重排
    // → 文本会一直保持回退字体的宽度。
    if (typeof fonts.addEventListener === 'function') {
      fonts.addEventListener('loadingdone', bump);
    }
    // ⚠️ 实测：`new FontFace().load()` 若发生在 face 被 add 进 FontFaceSet 之前
    // （core.ensureFont 的历史实现），**任何** loading / loadingdone 事件都不会派发，
    // 上面两条监听都会失效 → 排版永久停留在回退字体度量（折行错位 / 固定高度丢行）。
    // 因此订阅 core 的确定性加载通知，作为最终兜底：字体一到位立刻清缓存 + 重排版。
    const unsubscribeFontLoad = subscribeFontLoad(bumpWithCacheClear);
    return () => {
      alive = false;
      if (typeof fonts.removeEventListener === 'function') {
        fonts.removeEventListener('loadingdone', bump);
      }
      unsubscribeFontLoad();
    };
  }, []);

  const hasBorder = (el.borderWidth || 0) > 0;
  const hasBg = !!el.backgroundColor && el.backgroundColor !== 'transparent';

  const fontStyleRaw = el.fontStyle ?? '';
  const layout = (() => {
    // fontEpoch 仅用于在字体加载后触发重算（依赖显式列出以满足 exhaustive-deps 语义）
    void fontEpoch;
    return layoutText({
      text: el.text ?? '',
      fontSize: el.fontSize || 16,
      fontFamily: el.fontFamily,
      bold: fontStyleRaw.includes('bold'),
      italic: fontStyleRaw.includes('italic'),
      letterSpacing: el.letterSpacing ?? 0,
      lineHeight: el.lineHeight ?? 1,
      width: el.width,
      height: el.height,
      wrap: mapWordBreakToKonvaWrap(el.wordBreak),
    });
  })();

  const { lineHeightPx } = layout;
  const blockTop = resolveVerticalOffset(layout.contentHeight, el.height, el.verticalAlign);

  // 书写方向：rtl 让阿拉伯文等从右向左排版（与编辑器 Konva 画布靠 canvas bidi 对齐）
  const dir: 'ltr' | 'rtl' = el.direction === 'rtl' ? 'rtl' : 'ltr';
  // 两端对齐 / 分散对齐（与编辑器画布、Konva 保持一致）：
  //  - justify     ：除每段末行外拉伸铺满，末行按书写方向回退（LTR→左，RTL→右）
  //  - justify-all ：所有行（含末行）强制两端对齐
  const isJustify = el.align === 'justify' || el.align === 'justify-all';
  // 非拉伸行的回退对齐：RTL 时镜像 left↔right（与面板内容框 CSS start 对齐、画布 toKonvaAlign 一致）；
  // justify 回退值已是 rtl→right，不可再镜像
  const fallbackAlign = isJustify
    ? dir === 'rtl'
      ? 'right'
      : 'left'
    : dir === 'rtl'
      ? el.align === 'right'
        ? 'left'
        : el.align === 'center'
          ? 'center'
          : 'right'
      : el.align;
  // 文本轮廓：outlineWidth>0 且指定了颜色才绘制
  const outlineWidth = el.outlineWidth || 0;
  const hasOutline = outlineWidth > 0 && !!el.outlineColor;
  // 线性：dashed/dotted 用遮罩在「轮廓层」上模拟（填充层不受影响）
  const outlineMask =
    el.outlineStyle === 'dashed'
      ? 'repeating-linear-gradient(90deg, #000 0 6px, transparent 6px 10px)'
      : el.outlineStyle === 'dotted'
        ? 'repeating-linear-gradient(90deg, #000 0 2px, transparent 2px 5px)'
        : undefined;

  // 字形基础样式（字体相关，描边层与填充层共用）
  const glyphStyle: CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    height: lineHeightPx,
    lineHeight: `${lineHeightPx}px`,
    whiteSpace: 'pre',
    fontSize: el.fontSize,
    fontFamily: el.fontFamily,
    fontStyle: fontStyleRaw.includes('italic') ? 'italic' : 'normal',
    fontWeight: fontStyleRaw.includes('bold') ? 'bold' : 'normal',
    letterSpacing: layout.letterSpacing ? `${layout.letterSpacing}px` : undefined,
    textDecoration: el.textDecoration,
  };

  return (
    <div
      key={el.id}
      {...dataAttrs}
      style={{
        ...commonStyle,
        boxShadow: hasBg ? shadowCss : undefined,
        // 文本自身阴影不再用 text-shadow（见下方 drop-shadow 包裹层）：
        // text-shadow 由每个 span 各自绘制，填充层的阴影会盖住轮廓层的描边，
        // 导致「轮廓有的地方有、有的地方没有」。
        backgroundColor: hasBg ? el.backgroundColor : 'transparent',
        border: hasBorder
          ? `${el.borderWidth}px ${cssBorderStyle(el.borderStyle)} ${el.borderColor || '#000000'}`
          : undefined,
        borderRadius: hasBorder || hasBg ? el.borderRadius || 0 : undefined,
        // 必须可见：Konva 不裁剪溢出文本，加了 hidden 会把首/末字符切掉
        overflow: 'visible',
        direction: dir,
      }}
    >
        {/* 阴影：对整个「轮廓层 + 填充层」的合成剪影做 drop-shadow
            （等价编辑器 Konva 中阴影由描边+填充的并集剪影投出）。
            drop-shadow 永远画在整层内容之下，因此轮廓描边不会再被阴影覆盖。 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            filter: shadowCss ? `drop-shadow(${shadowCss})` : undefined,
          }}
        >
          {layout.lines.map((ln, i) => {
            // 该行是否拉伸铺满：分散对齐全部拉伸；两端对齐仅「非段落末行」拉伸
            const stretched = isJustify && (el.align === 'justify-all' || !ln.lastInParagraph);
            // 拉伸行：行盒占满元素宽，由 text-align / text-align-last 均摊空格（等价 CSS justify，
            // 且 RTL 由浏览器原生 bidi 处理）；非拉伸行：按书写方向回退，宽度取实际行宽
            const glyph = stretched
              ? {
                  ...glyphStyle,
                  display: 'block',
                  width: '100%',
                  textAlign: 'justify' as const,
                  textAlignLast: 'justify' as const,
                }
              : glyphStyle;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: stretched ? 0 : resolveLineOffset(ln.width, el.width, fallbackAlign),
                  top: blockTop + i * lineHeightPx,
                  width: stretched ? el.width : ln.width,
                  height: lineHeightPx,
                  direction: dir,
                }}
              >
                {hasOutline && (
                  <span
                    style={{
                      ...glyph,
                      color: 'transparent',
                      // 描边居中绘制，只有外侧一半可见；×2 后外框宽度才等于用户设定的 outlineWidth，
                      // 与编辑器 Konva（toKonvaOutlineStrokeWidth 同样传 2×）保持一致。
                      WebkitTextStroke: `${outlineWidth * 2}px ${el.outlineColor}`,
                      ...(outlineMask ? { WebkitMaskImage: outlineMask, maskImage: outlineMask } : null),
                    }}
                  >
                    {ln.text}
                  </span>
                )}
                <span style={{ ...glyph, color: el.fill }}>{ln.text}</span>
              </div>
            );
          })}
        </div>
    </div>
  );
}

function renderElement(el: Element): ReactNode {
  // 防御：单个元素数据缺失/畸形时跳过，避免整页渲染崩溃
  if (!el || typeof el !== 'object' || !el.type || el.visible === false) return null;
  // 阴影是否存在以「真实非透明阴影」为准（与编辑器 Konva _hasShadow 一致）：
  // shadowColor 为 transparent / none、shadowOpacity<=0、或 blur+offset 全为 0 时均无阴影。
  // 这样设计稿里「阴影色 100% 透明」的元素在发布页/导出页与编辑器一致——不渲染任何阴影，
  // 而非被误当成黑色阴影画出来。
  const hasShadow = hasRealShadow(el);
  const shadowCss = resolveShadow(el);
  const commonStyle: CSSProperties = {
    position: 'absolute',
    left: el.x,
    top: el.y,
    width: el.width,
    height: el.height,
    transform: `rotate(${el.rotation}deg)`,
    opacity: el.opacity,
    zIndex: el.zIndex,
    boxSizing: 'border-box',
    boxShadow: shadowCss,
  };

  const dataAttrs = {
    'data-element-id': el.id,
    'data-has-animation': el.animation ? 'true' : 'false',
  };

  // 形状对象在编辑态（Konva）下，阴影是「与形状同形、偏移、模糊」的一层，
  // 半透填充会把它透出来；CSS box-shadow 永远绘制在元素盒子背后，不会透到填充上。
  // 因此对有阴影的形状，用 wrapper + 独立 shadow layer 来模拟 Konva 的阴影模型。
  // shadowLayerColor 同样走 resolveShadowColor（透明色 → undefined，与 hasShadow 一致）。
  const shadowLayerColor = resolveShadowColor(el);
  const wrapperStyle: CSSProperties = {
    position: 'absolute',
    left: el.x,
    top: el.y,
    width: el.width,
    height: el.height,
    transform: `rotate(${el.rotation}deg)`,
    zIndex: el.zIndex,
    boxSizing: 'border-box',
  };
  const renderShape = (innerStyle: CSSProperties, wrapperOverride?: Partial<CSSProperties>): ReactNode => {
    const ws = wrapperOverride ? { ...wrapperStyle, ...wrapperOverride } : wrapperStyle;
    if (!hasShadow) {
      return <div key={el.id} {...dataAttrs} style={{ ...commonStyle, ...innerStyle, ...wrapperOverride }} />;
    }
    return (
      <div key={el.id} {...dataAttrs} style={ws}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            borderRadius: innerStyle.borderRadius,
            backgroundColor: shadowLayerColor,
            transform: `translate(${el.shadowOffsetX || 0}px, ${el.shadowOffsetY || 0}px)`,
            filter: `blur(${el.shadowBlur || 0}px)`,
            opacity: el.opacity,
            zIndex: 0,
          }}
        />
        <div
          style={{
            ...innerStyle,
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            opacity: el.opacity,
            zIndex: 1,
          }}
        />
      </div>
    );
  };

  switch (el.type) {
    case 'text': {
      const textEl = el as TextElement;
      // 编辑态：文本三层（阴影剪影 / 轮廓描边 / 字形填充）自下而上叠放，背景 Rect 单独投 boxShadow。
      // 预览态需还原为一致效果：
      //  - 文本阴影用包裹层的 drop-shadow（对整个贴纸剪影投影，且永远在内容之下）；
      //  - 仅当存在背景时，容器才加 box-shadow（编辑器背景 Rect 的阴影）。
      //    无背景时容器不设 box-shadow，否则会在文本框外圈多出一圈方块阴影，与编辑态不符。
      return (
        // key 必须挂在 map 直接返回的这个组件上；挂在 TextElementView 内部的 div 上是无效的
        // （组件元素认的是自身 props.key），会导致 React "unique key" 警告。
        <TextElementView
          key={el.id}
          el={textEl}
          commonStyle={commonStyle}
          dataAttrs={dataAttrs}
          shadowCss={shadowCss}
        />
      );
    }

    case 'rect': {
      const rectEl = el as RectElement;
      const hasBorder = (rectEl.borderWidth || 0) > 0;
      return renderShape({
        backgroundColor: el.fill,
        border: hasBorder
          ? `${rectEl.borderWidth}px solid ${rectEl.borderColor || '#000000'}`
          : el.stroke
            ? `${el.strokeWidth ?? 1}px solid ${el.stroke}`
            : undefined,
        borderRadius: cornerRadiusToCss(rectEl.cornerRadius ?? rectEl.borderRadius),
      });
    }

    case 'circle': {
      const circleEl = el as CircleElement;
      // 编辑态 Konva Circle 以 radius 为视觉大小基准（圆心在 x+radius, y+radius），
      // 预览态需与之对齐，而不是用默认的 width/height（可能与 radius 不一致）。
      const diameter = circleEl.radius ? circleEl.radius * 2 : el.width;
      return renderShape(
        {
          backgroundColor: el.fill,
          borderRadius: '50%',
        },
        { width: diameter, height: diameter },
      );
    }

    case 'image':
      // key 必须在 map 直接返回的组件上（见 case 'text' 的说明）
      return (
        <ImageElementView
          key={el.id}
          el={el as ImageElement}
          commonStyle={commonStyle}
          dataAttrs={dataAttrs}
        />
      );

    case 'line':
      // 与编辑器 KonvaElement 的 line 分支保持一致：编辑器**忽略** schema 里的 points，
      // 永远按元素宽度画一条水平线（`points={[0, 0, el.width, 0]}`）。
      // 此前按 points（可能是创建时的残留值，比 width 短）绘制，导致页面上的线条
      // 比编辑器里短一截（右侧丢失近 1/3）。
      return (
        <svg
          key={el.id}
          {...dataAttrs}
          style={{
            ...commonStyle,
            overflow: 'visible',
          }}
          width={el.width}
          height={el.height}
        >
          <line
            x1={0}
            y1={0}
            x2={el.width}
            y2={0}
            stroke={el.stroke}
            strokeWidth={el.strokeWidth}
            strokeDasharray={svgDashFromLineStyle(el.lineStyle)}
          />
        </svg>
      );

    case 'button': {
      const style: CSSProperties = {
        ...commonStyle,
        backgroundColor: el.fill,
        color: el.color,
        borderRadius: el.radius,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: el.fontSize,
        textAlign: 'center',
        fontWeight: 500,
        padding: 4,
        overflow: 'hidden',
        textDecoration: 'none',
        cursor: el.link ? 'pointer' : 'default',
      };
      const href = safeLink(el.link);
      if (href) {
        return (
          <a
            key={el.id}
            {...dataAttrs}
            href={href}
            target="_blank"
            rel="noreferrer"
            style={style}
          >
            {el.text}
          </a>
        );
      }
      return (
        <div key={el.id} {...dataAttrs} style={style}>
          {el.text}
        </div>
      );
    }

    case 'video': {
      const resolved = resolveExternalVideo(el as VideoElement);
      if (resolved.kind === 'none') {
        return (
          <div
            key={el.id}
            {...dataAttrs}
            style={{
              ...commonStyle,
              backgroundColor: '#1f2937',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 24,
            }}
          >
            ▶
          </div>
        );
      }
      if (resolved.kind === 'video') {
        return (
          <div key={el.id} {...dataAttrs} style={commonStyle}>
            <video
              src={resolved.src}
              poster={resolved.poster ? safeMedia(resolved.poster) : undefined}
              autoPlay={resolved.autoplay}
              muted={resolved.muted}
              loop={resolved.loop}
              controls
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: el.radius || 0,
                display: 'block',
              }}
            />
          </div>
        );
      }
      // embed（iframe 嵌入代码 / 平台分享链接转换）
      return (
        <div key={el.id} {...dataAttrs} style={commonStyle}>
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: el.radius || 0,
              overflow: 'hidden',
            }}
            dangerouslySetInnerHTML={{ __html: resolved.html }}
          />
        </div>
      );
    }

    case 'star': {
      const pts = starPoints(el.width, el.height, el.points ?? 5);
      return (
        <svg
          key={el.id}
          {...dataAttrs}
          style={{ ...commonStyle, overflow: 'visible' }}
          width={el.width}
          height={el.height}
        >
          <polygon
            points={pts}
            fill={el.fill}
            stroke={el.stroke}
            strokeWidth={el.strokeWidth ?? 0}
            strokeDasharray={svgDashFromLineStyle(el.lineStyle)}
          />
        </svg>
      );
    }

    case 'triangle': {
      const pts = `${el.width / 2},0 ${el.width},${el.height} 0,${el.height}`;
      return (
        <svg
          key={el.id}
          {...dataAttrs}
          style={{ ...commonStyle, overflow: 'visible' }}
          width={el.width}
          height={el.height}
        >
          <polygon
            points={pts}
            fill={el.fill}
            stroke={el.stroke}
            strokeWidth={el.strokeWidth ?? 0}
            strokeDasharray={svgDashFromLineStyle(el.lineStyle)}
          />
        </svg>
      );
    }

    case 'ellipse':
      return renderShape({
        backgroundColor: el.fill,
        border: el.stroke
          ? `${el.strokeWidth ?? 1}px solid ${el.stroke}`
          : undefined,
        borderRadius: '50%',
      });

    case 'polygon': {
      const polyEl = el as PolygonElement;
      const polyPts = regularPolygonPoints(el.width, el.height, polyEl.sides ?? 5);
      return (
        <svg
          key={el.id}
          {...dataAttrs}
          style={{ ...commonStyle, overflow: 'visible' }}
          width={el.width}
          height={el.height}
        >
          <polygon
            points={polyPts}
            fill={el.fill}
            stroke={el.stroke}
            strokeWidth={el.strokeWidth ?? 0}
            strokeDasharray={svgDashFromLineStyle(el.lineStyle)}
          />
        </svg>
      );
    }

    case 'arrow': {
      const arrowEl = el as ArrowElement;
      const size = arrowEl.arrowSize ?? 16;
      const markerId = `arrow-${el.id}`;
      const markerStartId = `arrow-start-${el.id}`;
      const showEnd = arrowEl.arrowType === 'end' || arrowEl.arrowType === 'both' || arrowEl.arrowType === undefined;
      const showStart = arrowEl.arrowType === 'start' || arrowEl.arrowType === 'both';
      return (
        <svg
          key={el.id}
          {...dataAttrs}
          style={{ ...commonStyle, overflow: 'visible' }}
          width={el.width}
          height={el.height}
        >
          <defs>
            {showEnd && (
              <marker id={markerId} markerWidth={size} markerHeight={size} refX={size - 2} refY={size / 2} orient="auto" markerUnits="strokeWidth">
                <path d={`M0,0 L${size},${size / 2} L0,${size} z`} fill={el.stroke} />
              </marker>
            )}
            {showStart && (
              <marker id={markerStartId} markerWidth={size} markerHeight={size} refX={2} refY={size / 2} orient="auto" markerUnits="strokeWidth">
                <path d={`M${size},0 L0,${size / 2} L${size},${size} z`} fill={el.stroke} />
              </marker>
            )}
          </defs>
          <line
            x1={showStart ? size : 0}
            y1={el.height / 2}
            x2={showEnd ? el.width - size : el.width}
            y2={el.height / 2}
            stroke={el.stroke}
            strokeWidth={el.strokeWidth}
            strokeDasharray={svgDashFromLineStyle(el.lineStyle)}
            markerEnd={showEnd ? `url(#${markerId})` : undefined}
            markerStart={showStart ? `url(#${markerStartId})` : undefined}
          />
        </svg>
      );
    }

    case 'calendar': {
      const calEl = el as CalendarElement;
      return <DOMCalendar key={el.id} el={calEl} style={commonStyle} dataAttrs={dataAttrs} />;
    }

    case 'gallery': {
      const galleryEl = el as GalleryElement;
      return <DOMGallery key={el.id} el={galleryEl} style={commonStyle} dataAttrs={dataAttrs} />;
    }

    case 'puzzle': {
      const puzzleEl = el as PuzzleElement;
      return <DOMPuzzle key={el.id} el={puzzleEl} style={commonStyle} dataAttrs={dataAttrs} />;
    }

    case 'countdown': {
      const countdownEl = el as CountdownElement;
      return <DOMCountdown key={el.id} el={countdownEl} style={commonStyle} dataAttrs={dataAttrs} />;
    }

    case 'mapNav': {
      const mapNavEl = el as MapNavElement;
      return <DOMMapNav key={el.id} el={mapNavEl} style={commonStyle} dataAttrs={dataAttrs} />;
    }

    case 'messageBoard': {
      const messageBoardEl = el as MessageBoardElement;
      return <DOMMessageBoard key={el.id} el={messageBoardEl} style={commonStyle} dataAttrs={dataAttrs} />;
    }

    case 'timeline': {
      const timelineEl = el as TimelineElement;
      return <DOMTimeline key={el.id} el={timelineEl} style={commonStyle} dataAttrs={dataAttrs} />;
    }

    case 'like': {
      const likeEl = el as LikeElement;
      return <DOMLike key={el.id} el={likeEl} style={commonStyle} dataAttrs={dataAttrs} />;
    }

    case 'widget': {
      const widgetEl = el as WidgetElement;
      return <DOMWidget key={el.id} el={widgetEl} style={commonStyle} dataAttrs={dataAttrs} />;
    }

    default:
      return null;
  }
}

function svgDashFromLineStyle(lineStyle?: string): string | undefined {
  switch (lineStyle) {
    case 'dashed':
      return '6,4';
    case 'dotted':
      return '2,4';
    default:
      return undefined;
  }
}

function regularPolygonPoints(w: number, h: number, sides: number): string {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) / 2;
  const pts: string[] = [];
  for (let i = 0; i < sides; i++) {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
    pts.push(`${(cx + r * Math.cos(ang)).toFixed(1)},${(cy + r * Math.sin(ang)).toFixed(1)}`);
  }
  return pts.join(' ');
}

interface AnimatedPageProps {
  page: Page;
  width: number;
  height: number;
  animated?: boolean;
  animationPlayer?: AnimationPlayer;
}

/** 带动画的页面渲染器（animated=false 时只做静态渲染，不播放入场动画） */
function AnimatedPage({ page, width, height, animated = true, animationPlayer = noopPlayer }: AnimatedPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!animated) return;

    const container = containerRef.current;
    if (!container) return;

    const cleanups: (() => void)[] = [];

    // Find all elements with animation
    const animatedEls = container.querySelectorAll('[data-has-animation="true"]');
    animatedEls.forEach((domEl) => {
      const elId = domEl.getAttribute('data-element-id');
      if (!elId) return;

      const schemaEl = page.elements.find((e) => e.id === elId);
      if (!schemaEl?.animation) return;

      const cleanup = animationPlayer(domEl as HTMLElement, schemaEl.animation);
      if (cleanup) cleanups.push(cleanup);
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, animationPlayer]);

  if (!page || !Array.isArray(page.elements)) {
    // 页面数据缺失时不渲染内容，避免崩溃
    return (
      <div
        ref={containerRef}
        key={page?.id ?? 'page'}
        style={{ position: 'relative', width, height, overflow: 'hidden' }}
      />
    );
  }

  // 背景图需要单独透明度时，独立成一层渲染：
  // 否则 CSS opacity 会连同背景色一起变淡（背景图与背景色原本挂在同一容器上）。
  const bgOpacity = page.backgroundImageOpacity;
  const useSeparateBgImageLayer =
    !!page.backgroundImage && bgOpacity != null && bgOpacity < 1;

  return (
    <div
      ref={containerRef}
      key={page.id}
      style={{
        position: 'relative',
        width,
        height,
        // 强制本容器成为独立层叠上下文，使任意 z-index（含 0）的元素
        // 始终绘制在页面背景之上，避免「置底」对象被背景盖住。
        isolation: 'isolate',
        // 页面未设置背景色时默认纯白，避免导出图片/视频出现透明底
        backgroundColor: page.background ? rgbaToCss(parseCssColor(page.background)) : '#ffffff',
        backgroundImage:
          page.backgroundImage && !useSeparateBgImageLayer
            ? safeBackgroundImage(page.backgroundImage)
            : undefined,
        backgroundSize: page.backgroundSize ?? 'contain',
        backgroundRepeat: page.backgroundRepeat ?? 'no-repeat',
        backgroundPosition: 'center',
        overflow: 'hidden',
      }}
    >
      {/* 背景图独立层：位于背景色之上、内容元素之下（首个绝对定位子节点，DOM 序靠前） */}
      {useSeparateBgImageLayer && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            opacity: bgOpacity,
            backgroundImage: safeBackgroundImage(page.backgroundImage as string),
            backgroundSize: page.backgroundSize ?? 'contain',
            backgroundRepeat: page.backgroundRepeat ?? 'no-repeat',
            backgroundPosition: 'center',
          }}
        />
      )}
      {page.elements
        .filter((e) => e && e.visible !== false)
        .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
        .map((el) => renderElement(el))}
    </div>
  );
}

function renderPage(page: Page, width: number, height: number, animated = true, animationPlayer: AnimationPlayer = noopPlayer): React.ReactNode {
  return (
    <AnimatedPage page={page} width={width} height={height} animated={animated} animationPlayer={animationPlayer} />
  );
}

export interface SchemaRendererProps {
  project: Project;
  currentPage?: number;
  scale?: number;
  animated?: boolean;
  /** 可选注入的动画播放器（Web 端注入 GSAP 驱动的 playElementAnimation；缺省不播放）。 */
  animationPlayer?: AnimationPlayer;
}

export default function SchemaRenderer({
  project,
  currentPage = 0,
  scale = 1,
  animated = true,
  animationPlayer = noopPlayer,
}: SchemaRendererProps) {
  const pages = Array.isArray(project.pages) ? project.pages : [];
  const page = pages[currentPage] ?? pages[0];

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
      }}
    >
      {page ? renderPage(page, project.width ?? 375, project.height ?? 667, animated, animationPlayer) : null}
    </div>
  );
}

/** 发布态完整渲染器 — 支持多页面。默认播放入场/循环动画（可通过 animationPlayer 注入）。
 *
 * 自适应容器宽度：把 375×667 设计稿按容器宽等比缩放，保证「原样展示」——
 * 窄屏（<375）不再被 overflow-hidden 切掉右侧，桌面端（max-w-md 卡片）不再左对齐留空。
 * 缩放实现与 SchemaThumbnail 一致：缩放后的舞台绝对定位在「已按缩放尺寸预留的 relative 容器」内，
 * 该容器 overflow:hidden 裁掉 transform 不改变布局占位带来的溢出，从而不产生多余横向滚动/留白。 */
export function PublishedH5({
  project,
  animationPlayer = noopPlayer,
}: {
  project: Project;
  animationPlayer?: AnimationPlayer;
}) {
  const [currentPage, setCurrentPage] = useState(0);
  const pages = Array.isArray(project.pages) ? project.pages : [];
  const settings = project.settings ?? ({} as Project['settings']);
  const width = project.width ?? 375;
  const height = project.height ?? 667;

  // 测量父容器宽度，按设计稿宽度等比缩放（不放大超过容器，也不小于容器，始终铺满）
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const apply = () => {
      const cw = el.clientWidth;
      // 封顶 1：发布页只在容器窄于设计稿时缩小（与设计时 1:1 视角一致），
      // 不在桌面宽容器里放大铺满 —— 否则边框/文字等所有属性会等比变粗，
      // 与编辑器里设置的粗细不一致（#3 修复）。
      if (cw > 0) setScale(Math.min(1, cw / width));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  const renderStage = (page?: Page) =>
    page ? (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {renderPage(page, width, height, true, animationPlayer)}
      </div>
    ) : null;

  if (pages.length <= 1) {
    const page = pages[0];
    if (!page) return <div />;
    return (
      <div ref={containerRef} data-published-h5="" style={{ width: '100%' }}>
        <div className="relative" style={{ width: width * scale, height: height * scale, overflow: 'hidden' }}>
          {renderStage(page)}
          <MusicPlayer
            music={settings.backgroundMusic}
            autoPlay={!settings.closeBackgroundMusic}
            hidden={settings.hideMusicIcon}
          />
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} data-published-h5="" style={{ width: '100%' }}>
      <div className="relative" style={{ width: width * scale, height: height * scale, overflow: 'hidden' }}>
        {renderStage(pages[currentPage])}
        <MusicPlayer
          music={settings.backgroundMusic}
          autoPlay={!settings.closeBackgroundMusic}
          hidden={settings.hideMusicIcon}
        />
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
          {pages.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setCurrentPage(i)}
              className={`h-2 rounded-full transition ${
                i === currentPage ? 'w-6 bg-blue-500' : 'w-2 bg-gray-500'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
