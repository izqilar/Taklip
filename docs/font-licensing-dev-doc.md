# 付费字体授权与渲染系统 — 开发文档

> **文档版本**：v1.0.0 ｜ **最后更新**：2026-09-14 ｜ **状态**：实施中
> **格式来源**：`docs/standard-dev-doc.md` 第 5 章接口规范
> **范围**：在「免费 / 付费模板」体系内接入自定义（含艺术）字体，实行「付费字体绑定付费模板」授权模型，并对未授权使用做水印 / 低分辨率保护。

---

## 1. 业务概述与已确认决策

### 1.1 核心规则

1. **付费字体仅作为「付费模板」的属性**存在，不单独售卖、不单独计费。
2. **服务商**：设计任意模板时均可随意调用付费字体（视为已获平台授权；平台不向服务商收授权费，靠卖模板抽成）。
3. **硬规则**：免费模板**不得包含任何付费字体**（发布时服务端拦截）。
4. **用户**：只有**购买了某个付费模板**后，才能在该模板语境下使用其中所含的付费字体（原样或改内容），且授权**仅限本模板**（含导出图片 / 视频）。
5. **草稿保存永不卡**；只有「发布 / 导出」卡授权。
6. **试用体验（水印）**：未购模板的用户可在编辑器内调用付费字体**试设计看效果**，但：
   - 编辑器内**预览**加水印；
   - **截屏**（客户端导出）加水印；
   - **导出图片 / 视频**（服务端渲染）为**低分辨率 + 水印**；
   - **发布**被拦截（返回 402 / 业务码 6002），须先购买含该字体的付费模板。

### 1.2 角色 × 动作授权矩阵

| 角色 | 动作 | 设计期渲染 | 预览 | 截屏 | 导出(服务端) | 发布 |
|------|------|------|------|------|------|------|
| 服务商 | 用付费字体设计模板 | 免费真实 | 真实 | 真实 | 真实高清 | 允许(付费模板)；免费模板含付费字体则拒(6001) |
| 用户(已购模板) | 改 / 用该模板付费字体 | 免费真实 | 真实 | 真实 | 真实高清 | 允许 |
| 用户(未购) | 试设计用付费字体 | 免费真实 | 水印 | 水印 | 低分辨率 + 水印 | **拒(6002)** |

---

## 2. 技术方案

### 2.1 字体管线

```
[字体文件] uploads/fonts/*.woff2|woff|ttf  ──(静态托管 /uploads/fonts/)──▶ 浏览器
        │                                            ▲
        └── FontFace API 注册(document.fonts) ──────┘
                    │
        GET /api/fonts ──▶ 字体目录(family/displayName/isPaid/files)
                    │
   编辑器挂载 → editorServices.listFonts() 拉目录 → setFontCatalog() + ensureFont 注册
   渲染器挂载 → 从 schema 收集 fontFamily → ensureFont() → document.fonts.ready 后重排
```

- 字体文件复用现有 `main.ts` `app.useStaticAssets(uploadsDir, { prefix: '/uploads/' })` 托管，置于 `uploads/fonts/`。
- 发布态 `SchemaRenderer` 已有 `document.fonts.ready → fontEpoch` 重排机制，字体加载后自动重算文本宽度，无需改动。

### 2.2 授权判定（服务端权威）

- `assertFreeTemplateNoPaidFont(template)`：免费模板（`price===0`）若 schema 含付费字体 → 抛 `BadRequestException`（业务码 6001）。
- `assertWorkFontLicense(project, uid)`：收集 schema 中付费字体族 → 校验 `project.templateId` 指向「已购付费模板」且该模板 `paidFonts` 覆盖所用字体 → 否则抛 `BadRequestException`（业务码 6002，附缺失字体）。

### 2.3 水印与导出（服务端硬门槛）

- 编辑器预览模态框：`watermark` 为 true 时叠加 `WatermarkOverlay`（斜向平铺文字，pointer-events:none）。
- 截屏（客户端 `canvas.toDataURL`）：导出前调 `drawWatermark(ctx)` 再导出。
- 导出图片 / 视频（服务端硬门槛，新增 `ExportModule`，Phase 3）：Puppeteer 在服务端渲染，已授权→原分辨率无水印；未授权→低分辨率 + 服务端合成水印，确保无法被客户端绕过。

---

## 3. 页面与 UI 设计

- **编辑器字体选择器**：数据源 = 系统字体 + `getFontCatalog()` 动态目录；付费字体标 🔒。允许「应用到设计」以看效果（受水印保护）。
- **运营端「字体管理」页**（`admin/fonts`，与「系统设置」同级 · 分组「系统设置」，仅 ADMIN 可见）：
  列表列 = 家族名 / 显示名 / 授权（免费 · 付费 🔒）/ 分类 / 文件格式 / 排序 / 入库时间；胶囊「全部 · 免费 · 付费」；
  工具栏含「扫描目录」（`POST /api/admin/fonts/refresh`）与「清理失效」（`?prune=1`，带二次确认），
  执行后以弹窗展示本次统计（synced / scanned / free / paid / pruned / 同名冲突）并自动刷新列表。
  **上传入口（B 层）尚未实现** —— 字体文件仍由运维放入 `uploads/fonts/` 后点「扫描目录」。
- **模板详情页**：展示付费模板所含付费字体清单 + 「购买后可用」，购买接现有 `TemplateOrder` + 钱包 / 抽成。
- **预览 / 导出拦截**：未授权时预览叠加水印；发布 / 导出按钮未授权 → 拦截弹「需购买含此字体的付费模板」。

---

## 4. 组件规范

| 组件 / 工具 | 位置 | 职责 |
|------|------|------|
| `FontMeta` / `setFontCatalog` / `getFontCatalog` / `getFontMeta` | `packages/core/src/fonts.ts` | 字体目录类型与运行时缓存 |
| `ensureFont` / `ensureFontsByFamilies` | `packages/core/src/fonts.ts` | FontFace 注册（幂等） |
| `collectFontFamilies` | `packages/core/src/fonts.ts` | 从 schema 递归收集 fontFamily |
| `drawWatermark` | `packages/core/src/fonts.ts` | canvas 平铺水印 |
| `listFonts` / `getFontLicense` | `@h5design/editor` `EditorServices`（可选） | 宿主注入：拉目录 / 查授权态 |
| `WatermarkOverlay` | `packages/editor/src/components/Watermark.tsx` | 预览水印叠加层 |
| `FontController` | `apps/server/src/console/font.controller.ts` | `GET /api/fonts`（裸数组）+ `GET /api/admin/fonts`（分页/筛选）+ `POST .../refresh` |
| `FontAdminList` | `apps/admin/src/pages/fonts.tsx` | 运营端「字体管理」页：列表 + 「扫描目录」+「清理失效」 |
| `GenericListPage` | `apps/admin/src/components/GenericListPage.tsx` | 通用列表页；字体页用到新增的 `toolbarExtra`（工具栏自定义按钮）与 `searchServerField`（关键字走服务端） |

---

## 5. 数据接口定义

### 5.1 Prisma 模型改动（`apps/server/prisma/schema.prisma`）

```prisma
model Font {
  id          String   @id @default(cuid())
  family      String   @unique               // 对应 schema 元素 fontFamily
  displayName String
  files       Json                        // { woff2?, woff?, ttf? } 相对/绝对 URL
  isPaid      Boolean  @default(false)
  category    String?
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
}

model Project {
  // ...既有字段...
  templateId String?  @map("template_id")   // 来源模板（字体授权溯源）
  template    Template? @relation("ProjectTemplate", fields: [templateId], references: [id])
  @@index([templateId])
}

model Template {
  // ...既有字段...
  paidFonts  String[] @default([]) @map("paid_fonts")  // 该模板使用的付费字体 family 列表
  projects   Project[] @relation("ProjectTemplate")
}
```

### 5.2 字体目录接口

```
GET  /api/fonts                 →  Font[]（裸数组）· 编辑器 / 发布页消费
GET  /api/admin/fonts           →  后台「字体管理」列表（Refine dataProvider 消费）
                                   ?page=&pageSize= 分页 → {items,total,page,pageSize}
                                   ?family= 关键字（同时匹配 family / displayName，忽略大小写）
                                   ?isPaid=true|false 授权筛选
POST /api/admin/fonts/refresh   （ADMIN）扫描字体目录并 upsert
POST /api/admin/fonts/refresh?prune=1  （ADMIN）同上 + 删除目录与清单中已不存在的历史记录
```

> 同一控制器挂三个前缀：`['api/fonts', 'fonts', 'api/admin/fonts']`。前两个是历史调用点
> （web 走 vite proxy `/api/fonts`，运营端编辑器走 `API_URL + /fonts`）；第三个是为了让
> 后台页面的 Refine resource 名 `admin/fonts` 与后端路径一致（与 `admin/audit-logs` 等惯例对齐）。

**⚠️ 响应体有两种形状，这是刻意的（见 §9.12）**：不带分页参数返回**裸数组**（`setFontCatalog(list)`
直接消费，包一层会让字体目录整体丢空），带 `page`/`pageSize` 才返回 `{items,total,…}`。

#### 目录约定（目录即真相，无需手写清单）

```
uploads/fonts/
├── FreeFonts/          → isPaid = false（免费字体）
│   ├── DroidSerif-Bold.ttf
│   └── LobsterTwo-Bold.otf
├── LicensedFonts/      → isPaid = true（付费字体）
│   └── ALKATIP-Asliya.TTF
└── fonts.json          → 可选，仅用于补充 displayName / category / 远程 URL
```

- 判定规则：相对路径中任一段命中 `/licen|paid|收费|商用|vip/i` 即视为付费目录。
- `family` = 文件名去扩展名；同名不同格式（`x.woff2` + `x.ttf`）自动合并为同一字体的多源。
- 支持 `ttf / otf / woff / woff2 / eot / svg`；`sortOrder` 按扫描顺序自动重排。
- 递归扫描子目录，目录层级不限。

### 5.3 发布校验（既有端点前置）

| 端点 | 改动 |
|------|------|
| `POST services/:id/publish`（`provider-console.controller.ts`） | 前置 `assertFreeTemplateNoPaidFont` |
| `POST works/:id/publish`（`provider-console.controller.ts`） | 前置 `assertWorkFontLicense` |

### 5.4 错误码

| 业务码 | 含义 |
|--------|------|
| 6001 | 免费模板包含付费字体 |
| 6002 | 作品含未授权付费字体（需购买对应付费模板） |

---

## 6. 分期落地计划

| 阶段 | 目标 | 关键产出 | 状态 |
|------|------|---------|------|
| **Phase 0** | 字体元数据 + 文件托管 + 目录接口 | `Font` 模型、`Project.templateId`、`Template.paidFonts`、`GET /fonts`、`POST /fonts/refresh`、`ensureFont`、`listFonts` | ✅ 已完成 |
| **Phase 1** | 设计期可用 + 预览水印 | 字体选择器动态化（付费字体标 🔒）、`WatermarkOverlay`、`drawWatermark` | ✅ 已完成 |
| **Phase 2** | 发布硬门槛 | `font-license.ts` 判定 + 6001/6002 接入三条发布路径、`paidFonts` 写回 | ✅ 已完成 |
| **Phase 3** | 导出硬门槛 | `ExportModule`（puppeteer-core + ffmpeg）、低分辨率 + 服务端水印、渲染页 `/export-render` | ✅ 已完成 |
| **Phase 4-A** | 后台「字体管理」页（目录扫描可视化） | resource `admin/fonts` + `FontAdminList`（列表 / 扫描目录 / 清理失效）、`GET /api/admin/fonts` 分页筛选、`GenericListPage` 加 `toolbarExtra` / `searchServerField` | ✅ 已完成 |
| **Phase 4-B** | 后台上传与元数据编辑（替代「拷文件」） | `POST /api/fonts/upload`（魔数校验 + 落盘 FreeFonts/LicensedFonts）、`PATCH /api/fonts/:id`、`DELETE /api/fonts/:id` | ⏳ 待做 |
| **Phase 4-C** | 目录热更新 + 前端按需注册 | `chokidar` watch → 自动 upsert；`ensureFontsByFamilies` 由「启动全量」改「按需」，解决 95 字体 ≈ 21MB 首屏拉取 | ⏳ 待做 |

### 6.1 落地文件清单

**服务端（apps/server）**

| 文件 | 作用 |
|------|------|
| `prisma/schema.prisma` | `Font` 模型；`Project.templateId`（+`ProjectTemplate` 关系）；`Template.paidFonts String[]` |
| `src/common/font-license.ts` | 授权判定**纯函数**（非 DI）：`paidFontsInSchema` / `checkWorkFontLicense` / `assertTemplateFontRule` / `assertWorkFontLicense` / `FontLicenseException`（6001/6002） |
| `src/console/font.controller.ts` | `GET /fonts` 目录；`POST /fonts/refresh` 扫描 `uploads/fonts/fonts.json` 入库（ADMIN） |
| `src/console/provider-console.controller.ts` | `services/:id/publish` 前置 6001；`works/:id/publish` 前置 6002；付费模板发布写回 `paidFonts` |
| `src/publish/publish.service.ts` | 用户真实发布入口 `POST /api/publish/:projectId` 前置 6002 |
| `src/export/browser.ts` | 浏览器探测（Chrome/Edge，`puppeteer-core` 不下载 Chromium）+ 渲染页候选地址 |
| `src/export/export.service.ts` | 授权判定 → 颁发一次性 token → 无头渲染截图 / 逐页截图 + ffmpeg 合成视频 |
| `src/export/export.controller.ts` | `POST /api/export/prepare` / `image` / `video`、`GET /api/export/payload` |
| `src/export/export.module.ts` | 模块注册（只依赖全局 PrismaModule） |
| `uploads/fonts/fonts.json` | 字体清单（管理员填写后 `POST /api/fonts/refresh` 入库） |

**共享包（packages）**

| 文件 | 作用 |
|------|------|
| `core/src/fonts.ts` | `FontMeta` / `setFontCatalog` / `ensureFont(FontFace 幂等注册)` / `ensureFontsByFamilies` / `collectFontFamilies` / `drawWatermark` |
| `editor/src/services.ts` | 契约新增 `listFonts` / `getFontLicense` / `exportImage` / `exportVideo`（可选，未注入自动回退） |
| `editor/src/components/Watermark.tsx` | 斜向平铺水印层（预览用） |
| `editor/src/components/Panel/ComponentSettingsPanel.tsx` | 字体选择器 = 系统字体 + `getFontCatalog()` 动态目录，付费字体标 🔒 |
| `editor/src/components/Preview/PreviewModal.tsx` | `watermark?` 开关，未授权试用时叠加水印 |
| `editor/src/components/Editor/EditorApp.tsx` | 导出优先走**服务端** `services.exportImage`，失败回退本地导出；未授权时提示"已降级" |
| `editor/src/utils/download.ts` | 新增 `downloadBlob` |
| `render` | 无需改动：`document.fonts.ready` → `fontEpoch` 已能在字体加载后重排 |

**前端宿主（apps/web、apps/admin）**

| 文件 | 作用 |
|------|------|
| `web/src/pages/ExportRenderPage.tsx` | **服务端导出渲染页** `/export-render`：凭 `et` token 拉 payload → `SchemaRenderer` 渲染 → 打 `data-export-ready` 标记；水印由 payload 决定，页面无权关闭 |
| `web/src/App.tsx` | 注册 `/export-render` 路由（懒加载） |
| `web/src/api/client.ts` | `exportPrepare` / `exportImage` / `exportVideo`（二进制 Blob 通道） |
| `web|admin/src/editorServices.ts` | 注入 `listFonts` + `exportImage` / `exportVideo`；挂载时 `bootstrapFonts()` 注册字体 |
| `admin/src/pages/fonts.tsx` | 运营端「字体管理」页（列表 + 扫描目录 + 清理失效） |
| `admin/src/config/resources.tsx` | 新增 resource `admin/fonts`（layer=console，group=system，图标 `FontSizeOutlined`） |
| `admin/src/App.tsx` | 懒加载路由 `/admin/fonts` |
| `admin/src/providers/accessControlProvider.ts` | `admin/fonts` 仅 ADMIN 可见（`canSeeByRole`） |
| `admin/src/components/GenericListPage.tsx` | 新增 `toolbarExtra(ctx.reload)` 与 `searchServerField`（不改动既有页面行为） |

### 6.2 实测验证结果（2026-09-15）

```bash
cd apps/server && node node_modules/prisma/build/index.js generate   # ✔ Generated Prisma Client
cd apps/server && node node_modules/prisma/build/index.js db push    # ✔ 数据库已同步
cd apps/server && node node_modules/@nestjs/cli/bin/nest.js build    # ✔ 0 error
cd packages/core && node node_modules/typescript/bin/tsc -p tsconfig.json   # ✔ 重建 dist
pnpm typecheck                                                       # ✔ 6/6 包全部通过
```

回归门禁（`apps/server/temp/`，需 :3000 + :5173 在线）：

| 脚本 | 实测输出 |
|------|---------|
| `verify-font-work-export.cjs` | 免费字体 → `licensed:true` + 导出 **750×1334 无水印**；付费字体 → `licensed:false, missing:['ZZTestPaidFont']` + 导出 **375×667 带水印**；发布 → **400 `{code:6002}`** |
| `verify-font-template.cjs` | 免费模板含付费字体 → **400 `{code:6001}`**；改付费后发布 → **201** 且 `paidFonts` 写回 DB；未购买 → `licensed:false`；购买后 → `licensed:true` + **750×1334** + 发布 **201** |
| 视频链路（一次性验证） | `POST /api/export/video` → 201，`ffprobe`：`h264 / 750×1334 / 1.000s` |

**Phase 4-A（后台字体管理页，2026-09-15，需 :3000 + :5174 在线）**

| 验证项 | 实测输出 |
|------|---------|
| `GET /api/fonts`（不带参数） | `list / 95` —— **裸数组契约未破**（编辑器下拉不受影响） |
| `GET /api/admin/fonts?page=1&pageSize=1` | `total=95, page=1, pageSize=1, items=1` |
| `GET /api/admin/fonts?family=UKIJEs` | `total=6` → `UKIJEs, UKIJEsBold, UKIJEsC, UKIJEsN, UKIJEsQ, UKIJEsT` |
| `GET /api/admin/fonts?isPaid=true` | `total=3` → `ALKATIP-Asliya / -Kufi / -Talik` |
| `POST /api/admin/fonts/refresh`（ADMIN） | `{synced:95, scanned:95, free:92, paid:3, pruned:0, conflicts:[]}`（`维文字体.rar` 被扩展名白名单正确跳过） |
| `POST /api/admin/fonts/refresh`（无 token） | **401** |
| `apps/admin/temp/verify-font-admin-page.mjs` | **11/11 通过**：侧栏「字体管理」→ 共 95 条 / 每页 20 行 → 胶囊免费 92 · 付费 3 → 翻到第 5 页且首行 `UKIJTuzK` ≠ 第 1 页首行 → 第 5 页搜 `UKIJEs` 命中 6 条 → 详情弹窗 → 扫描目录弹真实统计。截图 `apps/admin/temp/shot-font-admin-{list,refresh}.png` |
| `apps/admin/temp/smoke-list-pagination.mjs` | **共享组件回归**：`/admin/audit-logs`、`/admin/users`、`/admin/wallets` 三页分页行为与改动前一致（期望值由页面自身 `N / M` 推导，不硬编码） |

截图证据：`apps/server/temp/artifacts/{authorized-clean-hires, unauthorized-watermark-lowres, authorized-after-purchase}.png`

---

## 7. 验收标准

- [x] 免费模板发布含付费字体 → 服务端拒（6001）。
- [x] 用户未购模板用付费字体 → 发布拒（6002）、预览 / 截屏有水印、服务端导出低分辨率 + 水印。
- [x] 用户已购模板 → 无 watermark、导出高清、发布通过。
- [x] 服务商模板用付费字体 → 正常发布、无 watermark。
- [x] 字体在编辑器 / 发布页真实加载且文本宽度正确（复用 fontEpoch）。
- [x] 导出分辨率 / 水印由**服务端**决定，客户端无法绕过（渲染页水印开关来自服务端 payload）。

## 8. 附录

- **复用基座**：`wallet` / `order` / `TemplateOrder` 做模板购买与抽成；`AssetController` + 静态托管做字体文件；`SchemaRenderer` 的 `fontEpoch` 做字体加载后重排；本机已装 `ffmpeg`（视频合成）。
- **不在范围**：字体单独售卖、按次字体扣费、字体文件签名防盗（授权绑定模板后裸链风险低，可选后续增强）；视频背景音乐混音（与发布页一致，仅画面）。

---

## 9. 实施记录与三个关键坑

实施过程中踩到并已修复的三个坑，后续改造同链路时务必注意：

### 9.1 NestJS 跨模块依赖 → 判定逻辑做成纯函数

`provider-console.controller`（ConsoleModule）、`PublishService`（PublishModule）、`ExportService`（ExportModule）三方都需要字体授权判定。若做成 `@Injectable` 服务互相注入，必须补 `imports/exports`，一旦漏配就是**启动即崩 + watchdog 反复重启**的死循环（本项目历史踩过一次：`ConsoleModule` 未导入 `PublishModule`）。

→ 结论：`src/common/font-license.ts` 一律写成**接收 `prisma` 入参的纯函数**，零 DI 风险。

### 9.2 Vite dev server 只监听 IPv6 回环 `[::1]`

现象：`curl http://localhost:5173` 返回 200，但无头浏览器访问 `http://127.0.0.1:5173` 报 `net::ERR_CONNECTION_REFUSED`。
原因：Vite dev server 监听 `[::1]:5173`（仅 IPv6），curl 解析 localhost 到 `::1` 成功，而 Chrome 优先走 IPv4 `127.0.0.1`。

→ 结论：`browser.ts` 的 `buildRenderUrls()` 同时产出 `localhost` 与 `[::1]` 两种候选地址，逐个尝试。
→ **根治（2026-09-15）**：`apps/web/vite.config.ts` 与 `apps/admin/vite.config.ts` 的 `server` 段显式加 `host: '127.0.0.1'`，让 dev server 直接监听 IPv4；`browser.ts` 默认地址也改为 `http://127.0.0.1:5173`。回退逻辑保留作为兜底。

### 9.3 渲染页 URL 上的 `token` 参数会被前端主动剥离

现象：渲染页始终报 `missing token`，`location.search` 里少了 `token`。
原因：`apps/web/src/bootstrap.ts` 出于安全，在页面加载时把地址栏上的 `token` / `user` 参数 `history.replaceState` 掉（免登令牌不残留 URL）。

→ 结论：导出凭证参数名改用非敏感名 **`et`**（export token），并同步修改渲染页读取逻辑。**不要把任何凭证命名为 `token` 放进 URL**。

### 9.4 补充：`@h5design/core` 是 dist 消费

`core` 的 `package.json` 中 `types` 指向 `src/index.ts`（类型来自源码）但 `main` 指向 `dist/index.js`（运行时来自产物）。因此**改了 core 源码必须重建 dist**，否则 TS 编译通过、运行时却 `undefined`：

```bash
cd packages/core && NODE_OPTIONS="" node node_modules/typescript/bin/tsc -p tsconfig.json
```

→ **自动化保障（2026-09-15）**：给 `packages/core/package.json` 加 `"prepare": "tsc -p tsconfig.json"`，任何一次 `pnpm install` 都会自动重建 dist，不再依赖人肉记忆。根 `package.json` 另加 `core:build` 便于手动触发。

### 9.5 同方法上分开写两个 `@UseGuards` 会导致守卫顺序颠倒（403）

现象：`POST /fonts/refresh` 带合法 ADMIN token 仍返回 `403 {"message":"需要登录后访问"}`。

原因：装饰器自下而上求值，`@UseGuards(AuthGuard('jwt'))` 与 `@UseGuards(RolesGuard)` 分两行写时，最终 guards 数组是 `[RolesGuard, AuthGuard]` —— **RolesGuard 先执行**，此时 `req.user` 尚未由 JWT 填充，角色比对拿到空用户直接抛 Forbidden。

→ 结论：必须写进**同一个** `@UseGuards(AuthGuard('jwt'), RolesGuard)`；或把 `AuthGuard` 提到类级（Nest 执行顺序为 global → controller → route，类级先于方法级）。

### 9.6 字体目录有「两套 uploads」，`process.cwd()` 不等于项目根

现象：字体放进项目根 `uploads/fonts/` 后 `POST /fonts/refresh` 返回 `scanned: 0`，且 `/uploads/fonts/xxx.ttf` 404。

原因：服务端由 watchdog 以 `cwd = apps/server` 启动，`join(process.cwd(), 'uploads')` 指向 **apps/server/uploads**（真正被静态托管的目录）；项目根的 `uploads/` 是另一个目录，服务端看不见。

→ 结论：新增 `apps/server/src/common/font-dirs.ts` 的 `resolveFontsDir()`，按 `FONTS_DIR` 环境变量 → `<cwd>/uploads/fonts` → `<项目根>/uploads/fonts` 顺序取第一个存在的目录；`main.ts` 再把它单独挂一次静态服务（`prefix: '/uploads/fonts/'`）。**两个位置放字体都能用**，但推荐统一用其中一个（本项目目前用项目根 `uploads/fonts/`，便于随仓库管理）。

### 9.7 `format('ttf')` 是非法 CSS 关键字 + URL 未加引号

现象：字体文件 200 可访问、`FontFace.load()` 也不报错，但字就是渲染不出来。

原因两条（都在 `packages/core/src/fonts.ts` 的 src 拼装里）：
1. CSS `format()` 合法关键字是 `truetype` / `opentype` / `woff` / `woff2`，**没有 `ttf`**。写 `format('ttf')` 浏览器判定为不支持的格式，**整条 src 被跳过**。
2. `url(...)` 未加引号，文件名含空格（如 `ALKATIP Asliya.TTF`）时 CSS 在空格处截断。

→ 结论：统一走 `buildFontSources()` —— 扩展名→关键字映射（`ttf→truetype`、`otf→opentype`）、URL 一律 `url("...")`、src 按 `woff2 > woff > otf > ttf` 优先级排序。

**验收方式**：仅看 HTTP 200 不够，必须在浏览器里 `new FontFace(...).load()` 后用 `measureText` 比对「该字体宽度 vs 回退字体宽度」，不同才算真的生效（见 `apps/server/temp/verify-font-catalog.cjs` 第 5 步）。


### 9.8 字体控制器路由前缀不一致 → 两端都拿不到目录（编辑器无自定义字体）

现象：服务端 `GET /fonts` 用 curl 明确返回 5 个字体，但 web 与运营端编辑器的字体下拉**只有 6 个系统字体**，界面上没有任何报错。

原因：`font.controller.ts` 写的是 `@Controller('fonts')`，而项目其它控制器（`publish`、`export`）都是 `@Controller('api/...')`。两端的请求基址不同，于是**两条路都错**，且异常都被 `bootstrapFonts()` 的 `catch` 静默吞掉：

| 端 | 请求基址 | 拼接结果 | 实际发生 |
|---|---|---|---|
| 运营端 | `API_URL = http://localhost:3000/api` | `http://localhost:3000/api/fonts` | **404** |
| web | `BASE_URL = ''`（走 vite proxy） | `/fonts` | 不在 proxy 列表（只代理 `/api`、`/uploads`、`/public`）→ dev server 返回 `index.html` → `JSON.parse` 失败 |

→ 结论：控制器改为 `@Controller(['api/fonts', 'fonts'])`（双前缀兼容既有两个调用点与旧脚本），web 的 `api.fonts()` 改为 `/api/fonts` 走代理。**排查这类「接口有数据、界面无内容」时，第一件事是打开 Network 面板看请求真实 URL 与状态码**，不要只看服务端 curl。

### 9.9 字体目录是异步的、选择器是同步渲染的 → 需显式订阅

`getFontCatalog()` 是同步读内存快照，而目录由 `listFonts()` 异步拉取。若组件只在渲染时读一次，字体回来后**没有任何 state 变化触发重渲染**，下拉里就永远只有系统字体（尤其在「先打开面板、目录后到」的时序下必现）。

→ 结论：`@h5design/core` 增加 `subscribeFontCatalog(cb)`，`setFontCatalog` 时通知；`ComponentSettingsPanel` 用 `useSyncExternalStore(subscribeFontCatalog, getFontCatalog, getFontCatalog)` 订阅。

### 9.10 `document.fonts.ready` 是一次性 Promise

`SchemaRenderer.TextElementView` 原本用 `document.fonts.ready.then(bump)` 在字体加载后重排。但该 Promise 只会 resolve 一次：**若字体是在组件挂载之后才被 FontFace 动态注册**（发布页 `/p/:code`、导出渲染页都是这种模式），它早已 resolve，不会再触发重排 → 文本一直用回退字体的宽度（表现：字变了，但字宽/换行位置不对）。

→ 结论：额外订阅 `document.fonts` 的 `loadingdone` 持续事件，并在卸载时 `removeEventListener`。

### 9.11 发布页此前完全没有字体注册逻辑（连带补齐）

排查过程中发现 `packages/render` 全包没有任何 `ensureFont` / `setFontCatalog` 调用 —— 即使编辑器里选了自定义字体，发布出去访客端也会静默回退系统字体。

→ 结论：`PublishedPage.tsx` 挂载后拉目录 + `ensureFontsByFamilies(collectFontFamilies(project))`，配合 9.10 的 `loadingdone` 自动重排。

**验收门禁**：`apps/server/temp/verify-font-picker.cjs` —— 真实浏览器登录 → 进编辑器 → 选中文本 → 断言下拉含全部自定义字体（付费带 🔒）→ 再发布作品 → 断言发布页 `document.fonts.check()` 为 true。临时作品自动删除，产物 `temp/artifacts/font-picker.png`、`published-font.png`。

### 9.12 同一接口「裸数组 / 分页对象」双契约（改前务必想清楚消费方）

背景：运营端列表统一走 Refine `useTable` → dataProvider → 后端返回 `{items,total}`；而编辑器/发布页的 `GET /api/fonts` 契约是**裸数组**：

```ts
// apps/admin|web/src/editorServices.ts
const list = await authedFetch<FontMeta[]>('/fonts');
setFontCatalog(list);           // ← 若后端改成 {items:[…]}，这里拿到对象 → 目录整体丢空
```

且 `bootstrapFonts()` 的 `catch` 会把异常**静默吞掉**，表现就是「编辑器字体下拉又只剩系统字体」，与 §9.8 的症状一模一样，极易误判。

→ 结论：`list()` 按**是否带分页参数**分流 —— 不带 `pageSize` 返回裸数组（历史契约不变），带则返回 `{items,total,page,pageSize}`。同时新增 `api/admin/fonts` 前缀承载后台消费，`/api/fonts` 语义保持不变。改这类"被多处消费的公共只读接口"时，先 `grep` 全部调用点，再看是否有 `Array.isArray(...)` 这类隐式契约。

### 9.13 给通用列表页加分页重置逻辑时，`current` 不能进依赖数组

给 `GenericListPage` 加「服务端关键字搜索」时顺手加了「改关键字回到第 1 页」：

```ts
// ❌ 错误写法：用户点「下一页」把 current 改成 2，effect 立刻再把它拉回 1 —— 分页条彻底失效
useEffect(() => {
  if (!keywordOnServer) return;
  if (current !== 1) setCurrent?.(1);
}, [keyword, current, keywordOnServer]);
```

现象很隐蔽：页码显示 `1 / 5`，表格也只有 20 行（第 1 页），点「下一页」毫无反应、也不报错。

→ 结论：用 ref 记住上一次下发的 keyword，只有**关键字真的变化**时才重置页码：

```ts
const prevKeywordRef = useRef(keyword);
useEffect(() => {
  if (!keywordOnServer) return;
  if (prevKeywordRef.current === keyword) return;   // 页码变化不重置
  prevKeywordRef.current = keyword;
  if (current !== 1) setCurrent?.(1);
}, [keyword, current, keywordOnServer]);
```

**验收门禁**：`apps/admin/temp/verify-font-admin-page.mjs` —— 真实浏览器登录 ADMIN → 侧栏断言出现「字体管理」→
列表断言「共 95 条」且每页 20 行 → 胶囊「免费 / 付费」断言服务端计数 92 / 3 →「下一页」翻到第 5 页并断言
**第 5 页首行 ≠ 第 1 页首行**（反证「分页没被静默重置」）→ 在第 5 页搜一个只存在于第 1 页的字体，断言命中 6 条
（反证「跨页搜索」）→ 详情弹窗 → 「扫描目录」弹出真实统计。实测 11/11 通过。
