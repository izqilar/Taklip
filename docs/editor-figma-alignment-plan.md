# H5 编辑器对标 Figma 优化规划（实施方案）

> 范围：仅对标 Figma 的「对象创建 / 编辑操作 / 属性参数化」逻辑。
> 不做：组件化（Components/Instances）、多人协作、设计系统（Variables/Design Tokens）。
> 状态：规划稿（未动业务代码）。后端 `DOMRenderer` 已覆盖全部元素类型，本次仅改前端编辑器 UI/交互与必要的 schema 字段补充。

---

## 0. 核心原则

1. **属性严格按对象类型差异化**：每个字段都通过 `el.type` 或 `'x' in el` 类型守卫限定可见性，杜绝跨类型误显（根治「形状出现背景色」类问题）。
2. **右侧栏分组对标 Figma**：从当前「三个 Tab + 零散子面板」收敛为固定的折叠式 section 结构。
3. **术语统一**：填充 Fill / 描边 Stroke / 圆角 Corner radius / 旋转 Rotation / 不透明度 Opacity / 混合模式 Blend，与 Figma 一致，并校对所有语种。
4. **向后兼容**：不删除 schema 现有字段，仅调整 UI 显隐与新增少量 UI 所需字段。

---

## 1. 右侧属性栏重构（P1 · 最高优先级）

### 1.1 统一分组结构（对标 Figma 右栏）

将 `编辑` 选项卡内的内容从「TextEditPanel / ImageEditPanel / ShapeEditPanel + CommonProperties」重组为 6 个 section，按选中节点类型动态显隐：

| Section | 对标 Figma | 显示对象 | 字段 |
|---|---|---|---|
| **变换 Transform** | Design → 位置/尺寸/旋转 | 全部 | X / Y / W / H / 旋转 / 不透明度 |
| **填充 Fill** | Fill | 有 `fill` 的对象 | 颜色（文本语境标「文字颜色」、形状语境标「填充」） |
| **描边 Stroke** | Stroke | 有 `stroke` 的对象 | 颜色 / 粗细 / 线型 |
| **文本 Text** | Text | 仅 `text` | 字体 / 字号 / 字重(B/I) / 行高 / 字距 / 对齐 / 装饰(U/S) / 文本背景 |
| **专属 Specific** | 各类型参数 | 按类型 | 圆角 / 箭头类型·大小 / 边数·角数 / 图片适配·滤镜 / 视频控制 / 按钮链接 |
| **效果 Effects** | Effects | 全部 | 阴影（颜色/偏移/模糊） |

### 1.2 类型守卫字段映射表（核心，解决混淆）

| 对象类型 | 显示字段（仅下列） |
|---|---|
| `text` | 变换 + Fill(标注「文字颜色」) + 文本(全部) + **文本背景 backgroundColor(仅文本)** + 效果 |
| `rect` | 变换 + Fill + Stroke + 圆角 + 效果 |
| `circle` / `ellipse` | 变换 + Fill + Stroke + 效果 |
| `line` / `arrow` | 变换 + Stroke + 线型 + (arrow: 箭头类型 / 箭头大小) + 效果 |
| `star` / `polygon` / `triangle` | 变换 + Fill + Stroke + (star: 角数 / polygon: 边数) + 效果 |
| `image` | 变换 + 专属(替换源 / 圆角 / 适配方式 / 滤镜) + 效果 |
| `video` | 变换 + 专属(源 / 封面 / 自动播放 / 静音 / 循环 / 圆角) + 效果 |
| `button`(组件) | 变换 + Fill(背景) + 文字颜色 + 圆角 + 链接 + 效果 |

**规则**：`backgroundColor` 仅 `text` 可见；`fill` 在文本面板标签为「文字颜色」、在形状面板标签为「填充」；其余类型不渲染背景字段。

### 1.3 涉及文件与改动

- `apps/web/src/components/Panel/ComponentSettingsPanel.tsx`
  - 废弃 `TextEditPanel` / `ImageEditPanel` / `ShapeEditPanel` 零散字段，改为统一渲染器 `renderSections(el)`，按 1.2 映射表用类型守卫条件渲染各 section。
  - 新增子组件（可放 `components/Panel/sections/`）：
    - `TransformSection.tsx`（X/Y/W/H/旋转/不透明度）
    - `FillSection.tsx`（颜色，接受 `label` 区分「填充」/「文字颜色」）
    - `StrokeSection.tsx`（颜色/粗细/线型）
    - `TextSection.tsx`（字体/字号/字重/行高/字距/对齐/装饰/文本背景）
    - `SpecificSection.tsx`（按 `el.type` 渲染圆角/箭头/边数/图片/视频/按钮参数）
    - `EffectsSection.tsx`（阴影）
- `packages/core/src/schema.ts`
  - `video` 补充 `radius?`（圆角，UI 需要）；确认 `button` 字段已齐（text/fill/color/radius/link）。
  - 其余类型字段已满足，无需删改。
- i18n（6 语种 `editor.json`）：新增 `property.textColor`、`property.textBackground`、`property.rotation`、`property.cornerRadius`(统一) 等；将现有 `property.fill` 在文本/形状场景区分文案。

---

## 2. 补齐对象专属面板（P2）

### 2.1 视频面板（当前缺失 UI）
- 现状：`VideoElement` 有 `src/poster/autoplay/muted/loop`，但主分发无 `video` 分支 → 选中视频仅显示通用属性，无法编辑。
- 规划：`SpecificSection` 增加 `video` 分支：上传/替换源、封面图 `poster`、开关 `autoplay`/`muted`/`loop`、圆角 `radius`。

### 2.2 按钮（组件）面板（当前缺失 UI）
- 现状：`ButtonElement` 字段齐全，但无专属渲染分支。
- 规划：`SpecificSection` 增加 `button` 分支：文字 `text`、背景色 `fill`、文字色 `color`、圆角 `radius`、跳转链接 `link` 输入框。

### 2.3 图像增强
- 现状：`ImageEditPanel` 仅预览/上传/裁剪(占位)/查看原图，无圆角、无适配、无滤镜。
- 规划：圆角 `borderRadius`、适配方式（`object-fit`: cover/contain，映射到发布态 CSS）、滤镜（CSS `filter`: 亮度/模糊，新增 `filterBrightness?` / `filterBlur?` 到 `ImageElement`）。

### 2.4 对齐 / 分布常驻化
- 现状：`AlignDistributeToolbar` 仅在「多选」时出现在编辑 tab 顶部。
- 规划：移至右侧栏「变换」section 顶部常驻——单选时提供「对齐到画布」（左/中/右/顶/中/底），多选时提供「对齐彼此」+ 分布，与 Figma 行为一致。

---

## 3. 编辑器结构对标（P3）

### 3.1 左栏图层面板（对标 Figma Layers）
- 新增 `components/Panel/LayersPanel.tsx`：列表项 = 图标 + 名称 + 可见/锁定开关。
- 交互：点击选中（联动画布 Transformer）、拖拽改 `zIndex` 排序、多选联动、双击重命名。
- store：基于现有 `selectedIds` / `elements` 加图层选择器，复用已实现的层级操作（bringToFront 等）。

### 3.2 标尺 + 智能参考线
- 画布顶部/左侧标尺（对标 Figma rulers）。
- 拖拽/缩放时显示间距标注与对齐参考线（smart guides），复用现有对齐计算。

### 3.3 文本内联编辑与快捷操作
- 双击画布文本进入内联编辑（确认 `EditorCanvas` 是否已支持，未支持则补）。
- `Ctrl/Cmd+D` 原位复制（Duplicate）、`Delete/Backspace` 删除、与现有撤销重做联动。

---

## 4. 术语与 i18n 校对

统一右侧栏用词（Figma 语义）：
- 填充 Fill · 描边 Stroke · 圆角 Corner radius · 旋转 Rotation · 不透明度 Opacity · 混合模式 Blend · 效果 Effects · 变换 Transform
- 校对 `zh-CN / en / ug / kk-CN / ky-CN / uz-CN` 共 6 语种 `editor.json`，补全 1.3 / 2.x 新增键。

---

## 5. 实施里程碑

- **M1（P1）**：属性栏重构 + 类型守卫映射表 → 直接消除你看到的「属性混乱 / 形状误显背景色」，术语统一。
- **M2（P2）**：视频 / 按钮 / 图像专属面板 + 对齐常驻 → 对象体系在 UI 上完整可用。
- **M3（P3）**：图层面板 + 标尺/智能参考线 + 文本内联编辑 → 编辑器结构对标 Figma。

---

## 6. 风险与注意

- 重构 `ComponentSettingsPanel` 时用类型守卫收口，**不删除任何 schema 字段**，仅调整显隐，保证旧作品兼容。
- 发布态 `DOMRenderer.tsx` 已支持全部 12 种元素，本次 UI 改动不影响预览/发布渲染。
- `button` / `video` 当前缺 UI 分支属真实功能缺口，M2 一并补上。
- i18n 新增键需同步 6 语种，避免缺键回退到 key 名。
