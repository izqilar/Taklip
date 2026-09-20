# 首页 UI 优化报告（参照 PC mockup）

> 目标：参照 `LogoDesign/outputs/platform-ui-mockup-pc.html` 的 PC 端布局，在**保留现有页面功能**与**红色主题**的前提下做 UI 优化；未实现功能用「该功能即将上线」占位。

## 改动清单

### 1. 横幅（Banner）改为全屏宽度
- `pages/Home.tsx`：首屏红色包裹区不变（全宽），但**轮播横幅 section 由 `mx-auto max-w-7xl px-6` 改为 `relative w-full`**，横幅卡片铺满视口宽度（edge-to-edge），并新增 CTA 双按钮（开始设计 / 找服务），对齐 PC mockup 的 Hero。
- 轮播/指示器等现有交互全部保留。

### 2. 新增「服务商专区」板块（参照 PC mockup 的 6 类服务商）
- 首页二屏新增 6 张服务商卡片：特约设计 / 光影纪录 / 宴会场地 / 花艺礼赠 / 仪式执事 / 演艺星团。
- 卡片沿用**红色主题**（brand-50 图标底、brand-600 链接），点击跳转 `/find-services` 占位页。
- 板块底部标注「服务商功能即将上线，敬请期待」——未实现功能占位。

### 3. 页脚改为多列结构（参照 PC mockup）
- 由单行文案升级为「设计 / 服务 / 商家」三列 + 品牌简介 + 版权行的深色红渐变页脚，与首屏红色呼应。
- 列内链接指向现有或占位路由（`/templates`、`/find-services`、`/profile`、`/orders`）。

### 4. SiteHeader 顶部导航增强（参照 PC mockup 顶栏）
- 新增桌面端**搜索框**（跳转 `/templates?search=`）。
- 新增「**服务商入驻**」入口按钮（跳转 `/find-services`）。
- 保留语言切换、登录/注册、头像等现有功能；transparent / light 两种变体均适配。

## i18n
- `zh-CN/common.json` 与 `en/common.json` 新增：`nav.providerEntry`、`nav.searchPlaceholder`、`providers.*`（标题/副标题/查看/即将上线/6 类服务商名称与标签）、`footer.*`（品牌简介 + 设计/服务/商家三列）。
- 其余 4 种 RTL 语言（ug/kk-CN/ky-CN/uz-CN）按现有 `fallbackLng: 'en'` 回退英文，显示正常。

## 功能保留确认
- 轮播横幅、自动播放、场景分类 Tab 过滤、模板网格、热门搜索、核心引导区 —— 均保留未动。
- 底部 6 Tab 导航（AppLayout）保留；`/find-services`、`/orders`、`/messages`、`/profile` 仍为「该功能即将上线」占位页。

## 验证
- `pnpm --filter @h5design/web typecheck` → **EXIT 0** ✅
- Vite dev server（`http://localhost:5173`）编译无报错，已就绪。

## 备注
- 后端进程当前未在运行（此前 `node dist/main` 重启失败），模板网格在 API 不可达时显示「暂无模板」，不影响本次纯 UI 布局验证；恢复后端后模板缩略图即正常渲染。
