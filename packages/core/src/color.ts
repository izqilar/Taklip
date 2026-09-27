/**
 * 颜色与阴影工具 — 三端（编辑器 Konva / 发布页 DOM / 离屏导出 DOM）共享的唯一真值。
 *
 * 关键：阴影「是否存在」的判定必须三端一致。历史上展示页（SchemaRenderer）把
 * `shadowColor:'transparent'` 误当作「黑色阴影」渲染出来，而编辑器（Konva）因
 * `_hasShadow()` 在颜色透明时返回 false、根本不渲染 → 三端不一致。
 *
 * 故把「是否有真实阴影」与「阴影颜色（含 alpha）」收敛到这里的纯函数，任何一端
 * 都通过 `resolveShadow` / `resolveShadowColor` / `hasRealShadow` 取数，不再各自判断。
 */

export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function parseCssColor(css: string): RgbaColor {
  const normalized = (css || '').trim().toLowerCase();
  if (normalized === 'transparent' || normalized === '') {
    return { r: 255, g: 255, b: 255, a: 0 };
  }

  // hex
  if (normalized.startsWith('#')) {
    const hex = normalized.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
      return { r, g, b, a };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
  }

  // rgb/rgba
  const rgbMatch = normalized.match(/rgba?\(([^)]+)\)/);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(',').map((p) => parseFloat(p.trim()));
    return {
      r: clamp(parts[0] || 0, 0, 255),
      g: clamp(parts[1] || 0, 0, 255),
      b: clamp(parts[2] || 0, 0, 255),
      a: Number.isFinite(parts[3]) ? clamp(parts[3], 0, 1) : 1,
    };
  }

  return { r: 255, g: 255, b: 255, a: 1 };
}

export function rgbaToCss(c: RgbaColor): string {
  if (c.a <= 0) return 'transparent';
  if (c.a >= 1)
    return `#${c.r.toString(16).padStart(2, '0')}${c.g
      .toString(16)
      .padStart(2, '0')}${c.b.toString(16).padStart(2, '0')}`;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a.toFixed(2)})`;
}

/** 给一个 CSS 颜色叠加 alpha（0~1），返回 CSS 颜色字符串（transparent 或 rgba/hex）。 */
export function applyAlphaToColor(css: string, alpha: number): string {
  const c = parseCssColor(css);
  c.a = clamp(alpha, 0, 1);
  return rgbaToCss(c);
}

/**
 * 在颜色自带的 alpha 之上再乘一个系数（0~1），保留颜色本身的半透明设定。
 * 用于「填充透明度 / 轮廓透明度」这类独立滑块：滑块只做整体缩放，
 * 不会覆盖用户在取色对话框里已经调好的颜色 alpha。
 */
export function applyAlphaFactor(css: string, factor: number): string {
  const f = clamp(Number.isFinite(factor) ? factor : 1, 0, 1);
  if (f >= 1) return css; // 未调透明度时保持原始色值（hex 仍是 hex，避免无谓改写）
  const c = parseCssColor(css);
  c.a = clamp(c.a * f, 0, 1);
  return rgbaToCss(c);
}

/** 具有「填充 + 轮廓」两个独立颜色通道的元素（形状、文本等） */
export interface PaintCapable {
  /** 填充色（形状的填充 / 文本的字色） */
  fill?: string;
  /** 轮廓（描边）色 */
  stroke?: string;
  /** 填充不透明度 0~1（默认 1） */
  fillOpacity?: number;
  /** 轮廓不透明度 0~1（默认 1） */
  strokeOpacity?: number;
}

/**
 * 元素填充色的最终渲染值（已折算 fillOpacity）。
 * 无填充色时返回 undefined；未设置 fillOpacity 时原样返回，保证「没动过的元素」渲染完全不变。
 */
export function resolveFillColor(el: PaintCapable | undefined | null): string | undefined {
  if (!el || !el.fill) return undefined;
  if (el.fillOpacity == null || el.fillOpacity >= 1) return el.fill;
  return applyAlphaFactor(el.fill, el.fillOpacity);
}

/** 元素轮廓（描边）色的最终渲染值（已折算 strokeOpacity）。 */
export function resolveStrokeColor(el: PaintCapable | undefined | null): string | undefined {
  if (!el || !el.stroke) return undefined;
  if (el.strokeOpacity == null || el.strokeOpacity >= 1) return el.stroke;
  return applyAlphaFactor(el.stroke, el.strokeOpacity);
}

/**
 * 线型 → 虚线间隔数组。Konva `dash` 与 SVG `strokeDasharray` 取值一致，三端共用。
 * 返回 undefined 表示实线（不设虚线）。
 */
export function lineStyleToDash(lineStyle?: string): number[] | undefined {
  switch (lineStyle) {
    case 'dashed':
      return [6, 4];
    case 'dotted':
      return [2, 4];
    default:
      return undefined;
  }
}

/** 线型 → CSS border-style（DOM 渲染端使用；非法值回落 solid）。 */
export function lineStyleToCssBorderStyle(lineStyle?: string): 'solid' | 'dashed' | 'dotted' {
  if (lineStyle === 'dashed') return 'dashed';
  if (lineStyle === 'dotted') return 'dotted';
  return 'solid';
}

/** 一个元素可能携带的阴影相关字段（Element / 文本 / 形状等共用）。 */
export interface ShadowCapable {
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;
}

/**
 * 该元素是否应该绘制阴影。
 * 与 Konva `_hasShadow()` 语义对齐：
 *  - shadowColor 缺失 / 为 'transparent' / 'none' → 无阴影；
 *  - shadowOpacity <= 0 → 无阴影；
 *  - blur / offsetX / offsetY 全为 0 → 无阴影。
 */
export function hasRealShadow(el: ShadowCapable | undefined | null): boolean {
  if (!el) return false;
  const color = el.shadowColor;
  if (!color || color === 'transparent' || color === 'none') return false;
  const opacity = typeof el.shadowOpacity === 'number' ? el.shadowOpacity : 1;
  if (opacity <= 0) return false;
  const blur = el.shadowBlur || 0;
  const ox = el.shadowOffsetX || 0;
  const oy = el.shadowOffsetY || 0;
  return blur !== 0 || ox !== 0 || oy !== 0;
}

/**
 * 阴影有效颜色（已按 shadowOpacity 折算 alpha）。无阴影时返回 undefined。
 * 用于 CSS box-shadow 颜色段，以及「同形阴影层」的纯色填充。
 */
export function resolveShadowColor(el: ShadowCapable | undefined | null): string | undefined {
  if (!hasRealShadow(el)) return undefined;
  const opacity = typeof el?.shadowOpacity === 'number' ? el.shadowOpacity : 1;
  return applyAlphaToColor(el!.shadowColor as string, opacity);
}

/**
 * 完整 CSS box-shadow 字符串（如 `2px 2px 0px rgba(0,0,0,0.5)`）；无阴影时返回 undefined。
 * 供展示页 / 导出页的 `boxShadow` / `textShadow` 直接使用。
 */
export function resolveShadow(el: ShadowCapable | undefined | null): string | undefined {
  const color = resolveShadowColor(el);
  if (!color) return undefined;
  const blur = el!.shadowBlur || 0;
  const ox = el!.shadowOffsetX || 0;
  const oy = el!.shadowOffsetY || 0;
  return `${ox}px ${oy}px ${blur}px ${color}`;
}
