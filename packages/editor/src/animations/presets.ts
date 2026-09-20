/**
 * GSAP 动画预设库
 * 将 AnimationConfig 映射为 GSAP tween
 */
import gsap from 'gsap';
import type {
  AnimationConfig,
  SingleAnimationConfig,
  EnterAnimationType,
  LoopAnimationType,
  EasingType,
} from '@h5design/core';
import { findAnimationDef } from './registry';

/**
 * 全局禁用 3D 合成层（force3D）。
 * 预览窗口的所有元素都被 DOMRenderer 包在 `transform: scale(...)` 的父容器内；
 * 若子元素被提升为 translateZ(0) 的 3D 合成层，浏览器会在动画中途把该层「扁平化」，
 * 表现为「前半流畅、后半突然跳到最终帧」——这正是预览比编辑器（Konva 画布）不一致的根因。
 * 统一用 2D 矩阵变换可彻底消除该问题，且起止状态/缓动/中心点/时长与编辑器完全对齐。
 */
gsap.defaults({ force3D: false });

/** GSAP easing 映射 */
const EASING_MAP: Record<EasingType, string> = {
  linear: 'none',
  ease: 'power1.inOut',
  easeIn: 'power2.in',
  easeOut: 'power2.out',
  easeInOut: 'power2.inOut',
  bounce: 'bounce.out',
};

/** GSAP 可动画的设计态完整快照（与编辑器 konvaPlayer.snapshotNode 一一对应） */
export type DesignState = {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  skewX: number;
  skewY: number;
};

/**
 * 读取元素「设计态」的完整 GSAP 可动画属性快照。
 * 与编辑器 konvaPlayer.snapshotNode 完全对应：x / y / scaleX / scaleY / rotation / opacity / skewX / skewY。
 *
 * 关键：在 React 渲染出设计态之后、动画播放之前**调用一次**，作为整条动画链路的「真相源」。
 * 旧实现（buildDomTweenVars）在播放时通过 gsap.getProperty 重新读取元素「当前态」作为另一端锚点，
 * 在 React StrictMode 重入、序列 onComplete 复位、半途打断等场景下会读到残留半途值，
 * 导致动画只播一小段就停在某半途态、随后被复位到设计态 —— 表现为「前半段流畅、后半段跳到末帧」。
 * 改为一次性捕获设计态、再用 computeDomStates 显式算出起止态，彻底消除对「当前态」的隐式依赖。
 */
function captureDesignState(el: HTMLElement): DesignState {
  const num = (p: string, d: number) => {
    const v = Number(gsap.getProperty(el, p));
    return Number.isFinite(v) ? v : d;
  };
  return {
    x: num('x', 0),
    y: num('y', 0),
    scaleX: num('scaleX', 1),
    scaleY: num('scaleY', 1),
    rotation: num('rotation', 0),
    opacity: num('opacity', 1),
    skewX: num('skewX', 0),
    skewY: num('skewY', 0),
  };
}

/**
 * 把元素强制恢复到设计态（与编辑器 cleanup 的 applyState(node, current) 对应）。
 * 用 gsap.set 而非直接改 el.style，保证 GSAP 内部缓存与内联样式同步，
 * 避免后续播放通过 getProperty 读到脏值（手动写 el.style.transform 会让 GSAP 缓存失同步）。
 */
function restoreDesignState(el: HTMLElement, design: DesignState) {
  gsap.set(el, { ...design });
}

/**
 * 根据注册表 vars 与动画分类，计算 DOM(GSAP) 的「起始 / 结束」完整状态。
 * 与编辑器 Konva 播放器 computeStates 逐字段对齐（所见即所得）：
 *  - start / end 均为「完整设计态」对象（每个可动画属性都有明确值），
 *    直接作为 gsap.fromTo 的 from / to，实现完全显式、连贯、可重入的预览动画。
 *  - x / y / rotation / skewX / skewY 是相对设计态的偏移：
 *      enter 取 start = design + offset；exit / emphasis 取 end = design + offset
 *  - opacity / scale 为绝对值（直接取值）
 *  - rotateX / rotateY（3D 翻转）在 DOM 端退化为 scaleY / scaleX = 0 的「压扁」近似，
 *    与 Konva 画布（无原生 3D）表现一致，保证预览与设计态逐帧对齐
 */
function computeDomStates(
  category: SingleAnimationConfig['category'],
  vars: gsap.TweenVars,
  current: DesignState,
): { start: DesignState; end: DesignState } {
  const start: DesignState = { ...current };
  const end: DesignState = { ...current };

  for (const [key, raw] of Object.entries(vars)) {
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;

    if (key === 'scale') {
      // GSAP 没有单一数值型 scale，映射到 scaleX / scaleY
      if (category === 'enter') {
        start.scaleX = value;
        start.scaleY = value;
      } else {
        end.scaleX = value;
        end.scaleY = value;
      }
      continue;
    }

    // 3D 翻转在 DOM 端退化为「压扁至消失」，旋转轴方向与编辑器一致
    if (key === 'rotateX') {
      if (category === 'enter') start.scaleY = 0;
      else end.scaleY = 0;
      continue;
    }
    if (key === 'rotateY') {
      if (category === 'enter') start.scaleX = 0;
      else end.scaleX = 0;
      continue;
    }

    if (key === 'opacity') {
      if (category === 'enter') start.opacity = value;
      else end.opacity = value;
      continue;
    }

    // 相对偏移类：enter 取 start = design + offset；exit / emphasis 取 end = design + offset
    if (key === 'x') {
      if (category === 'enter') start.x = current.x + value;
      else end.x = current.x + value;
    } else if (key === 'y') {
      if (category === 'enter') start.y = current.y + value;
      else end.y = current.y + value;
    } else if (key === 'rotation') {
      if (category === 'enter') start.rotation = current.rotation + value;
      else end.rotation = current.rotation + value;
    } else if (key === 'skewX') {
      if (category === 'enter') start.skewX = current.skewX + value;
      else end.skewX = current.skewX + value;
    } else if (key === 'skewY') {
      if (category === 'enter') start.skewY = current.skewY + value;
      else end.skewY = current.skewY + value;
    }
  }

  return { start, end };
}

/**
 * 新版通用动画：基于设计态显式 fromTo 播放，与编辑器 Konva 播放器（computeStates）完全对齐。
 * 传入的 design（由 playElementAnimation 在元素挂载后一次性捕获）作为起止态计算的真相源，
 * 不再依赖 gsap.from / gsap.to 隐式读取元素「当前态」，从而在重入 / 序列 / 半途打断下都能连贯播放到末帧。
 */
export function playSingleAnimation(
  el: HTMLElement,
  config: SingleAnimationConfig,
  design?: DesignState,
): gsap.core.Tween | gsap.core.Timeline | null {
  const def = findAnimationDef(config.category, config.type);
  if (!def) return null;

  // 多段自定义时间线动画（强调 bounce/flash/pulse/swing/wobble/tada/… + 入场 bounceLeftRight）：
  // 发布/预览态必须与编辑器「预览动画」及画布应用保持一致，调用专用 DOM 时间线播放器；
  // 否则会退化成 registry 原值（部分 multi 的 vars 为空，例如 bounceLeftRight → 完全不动，
  // 其余多段动画也只会退化成单一位移/缩放，效果与编辑器不符，破坏所见即所得）。
  if (def.multi) {
    const tl = playMultiDomTimeline(el, config.type);
    if (tl) {
      const delay = config.delay ?? 0;
      const repeat = config.loop ? -1 : 0;
      if (delay > 0) tl.delay(delay);
      if (repeat !== 0) tl.repeat(repeat);
      return tl;
    }
    return null;
  }

  // 非多段动画：与编辑器 Konva 播放器（computeStates）逐字段对齐 ——
  //   · 相同起止状态语义（相对偏移 / scale / 3D 翻转退化为压扁）
  //   · 相同缓动（def.vars.ease || 'power2.out'）
  //   · 中心 transform-origin，保证预览与设计态连贯流畅、所见即所得
  //   · 全局 force3D:false（见文件顶部），避免缩放父容器内 3D 合成层被扁平化导致跳帧
  //   · 显式 fromTo：立即把元素置于 start（=设计态 / 入场起始态），再补间到 end（=设计态 / 出场目标态），
  //     不读取「当前态」，彻底消除重入跳帧。
  const current = design ?? captureDesignState(el);
  const { start, end } = computeDomStates(config.category, def.vars, current);
  const ease = (def.vars.ease as string | undefined) || 'power2.out';
  const duration = config.duration ?? (def.vars.duration as number | undefined) ?? 0.6;
  const delay = config.delay ?? 0;
  const repeat = config.loop ? -1 : Math.max(0, config.repeat ?? 0);

  const base: gsap.TweenVars = {
    duration,
    delay,
    repeat,
    ease,
    transformOrigin: '50% 50%',
  };

  const toVars: gsap.TweenVars = { ...end, ...base };
  // 强调动画默认 yoyo 往返；旋转等单向循环动画在注册表标记 yoyo=false
  if (config.category === 'emphasis' && def.yoyo !== false) {
    toVars.yoyo = true;
  }
  return gsap.fromTo(el, { ...start }, toVars);
}

/**
 * 动画选择对话框的 hover 预览专用播放器。
 * registry 里的位移是「真实 H5 元素」的绝对值（px），放在 40px 小图标上要么飞出裁剪舞台、
 * 要么只是一闪而过；纯 opacity 的淡入在蓝底蓝图标上也几乎看不出。
 * 这里把幅度按图标尺寸相对化放大，让用户停上去就能明显看出动画的方向与力度。
 * 入场/出场为单次播放（移入后停在设计态）；强调按注册表 yoyo 设定循环演示。
 * 发布态仍走 playSingleAnimation（registry 原值）。
 */
export function playPreviewAnimation(
  el: HTMLElement,
  config: SingleAnimationConfig,
): gsap.core.Tween | gsap.core.Timeline | null {
  const def = findAnimationDef(config.category, config.type);
  if (!def) return null;

  // 多段时间线动画走专用预览播放器，不走下方标准 from/to
  if (def.multi) {
    if (config.type === 'bounceLeftRight') return playBounceLeftRightPreview(el);
    if (config.type === 'bounce') return playBouncePreview(el);
    if (config.type === 'shake' || config.type === 'shakeHard' || config.type === 'shakeY' || config.type === 'shakeYHard') return playShakePreview(el, config.type);
    if (config.type === 'headShake') return playHeadShakePreview(el);
    // 以下强调效果与画布播放器（play*OnNode）一一对齐
    if (config.type === 'flash') return playFlashPreview(el);
    if (config.type === 'pulse') return playPulsePreview(el);
    if (config.type === 'rubberBand') return playRubberBandPreview(el);
    if (config.type === 'swing') return playSwayPivotPreview(el);
    if (config.type === 'wobble') return playSideWobblePreview(el);
    if (config.type === 'tada') return playTadaPreview(el);
    if (config.type === 'jello') return playJelloPreview(el);
    if (config.type === 'heartBeat') return playHeartBeatPreview(el);
    return null;
  }

  const box = el.getBoundingClientRect();
  const size = Math.max(box.width, box.height) || 40;
  const src = def.vars as gsap.TweenVars;
  // 「移出」组（exit 类纯位移、无透明度变化）需让形状完整移出预览舞台（容器约 168×80、overflow-hidden），
  // 故用足够大的位移（下限 120px，覆盖半宽/半高 + 图标半宽）；其余效果保持较小位移，避免飞出裁剪舞台。
  const isSlideOut =
    config.category === 'exit' && src.opacity === undefined && (src.x !== undefined || src.y !== undefined);
  const travel = isSlideOut ? Math.max(Math.round(size * 3), 120) : Math.round(size * 0.95);

  const amplifyEnterExitScale = (val: number) => (val >= 1 ? 1.8 : 0.1);
  const amplifyEmphasisScale = (val: number) => 1 + (val - 1) * 2.5;

  const preview: gsap.TweenVars = {};

  if (src.opacity !== undefined) preview.opacity = src.opacity;

  if (src.x !== undefined) preview.x = (Number(src.x) >= 0 ? 1 : -1) * travel;
  if (src.y !== undefined) preview.y = (Number(src.y) >= 0 ? 1 : -1) * travel;

  if (src.scale !== undefined) {
    const val = Number(src.scale);
    preview.scale = config.category === 'emphasis' ? amplifyEmphasisScale(val) : amplifyEnterExitScale(val);
  }
  if (src.scaleX !== undefined) {
    const val = Number(src.scaleX);
    preview.scaleX = config.category === 'emphasis' ? amplifyEmphasisScale(val) : amplifyEnterExitScale(val);
  }
  if (src.scaleY !== undefined) {
    const val = Number(src.scaleY);
    preview.scaleY = config.category === 'emphasis' ? amplifyEmphasisScale(val) : amplifyEnterExitScale(val);
  }

  if (src.rotation !== undefined) {
    const mag = Math.max(160, Math.abs(Number(src.rotation)));
    preview.rotation = (Number(src.rotation) >= 0 ? 1 : -1) * mag;
  }
  if (src.rotateX !== undefined) preview.rotateX = src.rotateX;
  if (src.rotateY !== undefined) preview.rotateY = src.rotateY;
  if (src.skewX !== undefined) preview.skewX = src.skewX;
  if (src.skewY !== undefined) preview.skewY = src.skewY;

  // 纯透明度入场（如 fadeIn）：仅做 opacity 0→1 的淡入，不补位移/缩放
  const hasMotion =
    src.x !== undefined || src.y !== undefined || src.scale !== undefined ||
    src.scaleX !== undefined || src.scaleY !== undefined || src.rotation !== undefined ||
    src.rotateX !== undefined || src.rotateY !== undefined || src.skewX !== undefined ||
    src.skewY !== undefined;

  const duration = 0.6;
  // 强调：按注册表 yoyo 设定循环演示；入场/出场：单次播放，移入/移出后停在中心设计态
  const yoyo = config.category === 'emphasis' ? def.yoyo !== false : false;
  const repeat = config.category === 'emphasis' ? (def.yoyo === false ? 1 : 3) : 0;

  // 纯透明度入场（如 fadeIn）：鼠标停靠时图标立刻消失（start=0），
  // 再做一次 0→1 淡入，单程约 2.5 秒；yoyo:false 避免反向成「淡出」
  if (config.category === 'enter' && !hasMotion) {
    return gsap.fromTo(
      el,
      { opacity: 0 },
      {
        opacity: 1,
        duration: 2.5,
        ease: (src.ease as string) || 'power2.out',
        repeat: 0,
        yoyo: false,
      },
    );
  }

  const vars: gsap.TweenVars = {
    ...preview,
    duration,
    ease: (src.ease as string) || 'power2.out',
    repeat,
    yoyo,
  };

  switch (config.category) {
    case 'enter':
      return gsap.from(el, vars);
    case 'exit':
      return gsap.to(el, vars);
    case 'emphasis':
      return gsap.to(el, vars);
    default:
      return null;
  }
}

/** 「左右反弹」等自定义多段时间线动画的 hover 预览专用播放器（DOM 图标） */
function playBounceLeftRightPreview(el: HTMLElement): gsap.core.Timeline {
  const box = el.getBoundingClientRect();
  const size = Math.max(box.width, box.height) || 40;
  const travel = Math.round(size * 0.7);
  const tl = gsap.timeline();
  tl.to(el, { x: -travel, duration: 0.3, ease: 'power3.in' }); // 从中间向左侧快速移动（加速）
  tl.to(el, { x: travel, duration: 0.22, ease: 'power1.out' }); // 反弹到右侧
  tl.to(el, { x: 0, duration: 0.5, ease: 'power2.out' }); // 减速回到中心停止
  return tl;
}

/** 「弹跳」强调动画的 hover 预览：对标 animate.style 的 animate__bounce
 * 关键特征——纵向挤压/拉伸（scaleY）：上升时拉伸、落地时压扁，连续 3 次递减弹跳后回正。 */
function playBouncePreview(el: HTMLElement): gsap.core.Timeline {
  const box = el.getBoundingClientRect();
  const size = Math.max(box.width, box.height) || 40;
  const h = Math.round(size * 0.7); // 峰值高度（对标 animate__bounce 的 -30px）
  const tl = gsap.timeline({ defaults: { transformOrigin: '50% 50%' } });
  // 段1：第一次弹到峰值并纵向拉伸(scaleY 1.1)
  tl.to(el, { y: -h, scaleY: 1.1, duration: 0.16, ease: 'power2.out' });
  // 段2：落回地面（恢复）
  tl.to(el, { y: 0, scaleY: 1, duration: 0.13, ease: 'power1.in' });
  // 段3：二次弹起（高度减半、轻微拉伸 1.05）
  tl.to(el, { y: -h * 0.5, scaleY: 1.05, duration: 0.12, ease: 'power2.out' });
  // 段4：落回地面（轻微压扁 0.95）
  tl.to(el, { y: 0, scaleY: 0.95, duration: 0.1, ease: 'power1.in' });
  // 段5：三次小弹起（拉伸 1.02）
  tl.to(el, { y: -h * 0.13, scaleY: 1.02, duration: 0.08, ease: 'power2.out' });
  // 段6：落回地面并回正（停在原始位置）
  tl.to(el, { y: 0, scaleY: 1, duration: 0.1, ease: 'power1.in' });
  return tl;
}

/** 「抖动」系列强调动画的 hover 预览：对标 animate.style 的 animate__shakeX / animate__shakeY
 * 关键特征——沿单一轴（X 或 Y）往复平移，10 段交替位移（±amp），始终以原位置结束、不残留偏移。
 * - shake / shakeHard：沿 X 轴（水平）→ 对标 animate__shakeX
 * - shakeY：沿 Y 轴（垂直）→ 对标 animate__shakeY
 * shakeHard 振幅更大（更剧烈）。 */
function playShakePreview(el: HTMLElement, type: string): gsap.core.Timeline {
  const box = el.getBoundingClientRect();
  const size = Math.max(box.width, box.height) || 40;
  const base = Math.max(6, Math.round(size * 0.3)); // 抖动幅度（对标 animate__shakeX/Y 的 ±10px，按图标尺寸等比放大以便看清）
  const amp = type === 'shakeHard' || type === 'shakeYHard' ? base * 1.5 : base;
  const axis: 'x' | 'y' = type === 'shakeY' || type === 'shakeYHard' ? 'y' : 'x'; // shakeY / shakeYHard 沿 Y 轴（垂直），其余沿 X 轴（水平）
  const tl = gsap.timeline();
  tl.to(el, { [axis]: -amp, duration: 0.08 }); // 0%→10%：轴负向
  tl.to(el, { [axis]: amp, duration: 0.08 });  // 10%→20%：轴正向
  tl.to(el, { [axis]: -amp, duration: 0.08 }); // 20%→30%
  tl.to(el, { [axis]: amp, duration: 0.08 });  // 30%→40%
  tl.to(el, { [axis]: -amp, duration: 0.08 }); // 40%→50%
  tl.to(el, { [axis]: amp, duration: 0.08 });  // 50%→60%
  tl.to(el, { [axis]: -amp, duration: 0.08 }); // 60%→70%
  tl.to(el, { [axis]: amp, duration: 0.08 });  // 70%→80%
  tl.to(el, { [axis]: -amp, duration: 0.08 }); // 80%→90%
  tl.to(el, { [axis]: 0, duration: 0.08 });    // 90%→100%：回正到原位置
  return tl;
}

/** 「抖动」强调动画的 hover 预览：对标 animate.style 的 animate__headShake
 * 关键特征——左右「摇头」式摆动：translateX 与 rotateY 交替（左偏+负旋 → 右偏+正旋 → 幅度递减），
 * 始终以原位置结束、不残留偏移。借助 transformPerspective 让 rotateY（3D 侧转）在小图标上也可见。 */
function playHeadShakePreview(el: HTMLElement): gsap.core.Timeline {
  const box = el.getBoundingClientRect();
  const size = Math.max(box.width, box.height) || 40;
  const base = Math.max(4, Math.round(size * 0.15)); // 抖动幅度（对标 animate__headShake 的 ±6px，按图标尺寸等比）
  gsap.set(el, { transformPerspective: 200, transformOrigin: '50% 50%' }); // 让 rotateY 可见
  const tl = gsap.timeline({ defaults: { ease: 'power1.inOut' } });
  tl.set(el, { x: 0, rotationY: 0 });
  tl.to(el, { x: -base, rotationY: -9, duration: 0.0625 });        // 0%→6.25%：左偏 + 负侧转
  tl.to(el, { x: base * 0.83, rotationY: 7, duration: 0.125 });     // 6.25%→18.75%：右偏 + 正侧转
  tl.to(el, { x: -base * 0.5, rotationY: -5, duration: 0.125 });    // 18.75%→31.25%：左偏（更小）+ 负侧转（更小）
  tl.to(el, { x: base * 0.33, rotationY: 3, duration: 0.125 });    // 31.25%→43.75%：右偏（更小）+ 正侧转（更小）
  tl.to(el, { x: 0, rotationY: 0, duration: 0.125 });              // 43.75%→56.25%：回正到原位置
  return tl;
}

/** 「闪烁」强调动画的 hover 预览：对标 animate.style 的 animate__flash
 * 关键特征——快速闪烁两次（opacity 1→0→1→0→1），始终以可见结束、不残留不可见状态。 */
function playFlashPreview(el: HTMLElement): gsap.core.Timeline {
  const tl = gsap.timeline({ defaults: { ease: 'power1.inOut' } });
  tl.to(el, { opacity: 0, duration: 0.25 }); // 0%→25%：可见 → 闪灭（第一次）
  tl.to(el, { opacity: 1, duration: 0.25 }); // 25%→50%：闪灭 → 可见
  tl.to(el, { opacity: 0, duration: 0.25 }); // 50%→75%：可见 → 闪灭（第二次）
  tl.to(el, { opacity: 1, duration: 0.25 }); // 75%→100%：闪灭 → 可见（以可见结束）
  return tl;
}

/** 「脉冲」强调动画的 hover 预览：对标 animate.style 的 animate__pulse
 * 关键特征——单次柔和的缩放脉冲（scale 1 → 峰值 → 1），始终以原尺寸结束、不残留放大状态。
 * 峰值取 animate__pulse 的 1.05（温和脉冲）；若在小图标上不明显可上调。 */
function playPulsePreview(el: HTMLElement): gsap.core.Timeline {
  const peak = 1.05; // 对标 animate__pulse 的关键帧 scale3d(1.05,1.05,1.05)
  const tl = gsap.timeline({ defaults: { ease: 'power1.inOut', transformOrigin: '50% 50%' } });
  tl.to(el, { scale: peak, duration: 0.35 }); // 0%→50%：原尺寸 → 放大到峰值（柔和）
  tl.to(el, { scale: 1, duration: 0.35 });    // 50%→100%：峰值 → 回到原尺寸（以原尺寸结束）
  return tl;
}

/** 「弹性抖动」强调动画的 hover 预览：对标 animate.style 的 animate__rubberBand
 * 关键特征——拉伸/挤压交替的多段摆动（scaleX/scaleY 此消彼长），始终以原尺寸结束、不残留变形。 */
function playRubberBandPreview(el: HTMLElement): gsap.core.Timeline {
  // 关键帧比例严格对标 animate__rubberBand：0%:1/1 → 30%:1.25/0.75 → 40%:0.75/1.25
  //   → 50%:1.15/0.85 → 60%:0.95/1.05 → 70%:1.05/0.95 → 100%:1/1
  const tl = gsap.timeline({ defaults: { ease: 'power1.inOut', transformOrigin: '50% 50%' } });
  tl.to(el, { scaleX: 1.25, scaleY: 0.75, duration: 0.3 }); // 0%→30%：变宽变矮
  tl.to(el, { scaleX: 0.75, scaleY: 1.25, duration: 0.1 }); // 30%→40%：变窄变高
  tl.to(el, { scaleX: 1.15, scaleY: 0.85, duration: 0.1 }); // 40%→50%：略宽略矮
  tl.to(el, { scaleX: 0.95, scaleY: 1.05, duration: 0.1 }); // 50%→60%：略窄略高
  tl.to(el, { scaleX: 1.05, scaleY: 0.95, duration: 0.1 }); // 60%→70%：微宽微矮
  tl.to(el, { scaleX: 1, scaleY: 1, duration: 0.3 });       // 70%→100%：回正到原尺寸
  return tl;
}

/** 「摇摆」强调动画的 hover 预览：对标 animate.style 的 animate__swing
 * 绕元素顶部中心（transform-origin: top center）左右摆动：
 * 0° → 15° → -10° → 5° → -5° → 0°，幅度递减，以原位结束。
 * 使用相对旋转，使元素在「设计态旋转角」基础上摆动并最终回到设计态
 * （发布态元素可能带非零设计旋转角，绝对 0° 会丢失设计旋转）。 */
function playSwayPivotPreview(el: HTMLElement): gsap.core.Timeline {
  const tl = gsap.timeline({ defaults: { ease: 'power1.inOut', transformOrigin: '50% 0%' } });
  tl.to(el, { rotation: '+=15', duration: 0.2 });   // 向右上方摆动
  tl.to(el, { rotation: '-=25', duration: 0.2 });   // 向左回摆越过中心
  tl.to(el, { rotation: '+=15', duration: 0.2 });    // 向右小摆（幅度变小）
  tl.to(el, { rotation: '-=10', duration: 0.2 });   // 向左小摆
  tl.to(el, { rotation: '+=5', duration: 0.2 });    // 回到原位（以可见结束）
  return tl;
}

/** 「摇晃」强调动画的 hover 预览：对标 animate.style 的 animate__wobble
 * 水平位移（translateX，按图标宽度等比）与小角度旋转交替摆动，幅度递减，以原位结束。
 * 旋转使用相对值，使带设计旋转角的发布态元素最终回到设计态（避免绝对 0° 丢失设计旋转）。 */
function playSideWobblePreview(el: HTMLElement): gsap.core.Timeline {
  const box = el.getBoundingClientRect();
  const w = box.width || 40;
  // 关键帧比例严格对标 animate__wobble：translateX 按元素宽度百分比，旋转角固定
  const x1 = -w * 0.25; // 15% 处
  const x2 = w * 0.2;   // 30% 处
  const x3 = -w * 0.15; // 45% 处
  const x4 = w * 0.1;   // 60% 处
  const x5 = -w * 0.05; // 75% 处
  const tl = gsap.timeline({ defaults: { ease: 'power1.inOut' } });
  tl.to(el, { x: x1, rotation: '-=5', duration: 0.15 }); // 0%→15%：向左位移 + 左倾
  tl.to(el, { x: x2, rotation: '+=8', duration: 0.15 });  // 15%→30%：向右位移 + 右倾
  tl.to(el, { x: x3, rotation: '-=6', duration: 0.15 }); // 30%→45%：向左位移 + 左倾（幅度变小）
  tl.to(el, { x: x4, rotation: '+=5', duration: 0.15 });  // 45%→60%：向右小位移 + 右倾
  tl.to(el, { x: x5, rotation: '-=3', duration: 0.15 }); // 60%→75%：向左小位移 + 左倾
  tl.to(el, { x: 0, rotation: '+=1', duration: 0.25 });   // 75%→100%：回到原位（以可见结束）
  return tl;
}

/** 「放大抖动」强调动画的 hover 预览：对标 animate.style 的 animate__tada
 * 先缩小并左倾，再放大为 1.1 并以 ±3° 左右摆动若干次，最后回正到原尺寸/原位。
 * 旋转使用相对值，使带设计旋转角的发布态元素最终回到设计态（避免绝对 0° 丢失设计旋转）。 */
function playTadaPreview(el: HTMLElement): gsap.core.Timeline {
  const tl = gsap.timeline({ defaults: { ease: 'power1.inOut', transformOrigin: '50% 50%' } });
  tl.to(el, { scale: 0.9, rotation: '-=3', duration: 0.2 }); // 0%→20%：缩小并左倾
  tl.to(el, { scale: 1.1, rotation: '+=6', duration: 0.2 });  // 20%→40%：放大并右倾
  tl.to(el, { scale: 1.1, rotation: '-=6', duration: 0.2 }); // 40%→60%：保持放大，左倾
  tl.to(el, { scale: 1.1, rotation: '+=6', duration: 0.2 });  // 60%→80%：保持放大，右倾
  tl.to(el, { scale: 1.1, rotation: '-=6', duration: 0.1 }); // 80%→90%：保持放大，左倾
  tl.to(el, { scale: 1, rotation: '+=3', duration: 0.1 });    // 90%→100%：回正到原尺寸/原位
  return tl;
}

/** 「倾斜抖动」强调动画的 hover 预览：对标 animate.style 的 animate__jello
 * 以缩放结合 skewX/skewY 交错摆动（拉伸变矮→压扁变高→小幅交错→回正）。 */
function playJelloPreview(el: HTMLElement): gsap.core.Timeline {
  const tl = gsap.timeline({ defaults: { ease: 'power1.inOut', transformOrigin: '50% 50%' } });
  tl.to(el, { scaleX: 1.25, scaleY: 0.75, skewX: 4, skewY: 4, duration: 0.3 });   // 0%→30%：变宽变矮+右倾
  tl.to(el, { scaleX: 0.75, scaleY: 1.25, skewX: -4, skewY: -4, duration: 0.1 }); // 30%→40%：变窄变高+左倾
  tl.to(el, { scaleX: 1.15, scaleY: 0.85, skewX: 4, skewY: 4, duration: 0.1 });   // 40%→50%：略宽略矮+右倾
  tl.to(el, { scaleX: 0.95, scaleY: 1.05, skewX: -2, skewY: -2, duration: 0.15 }); // 50%→65%：略窄略高+左倾
  tl.to(el, { scaleX: 1.05, scaleY: 0.95, skewX: 2, skewY: 2, duration: 0.1 });   // 65%→75%：微宽微矮+右倾
  tl.to(el, { scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, duration: 0.25 });         // 75%→100%：回正到原尺寸/原位
  return tl;
}

/** 「心跳」强调动画的 hover 预览：连续 3 次缩放脉冲（scale 1 → 峰值 1.3 → 1 → 峰值 → 1 → 峰值 → 1），
 * 围绕中心缩放、以原尺寸结束，对标「心跳」的 3 段搏动节奏（比 animate.css 默认的两次搏动多一次）。 */
function playHeartBeatPreview(el: HTMLElement): gsap.core.Timeline {
  const peak = 1.3; // 每次搏动放大到 1.3 倍（对标 animate.css 的 scale(1.3)）
  const tl = gsap.timeline({ defaults: { ease: 'power1.inOut', transformOrigin: '50% 50%' } });
  tl.to(el, { scale: peak, duration: 0.18 }); // 第 1 次搏动：放大到峰值
  tl.to(el, { scale: 1, duration: 0.18 });    // 回落到原尺寸
  tl.to(el, { scale: peak, duration: 0.18 }); // 第 2 次搏动
  tl.to(el, { scale: 1, duration: 0.18 });    // 回落
  tl.to(el, { scale: peak, duration: 0.18 }); // 第 3 次搏动
  tl.to(el, { scale: 1, duration: 0.18 });    // 回落到原尺寸（以原尺寸结束）
  return tl;
}

/**
 * 多段自定义时间线动画的 DOM 播放器路由。
 * 复用以「悬停预览」为基准、并已在编辑器画布应用（konvaPlayer）对齐过的专用时间线，
 * 使发布/预览态与编辑器设计态所见即所得。
 */
function playMultiDomTimeline(el: HTMLElement, type: string): gsap.core.Timeline | null {
  switch (type) {
    case 'bounceLeftRight':
      return playBounceLeftRightPreview(el);
    case 'bounce':
      return playBouncePreview(el);
    case 'shake':
    case 'shakeHard':
    case 'shakeY':
    case 'shakeYHard':
      return playShakePreview(el, type);
    case 'headShake':
      return playHeadShakePreview(el);
    case 'flash':
      return playFlashPreview(el);
    case 'pulse':
      return playPulsePreview(el);
    case 'rubberBand':
      return playRubberBandPreview(el);
    case 'swing':
      return playSwayPivotPreview(el);
    case 'wobble':
      return playSideWobblePreview(el);
    case 'tada':
      return playTadaPreview(el);
    case 'jello':
      return playJelloPreview(el);
    case 'heartBeat':
      return playHeartBeatPreview(el);
    default:
      return null;
  }
}

/** 入场动画（旧版兼容）：基于设计态显式 fromTo，避免 gsap.from 隐式读取当前态导致重入跳帧 */
export function playEnterAnimation(
  el: HTMLElement,
  config: AnimationConfig,
  design: DesignState,
): gsap.core.Tween | null {
  const type = (config.enter ?? 'none') as EnterAnimationType;
  if (type === 'none') return null;

  const duration = config.enterDuration ?? 0.6;
  const delay = config.enterDelay ?? 0;
  const ease = EASING_MAP[config.enterEasing ?? 'ease'] || 'power2.out';

  const fromVars: gsap.TweenVars = { ...design };

  switch (type) {
    case 'fadeIn':
      fromVars.opacity = 0;
      break;
    case 'slideIn':
      fromVars.opacity = 0;
      fromVars.y = design.y + 50;
      break;
    case 'zoomIn':
      fromVars.opacity = 0;
      fromVars.scaleX = 0.5;
      fromVars.scaleY = 0.5;
      break;
    case 'bounceIn':
      fromVars.opacity = 0;
      fromVars.scaleX = 0.3;
      fromVars.scaleY = 0.3;
      return gsap.fromTo(el, { ...fromVars }, { ...design, duration, delay, ease: 'bounce.out' });
    case 'rotateIn':
      fromVars.opacity = 0;
      fromVars.rotation = design.rotation - 180;
      break;
    case 'flipIn':
      fromVars.opacity = 0;
      fromVars.rotationY = 90;
      break;
    default:
      return null;
  }

  return gsap.fromTo(el, { ...fromVars }, { ...design, duration, delay, ease });
}

/** 循环动画（旧版兼容）：基于设计态显式 fromTo，避免 gsap.to 隐式读取当前态导致重入跳帧 */
export function playLoopAnimation(
  el: HTMLElement,
  config: AnimationConfig,
  design: DesignState,
): gsap.core.Tween | null {
  const type = (config.loop ?? 'none') as LoopAnimationType;
  if (type === 'none') return null;

  const duration = config.loopDuration ?? 2;
  const ease = EASING_MAP[config.loopEasing ?? 'ease'] || 'none';

  switch (type) {
    case 'pulse':
      return gsap.fromTo(el, { ...design }, {
        ...design,
        scaleX: design.scaleX * 1.08,
        scaleY: design.scaleY * 1.08,
        duration,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });
    case 'shake':
      return gsap.fromTo(el, { ...design }, {
        ...design,
        x: design.x + 8,
        duration: duration / 4,
        ease: 'none',
        yoyo: true,
        repeat: -1,
      });
    case 'float':
      return gsap.fromTo(el, { ...design }, {
        ...design,
        y: design.y - 12,
        duration,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });
    case 'spin':
      return gsap.fromTo(el, { ...design }, {
        ...design,
        rotation: design.rotation + 360,
        duration,
        ease,
        repeat: -1,
      });
    default:
      return null;
  }
}

/** 把可能是单个对象的 animation 字段统一归一化为数组 */
function normalizeAnimations(config: AnimationConfig): SingleAnimationConfig[] {
  if (!config.animation) return [];
  return Array.isArray(config.animation) ? config.animation : [config.animation];
}

/** 串行播放一组新版动画 */
function playAnimationSequence(
  el: HTMLElement,
  configs: SingleAnimationConfig[],
  design: DesignState,
): (() => void) | null {
  if (!configs.length) return null;

  let activeTween: gsap.core.Tween | gsap.core.Timeline | null = null;
  let stopped = false;

  const run = async () => {
    for (const cfg of configs) {
      if (stopped) break;
      await new Promise<void>((resolve) => {
        activeTween = playSingleAnimation(el, cfg, design);
        if (!activeTween) {
          resolve();
          return;
        }
        activeTween.eventCallback('onComplete', () => {
          // 当前动画播完：强制恢复到设计态（gsap.set，缓存同步），再播放下一个。
          // 由于下一帧 gsap.fromTo 的 start 即 design，元素会被重新置于设计态，杜绝残留半途值。
          restoreDesignState(el, design);
          resolve();
        });
      });
    }
  };

  run();

  return () => {
    stopped = true;
    activeTween?.kill();
    restoreDesignState(el, design);
  };
}

/** 播放元素的所有动画（新版优先，旧版兼容） */
export function playElementAnimation(
  el: HTMLElement,
  config: AnimationConfig | undefined,
): (() => void) | null {
  if (!config) return null;

  // 动画开始前（React 已渲染出设计态）一次性捕获完整设计态，作为整条链路的真相源。
  const design = captureDesignState(el);

  // 新版动画配置优先
  const anims = normalizeAnimations(config);
  if (anims.length) {
    return playAnimationSequence(el, anims, design);
  }

  // 旧版兼容（入场 + 循环）
  const enterTween = playEnterAnimation(el, config, design);
  const loopDelay = ((config.enterDuration ?? 0) + (config.enterDelay ?? 0)) * 1000;
  const loopTween = playLoopAnimation(el, config, design);
  if (loopTween) {
    loopTween.delay(loopDelay / 1000);
  }

  return () => {
    enterTween?.kill();
    loopTween?.kill();
    restoreDesignState(el, design);
  };
}
