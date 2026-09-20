# 普通用户（USER）角色优化规划

> **定位**：基于 `docs/role-system-handoff.md`（2026-08-22 快照）与代码库实测，针对 **庆柬云 / TAKLIP Cloud** H5 请柬/设计平台的普通用户（USER）角色提出的优化方案。
> **性质**：纯规划文档，不含开发实现。如需落地，按「分阶段任务规划」推进。
> **品牌上下文**：USER 是平台核心消费者（做请柬的人）。服务商 SERVICE_PROVIDER / ADMIN 属供给侧（服务商可复合多种服务角色，原"设计师"是其一种子角色）。优化 USER = 优化核心业务价值闭环。概念上游见 `docs/role-layer-redefinition.md`。

---

## 0. 与 handoff 文档的关键偏差（以代码现状为准）

规划前已核对关键代码，发现文档快照滞后于实现，以下以代码为准：

| 文档描述 | 代码实测 | 结论 |
|---|---|---|
| 用户端「导出图片」缺失 | `apps/web/src/components/Editor/EditorApp.tsx:385` `handleExport` 已实现（离屏 DOMRenderer + html-to-image 单页 PNG），并经 `PublishModal` 的 `onExport` 接出 | **已落地**，文档误述，需校正 |
| 个人中心功能 | `apps/web/src/pages/Profile.tsx` 第二卡片仍是 `comingSoon` 占位，个人中心基本为空壳 | **确为空壳** |
| 发布页分享 | `apps/web/src/pages/PublishedPage.tsx` 无任何二维码/复制链接/分享逻辑（仅 `ProjectList.tsx` 发布时 `clipboard.writeText` 复制 URL） | **确缺失**，请柬传播闭环未闭合 |
| 发布弹窗二维码 | `apps/web/src/components/Publish/PublishModal.tsx:36` `QRPlaceholder` 是**纯占位 SVG**（支付宝/微信支付占位），非真实可扫码的分享二维码 | 支付二维码另属支付链路，Phase 1 不碰；分享二维码须新建 |
| 周边页面 | `Orders.tsx`、`Messages.tsx`、`FindServices.tsx`、`TemplateList.tsx`（含 favorite）已存在 | 已存在但彼此在 USER 主路径串联弱 |

**依赖缺口（Phase 1 需补）**：
- 前端 `apps/web/package.json` 已装 `html-to-image`（单页 PNG 导出依赖），但**无二维码库**，需新增 `qrcode`（生成 dataURL/canvas，可嵌入导出与下载）。
- 后端接口**已齐备、无需新增**：`publish`(返回 `PublishResult{ publishCode, url }`)、`unpublish`(DELETE `/api/publish/:id`)、`getStatsProjects`(返回每项含 `publishCode`/`viewCount`)。A2/A3 的分享与下架均可在纯前端完成。

---

## 1. USER 角色现状

**当前能力**：建作品、自动保存（30s 定时 + blur 触发）、逛/克隆免费模板、付费购买并使用模板、发布 H5、单页导出 PNG、申请入驻服务商（自助，仅需登录，弹窗**多选服务类型**：DESIGN/PHOTO/VENUE/FLORAL/STEWARD/PERFORM，已落地）。

**最大断点**：
1. 请柬「传播闭环」未闭合——做完请柬却**没有二维码/分享面板**发给宾客（请柬场景致命缺口）。
2. 个人中心空壳——「我的收藏 / 订单 / 设置」无处安放，已有 `Orders`/`Messages` 未串入 USER 主路径。

---

## 2. 优化方向总览（5 大主题，按 ROI 排序）

| 主题 | 核心缺口 | 为什么对 USER 重要 |
|---|---|---|
| **A. 分享与导出**（最高价值） | 发布页无二维码/分享（PublishModal 里的二维码是支付占位，非分享码）；导出仅单页 | 请柬要发给宾客，传播 = 产品价值本身 |
| **B. 个人中心与账户** | 个人中心占位、无手机/密码绑定 UI、收藏/设置无处放 | 留存与复访的基础 |
| **C. 模板发现与个性化** | 收藏/推荐/详情预览弱 | 降低从 0 到 1 的创作门槛 |
| **D. 服务商入驻引导** | 裸按钮、无价值说明、无审批预期 | 把高潜 USER 转供给方（可复合多服务角色） |
| **E. 体验加固** | 草稿恢复、移动端、i18n 覆盖 | 稳定性与多语体验 |

---

## 3. 分阶段任务规划

### Phase 0 — 现状校正与关键决策（约 1 周）
- **校正文档**：在 `docs/role-system-handoff.md` 删除"用户端导出图片缺失"误述（已实现）。
- **P1 决策（已拍板 ✅）**：采用**服务商入驻混合审核模型（多角色复合）**——
  - 普通用户点击「申请入驻服务商」即成为 `SERVICE_PROVIDER`（已落地，原 `DESIGNER`），可进入工作台、发布**免费**供给；
  - 入驻时可**多选服务类型** `serviceRoles`（DESIGN/PHOTO/VENUE/FLORAL/STEWARD/PERFORM），支持单角色或复合多角色；
  - 但上架**付费**供给前需先通过一次资质/实名审核：`providerStatus`（已落地，原 `designerStatus`）由 `PENDING → APPROVED`（`User.providerStatus` 字段已落地）；
  - 付费模板创建接口（`TemplateService.createByDesigner`，`price>0`）对 `providerStatus !== 'APPROVED'` 返回 403（已对 `providerStatus` 生效）；
  - 审核提交入口 `POST /api/auth/submit-provider-review`（已落地，原 `submit-designer-review`）+ 前端「提交资质审核」按钮（设置页）；当前为自助审核（轻量混合），真实平台可改为管理员后台审核队列（明确扩展点）。
  - **概念定义见 `docs/role-layer-redefinition.md`**；代码迁移（DESIGNER→SERVICE_PROVIDER、designerStatus→providerStatus、新增 serviceRoles 多选）已于 2026-08-23 **全部落地**。
  - 落地文件（已落地）：`prisma/schema.prisma`(Role 枚举改名 + ServiceRole 枚举 + serviceRoles 字段 + ProviderStatus)、`auth.service.ts`(`applyForProvider({serviceRoles})`/`submitProviderReview`)、`auth.controller.ts`、`template.service.ts`(付费闸门)、`client.ts`+`authStore.ts`(`isProvider`/`isProviderApproved` 透传)、`Profile.tsx`/`Settings.tsx`(状态与 CTA，Profile 新增多选服务类型弹窗)、`seed.ts`(`dev_provider_001` 置 SERVICE_PROVIDER+serviceRoles=[DESIGN]+APPROVED)。
- **补种子账号（已落地）**：`apps/server/prisma/seed.ts` 已增加 `dev_provider_001`(role:SERVICE_PROVIDER, serviceRoles=[DESIGN], providerStatus:APPROVED, 带 phone+password) 与 `dev_admin_001`(role:ADMIN)，打通三层联调；原 `dev_designer_001` 已改写。
- **验收**：handoff 文档与代码一致；三角色可登录联调；升级模型决策已记录。

### Phase 1 — 分享与导出（请柬传播闭环，优先做）

> **前置依赖**：`apps/web` 新增 `qrcode` 依赖（`pnpm -F @h5design/web add qrcode` + `@types/qrcode`）；`html-to-image` 已装可复用。后端接口（`publish`/`unpublish`/`getStatsProjects`）已齐备，**Phase 1 无需新增后端**。

#### A2 — 已发布页分享体系（`apps/web/src/pages/PublishedPage.tsx`）
**现状**：仅渲染 `<PublishedH5 project={project} />`，无任何分享/二维码 UI。
**目标**：让宾客能扫码/转发打开该 H5。
- **新增工具 `apps/web/src/utils/share.ts`**（A2/A3 共用）：
  - `buildShareUrl(publishCode)` → `${window.location.origin}/p/${publishCode}`（统一来源；替换 `ProjectList.tsx`、`PublishModal.tsx` 中散落的 `window.location.origin + '/p/' + code`）。
  - `generateQrDataUrl(url, size=240)` → `qrcode.toDataURL(url, { margin, width, color: { dark, light } })`。
  - `downloadDataUrl(dataUrl, filename)`、`copyToClipboard(text)`（带 `execCommand` 兜底）。
- **分享条**（手机框下方，RTL 下整体镜像）：
  1. **二维码卡片**：`qrDataUrl = await generateQrDataUrl(buildShareUrl(publishCode))`，`<img src={qrDataUrl} />` + 「保存二维码」按钮（`downloadDataUrl(qrDataUrl,'qrcode.png')`）。宾客扫码即开 H5——这是请柬核心传播物。
  2. **复制链接**：`copyToClipboard(buildShareUrl(publishCode))` + toast「已复制」。
  3. **微信分享引导**：网页无法在无公众号/小程序 JSSDK 授权下程序化调起微信分享，故展示「用微信打开本页 → 点右上角 ··· → 发送给朋友/分享到朋友圈」文案 + 图标；非微信 UA 时额外提示「请在微信中打开」。
- **OG 元信息**：`document.title` 已设；追加 `setOgTags({ title, url, image })`（`image` 取作品封面或首页截图）写入 `og:title/og:image/og:url`，提升 IM 粘贴预览。
  - ⚠️ 限制：SPA 仅能设置「当前页」元信息；外部粘贴链接要拿到卡片预览需服务端在 `/p/:code` 渲染 OG（后端任务，Phase 1 标为可选增强，不阻塞 MVP）。
- **数据来源**：`publishCode` 直接取自路由 `useParams()`（无需后端回查）。
- **i18n**：`common` 命名空间新增 `share.qrCode / share.saveQr / share.copyLink / share.copied / share.wechatHint / share.openInWechat`，6 语言（zh-CN/en/ug/kk-CN/ky-CN/uz-CN）同步，RTL 用逻辑属性确保镜像。

#### A1 — 导出增强（`apps/web/src/components/Editor/EditorApp.tsx` `handleExport`）
**现状**：单页 PNG 已落地（`:385`），离屏节点 `:853–875` 仅渲染 `currentPage={activePage}`。
**目标**：在「当前页」基础上增加「全部页长图」。
- **导出模式开关**：发布/导出流程增加「当前页 / 全部页（长图）」切换（MVP 先落地这两档；ZIP 全页为后续子任务）。
- **长图实现**：
  1. 挂载离屏纵向容器 `exportAllRef`，内含 `pages.map((_, i) => <div style={{width,height}}><DOMRenderer project={project} currentPage={i} scale={1} animated={false} /></div>)`（复用现有 `exporting && (...)` 渲染块模式，导出时长图时持续挂载）。
  2. 截帧前确保所有图片加载：`preloadAllPageImages(project)`（复用 `apps/web/src/utils/exportVideo.ts` 的 `preloadImages`/`cloneAndInline` 把远程 COS 图内联为 dataURL，**规避 CORS 污染导致空白**），或等待 `document.images` 全部 `complete` + 固定延时。
  3. `const dataUrl = await toPng(exportAllRef.current, { pixelRatio, width, height: pageH * N })` → 下载 `<title>-长图.png`。
- **已知限制**：html-to-image 受 canvas 上限（约 16384px）约束，>~20 页需切片；长图体积较大，建议 `pixelRatio` 默认 2、可按清晰度档位下调。
- **i18n**：`editor:toolbar.exportCurrent / exportLongImage / exporting`。

#### A3 — 已发布作品管理（`apps/web/src/pages/ProjectList.tsx`）
**现状**：列表 hover 有发布/删除；`handlePublish` 复制 URL；`viewsById` 已按 `id` 显示访问量（来自 `getStatsProjects`）。
**目标**：已发布作品可直接管理。
- 由 `getStatsProjects` 派生 `publishCodeById`（每项已含 `publishCode`）。
- 对 `status==='published'` 的作品增加操作：**查看**（`/p/:code` 新窗口）、**二维码**（小弹窗展示 `generateQrDataUrl(buildShareUrl(code))` + 下载）、**访问统计**（已用 `viewsById[id]`）、**下架**（`api.unpublish(id)` → 刷新列表，沿用现有 `handleDelete` 的 `confirm` 模式）。
- 「重新生成二维码」= 用同一 URL 重新渲染二维码（纯前端，无需后端）；若未来要做「更换发布链接」才需后端 `POST /api/publish/:id/reset`（Phase 1 不纳入）。

#### Phase 1 验收
- [ ] 发布页渲染出**可被微信识别**的二维码（编码自身 URL）；「保存二维码」下载 PNG。
- [ ] 「复制链接」复制规范分享 URL 并 toast 确认；RTL 语言下分享条正确镜像。
- [ ] 编辑器导出提供「当前页 / 全部页长图」，长图下载为单张纵向 PNG、各页顺序正确、图片无空白（CORS 已内联）。
- [ ] 作品列表已发布项显示访问量、二维码弹窗、下架操作；下架调用 `unpublish` 并刷新。
- [ ] `pnpm -F @h5design/web typecheck` 与 `build` 通过；6 语言补全。

### Phase 2 — 个人中心与账户 ✅ 已落地（2026-08-23）
- **C1 个人中心落地** ✅：`Profile.tsx` 第二卡片 `comingSoon` 已替换为真实入口网格（我的作品/我的收藏/我的订单/账号设置/消息），全部 Link 化。
- **C2 账户绑定** ✅：新增 `Settings.tsx` 账号设置页（昵称/头像/手机/改密）；后端新增 `PATCH /api/auth/me`（`updateProfile`）+ `POST /api/auth/change-password`（`changePassword`，校验原密码）；`authStore` 同步方法；`errors` 补 `updateProfileFailed`/`changePasswordFailed`。
- **收藏功能** ✅（原属 Phase 3，提前打通个人中心闭环）：新增 `favoritesStore.ts`（localStorage 持久化）+ `Favorites.tsx` 收藏列表页（受登录保护）+ `TemplateCard` 爱心切换；`App.tsx` 注册 `/favorites`、`/settings` 路由（均 `ProtectedRoute`）。
- **C3 消息中心**：`Messages.tsx` 仍为占位页，已作为入口接入个人中心；触发场景（购买成功/模板下架）待后端消息表落地（非本次范围）。
- **i18n**：6 语言补 `profile.*` / `favorites.*` / `settings.*` 命名空间。
- **验收**：✅ typecheck + web build 通过；USER 登录后可在个人中心进入收藏/订单/设置，修改昵称/手机/改密。

### 服务端 OG 渲染（原 Phase 1 可选增强，已提前完成 ✅）
- 新增 `publish/og.util.ts`（`buildOgHtml` + 爬虫 UA 正则）。
- `PublishService.getOgMeta` 取已发布作品标题/封面；`PublishController` 新增 `GET /api/og/:publishCode` 返回 OG HTML。
- `main.ts` 中间件：社交/IM 爬虫（微信/QQ/Telegram 等）访问 `/p/:publishCode` 时返回 OG HTML，浏览器请求 `next()` 走 SPA。
- ⚠️ 部署约束：SPA 由独立源提供，生产需代理层按 UA 将爬虫 `/p/:code` 请求分流到 API 服务（或分享 `/api/og/:code`）才能命中 OG；开发期 vite 直接服务 `/p`，OG 不触发属预期。

### Phase 3 — 模板发现与个性化
- **C/B1 收藏与推荐**：收藏夹 + 「我的模板」+ 「为你推荐」（基于已用场景分类）。
- **B2 分类/搜索增强**：场景化分类（婚礼/生日/节日/商务）、免费/付费/热门筛选、排序。
- **B3 模板详情预览**：购买前看全页、设计师信息、价格说明。
- **验收**：USER 可收藏模板并在个人中心查看；模板库支持分类筛选与详情预览。

### Phase 4 — 服务商入驻引导与入口（入驻模型已定为混合审核，可复合多服务角色）
- **D1 入驻引导页**：价值说明（收益/曝光）+ **服务类型多选**（DESIGN/PHOTO/VENUE/FLORAL/STEWARD/PERFORM，可单可复合）+ **资质审核说明**（申请即 SERVICE_PROVIDER 可发免费供给；上架付费供给前需过 `providerStatus` 审核）+ 流程可视化。
- **D2 顶栏常驻入口**：对 SERVICE_PROVIDER/ADMIN 登录态，在 `SiteHeader.tsx` 显式暴露「服务商工作台」常驻入口（当前仅在头像下拉，文案已统一为「服务商工作台」）。
- **验收**：USER 点击入驻可见引导页（含多选服务类型与审核预期）；已入驻用户在顶部导航直接看到工作台入口；付费供给在审核通过前被拦截。

### Phase 5 — 体验加固
- **E1 草稿恢复**：已有 30s 自动保存，补充「恢复未保存草稿」提示与入口。
- **E2 移动端适配**：编辑器与发布页在手机端的编辑/查看可用性（请柬多在手机完成）。
- **E3 内容安全反馈**：提交模板、购买等操作的敏感词/审核反馈对 USER 清晰可见。
- **E4 国际化覆盖**：USER 端 6 语言（含 4 RTL）覆盖度核查；模板名 RTL i18n（handoff P3）。
- **验收**：多端可用、多语无错位、安全反馈明确。

---

## 4. 建议优先做的 3 件事（投入小、价值最大）

1. **发布页分享/二维码（A2）** —— 直接闭合请柬传播闭环。
2. **导出长图（A1）** —— 微信转发刚需。
3. **个人中心落地（C1）** —— 把已有 `Orders`/`Messages` 串进 USER 主路径。

---

## 5. 接驳文件速查（落地时直接改这几处）

| 改动类型 | 文件 |
|---|---|
| 分享工具（新增） | `apps/web/src/utils/share.ts`（`buildShareUrl`/`generateQrDataUrl`/`downloadDataUrl`/`copyToClipboard`） |
| 依赖（新增） | `apps/web/package.json`（`qrcode` + `@types/qrcode`） |
| 导出增强 | `apps/web/src/components/Editor/EditorApp.tsx`（`handleExport` + 离屏长图节点 `:853` + 导出模式开关） |
| 发布页分享 | `apps/web/src/pages/PublishedPage.tsx` |
| 已发布管理 | `apps/web/src/pages/ProjectList.tsx` |
| 发布弹窗（可选复用） | `apps/web/src/components/Publish/PublishModal.tsx`（`QRPlaceholder` 为支付占位，分享二维码另建） |
| 个人中心 | `apps/web/src/pages/Profile.tsx` |
| 账户绑定 | `apps/web/src/pages/Login.tsx`、`Register.tsx`、`store/authStore.ts` |
| 消息中心 | `apps/web/src/pages/Messages.tsx` |
| 模板发现 | `apps/web/src/pages/TemplateList.tsx`、`components/TemplateCard.tsx` |
| 服务商入驻引导 | `apps/web/src/pages/Profile.tsx`、`components/SiteHeader.tsx` |
| 种子账号 | `apps/server/prisma/seed.ts` |
| 入驻/升级接口/模型 | `apps/server/src/auth/auth.controller.ts`、`auth.service.ts` |
| i18n（6 语言） | `src/i18n/locales/{zh-CN,en,ug,kk-CN,ky-CN,uz-CN}/{common,editor,publish}.json` |

---

> **进度总览**：
> - ✅ Phase 0：文档校正（导出误述删除）+ 三角色种子账号 + Prisma 客户端生成（designerStatus 字段）。
> - ✅ Phase 1：分享与导出（发布页二维码/复制/微信引导/OG + 导出长图 + 已发布管理）。
> - ✅ Phase 2：个人中心落地（真实入口 + 设置页 + 收藏 store/页 + 模板卡收藏 + 路由）。
> - ✅ 服务端子码 OG 渲染（`/p/:publishCode` 爬虫中间件 + `/api/og/:publishCode`）。
> - ✅ P1 升级模型决策（**服务商入驻混合审核（多角色复合）**，已落地后端付费闸门 + 前端审核 CTA；代码命名已统一为 SERVICE_PROVIDER/providerStatus + serviceRoles，见 `docs/role-layer-redefinition.md`）。
>
> **下一步可选**：Phase 3 模板发现与个性化（收藏推荐/分类筛选/详情预览）、Phase 4 服务商入驻引导页（多选服务类型）与顶栏常驻入口、服务端子码 OG 的生产 nginx/SPA 配置联调（角色模型代码迁移 DESIGNER→SERVICE_PROVIDER + serviceRoles 多选已于 2026-08-23 完成）。
