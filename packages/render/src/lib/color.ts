/**
 * 颜色工具 — 从 apps/web/src/components/UI/ColorPicker.tsx 抽取的数据层纯函数。
 * 仅包含与「渲染」相关的 parse/rgbaToCss 等，不含 ColorPicker 交互 UI（交互 UI 仍留在 web 端）。
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

export function rgbaToHex(c: RgbaColor): string {
  return `#${c.r.toString(16).padStart(2, '0')}${c.g
    .toString(16)
    .padStart(2, '0')}${c.b.toString(16).padStart(2, '0')}`;
}

/** 给一个 CSS 颜色叠加 alpha（0~1），返回 CSS 颜色字符串（transparent 或 rgba/hex）。 */
export function applyAlphaToColor(css: string, alpha: number): string {
  const c = parseCssColor(css);
  c.a = clamp(alpha, 0, 1);
  return rgbaToCss(c);
}

export function isValidCssColor(css: string): boolean {
  const normalized = (css || '').trim().toLowerCase();
  if (normalized === '' || normalized === 'transparent') return true;
  if (/^#[0-9a-f]{3,8}$/.test(normalized)) return true;
  return /^rgba?\(\s*\d+(\.\d+)?\s*,\s*\d+(\.\d+)?\s*,\s*\d+(\.\d+)?\s*(,\s*\d?\.?\d+\s*)?\)$/.test(
    normalized,
  );
}
