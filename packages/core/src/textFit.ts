/**
 * 文本溢出「shrink」适配算法（T8，规范 §7 / D3）。
 *
 * 纯函数、零 DOM：文本宽高测量通过注入的 `measure(size)` 回调完成，
 * DOM（canvas.measureText）/ Konva（Text.measureSize）/ 服务端布局器各自提供实现，
 * 保证「预览所见 == 导出所得」用同一套算法。
 *
 * 适用场景：变量值（如超长姓名）超过元素框时，自动缩小字号至放得下，下限 `minRatio`。
 * 与 `clip`（裁剪）/ `wrap`（折行，由 layout 处理）互斥——shrink 优先于 wrap 收一行。
 */

export interface FitShrinkInput {
  /** 实际文本（已替换变量值） */
  text: string;
  /** 设计基准字号 */
  baseSize: number;
  /** 下限比例（如 0.6 → 最小字号 = baseSize * 0.6） */
  minRatio: number;
  /** 容器宽（px） */
  maxWidth: number;
  /** 容器高（px） */
  maxHeight: number;
  /**
   * 测量回调：给定字号，返回该字号下文本的占用尺寸。
   * 调用方负责用正确的字体栈 / 字重 / 字间距 / 折行模式测量。
   */
  measure: (size: number) => { width: number; height: number };
}

/**
 * 二分求「能放进容器的最大字号」。
 * - 基准字号已放得下 → 直接返回基准（不无谓缩小）。
 * - 连最小字号都放不下 → 返回最小（尽力渲染，由渲染层决定是否 clip）。
 * - 否则在 [min, base] 区间二分 18 轮，取最大可放下值。
 */
export function fitShrinkFontSize(input: FitShrinkInput): number {
  const baseSize = Math.max(1, input.baseSize);
  const minRatio = Math.min(1, Math.max(0.1, input.minRatio));
  const minSize = Math.max(1, Math.round(baseSize * minRatio));
  const maxWidth = Math.max(1, input.maxWidth);
  const maxHeight = Math.max(1, input.maxHeight);

  if (!input.text) return baseSize;

  const fits = (size: number) => {
    const m = input.measure(size);
    return m.width <= maxWidth && m.height <= maxHeight;
  };

  // 基准已放得下：不缩小（保持设计观感）
  if (fits(baseSize)) return baseSize;
  // 连最小都放不下：尽力渲染最小字号
  if (!fits(minSize)) return minSize;

  let lo = minSize;
  let hi = baseSize;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return Math.max(minSize, Math.round(lo));
}
