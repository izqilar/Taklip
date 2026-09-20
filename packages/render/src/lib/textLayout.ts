/**
 * Konva 兼容的文本排版 —— 与 packages/editor 画布上的 <Text>（Konva.Text）逐像素对齐。
 *
 * ## 为什么不能直接用 CSS 排版
 *
 * 1) **超高行会被丢弃（最核心的差异）**
 *    Konva 的折行阈值与 CSS 基本一致（都用含 letterSpacing 的宽度，见下），
 *    但当 `height` 固定时，Konva 会**丢弃**任何放下就会超出高度的行
 *    （`_setTextData` 中 `_shouldHandleEllipsis()` → `break`）。
 *    CSS 没有等价能力：它只会把第 2 行**照常画出来**（或被 `overflow:hidden` 从中间截断）。
 *    → 表现为「编辑器里只有一行（第 2 行被丢弃），页面却显示/挤出了第 2 行」。
 *
 * 2) **溢出裁剪**
 *    Konva 不裁剪：超出元素框的字符照常绘制。
 *    若 DOM 上加了 `overflow:hidden` 又用 flex 居中，字符两端的笔画会被切掉
 *    （此前「"结"字左侧没被完整渲染」就是这样来的）。→ 必须 `overflow: visible`。
 *
 * 3) **对齐/逐字进位的基准**
 *    Konva `_getTextWidth()` = `measureText(text).width + letterSpacing × text.length`
 *    （即**含尾部间距**），居中偏移用 `(elWidth - 该宽度) / 2`，逐字绘制时
 *    `advance = 字宽 + letterSpacing`。CSS `letter-spacing` 的逐字进位与之一致，
 *    但垂直居中的行盒模型需按 `alignY` 公式显式指定，故这里按行绝对定位。
 *
 * 因此这里完整复刻 `Konva.Text._setTextData` 的算法，逐行输出，
 * 由渲染器按行绝对定位绘制，从而与编辑器画布一致。
 *
 * 参考实现：node_modules/konva/lib/shapes/Text.js（_setTextData / _addTextLine / _sceneFunc）。
 */

import { kashidaForLetterSpacing } from '@h5design/core';

export interface TextLayoutLine {
  /** 该行的文本内容 */
  text: string;
  /**
   * 该行宽度，语义等同 Konva `textArr[n].width`：
   * `measureText(text).width + letterSpacing × text.length`（**含**尾部间距）。
   * 用于对齐偏移 `(elWidth - width) / 2`。
   */
  width: number;
  /**
   * 是否为「段落末行」，语义等同 Konva `textArr[n].lastInParagraph`。
   * 两端对齐（justify）不拉伸段落末行；分散对齐（justify-all）所有行都拉伸。
   */
  lastInParagraph?: boolean;
}

export interface TextLayoutInput {
  text: string;
  fontSize: number;
  fontFamily?: string;
  /** fontStyle 含 bold */
  bold?: boolean;
  /** fontStyle 含 italic */
  italic?: boolean;
  letterSpacing?: number;
  /** 行高倍率（Konva lineHeight()，默认 1） */
  lineHeight?: number;
  /** 元素宽度（Konva attrs.width）；未提供视为 AUTO（不换行不限宽） */
  width?: number;
  /** 元素高度（Konva attrs.height）；未提供视为 AUTO（不丢行） */
  height?: number;
  /** Konva wrap 语义，来自 mapWordBreakToKonvaWrap() */
  wrap?: 'word' | 'char' | 'none';
}

export interface TextLayoutResult {
  lines: TextLayoutLine[];
  /** 单行行高（px）= lineHeight × fontSize */
  lineHeightPx: number;
  /** 文本块总高 = lines.length × lineHeightPx */
  contentHeight: number;
  /**
   * 解析后的字间距（px）。阿拉伯文场景经 kashida 展开后归零，间隙由延长符承担；
   * 调用方应据此设置 CSS `letter-spacing`，而非原始 el.letterSpacing，保证两端一致。
   */
  letterSpacing: number;
}

/** 把 schema 的 wordBreak 映射到 Konva wrap（与编辑器 konvaShared.mapWordBreakToKonvaWrap 一致） */
export function mapWordBreakToKonvaWrap(wordBreak?: string): 'word' | 'char' | 'none' {
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

// ---------------------------------------------------------------------------
// 文本测量（canvas measureText，与 Konva 使用同一套浏览器字体度量）
// ---------------------------------------------------------------------------

let measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (measureCtx) return measureCtx;
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  try {
    measureCtx = document.createElement('canvas').getContext('2d');
  } catch {
    measureCtx = null;
  }
  return measureCtx;
}

/** 与 Konva `normalizeFontFamily` 一致：含空格的字体族加引号 */
function normalizeFontFamily(fontFamily?: string): string {
  if (!fontFamily) return 'sans-serif';
  return fontFamily
    .split(',')
    .map((family) => {
      const f = family.trim();
      const hasSpace = f.indexOf(' ') >= 0;
      const hasQuotes = f.indexOf('"') >= 0 || f.indexOf("'") >= 0;
      return hasSpace && !hasQuotes ? `"${f}"` : f;
    })
    .join(', ');
}

/** 组装 canvas font 字符串 —— 与 Konva `_getContextFont()` 等价 */
export function buildCanvasFont(opts: {
  bold?: boolean;
  italic?: boolean;
  fontSize: number;
  fontFamily?: string;
}): string {
  const style = `${opts.italic ? 'italic' : ''} ${opts.bold ? 'bold' : 'normal'}`.trim();
  return `${style} ${opts.fontSize}px ${normalizeFontFamily(opts.fontFamily)}`;
}

const widthCache = new Map<string, number>();
const WIDTH_CACHE_LIMIT = 20000;

/**
 * 测量文本宽度（**不含** letterSpacing，等价 Konva `measureSize(text).width`）。带缓存。
 * 无 DOM 环境（SSR / 单测）退化为按字号估算，保证不抛错。
 */
export function measureTextWidth(text: string, font: string, fontSize: number): number {
  const key = `${font}\u0000${text}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) return cached;

  const ctx = getMeasureCtx();
  let width: number;
  if (ctx) {
    ctx.font = font;
    width = ctx.measureText(text).width;
  } else {
    // 退化为等宽估算（CJK 全角 ≈ 1em；其余按 0.5em 粗估）
    width = Array.from(text).reduce(
      (acc, ch) => acc + (/[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/.test(ch) ? fontSize : fontSize * 0.5),
      0,
    );
  }

  if (widthCache.size > WIDTH_CACHE_LIMIT) widthCache.clear();
  widthCache.set(key, width);
  return width;
}

/** 清空测量缓存（字体加载完成后调用，避免用回退字体的宽度） */
export function clearTextMeasureCache(): void {
  widthCache.clear();
}

// 自定义字体异步加载完成后，之前基于回退字体的测量全部失效 → 清缓存
if (typeof document !== 'undefined') {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (fonts) {
    // `fonts.ready` 是一次性 Promise：在它 resolve 之后才被 FontFace 动态注册的字体，
    // 不会再触发它 → 宽度缓存不会被清，文本会一直保持回退字体的错误宽度。
    // 因此额外订阅持续事件 `loadingdone`（任意字体加载完成时都会触发），确保
    // 缩略图 / 发布页 / 导出页里「后注册」的字体也能让测量缓存失效、重新排版。
    fonts.ready.then(() => clearTextMeasureCache()).catch(() => undefined);
    const f = fonts as FontFaceSet & {
      addEventListener?: (type: string, cb: () => void) => void;
    };
    if (typeof f.addEventListener === 'function') {
      f.addEventListener('loadingdone', () => clearTextMeasureCache());
    }
  }
}

// ---------------------------------------------------------------------------
// 排版（复刻 Konva.Text._setTextData）
// ---------------------------------------------------------------------------

/**
 * 按 Konva 规则把文本排成若干行。
 *
 * 与 Konva 的对应关系：
 *  - `_getTextWidth(t) = measureText(t) + letterSpacing × t.length`
 *  - `fixedWidth && lineWidth > maxWidth` → 逐字折行（二分找最长可容纳前缀）
 *  - `wrapAtWord`（wrap==='word'）→ 优先在空格 / 连字符处断行
 *  - `_shouldHandleEllipsis` → 固定高度且**再加一行就超高**时终止，丢弃后续行
 */
export function layoutText(input: TextLayoutInput): TextLayoutResult {
  const fontSize = input.fontSize || 16;
  const lineHeightPx = (input.lineHeight ?? 1) * fontSize;
  const wrap = input.wrap ?? 'word';
  const shouldWrap = wrap !== 'none';
  const wrapAtWord = wrap !== 'char' && shouldWrap;

  // 阿拉伯文等连写文字：把「字间距」转译为延长符（kashida）展开，保持笔画相连。
  // 展开后的文本用于测量 / 折行，剩余字间距归零（间隙改由延长符承担）。
  // 非阿拉伯文或字间距≤0 时原样返回，letterSpacing 保留。
  const userSpacing = input.letterSpacing ?? 0;
  const kash = kashidaForLetterSpacing(input.text ?? '', userSpacing, fontSize);
  const spacing = kash.letterSpacing;

  const fixedWidth = typeof input.width === 'number' && input.width > 0;
  const fixedHeight = typeof input.height === 'number' && input.height > 0;
  const maxWidth = fixedWidth ? (input.width as number) : Number.POSITIVE_INFINITY;
  const maxHeightPx = fixedHeight ? (input.height as number) : Number.POSITIVE_INFINITY;

  const font = buildCanvasFont({
    bold: input.bold,
    italic: input.italic,
    fontSize,
    fontFamily: input.fontFamily,
  });
  const measure = (t: string) => measureTextWidth(t, font, fontSize);
  /** 等价 Konva `_getTextWidth`：含尾部 letterSpacing（注意用 UTF-16 length 与 Konva 一致） */
  const lineWidthOf = (t: string) => measure(t) + spacing * t.length;

  const out: TextLayoutLine[] = [];
  let currentHeightPx = 0;

  // Konva: lines = this.text().split('\n')
  const paragraphs = String(kash.text ?? '').split('\n');

  outer: for (let i = 0; i < paragraphs.length; i++) {
    let line = paragraphs[i];
    let lineWidth = lineWidthOf(line);

    if (fixedWidth && lineWidth > maxWidth) {
      while (line.length > 0) {
        const chars = Array.from(line);
        let low = 0;
        let high = chars.length;
        let match = '';
        let matchWidth = 0;

        // 二分：找到宽度 ≤ maxWidth 的最长前缀（等价于 Konva 的 low/high 二分）
        while (low < high) {
          const mid = (low + high) >>> 1;
          const substr = chars.slice(0, mid + 1).join('');
          const substrWidth = lineWidthOf(substr);
          if (substrWidth <= maxWidth) {
            low = mid + 1;
            match = substr;
            matchWidth = substrWidth;
          } else {
            high = mid;
          }
        }

        if (!match) break;

        if (wrapAtWord) {
          const matchChars = Array.from(match);
          const nextChar = chars[matchChars.length];
          const nextIsSpaceOrDash = nextChar === ' ' || nextChar === '-';
          let wrapIndex: number;
          if (nextIsSpaceOrDash && matchWidth <= maxWidth) {
            wrapIndex = matchChars.length;
          } else {
            const lastSpaceIndex = matchChars.lastIndexOf(' ');
            const lastDashIndex = matchChars.lastIndexOf('-');
            wrapIndex = Math.max(lastSpaceIndex, lastDashIndex) + 1;
          }
          if (wrapIndex > 0) {
            low = wrapIndex;
            match = chars.slice(0, low).join('');
            matchWidth = lineWidthOf(match);
          }
        }

        out.push({ text: match.replace(/\s+$/, ''), width: matchWidth });
        currentHeightPx += lineHeightPx;

        // Konva._shouldHandleEllipsis：不换行，或固定高度下再加一行即超高 → 终止（丢弃后续行）
        if (!shouldWrap || (fixedHeight && currentHeightPx + lineHeightPx > maxHeightPx)) {
          break;
        }

        line = Array.from(line)
          .slice(low)
          .join('')
          .replace(/^\s+/, '');
        if (line.length > 0) {
          lineWidth = lineWidthOf(line);
          if (lineWidth <= maxWidth) {
            out.push({ text: line, width: lineWidth });
            currentHeightPx += lineHeightPx;
            break;
          }
        }
      }
    } else {
      out.push({ text: line, width: lineWidth });
      currentHeightPx += lineHeightPx;
    }

    // Konva：每个源行（段落）处理完后，把该段最后一行标记为「段落末行」
    // （两端对齐不拉伸段落末行；分散对齐会忽略该标记）
    if (out.length > 0) out[out.length - 1].lastInParagraph = true;

    // Konva：处理完一个源行后，若高度已不足以再放一行则停止（不再处理后续段落）
    if (fixedHeight && currentHeightPx + lineHeightPx > maxHeightPx) break outer;
  }

  return { lines: out, lineHeightPx, contentHeight: out.length * lineHeightPx, letterSpacing: spacing };
}

/** 计算单行的水平偏移（Konva：left=0 / center=(totalWidth-width)/2 / right=totalWidth-width） */
export function resolveLineOffset(
  lineWidth: number,
  totalWidth: number,
  align?: string,
): number {
  if (align === 'center') return (totalWidth - lineWidth) / 2;
  if (align === 'right') return totalWidth - lineWidth;
  return 0;
}

/** 计算文本块垂直起点（Konva：middle=(h-lines*lh)/2 / bottom=h-lines*lh / top=0） */
export function resolveVerticalOffset(
  contentHeight: number,
  totalHeight: number,
  verticalAlign?: string,
): number {
  if (verticalAlign === 'middle') return (totalHeight - contentHeight) / 2;
  if (verticalAlign === 'bottom') return totalHeight - contentHeight;
  return 0;
}
