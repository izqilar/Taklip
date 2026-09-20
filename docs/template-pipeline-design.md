# 模板设计管线 + 三层用户权限 开发文档

> 文档目标：把"专门设计模板的入口"升级为 **受控的创作 → 审核 → 变现闭环**，对应三层权责（普通用户 / 设计师 / 管理员）。
> 本文整合两轮规划（基础「存为模板」管线 + 三层角色权限优化），并附 **截至 2026-08-20 的代码实测进度评估**。
> 状态：规划 + 部分实现。代码改动以"与现有代码接驳点"一节为准。

---

## 1. 背景与目标

当前系统模板数量少、不够美观，且没有专门的设计入口。编辑器已具备完整能力（画布 / 属性面板 / 动画 / 素材上传 / 实时预览 / 图集·拼图·日历等富元素），可以产出非常漂亮的模板。需要的是一条**把"编辑器里的作品"登记进模板库并受控流通**的管线。

核心目标：
1. 设计师能在编辑器内"存为模板"，零重复建设地批量产出美模板。
2. 模板流通受**三层角色权限 + 审核闸门**控制，杜绝违规内容上架。
3. 设计师可通过付费模板**变现**，平台抽成、钱包结算、可提现。

---

## 2. 核心思路：模板 = 作品

模板与作品共用同一套 `Project → Page[] → Element[]` Schema。所以"设计模板"本质是：在现有编辑器里做一份漂亮作品，然后"登记"进模板库。

- **不需要再造一套模板编辑器**——编辑器能力 100% 复用。
- 推荐入口：编辑器顶部栏（保存 / 预览 / 发布旁）加「存为模板」按钮 → 弹元数据表单 → 后端把当前 `Project.schema` 原样存为一条 `Template` → 立即出现在模板库 + 一键制作向导。
- 进阶形态：**起始脚手架**（预置版式的空模板），设计师填空而非从空白开始。

---

## 3. 三层用户模型

### 3.1 角色枚举（已落地）

```prisma
enum Role {
  USER       // 普通用户
  DESIGNER   // 设计师 / 商家
  ADMIN      // 管理员
}
```

`User` 新增 `role Role @default(USER)`，与 `vipLevel`（会员权益）**解耦**：`role = 能力`，`vip = 会员权益`。

### 3.2 权限矩阵

| 能力 | 普通用户 USER | 设计师 DESIGNER | 管理员 ADMIN |
|---|---|---|---|
| 个人作品 保存 / 发布 | ✅ | ✅ | ✅（可代操作） |
| 使用 / 克隆 免费模板 | ✅ | ✅ | ✅ |
| 购买并使用 付费模板 | ✅（付费） | ✅ | ✅ |
| 存为模板 / 发布到库 | ❌（置灰 + 引导升级） | ✅（进 `PENDING` 审核） | ✅（官方，直 `APPROVED`） |
| 模板审核 | ❌ | ❌ | ✅ |
| 内容巡查（下架违规发布） | ❌ | ❌ | ✅ |
| 用户 / 角色管理（审批升级） | ❌（可申请） | ❌ | ✅ |
| 收益查看 / 提现 | ❌ | ✅ | 看平台总账 |

> ⚠️ **实际实现偏差**：当前「升级为设计师」为**自助升级**（`POST /api/auth/upgrade-role`，仅需登录，无管理员审批闸门），而非规划中的"申请 → 管理员审批"。见第 12 节。

---

## 4. 数据模型（Prisma）

### 4.1 User（加 role）

```prisma
model User {
  id        String   @id @default(cuid())
  phone     String?  @unique
  vipLevel  Int      @default(0)   // 0=免费用户 1=会员
  role      Role     @default(USER) // 与 vipLevel 解耦：role=能力，vip=会员权益
  orders        TemplateOrder[]
  designerWallet DesignerWallet?
  // ... 其余现有字段
}
```

### 4.2 Template（扩展 author / 审核 / 价格）

```prisma
enum TemplateStatus {
  PENDING
  APPROVED
  REJECTED
}

model Template {
  id          String          @id @default(cuid())
  name        String
  category    String                       // 7 类场景
  tags        String[]                     // 或 JSON
  cover       String?                      // 封面图 URL
  isOfficial  Boolean        @default(false)
  useCount    Int             @default(0)
  schema      Json                            // 复用的作品 Schema
  authorId    String?
  author      User?           @relation(fields: [authorId], references: [id])
  status      TemplateStatus  @default(PENDING) // pending | approved | rejected
  reviewNote  String?                       // 驳回原因（展示给设计师）
  reviewedBy  String?                       // 审核管理员 id
  reviewedAt  DateTime?
  price       Int             @default(0)   // 价格（分），0=免费
  currency    String          @default("CNY")
  orders      TemplateOrder[]
  @@index([authorId])
  @@index([status])
}
```

### 4.3 付费模板购买订单（设计师变现）

```prisma
model TemplateOrder {
  id            String   @id @default(cuid())
  buyerId       String
  templateId    String
  amount        Int            // 实付（分）
  platformFee   Int            // 平台抽成
  designerIncome Int           // 设计师实得
  status        String   @default("paid") // paid | refunded
  createdAt     DateTime @default(now())
  @@index([templateId]) @@index([buyerId])
}
```

### 4.4 设计师钱包 / 收益

```prisma
model DesignerWallet {
  id          String @id @default(cuid())
  designerId  String @unique
  balance     Int    @default(0)   // 可提现余额（分）
  totalIncome Int    @default(0)
  withdrawn   Int    @default(0)
}
```

### 4.5 角色透传链路（三处同步改，已落地）

- 后端 `jwt.strategy.ts`：`validate()` 的 `select` 加 `role`；
- 后端 `auth.service.ts`：登录 / 注册返回体带 `role`；
- 前端 `api/client.ts` 的 `UserInfo` 加 `role: Role`；
- 前端 `store/authStore.ts` 加派生选择器 `isDesigner` / `isAdmin`（直接读 `user.role`）。

---

## 5. 各角色流程

### 5.1 普通用户
- 编辑器做个人作品 → 保存 / 发布（仅自己，生成 `/p/:code`）。
- 「存为模板」按钮置灰，提示「升级为设计师后可发布模板」→ 跳「升级为设计师」（当前为自助升级）。
- 逛模板库 / 走一键制作：免费模板直接克隆；付费模板先购买再克隆 → 小幅修改 → 发布 / 导出图片。

### 5.2 设计师（商家）
- （简化版）自助 `升级-role` 成为设计师。
- 编辑器设计美模板 → 「存为模板」→ 填元数据（名称 / 分类 / 标签 / 价格 / 封面自动取首页）→ 提交 → `status=PENDING`。
- 「我的模板」页：看状态（待审 / 已上架 / 被驳）、驳回理由、销量、收益。
- 被驳回可改稿重提；上架后被购买 → 订单按分成入账钱包 → 提现。

### 5.3 管理员
- 审核台：`PENDING` 队列（设计师提交）→ 严审图文违规 → 通过(`APPROVED`) / 驳回(附 `reviewNote`)。
- 内容巡查：抽查已发布作品（`Project.status=published`）→ 违规直接下架（标记违规原因）。
- 用户 / 角色管理：审批普通用户 → 设计师升级；必要时可降权。
- 可发布 `isOfficial` 官方模板。

---

## 6. 「存为模板」入口（角色门控 + 审核）

- 落点：规划建议 `apps/web/src/components/.../EditorApp.tsx`（保存 / 预览 / 发布按钮旁）。
  - ⚠️ **实际落地变体**：当前实现为独立的 **`DesignerStudio` 页面**（列出自己的作品 → 从作品「存为模板」），而非嵌在编辑器顶栏。功能等价，入口形态不同。
- `role=USER`：按钮置灰 + 引导升级。
- `role=DESIGNER`：弹元数据表单 → 提交 → 后端建 `Template(status=PENDING, authorId=当前用户)` → toast「已提交，等待审核」。
- `role=ADMIN`：同表单；规划要求 `isOfficial=true` 且**直接 `APPROVED`**。
  - ⚠️ **实际偏差**：后端 `createByDesigner` 对 ADMIN 提交也置 `PENDING`，未直 `APPROVED`，仍需走审核台。

---

## 7. 公开库可见性（只列 APPROVED）

- `GET /api/templates`（公开）：后端 `where: { status: 'APPROVED' }` 过滤（已落地）。
- `TemplateList.tsx` 与 `QuickMakeWizard.tsx` 的 `listTemplates(cat)` 调用无需改前端逻辑，后端过滤即可。
- 设计师「我的模板」走 `GET /api/templates/mine`（含 `PENDING`/`REJECTED`）。

---

## 8. 变现与升级机制

- 升级：`POST /api/auth/upgrade-role`（当前自助，无需管理员审批）。
- 购买：`POST /api/templates/:id/purchase` → 创建 `TemplateOrder` + 给 `DesignerWallet.balance` 加 `designerIncome`，模板 `useCount/sales++`（已落地，含钱包入账）。
- 提现：设计师「钱包」页 `申请提现`（前端 `withdraw` + 后端提现接口，已落地）。
- 导出图片：编辑器「发布」旁加「导出图片」（前端 `html-to-image` 截首页 / 整页）—— **当前未实现**。

---

## 9. 内容安全（管理员审核台）

- **P1**：人工审核（审核台 + 驳回理由 + 巡查下架）——审核台已落地（`AdminReview.tsx` + `PATCH /:id/review`）。
- **P3**：自动预筛降负载——文本敏感词过滤（提交时拦截 / 标红）；图片接入鉴黄 / 暴恐 API（如腾讯云天御），先机审后人审。**当前未实现**。

---

## 10. 分阶段落地路线

| 阶段 | 范围 | 状态 |
|---|---|---|
| **P0** | Role 枚举 + `User.role`；`Template` 加 `authorId/status/price/review*`；新建 `TemplateOrder` + `DesignerWallet`；JWT / `UserInfo` 透传 role | ✅ 已落地 |
| **P1** | 编辑器按角色门控「存为模板」；提交进 `PENDING`；管理员审核台（通过 / 驳回 + 理由）；公开库仅 `APPROVED`；官方模板直 `APPROVED` | 🟡 大部分已落地（审核台 / 门控 / 公开过滤 OK；官方直 `APPROVED` 未做） |
| **P2** | 升级为设计师流程；付费模板购买 + 订单 + 收益；设计师「我的模板 / 收益」页；导出图片 | 🟡 升级 / 购买 / 收益 / 提现已落地；**导出图片缺失** |
| **P3** | 内容安全加固（文本敏感词 + 图片机审）；违规下架与申诉；4 种 RTL 语言模板名 i18n；设计系统资产沉淀（色板 / 字体 / 起始脚手架） | 🔴 基本未启动 |

---

## 11. 与现有代码接驳点（具体文件）

| 改动 | 文件 |
|---|---|
| 角色 / 模板 / 订单模型 | `apps/server/prisma/schema.prisma` |
| JWT 透传 role | `apps/server/src/auth/strategies/jwt.strategy.ts`、`auth.service.ts` |
| 前端 UserInfo + 选择器 | `apps/web/src/api/client.ts`、`store/authStore.ts` |
| 存为模板入口 | `apps/web/src/pages/DesignerStudio.tsx`（实际落点，非 EditorApp） |
| 公开库过滤 APPROVED | `apps/server/src/template/template.service.ts`（`findAll`）、`template.controller.ts` |
| 审核台 / 我的模板 / 钱包 / 路由 | `apps/web/src/pages/AdminReview.tsx`、`DesignerStudio.tsx`、`DesignerWallet.tsx`、`App.tsx` |
| 消费端只取 approved | `TemplateList.tsx`、`wizard/QuickMakeWizard.tsx`（后端过滤，前端无需改） |

---

## 12. 当前进度评估（代码实测，2026-08-20）

> 以下结论来自对代码库的直接检索，非凭记忆。

### 12.1 已实现 ✅
- **P0 数据层**：`Role` 枚举、`User.role`、`Template`（含 `authorId/status/reviewNote/reviewedBy/price/currency`）、`TemplateOrder`、`DesignerWallet` 均已在 `schema.prisma` 落地。
- **角色透传**：`jwt.strategy` 选 `role`；`auth.service` 返回 `role`；`authStore` 有 `isDesigner/isAdmin`；`RolesGuard` + `@Roles()` 装饰器可用。
- **模板服务（后端）**：`findAll`（仅 `APPROVED`）、`/mine`、`/pending`、`POST /`（→ `PENDING`）、`PATCH /:id/review`（approve / reject + 理由）、`POST /:id/purchase`、`POST /:id/use` 全部实现并加角色守卫（`/mine`→`DESIGNER,ADMIN`；`/pending`+`/review`→`ADMIN`）。
- **前端页面**：`DesignerStudio`（存为模板 + 我的模板）、`AdminReview`（审核台，三标签页）、`DesignerWallet`（收益 / 提现）页面与路由均已挂载；`Profile` 页 USER 显示「升级为设计师」入口。
- **购买变现**：`purchase` 创建订单并 `increment` 设计师钱包 `balance`（已核实钱包入账逻辑）。
- **官方模板直 APPROVED**（#257 ✅）：`createByDesigner` 按 `role` 分流——ADMIN 提交 → `status:'APPROVED'` + `isOfficial` 默认 true；DESIGNER 提交 → `status:'PENDING'`。
- **封面自动生成**（#254 ✅）：`DesignerStudio` 存为模板时用 `html-to-image` 离屏渲染首屏截图生成 cover dataURL，失败回退到 `source.cover`。
- **内容安全（#255 ✅）**：`ContentSafetyService`（35 个敏感词 7 大类）扫描模板名称 + Schema 递归提取文本字段；`createByDesigner` 提交前自动扫描，命中敏感词 → 自动 REJECTED + reviewNote 列出命中的词和字段；图片机审 `scanImage` 预留接口。
- **违规下架与申诉（#256 ✅）**：`TemplateStatus` 新增 `TAKEN_DOWN`；`TemplateAppeal` 模型；后端 4 端点（takedown/createAppeal/findAppeals/reviewAppeal）；前端 `AdminReview` 三标签页（待审核 / 申诉管理 / 违规下架）；`DesignerStudio` 申诉入口（TAKEN_DOWN/REJECTED 模板可申诉）。

### 12.2 部分实现 / 偏差 🟡
- **升级流程为自助**：`POST /api/auth/upgrade-role` 仅需登录即可升级为 `DESIGNER`，**无管理员审批闸门**——与规划"申请 → 管理员审批"不同（属规划"自助付费升级"变体，需确认是否符合预期）。
- **「存为模板」入口形态**：实现为 `DesignerStudio` 独立页（从作品列表存为模板），非规划建议的编辑器顶栏按钮。

### 12.3 未实现 🔴（待办任务）
1. **导出图片**（P2）：`html-to-image` 截首页 / 整页（面向用户导出自己的作品，非模板封面）——封面自动生成已实现（#254），但用户端「导出图片」按钮未做。
2. **4 种 RTL 语言模板名 i18n**（P3）：模板名称目前为纯字符串，未走 i18n key（ug/kk-CN/ky-CN/uz-CN）。
3. **设计系统资产沉淀**（P3）：品牌色板 / 字体阶梯 / 起始脚手架空模板库。
4. **升级审批闸门**（可选收尾）：若需回到"申请 → 管理员审批"模型，需新增申请态 + 管理员审批接口与页面。
5. **图片机审实际接入**（P3）：`scanImage` 预留接口已就位，需接入腾讯云/阿里云内容审核 API。

---

## 附录：原规划架构图

### 图 1 — 模板设计管线：创作 → 入库 → 消费

```svg
<svg viewBox="0 0 680 440" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M2 1L8 5L2 9" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
    <marker id="arrR" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M2 1L8 5L2 9" fill="none" stroke="#E24B4A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
  </defs>
  <text x="340" y="28" text-anchor="middle" fill="#E2E8F0" font-size="15" font-weight="500">模板设计管线：创作 → 入库 → 消费</text>
  <rect x="40" y="70" width="270" height="84" rx="12" fill="#1E293B" stroke="#334155" stroke-width="0.5"/>
  <text x="175" y="98" text-anchor="middle" fill="#E2E8F0" font-size="14" font-weight="500">编辑器（全能力复用）</text>
  <text x="175" y="120" text-anchor="middle" fill="#94A3B8" font-size="12">画布 · 属性面板 · 动画</text>
  <text x="175" y="138" text-anchor="middle" fill="#94A3B8" font-size="12">素材上传 · 实时预览</text>
  <rect x="300" y="92" width="80" height="38" rx="19" fill="#A32D2D" stroke="#E24B4A" stroke-width="0.5"/>
  <text x="340" y="115" text-anchor="middle" fill="#FFFFFF" font-size="12" font-weight="500">存为模板</text>
  <rect x="385" y="70" width="255" height="84" rx="12" fill="#1E293B" stroke="#334155" stroke-width="0.5"/>
  <text x="512" y="98" text-anchor="middle" fill="#E2E8F0" font-size="14" font-weight="500">后端：创建 Template</text>
  <text x="512" y="120" text-anchor="middle" fill="#94A3B8" font-size="12">存 schema + 元数据</text>
  <text x="512" y="138" text-anchor="middle" fill="#94A3B8" font-size="12">+ 封面自动生成</text>
  <line x1="310" y1="111" x2="385" y2="111" stroke="#E24B4A" stroke-width="1.5" marker-end="url(#arrR)"/>
  <rect x="225" y="195" width="230" height="62" rx="12" fill="#26215C" stroke="#7F77DD" stroke-width="0.5"/>
  <text x="340" y="220" text-anchor="middle" fill="#CECBF6" font-size="14" font-weight="500">模板库 DB</text>
  <text x="340" y="240" text-anchor="middle" fill="#AFA9EC" font-size="12">分类 · 标签 · 官方标 · 封面 · bind</text>
  <line x1="512" y1="154" x2="402" y2="195" stroke="#94A3B8" stroke-width="1.5" marker-end="url(#arr)"/>
  <line x1="300" y1="154" x2="300" y2="195" stroke="#94A3B8" stroke-width="1.5" marker-end="url(#arr)"/>
  <rect x="30" y="312" width="190" height="84" rx="12" fill="#04342C" stroke="#1D9E75" stroke-width="0.5"/>
  <text x="125" y="340" text-anchor="middle" fill="#C0DD97" font-size="14" font-weight="500">模板库页</text>
  <text x="125" y="362" text-anchor="middle" fill="#97C459" font-size="12">浏览 · 搜索 · 使用</text>
  <text x="125" y="380" text-anchor="middle" fill="#97C459" font-size="12">首页缩略图预览</text>
  <rect x="245" y="312" width="190" height="84" rx="12" fill="#27500A" stroke="#639922" stroke-width="0.5"/>
  <text x="340" y="340" text-anchor="middle" fill="#C0DD97" font-size="14" font-weight="500">一键制作向导</text>
  <text x="340" y="362" text-anchor="middle" fill="#97C459" font-size="12">按分类选模板</text>
  <text x="340" y="380" text-anchor="middle" fill="#97C459" font-size="12">bind 注入表单</text>
  <rect x="460" y="312" width="190" height="84" rx="12" fill="#412402" stroke="#BA7517" stroke-width="0.5"/>
  <text x="555" y="340" text-anchor="middle" fill="#FAC775" font-size="14" font-weight="500">模板工作台</text>
  <text x="555" y="362" text-anchor="middle" fill="#EF9F27" font-size="12">管理封面 / 官方标</text>
  <text x="555" y="380" text-anchor="middle" fill="#EF9F27" font-size="12">下架 / 预览 / 编辑</text>
  <line x1="262" y1="257" x2="125" y2="312" stroke="#94A3B8" stroke-width="1.5" marker-end="url(#arr)"/>
  <line x1="340" y1="257" x2="340" y2="312" stroke="#94A3B8" stroke-width="1.5" marker-end="url(#arr)"/>
  <line x1="418" y1="257" x2="555" y2="312" stroke="#94A3B8" stroke-width="1.5" marker-end="url(#arr)"/>
  <line x1="555" y1="312" x2="455" y2="257" stroke="#BA7517" stroke-width="1.2" stroke-dasharray="5 4" marker-end="url(#arr)"/>
  <text x="512" y="285" text-anchor="middle" fill="#EF9F27" font-size="11">管理回流</text>
  <text x="40" y="425" fill="#64748B" font-size="11">创作在编辑器，管理在工作台，消费在模板库页 / 一键制作</text>
</svg>
```

### 图 2 — 三层用户权限与模板审核闸门

```svg
<svg viewBox="0 0 680 540" width="100%" role="img">
  <title>三层用户权限与模板审核闸门</title>
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
  </defs>
  <g>
    <rect x="40" y="50" width="180" height="48" rx="8" stroke-width="0.5"/>
    <text x="130" y="68" text-anchor="middle" dominant-baseline="central">普通用户</text>
    <text x="130" y="86" text-anchor="middle" dominant-baseline="central">USER</text>
  </g>
  <g>
    <rect x="250" y="50" width="180" height="48" rx="8" stroke-width="0.5"/>
    <text x="340" y="68" text-anchor="middle" dominant-baseline="central">设计师 / 商家</text>
    <text x="340" y="86" text-anchor="middle" dominant-baseline="central">DESIGNER</text>
  </g>
  <g>
    <rect x="460" y="50" width="180" height="48" rx="8" stroke-width="0.5"/>
    <text x="550" y="68" text-anchor="middle" dominant-baseline="central">管理员</text>
    <text x="550" y="86" text-anchor="middle" dominant-baseline="central">ADMIN</text>
  </g>
  <g>
    <rect x="40" y="140" width="180" height="56" rx="8" stroke-width="0.5"/>
    <text x="130" y="160" text-anchor="middle" dominant-baseline="central">个人作品</text>
    <text x="130" y="178" text-anchor="middle" dominant-baseline="central">仅自己保存 / 发布</text>
  </g>
  <g>
    <rect x="250" y="140" width="180" height="56" rx="8" stroke-width="0.5"/>
    <text x="340" y="168" text-anchor="middle" dominant-baseline="central">编辑器内制作作品</text>
  </g>
  <g>
    <rect x="460" y="140" width="180" height="56" rx="8" stroke-width="0.5"/>
    <text x="550" y="160" text-anchor="middle" dominant-baseline="central">巡查已发布作品</text>
    <text x="550" y="178" text-anchor="middle" dominant-baseline="central">下架违规内容</text>
  </g>
  <g>
    <rect x="250" y="220" width="180" height="44" rx="8" stroke-width="0.5"/>
    <text x="340" y="242" text-anchor="middle" dominant-baseline="central">存为模板 · 提交</text>
  </g>
  <g>
    <rect x="250" y="300" width="180" height="56" rx="8" stroke-width="0.5"/>
    <text x="340" y="320" text-anchor="middle" dominant-baseline="central">审核门</text>
    <text x="340" y="338" text-anchor="middle" dominant-baseline="central">管理员严审</text>
  </g>
  <g>
    <rect x="40" y="400" width="180" height="56" rx="8" stroke-width="0.5"/>
    <text x="130" y="420" text-anchor="middle" dominant-baseline="central">驳回 · 返回修改</text>
    <text x="130" y="438" text-anchor="middle" dominant-baseline="central">附违规说明</text>
  </g>
  <g>
    <rect x="250" y="400" width="180" height="56" rx="8" stroke-width="0.5"/>
    <text x="340" y="420" text-anchor="middle" dominant-baseline="central">上架 · 公开模板库</text>
    <text x="340" y="438" text-anchor="middle" dominant-baseline="central">仅展示 APPROVED</text>
  </g>
  <g>
    <rect x="250" y="470" width="180" height="56" rx="8" stroke-width="0.5"/>
    <text x="340" y="490" text-anchor="middle" dominant-baseline="central">用户选用 → 克隆</text>
    <text x="340" y="508" text-anchor="middle" dominant-baseline="central">修改 → 发布 / 导出图</text>
  </g>
  <g>
    <rect x="460" y="470" width="180" height="56" rx="8" stroke-width="0.5"/>
    <text x="550" y="490" text-anchor="middle" dominant-baseline="central">设计师收益</text>
    <text x="550" y="508" text-anchor="middle" dominant-baseline="central">按购买分成</text>
  </g>
  <line x1="340" y1="98" x2="340" y2="220" stroke-dasharray="4 3"/>
  <line x1="340" y1="196" x2="340" y2="220" marker-end="url(#arrow)"/>
  <line x1="340" y1="264" x2="340" y2="300" marker-end="url(#arrow)"/>
  <path d="M550,98 L550,328 L432,328" stroke-dasharray="4 3" marker-end="url(#arrow)"/>
  <path d="M250,328 C210,365 200,395 220,428" marker-end="url(#arrow)"/>
  <line x1="340" y1="356" x2="340" y2="400" marker-end="url(#arrow)"/>
  <line x1="340" y1="456" x2="340" y2="470" marker-end="url(#arrow)"/>
  <path d="M430,428 L460,498" marker-end="url(#arrow)"/>
  <text x="130" y="208" text-anchor="middle" dominant-baseline="central">可申请升级设计师 →</text>
</svg>
```
