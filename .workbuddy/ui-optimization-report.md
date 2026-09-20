# 前端 UI 优化交付报告（依据 docs/平台服务架构规划_v2.md）

> 范围：仅做 UI 界面优化，保留现有色彩风格；未实现的功能用「该功能即将上线」占位，**不做业务逻辑开发**。
> 验证：`apps/web` typecheck EXIT 0 ✅

## 一、规划落点
规划 v2 的核心 UI 骨架是**全站底部 6 Tab 主导航** + **首页场景化 4 类分类** + **找服务/订单/消息/我的**频道。本次即据此优化。

## 二、改动清单

### 1. 全站底部 6 Tab 导航（规划 v2 第四节主骨架）
- 新增 `apps/web/src/components/SiteTabBar.tsx`：6 个 Tab —— 首页 / 设计工坊 / 找服务 / 订单 / 消息 / 我的；`NavLink` 高亮当前路由，激活态用蓝色 `brand-600`（与现有 SiteHeader 主色一致）。
- 新增 `apps/web/src/components/AppLayout.tsx`：`<Outlet />` + 底部 `<SiteTabBar />`，统一包裹需要底部导航的页面。
- `apps/web/src/App.tsx`：
  - 公开页（首页、模板库、找服务、订单、消息、我的）+ `/dashboard` 包进 `AppLayout`。
  - `/login`、`/register`、`/p/:code`（发布页）、`/editor/:id`（编辑器）为独立路由，**不加**底部导航（登录/注册是聚焦流程，发布页与编辑器是工具态）。

### 2. 首页场景分类改版为规划 4 类（保留红色主题）
`apps/web/src/pages/Home.tsx`：原 7 个场景 Tab（wedding/recruitment…）→ 规划 4 类**推荐 / 商务企宣 / 人生礼仪 / 教育培训**；用 `SCENE_MAP` 将分类映射到现有模板 `category` 做前端过滤：
- 推荐 → 全部
- 商务企宣 → recruitment / conference / marketing
- 人生礼仪 → wedding / birthday / festival
- 教育培训 → education

### 3. 设计工坊（模板库）分类同步 4 类
`apps/web/src/pages/TemplateList.tsx`：同样改为 `SCENE_TABS` + `SCENE_MAP` 前端过滤，与首页分类完全一致（保留蓝色 `brand-500` 高亮）。

### 4. 新增 4 个占位页（未实现功能用占位）
`apps/web/src/pages/` 下：
- `FindServices.tsx`（找服务）、`Orders.tsx`（订单）、`Messages.tsx`（消息）：居中展示频道图标 + 标题 + **「该功能即将上线」**。
- `Profile.tsx`（我的）：个人中心占位 + 顶部**金色「我是服务商，立即入驻」大按钮**（规划六 B 端触达）+ 「我的设计」入口链接到 `/dashboard`（已实现的我的作品）。

### 5. i18n（6 语言 common.json）
新增 `nav.{home,designStudio,findServices,orders,messages,profile}`、`scene.{recommend,business,life}`（education 原有）、顶层 `placeholder.{comingSoon,providerEntry,providerEntrySub}`。

### 6. 底部留白
各包裹页面根容器加 `pb-20`，避免固定底部 TabBar 遮挡内容。

## 三、色彩风格处理（保留现状）
- 首页：维持原有红（`#c81e42` 渐变）+ 绿（`emerald-500`）主题，未改动。
- 全局主交互色：沿用蓝色 `brand` 色系（SiteHeader / 导航高亮一致）。
- 编辑器：维持深色蓝主题。
- 仅「入驻」按钮按规划要求用金色（amber/yellow 渐变），属于规划指定的语义强调色。

## 四、未做（按约定不做具体开发）
- 找服务 / 订单 / 消息 / 个人中心 / 服务商入驻 等**业务逻辑均未实现**，仅 UI 占位。
- 未接入后端新接口、未建 admin 后台。

## 五、待你确认/可选后续
- 是否要给「登录/注册/发布页」也加底部导航（当前为聚焦流程，未加）。
- 设计工坊二级 Tab（自助模板/定制需求/我的设计）是否要进一步细化。
- 如需浏览器实测底部导航与场景切换，可启动 dev server 验证。
