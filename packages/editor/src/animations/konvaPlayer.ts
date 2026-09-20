/**
 * 在 Konva 编辑态 Stage 上直接播放动画预览。
 * 把注册表里的 GSAP vars 映射到 Konva Node 属性（x/y/scaleX/scaleY/rotation/opacity/skewX/skewY）。
 */
import Konva from 'konva';
import type { SingleAnimationConfig } from '@h5design/core';
import { findAnimationDef } from './registry';

const EASING_MAP: Record<string, (t: number, b: number, c: number, d: number) => number> = {
  linear: Konva.Easings.Linear,
  none: Konva.Easings.Linear,
  'power1.inOut': Konva.Easings.EaseInOut,
  'power1.out': Konva.Easings.EaseOut,
  'power1.in': Konva.Easings.EaseIn,
  'power2.inOut': Konva.Easings.EaseInOut,
  'power2.out': Konva.Easings.EaseOut,
  'power2.in': Konva.Easings.EaseIn,
  'bounce.out': Konva.Easings.BounceEaseOut,
  'back.out': Konva.Easings.BackEaseOut,
  'sine.inOut': Konva.Easings.EaseInOut,
  ease: Konva.Easings.EaseOut,
};

const ANIMATABLE_PROPS = new Set([
  'x',
  'y',
  'scaleX',
  'scaleY',
  'rotation',
  'opacity',
  'skewX',
  'skewY',
]);

/** 安全读取节点当前属性快照 */
function snapshotNode(node: Konva.Node): Record<string, number> {
  if ((node as unknown as { isDestroyed?: () => boolean }).isDestroyed?.()) {
    return { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, skewX: 0, skewY: 0 };
  }
  return {
    x: node.x(),
    y: node.y(),
    scaleX: node.scaleX(),
    scaleY: node.scaleY(),
    rotation: node.rotation(),
    opacity: node.opacity(),
    skewX: node.skewX(),
    skewY: node.skewY(),
  };
}

/** 安全将属性状态应用到节点 */
function applyState(node: Konva.Node, state: Record<string, number>) {
  if ((node as unknown as { isDestroyed?: () => boolean }).isDestroyed?.()) return;
  Object.entries(state).forEach(([key, value]) => {
    if (!ANIMATABLE_PROPS.has(key) || !Number.isFinite(value)) return;
    try {
      (node as unknown as Record<string, (v: number) => Konva.Node>)[key](value);
    } catch {
      // ignore
    }
  });
  try {
    node.getLayer()?.batchDraw();
  } catch {
    // ignore
  }
}

/** 安全销毁 Tween，避免对已经销毁的实例重复调用 destroy */
function safeDestroyTween(tween: Konva.Tween | undefined) {
  if (!tween) return;
  try {
    tween.destroy();
  } catch {
    // 已经销毁或 tween 关联节点已失效，忽略
  }
}

function getEasing(ease: string | undefined): (t: number, b: number, c: number, d: number) => number {
  if (!ease) return Konva.Easings.EaseOut;
  return EASING_MAP[ease] || Konva.Easings.EaseOut;
}

/** 根据 vars 与动画分类计算起始/结束属性 */
export function computeStates(
  category: SingleAnimationConfig['category'],
  vars: Record<string, unknown>,
  current: Record<string, number>,
) {
  const start: Record<string, number> = { ...current };
  const end: Record<string, number> = { ...current };

  for (const [key, raw] of Object.entries(vars)) {
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;

    if (key === 'scale') {
      // Konva 没有数值型 scale setter，需映射到 scaleX / scaleY
      if (category === 'enter') {
        start.scaleX = value;
        start.scaleY = value;
      } else {
        end.scaleX = value;
        end.scaleY = value;
      }
      continue;
    }

    // 3D 翻转（flipOutX / flipOutY）在 Konva 画布无原生支持：用「压扁至消失」近似，
    // 旋转轴方向与 hover 预览的 rotateX / rotateY 一致（绕水平轴 → 垂直方向压扁；绕垂直轴 → 水平方向压扁）。
    if (key === 'rotateX') {
      if (category === 'exit') end.scaleY = 0;
      else start.scaleY = 0;
      continue;
    }
    if (key === 'rotateY') {
      if (category === 'exit') end.scaleX = 0;
      else start.scaleX = 0;
      continue;
    }

    if (!ANIMATABLE_PROPS.has(key)) continue;

    if (category === 'enter') {
      // 入场：从 vars 描述的「相对偏移」状态进入当前设计态。
      // registry 的 vars 沿用了 GSAP 的 transform 相对偏移语义（x/y/rotation/skew
      // 是相对元素当前位置的偏移），而 Konva 的 x/y/rotation/skew 是绝对坐标，
      // 因此起始绝对坐标 = 当前值 + 偏移；opacity / scale 本身即绝对值，直接取值。
      if (key === 'x' || key === 'y' || key === 'rotation' || key === 'skewX' || key === 'skewY') {
        start[key] = (current[key] ?? 0) + value;
      } else {
        start[key] = value;
      }
    } else {
      // 强调 / 出场：从当前设计态变化到 vars 描述的状态。
      // 与入场分支同理，registry 的 x/y/rotation/skew 是相对偏移，
      // 因此目标绝对坐标 = 当前值 + 偏移；opacity / scale 本身即绝对值，直接取值。
      // （注意：之前此处漏做 + current，导致 x/y 被当成绝对坐标，fadeOutDown 等
      // 小幅位移方向反转、slideOut* 因幅值远超画布才碰巧正确。）
      if (key === 'x' || key === 'y' || key === 'rotation' || key === 'skewX' || key === 'skewY') {
        end[key] = (current[key] ?? 0) + value;
      } else {
        end[key] = value;
      }
    }
  }

  return { start, end };
}

/**
 * 在指定 Konva Node 上播放单个动画。
 * 返回清理函数：立即停止并恢复设计态。
 */
export function playAnimationOnNode(
  node: Konva.Node,
  config: SingleAnimationConfig,
  onComplete?: () => void,
): (() => void) | null {
  const def = findAnimationDef(config.category, config.type);
  if (!def) return null;

  // 多段时间线动画（「左右反弹」「弹跳」等）走专用播放器
  if (def.multi) {
    if (config.type === 'bounceLeftRight') return playBounceLeftRightOnNode(node, config, onComplete);
    if (config.type === 'bounce') return playBounceOnNode(node, config, onComplete);
    if (config.type === 'shake' || config.type === 'shakeHard' || config.type === 'shakeY' || config.type === 'shakeYHard') return playShakeOnNode(node, config, onComplete);
    if (config.type === 'headShake') return playHeadShakeOnNode(node, config, onComplete);
    // 以下强调效果与 hover 预览（play*Preview）一一对齐
    if (config.type === 'flash') return playFlashOnNode(node, config, onComplete);
    if (config.type === 'pulse') return playPulseOnNode(node, config, onComplete);
    if (config.type === 'rubberBand') return playRubberBandOnNode(node, config, onComplete);
    if (config.type === 'wobble') return playWobbleOnNode(node, config, onComplete);
    if (config.type === 'swing') return playSwingOnNode(node, config, onComplete);
    if (config.type === 'tada') return playTadaOnNode(node, config, onComplete);
    if (config.type === 'jello') return playJelloOnNode(node, config, onComplete);
    if (config.type === 'heartBeat') return playHeartBeatOnNode(node, config, onComplete);
    return null;
  }

  const current = snapshotNode(node);
  const { start, end } = computeStates(config.category, def.vars as Record<string, unknown>, current);
  const easeName = (def.vars.ease as string | undefined) || 'power2.out';
  const duration = config.duration ?? def.vars.duration ?? 0.6;
  const delay = config.delay ?? 0;

  let tween: Konva.Tween | undefined;

  const cleanup = () => {
    safeDestroyTween(tween);
    tween = undefined;
    applyState(node, current);
  };

  const finish = () => {
    // 单次播放结束后恢复到设计态
    applyState(node, current);
    onComplete?.();
  };

  // 入场动画先切到起始状态
  if (config.category === 'enter') {
    applyState(node, start);
  }

  const tweenConfig: Konva.TweenConfig & Record<string, unknown> = {
    node,
    duration,
    delay,
    easing: getEasing(easeName),
    onFinish: finish,
    ...end,
  };

  // 注意：Node.to() 在内部创建 tween 并自动 play，但不返回实例；
  // 这里必须显式 new Konva.Tween() 才能持有实例，供 cleanup 安全销毁。
  tween = new Konva.Tween(tweenConfig);
  tween.play();

  return cleanup;
}

/** 顺序播放一组 Konva.Tween 段。每段可同时驱动多个属性（如 y + scaleY）。
 * 每段新建并显式 play()，上一段 onFinish 后自动播放下一段，全部播完触发 onComplete。
 * 返回 stop() 用于中断并销毁所有 tween。
 *
 * 注意：Konva.Tween 在 new 时**不会**自动播放（构造函数末尾调用 reset()→pause()），
 * 因此这里每一段都必须显式 play()，否则只有第一段会执行。 */
function playTweenChain(
  node: Konva.Node,
  segments: Array<{
    props: Partial<Record<'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY' | 'opacity' | 'skewX' | 'skewY', number>>;
    duration: number;
    easing: (t: number, b: number, c: number, d: number) => number;
  }>,
  onComplete?: () => void,
): { stop: () => void } {
  let stopped = false;
  const tweens: Konva.Tween[] = [];

  const playIndex = (i: number) => {
    if (stopped) return;
    if (i >= segments.length) {
      onComplete?.();
      return;
    }
    const seg = segments[i];
    const cfg: Konva.TweenConfig = {
      node,
      duration: seg.duration,
      easing: seg.easing,
      onFinish: () => {
        if (!stopped) playIndex(i + 1);
      },
    };
    // 同一时间段可同时驱动多个属性（如 y + scaleY 模拟挤压拉伸）
    Object.entries(seg.props).forEach(([k, v]) => {
      if (v !== undefined) (cfg as Record<string, number>)[k] = v;
    });
    const tw = new Konva.Tween(cfg);
    tweens.push(tw);
    tw.play();
  };

  playIndex(0);

  return {
    stop: () => {
      stopped = true;
      tweens.forEach((t) => safeDestroyTween(t));
    },
  };
}

/** 「左右反弹」多段时间线动画的 Konva 播放器（编辑态画布） */
function playBounceLeftRightOnNode(
  node: Konva.Node,
  config: SingleAnimationConfig,
  onComplete?: () => void,
): (() => void) | null {
  const current = snapshotNode(node);
  const baseX = current.x; // 对象原始（设计态）x
  const stage = node.getStage();
  const stageW = (stage && stage.width()) || 375;
  const nodeW = node.width() || 0;
  // 目标位置：对象「左边缘」贴画布左 / 右边缘（留少量边距保证部分可见）
  const margin = 4;
  const leftX = margin;
  const rightX = Math.max(margin, stageW - nodeW - margin);

  const chain = playTweenChain(
    node,
    [
      { props: { x: leftX }, duration: 0.32, easing: Konva.Easings.EaseIn },
      { props: { x: rightX }, duration: 0.24, easing: Konva.Easings.EaseOut },
      { props: { x: baseX }, duration: 0.5, easing: Konva.Easings.EaseOut },
    ],
    onComplete,
  );

  return () => {
    chain.stop();
    applyState(node, current);
  };
}

/** 「弹跳」强调动画的 Konva 播放器：对标 animate.style 的 animate__bounce（画布对象上应用）
 * 纵向挤压/拉伸（scaleY），连续 3 次递减弹跳后回正，与 hover 预览 playBouncePreview 对齐。 */
function playBounceOnNode(
  node: Konva.Node,
  config: SingleAnimationConfig,
  onComplete?: () => void,
): (() => void) | null {
  const current = snapshotNode(node);
  const baseY = current.y; // 对象原始（设计态）y
  // 峰值高度与 hover 预览（playBouncePreview）保持同一算法：视觉尺寸的 0.7 倍
  const rect = node.getClientRect();
  const size = Math.max(rect.width, rect.height) || 40;
  const h = Math.round(size * 0.7); // 弹跳峰值高度（与 hover 预览同比例）

  const chain = playTweenChain(
    node,
    [
      { props: { y: baseY - h, scaleY: 1.1 }, duration: 0.16, easing: Konva.Easings.EaseOut },       // 第一次弹到峰值并纵向拉伸
      { props: { y: baseY, scaleY: 1 }, duration: 0.13, easing: Konva.Easings.EaseIn },              // 落回地面（恢复）
      { props: { y: baseY - h * 0.5, scaleY: 1.05 }, duration: 0.12, easing: Konva.Easings.EaseOut }, // 二次弹起（高度减半、轻微拉伸）
      { props: { y: baseY, scaleY: 0.95 }, duration: 0.1, easing: Konva.Easings.EaseIn },            // 落回地面（轻微压扁）
      { props: { y: baseY - h * 0.13, scaleY: 1.02 }, duration: 0.08, easing: Konva.Easings.EaseOut }, // 三次小弹起（拉伸）
      { props: { y: baseY, scaleY: 1 }, duration: 0.1, easing: Konva.Easings.EaseIn },               // 落回地面并回正（停在原始位置）
    ],
    onComplete,
  );

  return () => {
    chain.stop();
    applyState(node, current);
  };
}

/** 「抖动」系列强调动画的 Konva 播放器：对标 animate.style 的 animate__shakeX / animate__shakeY（画布对象上应用）
 * 沿单一轴（X 或 Y）往复平移，10 段交替位移（±amp），始终回到原始位置，与 hover 预览 playShakePreview 对齐。
 * shakeY 走 Y 轴（垂直），其余走 X 轴（水平）；shakeHard 振幅更大（更剧烈）。 */
function playShakeOnNode(
  node: Konva.Node,
  config: SingleAnimationConfig,
  onComplete?: () => void,
): (() => void) | null {
  const current = snapshotNode(node);
  const baseX = current.x; // 对象原始（设计态）x
  const baseY = current.y; // 对象原始（设计态）y
  const rect = node.getClientRect();
  const size = Math.max(rect.width, rect.height) || 40;
  const base = Math.max(10, Math.round(size * 0.2)); // 抖动幅度（按对象视觉尺寸等比）
  const amp = config.type === 'shakeHard' || config.type === 'shakeYHard' ? base * 1.5 : base;
  const yAxis = config.type === 'shakeY' || config.type === 'shakeYHard'; // shakeX/Y 分轴，shakeY* 走 Y 轴（垂直），其余走 X 轴（水平）

  // 10 段交替位移（对标 animate__shakeX/Y）：-amp → +amp → … → -amp → 0（回到原始位置）
  const offsets = [-amp, amp, -amp, amp, -amp, amp, -amp, amp, -amp, 0];
  const segs = offsets.map((o) => ({
    props: yAxis ? { y: baseY + o } : { x: baseX + o },
    duration: 0.08,
    easing: Konva.Easings.EaseInOut,
  }));

  const chain = playTweenChain(node, segs, onComplete);

  return () => {
    chain.stop();
    applyState(node, current);
  };
}

/** 「抖动」强调动画的 Konva 播放器：对标 animate.style 的 animate__headShake（画布对象上应用）
 * hover 预览用的是 3D 侧转 rotationY（「摇头」式左右转脸），Konva 不支持 rotateY，
 * 这里用「水平位移 + 围绕几何中心的 scaleX 横向收窄」近似侧脸的透视压缩感，
 * 5 段交替、幅度递减、始终回到原位，与 hover 预览 playHeadShakePreview 对齐。
 * 通过临时把 offset 切到几何中心并同步 position 实现「围绕中心缩放」，避免缩放引起的位置漂移。 */
function playHeadShakeOnNode(
  node: Konva.Node,
  _config: SingleAnimationConfig,
  onComplete?: () => void,
): (() => void) | null {
  const current = snapshotNode(node);
  const baseSx = current.scaleX; // 对象原始（设计态）横向缩放
  const w = node.width() || node.height() || 40;
  const h = node.height() || node.width() || 40;
  const ox = node.offsetX();
  const oy = node.offsetY();
  const cx = node.x(); // 当前 position.x（热点：top-left）
  const cy = node.y();
  const size = Math.max(w, h);
  const base = Math.max(4, Math.round(size * 0.15)); // 抖动幅度（与 hover 预览同一算法）

  // 视觉水平中心（与 hover 的 transform-origin: 50% 50% 对齐）
  const centerX = cx + (w * baseSx) / 2;

  // 把缩放中心切到几何中心：offset.x = w/2，position 同步到视觉中心，使 scaleX 围绕中心变化
  node.offset({ x: w / 2, y: oy });
  node.position({ x: centerX, y: cy });

  const restore = () => {
    node.offset({ x: ox, y: oy });
    applyState(node, current);
  };

  // 5 段交替（对标 animate__headShake 的 rotateY 侧转）：
  // 左偏+收窄(侧脸) → 右偏+收窄(侧脸) → 左偏(小)+收窄(小) → 右偏(小)+收窄(小) → 回正
  const segs = [
    { props: { x: centerX - base, scaleX: baseSx * 0.9 }, duration: 0.0625, easing: Konva.Easings.EaseInOut },
    { props: { x: centerX + base * 0.83, scaleX: baseSx * 0.93 }, duration: 0.125, easing: Konva.Easings.EaseInOut },
    { props: { x: centerX - base * 0.5, scaleX: baseSx * 0.95 }, duration: 0.125, easing: Konva.Easings.EaseInOut },
    { props: { x: centerX + base * 0.33, scaleX: baseSx * 0.97 }, duration: 0.125, easing: Konva.Easings.EaseInOut },
    { props: { x: centerX, scaleX: baseSx }, duration: 0.125, easing: Konva.Easings.EaseInOut },
  ];

  const chain = playTweenChain(
    node,
    segs,
    () => {
      restore();
      onComplete?.();
    },
  );

  return () => {
    chain.stop();
    restore();
  };
}

/** 「闪烁」强调动画的 Konva 播放器：对标 animate.style 的 animate__flash（画布对象上应用）
 * 快速闪烁两次（可见→灭→可见→灭→可见），始终以可见结束，与 hover 预览 playFlashPreview 对齐。 */
function playFlashOnNode(
  node: Konva.Node,
  _config: SingleAnimationConfig,
  onComplete?: () => void,
): (() => void) | null {
  const current = snapshotNode(node);
  const baseOpacity = current.opacity;
  const chain = playTweenChain(
    node,
    [
      { props: { opacity: 0 }, duration: 0.25, easing: Konva.Easings.EaseInOut },
      { props: { opacity: baseOpacity }, duration: 0.25, easing: Konva.Easings.EaseInOut },
      { props: { opacity: 0 }, duration: 0.25, easing: Konva.Easings.EaseInOut },
      { props: { opacity: baseOpacity }, duration: 0.25, easing: Konva.Easings.EaseInOut },
    ],
    onComplete,
  );
  return () => {
    chain.stop();
    applyState(node, current);
  };
}

/** 「脉冲」强调动画的 Konva 播放器：对标 animate.style 的 animate__pulse（画布对象上应用）
 * 单次柔和缩放 1→1.05→1（回到原尺寸），与 hover 预览 playPulsePreview 对齐。 */
function playPulseOnNode(
  node: Konva.Node,
  _config: SingleAnimationConfig,
  onComplete?: () => void,
): (() => void) | null {
  const current = snapshotNode(node);
  const sx = current.scaleX;
  const sy = current.scaleY;
  const chain = playTweenChain(
    node,
    [
      { props: { scaleX: sx * 1.05, scaleY: sy * 1.05 }, duration: 0.35, easing: Konva.Easings.EaseInOut },
      { props: { scaleX: sx, scaleY: sy }, duration: 0.35, easing: Konva.Easings.EaseInOut },
    ],
    onComplete,
  );
  return () => {
    chain.stop();
    applyState(node, current);
  };
}

/** 「弹性抖动」强调动画的 Konva 播放器：对标 animate.style 的 animate__rubberBand（画布对象上应用）
 * scaleX/scaleY 此消彼长多段摆动，回到原尺寸，与 hover 预览 playRubberBandPreview 对齐。 */
function playRubberBandOnNode(
  node: Konva.Node,
  _config: SingleAnimationConfig,
  onComplete?: () => void,
): (() => void) | null {
  const current = snapshotNode(node);
  const sx = current.scaleX;
  const sy = current.scaleY;
  const chain = playTweenChain(
    node,
    [
      { props: { scaleX: sx * 1.25, scaleY: sy * 0.75 }, duration: 0.3, easing: Konva.Easings.EaseInOut },
      { props: { scaleX: sx * 0.75, scaleY: sy * 1.25 }, duration: 0.1, easing: Konva.Easings.EaseInOut },
      { props: { scaleX: sx * 1.15, scaleY: sy * 0.85 }, duration: 0.1, easing: Konva.Easings.EaseInOut },
      { props: { scaleX: sx * 0.95, scaleY: sy * 1.05 }, duration: 0.1, easing: Konva.Easings.EaseInOut },
      { props: { scaleX: sx * 1.05, scaleY: sy * 0.95 }, duration: 0.1, easing: Konva.Easings.EaseInOut },
      { props: { scaleX: sx, scaleY: sy }, duration: 0.3, easing: Konva.Easings.EaseInOut },
    ],
    onComplete,
  );
  return () => {
    chain.stop();
    applyState(node, current);
  };
}

/** 「摇晃」强调动画的 Konva 播放器：对标 animate.style 的 animate__wobble（画布对象上应用）
 * 水平位移（x）+ 小角度旋转交替摆动、幅度递减，回到原位，与 hover 预览 playSideWobblePreview 对齐。 */
function playWobbleOnNode(
  node: Konva.Node,
  _config: SingleAnimationConfig,
  onComplete?: () => void,
): (() => void) | null {
  const current = snapshotNode(node);
  const baseX = current.x;
  const baseRot = current.rotation;
  const w = node.width() || node.getClientRect().width || 40;
  const chain = playTweenChain(
    node,
    [
      { props: { x: baseX - w * 0.25, rotation: baseRot - 5 }, duration: 0.15, easing: Konva.Easings.EaseInOut },
      { props: { x: baseX + w * 0.2, rotation: baseRot + 3 }, duration: 0.15, easing: Konva.Easings.EaseInOut },
      { props: { x: baseX - w * 0.15, rotation: baseRot - 3 }, duration: 0.15, easing: Konva.Easings.EaseInOut },
      { props: { x: baseX + w * 0.1, rotation: baseRot + 2 }, duration: 0.15, easing: Konva.Easings.EaseInOut },
      { props: { x: baseX - w * 0.05, rotation: baseRot - 1 }, duration: 0.15, easing: Konva.Easings.EaseInOut },
      { props: { x: baseX, rotation: baseRot }, duration: 0.25, easing: Konva.Easings.EaseInOut },
    ],
    onComplete,
  );
  return () => {
    chain.stop();
    applyState(node, current);
  };
}

/** 「摇摆」强调动画的 Konva 播放器：对标 animate.style 的 animate__swing（画布对象上应用）
 * 绕顶边中心（transform-origin: top center）左右摆动，幅度递减回到原位，与 hover 预览 playSwayPivotPreview 完全对齐。
 * 注意：传给本函数的节点是「外层 Group」，其 offset=（0,0）、本地原点恰好落在图形几何中心，
 * 单靠 node.offsetX()/offsetY() 会得到 0，旧公式因此退化成「绕中心旋转」。
 * 故改用 getClientRect({ relativeTo: node }) 取得元素在「自身本地坐标系」中的顶部中心，
 * 再按当前旋转/缩放把它映到父坐标并设为旋转轴，旋转精确绕「顶边中心」且形状不跳变（任意旋转/缩放下成立）。 */
function playSwingOnNode(
  node: Konva.Node,
  _config: SingleAnimationConfig,
  onComplete?: () => void,
): (() => void) | null {
  const current = snapshotNode(node);
  const baseRot = current.rotation;
  const ox = node.offsetX(); // 元素原始 offset（外层 Group = 0，内层 Group = 设计宽/高的一半）
  const oy = node.offsetY();
  const sx = current.scaleX || 1;
  const sy = current.scaleY || 1;

  // 元素在「自身本地坐标系」中的包围盒（relativeTo=node 给出子节点相对本节点本地坐标的包围盒，
  // 不受本节点自身 offset/position/rotation 影响）。其顶部中心 (localTopX, localTopY) 即旋转轴对应的本地点。
  const localRect = node.getClientRect({
    relativeTo: node as unknown as Konva.Container,
    skipStroke: true,
    skipShadow: true,
  });
  const localTopX = localRect.x + localRect.width / 2;
  const localTopY = localRect.y;

  // 把本地顶部中心映到父坐标中的旋转轴位置：pivot = curPos + R(r)·S(s)·(localTop - curOffset)。
  // 再将 offset 设为该本地点、position 设为它的父坐标位置，旋转即绕顶边中心，且变换矩阵不变、形状不跳变。
  const rad = (baseRot * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const pivotX = current.x + (c * (localTopX - ox) * sx - s * (localTopY - oy) * sy);
  const pivotY = current.y + (s * (localTopX - ox) * sx + c * (localTopY - oy) * sy);
  node.offset({ x: localTopX, y: localTopY });
  node.position({ x: pivotX, y: pivotY });

  const restore = () => {
    node.offset({ x: ox, y: oy });
    applyState(node, current);
  };

  const chain = playTweenChain(
    node,
    [
      { props: { rotation: baseRot + 15 }, duration: 0.2, easing: Konva.Easings.EaseInOut },
      { props: { rotation: baseRot - 10 }, duration: 0.2, easing: Konva.Easings.EaseInOut },
      { props: { rotation: baseRot + 5 }, duration: 0.2, easing: Konva.Easings.EaseInOut },
      { props: { rotation: baseRot - 5 }, duration: 0.2, easing: Konva.Easings.EaseInOut },
      { props: { rotation: baseRot }, duration: 0.2, easing: Konva.Easings.EaseInOut },
    ],
    () => {
      restore();
      onComplete?.();
    },
  );

  return () => {
    chain.stop();
    restore();
  };
}

/** 「放大抖动」强调动画的 Konva 播放器：对标 animate.style 的 animate__tada（画布对象上应用）
 * 先缩小微倾、再放大并以 ±3° 左右摆动、回正，与 hover 预览 playTadaPreview 对齐。 */
function playTadaOnNode(
  node: Konva.Node,
  _config: SingleAnimationConfig,
  onComplete?: () => void,
): (() => void) | null {
  const current = snapshotNode(node);
  const sx = current.scaleX;
  const sy = current.scaleY;
  const baseRot = current.rotation;
  const chain = playTweenChain(
    node,
    [
      { props: { scaleX: sx * 0.9, scaleY: sy * 0.9, rotation: baseRot - 3 }, duration: 0.2, easing: Konva.Easings.EaseInOut },
      { props: { scaleX: sx * 1.1, scaleY: sy * 1.1, rotation: baseRot + 3 }, duration: 0.2, easing: Konva.Easings.EaseInOut },
      { props: { scaleX: sx * 1.1, scaleY: sy * 1.1, rotation: baseRot - 3 }, duration: 0.2, easing: Konva.Easings.EaseInOut },
      { props: { scaleX: sx * 1.1, scaleY: sy * 1.1, rotation: baseRot + 3 }, duration: 0.2, easing: Konva.Easings.EaseInOut },
      { props: { scaleX: sx * 1.1, scaleY: sy * 1.1, rotation: baseRot - 3 }, duration: 0.1, easing: Konva.Easings.EaseInOut },
      { props: { scaleX: sx, scaleY: sy, rotation: baseRot }, duration: 0.1, easing: Konva.Easings.EaseInOut },
    ],
    onComplete,
  );
  return () => {
    chain.stop();
    applyState(node, current);
  };
}

/** 「倾斜抖动」强调动画的 Konva 播放器：对标 animate.style 的 animate__jello（画布对象上应用）
 * scaleX/scaleY + skewX/skewY 交错摆动、幅度递减、回正，与 hover 预览 playJelloPreview 对齐。 */
function playJelloOnNode(
  node: Konva.Node,
  _config: SingleAnimationConfig,
  onComplete?: () => void,
): (() => void) | null {
  const current = snapshotNode(node);
  const sx = current.scaleX;
  const sy = current.scaleY;
  const chain = playTweenChain(
    node,
    [
      { props: { scaleX: sx * 1.25, scaleY: sy * 0.75, skewX: 4, skewY: 4 }, duration: 0.3, easing: Konva.Easings.EaseInOut },
      { props: { scaleX: sx * 0.75, scaleY: sy * 1.25, skewX: -4, skewY: -4 }, duration: 0.1, easing: Konva.Easings.EaseInOut },
      { props: { scaleX: sx * 1.15, scaleY: sy * 0.85, skewX: 4, skewY: 4 }, duration: 0.1, easing: Konva.Easings.EaseInOut },
      { props: { scaleX: sx * 0.95, scaleY: sy * 1.05, skewX: -2, skewY: -2 }, duration: 0.15, easing: Konva.Easings.EaseInOut },
      { props: { scaleX: sx * 1.05, scaleY: sy * 0.95, skewX: 2, skewY: 2 }, duration: 0.1, easing: Konva.Easings.EaseInOut },
      { props: { scaleX: sx, scaleY: sy, skewX: 0, skewY: 0 }, duration: 0.25, easing: Konva.Easings.EaseInOut },
    ],
    onComplete,
  );
  return () => {
    chain.stop();
    applyState(node, current);
  };
}

/** 「心跳」强调动画的 Konva 播放器：连续 3 次缩放脉冲（围绕几何中心，scale 1 → 1.3 → 1 → 1.3 → 1 → 1.3 → 1），
 * 以原尺寸结束，与 hover 预览 playHeartBeatPreview 完全对齐。
 * 节点为外层 Group（offset=0、本地原点落在视觉中心），scaleX/scaleY 绕视觉中心缩放，
 * 元素原地搏动而不漂移（与 pulse/rubberBand/tada/jello 同源模式）。 */
function playHeartBeatOnNode(
  node: Konva.Node,
  _config: SingleAnimationConfig,
  onComplete?: () => void,
): (() => void) | null {
  const current = snapshotNode(node);
  const sx = current.scaleX;
  const sy = current.scaleY;
  const peak = 1.3;
  const chain = playTweenChain(
    node,
    [
      { props: { scaleX: sx * peak, scaleY: sy * peak }, duration: 0.18, easing: Konva.Easings.EaseInOut }, // 第 1 次搏动：放大
      { props: { scaleX: sx, scaleY: sy }, duration: 0.18, easing: Konva.Easings.EaseInOut },               // 回落
      { props: { scaleX: sx * peak, scaleY: sy * peak }, duration: 0.18, easing: Konva.Easings.EaseInOut }, // 第 2 次搏动
      { props: { scaleX: sx, scaleY: sy }, duration: 0.18, easing: Konva.Easings.EaseInOut },               // 回落
      { props: { scaleX: sx * peak, scaleY: sy * peak }, duration: 0.18, easing: Konva.Easings.EaseInOut }, // 第 3 次搏动
      { props: { scaleX: sx, scaleY: sy }, duration: 0.18, easing: Konva.Easings.EaseInOut },               // 回落到原尺寸（以原尺寸结束）
    ],
    onComplete,
  );
  return () => {
    chain.stop();
    applyState(node, current);
  };
}

/**
 * 串行播放一组动画，按数组顺序逐个执行。
 * 返回清理函数：停止当前及后续所有动画，并恢复设计态。
 */
export function playAnimationsOnNode(
  node: Konva.Node,
  configs: SingleAnimationConfig[],
): (() => void) | null {
  if (!configs.length) return null;

  let stopped = false;
  let currentCleanup: (() => void) | null = null;
  let index = 0;

  const playNext = () => {
    if (stopped) return;
    if (index >= configs.length) {
      currentCleanup = null;
      return;
    }
    const cfg = configs[index++];
    currentCleanup = playAnimationOnNode(node, cfg, () => {
      // 当前动画播放完成，继续下一个
      currentCleanup = null;
      playNext();
    });
    if (!currentCleanup) {
      playNext();
    }
  };

  playNext();

  return () => {
    stopped = true;
    currentCleanup?.();
    currentCleanup = null;
  };
}

/**
 * 视频导出专用：把节点瞬时切到「入场动画起始（隐藏）态」并截帧，返回还原回调。
 *
 * 用途：主循环先截一张「隐藏起始态」首帧，避免页面切换时先闪现最终效果（设计态）再播入场动画的跳变；
 * 截完即调用还原回调把节点恢复为设计态，随后 playAnimationsOnNode 才能以设计态为基准、start/end 计算正确。
 *
 * 仅对「入场（enter）且非多段」动画生效；强调 / 出场 / 多段动画首帧即为设计态，不改。
 */
export function applyEnterStartState(
  node: Konva.Node,
  configs: SingleAnimationConfig[],
): (() => void) | null {
  const enterCfg = configs.find((c) => {
    const def = findAnimationDef(c.category, c.type);
    return !!def && !def.multi && c.category === 'enter';
  });
  if (!enterCfg) return null;
  const def = findAnimationDef(enterCfg.category, enterCfg.type);
  if (!def) return null;
  const current = snapshotNode(node);
  const { start } = computeStates(enterCfg.category, def.vars as Record<string, unknown>, current);
  applyState(node, start);
  return () => applyState(node, current);
}
