import { useState, useRef, useEffect, useCallback } from 'react';

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
  if (c.a >= 1) return `#${c.r.toString(16).padStart(2, '0')}${c.g.toString(16).padStart(2, '0')}${c.b.toString(16).padStart(2, '0')}`;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a.toFixed(2)})`;
}

export function rgbaToHex(c: RgbaColor): string {
  return `#${c.r.toString(16).padStart(2, '0')}${c.g.toString(16).padStart(2, '0')}${c.b.toString(16).padStart(2, '0')}`;
}

export function isValidCssColor(css: string): boolean {
  const normalized = (css || '').trim().toLowerCase();
  if (normalized === '' || normalized === 'transparent') return true;
  if (/^#[0-9a-f]{3,8}$/.test(normalized)) return true;
  return /^rgba?\(\s*\d+(\.\d+)?\s*,\s*\d+(\.\d+)?\s*,\s*\d+(\.\d+)?\s*(,\s*\d?\.?\d+\s*)?\)$/.test(normalized);
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

const PRESET_COLORS = [
  '#ff4d4f', '#eb2f96', '#722ed1', '#5b3cc4', '#2f54eb', '#1890ff', '#13c2c2', '#52c41a',
  '#a0d911', '#bfbf00', '#fadb14', '#faad14', '#fa8c16', '#fa541c', '#fa541c', '#8c6d5a',
  '#c49c94', '#ffacc5', '#a68f7e', '#8c8c8c', '#5f6f7a', '#ffffff', '#f5f5f5', '#f6ffed',
  '#000000', '#262626', '#595959', '#8c8c8c',
];

interface ColorPickerProps {
  value: string;
  onChange: (css: string) => void;
  onClear?: () => void;
  onConfirm?: () => void;
  clearLabel?: string;
  confirmLabel?: string;
}

export default function ColorPicker({
  value,
  onChange,
  onClear,
  onConfirm,
  clearLabel = 'Clear',
  confirmLabel = 'OK',
}: ColorPickerProps) {
  const initial = parseCssColor(value);
  const [hsv, setHsv] = useState<{ h: number; s: number; v: number }>(() => rgbToHsv(initial));
  const [alpha, setAlpha] = useState(initial.a);
  const [inputText, setInputText] = useState(value || 'transparent');

  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const alphaRef = useRef<HTMLDivElement>(null);

  const rgba: RgbaColor = { ...hsvToRgb(hsv.h, hsv.s, hsv.v), a: alpha };
  const pure = hsvToRgb(hsv.h, 1, 1);
  const css = rgbaToCss(rgba);

  useEffect(() => {
    setInputText(css);
  }, [css]);

  const commit = useCallback(() => {
    onChange(rgbaToCss({ ...hsvToRgb(hsv.h, hsv.s, hsv.v), a: alpha }));
  }, [hsv, alpha, onChange]);

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

  return (
    <div className="w-64 rounded border border-gray-200 bg-white p-3 shadow-lg">
      {/* SV panel + hue */}
      <div className="mb-2 flex gap-2">
        <div
          ref={svRef}
          className="relative h-36 flex-1 cursor-crosshair rounded"
          style={{
            background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, rgb(${pure.r}, ${pure.g}, ${pure.b}))`,
          }}
          onMouseDown={(e) => startDrag(handleSvDrag, e)}
          onTouchStart={(e) => startDrag(handleSvDrag, e)}
        >
          <div
            className="pointer-events-none absolute h-3 w-3 rounded-full border border-white shadow"
            style={{
              left: `calc(${hsv.s * 100}% - 6px)`,
              top: `calc(${(1 - hsv.v) * 100}% - 6px)`,
              backgroundColor: css,
            }}
          />
        </div>
        <div
          ref={hueRef}
          className="relative h-36 w-5 cursor-pointer rounded"
          style={{
            background: 'linear-gradient(to bottom, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
          }}
          onMouseDown={(e) => startDrag(handleHueDrag, e)}
          onTouchStart={(e) => startDrag(handleHueDrag, e)}
        >
          <div
            className="pointer-events-none absolute left-0 right-0 h-1 rounded bg-white shadow"
            style={{ top: `calc(${(hsv.h / 360) * 100}% - 2px)` }}
          />
        </div>
      </div>

      {/* Alpha slider */}
      <div
        ref={alphaRef}
        className="relative mb-3 h-5 cursor-pointer rounded"
        style={{
          background: `linear-gradient(to right, rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, 0), rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, 1)),
            linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)`,
          backgroundSize: '100% 100%, 10px 10px, 10px 10px',
          backgroundPosition: '0 0, 0 0, 5px 5px',
        }}
        onMouseDown={(e) => startDrag(handleAlphaDrag, e)}
        onTouchStart={(e) => startDrag(handleAlphaDrag, e)}
      >
        <div
          className="pointer-events-none absolute top-0 h-full w-1 rounded bg-white shadow"
          style={{ left: `calc(${alpha * 100}% - 2px)` }}
        />
      </div>

      {/* Presets */}
      <div className="mb-3 grid grid-cols-7 gap-1">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              const parsed = parseCssColor(c);
              setHsv(rgbToHsv(parsed));
              setAlpha(parsed.a);
            }}
            className="h-5 w-full rounded border border-gray-200"
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      {/* Input + actions */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onBlur={() => {
            const parsed = parseCssColor(inputText);
            setHsv(rgbToHsv(parsed));
            setAlpha(parsed.a);
            onChange(rgbaToCss(parsed));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const parsed = parseCssColor(inputText);
              setHsv(rgbToHsv(parsed));
              setAlpha(parsed.a);
              onChange(rgbaToCss(parsed));
            }
          }}
          className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 outline-none focus:border-blue-400"
        />
        <button
          type="button"
          onClick={() => {
            setHsv({ h: 0, s: 0, v: 1 });
            setAlpha(0);
            onClear?.();
          }}
          className="whitespace-nowrap px-2 py-1 text-xs text-blue-500 hover:text-blue-600"
        >
          {clearLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            commit();
            onConfirm?.();
          }}
          className="whitespace-nowrap rounded border border-blue-500 bg-white px-3 py-1 text-xs text-blue-500 hover:bg-blue-50"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
