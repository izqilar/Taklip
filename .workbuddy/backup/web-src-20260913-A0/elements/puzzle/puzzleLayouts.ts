/**
 * 拼图（照片墙）布局定义。
 * - 所有坐标均为 0~1 归一化坐标，渲染时按组件 width/height 缩放。
 * - 每个 piece 描述一个独立「图块」的包围盒与形状。
 * - Konva 与 DOM 渲染器共用同一套数据，保证所见即所得。
 */

export type PuzzleLayoutId =
  | 'two-cols'
  | 'two-hearts'
  | 'three-rows'
  | 'two-hexagons'
  | 'three-cols'
  | 'four-rows'
  | 'grid-2x2'
  | 'left-big-right-stacked'
  | 'three-hex-triangle'
  | 'grid-2x2-square'
  | 'jigsaw-4'
  | 'three-hearts'
  | 'four-leaf'
  | 'hex-flower-7'
  | 'hex-star-6'
  | 'hex-cluster-7'
  | 'hex-cluster-7b'
  | 'grid-3x3';

export type PuzzleShape =
  | 'rect'
  | 'hex'
  | 'heart'
  | 'heart-half'
  | 'jigsaw'
  | 'circle'
  | 'triangle';

export interface PuzzlePieceDef {
  /** 相对 x（0~1） */
  x: number;
  /** 相对 y（0~1） */
  y: number;
  /** 相对 width（0~1） */
  w: number;
  /** 相对 height（0~1） */
  h: number;
  shape: PuzzleShape;
  /** 形状变体，如心形左右半、拼图凹凸方向等 */
  variant?: string;
}

export interface PuzzleLayoutDef {
  id: PuzzleLayoutId;
  /** i18n key 后缀，渲染层读取 editor:puzzle.layout.{id} */
  nameKey: string;
  /** 建议图片数量 */
  count: number;
  /** 图块定义 */
  pieces: PuzzlePieceDef[];
}

/* ───────── 基础形状路径生成器（在本地 0~1 坐标系内生成） ───────── */

/** 正六边形顶点（pointy-top，中心 0.5,0.5，适配 bbox） */
function hexPoints(): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const ang = (i * Math.PI) / 3; // pointy-top
    pts.push([0.5 + 0.5 * Math.cos(ang), 0.5 + 0.5 * Math.sin(ang)]);
  }
  return pts;
}

/** 等边三角形顶点（方向 up/down/left/right，中心 0.5,0.5） */
function trianglePoints(direction: string): [number, number][] {
  switch (direction) {
    case 'down':
      return [[0.5, 1], [0, 0], [1, 0]];
    case 'left':
      return [[0, 0.5], [1, 0], [1, 1]];
    case 'right':
      return [[1, 0.5], [0, 1], [0, 0]];
    case 'up':
    default:
      return [[0.5, 0], [1, 1], [0, 1]];
  }
}

/** 心形路径（本地 0~1 bbox，从顶部凹陷开始顺时针） */
export function heartPathD(): string {
  return 'M0.5 0.18 C0.5 0.08 0.35 0 0.22 0 C0.08 0 0 0.12 0 0.28 C0 0.55 0.5 1 0.5 1 C0.5 1 1 0.55 1 0.28 C1 0.12 0.92 0 0.78 0 C0.65 0 0.5 0.08 0.5 0.18 Z';
}

/** 心形左半路径（垂直中线切分，保留左侧） */
export function heartLeftPathD(): string {
  return 'M0.5 0.18 C0.5 0.08 0.35 0 0.22 0 C0.08 0 0 0.12 0 0.28 C0 0.55 0.5 1 0.5 1 L0.5 0.18 Z';
}

/** 心形右半路径 */
export function heartRightPathD(): string {
  return 'M0.5 0.18 C0.5 0.08 0.65 0 0.78 0 C0.92 0 1 0.12 1 0.28 C1 0.55 0.5 1 0.5 1 L0.5 0.18 Z';
}

/** 把本地点数组转为 SVG polygon points 字符串 */
function polygonPoints(pts: [number, number][]): string {
  return pts.map((p) => `${p[0]},${p[1]}`).join(' ');
}

/** 单个 jigsaw 块的简化 SVG path（矩形 + 四边凹凸 tab/slot） */
function buildJigsawPathD(variant: string): string {
  const tabSize = 0.18;
  const slotIn = 0.08;
  const half = tabSize / 2;
  const top = variant.includes('topSlot')
    ? `M0 0 L${0.5 - half} 0 L${0.5 - slotIn} ${slotIn} L${0.5 + slotIn} ${slotIn} L${0.5 + half} 0 L1 0`
    : `M0 0 L1 0`;
  const right = variant.includes('rightTab')
    ? `L1 ${0.5 - half} L${1 - slotIn} ${0.5 - slotIn} L1 ${0.5} L${1 - slotIn} ${0.5 + slotIn} L1 ${0.5 + half} L1 1`
    : variant.includes('rightSlot')
      ? `L1 ${0.5 - half} L${1 + slotIn} ${0.5 - slotIn} L1 ${0.5} L${1 + slotIn} ${0.5 + slotIn} L1 ${0.5 + half} L1 1`
      : `L1 1`;
  const bottom = variant.includes('bottomTab')
    ? `L${0.5 + half} 1 L${0.5 + slotIn} ${1 - slotIn} L${0.5 - slotIn} ${1 - slotIn} L${0.5 - half} 1 L0 1`
    : variant.includes('bottomSlot')
      ? `L${0.5 + half} 1 L${0.5 + slotIn} ${1 + slotIn} L${0.5 - slotIn} ${1 + slotIn} L${0.5 - half} 1 L0 1`
      : `L0 1`;
  const left = variant.includes('leftTab')
    ? `L0 ${0.5 + half} L${slotIn} ${0.5 + slotIn} L0 ${0.5} L${slotIn} ${0.5 - slotIn} L0 ${0.5 - half} L0 0`
    : variant.includes('leftSlot')
      ? `L0 ${0.5 + half} L${-slotIn} ${0.5 + slotIn} L0 ${0.5} L${-slotIn} ${0.5 - slotIn} L0 ${0.5 - half} L0 0`
      : `L0 0`;
  return `${top} ${right} ${bottom} ${left} Z`;
}

/** 根据 piece 形状与变体生成 SVG path 字符串（本地 0~1 坐标） */
export function getShapePathD(piece: PuzzlePieceDef): string {
  switch (piece.shape) {
    case 'rect':
      return 'M0 0 L1 0 L1 1 L0 1 Z';
    case 'hex':
      return `M${polygonPoints(hexPoints())} Z`;
    case 'triangle':
      return `M${polygonPoints(trianglePoints(piece.variant || 'up'))} Z`;
    case 'heart':
      return heartPathD();
    case 'heart-half':
      return piece.variant === 'right' ? heartRightPathD() : heartLeftPathD();
    case 'jigsaw':
      return buildJigsawPathD(piece.variant || '');
    case 'circle':
      return 'M 0.5 0 A 0.5 0.5 0 0 1 0.5 1 A 0.5 0.5 0 0 1 0.5 0 Z';
    default:
      return 'M0 0 L1 0 L1 1 L0 1 Z';
  }
}

/** 根据 piece 形状在 Konva clipFunc 中绘制裁剪路径（ctx 已处于 piece 本地坐标系，原点在左上角） */
export function drawShapeInClip(
  ctx: CanvasRenderingContext2D,
  piece: PuzzlePieceDef,
  w: number,
  h: number,
): void {
  ctx.beginPath();
  switch (piece.shape) {
    case 'rect':
      ctx.rect(0, 0, w, h);
      break;
    case 'hex': {
      const pts = hexPoints();
      ctx.moveTo(pts[0][0] * w, pts[0][1] * h);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * w, pts[i][1] * h);
      ctx.closePath();
      break;
    }
    case 'triangle': {
      const pts = trianglePoints(piece.variant || 'up');
      ctx.moveTo(pts[0][0] * w, pts[0][1] * h);
      ctx.lineTo(pts[1][0] * w, pts[1][1] * h);
      ctx.lineTo(pts[2][0] * w, pts[2][1] * h);
      ctx.closePath();
      break;
    }
    case 'circle': {
      ctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
      ctx.closePath();
      break;
    }
    case 'heart':
    case 'heart-half':
    case 'jigsaw': {
      // Path2D 坐标在 0~1，通过 scale 映射到实际宽高，Konva 会在 clipFunc 后恢复上下文
      ctx.save();
      ctx.scale(w, h);
      const p = new Path2D(getShapePathD(piece));
      ctx.clip(p);
      ctx.restore();
      return;
    }
    default:
      ctx.rect(0, 0, w, h);
  }
}

/** 布局列表 */
export const PUZZLE_LAYOUTS: PuzzleLayoutDef[] = [
  {
    id: 'two-cols',
    nameKey: 'twoCols',
    count: 2,
    pieces: [
      { x: 0, y: 0, w: 0.5, h: 1, shape: 'rect' },
      { x: 0.5, y: 0, w: 0.5, h: 1, shape: 'rect' },
    ],
  },
  {
    id: 'two-hearts',
    nameKey: 'twoHearts',
    count: 2,
    pieces: [
      { x: 0, y: 0, w: 0.5, h: 1, shape: 'heart-half', variant: 'left' },
      { x: 0.5, y: 0, w: 0.5, h: 1, shape: 'heart-half', variant: 'right' },
    ],
  },
  {
    id: 'three-rows',
    nameKey: 'threeRows',
    count: 3,
    pieces: [
      { x: 0, y: 0, w: 1, h: 1 / 3, shape: 'rect' },
      { x: 0, y: 1 / 3, w: 1, h: 1 / 3, shape: 'rect' },
      { x: 0, y: 2 / 3, w: 1, h: 1 / 3, shape: 'rect' },
    ],
  },
  {
    id: 'two-hexagons',
    nameKey: 'twoHexagons',
    count: 2,
    pieces: [
      { x: 0, y: 0, w: 0.5, h: 1, shape: 'hex' },
      { x: 0.5, y: 0, w: 0.5, h: 1, shape: 'hex' },
    ],
  },
  {
    id: 'three-cols',
    nameKey: 'threeCols',
    count: 3,
    pieces: [
      { x: 0, y: 0, w: 1 / 3, h: 1, shape: 'rect' },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 1, shape: 'rect' },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 1, shape: 'rect' },
    ],
  },
  {
    id: 'four-rows',
    nameKey: 'fourRows',
    count: 4,
    pieces: [
      { x: 0, y: 0, w: 1, h: 0.25, shape: 'rect' },
      { x: 0, y: 0.25, w: 1, h: 0.25, shape: 'rect' },
      { x: 0, y: 0.5, w: 1, h: 0.25, shape: 'rect' },
      { x: 0, y: 0.75, w: 1, h: 0.25, shape: 'rect' },
    ],
  },
  {
    id: 'grid-2x2',
    nameKey: 'grid2x2',
    count: 4,
    pieces: [
      { x: 0, y: 0, w: 0.5, h: 0.5, shape: 'rect' },
      { x: 0.5, y: 0, w: 0.5, h: 0.5, shape: 'rect' },
      { x: 0, y: 0.5, w: 0.5, h: 0.5, shape: 'rect' },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5, shape: 'rect' },
    ],
  },
  {
    id: 'left-big-right-stacked',
    nameKey: 'leftBigRightStacked',
    count: 3,
    pieces: [
      { x: 0, y: 0, w: 0.5, h: 1, shape: 'rect' },
      { x: 0.5, y: 0, w: 0.5, h: 0.5, shape: 'rect' },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5, shape: 'rect' },
    ],
  },
  {
    id: 'three-hex-triangle',
    nameKey: 'threeHexTriangle',
    count: 3,
    pieces: [
      { x: 0.25, y: 0, w: 0.5, h: 0.5, shape: 'hex' },
      { x: 0, y: 0.5, w: 0.5, h: 0.5, shape: 'hex' },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5, shape: 'hex' },
    ],
  },
  {
    id: 'grid-2x2-square',
    nameKey: 'grid2x2Square',
    count: 4,
    pieces: [
      { x: 0, y: 0, w: 0.5, h: 0.5, shape: 'rect' },
      { x: 0.5, y: 0, w: 0.5, h: 0.5, shape: 'rect' },
      { x: 0, y: 0.5, w: 0.5, h: 0.5, shape: 'rect' },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5, shape: 'rect' },
    ],
  },
  {
    id: 'jigsaw-4',
    nameKey: 'jigsaw4',
    count: 4,
    pieces: [
      { x: 0, y: 0, w: 0.5, h: 0.5, shape: 'jigsaw', variant: 'topSlot-leftSlot' },
      { x: 0.5, y: 0, w: 0.5, h: 0.5, shape: 'jigsaw', variant: 'topSlot-rightTab' },
      { x: 0, y: 0.5, w: 0.5, h: 0.5, shape: 'jigsaw', variant: 'bottomTab-leftSlot' },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5, shape: 'jigsaw', variant: 'bottomTab-rightTab' },
    ],
  },
  {
    id: 'three-hearts',
    nameKey: 'threeHearts',
    count: 3,
    pieces: [
      { x: 0.15, y: 0, w: 0.7, h: 0.55, shape: 'heart' },
      { x: 0, y: 0.55, w: 0.5, h: 0.45, shape: 'heart' },
      { x: 0.5, y: 0.55, w: 0.5, h: 0.45, shape: 'heart' },
    ],
  },
  {
    id: 'four-leaf',
    nameKey: 'fourLeaf',
    count: 4,
    pieces: [
      { x: 0, y: 0, w: 0.55, h: 0.55, shape: 'circle' },
      { x: 0.45, y: 0, w: 0.55, h: 0.55, shape: 'circle' },
      { x: 0, y: 0.45, w: 0.55, h: 0.55, shape: 'circle' },
      { x: 0.45, y: 0.45, w: 0.55, h: 0.55, shape: 'circle' },
    ],
  },
  {
    id: 'hex-flower-7',
    nameKey: 'hexFlower7',
    count: 7,
    pieces: [
      { x: 1 / 3, y: 1 / 3, w: 1 / 3, h: 1 / 3, shape: 'hex' },
      { x: 0.5 - 1 / 6, y: 0, w: 1 / 3, h: 1 / 3, shape: 'hex' },
      { x: 2 / 3, y: 1 / 6, w: 1 / 3, h: 1 / 3, shape: 'hex' },
      { x: 0.5 - 1 / 6, y: 2 / 3, w: 1 / 3, h: 1 / 3, shape: 'hex' },
      { x: 0, y: 1 / 6, w: 1 / 3, h: 1 / 3, shape: 'hex' },
      { x: 1 / 6, y: 0.5 - 1 / 6, w: 1 / 3, h: 1 / 3, shape: 'hex' },
      { x: 1 / 2, y: 0.5 - 1 / 6, w: 1 / 3, h: 1 / 3, shape: 'hex' },
    ],
  },
  {
    id: 'hex-star-6',
    nameKey: 'hexStar6',
    count: 6,
    pieces: [
      { x: 0.25, y: 0, w: 0.5, h: 0.5, shape: 'triangle', variant: 'up' },
      { x: 0.5, y: 0, w: 0.5, h: 0.5, shape: 'triangle', variant: 'up' },
      { x: 0.75, y: 0.25, w: 0.25, h: 0.5, shape: 'triangle', variant: 'right' },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5, shape: 'triangle', variant: 'down' },
      { x: 0, y: 0.5, w: 0.5, h: 0.5, shape: 'triangle', variant: 'down' },
      { x: 0, y: 0.25, w: 0.25, h: 0.5, shape: 'triangle', variant: 'left' },
    ],
  },
  {
    id: 'hex-cluster-7',
    nameKey: 'hexCluster7',
    count: 7,
    pieces: [
      { x: 0.333, y: 0.25, w: 0.333, h: 0.5, shape: 'hex' },
      { x: 0, y: 0, w: 0.333, h: 0.5, shape: 'hex' },
      { x: 0.666, y: 0, w: 0.333, h: 0.5, shape: 'hex' },
      { x: 0, y: 0.5, w: 0.333, h: 0.5, shape: 'hex' },
      { x: 0.666, y: 0.5, w: 0.333, h: 0.5, shape: 'hex' },
      { x: 0.166, y: 0.25, w: 0.333, h: 0.5, shape: 'hex' },
      { x: 0.5, y: 0, w: 0.333, h: 0.5, shape: 'hex' },
    ],
  },
  {
    id: 'hex-cluster-7b',
    nameKey: 'hexCluster7b',
    count: 7,
    pieces: [
      { x: 0.166, y: 0.25, w: 0.333, h: 0.5, shape: 'hex' },
      { x: 0.5, y: 0.25, w: 0.333, h: 0.5, shape: 'hex' },
      { x: 0, y: 0, w: 0.333, h: 0.5, shape: 'hex' },
      { x: 0.333, y: 0, w: 0.333, h: 0.5, shape: 'hex' },
      { x: 0.666, y: 0, w: 0.333, h: 0.5, shape: 'hex' },
      { x: 0, y: 0.5, w: 0.333, h: 0.5, shape: 'hex' },
      { x: 0.666, y: 0.5, w: 0.333, h: 0.5, shape: 'hex' },
    ],
  },
  {
    id: 'grid-3x3',
    nameKey: 'grid3x3',
    count: 9,
    pieces: Array.from({ length: 9 }).map((_, i) => ({
      x: (i % 3) / 3,
      y: Math.floor(i / 3) / 3,
      w: 1 / 3,
      h: 1 / 3,
      shape: 'rect' as const,
    })),
  },
];

/** 通过 id 查找布局 */
export function getPuzzleLayout(id: PuzzleLayoutId): PuzzleLayoutDef {
  return PUZZLE_LAYOUTS.find((l) => l.id === id) ?? PUZZLE_LAYOUTS[9]; // grid-2x2-square fallback
}

/** 所有布局 id 列表 */
export const PUZZLE_LAYOUT_IDS: PuzzleLayoutId[] = PUZZLE_LAYOUTS.map((l) => l.id);
