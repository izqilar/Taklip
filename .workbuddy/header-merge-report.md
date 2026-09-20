# 顶部导航合并报告

> 目标：网站名改为「庆典云」；将底部 6 Tab 与顶部菜单合并为固定顶部导航栏；登录前显示 登录/注册，登录后显示头像下拉。

## 改动清单

### 1. 品牌名改为「庆典云」
- `i18n/locales/zh-CN/common.json`：`app.name` → 庆典云。
- `i18n/locales/en/common.json`：`app.name` → Qingdian Cloud。
- `components/SiteHeader.tsx`：Logo 硬编码为「庆」（白）+「典云」（金）的分色样式，与截图一致。

### 2. 顶部导航合并底部 Tab
- `components/SiteHeader.tsx` 重写：
  - 固定顶部：`fixed left-0 right-0 top-0 z-50 bg-[#c81e42] text-white`。
  - 主导航：首页 / 模板库 / 设计工坊 / 找服务（`nav.templates` 同步改为「模板库」）。
  - 右侧：金色「服务商入住」按钮、搜索框、登录/注册或头像下拉、地球语言切换器。
- `components/AppLayout.tsx`：移除 `SiteTabBar`，统一渲染 `SiteHeader`，主内容区加 `pt-16` 防止被固定头遮挡。
- 删除 `components/SiteTabBar.tsx` 不再使用（保留文件未删，仅移除引用）。

### 3. 登录前/后状态
- 未登录：显示「登录」（白边透明）+「注册」（白底红字）圆角按钮，与截图一致。
- 已登录：显示圆形头像（首字母），点击展开下拉菜单：我的 / 我的作品 / 订单 / 消息 / 退出。

### 4. 移除各页面中的重复头部与底部 TabBar
- `pages/Home.tsx`：移除 `SiteHeader` 导入与使用，移除 `pb-20`。
- `pages/TemplateList.tsx`：移除 `SiteHeader`，移除 `pb-20`。
- `pages/ProjectList.tsx`：移除自定义深色顶部栏、LanguageSwitcher、logout；改为由全局 SiteHeader 服务，保留「+ 新建」按钮在内容区顶部。
- `pages/FindServices.tsx` / `Orders.tsx` / `Messages.tsx` / `Profile.tsx`：移除 `SiteHeader` 与 `SiteTabBar` 导入使用，移除 `pb-20`。

### 5. 语言切换器图标
- `components/LanguageSwitcher.tsx` 新增 `variant="globe"`，仅显示地球图标，匹配截图右侧语言入口。

## i18n 微调
- `zh-CN/common.json`：`nav.templates` → 模板库；`nav.providerEntry` / `footer.providerEntry` → 服务商入住（与截图文字一致）。
- `en/common.json`：`nav.templates` 保持 Templates（通用）。

## 验证
- `pnpm --filter @h5design/web typecheck` → **EXIT 0** ✅
- Vite dev server `http://localhost:5173/` 编译无报错，已就绪。
