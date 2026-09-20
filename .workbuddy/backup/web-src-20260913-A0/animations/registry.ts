/**
 * 动画注册表
 * 定义编辑器「动画面板」中所有可选的入场/强调/出场动画。
 * 每个动画只描述 GSAP vars（相对当前状态的偏移/目标状态），
 * 实际播放由 presets.ts 根据 category 决定使用 gsap.from / gsap.to。
 */
import type { AnimationCategory } from '@h5design/core';
import type gsap from 'gsap';

export interface AnimationDef {
  key: string;
  category: AnimationCategory;
  /** i18n 键，用于显示中文/英文名称 */
  labelKey: string;
  /** GSAP tween vars（入场=起始状态，出场=结束状态，强调=目标状态） */
  vars: gsap.TweenVars;
  /**
   * 仅对强调动画生效：
   * - true（默认）：yoyo 往返，例如 bounce、flash
   * - false：单向循环，例如 rotate 转一圈
   */
  yoyo?: boolean;
  /**
   * 多段自定义时间线动画（如「左右反弹」）：
   * 播放器不走标准 from/to 单程，而是用专用时间线（中 → 左 → 右 → 中）。
   */
  multi?: boolean;
}

const enter = (key: string, labelKey: string, vars: gsap.TweenVars, multi = false): AnimationDef => ({
  key,
  category: 'enter',
  labelKey,
  vars,
  multi,
});

const emphasis = (key: string, labelKey: string, vars: gsap.TweenVars, yoyo = true, multi = false): AnimationDef => ({
  key,
  category: 'emphasis',
  labelKey,
  vars,
  yoyo,
  multi,
});

const exit = (key: string, labelKey: string, vars: gsap.TweenVars): AnimationDef => ({
  key,
  category: 'exit',
  labelKey,
  vars,
});

export const ANIMATION_REGISTRY: AnimationDef[] = [
  // ───────── 入场动画（Enter）─────────
  enter('fadeIn', 'editor:animation.enter.fadeIn', { opacity: 0 }),
  enter('fadeInDown', 'editor:animation.enter.fadeInDown', { opacity: 0, y: -60 }),
  enter('fadeInRight', 'editor:animation.enter.fadeInRight', { opacity: 0, x: -60 }),
  enter('fadeInLeft', 'editor:animation.enter.fadeInLeft', { opacity: 0, x: 60 }),
  enter('fadeInUp', 'editor:animation.enter.fadeInUp', { opacity: 0, y: 60 }),

  enter('slideInDown', 'editor:animation.enter.slideInDown', { y: -80 }),
  enter('slideInRight', 'editor:animation.enter.slideInRight', { x: -80 }),
  enter('slideInLeft', 'editor:animation.enter.slideInLeft', { x: 80 }),
  enter('slideInUp', 'editor:animation.enter.slideInUp', { y: 80 }),

  enter('bounceIn', 'editor:animation.enter.bounceIn', { opacity: 0, scale: 0.3, ease: 'bounce.out' }),
  enter('bounceInDown', 'editor:animation.enter.bounceInDown', { opacity: 0, y: -120, scale: 0.3, ease: 'bounce.out' }),
  enter('bounceInRight', 'editor:animation.enter.bounceInRight', { x: -120, scale: 0.3, ease: 'bounce.out' }),
  enter('bounceInLeft', 'editor:animation.enter.bounceInLeft', { x: 120, scale: 0.3, ease: 'bounce.out' }),
  enter('bounceInUp', 'editor:animation.enter.bounceInUp', { opacity: 0, y: 120, scale: 0.3, ease: 'bounce.out' }),

  enter('flipInX', 'editor:animation.enter.flipInX', { opacity: 0, rotateX: 90 }),
  enter('flipInY', 'editor:animation.enter.flipInY', { opacity: 0, rotateY: 90 }),

  enter('lightSpeedInLeft', 'editor:animation.enter.lightSpeedInLeft', { opacity: 0, x: 120, skewX: -30 }),
  enter('lightSpeedInRight', 'editor:animation.enter.lightSpeedInRight', { opacity: 0, x: -120, skewX: 30 }),
  enter('lightSpeedInUp', 'editor:animation.enter.lightSpeedInUp', { opacity: 0, y: 120, skewY: -30 }),
  enter('lightSpeedInDown', 'editor:animation.enter.lightSpeedInDown', { opacity: 0, y: -120, skewY: 30 }),

  enter('rotateIn', 'editor:animation.enter.rotateIn', { opacity: 0, rotation: -200, scale: 0.5 }),
  enter('rotateInDownLeft', 'editor:animation.enter.rotateInDownLeft', { opacity: 0, rotation: -45, x: -60, y: 60 }),
  enter('rotateInDownRight', 'editor:animation.enter.rotateInDownRight', { opacity: 0, rotation: 45, x: 60, y: 60 }),
  enter('rotateInUpLeft', 'editor:animation.enter.rotateInUpLeft', { opacity: 0, rotation: 45, x: -60, y: -60 }),
  enter('rotateInUpRight', 'editor:animation.enter.rotateInUpRight', { opacity: 0, rotation: -45, x: 60, y: -60 }),
  enter('rotateInJiggle', 'editor:animation.enter.rotateInJiggle', { opacity: 0, rotation: -15 }),

  enter('rollInLeft', 'editor:animation.enter.rollInLeft', { opacity: 0, x: -100, rotation: -120 }),
  enter('rollInRight', 'editor:animation.enter.rollInRight', { opacity: 0, x: 100, rotation: 120 }),
  enter('rollInUp', 'editor:animation.enter.rollInUp', { opacity: 0, y: -100, rotation: -120 }),
  enter('rollInDown', 'editor:animation.enter.rollInDown', { opacity: 0, y: 100, rotation: 120 }),

  enter('scaleInCenter', 'editor:animation.enter.scaleInCenter', { opacity: 0, scale: 0 }),
  enter('scaleInDown', 'editor:animation.enter.scaleInDown', { opacity: 0, y: -80, scale: 0.5 }),
  enter('scaleInLeft', 'editor:animation.enter.scaleInLeft', { opacity: 0, x: 80, scale: 0.5 }),
  enter('scaleInRight', 'editor:animation.enter.scaleInRight', { opacity: 0, x: -80, scale: 0.5 }),
  enter('scaleInUp', 'editor:animation.enter.scaleInUp', { opacity: 0, y: 80, scale: 0.5 }),

  enter('slideDown', 'editor:animation.enter.slideDown', { y: -80 }),

  enter('shrinkIn', 'editor:animation.enter.shrinkIn', { opacity: 0, scale: 1.5 }),
  enter('shrinkInLeft', 'editor:animation.enter.shrinkInLeft', { opacity: 0, x: -80, scale: 1.5 }),
  enter('shrinkInRight', 'editor:animation.enter.shrinkInRight', { opacity: 0, x: 80, scale: 1.5 }),
  enter('shrinkInUp', 'editor:animation.enter.shrinkInUp', { opacity: 0, y: -80, scale: 1.5 }),
  enter('shrinkInDown', 'editor:animation.enter.shrinkInDown', { opacity: 0, y: 80, scale: 1.5 }),
  enter('bounceLeftRight', 'editor:animation.enter.bounceLeftRight', {}, true),

  // ───────── 强调动画（Emphasis）─────────
  emphasis('bounce', 'editor:animation.emphasis.bounce', { y: -25 }, true, true),
  emphasis('flash', 'editor:animation.emphasis.flash', { opacity: 0 }, true, true),
  emphasis('pulse', 'editor:animation.emphasis.pulse', { scale: 1.1 }, true, true),
  emphasis('rubberBand', 'editor:animation.emphasis.rubberBand', { scaleX: 1.15, scaleY: 0.85 }, true, true),
  emphasis('headShake', 'editor:animation.emphasis.headShake', { x: 6, rotation: 5 }, true, true),
  emphasis('shake', 'editor:animation.emphasis.shake', { x: 10 }, true, true),
  emphasis('shakeY', 'editor:animation.emphasis.shakeY', { y: 10 }, true, true),
  emphasis('shakeHard', 'editor:animation.emphasis.shakeHard', { x: 15 }, true, true),
  emphasis('shakeYHard', 'editor:animation.emphasis.shakeYHard', { y: 15 }, true, true),
  emphasis('wobble', 'editor:animation.emphasis.wobble', { x: 15, rotation: 5 }, true, true),
  emphasis('swing', 'editor:animation.emphasis.swing', { rotation: 15 }, true, true),
  emphasis('tada', 'editor:animation.emphasis.tada', { scale: 0.9, rotation: -5 }, true, true),
  emphasis('jello', 'editor:animation.emphasis.jello', { skewX: 10, skewY: 10 }, true, true),
  emphasis('heartBeat', 'editor:animation.emphasis.heartBeat', { scale: 1.3 }, true, true),
  emphasis('rotate', 'editor:animation.emphasis.rotate', { rotation: 360 }, false),

  // ───────── 出场动画（Exit）─────────
  exit('fadeOut', 'editor:animation.exit.fadeOut', { opacity: 0 }),
  exit('fadeOutDown', 'editor:animation.exit.fadeOutDown', { opacity: 0, y: 60 }),
  exit('fadeOutLeft', 'editor:animation.exit.fadeOutLeft', { opacity: 0, x: -60 }),
  exit('fadeOutRight', 'editor:animation.exit.fadeOutRight', { opacity: 0, x: 60 }),
  exit('fadeOutUp', 'editor:animation.exit.fadeOutUp', { opacity: 0, y: -60 }),

  exit('slideOutDown', 'editor:animation.exit.slideOutDown', { y: 750 }),
  exit('slideOutLeft', 'editor:animation.exit.slideOutLeft', { x: -450 }),
  exit('slideOutRight', 'editor:animation.exit.slideOutRight', { x: 450 }),
  exit('slideOutUp', 'editor:animation.exit.slideOutUp', { y: -750 }),

  exit('bounceOut', 'editor:animation.exit.bounceOut', { opacity: 0, scale: 0.3, ease: 'bounce.out' }),
  exit('bounceOutDown', 'editor:animation.exit.bounceOutDown', { opacity: 0, y: 120, scale: 0.3, ease: 'bounce.out' }),
  exit('bounceOutLeft', 'editor:animation.exit.bounceOutLeft', { opacity: 0, x: -120, scale: 0.3, ease: 'bounce.out' }),
  exit('bounceOutRight', 'editor:animation.exit.bounceOutRight', { opacity: 0, x: 120, scale: 0.3, ease: 'bounce.out' }),
  exit('bounceOutUp', 'editor:animation.exit.bounceOutUp', { opacity: 0, y: -120, scale: 0.3, ease: 'bounce.out' }),

  exit('flipOutX', 'editor:animation.exit.flipOutX', { opacity: 0, rotateX: 90 }),
  exit('flipOutY', 'editor:animation.exit.flipOutY', { opacity: 0, rotateY: 90 }),

  exit('lightSpeedOutLeft', 'editor:animation.exit.lightSpeedOutLeft', { opacity: 0, x: -120, skewX: 30 }),
  exit('lightSpeedOutRight', 'editor:animation.exit.lightSpeedOutRight', { opacity: 0, x: 120, skewX: -30 }),
  exit('lightSpeedOutUp', 'editor:animation.exit.lightSpeedOutUp', { opacity: 0, y: -120, skewY: 30 }),
  exit('lightSpeedOutDown', 'editor:animation.exit.lightSpeedOutDown', { opacity: 0, y: 120, skewY: -30 }),

  exit('rotateOut', 'editor:animation.exit.rotateOut', { opacity: 0, rotation: 200, scale: 0.5 }),
  exit('rotateOutDownLeft', 'editor:animation.exit.rotateOutDownLeft', { opacity: 0, rotation: 45, x: -60, y: 60 }),
  exit('rotateOutDownRight', 'editor:animation.exit.rotateOutDownRight', { opacity: 0, rotation: -45, x: 60, y: 60 }),
  exit('rotateOutUpLeft', 'editor:animation.exit.rotateOutUpLeft', { opacity: 0, rotation: -45, x: -60, y: -60 }),
  exit('rotateOutUpRight', 'editor:animation.exit.rotateOutUpRight', { opacity: 0, rotation: 45, x: 60, y: -60 }),

  exit('rollOutLeft', 'editor:animation.exit.rollOutLeft', { opacity: 0, x: -100, rotation: -120 }),
  exit('rollOutRight', 'editor:animation.exit.rollOutRight', { opacity: 0, x: 100, rotation: 120 }),
  exit('rollOutUp', 'editor:animation.exit.rollOutUp', { opacity: 0, y: -100, rotation: -120 }),
  exit('rollOutDown', 'editor:animation.exit.rollOutDown', { opacity: 0, y: 100, rotation: 120 }),

  exit('zoomOut', 'editor:animation.exit.zoomOut', { opacity: 0, scale: 0 }),
  exit('zoomOutDown', 'editor:animation.exit.zoomOutDown', { opacity: 0, y: 80, scale: 0.5 }),
  exit('zoomOutLeft', 'editor:animation.exit.zoomOutLeft', { opacity: 0, x: -80, scale: 0.5 }),
  exit('zoomOutRight', 'editor:animation.exit.zoomOutRight', { opacity: 0, x: 80, scale: 0.5 }),
  exit('zoomOutUp', 'editor:animation.exit.zoomOutUp', { opacity: 0, y: -80, scale: 0.5 }),

  exit('zoomOutBig', 'editor:animation.exit.zoomOutBig', { opacity: 0, scale: 1.8 }),
  exit('zoomOutBigLeft', 'editor:animation.exit.zoomOutBigLeft', { opacity: 0, x: -80, scale: 1.8 }),
  exit('zoomOutBigRight', 'editor:animation.exit.zoomOutBigRight', { opacity: 0, x: 80, scale: 1.8 }),
  exit('zoomOutBigUp', 'editor:animation.exit.zoomOutBigUp', { opacity: 0, y: -80, scale: 1.8 }),
  exit('zoomOutBigDown', 'editor:animation.exit.zoomOutBigDown', { opacity: 0, y: 80, scale: 1.8 }),
];

export function getAnimationsByCategory(category: AnimationCategory) {
  return ANIMATION_REGISTRY.filter((a) => a.category === category);
}

export function findAnimationDef(category: AnimationCategory, key: string) {
  return ANIMATION_REGISTRY.find((a) => a.category === category && a.key === key);
}
