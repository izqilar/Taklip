import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

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

  // hsl/hsla（设计稿的「Hex / RGB / HSL」格式下拉需要能解析回来）
  const hslMatch = normalized.match(/hsla?\(([^)]+)\)/);
  if (hslMatch) {
    const raw = hslMatch[1].split(/[,/]/).map((p) => p.trim());
    const h = parseFloat(raw[0]) || 0;
    const s = (parseFloat(raw[1]) || 0) / 100;
    const l = (parseFloat(raw[2]) || 0) / 100;
    const a = Number.isFinite(parseFloat(raw[3])) ? clamp(parseFloat(raw[3]), 0, 1) : 1;
    const { r, g, b } = hslToRgb(h, s, l);
    return { r, g, b, a };
  }

  return { r: 255, g: 255, b: 255, a: 1 };
}

export function rgbaToCss(c: RgbaColor): string {
  if (c.a <= 0) return 'transparent';
  if (c.a >= 1) return `#${c.r.toString(16).padStart(2, '0')}${c.g.toString(16).padStart(2, '0')}${c.b.toString(16).padStart(2, '0')}`;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a.toFixed(2)})`;
}

/**
 * 序列化为 CSS 颜色，且**保留 RGB 分量**：alpha=0 时输出 `rgba(r, g, b, 0)` 而非 `transparent`。
 *
 * 为什么需要它：`transparent` 在 `parseCssColor` 里被解析为白色（255,255,255,0），
 * 于是「把透明度拉到 0 再拉回来」会得到白色 —— 色相被抹掉。
 * 渐变停靠点的透明度输入框必须用本函数，保证往返编辑不丢颜色。
 */
export function rgbaToCssKeepRgb(c: RgbaColor): string {
  if (c.a >= 1) {
    return `#${c.r.toString(16).padStart(2, '0')}${c.g.toString(16).padStart(2, '0')}${c.b.toString(16).padStart(2, '0')}`;
  }
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${Math.round(c.a * 1000) / 1000})`;
}

export function rgbaToHex(c: RgbaColor): string {
  return `#${c.r.toString(16).padStart(2, '0')}${c.g.toString(16).padStart(2, '0')}${c.b.toString(16).padStart(2, '0')}`;
}

export function isValidCssColor(css: string): boolean {
  const normalized = (css || '').trim().toLowerCase();
  if (normalized === '' || normalized === 'transparent') return true;
  if (/^#[0-9a-f]{3,8}$/.test(normalized)) return true;
  if (/^rgba?\(\s*\d+(\.\d+)?\s*,\s*\d+(\.\d+)?\s*,\s*\d+(\.\d+)?\s*(,\s*\d?\.?\d+\s*)?\)$/.test(normalized)) return true;
  return /^hsla?\(\s*\d+(\.\d+)?\s*,\s*\d+(\.\d+)?%\s*,\s*\d+(\.\d+)?%\s*(,\s*\d?\.?\d+\s*)?\)$/.test(normalized);
}

function rgbToHsv({ r, g, b }: RgbaColor): { h: number; s: number; v: number } {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d + 6) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rr = 0;
  let gg = 0;
  let bb = 0;
  if (h < 60) { rr = c; gg = x; bb = 0; }
  else if (h < 120) { rr = x; gg = c; bb = 0; }
  else if (h < 180) { rr = 0; gg = c; bb = x; }
  else if (h < 240) { rr = 0; gg = x; bb = c; }
  else if (h < 300) { rr = x; gg = 0; bb = c; }
  else { rr = c; gg = 0; bb = x; }
  return {
    r: Math.round((rr + m) * 255),
    g: Math.round((gg + m) * 255),
    b: Math.round((bb + m) * 255),
  };
}

/** RGB → HSL（仅用于「HSL」格式下拉的显示，s/l 为 0~1） */
function rgbToHsl({ r, g, b }: RgbaColor): { h: number; s: number; l: number } {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rr) h = ((gg - bb) / d + 6) % 6;
  else if (max === gg) h = (bb - rr) / d + 2;
  else h = (rr - gg) / d + 4;
  return { h: h * 60, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rr = 0;
  let gg = 0;
  let bb = 0;
  if (h < 60) { rr = c; gg = x; bb = 0; }
  else if (h < 120) { rr = x; gg = c; bb = 0; }
  else if (h < 180) { rr = 0; gg = c; bb = x; }
  else if (h < 240) { rr = 0; gg = x; bb = c; }
  else if (h < 300) { rr = x; gg = 0; bb = c; }
  else { rr = c; gg = 0; bb = x; }
  return {
    r: Math.round((rr + m) * 255),
    g: Math.round((gg + m) * 255),
    b: Math.round((bb + m) * 255),
  };
}

/**
 * 「常用色」色板（自定义页签底部 8 列 × 4 行，对齐设计稿）。
 */
const QUICK_COLORS = [
  '#f03b3b', '#e6399b', '#8e3fd1', '#5b3fd1', '#3b4fd1', '#2f7be6', '#2fa6e6', '#2fc7e6',
  '#3fcf5b', '#7fd84a', '#b8d83f', '#d8d83f', '#e6c72f', '#f0a62f', '#f0902f', '#f0702f',
  '#f04a2f', '#a9765a', '#c9a87f', '#f2b8b8', '#d89ab0', '#9a9a9a', '#6e7a85', '#8a8a8a',
  '#1a1a1a', '#ffffff', '#333333', '#0a0a0a', '#4d4d4d', '#666666', '#8c8c8c', '#b3b3b3',
];

/**
 * 「调色板」页签色板（8 列 × 6 行）：常用色 + 暖色 / 冷色两组扩展。
 */
const PALETTE_COLORS = [
  ...QUICK_COLORS,
  '#ffe0b2', '#ffcc80', '#ffb74d', '#ffa726', '#ff9800', '#fb8c00', '#f57c00', '#ef6c00',
  '#e3f2fd', '#bbdefb', '#90caf9', '#64b5f6', '#42a5f5', '#2196f3', '#1e88e5', '#1976d2',
];

/** 半透明底纹（棋盘格），用于透明度滑轨；中性灰在亮/暗两套主题下都可见 */
const CHECKER =
  'linear-gradient(45deg, rgba(148,163,184,0.45) 25%, transparent 25%, transparent 75%, rgba(148,163,184,0.45) 75%, rgba(148,163,184,0.45)), linear-gradient(45deg, rgba(148,163,184,0.45) 25%, transparent 25%, transparent 75%, rgba(148,163,184,0.45) 75%, rgba(148,163,184,0.45))';

/** 色值输入框支持的颜色格式（设计稿左上「Hex ▾」下拉） */
type ColorFormat = 'hex' | 'rgb' | 'hsl';

const FORMAT_ORDER: ColorFormat[] = ['hex', 'rgb', 'hsl'];

/** 按所选格式把 RGBA 的 RGB 部分格式化成输入框文本 */
function formatByFormat(c: RgbaColor, format: ColorFormat): string {
  if (format === 'rgb') return `${c.r}, ${c.g}, ${c.b}`;
  if (format === 'hsl') {
    const { h, s, l } = rgbToHsl(c);
    return `${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%`;
  }
  return rgbaToHex(c).slice(1).toUpperCase();
}

/** 解析输入框文本（按所选格式），失败返回 null */
function parseByFormat(text: string, format: ColorFormat): { r: number; g: number; b: number } | null {
  const raw = (text || '').trim();
  if (!raw) return null;
  if (format === 'rgb') {
    const parts = raw.split(/[,\s]+/).map((p) => parseFloat(p)).filter((n) => Number.isFinite(n));
    if (parts.length < 3) return null;
    return { r: clamp(Math.round(parts[0]), 0, 255), g: clamp(Math.round(parts[1]), 0, 255), b: clamp(Math.round(parts[2]), 0, 255) };
  }
  if (format === 'hsl') {
    const parts = raw.split(/[,\s]+/).map((p) => parseFloat(p)).filter((n) => Number.isFinite(n));
    if (parts.length < 3) return null;
    return hslToRgb(parts[0], clamp(parts[1], 0, 100) / 100, clamp(parts[2], 0, 100) / 100);
  }
  // hex：允许带/不带 #
  const hex = raw.replace(/^#/, '');
  if (!/^[0-9a-fA-F]{3,8}$/.test(hex)) return null;
  return parseCssColor(`#${hex}`);
}

interface ColorPickerProps {
  value: string;
  onChange: (css: string) => void;
  onClear?: () => void;
  onConfirm?: () => void;
  /** 点击标题栏 X：由外层负责关闭弹层（并丢弃未确认的取色） */
  onClose?: () => void;
  /**
   * 点击「取色器」图标：由外层（ColorField）负责关闭对话框、开启画布取色会话，
   * 取到颜色后再把颜色回传进来（显示在本对话框的活动颜色标本里）。
   */
  onEyedropper?: () => void;
  clearLabel?: string;
  confirmLabel?: string;
  eyedropperLabel?: string;
}

/**
 * 颜色选择器（对齐设计稿）：
 *  · 顶部**标题栏**（自定义 / 调色板 页签 + 关闭 X），按住标题栏可**拖拽移动**整个弹窗；
 *  · 「自定义」= 大面积饱和度/明度面板 + 竖向色相条 + 取色器/透明度行 + 格式色值行 + 常用色；
 *  · 「调色板」= 完整色板（8 列 × 6 行）；
 *  · 底部「清除 / 确定」右对齐。
 *
 * 所有填充色场景（单色 / 渐变停靠点 / 图案 / 图片 / 视频 / 混合模式 / 页面背景）
 * 统一经由本组件弹出，风格与交互唯一。
 */
export default function ColorPicker({
  value,
  onChange,
  onClear,
  onConfirm,
  onClose,
  onEyedropper,
  clearLabel,
  confirmLabel,
  eyedropperLabel,
}: ColorPickerProps) {
  const { t } = useTranslation(['editor', 'common']);
  const clearText = clearLabel ?? t('editor:colorPicker.clear', { defaultValue: '清除' });
  const confirmText = confirmLabel ?? t('editor:colorPicker.confirm', { defaultValue: '确定' });
  const eyedropperText = eyedropperLabel ?? t('editor:colorPicker.eyedropper', { defaultValue: '取色器' });

  const initial = parseCssColor(value);
  const [hsv, setHsv] = useState<{ h: number; s: number; v: number }>(() => rgbToHsv(initial));
  const [alpha, setAlpha] = useState(initial.a);
  const [tab, setTab] = useState<'custom' | 'palette'>('custom');
  const [format, setFormat] = useState<ColorFormat>('hex');
  const [formatOpen, setFormatOpen] = useState(false);
  const [inputText, setInputText] = useState(() => formatByFormat(initial, 'hex'));

  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const alphaRef = useRef<HTMLDivElement>(null);

  const rgba: RgbaColor = { ...hsvToRgb(hsv.h, hsv.s, hsv.v), a: alpha };
  const pure = hsvToRgb(hsv.h, 1, 1);
  const css = rgbaToCss(rgba);

  useEffect(() => {
    setInputText(formatByFormat({ ...hsvToRgb(hsv.h, hsv.s, hsv.v), a: alpha }, format));
  }, [hsv, alpha, format]);

  const commit = useCallback(() => {
    onChange(rgbaToCss({ ...hsvToRgb(hsv.h, hsv.s, hsv.v), a: alpha }));
  }, [hsv, alpha, onChange]);

  const applyRgb = useCallback((rgb: { r: number; g: number; b: number }) => {
    setHsv(rgbToHsv({ ...rgb, a: 1 }));
  }, []);

  const commitInput = useCallback(() => {
    const rgb = parseByFormat(inputText, format);
    if (!rgb) {
      setInputText(formatByFormat({ ...hsvToRgb(hsv.h, hsv.s, hsv.v), a: alpha }, format));
      return;
    }
    applyRgb(rgb);
    onChange(rgbaToCss({ ...rgb, a: alpha }));
  }, [inputText, format, hsv, alpha, applyRgb, onChange]);

  /* ───────── 拖拽：按住标题栏移动弹窗 ───────── */
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const onTitlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const onTitlePointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setOffset({ x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) });
  };
  const endTitleDrag = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  /* ───────── 色板交互 ───────── */
  const handleSvDrag = useCallback(
    (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
      const rect = svRef.current?.getBoundingClientRect();
      if (!rect) return;
      const clientX = 'touches' in e ? e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0]?.clientY ?? e.changedTouches[0]?.clientY : e.clientY;
      const x = clamp((clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((clientY - rect.top) / rect.height, 0, 1);
      setHsv((prev) => ({ ...prev, s: x, v: 1 - y }));
    },
    [],
  );

  const handleHueDrag = useCallback(
    (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
      const rect = hueRef.current?.getBoundingClientRect();
      if (!rect) return;
      const clientY = 'touches' in e ? e.touches[0]?.clientY ?? e.changedTouches[0]?.clientY : e.clientY;
      const y = clamp((clientY - rect.top) / rect.height, 0, 1);
      setHsv((prev) => ({ ...prev, h: y * 360 }));
    },
    [],
  );

  const handleAlphaDrag = useCallback(
    (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
      const rect = alphaRef.current?.getBoundingClientRect();
      if (!rect) return;
      const clientX = 'touches' in e ? e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX : e.clientX;
      const x = clamp((clientX - rect.left) / rect.width, 0, 1);
      setAlpha(x);
    },
    [],
  );

  const startDrag = useCallback(
    (
      handler: (e: MouseEvent | TouchEvent) => void,
      native: React.MouseEvent | React.TouchEvent,
    ) => {
      handler(native as unknown as MouseEvent | TouchEvent);
      const move = (e: MouseEvent | TouchEvent) => handler(e);
      const up = () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        window.removeEventListener('touchmove', move);
        window.removeEventListener('touchend', up);
        commit();
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
      window.addEventListener('touchmove', move);
      window.addEventListener('touchend', up);
    },
    [commit],
  );

  const pickPreset = useCallback(
    (c: string) => {
      const parsed = parseCssColor(c);
      setHsv(rgbToHsv(parsed));
      setAlpha(parsed.a);
      onChange(rgbaToCss(parsed));
    },
    [onChange],
  );

  const alphaPct = Math.round(alpha * 100);

  const renderSwatches = (colors: string[], tall: boolean) => (
    <div className={`grid grid-cols-8 ${tall ? 'gap-1.5' : 'gap-1'}`}>
      {colors.map((c, i) => (
        <button
          key={`${c}-${i}`}
          type="button"
          data-testid="colorpicker-preset"
          data-color={c}
          title={c}
          onClick={() => pickPreset(c)}
          className={`cp-swatch w-full rounded-md transition hover:scale-[1.06] ${tall ? 'h-7' : 'h-6'}`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );

  return (
    <div
      className="h5design-colorpicker w-[300px] select-none rounded-2xl bg-white p-3 shadow-xl transition-shadow"
      data-testid="colorpicker"
      style={{
        transform: offset.x || offset.y ? `translate3d(${offset.x}px, ${offset.y}px, 0)` : undefined,
        boxShadow: dragging ? '0 24px 48px rgba(0,0,0,0.28)' : undefined,
      }}
    >
      {/* ── 标题栏（可拖拽） ── */}
      <div
        data-testid="colorpicker-title"
        className={`mb-3 flex items-center gap-2 ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDown={onTitlePointerDown}
        onPointerMove={onTitlePointerMove}
        onPointerUp={endTitleDrag}
        onPointerCancel={endTitleDrag}
      >
        <div className="flex items-center gap-1" data-no-drag>
          <button
            type="button"
            data-testid="colorpicker-tab-custom"
            data-active={tab === 'custom' ? 'true' : 'false'}
            onClick={() => setTab('custom')}
            className="cp-tab"
          >
            {t('editor:colorPicker.custom', { defaultValue: '自定义' })}
          </button>
          <button
            type="button"
            data-testid="colorpicker-tab-palette"
            data-active={tab === 'palette' ? 'true' : 'false'}
            onClick={() => setTab('palette')}
            className="cp-tab"
          >
            {t('editor:colorPicker.palette', { defaultValue: '调色板' })}
          </button>
        </div>
        <div className="min-w-0 flex-1" />
        {onClose && (
          <button
            type="button"
            data-no-drag
            data-testid="colorpicker-close"
            onClick={onClose}
            title={t('common:button.close', { defaultValue: '关闭' })}
            aria-label={t('common:button.close', { defaultValue: '关闭' })}
            className="cp-icon-btn"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>

      {tab === 'custom' ? (
        <>
          {/* ── 饱和度 / 明度面板 + 竖向色相条 ── */}
          <div className="mb-3 flex items-stretch gap-2">
            <div
              ref={svRef}
              data-testid="colorpicker-sv"
              className="relative h-52 min-w-0 flex-1 cursor-crosshair overflow-hidden rounded-lg"
              style={{
                background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, rgb(${pure.r}, ${pure.g}, ${pure.b}))`,
              }}
              onMouseDown={(e) => startDrag(handleSvDrag, e)}
              onTouchStart={(e) => startDrag(handleSvDrag, e)}
            >
              <div
                className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#111827] shadow-[0_0_0_2px_rgba(255,255,255,0.9)]"
                style={{
                  left: `${hsv.s * 100}%`,
                  top: `${(1 - hsv.v) * 100}%`,
                  backgroundColor: css,
                }}
              />
            </div>
            <div
              ref={hueRef}
              data-testid="colorpicker-hue"
              className="relative w-[22px] shrink-0 cursor-pointer overflow-hidden rounded-full"
              style={{
                background: 'linear-gradient(to bottom, #f00 0%, #ff00a0 17%, #8000ff 33%, #0080ff 50%, #00ffd5 67%, #00ff00 83%, #ffff00 92%, #f00 100%)',
              }}
              onMouseDown={(e) => startDrag(handleHueDrag, e)}
              onTouchStart={(e) => startDrag(handleHueDrag, e)}
            >
              <div
                className="pointer-events-none absolute left-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#111827] shadow-[0_0_0_2px_rgba(255,255,255,0.9)]"
                style={{
                  top: `${(hsv.h / 360) * 100}%`,
                  backgroundColor: `rgb(${pure.r}, ${pure.g}, ${pure.b})`,
                }}
              />
            </div>
          </div>

          {/* ── 取色器 + 透明度滑轨 ── */}
          <div className="mb-3 flex items-center gap-2">
            {onEyedropper && (
              <button
                type="button"
                onClick={onEyedropper}
                title={eyedropperText}
                aria-label={eyedropperText}
                data-testid="colorpicker-eyedropper"
                className="cp-icon-btn h-7 w-7 shrink-0"
              >
                {/* 取色器（lucide pipette） */}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="m2 22 1-1h3l9-9" />
                  <path d="M3 21v-3l9-9" />
                  <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.9.9a1 1 0 0 1 0 1.4l-1.6 1.6a1 1 0 0 1-1.4 0l-5.6-5.6a1 1 0 0 1 0-1.4l1.6-1.6a1 1 0 0 1 1.4 0z" />
                </svg>
              </button>
            )}
            <div
              ref={alphaRef}
              data-testid="colorpicker-alpha"
              className="cp-alpha-track relative h-6 min-w-0 flex-1 cursor-pointer overflow-hidden rounded-full"
              style={{
                backgroundImage: `linear-gradient(to right, rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, 0), rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, 1)), ${CHECKER}`,
                backgroundSize: '100% 100%, 10px 10px, 10px 10px',
                backgroundPosition: '0 0, 0 0, 5px 5px',
              }}
              onMouseDown={(e) => startDrag(handleAlphaDrag, e)}
              onTouchStart={(e) => startDrag(handleAlphaDrag, e)}
            >
              <div
                className="pointer-events-none absolute top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#111827] shadow-[0_0_0_2px_rgba(255,255,255,0.9)]"
                style={{ left: `${alpha * 100}%`, backgroundColor: css }}
              />
            </div>
          </div>

          {/* ── 格式下拉 + 色值 + 不透明度 ── */}
          <div className="mb-3 flex items-center gap-2">
            <div className="relative shrink-0">
              <button
                type="button"
                data-testid="colorpicker-format"
                onClick={() => setFormatOpen((s) => !s)}
                className="cp-field flex h-9 w-[74px] items-center justify-between px-2.5 text-xs"
              >
                <span>{format === 'hex' ? 'Hex' : format === 'rgb' ? 'RGB' : 'HSL'}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-3 w-3">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {formatOpen && (
                <div className="cp-menu absolute left-0 top-full z-10 mt-1 w-[74px] overflow-hidden rounded-lg py-1" data-testid="colorpicker-format-menu">
                  {FORMAT_ORDER.map((f) => (
                    <button
                      key={f}
                      type="button"
                      data-active={format === f ? 'true' : 'false'}
                      onClick={() => {
                        setFormat(f);
                        setFormatOpen(false);
                      }}
                      className="cp-menu-item block w-full px-2.5 py-1.5 text-left text-xs"
                    >
                      {f === 'hex' ? 'Hex' : f === 'rgb' ? 'RGB' : 'HSL'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input
              type="text"
              data-testid="colorpicker-hex"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onBlur={commitInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitInput();
              }}
              className="cp-field h-9 min-w-0 flex-1 px-2.5 text-center text-xs"
            />
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              data-testid="colorpicker-opacity"
              value={alphaPct}
              onChange={(e) => setAlpha(clamp(Number(e.target.value), 0, 100) / 100)}
              onBlur={commit}
              className="cp-field h-9 w-11 shrink-0 px-1 text-right text-xs"
            />
            <span className="shrink-0 text-xs text-gray-500">%</span>
          </div>

          {/* ── 常用色 ── */}
          <div className="mb-3">{renderSwatches(QUICK_COLORS, false)}</div>
        </>
      ) : (
        /* ── 调色板 ── */
        <div className="mb-3">{renderSwatches(PALETTE_COLORS, true)}</div>
      )}

      {/* ── 操作 ── */}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          data-testid="colorpicker-clear"
          onClick={() => {
            setHsv({ h: 0, s: 0, v: 1 });
            setAlpha(0);
            onClear?.();
          }}
          className="cp-btn h-9 px-4 text-xs"
        >
          {clearText}
        </button>
        <button
          type="button"
          data-testid="colorpicker-confirm"
          onClick={() => {
            commit();
            onConfirm?.();
          }}
          className="cp-btn h-9 px-4 text-xs"
        >
          {confirmText}
        </button>
      </div>
    </div>
  );
}
