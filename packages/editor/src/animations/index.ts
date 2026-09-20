/**
 * `@h5design/editor/animations` —— **纯 DOM/GSAP 动画播放器**子入口。
 *
 * 背景：动画实现原本只能通过编辑器主入口（`@h5design/editor`）拿到，而主入口会把
 * Konva、react-konva、html-to-image 等整套**画布内核**（约 3MB 未压缩）一起拖进来。
 * 发布页（/p/:publishCode）只需要在 DOM 上播放入场/循环动画，根本用不到画布，
 * 却因此被迫加载整个内核 —— 这是「抽包后页面变慢」的一大来源。
 *
 * 因此这里单独开一个子入口，**只**再导出不依赖 Konva 的那些模块：
 *   - presets.ts   ：playElementAnimation / playSingleAnimation / playPreviewAnimation（依赖 gsap）
 *   - registry.ts  ：动画元数据表（纯数据 + 类型）
 * 注意：**不要**在此处再导出 konvaPlayer.ts / konvaTimeline.ts，它们 `import Konva from 'konva'`，
 * 一旦挂上来，这个子入口就失去「轻量」的意义了（回归即等于发布页重新加载整套内核）。
 *
 * 契约：导出的 `playElementAnimation` 签名与 `@h5design/render` 的 `AnimationPlayer` 一致，
 * 可直接作为 `<PublishedH5 animationPlayer={...} />` 传入。
 */

export {
  playElementAnimation,
  playSingleAnimation,
  playPreviewAnimation,
  playEnterAnimation,
  playLoopAnimation,
  type DesignState,
} from './presets';

export {
  ANIMATION_REGISTRY,
  findAnimationDef,
  getAnimationsByCategory,
  type AnimationDef,
} from './registry';
