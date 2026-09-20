# 设计稿 vs 页面展示一致性 & 加载性能修复报告

日期：2026-09-14
范围：`packages/render`（共享渲染器）、`packages/editor`（编辑器内核）、`apps/web`、apps/admin（运营端）

---

## 一、问题与现状

| # | 现象（用户反馈） | 现状 |
|---|---|---|
| 1 | 编辑器里文本完整，页面展示时「结」字**左侧被裁掉** | CSS 文本盒 `overflow:hidden` + 居中，超出盒子就切笔画；且 CSS 不会按 Konva 规则折行/丢行 |
| 2 | 编辑器里线条完整，页面展示**右侧丢约 1/3**（运营端同样） | 渲染器按 schema 里残留的 `points=[0,0,200,0]` 画线，而元素 `width=280` |
| 3 | 抽包后 web 端与运营端**加载明显变慢** | 编辑器内核（Konva + GSAP + 画布，约 4MB）被静态打进入口 chunk，登录页就要全量下载 |

## 二、根因

### 1. 文本：DOM 渲染与 Konva 排版语义不一致

编辑器用 `Konva.Text`，DOM 渲染用 CSS。二者有两条关键差异：

- **`_getTextWidth()` 含尾部字间距**
  `konva/lib/shapes/Text.js`：`_getTextWidth(t) = measureText(t).width + letterSpacing × t.length`
  → 「结婚是光荣的」24px/字间距 8：量得 `144 + 8×6 = 192`。
- **固定高度时会「丢弃超高行」**
  `_setTextData()` 里，若再加一行会超过 `height`，直接 `break`，**后续内容不渲染**。CSS 没有这个能力（只会溢出）。
- **Konva 不裁剪溢出**，而旧 DOM 实现给文本盒加了 `overflow:hidden` + 居中 → 一旦内容略宽于盒子，首字笔画被切。

结论：必须**复刻 Konva 排版**，而不是靠 CSS 自动布局。

### 2. 线条：`points` 与 `width` 不一致

编辑器 `KonvaElement` 的 line 分支**忽略 schema 里的 `points`**，永远按 `points={[0, 0, el.width, 0]}` 画。
而共享渲染器旧实现读 `el.points`（创建时残留的 `[0,0,200,0]`），`200 / 280` → 缺 28.6%，正好是用户说的「右侧将近三分之一」。

### 3. 性能：编辑器内核进了入口 chunk

- `apps/web/src/main.tsx` 静态 `import './editorServices'`（→ 整个内核）
- `App.tsx` 所有页面静态导入
- `packages/editor/src/store/editorStore.ts` 里 `import Konva from 'konva'` 是**值导入**（实际只在类型位置用到 `Konva.Stage`）→ 每个引用 store 的页面都背上 ~1MB Konva
- 非编辑器页面也从 `@h5design/editor` 主入口取 `PublishedH5` / `DOM*` 组件
- 运营端同理，且 69 个页面 import 全是静态

## 三、修复

### 渲染一致性

| 文件 | 改动 |
|---|---|
| `packages/render/src/lib/textLayout.ts` | **新增**。复刻 Konva 排版：`layoutText()`（含尾部字间距、折行二分查找、超高丢弃后续行）、`resolveLineOffset()`、`resolveVerticalOffset()`、`mapWordBreakToKonvaWrap()` |
| `packages/render/src/SchemaRenderer.tsx` | 新增 `TextElementView`：按行绝对定位、容器 `overflow:'visible'`；`case 'line'` 改为按 `el.width` 画满；给 `TextElementView` / `ImageElementView` 补 `key`（组件上的 key 才有效，挂在内部 div 上无效） |

### 加载性能

| 文件 | 改动 |
|---|---|
| `packages/editor/src/store/editorStore.ts` | `import Konva` → `import type Konva` |
| `packages/editor/package.json` | 新增子路径导出 `./store`、`./animations` |
| `packages/editor/src/animations/index.ts` | **新增**纯 GSAP 子入口（只导出 `presets.ts` / `registry.ts`，**不**导出 `konvaPlayer` / `konvaTimeline`） |
| `packages/render/src/index.ts` | 导出 `GalleryTransitionLayer`（此前只能从 editor 转出） |
| `apps/web/src/App.tsx` | 8 个路由改 `lazy()`；Suspense 兜底抽成 `RouteFallback` |
| `apps/web/src/components/AppLayout.tsx` | Suspense 放在 `<Outlet/>` 外（切路由时 Header 不闪） |
| `apps/web/src/main.tsx` | 移除 `import './editorServices'` |
| `apps/web/src/editorServices.ts` | 改为幂等 `registerEditorServices()`，只在 `pages/Editor.tsx` 调用 |
| `apps/web/src/pages/PublishedPage.tsx` | 用 render 的 `PublishedH5` + **显式注入** `animationPlayer={playElementAnimation}` |
| `apps/web/src/{pages/ProjectList,components/SiteHeader,pages/PublishedPage}.tsx`、`elements/*/DOM*.tsx` | 导入改到 `@h5design/render` / `@h5design/editor/store` |
| `apps/admin/src/App.tsx` | 69 个页面 import 改为 `import().then(m => ({default: m.X}))`（类型安全，改导出名 tsc 会报错） |
| `apps/admin/src/components/layout/AdminLayout.tsx` | 内容区包 Suspense（占位取主题令牌 `T.ink3`） |
| `apps/admin/src/{main.tsx,editorServices.ts}` | 同 web：移除入口静态导入、改为幂等注册 |

## 四、验证

**一致性门禁**（`apps/admin/temp/verify-parity-fix.mjs`，期望值**从数据库读真值**再按 Konva 公式复算，杜绝硬编码过期）：

```
新郎风采 · text · el_nm9e623wmt5gn8ho
  真值: w=203 h=40 fontSize=24 letterSpacing=8 lineHeight=1.4 align=center
  全文含间距宽 192.00 vs 容器宽 203 ⇒ 不折行
  Konva 期望: 1 行 ["结婚是光荣的"] left=5.50 top=3.20
  DOM 实测  : 1 行  left=5.50 top=3.20  overflow=visible  text="结婚是光荣的"   ✓ 全部一致

学术交流邀请函 · line · el_a33z81vmmtzy47ll
  真值: width=280，points=[0,0,200,0]
  SVG width=280  line x1/x2 = 0/280（旧实现为 0/200）   ✓
✅ PASS
```

**发布页**（`verify-published-anim.mjs`）：gsap 1 个模块 165.9KB、konva **0**、editor 仅 animations 子入口、0 报错；元素上出现 GSAP 写入的 `transform: translate(0px, 0px)`，两次采样有变化 → 动画确实在播。

**加载量**（`measure-load.mjs`，dev 未压缩）：

| 入口 | 模块数 | 体积 | editor | konva | gsap |
|---|---|---|---|---|---|
| web `/login` 修复前 | 145 | 7562.9 KB | 65 | 8 | 1 |
| web `/login` 修复后 | **33** | **2170.4 KB** | 1（仅 store） | **0** | **0** |
| admin `/login` 修复前 | 206 | 16019.5 KB | 66 | 8 | 1 |
| admin `/login` 修复后 | **61** | **8826.6 KB** | **0** | **0** | **0** |

**回归**：`packages/render`、`packages/editor`、`apps/web`、`apps/admin` 四端 `tsc --noEmit` 全通过；运营端各视角 + web 全路由（`/`、`/templates`、`/dashboard`、`/find-services`、`/quick-make`）冒烟通过，无应用级报错。

## 五、遗留与提示

- `/dashboard` 控制台的 `Request Error: unknow status` 来自第三方 B 站播放器脚本（设计稿里的外链视频），非本应用缺陷。
- 运营端控制台 `useForm is not connected to any Form element` 为既有 antd 警告，与本次改动无关。
- `packages/editor/src/animations/index.ts` **不要**追加导出 `konvaPlayer.ts` / `konvaTimeline.ts`，否则发布页会重新背上 Konva。
- 门禁脚本 `verify-parity-fix.mjs` 的期望值来自 DB，设计稿改尺寸/字间距后无需改脚本。
