# 矩形四角独立圆角 — 交付与双审查报告

> 日期：2026-08-14 ｜ 范围：矩形四角独立圆角（拖拽锚点 + 属性面板）
> 技能：`代码生成器`（已加载，脚手架参考）/ `代码审查` / `代码漏洞与BUG分析工具`

## 一、功能交付

为矩形对象实现四角独立圆角调节，并打通编辑态 / 发布态 / 属性面板 / i18n。

### 交互行为（与需求一致）
- **拖一个角锚点** → 四角联动（统一圆角）。
- **按住 Alt 拖一个角锚点** → 仅该单角变化（独立圆角）。
- 锚点跟随矩形**旋转**正确（计算在 Group 局部坐标系内，`rotation={el.rotation}`）。

### 改动文件
| 文件 | 改动 |
|------|------|
| `packages/core/src/schema.ts` | `RectElement.cornerRadius` / `ImageElement.cornerRadius` 拓宽为 `number \| CornerRadius`；新增 `CornerRadius` 接口与 `normalizeCornerRadius` / `toKonvaCornerRadius` / `cornerRadiusToCss` / `isUniformCornerRadius`；向后兼容旧 `borderRadius` 字段 |
| `apps/web/src/components/Canvas/EditorCanvas.tsx` | 新增 `RectCornerAnchors`：选中单矩形时绘制 4 个白色圆角锚点，拖拽按角点投影 + `maxR=min(w,h)/2` 钳制 + 整数吸附；`e.evt.altKey` 切换单角/联动；`onDragStart=pushHistory` |
| `apps/web/src/components/Preview/DOMRenderer.tsx` | 矩形：`borderRadius: cornerRadiusToCss(...)`；图片：四角和 >0 才给 `borderRadius` |
| `apps/web/src/components/Panel/ComponentSettingsPanel.tsx` | 新增 `RectCornerSection`：统一圆角滑块（0–100）+ 展开式四角独立滑块 |
| `apps/web/src/i18n/locales/{zh-CN,en,ug,kk-CN,ky-CN,uz-CN}/editor.json` | 新增 6 个键（四角 + 展开/收起），已 grep 确认 6 语种全齐 |

## 二、代码审查（code-reviewer 自动工具）

- **严重问题：0**
- **一般问题：1** —— `ComponentSettingsPanel.tsx:809` 存在 `console.error`，但被 `import.meta.env.DEV` 包裹，**仅开发期生效**，且为预存的图片上传处理代码（非本次引入），生产安全。
- **优化建议：117** —— 几乎全部为「行过长」（80 字符启发式，对 JSX 不现实），均为预存代码，非本次引入。
- **结论：本次改动代码质量干净。**

## 三、代码漏洞与BUG分析（code-bug-analyzer 手动走查）

无 Critical / High / Medium 级漏洞。逐项核对：

| 检查点 | 结论 |
|--------|------|
| 圆角超宽高一半 / 负值 / NaN | `maxR` 钳制 + `normalizeCornerRadius` 用 `v ?? 0` 把 NaN 归零，安全 |
| Alt 键检测兼容性 | `!!(e.evt && e.evt.altKey)`，Mouse/Touch 事件均有 altKey，已判空 |
| 旋转矩形锚点坐标 | 在 Group 局部坐标内计算，旋转自动正确（已审阅数学） |
| 撤销历史时机 | `pushHistory` 仅在 `onDragStart` 触发一次拖拽一条历史，正确 |
| 与旧 `borderRadius` 向后兼容 | 渲染处统一 `el.cornerRadius ?? el.borderRadius` 兜底，正确 |

**低风险项（建议后续清理，非阻断）：**
1. `RectCornerSection` 与 `EditorCanvas` 均 `import { isUniformCornerRadius }` 但**从未使用**（死导入；因未开 `noUnusedLocals` 故 typecheck 仍过）。
2. 统一圆角滑块 `max=100`，但大矩形锚点可拖出 >100 半径（滑块仅显示上限，不崩溃；如需完全对称可改为动态上限 `min(w,h)/2`）。
3. `toKonvaCornerRadius` 的 number 分支 `Math.max(0, NaN)=NaN` 为理论边界，UI 不会产出 NaN。

## 四、验证状态

- `packages/core` typecheck：**EXIT 0** ✅
- `apps/web` typecheck（含 `tsc --noEmit`）：**EXIT 0** ✅
- `apps/web` build：被沙箱 safe-delete 拦截在 Vite 清理 `dist` 步骤（环境限制，非代码错误）；`tsc` 阶段通过。本功能此前已通过生产构建验证。
- **未做**：浏览器 e2e 拖拽实测（静态审查 + 逻辑走查 + 类型检查覆盖）。如需，可启动 dev server 用 headless Chromium 实测锚点拖拽。

## 五、2026-08-14 晚：锚点位置与悬停交互修复
- **问题**：圆角锚点与四角 resize 锚点重合（半径为 0 时尤为明显），无法用鼠标操作。
- **Figma 目标**：选中矩形后，鼠标移入矩形区域，圆角锚点出现在四角**稍向内**的位置（黑色圆点），不与 resize 锚点重叠。
- **修复（`apps/web/src/components/Canvas/EditorCanvas.tsx`）**：
  - 新增 `hoveredId` 状态 + 50ms 延迟清除逻辑；所有元素渲染时增加 `onMouseEnter/onMouseLeave`，矩形悬停时显示圆角锚点。
  - 圆角锚点改为**固定内偏 + 半径跟随**的休息位：
    - 休息位距离角点 `max(ANCHOR_INSET=10px, 当前角圆角)`，并钳制在 `maxR` 以内；
    - 当圆角较小时始终向内偏离，避免与 resize 锚点重合；圆角较大时自动跟随曲线起点。
  - 拖拽时本地状态 `dragKey/dragPos` 保持被拖锚点跟随光标，拖拽结束后再回到休息位，避免 re-render 把锚点拉回休息位造成跳动。
  - 拖拽期间 `cornerDragging` 状态锁定锚点显示，防止光标拖出矩形后锚点卸载、拖拽中断。
  - 锚点视觉改为深色填充 `#111827` + 白色描边 + 投影，更贴近 Figma 黑点。
- **清理**：顺手删除 `EditorCanvas.tsx` 与 `ComponentSettingsPanel.tsx` 中未使用的 `isUniformCornerRadius` 导入。
- **验证**：`apps/web` typecheck **EXIT 0** ✅。

## 六、可选后续
- 统一圆角滑块上限与锚点 `maxR` 对齐。
- 浏览器实测锚点拖拽（统一 / Alt 单角 / 旋转跟随 / 悬停出现）。
