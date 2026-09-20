# Konva 离屏视频导出方案 · 文件级实施计划

> 目标：从 375×667 设计稿导出 **1080×1920 / 30fps / 高码率** 的真高清视频，
> 并完整还原第一页到最后一页的对象动画时间线。
> 方案：用已有的 Konva 渲染路径做离屏栅格化（替代 html-to-image 截图），纯前端、零新增基础设施。

---

## 0. 关键事实更正（影响方案判断）

之前误认为 `registry.ts` 通过 `CanvasComponent + ExportComponent` 槽位注入渲染组件。
**经核实不实**：

- `src/elements/registry.ts` 只存 `type / labelKey / icon / baseFields / typeFields` **纯属性元数据**，没有任何渲染组件槽位。
- 实际渲染分发：
  - **简单元素**（text / rect / circle / line / image / button / video / star / triangle）：
    内联在 `apps/web/src/components/Canvas/EditorCanvas.tsx` 的 `switch (el.type)`（第 582 行起），用 react-konva 原语绘制。
  - **复杂元素**（calendar / gallery / puzzle / countdown / mapNav / messageBoard / timeline / like / widget）：
    各自 `src/elements/<type>/Canvas<Type>.tsx`，且**确认为 react-konva 组件**（如 `CanvasCalendar.tsx` 顶部 `import { Group, Rect, Text, ... } from 'react-konva'`）。

**结论**：每个元素**已有 Konva 渲染路径**，离屏视频可直接复用，无需从零重写。

---

## 1. 目标参数

| 项 | 值 |
|---|---|
| 录制画布分辨率 | `1080 × 1920`（竖屏 9:16，与 375×667 ≈ 0.5625 同比例，无需裁剪/信箱） |
| 离屏 Konva `Stage` | `width=375 height=667 pixelRatio = 1080/375 = 2.88` |
| 帧率 | `CAPTURE_FPS = 30`（`captureStream` 同步 30） |
| 码率 | `videoBitsPerSecond: 12_000_000`（1080p30 ≈ 8–12 Mbps） |
| 编码 | 优先 `video/mp4`（H.264），不支持时回退 `video/webm`；可选 `ffmpeg.wasm` 兜底转 mp4 |
| 动画驱动 | GSAP 直接驱动 Konva 节点属性，复用 `computeStates` 的起止绝对态 |

---

## 2. 文件级实施步骤

### 2.1 提取共享 Konva 渲染（核心重构，消除重复）
**新增 `apps/web/src/components/Canvas/KonvaElement.tsx`**

- 把 `EditorCanvas.tsx` 第 582 行起 `switch(el.type)` 对 9 个简单元素的内联 JSX **提取为纯渲染组件**
  `KonvaElement({ el, images })`，去掉所有 `listening` / transformer / 选中 / 拖拽逻辑（导出不需要交互）。
- 复杂元素按 type 分发，直接 `import CanvasCalendar / CanvasGallery / CanvasPuzzle / ...` 复用现有 `Canvas<X>.tsx`。
- 编辑器 `EditorCanvas` 后续也可改调 `KonvaElement`（先不强制；但提取后**编辑器与导出共享同一套视觉，保证一致性**）。
- **图像依赖改造**：当前 `image` 元素用运行时 `imageCache`（远程加载）。
  导出不能依赖编辑器缓存 → 改为**注入 `images: Map<src, HTMLImageElement>`**（预加载好的 dataURL 图，沿用现 `exportVideo.ts` 的 `preloadImages`）。

### 2.2 离屏舞台 + 帧捕获（改动最小）
**新增 `apps/web/src/utils/konvaVideoExport.ts`**

- 用 `createRoot` 把
  `<Stage width=375 height=667 pixelRatio={2.88}><Layer><KonvaElement .../></Layer></Stage>`
  挂到 `position:fixed; left:-10000px` 的离屏 div（与现 DOM 导出同款挂法，
  **100% 复用现有 react-konva 组件，几乎零重写**）。
- 逐帧 `stage.toCanvas()`（Konva 原生栅格化，**比 html-to-image 快一个量级**）绘到 1080×1920 录制画布 → `MediaRecorder`。
- 预加载图片仍用 `preloadImages` + `cloneAndInline`（保留，避免远程拉取/CORS 失败）。

### 2.3 动画映射（复用 `animations/konvaPlayer.ts` + `animations/presets.ts`）
- 挂载后，对每元素节点（`ref` 或 `layer.findOne('#'+id)`）执行
  `gsap.fromTo(node, startState, { ...endState, duration, ease, onUpdate: () => layer.batchDraw() })`。
- 入场映射（与 `computeStates` 起止态对齐）：
  - `fadeIn` → opacity 0→1
  - `slideIn` → x/y 偏移 → 0（节点已 `offsetX/offsetY = w/2` 居中，slide 用 `+Δ` 偏移）
  - `zoomIn` → scaleX/scaleY 0.5→1
  - `rotateIn` → rotation -180→0
  - `bounceIn` / `flipIn` → scale / rotation 组合
  - GSAP 给 Konva 节点属性赋值会触发 setter 更新 attr，每帧 `stage.toCanvas()` 自动重绘，无需手动 redraw。
- 循环动画：`gsap.to(node, { repeat:-1, yoyo, ... })` 驱动 scale/rotation/x，逐帧 draw。
- **注意**：Konva 滤镜（图片 Brighten/Contrast/Blur）在 `pixelRatio` 高倍下 `blurRadius` 基准会变 → 按 `k` 缩放 blur 半径。

### 2.4 时间线 / 跨页（照搬现有结构）
与现 `exportVideo.ts` 同构：逐页挂 Konva 舞台 → 播该页动画 → 截帧 →
下一页静止帧交叉淡入 → 切页。复用现 `drawBlend` 的 2D 混合（截出都是 1080×1920 canvas）。

### 2.5 录制参数
- `rec.width = 1080; rec.height = 1920`（或 `Math.round(375 * k)`）。
- `rec.captureStream(30)`。
- `new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 12_000_000 })`。
- 可选：`ffmpeg.wasm` 把 webm 转 mp4（浏览器不支持 mp4 `MediaRecorder` 时兜底）。

---

## 3. 哪些元素"需要补高清渲染"？

**结论：高清本身零补齐** —— Konva 是矢量栅格化，`pixelRatio: 2.88` 下文字/形状/路径自动高清；
图片靠源分辨率。真正要测的是**与 DOM 发布页的视觉一致性**（不是清晰度问题），逐项回归：

| 元素 | 复用情况 | 一致性风险点 |
|---|---|---|
| text / rect / circle / line / star / triangle | 提取自 EditorCanvas 内联 JSX | 形状/颜色/圆角本就 Konva 原生，低 |
| image | 复用现有 `computeImageLayout` + 滤镜/裁剪/平铺逻辑 | `box-shadow`/`border-radius`/滤镜数值需与 DOM 对齐；blur 半径按 k 缩放 |
| button | 提取自内联 JSX | 圆角/背景/文字，低 |
| video | 复用 `poster` 帧渲染 | Konva 无原生视频播放，导出渲染 poster（与编辑器画布一致），不做真播放 |
| calendar / gallery / puzzle / countdown / mapNav / messageBoard / timeline / like / widget | 直接复用各自 `Canvas<X>.tsx` | 已有 react-konva 绘制，天然高清；逐组件回归对比 DOM 即可 |

重点回归项（一致性，非清晰度）：
- 文字换行 / `word-break: break-all` / 字间距 → Konva `wrap` 语义略异，需逐文案实测；
- 渐变 / `box-shadow` / `border-radius` → Konva 原生支持，确认数值与 DOM 一致；
- 图片滤镜 Brighten/Contrast/Blur → 高倍 pixelRatio 下 blur 半径基准需按 k 缩放。

---

## 4. 改动文件清单

| 动作 | 文件 |
|---|---|
| 新增 | `apps/web/src/components/Canvas/KonvaElement.tsx`（从 EditorCanvas 提取共享 Konva 渲染） |
| 新增 | `apps/web/src/utils/konvaVideoExport.ts`（主管线，替代 DOM 截帧部分） |
| 修改 | `apps/web/src/components/Publish/PublishModal.tsx`（调用新导出，可加"高清 Konva"开关） |
| 可选新增 | `apps/web/src/utils/ffmpegMp4.ts`（mp4 兜底） |
| 复用不改 | `animations/konvaPlayer.ts`、`animations/presets.ts`、`elements/*/Canvas<X>.tsx`、`registry.ts` |
| 可选改 | `apps/web/src/components/Canvas/EditorCanvas.tsx`（switch 改调 KonvaElement，先不动也行） |

---

## 5. 风险与验证

- **一致性回归**：建 9 类元素 + 各动画的截图对比（Konva 离屏帧 vs DOM 发布页），这是主要工时。
- **编码**：`MediaRecorder` mp4 支持因浏览器而异，`ffmpeg.wasm` 兜底建议一并做。
- **性能**：Konva `toCanvas` 在 2.88× 下仍比 html-to-image 快，30fps 可达；
  若个别重页掉帧，可把该页截帧率降到 20 但保持 30fps 容器（重复帧）。
- **验证手段**：先写一个离屏对比验证页，并排渲染 Konva 离屏帧与 DOM 发布页，逐项核对视觉一致后再铺开整条视频管线。

---

## 6. 与 Playwright 方案对比（决策参考）

| 维度 | Konva 离屏（本方案） | Playwright 无头 |
|---|---|---|
| 基础设施 | 零新增（纯前端） | 需 Chromium + ffmpeg + 异步导出服务 + COS 存储 |
| 前端代码改动 | 较大（提取共享 Konva 渲染 + 动画映射） | 小（前端只调接口 + 下载） |
| 与发布页一致性 | 需逐项回归（双引擎本就不完全等） | 100% 一致（直接渲染发布页） |
| 真 30fps | 可达（Konva 原生栅格化快） | 可达（无头浏览器真实分辨率） |
| 运维复杂度 | 低 | 高（镜像体积/并发/队列） |
