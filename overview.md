# 预览窗口动画连贯性修复（显式 fromTo 起止态模型）

## 根因（重新审查定位）
预览窗口 `playSingleAnimation` 非多段分支使用 `gsap.from` / `gsap.to`，**隐式以元素「当前态」作为另一端锚点**。在 React StrictMode 重入、序列 `onComplete` 写 `el.style` 复位、半途打断时，会误读残留半途态为当前/结束态，只播一小段就停在某半途值，随后复位到设计态 —— 正是「前半段流畅、后半段跳到末帧」。

时长公式两边本来就一致（`config.duration ?? def.vars.duration ?? 0.6`），「更短」是跳帧观感，非时长算错。

## 修复（`apps/web/src/animations/presets.ts`）
- 新增 `captureDesignState(el)`：播放前一次性捕获完整设计态快照（x/y/scaleX/scaleY/rotation/opacity/skewX/skewY），作为链路真相源（替代播放时 `getProperty` 读当前态）。
- 新增 `computeDomStates(category, vars, current)`：逐字段镜像编辑器 `konvaPlayer.computeStates`，算出完整 `start/end` 起止态。
- `playSingleAnimation` 改为 `gsap.fromTo(el, start, { ...end, duration, ease, transformOrigin, repeat, yoyo })` —— 两端显式给定，彻底消除对当前态的隐式依赖。
- 废弃 `buildDomTweenVars`；新增 `restoreDesignState`（用 `gsap.set` 而非直接写 `el.style`，避免 GSAP 缓存失同步）。
- legacy `playEnterAnimation` / `playLoopAnimation` 也改为 `fromTo(design, design+delta)`。
- 编辑器 `konvaPlayer.playAnimationOnNode` 增加 `delay = config.delay ?? 0`，使编辑器画布「预览动画」与预览窗口按同一 delay 起播（精确 WYSIWYG）。

## 验证
- `pnpm --filter @h5design/web typecheck` → exit 0
- `D:/test-shots/animation-pipeline-equivalence.mjs`：对比 `computeDomStates` 与编辑器 `computeStates` 的**完整 start/end 8 属性**一致性，覆盖 enter/exit/emphasis 共 **17 种**动画 → **17/17 通过**。
- 多段（multi）动画走 `playMultiDomTimeline`，未改动。

## 待浏览器实测
本地无 Playwright，未做浏览器实测；建议实测确认预览窗口动画从头到尾连贯、与编辑器时长/起止态完全一致。
