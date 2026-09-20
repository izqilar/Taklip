/**
 * 编辑器画布与离屏视频导出共用的 Konva 渲染辅助。
 * 从 EditorCanvas 提取，避免「编辑器交互态」与「离屏导出态」重复实现同一套
 * 图片布局 / 滤镜 / 边框 dash 逻辑（这部分是最易出错的渲染细节）。
 *
 * 仅含纯函数与展示型组件，不依赖编辑器交互状态。
 */
import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { ComponentProps } from 'react';
import { Image as KonvaImage } from 'react-konva';
import Konva from 'konva';
import type { ImageElement } from '@h5design/core';
import { kashidaForJustify, subscribeFontLoad, getFontLoadVersion } from '@h5design/core';

export type KonvaFilter = (typeof Konva.Filters)[keyof typeof Konva.Filters];

/**
 * 字体加载完成「纪元」。
 *
 * 编辑器画布挂载时字体往往尚未加载完（bootstrapFonts 异步），Konva.Text 首次
 * _setTextData 会用回退字体度量折行；而 Konva 不会在字体到位后自动重排版，
 * 画布就会一直保持回退字体的行宽 —— 与发布页 / 缩略图（加载后重排）不一致。
 * 订阅 core 的字体加载通知：任何 FontFace load 完成时版本号 +1，宿主组件把它
 * 拼进文本节点 key 触发重建，Konva 重新测量折行，与真实字体对齐。
 */
export function useFontLoadEpoch(): number {
  return useSyncExternalStore(subscribeFontLoad, getFontLoadVersion, () => 0);
}

/** 把 CSS 风格的 word-break 映射到 Konva Text 的 wrap 语义 */
export function mapWordBreakToKonvaWrap(wordBreak: string | undefined): 'word' | 'char' | 'none' {
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
export function borderDashFromStyle(style?: string, _width = 1): number[] | undefined {
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

/** 把 CSS lineStyle 转成 Konva dash 数组（line / shape 描边用） */
export function dashFromLineStyle(lineStyle?: string): number[] | undefined {
  switch (lineStyle) {
    case 'dashed':
      return [6, 4];
    case 'dotted':
      return [2, 4];
    default:
      return undefined;
  }
}

/**
 * 面板对齐值 → Konva Text 的 align。
 *
 * ⚠️ 关键修复（#46 两端对齐保留段首空格）：**不再把 'justify' 透传给 Konva**。
 * 原因：Konva 在 `align === 'justify'` 时会在 `_setTextData` 对每行做 `line.trim()`，
 * 把段首 / 段尾的空格剔除；而发布页（DOM）用 `white-space: pre` 保留这些空格，
 * 导致「编辑器画布（退出编辑）」与「发布页」不一致——段首空格被删、段首被强制拉伸。
 *
 * 这里改传「按书写方向回退」的对齐值（RTL→right / LTR→left），使 Konva 不做 trim、
 * `textArr` 完整保留段首/段尾空格；两端对齐 / 分散对齐的拉伸改由
 * `installTextJustifySupport` 注入的自定义 `_sceneFunc`（`justifySceneFunc`）负责，
 * 且只拉伸行内空格、不拉伸段首/段尾空白。
 */
export function toKonvaAlign(
  align?: string,
  direction?: 'ltr' | 'rtl',
): 'left' | 'center' | 'right' {
  const rtl = direction === 'rtl';
  // RTL 时镜像物理 left/right（面板内容框随 CSS start 对齐：RTL 起始边在右，与面板行为保持一致）
  if (align === 'center') return 'center';
  if (align === 'right') return rtl ? 'left' : 'right';
  if (align === 'justify' || align === 'justify-all') return rtl ? 'right' : 'left';
  return rtl ? 'right' : 'left';
}

/**
 * 文本轮廓：面板「粗细」→ Konva strokeWidth 的换算（×2）。
 *
 * canvas 的描边以「字形轮廓」为中心线、向内外各扩 strokeWidth/2；配合
 * fillAfterStrokeEnabled（描边先画、填充后覆盖内侧）后，画布上**可见**的轮廓只有
 * strokeWidth/2 宽 —— 直接传 outlineWidth 会让轮廓看起来只有设定值的一半，
 * 拐角处更因 Konva 强制 miterLimit=2 被削成斜切（渲染缺陷）。
 * 故这里传 2×，可见轮廓才等于用户设定值。
 */
export function toKonvaOutlineStrokeWidth(outlineWidth?: number): number {
  const w = outlineWidth || 0;
  return w > 0 ? w * 2 : 0;
}

/** 轮廓描边的转角样式：圆角可避免 miterLimit=2 在锐角/凹角处削出缺口 */
export const TEXT_OUTLINE_LINE_JOIN = 'round' as const;

/** installTextJustifySupport 挂在 Konva.Text 实例上的内部字段 */
type JustifyText = Konva.Text & {
  __justifyMode?: 'justify' | 'justify-all';
  __origSceneFunc?: SceneFn;
};

type SceneFn = (this: JustifyText, context: Konva.Context) => void;
type TextInternals = { _sceneFunc: SceneFn };

type TextLine = { text: string; width: number; lastInParagraph?: boolean };

/**
 * 「两端对齐 / 分散对齐」的 Konva 绘制实现（仅在 align 为 justify / justify-all 时接管）。
 *
 * 为什么必须替换 `_sceneFunc`：Konva 原生只在「非 RTL 的逐字绘制分支」拉伸，且
 * 只对字面量空格生效（`text.split(' ').length - 1` 为除数）——中文等无空格文本
 * 除数为 0，完全不拉伸；RTL 分支更是整行绘制、不做任何拉伸。两者都不满足需求。
 *
 * 这里的规则与浏览器 `text-align: justify` 对齐：
 *  - 有空格（拉丁 / 阿拉伯文）→ 拉伸空格（`wordSpacing`）；
 *     实测 Chromium：RTL 下 letterSpacing 也按空格计数，故 RTL 必须走 wordSpacing；
 *  - 无空格（中日韩）→ 拉伸字间距（`letterSpacing`，按「字符数-1」均摊，末端不留空）。
 *  - justify（两端对齐）：每段末行不拉伸，回退到书写方向起始侧（LTR→左、RTL→右）；
 *  - justify-all（分散对齐）：所有行（含末行）都拉伸铺满。
 */
const justifySceneFunc: SceneFn = function (this: JustifyText, context) {
  const lines = this.textArr as TextLine[] | undefined;
  if (!lines || lines.length === 0 || !this.text()) {
    this.__origSceneFunc?.call(this, context);
    return;
  }
  const mode = this.__justifyMode;
  if (!mode) {
    this.__origSceneFunc?.call(this, context);
    return;
  }

  const padding = this.padding();
  const fontSize = this.fontSize();
  const lineHeightPx = this.lineHeight() * fontSize;
  const verticalAlign = this.verticalAlign();
  const isRtl = this.direction() === 'rtl';
  const userLetterSpacing = this.letterSpacing() || 0;
  const contentWidth = this.getWidth() - padding * 2;
  // Konva 的 textArr[n].width 是「推进宽度」，把 letterSpacing 按字符数记了进去
  const naturalWidth = (line: TextLine) => line.width - userLetterSpacing * textLength(line.text);
  const fixRendering = (Konva as unknown as { _fixTextRendering?: boolean })._fixTextRendering;

  // 与 Konva 原生 _sceneFunc 保持一致的基线与垂直定位
  let baseline = 'middle';
  let translateY = lineHeightPx / 2;
  if (fixRendering) {
    const metrics = this.measureSize('M');
    baseline = 'alphabetic';
    translateY = (metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2 + lineHeightPx / 2;
  }
  let alignY = 0;
  if (verticalAlign === 'middle') alignY = (this.getHeight() - lines.length * lineHeightPx - padding * 2) / 2;
  else if (verticalAlign === 'bottom') alignY = this.getHeight() - lines.length * lineHeightPx - padding * 2;

  context.setAttr('font', this._getContextFont());
  context.setAttr('textBaseline', baseline);
  // RTL：以行盒右缘为书写起点（末行/未拉伸行因此自然右对齐）；LTR 用左缘
  context.setAttr('textAlign', isRtl ? 'right' : 'left');
  if (isRtl) context.setAttr('direction', 'rtl');
  context.translate(padding, alignY + padding);

  const textDecoration = this.textDecoration() || '';
  const shouldUnderline = textDecoration.indexOf('underline') !== -1;
  const shouldLineThrough = textDecoration.indexOf('line-through') !== -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = line.text;
    // 分散对齐：所有行都拉伸；两端对齐：每段末行不拉伸
    const stretch = mode === 'justify-all' || !line.lastInParagraph;

    // 绘制文本与间距：
    //  - 阿拉伯文：拉伸一律用「延长符(kashida)」铺满（contentWidth - 自然宽），与字母间距走同一套
    //    合法插入点规则；浏览器对阿拉伯文 text-align:justify 也是插 kashida，两端表现一致；
    //    不再拉伸空格 / 字间距（那会破坏连写笔画）。
    //  - 其他文字：沿用原生 wordSpacing / letterSpacing 拉伸（与浏览器 text-align:justify 对齐）。
    let drawText = text;
    let letterSpacing = userLetterSpacing;
    let wordSpacing = 0;
    if (stretch) {
      // 传入测量函数：按真实延长符推进宽决定数量（而非 0.22em 估算），保证拉伸后
      // 行宽 ≤ 内容框 —— 否则 RTL 行以右缘为锚绘制，多出的宽度会从**左端溢出**边界框。
      const expanded = kashidaForJustify(
        text,
        contentWidth - naturalWidth(line),
        fontSize,
        (t) => this.measureSize(t).width,
      );
      if (expanded !== text) {
        // 命中阿拉伯文合法插入点：用延长符铺满
        drawText = expanded;
        letterSpacing = 0;
        wordSpacing = 0;
      } else {
        // 非阿拉伯文 / 无合法插入点：原生拉伸
        const sp = lineJustifySpacing(text, naturalWidth(line), userLetterSpacing, contentWidth, stretch);
        letterSpacing = sp.letterSpacing;
        wordSpacing = sp.wordSpacing;
      }
    }

    if (shouldUnderline || shouldLineThrough) {
      // 复刻 Konva 的 textDecoration 绘制（否则接管道后会丢失下划线/删除线）
      const yOffset = shouldUnderline
        ? fixRendering
          ? Math.round(fontSize / 4)
          : Math.round(fontSize / 2)
        : fixRendering
          ? -Math.round(fontSize / 4)
          : 0;
      const decorationWidth = stretch ? contentWidth : line.width;
      const startX = isRtl ? contentWidth - decorationWidth : 0;
      // _getLinearGradient 未在 Konva 的 d.ts 暴露，做一次局部 cast
      const gradient = (this as unknown as { _getLinearGradient?: () => CanvasGradient | string | null })._getLinearGradient?.() ?? null;
      context.save();
      context.beginPath();
      context.moveTo(startX, translateY + yOffset);
      context.lineTo(startX + Math.round(decorationWidth), translateY + yOffset);
      context.setAttr('lineWidth', fontSize / 15);
      context.setAttr('strokeStyle', gradient || this.fill());
      context.stroke();
      context.restore();
    }

    context.save();
    // 两个间距属性都显式赋值：canvas 的间距会跨 shape 残留，必须逐行归位
    context.setAttr('letterSpacing', `${letterSpacing}px`);
    context.setAttr('wordSpacing', `${wordSpacing}px`);
    this._partialText = drawText;
    this._partialTextX = isRtl ? contentWidth : 0;
    this._partialTextY = translateY;
    context.fillStrokeShape(this);
    context.restore();

    translateY += lineHeightPx;
  }
};

/** 按码点计数（与 Konva measureSize 的 length 语义一致，避免 emoji 等代理对被算成 2） */
function textLength(text: string): number {
  return Array.from(text).length;
}

/**
 * 计算一行的字间距 / 词间距。规则与浏览器 `text-align: justify` 一致：
 * 有空格优先拉空格（LTR 与 RTL 的 wordSpacing 行为相同），无空格则拉字间距。
 *
 * `lineWidth` 直接取 Konva 算好的 `textArr[n].width`（已含用户 letterSpacing，
 * 见 Konva `_getTextWidth`：`measureText + letterSpacing*length`）。
 *  - 空格情形：保留 letterSpacing，把剩余空间按空格数均摊到 wordSpacing；
 *    额外 `+ userLetterSpacing` 修正 Konva 把 letterSpacing 按「字符数」而非
 *    「字符数-1」计入渲染宽度的偏差，使字间距>0 时也精确铺满。
 *  - 无空格（CJK）：用新 letterSpacing 整体替换，按「字符数-1」均摊（末端不留空），
 *    公式自身抵消了 Konva 的偏差，天然精确。
 */
function lineJustifySpacing(
  text: string,
  lineWidth: number,
  userLetterSpacing: number,
  contentWidth: number,
  stretch: boolean,
): { letterSpacing: number; wordSpacing: number } {
  const fallback = { letterSpacing: userLetterSpacing, wordSpacing: 0 };
  if (!stretch) return fallback;

  const spaces = text.split(' ').length - 1;
  if (spaces > 0) {
    // 剩余空间 = 内容宽 - 当前行宽 + 一个字间距（修正 Konva n 间距偏差）
    const extra = contentWidth - lineWidth + userLetterSpacing;
    if (extra <= 0.5) return fallback;
    return { letterSpacing: userLetterSpacing, wordSpacing: extra / spaces };
  }

  const chars = textLength(text);
  if (chars <= 1) return fallback;
  // 无空格：以新 letterSpacing 替换，按「字符数-1」均摊，行末恰好贴边
  const naturalWidth = lineWidth - userLetterSpacing * chars;
  const spacing = (contentWidth - naturalWidth) / (chars - 1);
  return spacing > userLetterSpacing ? { letterSpacing: spacing, wordSpacing: 0 } : fallback;
}

/**
 * 安装「两端对齐 / 分散对齐」支持（react-konva：`ref={(node) => installTextJustifySupport(node, textEl.align)}`）。
 * 每次渲染都会同步模式；切回 left/center/right 时立即还原 Konva 原生绘制。
 */
export function installTextJustifySupport(node: Konva.Text | null | undefined, align?: string): void {
  if (!node) return;
  const text = node as JustifyText;
  const internals = node as unknown as TextInternals;
  // 只备份一次：Konva Text 原型上的原生 _sceneFunc
  if (!text.__origSceneFunc) text.__origSceneFunc = internals._sceneFunc;

  const mode = align === 'justify' || align === 'justify-all' ? align : undefined;
  text.__justifyMode = mode;
  internals._sceneFunc = mode ? justifySceneFunc : (text.__origSceneFunc as SceneFn);
}

/** 根据 object-fit 计算 Konva.Image 的显示位置、尺寸与裁剪区域 */
export function computeImageLayout(
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

/** 自定义对比度滤镜（Konva 无内置 Contrast 滤镜）。contrast=100 无变化，<100 降低，>100 增强。 */
function ContrastFilter(this: Konva.Image, imageData: ImageData) {
  // 调用方传入的 contrast 已是倍率（filterContrast/100，100% => 1.0），切勿再除以 100。
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
export function FilteredImage({
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
}: Omit<ComponentProps<typeof KonvaImage>, 'image' | 'filters' | 'brightness' | 'blurRadius'> & {
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
      } catch {
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

/** 对比度滤镜（供调用方以 `ContrastFilter as unknown as KonvaFilter` 注入 filters 数组） */
export { ContrastFilter };
