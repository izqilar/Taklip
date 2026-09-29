/**
 * 填充（Fill）三态 — 单色 / 渐变 / 图案 的唯一真值。
 *
 * 设计原则（与项目既有 color.ts 一致）：
 *  1. **纯函数、无 React / 无 DOM 依赖副作用**：所有换算都在这里，三端（编辑态 Konva、
 *     离屏导出 Konva、发布态 DOM/SVG）只消费结果，不各自推导 → 保证三端一致。
 *  2. **向后兼容**：`fill` 永远表示「单色填充」的原值，历史数据没有 `fillType` 字段时
 *     一律按 `solid` 处理，渲染路径与改造前逐字节相同。
 *  3. **三份数据互不覆盖**：`fill`（单色）/ `gradientFill`（渐变）/ `patternFill`（图案）
 *     是三个独立存储槽，切换类型只改 `fillType`，另两份原样保留 → 来回切换不丢配置。
 *
 * 几何口径（关键，三端必须同一套）：
 *  - 线性渐变角度沿用 CSS 语义：`0deg` 自下而上、`90deg` 自左向右，顺时针递增。
 *    渐变线过盒子中心，长度 `L = |W·sinθ| + |H·cosθ|`。CSS `linear-gradient(Ndeg, …)`
 *    用的正是这条定义，故 DOM 侧直接写 `Ndeg` 即与 Konva/SVG 的端点换算结果一致。
 *  - 径向渐变固定为 `circle farthest-corner at 50% 50%`：圆心即盒中心，
 *    半径 = 中心到最远角的距离。Konva 用 (start=center,r=0) → (end=center,r=R) 表达，
 *    CSS 用 `radial-gradient(circle farthest-corner at 50% 50%, …)`，两者等价。
 *  - 图案：先离屏画出**一块瓦片 canvas**，DOM 用它的 dataURL 作 `background-image` +
 *    `background-size`，Konva 直接把这块 canvas 交给 `fillPatternImage`。
 *    两端消费**同一块像素**，从根本上杜绝「编辑器与预览图案不一致」。
 */

import { applyAlphaFactor, resolveFillColor } from './color';

/* ────────────────────────────── 类型 ────────────────────────────── */

/** 填充类型：单色（默认）/ 渐变 / 图案 / 图片 / 视频 / 混合模式 */
export type FillType = 'solid' | 'gradient' | 'pattern' | 'image' | 'video' | 'blend';

export const FILL_TYPES: readonly FillType[] = ['solid', 'gradient', 'pattern', 'image', 'video', 'blend'];

/** 渐变上的一个颜色停靠点 */
export interface GradientStop {
  /** CSS 颜色；支持 alpha（rgba(...)） */
  color: string;
  /** 位置 0~1 */
  position: number;
}

/**
 * 渐变类型：线性 / 径向 / 角度 / 菱形。
 *
 * ⚠️ 渲染口径（与设计稿的 UI 能力区分开）：
 *  设计稿的下拉提供四种类型，但本仓库当前的三端渲染内核（Konva / DOM / SVG）只原生表达
 *  **线性**与**径向**两种几何。因此 `conic`（角度）与 `diamond`（菱形）当前按「近似」渲染：
 *    · conic（角度渐变）  → 按 `angle` 当作线性渐变绘制；
 *    · diamond（菱形渐变）→ 按径向渐变绘制。
 *  近似映射集中在 `renderGradientKind()` 一处，三端共用同一个近似，
 *  从而保证「编辑器预览 / 导出 / 发布」三者之间仍然逐像素一致（不会一端 conic、一端 linear）。
 *  编辑器面板会为这两种类型显示「近似」提示，等真渲染管线落地后只需替换本函数。
 */
export type GradientKind = 'linear' | 'radial' | 'conic' | 'diamond';

export const GRADIENT_KINDS: readonly GradientKind[] = ['linear', 'radial', 'conic', 'diamond'];

/** 渐变填充配置 */
export interface GradientFill {
  /** 线性 / 径向 / 角度 / 菱形 */
  type: GradientKind;
  /** 渐变角度（CSS 语义，度）；半径类（radial/diamond）时忽略 */
  angle: number;
  /** 至少 2 个停靠点 */
  stops: GradientStop[];
}

/** 内置图案种类（瓦片绘制函数见文末 DRAWERS） */
export type PatternKind =
  | 'checker'
  | 'dots'
  | 'grid'
  | 'diagonal'
  | 'crosshatch'
  | 'diamond'
  | 'zigzag'
  | 'waves';

export const PATTERN_KINDS: readonly PatternKind[] = [
  'checker',
  'dots',
  'grid',
  'diagonal',
  'crosshatch',
  'diamond',
  'zigzag',
  'waves',
];

/** 图案瓦片的基准边长（px）；实际边长 = 基准 × scale */
export const PATTERN_BASE_TILE = 24;

/** 图案填充配置 */
export interface PatternFill {
  kind: PatternKind;
  /** 前景色（图案线条/色块） */
  foreground: string;
  /** 背景色（可为 transparent） */
  background: string;
  /** 平铺倍率，实际瓦片边长 = PATTERN_BASE_TILE × scale */
  scale: number;
}

/** 图片填充配置：用一张图片填充形状（区别于「图案」几何瓦片） */
export interface ImageFill {
  /** 图片地址（dataURL 或远程 URL） */
  href: string;
  /** 适配方式：cover 等比铺满并裁剪 / contain 完整显示 / repeat 原始尺寸平铺 */
  fit?: 'cover' | 'contain' | 'repeat';
  /** 图片填充不透明度 0~1（默认 1） */
  opacity?: number;
}

/**
 * 视频填充配置：用一段视频的**当前帧**作为填充纹理。
 *
 * ⚠️ 几何口径：视频填充与图片填充共用同一套 Konva `fillPatternImage` / DOM `background-image`
 * 管线，喂进去的是从 `<video>` 抓下来的**一帧 canvas**。之所以不做「实时播放」，
 * 是因为填充属性（`fillPatternImage`）只接受静态图像源，且导出链路是离屏静态渲染；
 * 抓帧方案让「编辑器 / 导出 / 发布」三端消费同一块像素，导出的就是你看到的那一帧。
 * `time`（取帧时刻，秒）即 Photoshop 里「视频填充」起始时间点的心智。
 */
export interface VideoFill {
  /** 视频地址（dataURL 或远程 URL） */
  href: string;
  /** 取帧时刻（秒，默认 0 = 首帧） */
  time?: number;
  /** 适配方式，语义同 ImageFill */
  fit?: 'cover' | 'contain' | 'repeat';
  /** 不透明度 0~1（默认 1） */
  opacity?: number;
}

/**
 * 混合模式填充：以 `fill` 为基底色，并按所选混合模式与下层内容混合。
 * 取值沿用 Canvas / CSS 的通用命名（`globalCompositeOperation` 与 `mix-blend-mode` 交集）。
 */
export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

export const BLEND_MODES: readonly BlendMode[] = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'color',
  'luminosity',
];

export const DEFAULT_BLEND_MODE: BlendMode = 'normal';

export function normalizeBlendMode(raw?: string | null): BlendMode {
  return raw && (BLEND_MODES as readonly string[]).includes(raw) ? (raw as BlendMode) : DEFAULT_BLEND_MODE;
}

/**
 * Canvas 的 `globalCompositeOperation`（即 Konva 的 `globalCompositeOperationType`）精确取值集合。
 * 用此联合类型而非 `string`，可直接透传给 react-konva 的节点配置（其类型要求字面量联合）。
 */
export type CanvasBlendOp =
  | 'source-over'
  | 'source-in'
  | 'source-out'
  | 'source-atop'
  | 'destination-over'
  | 'destination-in'
  | 'destination-out'
  | 'destination-atop'
  | 'lighter'
  | 'darken'
  | 'lighten'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

/**
 * Canvas 的 `globalCompositeOperation` 与 CSS `mix-blend-mode` 命名基本一致，
 * 唯一需要换算的是 `normal`：Canvas 里叫 `source-over`。
 */
export function blendModeToCanvas(mode: BlendMode | undefined): CanvasBlendOp {
  if (!mode || mode === 'normal') return 'source-over';
  return mode as CanvasBlendOp;
}

/** CSS 的混写值；`normal` 即 CSS 默认值 */
export function blendModeToCss(mode: BlendMode | undefined): BlendMode {
  return mode ?? DEFAULT_BLEND_MODE;
}

/**
 * 具备「可切换填充类型」能力的元素（结构类型，避免与 Element 联合类型耦合）。
 * 所有带 `fill` 的元素（rect/circle/ellipse/polygon/star/triangle/button/text）都满足。
 */
export interface FillCapable {
  fill?: string;
  /** 填充不透明度 0~1（默认 1），与颜色自带 alpha 相乘 */
  fillOpacity?: number;
  fillType?: FillType;
  gradientFill?: GradientFill | null;
  patternFill?: PatternFill | null;
  imageFill?: ImageFill | null;
  videoFill?: VideoFill | null;
  /** 混合模式（fillType='blend' 时生效）：元素与下层内容的混合方式 */
  blendMode?: BlendMode | string | null;
}

/** 元素局部坐标系中的「填充外框」：渐变/图案几何都以此为准 */
export interface FillBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/* ────────────────────────────── 默认值 ────────────────────────────── */

export const DEFAULT_GRADIENT_ANGLE = 90;

/** 首次切到「渐变填充」时的默认配置（Photoshop 口径：前景 → 白，左到右） */
export const DEFAULT_GRADIENT_FILL: GradientFill = {
  type: 'linear',
  angle: DEFAULT_GRADIENT_ANGLE,
  stops: [
    { color: '#111827', position: 0 },
    { color: '#ffffff', position: 1 },
  ],
};

/** 首次切到「图案填充」时的默认配置 */
export const DEFAULT_PATTERN_FILL: PatternFill = {
  kind: 'checker',
  foreground: '#111827',
  background: '#ffffff',
  scale: 1,
};

/** 由当前单色派生一份渐变配置（切换类型时的兜底，不改写 fill 本身） */
export function gradientFromSolid(solid?: string): GradientFill {
  const c = solid && solid !== 'transparent' ? solid : DEFAULT_GRADIENT_FILL.stops[0].color;
  return {
    type: 'linear',
    angle: DEFAULT_GRADIENT_ANGLE,
    stops: [
      { color: c, position: 0 },
      { color: '#ffffff', position: 1 },
    ],
  };
}

/** 由当前单色派生一份图案配置 */
export function patternFromSolid(solid?: string): PatternFill {
  return {
    ...DEFAULT_PATTERN_FILL,
    foreground: solid && solid !== 'transparent' ? solid : DEFAULT_PATTERN_FILL.foreground,
  };
}

/* ────────────────────────────── 工具 ────────────────────────────── */

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function clamp01(n: number): number {
  return clamp(n, 0, 1);
}

function round(n: number, digits = 4): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** 当前生效的填充类型；缺省/非法一律 'solid'（历史数据零改动的关键） */
export function getFillType(el?: FillCapable | null): FillType {
  const t = el?.fillType;
  return t === 'gradient' || t === 'pattern' || t === 'image' || t === 'video' || t === 'blend' ? t : 'solid';
}

/** 元素填充不透明度（0~1，缺省 1） */
function fillOpacityOf(el: FillCapable): number {
  const o = el.fillOpacity;
  return Number.isFinite(o) ? clamp01(o as number) : 1;
}

/* ────────────────────────────── 渐变 ────────────────────────────── */

/**
 * 归一化渐变：排序 + 夹紧 + 剔除非法停靠点。
 * 停靠点不足 2 个时返回 undefined（调用方回落为单色，避免 Konva/CSS 因空渐变崩溃）。
 */
export function normalizeGradient(raw?: GradientFill | null): GradientFill | undefined {
  if (!raw || !Array.isArray(raw.stops)) return undefined;
  const stops = raw.stops
    .filter((s) => s && typeof s.color === 'string')
    .map((s) => ({
      color: s.color || '#000000',
      position: clamp01(Number.isFinite(s.position) ? s.position : 0),
    }))
    .sort((a, b) => a.position - b.position);
  if (stops.length < 2) return undefined;
  const type: GradientKind = (GRADIENT_KINDS as readonly string[]).includes(raw.type)
    ? (raw.type as GradientKind)
    : 'linear';
  const angle = Number.isFinite(raw.angle) ? raw.angle : DEFAULT_GRADIENT_ANGLE;
  return { type, angle, stops };
}

/**
 * 渐变类型 → 渲染内核实际使用的几何。
 *
 * 三端渲染器只消费 `'linear' | 'radial'`；`conic`（角度）与 `diamond`（菱形）暂时近似：
 *   · conic   → linear（用 angle 决定方向）
 *   · diamond → radial
 * 三端共用本函数，故近似结果完全一致，不会出现「预览是角度、发布是线性」的错配。
 */
export function renderGradientKind(kind: GradientKind): 'linear' | 'radial' {
  if (kind === 'radial' || kind === 'diamond') return 'radial';
  return 'linear';
}

/**
 * CSS 语义角度 → 渐变线端点（相对盒子左上角）。
 * 与 CSS `linear-gradient(Ndeg, …)` 的定义完全一致，故三端可共用。
 */
export function gradientLineGeometry(
  angleDeg: number,
  width: number,
  height: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const a = (angleDeg * Math.PI) / 180;
  const sin = Math.sin(a);
  const cos = Math.cos(a);
  const len = Math.abs(width * sin) + Math.abs(height * cos);
  const cx = width / 2;
  const cy = height / 2;
  // 方向向量 (sin, -cos)：0deg 指向上方（"to top"），90deg 指向右方（"to right"）
  const dx = (sin * len) / 2;
  const dy = (-cos * len) / 2;
  return { x1: cx - dx, y1: cy - dy, x2: cx + dx, y2: cy + dy };
}

/** 径向渐变几何（circle farthest-corner） */
export function radialGeometry(
  width: number,
  height: number,
): { cx: number; cy: number; r: number } {
  const cx = width / 2;
  const cy = height / 2;
  return { cx, cy, r: Math.sqrt(cx * cx + cy * cy) };
}

/** 停靠点 → CSS `color xx%` 片段（已折算 fillOpacity） */
function cssStops(stops: GradientStop[], opacity: number): string {
  return stops
    .map((s) => `${applyAlphaFactor(s.color, opacity)} ${round(s.position * 100, 2)}%`)
    .join(', ');
}

/** 停靠点 → Konva 扁平数组 `[pos, color, pos, color, …]`（已折算 fillOpacity、单调递增） */
function konvaStops(stops: GradientStop[], opacity: number): (number | string)[] {
  const out: (number | string)[] = [];
  for (const s of stops) {
    out.push(clamp01(s.position), applyAlphaFactor(s.color, opacity));
  }
  return out;
}

/** 停靠点 → SVG `<stop offset color>` 数据 */
function svgStops(stops: GradientStop[], opacity: number): { offset: number; color: string }[] {
  return stops.map((s) => ({ offset: clamp01(s.position), color: applyAlphaFactor(s.color, opacity) }));
}

/**
 * 在渐变上取色（在 `position` 处线性插值）。
 * 用于「点击渐变条新增停靠点」时用当前位置的颜色播种，避免凭空插入一个突兀的颜色。
 */
export function sampleGradientColor(stops: GradientStop[], position: number): string {
  const list = [...stops]
    .filter((s) => s && Number.isFinite(s.position))
    .sort((a, b) => a.position - b.position);
  if (list.length === 0) return '#000000';
  const p = clamp01(position);
  if (p <= list[0].position) return list[0].color;
  const last = list[list.length - 1];
  if (p >= last.position) return last.color;
  for (let i = 0; i < list.length - 1; i++) {
    const a = list[i];
    const b = list[i + 1];
    if (p >= a.position && p <= b.position) {
      const span = b.position - a.position;
      const t = span <= 0 ? 0 : (p - a.position) / span;
      return mixColor(a.color, b.color, t);
    }
  }
  return last.color;
}

/** 两个 CSS 颜色按 t（0~1）线性插值（在 sRGB 上按通道混合，输出 rgba） */
function mixColor(from: string, to: string, t: number): string {
  const a = applyAlphaFactor(from, 1);
  const b = applyAlphaFactor(to, 1);
  const ca = parseColorChannels(a);
  const cb = parseColorChannels(b);
  const k = clamp01(t);
  const r = Math.round(ca.r + (cb.r - ca.r) * k);
  const g = Math.round(ca.g + (cb.g - ca.g) * k);
  const bl = Math.round(ca.b + (cb.b - ca.b) * k);
  const al = round(ca.a + (cb.a - ca.a) * k, 3);
  return al >= 1 ? `#${hex2(r)}${hex2(g)}${hex2(bl)}` : `rgba(${r}, ${g}, ${bl}, ${al})`;
}

function hex2(n: number): string {
  return clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
}

/** 只取通道数值（避免与 color.ts 的 parseCssColor 语义耦合过重） */
function parseColorChannels(css: string): { r: number; g: number; b: number; a: number } {
  const s = (css || '').trim().toLowerCase();
  if (s === 'transparent' || s === '') return { r: 255, g: 255, b: 255, a: 0 };
  if (s.startsWith('#')) {
    const h = s.slice(1);
    if (h.length === 3 || h.length === 4) {
      return {
        r: parseInt(h[0] + h[0], 16),
        g: parseInt(h[1] + h[1], 16),
        b: parseInt(h[2] + h[2], 16),
        a: h.length === 4 ? parseInt(h[3] + h[3], 16) / 255 : 1,
      };
    }
    if (h.length >= 6) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
      };
    }
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(',').map((x) => parseFloat(x.trim()));
    return {
      r: clamp(parts[0] || 0, 0, 255),
      g: clamp(parts[1] || 0, 0, 255),
      b: clamp(parts[2] || 0, 0, 255),
      a: Number.isFinite(parts[3]) ? clamp(parts[3], 0, 1) : 1,
    };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}

/** 渐变 → CSS `background-image` 值（角度/菱形按 renderGradientKind 近似，与 Konva/SVG 同源） */
export function gradientToCss(g: GradientFill, opacity = 1): string {
  const stops = cssStops(g.stops, opacity);
  if (renderGradientKind(g.type) === 'radial') {
    return `radial-gradient(circle farthest-corner at 50% 50%, ${stops})`;
  }
  return `linear-gradient(${round(g.angle, 2)}deg, ${stops})`;
}

/* ────────────────────────────── 图案 ────────────────────────────── */

export function normalizePattern(raw?: PatternFill | null): PatternFill | undefined {
  if (!raw) return undefined;
  const kind = (PATTERN_KINDS as readonly string[]).includes(raw.kind) ? raw.kind : 'checker';
  return {
    kind: kind as PatternKind,
    foreground: raw.foreground || DEFAULT_PATTERN_FILL.foreground,
    background: raw.background || 'transparent',
    scale: clamp(Number.isFinite(raw.scale) ? raw.scale : 1, 0.2, 5),
  };
}

/** 实际瓦片边长（px） */
export function patternTileSize(p: PatternFill): number {
  return Math.max(4, Math.round(PATTERN_BASE_TILE * clamp(Number.isFinite(p.scale) ? p.scale : 1, 0.2, 5)));
}

type Drawer = (ctx: CanvasRenderingContext2D, s: number) => void;

/** 45° 斜条纹（斜率 +1）：族 y = x + k·p，p = s/2 → 沿 x/y 平移 s 后仍自重合 */
function strokeDiagonal(ctx: CanvasRenderingContext2D, s: number, sign: number, lw: number): void {
  const p = s / 2;
  ctx.lineWidth = lw;
  ctx.beginPath();
  for (let k = -2; k <= 3; k++) {
    ctx.moveTo(0, k * p);
    ctx.lineTo(s, sign * s + k * p);
  }
  ctx.stroke();
}

/**
 * 各图案的瓦片绘制函数。**必须无缝**：沿 x 或 y 平移一个瓦片后图案自重合，
 * 否则平铺后会出现接缝。
 */
const PATTERN_DRAWERS: Record<PatternKind, Drawer> = {
  checker: (ctx, s) => {
    const h = s / 2;
    ctx.fillRect(0, 0, h, h);
    ctx.fillRect(h, h, h, h);
  },
  dots: (ctx, s) => {
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, Math.max(0.6, s * 0.18), 0, Math.PI * 2);
    ctx.fill();
  },
  grid: (ctx, s) => {
    const lw = Math.max(0.5, s * 0.09);
    ctx.lineWidth = lw;
    ctx.beginPath();
    // 沿四条边各描一半线宽，相邻瓦片拼起来正好是一条完整网格线
    ctx.moveTo(0, 0);
    ctx.lineTo(0, s);
    ctx.moveTo(s, 0);
    ctx.lineTo(s, s);
    ctx.moveTo(0, 0);
    ctx.lineTo(s, 0);
    ctx.moveTo(0, s);
    ctx.lineTo(s, s);
    ctx.stroke();
  },
  diagonal: (ctx, s) => strokeDiagonal(ctx, s, 1, Math.max(0.5, s * 0.14)),
  crosshatch: (ctx, s) => {
    const lw = Math.max(0.5, s * 0.12);
    strokeDiagonal(ctx, s, 1, lw);
    strokeDiagonal(ctx, s, -1, lw);
  },
  diamond: (ctx, s) => {
    ctx.beginPath();
    ctx.moveTo(s / 2, 0);
    ctx.lineTo(s, s / 2);
    ctx.lineTo(s / 2, s);
    ctx.lineTo(0, s / 2);
    ctx.closePath();
    ctx.fill();
  },
  zigzag: (ctx, s) => {
    ctx.lineWidth = Math.max(0.5, s * 0.1);
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    ctx.moveTo(0, s * 0.7);
    ctx.lineTo(s * 0.25, s * 0.3);
    ctx.lineTo(s * 0.5, s * 0.7);
    ctx.lineTo(s * 0.75, s * 0.3);
    ctx.lineTo(s, s * 0.7); // 首尾同高 → 横向平移无缝
    ctx.stroke();
  },
  waves: (ctx, s) => {
    ctx.lineWidth = Math.max(0.5, s * 0.1);
    ctx.beginPath();
    const amp = s * 0.22;
    const steps = 64;
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * s;
      const y = s / 2 + amp * Math.sin((i / steps) * Math.PI * 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  },
};

interface TileEntry {
  canvas: HTMLCanvasElement;
  url: string;
}

/** 瓦片缓存：同一份配置三端共用同一块像素，同时避免每帧重画 + 反复 toDataURL */
const tileCache = new Map<string, TileEntry>();
const TILE_CACHE_MAX = 64;

function tileKey(p: PatternFill, opacity: number): string {
  return [
    p.kind,
    p.foreground,
    p.background,
    round(p.scale, 2),
    round(opacity, 3),
    PATTERN_BASE_TILE,
  ].join('|');
}

/**
 * 生成（或从缓存取）一块图案瓦片。
 * 返回 undefined 表示当前环境无法绘制（SSR / 无 canvas），调用方应回落到单色。
 */
export function buildPatternTile(p: PatternFill, opacity = 1): HTMLCanvasElement | undefined {
  if (typeof document === 'undefined') return undefined;
  const key = tileKey(p, opacity);
  const hit = tileCache.get(key);
  if (hit) return hit.canvas;

  const size = patternTileSize(p);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  // 背景：alpha 已按 fillOpacity 折算（与单色填充的 applyAlphaFactor 语义一致）
  const bg = applyAlphaFactor(p.background, opacity);
  if (bg !== 'transparent') {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
  }
  const fg = applyAlphaFactor(p.foreground, opacity);
  if (fg !== 'transparent') {
    ctx.fillStyle = fg;
    ctx.strokeStyle = fg;
    PATTERN_DRAWERS[p.kind](ctx, size);
  }

  const entry: TileEntry = { canvas, url: canvas.toDataURL('image/png') };
  if (tileCache.size >= TILE_CACHE_MAX) {
    // 简易 FIFO：缓存只服务于「同一配置复用」，容量到顶丢最旧的一条即可
    const oldest = tileCache.keys().next().value;
    if (oldest !== undefined) tileCache.delete(oldest);
  }
  tileCache.set(key, entry);
  return canvas;
}

/** 图案瓦片的 dataURL（DOM 侧 `background-image` 用） */
export function patternTileDataUrl(p: PatternFill, opacity = 1): string | undefined {
  const canvas = buildPatternTile(p, opacity);
  if (!canvas) return undefined;
  return tileCache.get(tileKey(p, opacity))?.url ?? canvas.toDataURL('image/png');
}

/* ──────────────────────── 图片填充（异步加载） ──────────────────────── */

/**
 * 图片填充与图案填充共用 Konva 的 `fillPatternImage` 机制，但图片需要异步加载。
 * 这里维护一份模块级缓存：konvaFillProps 在图片未就绪时回落单色并返回 undefined，
 * 同时触发加载；加载完成后通过 epoch + 订阅通知画布重绘（见 EditorCanvas 的 useSyncExternalStore）。
 * 与 EditorCanvas 的 `imageCache` 解耦：本缓存专为元素「填充图片」服务，支持 crossOrigin 失败降级。
 */
const imageFillCache = new Map<string, HTMLImageElement | null>();
let imageFillEpoch = 0;
const imageFillListeners = new Set<() => void>();

/** 订阅图片填充加载完成事件（用于触发 Konva 重绘） */
export function subscribeImageFill(cb: () => void): () => void {
  imageFillListeners.add(cb);
  return () => {
    imageFillListeners.delete(cb);
  };
}

/** 同步读取「图片填充」加载纪元（useSyncExternalStore 的 getSnapshot） */
export function getImageFillEpoch(): number {
  return imageFillEpoch;
}

function notifyImageFill(): void {
  imageFillEpoch += 1;
  imageFillListeners.forEach((cb) => cb());
}

/** 同步读取已加载的图片（未加载/加载中返回 null） */
export function getImageFill(href?: string | null): HTMLImageElement | null {
  if (!href) return null;
  return imageFillCache.get(href) ?? null;
}

/** 触发图片加载（幂等：已加载/加载中不再重复）。加载完成自动通知订阅者 */
export function ensureImageFillLoaded(href: string): void {
  if (!href || imageFillCache.has(href)) return;
  if (typeof document === 'undefined') return;
  imageFillCache.set(href, null); // 标记 loading，避免重复发起
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    imageFillCache.set(href, img);
    notifyImageFill();
  };
  img.onerror = () => {
    // 同 EditorCanvas：crossOrigin 被服务器拒绝时降级为不带 crossOrigin 重新加载
    const fb = new Image();
    fb.onload = () => {
      imageFillCache.set(href, fb);
      notifyImageFill();
    };
    fb.onerror = () => {
      imageFillCache.set(href, null);
      notifyImageFill();
    };
    fb.src = href;
  };
  img.src = href;
}

/**
 * 把任意「图像源」按不透明度合成到 canvas 再返回。
 * Konva 没有独立的 `fillPatternOpacity` 属性，填充透明度只能靠预乘到像素里表达。
 * 图片填充与视频填充共用本函数。
 */
function composeWithOpacity(
  source: HTMLImageElement | HTMLCanvasElement | null,
  opacity?: number,
): HTMLImageElement | HTMLCanvasElement | null {
  if (!source) return null;
  const o = typeof opacity === 'number' ? clamp01(opacity) : 1;
  if (o >= 1) return source;
  try {
    const w = (source as HTMLImageElement).naturalWidth || source.width;
    const h = (source as HTMLImageElement).naturalHeight || source.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return source;
    ctx.globalAlpha = o;
    ctx.drawImage(source, 0, 0, w, h);
    return canvas;
  } catch {
    return source;
  }
}

/**
 * 取「图片填充」的绘制源（HTMLImageElement 或带透明度的 canvas）。
 * 当 opacity < 1 时，把图片合成到 canvas 再返回，使 Konva 能表达填充透明度。
 */
function imageFillSource(href: string, opacity?: number): HTMLImageElement | HTMLCanvasElement | null {
  return composeWithOpacity(getImageFill(href), opacity);
}

/* ──────────────────────── 视频填充（抓帧） ──────────────────────── */

/** 归一化视频填充；无地址即视为「未选择视频」（渲染回落单色） */
export function normalizeVideo(raw?: VideoFill | null): VideoFill | undefined {
  if (!raw || !raw.href) return undefined;
  return {
    href: raw.href,
    time: Number.isFinite(raw.time) ? Math.max(0, raw.time as number) : 0,
    fit: raw.fit === 'contain' || raw.fit === 'repeat' ? raw.fit : 'cover',
    opacity: typeof raw.opacity === 'number' ? clamp01(raw.opacity) : 1,
  };
}

/** 首次切到「视频填充」时的默认配置（空地址，等用户上传 / 填链接） */
export const DEFAULT_VIDEO_FILL: VideoFill = { href: '', time: 0, fit: 'cover', opacity: 1 };

interface VideoFrameEntry {
  canvas: HTMLCanvasElement;
  url: string;
}

/**
 * 视频帧缓存。键 = `href#time`：
 *  · 命中 Entry  → 抓帧完成，可渲染
 *  · 命中 null   → 正在加载
 *  · 命中 Failed → 加载失败（编解码不支持 / 跨域 / 网络），**不再重试**
 * 三者都通过同一个 epoch 通知订阅者，保证失败时能稳定回落单色而不是无限重试。
 */
const videoFrameCache = new Map<string, VideoFrameEntry | null>();
const videoFrameFailed = new Set<string>();
let videoFrameEpoch = 0;
const videoFrameListeners = new Set<() => void>();

function videoFrameKey(href: string, time: number): string {
  return `${href}#${round(time, 2)}`;
}

/** 订阅视频帧就绪事件（触发 Konva 重绘，用法同 subscribeImageFill） */
export function subscribeVideoFrame(cb: () => void): () => void {
  videoFrameListeners.add(cb);
  return () => {
    videoFrameListeners.delete(cb);
  };
}

/** 同步读取视频帧纪元（useSyncExternalStore 的 getSnapshot） */
export function getVideoFrameEpoch(): number {
  return videoFrameEpoch;
}

function notifyVideoFrame(): void {
  videoFrameEpoch += 1;
  videoFrameListeners.forEach((cb) => cb());
}

/** 同步读取已就绪的视频帧（未就绪 / 失败返回 null） */
export function getVideoFrame(href?: string | null, time = 0): HTMLCanvasElement | null {
  if (!href) return null;
  return videoFrameCache.get(videoFrameKey(href, time))?.canvas ?? null;
}

/** 已就绪视频帧的 dataURL（DOM / SVG 侧用；未就绪返回 undefined） */
export function videoFrameDataUrl(href?: string | null, time = 0): string | undefined {
  if (!href) return undefined;
  return videoFrameCache.get(videoFrameKey(href, time))?.url;
}

/** 「视频帧 × 不透明度」合成结果的 dataURL 缓存（DOM 侧无法用 CSS 表达填充透明度，只能预乘） */
const videoComposedUrlCache = new Map<string, string>();
const VIDEO_COMPOSED_CACHE_MAX = 32;

/**
 * 视频帧「预乘不透明度后」的 dataURL —— DOM / SVG 侧与 Konva 端保持一致的唯一途径。
 * 不透明度 = 1 时直接复用原帧 dataURL（零额外开销）。
 */
export function videoFrameUrl(href?: string | null, time = 0, opacity?: number): string | undefined {
  if (!href) return undefined;
  const base = videoFrameDataUrl(href, time);
  if (!base) return undefined;
  const o = typeof opacity === 'number' ? clamp01(opacity) : 1;
  if (o >= 1) return base;
  const key = `${href}#${round(time, 2)}#${round(o, 3)}`;
  const hit = videoComposedUrlCache.get(key);
  if (hit) return hit;
  const frame = getVideoFrame(href, time);
  if (!frame) return base;
  const composed = composeWithOpacity(frame, o);
  if (!(composed instanceof HTMLCanvasElement)) return base;
  const url = composed.toDataURL('image/png');
  if (videoComposedUrlCache.size >= VIDEO_COMPOSED_CACHE_MAX) {
    const oldest = videoComposedUrlCache.keys().next().value;
    if (oldest !== undefined) videoComposedUrlCache.delete(oldest);
  }
  videoComposedUrlCache.set(key, url);
  return url;
}

/**
 * 触发视频抓帧（幂等）。`<video preload="auto">` → loadeddata → 定位 time → seeked → drawImage。
 *
 * 注意服务端导出场景：puppeteer 自带的 Chromium **通常不含 H.264 等专有编解码器**，
 * 因此导出时可能抓帧失败 —— 此时按设计回落单色（`fill`），不会产出坏图，但视频纹理不会出现在导出图里。
 */
export function ensureVideoFrameLoaded(href: string, time = 0): void {
  if (!href || typeof document === 'undefined') return;
  const key = videoFrameKey(href, time);
  if (videoFrameCache.has(key) || videoFrameFailed.has(key)) return;
  videoFrameCache.set(key, null); // 标记 loading

  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;

  const fail = () => {
    videoFrameCache.delete(key);
    videoFrameFailed.add(key);
    notifyVideoFrame();
  };

  const grab = () => {
    try {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) {
        fail();
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        fail();
        return;
      }
      ctx.drawImage(video, 0, 0, w, h);
      videoFrameCache.set(key, { canvas, url: canvas.toDataURL('image/png') });
      notifyVideoFrame();
    } catch {
      // 跨域污染画布时 toDataURL 抛 SecurityError —— 与加载失败同一处理
      fail();
    }
  };

  video.onloadeddata = () => {
    if (time > 0) {
      video.onseeked = () => grab();
      try {
        video.currentTime = time;
      } catch {
        grab();
      }
    } else {
      grab();
    }
  };
  video.onerror = fail;
  video.src = href;
}

/* ──────────────────────── 三端统一的解析器 ──────────────────────── */

/** Konva 侧填充属性；单色时为 undefined，调用方沿用原有 `fill={...}` 表达式 */
export interface KonvaFillProps {
  fill?: string;
  fillPriority?: 'color' | 'pattern' | 'linear-gradient' | 'radial-gradient';
  fillLinearGradientStartPoint?: { x: number; y: number };
  fillLinearGradientEndPoint?: { x: number; y: number };
  fillLinearGradientColorStops?: (number | string)[];
  fillRadialGradientStartPoint?: { x: number; y: number };
  fillRadialGradientEndPoint?: { x: number; y: number };
  fillRadialGradientStartRadius?: number;
  fillRadialGradientEndRadius?: number;
  fillRadialGradientColorStops?: (number | string)[];
  /**
   * 图案瓦片。**运行时实际传的是 HTMLCanvasElement**（离屏画出的瓦片，见 buildPatternTile），
   * canvas 的 `createPattern` 原生接受它，Konva 也只是原样透传（Shape.js 唯一用法就是
   * `ctx.createPattern(this.fillPatternImage(), …)`）。
   * 此处按 Konva 的 TS 声明写成 HTMLImageElement，避免在 16 个调用点重复断言。
   */
  fillPatternImage?: HTMLImageElement;
  fillPatternRepeat?: string;
  fillPatternScaleX?: number;
  fillPatternScaleY?: number;
  fillPatternX?: number;
  fillPatternY?: number;
  fillPatternOffsetX?: number;
  fillPatternOffsetY?: number;
  /**
   * 混合模式（Konva 直接透传给 ctx.globalCompositeOperation）。
   * 仅在 `fillType='blend'` 时由 konvaFill 设为目标模式，其余情况恒为 'source-over'
   * （即 Konva 默认值，保证未使用混合模式的元素渲染结果不受影响）。
   */
  globalCompositeOperation?: CanvasBlendOp;
}

/**
 * 元素在 Konva 侧需要的填充属性。
 * @param box 元素局部坐标系中的填充外框（原点随形状而异，见 fillBox* 助手）
 * @returns 渐变/图案生效时返回属性集；单色（或配置非法）返回 undefined
 */
/**
 * 显式清空「其它填充类型」的属性。
 * 必须显式复位：从渐变/图案切回单色时，若只传 `fill` 而不清 gradient/pattern，
 * 节点上会残留上一类型的属性（Konva 的 `hasFill()` 会因此恒为 true），
 * 不能依赖 react-konva 的属性回收行为。
 */
function clearedFillProps(): KonvaFillProps {
  return {
    fillPriority: 'color',
    fillLinearGradientColorStops: undefined,
    fillRadialGradientColorStops: undefined,
    fillPatternImage: undefined,
    // 'source-over' 就是 Konva 的默认值：未用混合模式的元素渲染结果不受影响
    globalCompositeOperation: 'source-over',
  };
}

/**
 * 由「一块图像源」生成 Konva 图案填充属性（图片填充 / 视频帧共用同一套几何口径）。
 * cover / contain 用等比缩放 + 居中偏移表达；repeat 按原始像素尺寸平铺。
 */
function konvaImagePatternProps(
  el: FillCapable,
  source: HTMLImageElement | HTMLCanvasElement,
  box: FillBox,
  fit: 'cover' | 'contain' | 'repeat',
): KonvaFillProps {
  const iw = (source as HTMLImageElement).naturalWidth || source.width;
  const ih = (source as HTMLImageElement).naturalHeight || source.height;
  const bw = box.width;
  const bh = box.height;
  const props: KonvaFillProps = {
    ...clearedFillProps(),
    fill: el.fill,
    fillPriority: 'pattern',
    // 见 KonvaFillProps.fillPatternImage 的说明：运行时是 canvas，此处按 Konva 声明断言
    fillPatternImage: source as unknown as HTMLImageElement,
  };
  if (fit === 'repeat') {
    props.fillPatternRepeat = 'repeat';
    props.fillPatternX = box.x;
    props.fillPatternY = box.y;
    props.fillPatternScaleX = 1;
    props.fillPatternScaleY = 1;
    return props;
  }
  // cover / contain：等比缩放并居中（Konva 图案从 fillPatternX/Y 铺开，offset 复位）
  const scale =
    fit === 'cover'
      ? Math.max(bw / (iw || 1), bh / (ih || 1))
      : Math.min(bw / (iw || 1), bh / (ih || 1));
  props.fillPatternRepeat = 'no-repeat';
  props.fillPatternScaleX = scale;
  props.fillPatternScaleY = scale;
  props.fillPatternX = box.x + (bw - iw * scale) / 2;
  props.fillPatternY = box.y + (bh - ih * scale) / 2;
  return props;
}

export function konvaFillProps(el: FillCapable, box: FillBox): KonvaFillProps | undefined {
  const type = getFillType(el);
  const opacity = fillOpacityOf(el);

  if (type === 'gradient') {
    const g = normalizeGradient(el.gradientFill);
    if (!g) return undefined;
    const stops = konvaStops(g.stops, opacity);
    if (renderGradientKind(g.type) === 'radial') {
      const { cx, cy, r } = radialGeometry(box.width, box.height);
      return {
        ...clearedFillProps(),
        // 保留 fill 作为兜底（Konva 在无 gradient 时会回落使用它）
        fill: el.fill,
        fillPriority: 'radial-gradient',
        fillRadialGradientStartPoint: { x: box.x + cx, y: box.y + cy },
        fillRadialGradientEndPoint: { x: box.x + cx, y: box.y + cy },
        fillRadialGradientStartRadius: 0,
        fillRadialGradientEndRadius: r,
        fillRadialGradientColorStops: stops,
      };
    }
    const geo = gradientLineGeometry(g.angle, box.width, box.height);
    return {
      ...clearedFillProps(),
      fill: el.fill,
      fillPriority: 'linear-gradient',
      fillLinearGradientStartPoint: { x: box.x + geo.x1, y: box.y + geo.y1 },
      fillLinearGradientEndPoint: { x: box.x + geo.x2, y: box.y + geo.y2 },
      fillLinearGradientColorStops: stops,
    };
  }

  if (type === 'pattern') {
    const p = normalizePattern(el.patternFill);
    if (!p) return undefined;
    const image = buildPatternTile(p, opacity);
    if (!image) return undefined;
    return {
      ...clearedFillProps(),
      fill: el.fill,
      fillPriority: 'pattern',
      fillPatternImage: image as unknown as HTMLImageElement,
      fillPatternRepeat: 'repeat',
      fillPatternScaleX: 1,
      fillPatternScaleY: 1,
    };
  }

  if (type === 'image') {
    const imgF = el.imageFill;
    if (!imgF || !imgF.href) return undefined;
    const source = imageFillSource(imgF.href, imgF.opacity);
    if (!source) {
      // 未就绪：回落单色，同时触发异步加载；加载完成后 epoch 通知画布重绘
      ensureImageFillLoaded(imgF.href);
      return undefined;
    }
    return konvaImagePatternProps(el, source, box, imgF.fit ?? 'cover');
  }

  if (type === 'video') {
    const vF = normalizeVideo(el.videoFill);
    if (!vF) return undefined;
    const time = vF.time ?? 0;
    const frame = getVideoFrame(vF.href, time);
    if (!frame) {
      // 未就绪：回落单色并触发抓帧；抓帧失败（编解码/跨域）不再重试，稳定停在单色
      ensureVideoFrameLoaded(vF.href, time);
      return undefined;
    }
    const source = composeWithOpacity(frame, vF.opacity);
    if (!source) return undefined;
    return konvaImagePatternProps(el, source, box, vF.fit ?? 'cover');
  }

  if (type === 'blend') {
    // 混合模式填充：以单色为基底色，混合方式交给 Konva 的 globalCompositeOperation
    return {
      ...clearedFillProps(),
      fill: resolveFillColor(el) ?? el.fill,
      globalCompositeOperation: blendModeToCanvas(normalizeBlendMode(el.blendMode)),
    };
  }

  return undefined;
}

/**
 * 元素在 Konva 侧的**完整**填充属性（含单色）。
 * 单色分支与既有写法 `fill={resolveFillColor(el) ?? el.fill}` 完全等价，
 * 因此把画布上的 `fill={...}` 换成 `{...konvaFill(el, box)}` 不会改变任何既有渲染结果。
 */
export function konvaFill(el: FillCapable, box: FillBox): KonvaFillProps {
  // 单色分支同样走 clearedFillProps()：fillPriority='color' 就是 Konva 的默认值，
  // 因此「从未用过渐变/图案的元素」渲染结果与改造前逐字节一致；
  // 而「用过又切回来」的元素也不会残留上一类型的属性。
  return (
    konvaFillProps(el, box) ?? {
      ...clearedFillProps(),
      fill: resolveFillColor(el) ?? el.fill,
    }
  );
}

/** DOM 侧填充样式（background* 字段 + 混合模式） */
export interface DomFillStyle {
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundRepeat?: string;
  backgroundPosition?: string;
  /** 混合模式（CSS `mix-blend-mode`），仅 fillType='blend' 时由 domFillStyle 设置 */
  mixBlendMode?: BlendMode;
}

/** 元素在 DOM 侧需要的填充样式（单色时即既有 `backgroundColor`，行为不变） */
export function domFillStyle(el: FillCapable): DomFillStyle {
  const type = getFillType(el);
  const opacity = fillOpacityOf(el);
  /**
   * 混合模式在 DOM 侧等价于 CSS `mix-blend-mode`。
   * 只在 blend 类型下返回该键，其余类型不返回，保证既有元素的样式对象逐字节不变。
   */
  const blend: DomFillStyle =
    type === 'blend' ? { mixBlendMode: blendModeToCss(normalizeBlendMode(el.blendMode)) } : {};

  if (type === 'gradient') {
    const g = normalizeGradient(el.gradientFill);
    if (g) return { ...blend, backgroundImage: gradientToCss(g, opacity) };
    // 配置非法 → 回落单色，绝不留空导致元素变成透明
    return { ...blend, backgroundColor: el.fill };
  }

  if (type === 'pattern') {
    const p = normalizePattern(el.patternFill);
    const url = p ? patternTileDataUrl(p, opacity) : undefined;
    if (p && url) {
      const size = patternTileSize(p);
      return {
        ...blend,
        backgroundImage: `url("${url}")`,
        backgroundSize: `${size}px ${size}px`,
        backgroundRepeat: 'repeat',
      };
    }
    return { ...blend, backgroundColor: el.fill };
  }

  if (type === 'image') {
    const imgF = el.imageFill;
    if (imgF && imgF.href) {
      const fit = imgF.fit ?? 'cover';
      // DOM 背景图天然支持 cover/contain/repeat，与 Konva 端几何口径一致。
      // 注意：这里直接用原始 href 而非内联 dataURL —— 发布态就是 DOM 渲染，
      // 内联图片会让产物体积暴涨；代价是 imageFill.opacity 在 DOM / SVG 侧不生效
      // （Konva 侧已预乘）。这是改造前既有行为，本轮刻意保持不动。
      return {
        ...blend,
        backgroundImage: `url("${imgF.href}")`,
        backgroundSize: fit === 'repeat' ? 'auto' : fit,
        backgroundRepeat: fit === 'repeat' ? 'repeat' : 'no-repeat',
        backgroundPosition: fit === 'repeat' ? '0 0' : 'center',
      };
    }
    return { ...blend, backgroundColor: el.fill };
  }

  if (type === 'video') {
    const vF = normalizeVideo(el.videoFill);
    if (!vF) return { ...blend, backgroundColor: el.fill };
    const time = vF.time ?? 0;
    // 视频帧只能以 dataURL 形式喂给 CSS（没有可直接引用的静态资源地址）；
    // videoFrameUrl 已把不透明度预乘进去，与 Konva 侧同源
    const url = videoFrameUrl(vF.href, time, vF.opacity);
    if (url) {
      const fit = vF.fit ?? 'cover';
      const frame = getVideoFrame(vF.href, time);
      const size = frame ? `${frame.width}px ${frame.height}px` : 'auto';
      return {
        ...blend,
        backgroundImage: `url("${url}")`,
        backgroundSize: fit === 'repeat' ? size : fit,
        backgroundRepeat: fit === 'repeat' ? 'repeat' : 'no-repeat',
        backgroundPosition: fit === 'repeat' ? '0 0' : 'center',
      };
    }
    // 未就绪 / 抓帧失败 → 回落单色并触发抓帧（失败不重试）
    ensureVideoFrameLoaded(vF.href, time);
    return { ...blend, backgroundColor: el.fill };
  }

  // solid 与 blend 都在此收口：blend 用单色作基底色，混合方式见上面的 blend 字段
  return { ...blend, backgroundColor: el.fill };
}

/** SVG 渐变/图案的 `<defs>` 描述（core 不依赖 React，只产出数据） */
export interface SvgFillDef {
  id: string;
  kind: 'linear' | 'radial' | 'pattern' | 'image';
  /** linear：元素局部 px 坐标 */
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  /** radial */
  cx?: number;
  cy?: number;
  r?: number;
  /** linear 角度（CSS 语义，度） */
  angle?: number;
  stops?: { offset: number; color: string }[];
  /** pattern / image 共用 */
  href?: string;
  tile?: number;
  /** image：填充适配方式与图片原生尺寸 */
  fit?: 'cover' | 'contain' | 'repeat';
  imgW?: number;
  imgH?: number;
  /** image：填充不透明度 0~1 */
  opacity?: number;
}

/** SVG 填充解析结果 */
export interface SvgFillPaint {
  /** 直接给 `<polygon fill=...>` */
  fillAttr: string;
  /** 非空时需要渲染到 `<defs>` */
  def?: SvgFillDef;
  /** 需要施加到形状上的额外内联样式（当前仅混合模式） */
  style?: { mixBlendMode?: BlendMode };
}

/**
 * SVG 形状（star / triangle / polygon）的填充。
 * @returns `fillAttr` 直接给 `<polygon fill=...>`；`def` 非空时需要渲染到 `<defs>`
 */
export function svgFill(el: FillCapable, id: string): SvgFillPaint {
  const type = getFillType(el);
  const opacity = fillOpacityOf(el);
  const blendStyle =
    type === 'blend' ? { mixBlendMode: blendModeToCss(normalizeBlendMode(el.blendMode)) } : undefined;
  const plain = (): SvgFillPaint => {
    const base: SvgFillPaint = { fillAttr: el.fill || 'transparent' };
    if (blendStyle) base.style = blendStyle;
    return base;
  };

  if (type === 'gradient') {
    const g = normalizeGradient(el.gradientFill);
    if (!g) return plain();
    const stops = svgStops(g.stops, opacity);
    return {
      fillAttr: `url(#${id})`,
      // 角度/菱形按 renderGradientKind 近似，与 Konva / DOM 端同一套映射
      def: { id, kind: renderGradientKind(g.type), angle: g.angle, stops },
    };
  }

  if (type === 'pattern') {
    const p = normalizePattern(el.patternFill);
    const url = p ? patternTileDataUrl(p, opacity) : undefined;
    if (p && url) {
      return { fillAttr: `url(#${id})`, def: { id, kind: 'pattern', href: url, tile: patternTileSize(p) } };
    }
    return plain();
  }

  if (type === 'image') {
    const imgF = el.imageFill;
    const img = imgF && imgF.href ? getImageFill(imgF.href) : null;
    if (imgF && imgF.href && img) {
      // SVG 用 <pattern>（userSpaceOnUse）包裹 <image>，靠 preserveAspectRatio 实现 cover/contain
      const fit = imgF.fit ?? 'cover';
      return {
        fillAttr: `url(#${id})`,
        def: {
          id,
          kind: 'image',
          href: imgF.href,
          fit,
          imgW: img.naturalWidth || img.width,
          imgH: img.naturalHeight || img.height,
          opacity: typeof imgF.opacity === 'number' ? clamp01(imgF.opacity) : 1,
        },
      };
    }
    // 图片未加载（SVG 静态渲染无法异步回调）→ 回落单色，并触发加载供画布端使用
    if (imgF && imgF.href) ensureImageFillLoaded(imgF.href);
    return plain();
  }

  if (type === 'video') {
    const vF = normalizeVideo(el.videoFill);
    if (vF) {
      const time = vF.time ?? 0;
      const frame = getVideoFrame(vF.href, time);
      const url = videoFrameUrl(vF.href, time, vF.opacity);
      if (frame && url) {
        // 帧只能作为 dataURL 进 <image>，与 DOM 端同一份像素（不透明度已预乘）
        return {
          fillAttr: `url(#${id})`,
          def: {
            id,
            kind: 'image',
            href: url,
            fit: vF.fit ?? 'cover',
            imgW: frame.width,
            imgH: frame.height,
            opacity: 1,
          },
        };
      }
      // 未就绪 → 回落单色并触发抓帧（失败不重试）
      ensureVideoFrameLoaded(vF.href, time);
    }
    return plain();
  }

  return plain();
}

/** SVG 渐变的几何（由渲染层按元素尺寸补齐，core 只提供换算） */
export function svgGradientGeometry(
  def: SvgFillDef,
  width: number,
  height: number,
): { x1: number; y1: number; x2: number; y2: number } | { cx: number; cy: number; r: number } {
  if (def.kind === 'radial') return radialGeometry(width, height);
  return gradientLineGeometry(def.angle ?? DEFAULT_GRADIENT_ANGLE, width, height);
}

/* ──────────────────────── 填充外框助手 ──────────────────────── */

/**
 * Konva 各形状的局部坐标原点不同，渐变几何必须按「元素框在局部坐标里的位置」换算。
 *  - Rect / Button / Text：带 `offsetX=width/2` 或 Text 无偏移 → 局部 (0,0) 即元素左上角
 *  - Circle / Ellipse / Star / RegularPolygon：节点原点在几何中心 → 局部 (0,0) 是中心
 */
export function fillBoxTopLeft(el: { width: number; height: number }): FillBox {
  return { x: 0, y: 0, width: el.width, height: el.height };
}

export function fillBoxCenter(el: { width: number; height: number }): FillBox {
  return { x: -el.width / 2, y: -el.height / 2, width: el.width, height: el.height };
}

/** Circle：Konva 原点在圆心，且 DOM 侧用直径作为盒子（与既有 circle 渲染一致） */
export function fillBoxCircle(el: { radius?: number; width: number; height: number }): FillBox {
  const r = Number.isFinite(el.radius) ? (el.radius as number) : Math.min(el.width, el.height) / 2;
  const d = r * 2;
  return { x: -r, y: -r, width: d, height: d };
}
