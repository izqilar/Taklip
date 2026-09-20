/**
 * 视频导出专用：可 seek 的 GSAP 动画时间线。
 *
 * 设计目标：把「每个对象上的一条/一组动画」构建成一条**暂停的 GSAP 时间线**，
 * 时间线直接驱动 Konva 节点的 x/y/scale/rotation/opacity/skew/offset 属性。
 * 导出主循环按帧索引 `seek(t)`，即可在任意时刻得到**精确**的动画状态，
 * 彻底消除原方案（Konva.Tween 靠 rAF 实时推进 + performance.now() 墙钟截帧）的
 * 时序脱钩、动画被截断、跳帧等问题。
 *
 * 所有「相对偏移」语义与 konvaPlayer.ts 的 computeStates 完全一致，
 * 多段时间线动画（bounce/shake/swing/headShake…）的段数据逐段镜像 konvaPlayer，
 * 保证「所见即所得」——导出画面与编辑器预览完全一致。
 */
import gsap from 'gsap';
import Konva from 'konva';
import type { SingleAnimationConfig, Page } from '@h5design/core';
import { computeStates } from './konvaPlayer';
import { findAnimationDef } from './registry';

interface AnimState {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  skewX: number;
  skewY: number;
  offsetX: number;
  offsetY: number;
}

/** 可被 GSAP 驱动的属性（含 offset，用于 swing/headShake 等需要改旋转轴的动画） */
type ProxyState = AnimState;

const ANIM_KEYS: (keyof AnimState)[] = [
  'x',
  'y',
  'scaleX',
  'scaleY',
  'rotation',
  'opacity',
  'skewX',
  'skewY',
  'offsetX',
  'offsetY',
];

function snapshotNode(node: Konva.Node): ProxyState {
  const destroyed = (node as unknown as { isDestroyed?: () => boolean }).isDestroyed?.();
  if (destroyed) {
    return { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, skewX: 0, skewY: 0, offsetX: 0, offsetY: 0 };
  }
  return {
    x: node.x(),
    y: node.y(),
    scaleX: node.scaleX() || 1,
    scaleY: node.scaleY() || 1,
    rotation: node.rotation() || 0,
    opacity: node.opacity() == null ? 1 : node.opacity(),
    skewX: node.skewX() || 0,
    skewY: node.skewY() || 0,
    offsetX: node.offsetX() || 0,
    offsetY: node.offsetY() || 0,
  };
}

function applyProxy(node: Konva.Node, s: ProxyState, design: ProxyState) {
  if ((node as unknown as { isDestroyed?: () => boolean }).isDestroyed?.()) return;
  // 非有限值兜底：Konva 遇到 NaN/Infinity 坐标会静默跳过该节点绘制，
  // 而只有动画对象经过段计算，故「加动画的对象不渲染」多源于此。
  // 这里对非有限值回退到 design 设计态，保证节点至少以设计态可见。
  node.x(Number.isFinite(s.x) ? s.x : design.x);
  node.y(Number.isFinite(s.y) ? s.y : design.y);
  node.scaleX(Number.isFinite(s.scaleX) ? s.scaleX : design.scaleX);
  node.scaleY(Number.isFinite(s.scaleY) ? s.scaleY : design.scaleY);
  node.rotation(Number.isFinite(s.rotation) ? s.rotation : design.rotation);
  node.opacity(Number.isFinite(s.opacity) ? s.opacity : design.opacity);
  node.skewX(Number.isFinite(s.skewX) ? s.skewX : design.skewX);
  node.skewY(Number.isFinite(s.skewY) ? s.skewY : design.skewY);
  node.offsetX(Number.isFinite(s.offsetX) ? s.offsetX : design.offsetX);
  node.offsetY(Number.isFinite(s.offsetY) ? s.offsetY : design.offsetY);
}

/** 把 registry 的 GSAP 风格 ease 名映射到 GSAP 可识别的 ease 字符串 */
function gsapEase(ease?: string): string {
  if (!ease) return 'power2.out';
  const map: Record<string, string> = {
    'power1.inOut': 'power1.inOut',
    'power1.out': 'power1.out',
    'power1.in': 'power1.in',
    'power2.inOut': 'power2.inOut',
    'power2.out': 'power2.out',
    'power2.in': 'power2.in',
    'bounce.out': 'bounce.out',
    'back.out': 'back.out',
    'sine.inOut': 'sine.inOut',
    ease: 'power2.out',
    none: 'none',
    linear: 'none',
  };
  return map[ease] || 'power2.out';
}

/* ───────── 多段时间线动画段数据（镜像 konvaPlayer.ts 的 play* 系列）───────── */

interface Seg {
  props: Partial<AnimState>;
  duration: number;
  ease: string;
}

function nodeSize(node: Konva.Node): number {
  const rect = node.getClientRect({ skipStroke: true, skipShadow: true });
  return Math.max(rect.width, rect.height) || 40;
}

function segsBounceLeftRight(node: Konva.Node, design: ProxyState): Seg[] {
  const baseX = design.x;
  const stage = node.getStage();
  const stageW = (stage && stage.width()) || 375;
  const nodeW = node.width() || 0;
  const margin = 4;
  const leftX = margin;
  const rightX = Math.max(margin, stageW - nodeW - margin);
  return [
    { props: { x: leftX }, duration: 0.32, ease: 'power1.in' },
    { props: { x: rightX }, duration: 0.24, ease: 'power1.out' },
    { props: { x: baseX }, duration: 0.5, ease: 'power1.out' },
  ];
}

function segsBounce(node: Konva.Node, design: ProxyState): Seg[] {
  const baseY = design.y;
  const h = Math.round(nodeSize(node) * 0.7);
  return [
    { props: { y: baseY - h, scaleY: 1.1 }, duration: 0.16, ease: 'power1.out' },
    { props: { y: baseY, scaleY: 1 }, duration: 0.13, ease: 'power1.in' },
    { props: { y: baseY - h * 0.5, scaleY: 1.05 }, duration: 0.12, ease: 'power1.out' },
    { props: { y: baseY, scaleY: 0.95 }, duration: 0.1, ease: 'power1.in' },
    { props: { y: baseY - h * 0.13, scaleY: 1.02 }, duration: 0.08, ease: 'power1.out' },
    { props: { y: baseY, scaleY: 1 }, duration: 0.1, ease: 'power1.in' },
  ];
}

function segsShake(node: Konva.Node, design: ProxyState, type: string): Seg[] {
  const baseX = design.x;
  const baseY = design.y;
  const amp = type === 'shakeHard' || type === 'shakeYHard' ? nodeSize(node) * 0.3 : nodeSize(node) * 0.2;
  const yAxis = type === 'shakeY' || type === 'shakeYHard';
  const offsets = [-amp, amp, -amp, amp, -amp, amp, -amp, amp, -amp, 0];
  return offsets.map((o) => ({
    props: yAxis ? { y: baseY + o } : { x: baseX + o },
    duration: 0.08,
    ease: 'power1.inOut',
  }));
}

function segsHeadShake(node: Konva.Node, design: ProxyState): { segs: Seg[]; snap: Partial<AnimState>; restore: Partial<AnimState> } {
  const baseSx = design.scaleX || 1;
  const w = node.width() || node.height() || 40;
  const size = Math.max(w, node.height() || w);
  const base = Math.max(4, Math.round(size * 0.15));
  const cx = node.x();
  const centerX = cx + (w * baseSx) / 2;
  const oy = design.offsetY || 0;
  const cy = design.y;
  // snap 把旋转轴瞬时切到几何中心（offset=w/2，position=centerX），restore 还原
  const snap = { offsetX: w / 2, offsetY: oy, x: centerX, y: cy };
  const restore = { offsetX: design.offsetX || 0, offsetY: design.offsetY || 0, x: design.x, y: design.y };
  const segs: Seg[] = [
    { props: { x: centerX - base, scaleX: baseSx * 0.9 }, duration: 0.0625, ease: 'power1.inOut' },
    { props: { x: centerX + base * 0.83, scaleX: baseSx * 0.93 }, duration: 0.125, ease: 'power1.inOut' },
    { props: { x: centerX - base * 0.5, scaleX: baseSx * 0.95 }, duration: 0.125, ease: 'power1.inOut' },
    { props: { x: centerX + base * 0.33, scaleX: baseSx * 0.97 }, duration: 0.125, ease: 'power1.inOut' },
    { props: { x: centerX, scaleX: baseSx }, duration: 0.125, ease: 'power1.inOut' },
  ];
  return { segs, snap, restore };
}

function segsFlash(design: ProxyState): Seg[] {
  const baseOpacity = design.opacity;
  return [
    { props: { opacity: 0 }, duration: 0.25, ease: 'power1.inOut' },
    { props: { opacity: baseOpacity }, duration: 0.25, ease: 'power1.inOut' },
    { props: { opacity: 0 }, duration: 0.25, ease: 'power1.inOut' },
    { props: { opacity: baseOpacity }, duration: 0.25, ease: 'power1.inOut' },
  ];
}

function segsPulse(design: ProxyState): Seg[] {
  const sx = design.scaleX || 1;
  const sy = design.scaleY || 1;
  return [
    { props: { scaleX: sx * 1.05, scaleY: sy * 1.05 }, duration: 0.35, ease: 'power1.inOut' },
    { props: { scaleX: sx, scaleY: sy }, duration: 0.35, ease: 'power1.inOut' },
  ];
}

function segsRubberBand(design: ProxyState): Seg[] {
  const sx = design.scaleX || 1;
  const sy = design.scaleY || 1;
  return [
    { props: { scaleX: sx * 1.25, scaleY: sy * 0.75 }, duration: 0.3, ease: 'power1.inOut' },
    { props: { scaleX: sx * 0.75, scaleY: sy * 1.25 }, duration: 0.1, ease: 'power1.inOut' },
    { props: { scaleX: sx * 1.15, scaleY: sy * 0.85 }, duration: 0.1, ease: 'power1.inOut' },
    { props: { scaleX: sx * 0.95, scaleY: sy * 1.05 }, duration: 0.1, ease: 'power1.inOut' },
    { props: { scaleX: sx * 1.05, scaleY: sy * 0.95 }, duration: 0.1, ease: 'power1.inOut' },
    { props: { scaleX: sx, scaleY: sy }, duration: 0.3, ease: 'power1.inOut' },
  ];
}

function segsWobble(node: Konva.Node, design: ProxyState): Seg[] {
  const baseX = design.x;
  const baseRot = design.rotation || 0;
  const w = node.getClientRect({ skipStroke: true, skipShadow: true }).width || 40;
  return [
    { props: { x: baseX - w * 0.25, rotation: baseRot - 5 }, duration: 0.15, ease: 'power1.inOut' },
    { props: { x: baseX + w * 0.2, rotation: baseRot + 3 }, duration: 0.15, ease: 'power1.inOut' },
    { props: { x: baseX - w * 0.15, rotation: baseRot - 3 }, duration: 0.15, ease: 'power1.inOut' },
    { props: { x: baseX + w * 0.1, rotation: baseRot + 2 }, duration: 0.15, ease: 'power1.inOut' },
    { props: { x: baseX - w * 0.05, rotation: baseRot - 1 }, duration: 0.15, ease: 'power1.inOut' },
    { props: { x: baseX, rotation: baseRot }, duration: 0.25, ease: 'power1.inOut' },
  ];
}

function segsSwing(node: Konva.Node, design: ProxyState): { segs: Seg[]; snap: Partial<AnimState>; restore: Partial<AnimState> } {
  const baseRot = design.rotation || 0;
  const sx = design.scaleX || 1;
  const sy = design.scaleY || 1;
  const ox = design.offsetX || 0;
  const oy = design.offsetY || 0;
  const localRect = node.getClientRect({
    relativeTo: node as unknown as Konva.Container,
    skipStroke: true,
    skipShadow: true,
  });
  const localTopX = localRect.x + localRect.width / 2;
  const localTopY = localRect.y;
  const rad = (baseRot * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const pivotX = design.x + (c * (localTopX - ox) * sx - s * (localTopY - oy) * sy);
  const pivotY = design.y + (s * (localTopX - ox) * sx + c * (localTopY - oy) * sy);
  // snap 把旋转轴瞬时切到顶边中心（offset=localTop，position=pivot），restore 还原
  const snap = { offsetX: localTopX, offsetY: localTopY, x: pivotX, y: pivotY };
  const restore = { offsetX: ox, offsetY: oy, x: design.x, y: design.y };
  const segs: Seg[] = [
    { props: { rotation: baseRot + 15 }, duration: 0.2, ease: 'power1.inOut' },
    { props: { rotation: baseRot - 10 }, duration: 0.2, ease: 'power1.inOut' },
    { props: { rotation: baseRot + 5 }, duration: 0.2, ease: 'power1.inOut' },
    { props: { rotation: baseRot - 5 }, duration: 0.2, ease: 'power1.inOut' },
    { props: { rotation: baseRot }, duration: 0.2, ease: 'power1.inOut' },
  ];
  return { segs, snap, restore };
}

function segsTada(design: ProxyState): Seg[] {
  const sx = design.scaleX || 1;
  const sy = design.scaleY || 1;
  const baseRot = design.rotation || 0;
  return [
    { props: { scaleX: sx * 0.9, scaleY: sy * 0.9, rotation: baseRot - 3 }, duration: 0.2, ease: 'power1.inOut' },
    { props: { scaleX: sx * 1.1, scaleY: sy * 1.1, rotation: baseRot + 3 }, duration: 0.2, ease: 'power1.inOut' },
    { props: { scaleX: sx * 1.1, scaleY: sy * 1.1, rotation: baseRot - 3 }, duration: 0.2, ease: 'power1.inOut' },
    { props: { scaleX: sx * 1.1, scaleY: sy * 1.1, rotation: baseRot + 3 }, duration: 0.2, ease: 'power1.inOut' },
    { props: { scaleX: sx * 1.1, scaleY: sy * 1.1, rotation: baseRot - 3 }, duration: 0.1, ease: 'power1.inOut' },
    { props: { scaleX: sx, scaleY: sy, rotation: baseRot }, duration: 0.1, ease: 'power1.inOut' },
  ];
}

function segsJello(design: ProxyState): Seg[] {
  const sx = design.scaleX || 1;
  const sy = design.scaleY || 1;
  return [
    { props: { scaleX: sx * 1.25, scaleY: sy * 0.75, skewX: 4, skewY: 4 }, duration: 0.3, ease: 'power1.inOut' },
    { props: { scaleX: sx * 0.75, scaleY: sy * 1.25, skewX: -4, skewY: -4 }, duration: 0.1, ease: 'power1.inOut' },
    { props: { scaleX: sx * 1.15, scaleY: sy * 0.85, skewX: 4, skewY: 4 }, duration: 0.1, ease: 'power1.inOut' },
    { props: { scaleX: sx * 0.95, scaleY: sy * 1.05, skewX: -2, skewY: -2 }, duration: 0.15, ease: 'power1.inOut' },
    { props: { scaleX: sx * 1.05, scaleY: sy * 0.95, skewX: 2, skewY: 2 }, duration: 0.1, ease: 'power1.inOut' },
    { props: { scaleX: sx, scaleY: sy, skewX: 0, skewY: 0 }, duration: 0.25, ease: 'power1.inOut' },
  ];
}

function segsHeartBeat(design: ProxyState): Seg[] {
  const sx = design.scaleX || 1;
  const sy = design.scaleY || 1;
  const peak = 1.3;
  return [
    { props: { scaleX: sx * peak, scaleY: sy * peak }, duration: 0.18, ease: 'power1.inOut' },
    { props: { scaleX: sx, scaleY: sy }, duration: 0.18, ease: 'power1.inOut' },
    { props: { scaleX: sx * peak, scaleY: sy * peak }, duration: 0.18, ease: 'power1.inOut' },
    { props: { scaleX: sx, scaleY: sy }, duration: 0.18, ease: 'power1.inOut' },
    { props: { scaleX: sx * peak, scaleY: sy * peak }, duration: 0.18, ease: 'power1.inOut' },
    { props: { scaleX: sx, scaleY: sy }, duration: 0.18, ease: 'power1.inOut' },
  ];
}

/* ───────── 构建单节点时间线 ───────── */

export interface NodeTimeline {
  node: Konva.Node;
  proxy: ProxyState;
  design: ProxyState;
  tl: gsap.core.Timeline;
  total: number;
}

function addSegs(tl: gsap.core.Timeline, proxy: ProxyState, segs: Seg[], startTime: number) {
  let pos = startTime;
  for (const seg of segs) {
    const vars: Record<string, unknown> = { duration: seg.duration, ease: seg.ease, immediateRender: false };
    for (const k of ANIM_KEYS) {
      const v = (seg.props as Record<string, number | undefined>)[k];
      if (v !== undefined) vars[k] = v;
    }
    tl.to(proxy, vars as gsap.TweenVars, pos);
    pos += seg.duration;
  }
}

function buildMulti(
  node: Konva.Node,
  cfg: SingleAnimationConfig,
  design: ProxyState,
  proxy: ProxyState,
  tl: gsap.core.Timeline,
  atTime: number,
): number {
  const type = cfg.type;
  switch (type) {
    case 'bounceLeftRight': {
      const segs = segsBounceLeftRight(node, design);
      addSegs(tl, proxy, segs, atTime);
      return segs.reduce((a, s) => a + s.duration, 0);
    }
    case 'bounce': {
      const segs = segsBounce(node, design);
      addSegs(tl, proxy, segs, atTime);
      return segs.reduce((a, s) => a + s.duration, 0);
    }
    case 'shake':
    case 'shakeY':
    case 'shakeHard':
    case 'shakeYHard': {
      const segs = segsShake(node, design, type);
      addSegs(tl, proxy, segs, atTime);
      return segs.reduce((a, s) => a + s.duration, 0);
    }
    case 'flash': {
      const segs = segsFlash(design);
      addSegs(tl, proxy, segs, atTime);
      return segs.reduce((a, s) => a + s.duration, 0);
    }
    case 'pulse': {
      const segs = segsPulse(design);
      addSegs(tl, proxy, segs, atTime);
      return segs.reduce((a, s) => a + s.duration, 0);
    }
    case 'rubberBand': {
      const segs = segsRubberBand(design);
      addSegs(tl, proxy, segs, atTime);
      return segs.reduce((a, s) => a + s.duration, 0);
    }
    case 'wobble': {
      const segs = segsWobble(node, design);
      addSegs(tl, proxy, segs, atTime);
      return segs.reduce((a, s) => a + s.duration, 0);
    }
    case 'tada': {
      const segs = segsTada(design);
      addSegs(tl, proxy, segs, atTime);
      return segs.reduce((a, s) => a + s.duration, 0);
    }
    case 'jello': {
      const segs = segsJello(design);
      addSegs(tl, proxy, segs, atTime);
      return segs.reduce((a, s) => a + s.duration, 0);
    }
    case 'heartBeat': {
      const segs = segsHeartBeat(design);
      addSegs(tl, proxy, segs, atTime);
      return segs.reduce((a, s) => a + s.duration, 0);
    }
    case 'headShake': {
      const { segs, snap, restore } = segsHeadShake(node, design);
      tl.set(proxy, snap as gsap.TweenVars, atTime);
      addSegs(tl, proxy, segs, atTime);
      const total = segs.reduce((a, s) => a + s.duration, 0);
      tl.set(proxy, restore as gsap.TweenVars, atTime + total);
      return total;
    }
    case 'swing': {
      const { segs, snap, restore } = segsSwing(node, design);
      tl.set(proxy, snap as gsap.TweenVars, atTime);
      addSegs(tl, proxy, segs, atTime);
      const total = segs.reduce((a, s) => a + s.duration, 0);
      tl.set(proxy, restore as gsap.TweenVars, atTime + total);
      return total;
    }
    default:
      return 0;
  }
}

function buildNodeTimeline(node: Konva.Node, configs: SingleAnimationConfig[]): NodeTimeline | null {
  if (!configs.length) return null;
  const design = snapshotNode(node);
  const proxy: ProxyState = { ...design };
  const tl = gsap.timeline({ paused: true });

  let cursor = 0;
  for (const cfg of configs) {
    const def = findAnimationDef(cfg.category, cfg.type);
    if (!def) continue;

    if (def.multi) {
      const consumed = buildMulti(node, cfg, design, proxy, tl, cursor + (cfg.delay ?? 0));
      cursor = cursor + (cfg.delay ?? 0) + consumed;
      continue;
    }

    const { start, end } = computeStates(
      cfg.category,
      def.vars as Record<string, unknown>,
      design as unknown as Record<string, number>,
    );
    const dur = cfg.duration ?? (def.vars.duration as number | undefined) ?? 0.6;
    const delay = cfg.delay ?? 0;
    const ease = gsapEase(def.vars.ease as string | undefined);

    // 入场动画：把 proxy 初值设为「起始（偏移/隐藏）态」，避免 delay 期间闪现设计态
    if (cursor === 0 && cfg.category === 'enter') {
      for (const k of ANIM_KEYS) {
        const v = (start as Record<string, number | undefined>)[k];
        if (v !== undefined) (proxy as unknown as Record<string, number>)[k] = v;
      }
    }

    const vars: Record<string, unknown> = { duration: dur, ease, immediateRender: false };
    for (const k of ANIM_KEYS) {
      const v = (end as Record<string, number | undefined>)[k];
      if (v !== undefined) vars[k] = v;
    }
    tl.to(proxy, vars as gsap.TweenVars, cursor + delay);
    cursor = cursor + delay + dur;
  }

  return { node, proxy, design, tl, total: tl.totalDuration() };
}

/* ───────── 页面级时间线集合（供导出主循环驱动）───────── */

export interface PageTimelines {
  nodes: NodeTimeline[];
  total: number;
}

/** 为一页里所有带动画的元素构建可 seek 时间线。 */
export function buildPageTimelines(stage: Konva.Stage, page: Page | undefined): PageTimelines {
  const nodes: NodeTimeline[] = [];
  if (!page) return { nodes, total: 0 };
  for (const el of page.elements ?? []) {
    const configs = getAnimationConfigs(el);
    if (!configs.length) continue;
    const node = stage.findOne('#' + el.id) as Konva.Node | undefined;
    if (!node) continue;
    const nt = buildNodeTimeline(node, configs);
    if (nt) nodes.push(nt);
  }
  const total = nodes.reduce((m, n) => Math.max(m, n.total), 0);
  return { nodes, total };
}

/** 把所有节点时间线 seek 到时间 t（秒），并把状态写回 Konva 节点。 */
export function seekPageTimelines(pt: PageTimelines, t: number) {
  for (const nt of pt.nodes) {
    nt.tl.seek(t);
    applyProxy(nt.node, nt.proxy, nt.design);
  }
}

/** 销毁页面时间线，释放 GSAP 实例。 */
export function destroyPageTimelines(pt: PageTimelines) {
  for (const nt of pt.nodes) {
    try {
      nt.tl.kill();
    } catch {
      /* ignore */
    }
  }
  pt.nodes = [];
}

/**
 * 纯计算：单页所有动画的精确总时长（串行 + 多段动画累计）。
 * 仅用于决定导出录制的时长，不创建任何 GSAP 时间线、不触碰 Konva 节点。
 * 实际播放由 konvaPlayer.playAnimationsOnNode（Konva.Tween，已被编辑器/预览验证可在每一页正确渲染）完成，
 * 二者时长同源（同一份 cfg.duration / def.vars.duration / 多段时间线段时长），从而保证动画完整播放、无截断。
 */
const MULTI_DURATIONS: Record<string, number> = {
  bounceLeftRight: 1.06,
  bounce: 0.69,
  shake: 0.8,
  shakeY: 0.8,
  shakeHard: 0.8,
  shakeYHard: 0.8,
  flash: 1.0,
  pulse: 0.7,
  rubberBand: 1.0,
  wobble: 1.0,
  swing: 1.0,
  tada: 1.2,
  jello: 1.0,
  heartBeat: 1.08,
  headShake: 0.5625,
};

export function computePageAnimDuration(page: Page | undefined): number {
  let maxEnd = 0;
  if (!page) return maxEnd;
  for (const el of page.elements ?? []) {
    const configs = getAnimationConfigs(el);
    let cursor = 0;
    for (const cfg of configs) {
      const def = findAnimationDef(cfg.category, cfg.type);
      if (!def) continue;
      const delay = cfg.delay ?? 0;
      const consumed = def.multi
        ? MULTI_DURATIONS[cfg.type] ?? 1.0
        : cfg.duration ?? (def.vars.duration as number | undefined) ?? 0.6;
      cursor = cursor + delay + consumed;
    }
    maxEnd = Math.max(maxEnd, cursor);
  }
  return maxEnd;
}

export function getAnimationConfigs(el: { animation?: unknown }): SingleAnimationConfig[] {
  const raw = el.animation;
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : (raw as { animation?: unknown }).animation;
  if (Array.isArray(list)) {
    return list.filter(
      (c: unknown): c is SingleAnimationConfig =>
        !!c && typeof c === 'object' && 'type' in c && (c as { type: string }).type !== 'none',
    );
  }
  return [];
}
