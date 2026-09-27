/**
 * 元素镜像（翻转）工具 —— 编辑器（Konva 画布 / 离屏导出）与发布态（DOM/CSS）共用的单一真值。
 *
 * 语义（与「对齐方式 → 水平镜像 / 垂直镜像」按钮一一对应）：
 *  - `flipX = true` → 水平镜像（左右翻转）：沿元素**自身的垂直中轴**镜像；
 *  - `flipY = true` → 垂直镜像（上下翻转）：沿元素**自身的水平中轴**镜像。
 *
 * 两个关键约束，三端必须一致：
 *  1. **翻转围绕元素几何中心**（与 `rotation` 同中心）。因此翻转不改变元素的
 *     x / y / width / height 包围盒，只改变内容朝向 —— 选中框、对齐、分布都不需要改。
 *  2. **翻转发生在元素自身坐标系内**（先缩放后旋转），与 Konva 节点
 *     `transform = T(中心) · R(rotation) · S(scaleX, scaleY) · T(-中心)` 的顺序一致；
 *     DOM 端因此必须写成 `rotate(θ) scale(sx, sy)`（CSS 从右往左作用于坐标系统）。
 *
 * 与动画的关系：动画系统（konvaPlayer / presets）把「设计态」整体快照后做相对偏移，
 * 本函数只负责把设计态的翻转量表达出来，不参与动画插值。
 */
import type { BaseElement } from './schema';

/** 仅关心翻转标志的元素形状（宽泛取参，便于渲染层直接传入 el） */
export type Flipable = Pick<BaseElement, 'flipX' | 'flipY'>;

/**
 * Konva 缩放因子：`flipX/flipY` 为 true 时返回 -1，否则 1。
 *
 * 直接展开到 Konva 节点属性上（`{...flipScale(el)}`）。因为节点已用
 * `offsetX = width / 2, offsetY = height / 2` 把原点挪到几何中心，
 * 负缩放即等价于「围绕中心翻转」，不改变包围盒。
 */
export function flipScale(el: Flipable | null | undefined): { scaleX: number; scaleY: number } {
  return {
    scaleX: el?.flipX ? -1 : 1,
    scaleY: el?.flipY ? -1 : 1,
  };
}

/** 是否处于镜像状态（任一方向翻转） */
export function isFlipped(el: Flipable | null | undefined): boolean {
  return !!el?.flipX || !!el?.flipY;
}

/**
 * CSS `transform` 中的镜像片段（发布态 DOM 用），无翻转时返回空串。
 *
 * 用法：`transform: \`rotate(${el.rotation}deg)${flipCssTransform(el)}\`` —— 必须紧跟在
 * rotate() 之后（CSS 列表自右向左作用于坐标系统，等价于「先缩放后旋转」）。
 */
export function flipCssTransform(el: Flipable | null | undefined): string {
  const { scaleX, scaleY } = flipScale(el);
  if (scaleX === 1 && scaleY === 1) return '';
  return ` scale(${scaleX}, ${scaleY})`;
}
