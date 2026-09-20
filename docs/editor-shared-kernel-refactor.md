# 编辑器共享内核改造 + 运营端模板管理重构 开发文档

> 文档目标：把当前"web 端本地独占的编辑器"抽离为 **`@h5design/editor` 共享内核**，让 web 端与运营端共用同一套编辑器；以 **draft/live 分离（方案 A）** 为核心机制归一 Template / Project 数据流，闭合"实时改线上"的安全隐患；并完成运营端"模板管理"卡片网格与 **沙盒→闸门桥接**。
> 本文整合 2026-09-12 ~ 2026-09-13 的多轮架构讨论与用户拍板结论（含 `docs/回话历史.md` 全部脉络）。
> 状态：**v2 修订（2026-09-13）**。v2 变更：合入双角色·双制品模型、运营端画布首要场景、方案 A draft/live 字段级设计、APPROVED 再发布免审、Project 一并应用 draft/live、from-project 桥接；按代码核实修正 §5 接口与模型描述；§6 标记已落地。
> **v3 复核（2026-09-13 实施前可行性评估）**：见 §0。修正了抽核范围严重低估、admin 运行依赖缺失、API/i18n 耦合未解耦等 10 项规划缺陷；阶段 A 拆为 A0–A3 分步实施。
> **v4 实施（2026-09-13）**：**阶段 A0 / A1 / A2 已完成并验证**（web 消费路径）。`@h5design/editor` 包落地（67 文件迁入 + 8 方法 `EditorServices` 适配层 + 注入点），web 改为从包引入，`tsc --noEmit` 与 `vite build` 均 0 错误通过。
> **v5 复核（2026-09-13 延续）**：**阶段 A3（admin 挂载）+ 阶段 B（Template draft/live）已完成并验证**——admin 补 7 个运行时依赖 + Tailwind/PostCSS（preflight:false，扫描 packages/* 源码）、注册 editor/errors/publish/common 命名空间（6 语言）、`apps/admin/src/editorServices.ts` 注入运营端实现（updateProject→PUT .../draft、publish→POST .../publish、uploadAsset→/api/assets/upload、listAssets→/api/assets、getSystemMusic→/api/music/system）、宿主页 `SPTemplateEditor` 替换占位路由并加 `/dashboard→/sp/templates` 重定向；服务端 draft/live 端点（GET/PUT draft/POST publish/DELETE draft `/api/provider/services/:id[...]`）已加并 auth 冒烟通过（draft→publish 原子替换 + liveVersion+1 + APPROVED 免审）。admin `tsc --noEmit`、editor `tsc --noEmit`、`vite build` 均 0 错误。
> **v5.1 浏览器内 E2E 收口（2026-09-13）**：admin 画布浏览器内 Playwright 冒烟 **8/8 通过**（`temp/verify-editor-shared.mjs`）：画布真实渲染（Konva 挂载 antd 外壳）→ 保存→建草稿（PUT /draft，线上仍 v1）→ 发布→原子替换（POST /publish，重载 v2+草稿清空）→ 运行期无 4xx/异常。期间暴露并修复两个 pnpm 多副本真实 bug：①内核 react-router-dom@7 与 admin v6 两副本→`useNavigate` 白屏；②内核 react-i18next@17/i18next@26 与 admin 15/23 两副本→i18n 文案全回退键名。均通过 `apps/admin/vite.config.ts` 将 router/i18n 别名到 admin 单一实例（不波及 web 独立配置）。

---

## 0. 可行性评估与规划修正（v3 · 实施前复核）

> 复核方式：以 `apps/web/src` 为起点对 `components/Editor/*` 做**传递闭包分析**（脚本 `temp/editor-closure.cjs`、`temp/editor-reverse-deps.cjs`），并逐项核对 admin 依赖、i18n 实现、服务端路由语义。

| # | 缺陷 | 复核事实 | 修正 |
|---|------|----------|------|
| **D1** | **抽核范围严重低估**（致命） | 文档写"5 个文件"，实际闭包 **65 个文件**：`Editor/` + `Canvas/` + `Panel/`(PropertyPanel·PageList·LayerList·ComponentSettingsPanel·AnimationPickerDialog·ImageCropDialog) + `Preview/` + `Publish/` + `elements/*`(11 类元素的 Canvas/Property/*Shared) + `animations/*` + `store/editorStore` + `utils/*` + `hooks/useKeyboard` + `api/client` | 阶段 A 按 65 文件清单实施；拆 A0–A3 分步验证 |
| **D2** | **admin 缺 7 个运行时依赖**（致命） | 闭包外部依赖：`konva`、`react-konva`、`gsap`、`zustand`、`html-to-image`、`gifenc`、`qrcode`——`apps/admin/package.json` **一个都没有**；且 admin(i18next 23 / react-i18next 15) 与 web(26 / 17) 版本不同 | admin 补装依赖并验证版本兼容；依赖声明为 editor 包 peerDependencies |
| **D3** | **API 耦合未解耦** | 闭包内 6 类 `api.*` 调用：`uploadAsset`×8、`updateProject`×3、`createProject`、`listVersions`、`rollback`、`publish`；而 `api/client.ts` 被 web 其它 **11 处**引用，**不能直接搬** | 引入 **`EditorServices` 适配层**（宿主注入）；原方案只写 `onSave` 不够 |
| **D4** | **i18n 命名空间未对齐** | 编辑器用 `editor:*` / `common:*` **冒号命名空间**（27 处 react-i18next）；admin 的 `t()` 走自身 i18next 实例且未注册这些命名空间 → 直接挂载会全部回退成键名 | admin 必须注册 `editor`/`common` 命名空间资源 |
| **D5** | **与 web 非编辑器代码共用的文件不能整搬** | `utils/share.ts`（ProjectList/PublishedPage 用）、`components/Preview/DOMRenderer.tsx`（PublishedPage 用）、`elements/*Shared`（DOM* 变体用） | 明确归属：随包搬迁 + web 侧改引用；`share` 走适配层 |
| **D6** | **接口语义需钉死** | `GET/PATCH /api/provider/services/:id` 操作的**就是 Template 表**（`authorId` 作用域，`provider-console.controller.ts:161/342`），**不是** catalog 的"双表归一" | 显式标注：`services/:id` 仅接受 **Template id**；Project 草稿走 Project 侧接口，防止误传 Project id |
| **D7** | **遗留死代码未标注** | `components/Panel/LeftPanel.tsx`（及 `MaterialPanel`/`LayerPanel`/`BackgroundPanel`/`PageBar`）**无任何引用**，但仍 import `editorStore` | 标注"不随迁/后续清理"；搬迁时仅修正其 import |
| **D8** | **依赖倒置风险** | `elements/*Shared` 同时被 Canvas*（编辑器侧）与 DOM*（发布页渲染侧）使用；整搬进 editor 包会让 web 发布页反向依赖 editor 包 | 短期：随包搬迁 + web 的 DOM* 改为从包引入（保单一事实源）；长期：下沉到 `@h5design/render` |
| **D9** | **构建方式可复用** | `packages/*` 已在 pnpm workspace；`@h5design/render` 采用 **src 直连**（main→src/index.ts，无 dist）→ editor 同法 | 照搬 render 的 package.json/tsconfig 模板 |
| **D10** | **阶段 A 风险集中** | A 是一次性搬迁 65 文件，风险最高且阻塞 B/C | 拆为 A0 骨架与契约 → A1 搬迁+导入重写 → A2 web 回归 → A3 admin 挂载 |

**结论**：原方案的**架构判断（共享内核 + draft/live + 双制品）成立**，但**实施颗粒度与依赖清单不可执行**。按上表修正后按 A0→A3 推进。

---

## 1. 背景与问题

### 1.1 当前事实（已核实）

- **编辑器是 web 端本地模块**，并未共享：入口 `apps/web/src/components/Editor/EditorApp.tsx`（42KB）；**其真实传递闭包为 65 个文件**（见 §0-D1 与 §7 清单），远超 v2 文档假设的"同目录 5 文件"。
- **`@h5design/render` 只有渲染器 + 纯函数**：`SchemaRenderer` / `SchemaThumbnail` / `PublishedH5`、颜色与消毒函数（`safeLink` / `safeMedia` / `safeBackgroundImage` / `sanitizeEmbedHtml`）、元素级 helper、`normalizeSchema`。它**没有**交互式编辑器。
- **web 端客户定制链路已存在**：`/templates`（TemplateList）→ `POST /api/templates/:id/use` 克隆模板为 Project → `/editor/:projectId` 编辑 → `POST /api/publish/:projectId` 发布得 `publishCode` → `/p/:publishCode` 只读。
- **运营端"模板管理"已是卡片网格**：`apps/admin/src/pages/providerPages.tsx` 的 `TemplatesList`（`gridCard` + `TemplateCard`，资源 `provider/catalog` 合并 `Template`+`Project`）；卡片「编辑」按钮已指向 `/sp/templates/:id/editor`，但该路由目前是 `PlaceholderPage`（"即将上线"占位，`App.tsx:206`）。
- **数据模型两张表独立**：`Template`（`authorId String?`、状态 `PENDING/APPROVED/REJECTED/TAKEN_DOWN`、`schema`、`category String`（必填）、`price` 分、`currency`、`useCount`、`tags`、`isOfficial`、审核留痕 `reviewNote/reviewedBy/reviewedAt`）与 `Project`（`userId`、`status` `draft/published`、`publishCode`、`schema`、`viewCount`、`version`）。
- **已核实的同源隐患**：`publishService.getPublished`（`publish.service.ts:42-58`）**直读 `Project.schema`**——发布后客户继续编辑即实时改线上 `/p/:code`，Project 侧隐患与 Template 侧同源，本方案一并闭合。

### 1.2 暴露的问题

1. **缺少发布闸门**：服务商"设计/发布 Template"职责在运营端（业务管理台），但当前 web 端编辑保存即写生效数据。**web 编辑本身是合法的创作沙盒，缺陷不在"编辑放错了地方"，而在缺少 draft/live 分离与发布闸门**。
2. **编辑器不可复用**：运营端要做服务商创作，只能"跨应用跳 web 端编辑器"（会话/作用域风险）或在 admin 再写一套（双份维护、schema 漂移）。
3. **安全隐患根因**：设计态直接改动线上在售内容（Template 与 Project 两侧同源）、schema 缺统一校验/消毒、跨应用作用域传递——这些是缺少统一编辑/保存闸门与 draft/live 机制的结果。
4. **运营端画布缺位**：已发布 Template 的缺陷修复无画布可用（路由为占位页），被迫回 web 端改母版，作用域错乱。

### 1.3 新需求（触发决策）

客户在 web 端模板库选模板 → 进入编辑态 → 改邀请文本/图片/音乐/组件等。这说明 **web 端也需要编辑器**（客户定制），与运营端（服务商创作/修复）形成**两个编辑场景**，进一步证明"只在某一端放编辑器"不可行——正确解法是共享内核 + 各端编辑各自制品。

---

## 2. 设计决策（用户 2026-09-13 拍板，共 7 条）

| # | 决策 | 说明 |
|---|------|------|
| 1 | 客户定制保存后**沿用现有 `Project`**（即 `useTemplate` 克隆模式） | 不新立模型，客户实例 = 克隆自 Template 的 Project |
| 2 | 运营端服务商创作的 **`Template` 即 web 端模板库直接展示的那张表** | 同一张表，否则客户看不到服务商发布的作品 |
| 3 | 共享包命名用新建 **`@h5design/editor`** | 读写分层清晰：`render` 只负责"读"，`editor` 负责"写" |
| 4 | **双角色·双制品模型** | web = 创作沙盒（服务商编辑个人 Project 草稿，体验不退化）；运营端 = 发布闸门（Template 母版，独有发布/上下架权）。两处编辑共用同一内核但编辑不同制品，杜绝双写冲突 |
| 5 | **运营端画布必须做**，首要场景 = **修复/优化已发布的 Template 设计** | APPROVED 模板归运营端管，不为修缺陷跳回 web；从零创作仍以 web 沙盒为主 |
| 6 | **方案 A：draft/live 分离** | 保存先落 `draftSchema` 草稿字段/版本号，发布才原子替换线上 `schema`。编辑永不直写线上字段 |
| 7 | **APPROVED 模板再次发布草稿免审直接替换**；**Project 一并应用 draft/live** | 首次上架仍走管理员审核流；Project 发布后编辑同样走草稿，重新发布才替换 |

### 2.1 关键澄清（写入文档以防误解）

- **"共享内核"当前不存在**，需从 web 端 `EditorApp` 抽离，而非改造 render 包里的现有代码。
- **"前后端都能调用"的"后端"指运营端前端（admin app），不是 NestJS 服务**。编辑器是纯前端组件，服务端只接收"保存后的 schema JSON"。共享内核 = 两个前端 app 都 `import` 同一组件，各自接自己的保存 API。
- **draft 字段回退语义**：`draftSchema` 为可空列。编辑器加载一律 `draftSchema ?? schema`；存量数据 `draftSchema = null` 自动回退线上 schema，**零迁移、零回填**。发布动作 = 单条 UPDATE 原子替换 `schema = draftSchema` 并清空草稿。

---

## 3. 目标架构

```
┌──────────────────────────┐        ┌───────────────────────────┐        ┌──────────────────────────────┐
│   web 端 (apps/web)      │        │  @h5design/editor (新)     │        │ 运营端 (apps/admin)          │
│ ① 客户定制 /editor/:pid  │─import─▶ 共享编辑器内核              │◀─import─ │ ② 服务商画布 /sp/templates/  │
│   编辑 Project（沙盒）    │        │ 画布/元素面板/属性面板/     │        │    :id/editor 编辑 Template  │
│ ③ 服务商沙盒 /dashboard  │        │ 撤销重做/schema 校验消毒    │        │    （发布闸门·修复母版优先）  │
└─────┬──────────┬─────────┘        └────────────┬──────────────┘        └──────────┬───────────────────┘
      │ initialSchema=draftSchema??schema       │ 持久化无关                        │
      ▼                                          ▼                                   ▼
 PUT /api/projects/:id (写 draftSchema)   复用 @h5design/render 的      PUT /api/provider/services/:id/draft
 POST /api/publish/:projectId             safeLink/sanitizeEmbedHtml    POST /api/provider/services/:id/publish
 (发布=draft→schema 原子替换)             (双闸口消毒)                  (APPROVED 免审原子替换 / 其余走审核)

  ③─from-project 桥接─▶ POST /api/provider/from-project：Project 快照 → Template(PENDING) → 运营端补元数据+上架
  ①─useTemplate 只消费 Template 线上 schema（克隆为独立快照，后续 Template 发新版不影响存量客户）
```

### 3.1 数据流归一

- **Template = 母版**：状态机 `PENDING(待审) → APPROVED(上架) → TAKEN_DOWN(下架)`（REJECTED 分支）保持不变；**schema 替换动作独立于状态机**。首次上架走管理员审核；APPROVED 后再次发布草稿**免审直接替换**（决策 7）。保存永远写 `draftSchema`，发布才原子替换线上 `schema`。
- **Project = 客户个性化实例**：web 端模板库选 Template → `useTemplate` 克隆 → 客户用共享内核改（写 `draftSchema`）→ 发布（`draftSchema → schema` 原子替换）→ `/p/:publishCode` 只读成品。
- **沙盒→闸门桥接**：服务商在 web 沙盒的创造成果（Project）经"提交发布"（`from-project`）生成 `Template(PENDING)`，到运营端补元数据+上架；**事实源唯一 = Template**。
- **存量客户不受影响**：客户 Project 是 useTemplate 时的独立快照；Template 发新版后新客户拿新版，存量客户继续用旧快照。
- 结论：web 端模板库展示的正是运营端服务商发布的 Template（决策 2 保证同一张表）。

### 3.2 安全收益

单一内核 = 单一 schema 校验/消毒入口（直接复用 render 包已有的 `safeLink`/`sanitizeEmbedHtml`）。**draft/live 分离从"叠加项"升级为本方案核心机制**：**编辑永不直写线上字段**——Template 侧编辑写 `draftSchema`、发布原子替换；Project 侧同理。叠加 `subjectId`/`authorId` 作用域强校验与发布时二次消毒（草稿/发布双闸口），系统性闭合 1.2 的全部隐患。

---

## 4. 改造范围与阶段

| 阶段 | 内容 | 关键产物 | 风险 |
|------|------|----------|------|
| **A0 骨架与契约 ✅** | 建 `packages/editor`（照搬 render 的 src 直连模板）；定义 **`EditorServices` 适配层**（`uploadAsset/updateProject/createProject/listVersions/rollback/publish/getSystemMusic/listAssets`）；admin 补装 `konva,react-konva,gsap,zustand,html-to-image,gifenc,qrcode` | 包与契约就位（8 方法 + 未注入报错）；**零行为变化** | 低 |
| **A1 搬迁 ✅** | 67 文件（含 `elements/*Shared`、`utils/*`、`hooks/*`）按目录结构迁入 `packages/editor/src`，导入重写（`@/x` → 相对路径）；`api.*` 改为 `services.*` 注入；`share`/`utils/download` 走适配层；补 `gifenc.d.ts` + `vite-env.d.ts` | 内核就位（`tsc` 0 错） | 高（一次性大改） |
| **A2 web 回归 ✅** | web 改为从 `@h5design/editor` 引入（含 `pages/Editor.tsx`、`SiteHeader`、`DOM*`、`PublishedPage`、`Panel/*`）；`apps/web/src/editorServices.ts` 注入 web 侧 `EditorServices`；`tsc --noEmit` + `vite build` 通过 | **web 行为零变化（不退化承诺）已验证** | 中 |
| **A3 admin 挂载 ✅** | admin 注册 `editor`/`errors`/`publish`/`common` i18n 命名空间（6 语言）；补 7 个运行时依赖 + Tailwind/PostCSS（preflight:false，扫描 packages/* 源码）；占位路由换宿主页 `SPTemplateEditor`；`/dashboard→/sp/templates` 重定向；画布冒烟 | admin 可用内核 | 中 |
| **B 运营端画布 + Template draft/live ✅** | 宿主页 `SPTemplateEditor`（`loadProject(draftSchema ?? schema, id)`→`<EditorApp/>`）；顶栏「线上版本 v{n}」+「存在草稿」徽标 + 放弃草稿；服务端 `GET/PUT(draft)/POST(publish)/DELETE(draft) /api/provider/services/:id[...]` 已加并 auth 冒烟通过 | 运营端画布编辑器 + draft/live 闭环 | 中 |
| **C Project draft/live** | web 编辑器保存改写 `draftSchema`；`POST /api/publish/:projectId` 扩展为原子替换；版本历史"恢复"落草稿 | 客户发布后编辑不再实时改线上 | 中 |
| **D 沙盒→闸门桥接**（原"web 入口收敛"已**作废**，与"不退化"承诺冲突） | web 服务商作品页加"提交发布"→ `POST /api/provider/from-project` → `Template(PENDING)` → 运营端补元数据+上架 | 创作事实源唯一化（Template） | 低 |
| **E 校验消毒统一** | 内核层统一 schema 校验/消毒，复用 render 消毒函数；草稿与发布**双闸口**（发布时再次消毒） | 单一校验闸门 | 低 |
| **并行：卡片网格化** | **已落地**（见 §6）；残余项仅为占位页 → 真实画布（归阶段 B） | — | — |

> 建议执行顺序：A → B + C → D → E（E 的消毒调用点随 A/B 落地，收口在 E 验证）。A 必须最先完成，否则 B/C 无内核可用。

---

## 5. 数据模型与接口契约

### 5.1 模型：现有结构 + 方案 A 新增字段

现有 `Template` / `Project` 结构**不动**，仅增量新增草稿字段（可空列，db push 零回填）：

```prisma
model Template {
  // ……现有字段（id/authorId?/name/category/status/cover/schema/price/currency/
  //    useCount/tags/isOfficial/reviewNote/reviewedBy/reviewedAt/createdAt）
  draftSchema   Json?      // ★ 新增：编辑草稿（保存落这里，不碰 schema）
  draftUpdatedAt DateTime?  // ★ 新增：草稿最后保存时间（徽标展示用）
  liveVersion   Int @default(1) // ★ 新增：线上版本号（发布 +1）
}

model Project {
  // ……现有字段（id/userId/title/cover/status/publishCode/schema/viewCount/version/createdAt）
  draftSchema   Json?      // ★ 新增：编辑草稿；编辑计数复用既有 version 自增
}
```

### 5.2 接口契约

**已存在、直接复用（路径以代码为准）**：

- `GET /api/provider/catalog`（`provider-console.controller.ts`）：合并 `Template(authorId)` + `Project(userId)`，支持 `?kind=template|work`、`?page&pageSize`、按 `createdAt` 倒序。catalog select 需补 `draftSchema/liveVersion` 供卡片角标。
- `GET /api/provider/works/:id`：作品详情（SELF 作用域）。
- `PATCH /api/provider/services/:id`：服务商侧**唯一**的模板元数据更新接口（只写元数据 + `schema.meta` 合并，不支持整设计 schema 写入；见下方"已知小口径"）。
- `GET /api/templates/mine`、`POST /api/templates`、`PATCH status`：模板创建/状态流转（运营端上架复用；**注意：`PUT /api/templates/:id` 不存在**）。
- `POST /api/templates/:id/use`：客户克隆模板为 Project（useTemplate 链路，逻辑保持不变）。
- `GET/POST /api/projects`、`PUT /api/projects/:id`、`POST /api/publish/:projectId`、`DELETE /api/publish/:projectId`、`GET /api/publish/p/:code`：客户定制/发布链路。

**待实现（阶段 B/C/D 新增接口规格）**：

| 方法与路径 | 作用域 | 语义 |
|------------|--------|------|
| `PUT /api/provider/services/:id/draft` | SELF | 保存草稿：写 `draftSchema` + `draftUpdatedAt`，**不碰线上 schema** |
| `POST /api/provider/services/:id/publish` | SELF | 发布：**单条 UPDATE 原子替换** `schema = draftSchema`、`liveVersion + 1`、`draftSchema = null`。仅 APPROVED 免审直接替换；其余状态提示走既有审核流 |
| `DELETE /api/provider/services/:id/draft` | SELF | 放弃草稿：清空 `draftSchema/draftUpdatedAt` |
| `POST /api/provider/from-project` | SELF | 沙盒桥接：Project 快照 → `Template(PENDING)`，入参 `name/category/price`（快照 schema 经消毒） |

**Project 侧扩展（改造现有接口，不新增路径）**：

- 编辑器保存改传 `draftSchema`：`PUT /api/projects/:id` dto 增加可选 `draftSchema` 字段，`version` 继续自增作编辑计数。
- `POST /api/publish/:projectId` 扩展：发布时执行 `draftSchema → schema` 原子替换并清草稿；`getPublished` **不动**，仍只读线上 `schema`。
- 回滚语义调整：`ProjectVersion` rollback 改为"恢复到草稿"（写 `draftSchema`），**不直改线上**；是否发布仍由用户显式触发。

> **已知小口径**：`PATCH /api/provider/services/:id` 合并 `schema.meta` 属元数据编辑（非设计 schema），维持直改可接受；阶段 B 顺带评估是否收敛进 draft 闸门。

---

## 6. 已落地：运营端"模板管理"卡片网格

`TemplatesList` 已完成从 `GenericListPage` 表格到卡片网格的改造（`providerPages.tsx:469`，`gridCard` + `TemplateCard`）：

1. **卡片网格**：复用 web `WorkCard` 范式（来源标签 + 封面 + 信息区 + hover 操作）。✅
2. **信息区常驻字段**：模板名称、分类、价格（`price` 分→¥）、使用次数（`useCount`）、状态中文胶囊。✅
3. **hover「详情 / 编辑」并排**：详情 = `SPTemplateDetail`（元数据表单）；编辑 = `/sp/templates/:id/editor`。✅（按钮已指向该路由）
4. **过滤**：全部 / 模板 / 作品 chip 过滤 + 来源 Pill。✅
5. **残余项**：该路由现为 `PlaceholderPage`（"即将上线"占位）→ 归阶段 B 替换为真实画布宿主页；卡片可增"有未发布草稿"角标（消费 `draftSchema/draftUpdatedAt`）。

---

## 7. 关键文件清单

### 新建
- `packages/editor/package.json`、`packages/editor/tsconfig.json`（workspace 已含 `packages/*`）
- `packages/editor/src/index.ts`（导出 `EditorApp`、`useEditorStore` 适配、类型）
- `packages/editor/src/{Canvas,ElementPanel,PropertyPanel,UndoRedo,schemaIO,sanitize}.tsx`
- `apps/admin/src/pages/providerEditorPages.tsx`（`/sp/templates/:id/editor` 宿主页）

### 修改（路径已逐一核实）
- `apps/server/prisma/schema.prisma`：Template 加 `draftSchema/draftUpdatedAt/liveVersion`，Project 加 `draftSchema`（4 字段，可空增量）
- `apps/server/src/console/provider-console.controller.ts`：draft/publish/from-project 三组接口；catalog select 补 `draftSchema/liveVersion`
- `apps/server/src/project/project.service.ts` + `apps/server/src/project/dto/create-project.dto.ts`：`draftSchema` 字段、rollback"恢复到草稿"语义
- `apps/server/src/publish/publish.service.ts`：publish 时草稿→线上原子替换（`getPublished` 仍只读 `schema`）
- **`apps/web/src` 闭包 65 文件 → `packages/editor/src`**（脚本 `temp/editor-closure.cjs` 产出，按目录分组）：
  - `components/Editor/`（5）、`components/Canvas/`（4）、`components/Panel/`（6：PropertyPanel·PageList·LayerList·ComponentSettingsPanel·AnimationPickerDialog·ImageCropDialog）
  - `components/Preview/`（3）、`components/Publish/PublishModal.tsx`、`components/UI/`（6）、`components/ErrorBoundary.tsx`
  - `elements/`（含 11 类元素的 `Canvas*`+`Property*`+`*Shared`+`registry`）、`animations/`（4）
  - `store/editorStore.ts`、`hooks/useKeyboard.ts`、`utils/{image,exportVideo,konvaVideoExport,share,audioCapture}.ts`
  - **不随迁**：`api/client.ts`（改由 `EditorServices` 注入）、`components/Panel/LeftPanel.tsx` 及 `MaterialPanel/LayerPanel/BackgroundPanel/PageBar`（死代码，仅修 import）
- `apps/web/src/pages/Editor.tsx`：薄封装，`initialSchema = draftSchema ?? schema`
- `apps/web/src/api/client.ts`：核对 useTemplate 路径 `/api/templates/:id/use` 与 publish 路径 `/api/publish/:projectId`（现调用已一致）
- `apps/admin/src/App.tsx`：`:206` 占位路由换宿主页；补 `/sp/templates/new`
- `apps/admin/src/pages/providerPages.tsx`：TemplateCard hover 编辑不变；可加"有未发布草稿"角标
- `apps/admin/src/pages/providerDetailPages.tsx`：`SPTemplateDetail` 补"提交发布/上架"入口
- `packages/render/src/index.ts`：保持只读；editor 直接依赖 render 复用消毒函数

### 复用（不改）
- `apps/server/src/template/*`（`template.controller/service`：审核流、购买、`useTemplate` 全不动）
- `@h5design/render` 的 `safeLink` / `safeMedia` / `sanitizeEmbedHtml` / `SchemaThumbnail` / `normalizeSchema`

---

## 8. 详细实施步骤

### 阶段 A0 — 骨架与契约 ✅（已完成）
1. ✅ 照搬 `packages/render` 建 `packages/editor`（`main/types/exports` → `src/index.ts`，src 直连、无 dist）；peerDependencies 声明 `react/react-dom/react-i18next/react-router-dom`，dependencies 含 `konva/react-konva/gsap/zustand/html-to-image/gifenc/qrcode/@h5design/core/@h5design/render`。
2. ✅ 建 `packages/editor/src/services.ts`：**`EditorServices` 适配层**——`uploadAsset / updateProject / createProject / listVersions / rollback / publish / getSystemMusic / listAssets`。惰性 `Proxy` 实现支持"导入后注入"；未注入调用抛明确错误；宿主启动时 `setEditorServices({...})` 注入。
3. ⏳ `apps/admin/package.json` 补装 7 个运行时依赖并 `pnpm install`（A3 前完成即可）——**未做，归 A3**。

### 阶段 A1 — 搬迁与导入重写 ✅（已完成）
1. ✅ 按闭包清单把 **67 个文件**按目录结构迁入 `packages/editor/src/`（含 `elements/*Shared`、`utils/{audioCapture,exportVideo,image,konvaVideoExport}`、`hooks/useKeyboard`、`store/editorStore`、`components/Preview/DOMRenderer`），保留相对层级。
2. ✅ 脚本化重写导入：`@/xxx` → 包内对应相对路径；外部包名保持不变。
3. ✅ 闭包内 `api.*` 调用点改为 `services.*`；`@/utils/share` 走 `services`/`utils/download`；`MusicManagerModal` 的 `api.getSystemMusic()/listAssets()` 改走 `services.*`（接口已补 2 方法）。
4. ✅ `packages/editor/src/index.ts` 导出 `EditorApp`、`SettingsPanel`、`PublishModal`、`PreviewModal`、`PropertyPanel`/`PageList`/`LayerList`/`ComponentSettingsPanel`、`DOMRenderer`/`PublishedH5`、`useEditorStore`、`EditorServices` 类型、`elements/registry` 与 `elements/*Shared` 共享逻辑。
5. ✅ 补 `packages/editor/src/gifenc.d.ts` 与 `vite-env.d.ts`（声明 `import.meta.env`），使包可独立 `tsc`。

### 阶段 A2 — web 回归（不退化）✅（已完成）
1. ✅ `apps/web/src/pages/Editor.tsx` 改为从 `@h5design/editor` 引入 `EditorApp`/`useEditorStore`；`apps/web/src/editorServices.ts` 注入 web 侧 `EditorServices`（`api` 适配 + `getSystemMusic`/`listAssets`）。
2. ✅ 修正其余引用方 import：`SiteHeader`、`components/Panel/*`、`elements/*/DOM*`（5）、`pages/PublishedPage.tsx`（DOMRenderer）、`utils/exportVideo.ts`（已随迁，web 端副本删除）。
3. ✅ 验证：`apps/web` `tsc --noEmit` 0 错误；`vite build` 518 模块成功（exit 0）；`packages/editor` 独立 `tsc --noEmit` 0 错误。**web 行为零变化（不退化承诺）已验证。**

### 阶段 A3 — admin 挂载 ✅（已完成）
1. admin 注册 `editor`/`errors`/`publish`/`common` i18n 命名空间资源（6 语言，否则全部回退键名，见 §0-D4）。
2. `App.tsx` 占位路由换宿主页 `SPTemplateEditor`（`apps/admin/src/pages/providerDetailPages/SPTemplateEditor.tsx`），注入 admin 侧 `EditorServices`（`apps/admin/src/editorServices.ts`：草稿保存/发布走 `services/:id/draft|publish`）。
3. 画布冒烟：admin `tsc --noEmit` + `vite build`（含 Tailwind 生成内核 atomic class，CSS 34.9kB）0 错误；内核可自行加载/保存草稿。
4. **浏览器内 E2E 收口（v5.1）**：`temp/verify-editor-shared.mjs` Playwright 8/8 通过——修复 pnpm 多副本导致的两真实 bug：router 多副本白屏（`useNavigate` 拿不到 Router Context）、i18n 多副本文案回退键名；均在 `vite.config.ts` 用 alias 强单一实例（router/i18n 指向 admin 视角，不影响 web）。

### 阶段 B — 运营端画布 + Template draft/live ✅（已完成）
1. 宿主页 `SPTemplateEditor`：取 Template（`GET /api/provider/services/:id`，SELF/ADMIN 作用域）→ `loadProject(draftSchema ?? schema, id)` → `<EditorApp/>`（EditorApp 无 props，内部从 store 读 projectId）。
2. 顶栏展示「线上版本 v{n}」+「存在草稿」徽标（`draftSchema`）；动作：**放弃草稿**（`DELETE /api/provider/services/:id/draft` 后重载画布）。
3. 发布 = `POST /api/provider/services/:id/publish`：单条 UPDATE 原子替换（`schema=draftSchema`、`liveVersion+1`、清草稿），**useTemplate 读取线上 schema 无中间态**；APPROVED 免审直接替换（auth 冒烟已验证 T-1011：draft→publish 后 live 变 marker、draft 清空、liveVersion 2），其余状态提示走审核流。
4. `App.tsx` 占位路由已换宿主页；内核 `handleBack`→`navigate('/dashboard')` 经 `Route path="/dashboard" element={<Navigate to="/sp/templates"/>}` 重定向回模板列表。
5. `SPTemplateDetail` 补"提交发布/上架"入口为后续项（与画布发布共用同一 publish 端点）。
6. **浏览器内闭环已验证（v5.1）**：Playwright 实测保存→草稿徽标出现且线上仍 v1、发布→重载顶栏 v2+草稿清空，与 auth 冒烟结论一致。

### 阶段 C — Project draft/live ✅（已完成 · 2026-09-13）
1. web 编辑器"保存"重定向到草稿：`editorServices.updateProject` → `api.saveProjectDraft` → **新增** `PUT /api/projects/:id/draft`（`project.controller` + `project.service.saveDraft`），只写 `draftSchema`（`project.schema` 不动）；`snapshot` 为真时落 `projectVersion`（保留最近 30 份）。
2. `findOne` 加载返回 `draftSchema ?? schema` + `hasDraft` 标记，画布打开即草稿态；`publish.service` 发布时 `draftSchema → schema` **原子替换** + `draftSchema: Prisma.DbNull` 清空 + `version+1`；首次发布生成 `publishCode`（8 字符 hex），重复发布沿用旧码；`/p/:code` 只读线上 `schema` 不变。
3. `VersionHistoryModal`"恢复"落草稿（写 `draftSchema`）待阶段 E 顺带收敛，本阶段未动。

### 阶段 D — 沙盒→闸门桥接 ✅（已完成 · 2026-09-13）
1. 服务端 **新增** `POST /api/provider/from-project`（`provider-console.controller`，`@Roles('SERVICE_PROVIDER','ADMIN')` + `RolesGuard`，SELF 作用域：须 `project.userId===req.user.id` 或 ADMIN）：取 `draftSchema ?? schema` 快照 → `template.create({ status:'PENDING', authorId:uid, ... })`；入参 `name/category/tags/price/cover`。
2. web `api.submitAsTemplate(projectId,{name,category,...})` + `ProjectList.tsx`：`WorkCard` 新增 `onSubmitTemplate`/`canSubmit` props，作品 hover 操作区加紫色「提交为模板」按钮（仅 `isProvider` 可见），页面末尾提交弹窗（名称/分类）→ 成功 `alert(submitTplSuccess)` + 刷新列表。
3. 6 语言 `errors.json`（`dashboard` 段）补 `submitTplTitle/Name/Category/CategoryPh/Confirm/Success/Failed` + `submitAsTemplate` 共 8 key；web `tsc --noEmit` exit=0。

### 阶段 E — 校验消毒统一（双闸口）✅（已完成 · 2026-09-13）
1. **单一事实源**：消毒逻辑集中在 `@h5design/core/src/sanitize.ts`（纯 TS、同构），导出 `safeLink`/`safeMedia`/`safeBackgroundImage`/`sanitizeEmbedHtml`/`sanitizeSchema`/`looksLikeEmbedCode`。`packages/render` 与 `apps/web` 改为从 core 重新导出（web 旧 `utils/sanitize.ts` 去重为 re-export）。
2. **消毒覆盖字段**：`image.src`/`video.src`(整段 iframe/embed 走 `sanitizeEmbedHtml`)/`video.poster`/`gallery.images[]`/`puzzle.images[]`/`button.link`(→`safeLink`)/`page.backgroundImage`(→`safeBackgroundImage`)；`page.background` 是**颜色**走 `parseCssColor`，**不**进 `safeBackgroundImage`（避免清空背景色）。
3. **草稿闸口（写库前）**：内核 `EditorApp.saveProject` 在写库前 `sanitizeSchema(project)`；服务端 `project.service.saveDraft` 与 `update` 同样在落库前 `sanitizeSchema`（防御 web 未消毒或越权直写）。
4. **发布闸口（原子替换前）**：`publish.service.publish` 在 `prisma.project.update` 前 `sanitizeSchema(nextSchema)` 且 `cover: safeMedia(project.cover)`，杜绝只读页 XSS 与渲染崩。
5. **同构 HTML 清洗**：浏览器用 `DOMParser` 完整清洗并移除整节点；Node（服务端无 DOM）用正则兜底——修复了原正则只删开标签残留孤儿 `</iframe>` 的 bug，并追加剥离 `srcdoc`（`window.DOMParser` 路径本就移除）。修复后 `sanitizeEmbedHtml('<iframe src="javascript:">')=''`、合法 https iframe 保留、`<video>` 无 src 时保留 `<source>` 子节点。
6. **版本回滚收敛**：`project.service.rollback` 改为写 `draftSchema`（方案 A：恢复→草稿而非覆盖线上），返回 `{ id, schema }`；`VersionHistoryModal` 读取 `res.schema` 重新 `loadProject` 与之兼容。
7. **模板侧（admin/服务商闸门）一并收敛**：`provider-console.controller.ts` 的 `createService`/`saveServiceDraft`/`publishService`/`updateService`(cover)/`from-project` 全部在写库前 `sanitizeSchema`（封面 `safeMedia`），与 Project 侧对称——杜绝管理端模板预览/发布页 XSS（原仅 Project 侧有闸口，模板侧 `publishService`/`saveServiceDraft` 直写未消毒，属遗留缺口）。

### 验证
- server `nest build` exit=0；web `tsc --noEmit` exit=0；core `tsc -p tsconfig.json` exit=0（Phase E 全绿）。
- **阶段 C/D/E 后端冒烟（`temp/smoke-phase-c.cjs` / `smoke-phase-d.cjs` / `smoke-phase-e.cjs`）均 PASS**：
  - Phase C：登录 USER→建 Project→`PUT /draft`→加载返回 `draftSchema+hasDraft=true`→`POST /publish`→线上 `schema` 原子替换 + 草稿清空 + `publishCode` 生成。
  - Phase D：登录 SP→建 Project→`POST /from-project`→`template.status=PENDING` 且 `authorId` 正确。
  - **Phase E（双闸口）**：单元断言 `safeLink/safeMedia/safeBackgroundImage/sanitizeEmbedHtml/sanitizeSchema` 对 `javascript:`、`<iframe src="javascript:">`、`<iframe onload>` 均清空；HTTP 验证 `PUT /draft` 落库草稿已消毒 + `POST /publish` 后 `/api/p/:code` 只读 schema 同消毒，且合法 `player.bilibili.com` 嵌入 iframe **保留**。新增 `temp/smoke-phase-e-templates.cjs` 覆盖模板侧 `createService`/`saveServiceDraft`/`publishService`/`updateService(cover)`/`from-project` 双闸口，均 PASS。
- **Playwright 覆盖（阶段 E 一部分）**：新增 `apps/web/e2e/playwright.config.ts` + `apps/web/e2e/phase-e-safety.spec.ts`，覆盖「只读页 /p/:code 不渲染任何 XSS 向量（无 `<script>`、无 `on*` 处理器、iframe 不含 `javascript:`、合法嵌入保留）+ 草稿→发布链路打通」。前置：先起 server(:3000) + `npx playwright install chromium` + `playwright test`（本沙箱未装浏览器二进制，故以 API 冒烟为权威验证）。
- **admin 发布分享链接修复（#95）**：`editorServices.publish` 返回 `publishCode`+`url`（`/sp/templates/:id/editor`），`PublishModal.fullUrl` 优先用 `result.url`；admin 浏览器内 E2E 10/10（含分享链接不再 `/p/undefined`，见 §9c v5.2）。

---

## 9. 安全与质量保障

- **作用域**：沿用 `subjectId(req, subject)` / `authorId` 强校验（SELF），确保只改自己的 Template/Project。
- **draft/live 分离（核心机制）**：编辑永不直写线上字段；Template 与 Project 两侧统一。
- **schema 双闸口**：草稿保存 + 发布动作双重消毒，内核层统一 `normalizeSchema` + render 消毒函数。
- **类型/构建**：`apps/web` `tsc --noEmit` 0 错；`apps/admin` `tsc --noEmit` 0 错；`apps/server` `nest build` exit 0。
- **端到端**：Playwright 脚本（扩展 `apps/admin/temp/` 现有 verify 系列 / 新增 `verify-editor-shared.cjs`）覆盖：卡片网格来源列、hover 详情/编辑、运营端画布草稿→发布原子替换、web 客户定制草稿→发布、`/p/:code` 只读线上。

---

## 10. 风险与对策

| 风险 | 对策 |
|------|------|
| 抽核破坏 web 现有编辑体验 | 阶段 A 用薄封装原地替换，先保行为不变再扩展 |
| 两端 schema 格式漂移 | 单一内核 + 单一 `normalizeSchema` 来源 |
| 跨应用会话/作用域泄漏 | 内核只在各自前端运行，保存走各自已鉴权 API（SELF 作用域） |
| 线上模板被实时改坏 | draft/live 分离（核心）+ 首次上架审批 + Playwright 断言"线上 schema 只经 publish 变化" |
| APPROVED 免审替换被滥用 | 可选：接入 AuditLog（P0 里程碑项）对每次免审发布留痕（actor/action/before/after） |
| 存量数据不兼容 | `draftSchema` 可空列，null 回退线上 schema，零迁移零回填 |
| 只读页被注入 | 草稿/发布双闸口消毒（复用 render 既有函数） |
| **admin 缺运行时依赖**（konva/react-konva/gsap/zustand/html-to-image/gifenc/qrcode） | A0 补装；验证 i18next 版本兼容（admin 23/15 vs web 26/17） |
| **i18n 命名空间未注册** | admin 注册 `editor`/`common`，否则键名整体回退（不崩但满屏 key） |
| **发布页反向依赖 editor 包**（`elements/*Shared` 归属） | 短期 web 的 `DOM*` 改从包引入；长期下沉到 `@h5design/render` |
| **65 文件一次性搬迁回归风险** | A0→A2 分步推进；每步 `tsc`；web 行为零变化冒烟兜底 |

---

## 11. 验收标准（DoD）

- [ ] `packages/editor` 产出，`@h5design/editor` 可被 web 与 admin 同时 import。
- [ ] web 端客户定制：选模板→编辑→保存→发布，**交互与改造前一致（零退化）**；保存写 `draftSchema`，发布后 `/p/:code` 才更新。
- [ ] Template 侧：保存草稿期间 `GET provider/catalog` 返回的线上 `schema` 不变；publish 后 `schema` 替换、`liveVersion+1`、`draftSchema=null`（原子性，无中间态）。
- [ ] APPROVED 模板再发布免审直接替换；非 APPROVED 状态发布被引导走审核流；首次上架仍走管理员审核。
- [ ] 运营端 `/sp/templates/:id/editor` 为真实画布（不再是占位页），顶栏含线上版本/草稿徽标，四动作可用。
- [ ] `from-project` 桥接：web 提交 → `Template(PENDING)` → 运营端补元数据上架，事实源唯一。
- [ ] 卡片网格已有能力回归通过（来源 Pill、chip 过滤、hover 详情/编辑）；可增草稿角标。
- [ ] 所有 schema 保存均经双闸口消毒；`tsc`/`nest build` 全绿；Playwright 关键链路通过。
- [ ] 本文档随实施同步维护（`docs/editor-shared-kernel-refactor.md`）。

---

## 12. 后续 / 待确认问题回答如下：

- web `/dashboard` 对普通客户（非服务商）的形态维持现状（决策 4 已废除"下线/只读化服务商入口"方向）；服务商沙盒入口后续做角色级显隐——待产品确认。
- Template 草稿不需要**草稿历史版本**（`VersionHistoryModal` 复用到运营端画布）——建议先复用（同在内核），按需再扩展 `draftSchema` 历史链。
- 富元素（图集/拼图/日历/倒计时）在运营端画布需要全量可用——依赖内核迁移完整性，阶段 A 重点核对。
- `PATCH services/:id` 的 `schema.meta` 合并是收敛进 draft 闸门——阶段 B 顺带评估（当前维持直改可接受）。
