# P2 阶段交付概览 — H5 在线设计平台

> 完成时间：2026-08-11
> 阶段目标：国际化（i18n + RTL）、素材管理（图片上传）、动画系统（GSAP）三大块收尾 + 最终验证

## 一、本阶段交付内容

### 1. 国际化（i18n + RTL）
- **6 种语言**：zh-CN、en、ug、kk-CN、ky-CN、uz-CN（后 4 种为 RTL）
- **5 个命名空间**：common / editor / templates / publish / errors
- **零硬编码中文**：registry.ts 由 `label`（中文）改为 `labelKey`，视图层 `t()` 翻译；store 层 `authStore`/`editorStore` 文案改为 i18n key；core 包（前后端共用）保持语言中立
- **RTL 方案**：`getLanguageDir()` + CSS 逻辑属性（`margin-inline-start` 等）

### 2. 素材管理（图片上传）
- 后端 `AssetModule`（multer 上传 + CRUD + 静态文件服务），路由 `POST/GET/DELETE /api/assets`
- 前端 `MaterialPanel` 上传集成，上传后通过 `addElement('image', { src })` 直接注入，移除 setTimeout 竞态 hack

### 3. 动画系统（GSAP）
- `AnimationConfig` 类型扩展（`enter/enterDuration/enterDelay/enterEasing/loop/loopDuration/loopEasing`）
- `ANIMATION_FIELDS` 注册表扩展 + `animations/presets.ts`（6 入场 + 4 循环）
- `DOMRenderer` 集成 GSAP，渲染后扫描 `data-element-id` 播放入场/循环动画

## 二、Task #39：补齐 4 个 RTL 语种缺失命名空间

**问题**：ug/kk-CN/ky-CN/uz-CN 此前仅注册 `common`，editor/templates/publish/errors 缺失，会回退到中文。

**修复**：
- 为 4 语种各创建 `editor.json` / `templates.json` / `publish.json` / `errors.json`（共 16 文件），键结构复制自 en，100% 对齐
- 补全 4 语种 `common.json` 缺失的 10 个键（`button.backToList/close/confirmPublish/retry/useTemplate`、`nav.allCategories`、`status.loadingProject/noTemplates/publishedBadge/untitled`），英文占位、保留已有母语翻译
- `apps/web/src/i18n/index.ts`：`fallbackLng` 由 `'zh-CN'` 改为 `'en'`，并 import 注册 4 语种 × 4 新命名空间

**说明**：RTL 新命名空间译文目前为英文占位（键结构完整），待母语译者填充即可生效，无需改动代码。

## 三、Task #40：最终验证结果

| 验证项 | 命令 | 结果 |
|--------|------|------|
| i18n 覆盖率 | 自研键对齐脚本 | 6 语言 × 5 命名空间 = 30 文件，键结构全部与 en 100% 对齐 ✅ |
| 前端类型检查 | `tsc --noEmit -p apps/web/tsconfig.json` | 0 errors ✅ |
| 前端生产构建 | `vite build`（apps/web） | 325 模块，built in 3.28s，无错误（仅 >500kB 分块提示）✅ |
| 后端编译 | `tsc -p tsconfig.build.json`（apps/server） | EXIT:0，无错误，`dist/main.js` + `dist/asset/` 正常产出 ✅ |

> 注：后端 `nest build` 因清理 `dist/`（73 文件）触发沙箱「安全删除」批量确认拦截，改用 `tsc -p tsconfig.build.json` 直接编译得到等效产物，结果一致。

## 四、遗留与后续

- **待办（非阻塞）**：4 个 RTL 语种（ug/kk-CN/ky-CN/uz-CN）的 editor/templates/publish/errors 命名空间及 common 缺失键为英文占位，需母语译者填充真实译文（键结构已就绪，填充即生效）
- **前端分块**：JS 主包 706KB（gzip 223KB），后续可按路由做 `manualChunks` 代码分割优化
- **下一步（P3）**：深化交互（组件库扩展 / 图层面板 / 标尺辅助线 / 历史版本 / 数据看板）

## 五、关键文件清单

- `apps/web/src/i18n/index.ts` — i18n 配置（6 语言 / fallbackLng=en）
- `apps/web/src/i18n/locales/{zh-CN,en,ug,kk-CN,ky-CN,uz-CN}/*.json` — 30 个翻译文件
- `apps/web/src/elements/registry.ts` — labelKey 化元素注册表
- `apps/web/src/store/authStore.ts` / `editorStore.ts` — 语言中立 store
- `apps/web/src/animations/presets.ts` + `DOMRenderer.tsx` — GSAP 动画
- `apps/web/src/components/Panel/MaterialPanel.tsx` — 上传集成
- `apps/server/src/asset/*` — 素材管理后端
