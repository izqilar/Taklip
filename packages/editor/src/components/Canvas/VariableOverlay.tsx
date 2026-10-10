/**
 * 批量请柬 · 变量可视化覆盖层（方案 §1.3 画布层）
 *
 * 为当前页所有「已绑定变量」的元素叠加**虚线描边 + {{key}} 徽章**，
 * 让用户在编辑模板时一眼看出哪些位置会在批量生成时被名单值替换。
 *
 * ★ 设计要点
 * 1. **独立覆盖层，不侵入 KonvaElement**：避免为辅助显示改动每个元素类型的渲染逻辑，
 *    也避免污染导出/预览（渲染层对 `binding` 零感知）。
 * 2. **仅在 `variableMode` 开启时挂载**：常态编辑与导出不绘制。
 * 3. `listening={false}`：不抢元素的点击/拖拽。
 * 4. 定位与 ElementNode 完全同构（Group 位于几何中心 + offsetX/offsetY = w/2,h/2），
 *    因此旋转/镜像/缩放下的位置与元素严格重合。
 */

import { Group, Rect, Text } from 'react-konva';
import type { Element } from '@h5design/core';

/** 品牌红（庆柬云主色），与运营端请柬事务中心一致 */
export const VARIABLE_BRAND = '#c81e42';

/** 徽章高度（设计稿 px） */
const BADGE_H = 15;
/** 徽章与元素上边缘的间距 */
const BADGE_GAP = 3;
/** 徽章字号 */
const BADGE_FONT = 10;
/** 单字符估算宽度（用于反推徽章宽度，避免引入文本测量开销） */
const CHAR_W = BADGE_FONT * 0.62;

export default function VariableOverlay({
  elements,
}: {
  /** 当前页元素（调用方已按 zIndex 排序与否均可，覆盖层不受影响） */
  elements: Element[];
}) {
  return (
    <>
      {elements
        .filter((el) => !!el.binding?.key && el.visible !== false)
        .map((el) => {
          const key = el.binding!.key!;
          const w = el.width;
          const h = el.height;
          const label = `{{${key}}}`;
          const badgeW = Math.max(34, label.length * CHAR_W + 10);
          // 徽章贴元素右上角外侧；元素很窄时左移到元素左边缘，避免溢出画布左侧
          const badgeX = Math.max(0, w - badgeW);

          return (
            <Group
              key={`var-${el.id}`}
              x={el.x + w / 2}
              y={el.y + h / 2}
              rotation={el.rotation}
              offsetX={w / 2}
              offsetY={h / 2}
              listening={false}
              perfectDrawEnabled={false}
            >
              {/* 虚线描边 */}
              <Rect
                x={0}
                y={0}
                width={w}
                height={h}
                stroke={VARIABLE_BRAND}
                strokeWidth={1}
                dash={[4, 3]}
                fill="transparent"
                listening={false}
                perfectDrawEnabled={false}
                shadowForStrokeEnabled={false}
              />
              {/* 徽章底 */}
              <Rect
                x={badgeX}
                y={-BADGE_H - BADGE_GAP}
                width={badgeW}
                height={BADGE_H}
                cornerRadius={3}
                fill={VARIABLE_BRAND}
                listening={false}
                perfectDrawEnabled={false}
                shadowForStrokeEnabled={false}
              />
              {/* 徽章文字 */}
              <Text
                x={badgeX}
                y={-BADGE_H - BADGE_GAP}
                width={badgeW}
                height={BADGE_H}
                text={label}
                fontSize={BADGE_FONT}
                fontFamily="sans-serif"
                fill="#ffffff"
                align="center"
                verticalAlign="middle"
                listening={false}
                perfectDrawEnabled={false}
              />
            </Group>
          );
        })}
    </>
  );
}
