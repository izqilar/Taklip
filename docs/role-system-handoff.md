# 三层用户角色系统 — 开发进展与问题总结（续接快照）

> **定位**：本文件是 `docs/template-pipeline-design.md` 的**实时续接快照**，供「下次优化用户角色相关功能」时立即接上。
> **截至**：2026-08-22（基于代码库直接检索，非凭记忆）。详细架构/规划请回看 `template-pipeline-design.md`。
> **范围**：普通用户 USER / 服务商 SERVICE_PROVIDER（原"设计师"泛化，可复合多种服务角色）/ 管理员 ADMIN 三层决策层模型、权限矩阵、入驻审核闸门、变现闭环。概念上游见 `docs/role-layer-redefinition.md`。

---

> 🔁 **概念迁移（2026-08-23）**：原中层角色 **DESIGNER（设计师）** 已重新定义为 **SERVICE_PROVIDER（服务商）**——服务商是一个可复合多种服务角色的供给层（DESIGN / PHOTO / VENUE / FLORAL / STEWARD / PERFORM），详见 `docs/role-layer-redefinition.md`。
> ✅ **代码落地（2026-08-23）**：`DESIGNER`→`SERVICE_PROVIDER`、`designerStatus`→`providerStatus`、新增复合 `serviceRoles` 的迁移**已全部落地**——后端 `schema.prisma`/`auth`/`template`/`wallet`/`order` + 前端 `client.ts`/`authStore.ts`/`App.tsx`/`SiteHeader.tsx`/`Profile.tsx`/`Settings.tsx`/`ProviderStudio.tsx`/`ProviderWallet.tsx` 与 i18n 六语言均已统一；入驻（`POST /api/auth/apply-provider`，可多选 serviceRoles）与资质审核（`POST /api/auth/submit-provider-review`）接口已上线。

## 0. 当前角色管线速览（接手即看，无需再总结）

> 这一段是给「下次接手模型」的**一句话现状**。详细/接驳点见下文第 1–7 节。

**一句话**：三层决策层（USER / SERVICE_PROVIDER / ADMIN）的数据模型、JWT 透传、前端路由守卫、入驻审核闸门、付费变现闭环**已全部落地可用**；当前短板在「管理员无角色管理页」「图片机审/模板名 i18n 未做」（联调角色账号与用户端导出图片已在 Phase 0/Phase 1 补齐，混合审核闸门已对付费供给生效；代码命名已统一为 SERVICE_PROVIDER / providerStatus / serviceRoles）。

**已确定落地（可直接信任）**
- 数据层：`Role` 枚举 + `User.role`（与 `vipLevel` 解耦）+ `User.serviceRoles`(复合服务角色) + `ProviderStatus` + `Template`(含 `TAKEN_DOWN` 状态)/`TemplateOrder`/`ProviderWallet`/`TemplateAppeal` 模型，`apps/server/prisma/schema.prisma`。
- 角色透传四处分叉一致：`jwt.strategy.ts`(select role/serviceRoles/providerStatus) → `auth.service.ts`(返回) → `api/client.ts`(`UserInfo.role`/`serviceRoles`/`providerStatus`) → `store/authStore.ts`(`isProvider`/`isProviderApproved`/`isAdmin`)。
- 前端门控：路由级 `RoleRoute`（`App.tsx`：`/provider/studio`、`/provider/wallet` → SERVICE_PROVIDER+ADMIN；`/admin/review` → ADMIN）；工具入口仅在登录后**头像下拉菜单**按角色条件渲染（`SiteHeader.tsx`），顶部主导航不暴露；`/designer/*` 旧路径已加别名重定向到 `/provider/*`。
- 业务能力：审核台(通过/驳回+理由)、内容巡查下架、官方模板直 APPROVED(#257)、申诉管理(#256)、文本敏感词机审(#255)、付费购买+钱包入账+提现、封面自动生成(#254) 均已实现。
- 安全正向点：入驻接口只支持 USER→SERVICE_PROVIDER（自助，可多选 serviceRoles），**无自服务升 ADMIN** 路径（ADMIN 仅能 DB/种子赋值）。

**仍待解决（接手优先看第 4 节）**
| 优先级 | 问题 | 接驳文件 |
|---|---|---|
| P1 | 种子数据已含 `dev_provider_001`(SERVICE_PROVIDER, serviceRoles=[DESIGN], APPROVED) / `dev_admin_001`(ADMIN) / `dev_user_001`(USER)，三角色联调可直接登录 | `apps/server/prisma/seed.ts` |
| P1 | 升级为**自助**（`upgrade-role` 仅需登录），无管理员审批闸门 → 待产品确认 | `auth.controller.ts` |
| P2 | 顶部导航不暴露角色工具入口，仅头像下拉可见 | `SiteHeader.tsx` |
| P2 | 用户端「导出图片」已实现：单页 PNG + 全部页长图（封面自动生成已做） | `EditorApp.tsx` `PublishModal.tsx` | ✅ |
| P2 | 管理员「角色管理」页/接口缺失（审批他人升级、降权均无） | 新页面+后端 |
| P3 | `scanImage()` 图片机审占位恒真；模板名未走 RTL i18n；设计系统资产沉淀未启动 | `content-safety.service.ts` |

---

## 1. 三层角色数据模型（已落地 ✅）

`apps/server/prisma/schema.prisma`：

```prisma
enum Role { USER  SERVICE_PROVIDER  ADMIN }   // 原 DESIGNER → SERVICE_PROVIDER（服务商，可复合 serviceRoles）

model User {
  role          Role           @default(USER)   // 决策层（单值）；与 vipLevel(会员权益) 解耦
  serviceRoles  ServiceRole[]                     // 新增：仅 role=SERVICE_PROVIDER 时 1..n；其余空
  providerStatus ProviderStatus @default(PENDING) // 原 designerStatus；仅 SERVICE_PROVIDER 有效
  vipLevel Int  @default(0)
  ...
}
```

配套模型（均已建表）：`Template`（authorId/status/price/reviewNote/reviewedBy/reviewedAt/isOfficial）、`TemplateStatus`（PENDING/APPROVED/REJECTED/**TAKEN_DOWN**）、`TemplateOrder`、`DesignerWallet`、`TemplateAppeal`。

角色透传链路（已验证四处分叉一致）：
- 后端 `jwt.strategy.ts` `validate()` select 含 `role`
- 后端 `auth.service.ts` 登录/注册返回体含 `role`
- 前端 `api/client.ts` `UserInfo` 含 `role: UserRole`
- 前端 `store/authStore.ts` 派生 `isDesigner` / `isAdmin`（直接读 `user.role`）

---

## 2. 各角色能力现状（实际落点）

| 能力 | USER | SERVICE_PROVIDER（服务商） | ADMIN |
|---|---|---|---|
| 个人作品 保存/发布 | ✅ | ✅ | ✅ |
| 逛/克隆 免费模板 | ✅ | ✅ | ✅ |
| 购买+使用 付费模板 | ✅(付费) | ✅ | ✅ |
| 发免费供给（按 serviceRoles） | ❌ | ✅→PENDING | ✅→**直 APPROVED**(#257) |
| 审核台（通过/驳回+理由） | ❌ | ❌ | ✅ `AdminReview` |
| 内容巡查下架 | ❌ | ❌ | ✅(TAKEN_DOWN) |
| 申请入驻服务商（多选服务类型） | 自助申请 | — | — |
| 收益/钱包/提现 | ❌ | ✅ `ProviderWallet` | 看平台总账(未做) |
| 角色管理（审批入驻/降权他人） | ❌ | ❌ | ❌ **无页面/接口** |

**入口可见性（前端实测）**：
- 顶部主导航 `SiteHeader` 的 `NAV_LINKS` **不暴露**服务商/管理员工具；仅登录后**用户头像下拉菜单**按角色条件渲染：`SERVICE_PROVIDER/ADMIN` 见「服务商工作台」、`ADMIN` 额外见「审核台」（`SiteHeader.tsx`）。
- `Profile.tsx`：USER 显「入驻服务商」金色按钮（弹窗**多选服务类型**）；SERVICE_PROVIDER/ADMIN 显「进入服务商工作台」。
- 路由级守卫：`App.tsx` 中 `/provider/studio`、`/provider/wallet` → `RoleRoute(['SERVICE_PROVIDER','ADMIN'])`；`/admin/review` → `RoleRoute(['ADMIN'])`；守卫逻辑见 `RoleRoute.tsx`（未登录→/login，角色不符→/）；旧 `/designer/*` 已加别名重定向到 `/provider/*`。

---

## 3. 开发进展（分阶段，代码实测）

| 阶段 | 内容 | 状态 |
|---|---|---|
| **P0** | Role 枚举 + User.role + Template/Order/Wallet/Appeal 模型 + JWT/UserInfo 透传 role | ✅ 已落地 |
| **P1** | 角色门控「存为模板」、提交进 PENDING、审核台(通过/驳回+理由)、公开库仅 APPROVED、官方模板直 APPROVED(#257) | ✅ 基本完成 |
| **P2** | 升级流程、付费购买+订单+收益、我的模板/收益页、钱包提现、用户端导出图片 | 🟢 升级/购买/收益/提现已落地；用户端导出图片（单页PNG+长图）已在 Phase 1 实现 |
| **P3** | 内容安全加固(文本敏感词+图片机审)、违规下架与申诉(#256)、RTL 模板名 i18n、设计系统资产沉淀 | 🟡 文本敏感词(#255)+申诉(#256)已做；**图片机审/ i18n / 资产沉淀未启动** |

后端模板服务端点（已落地 + 角色守卫）：
`findAll`(仅 APPROVED) / `/mine`(SERVICE_PROVIDER,ADMIN) / `/pending`+`PATCH /:id/review`(ADMIN) / `POST /`(createByDesigner 按 role 分流) / `POST /:id/purchase`(钱包入账) / `POST /:id/use` / 申诉 4 端点(takedown/createAppeal/findAppeals/reviewAppeal)。

---

## 4. 现存问题与偏差（按优先级，含接驳文件）

### P1 — 高（影响联调/产品决策）
1. **种子数据无 SERVICE_PROVIDER/ADMIN 账号**
   - 现象：`apps/server/prisma/seed.ts` 仅 `upsert dev_user_001`（无 `role`，默认 USER，且无 `phone/password`）。多角色联调需手动造数据。
   - 接驳：`apps/server/prisma/seed.ts` 已增加 `dev_provider_001`（role:SERVICE_PROVIDER，serviceRoles=[DESIGN]，providerStatus:APPROVED，带 phone+password=dev123456）与 `dev_admin_001`(role:ADMIN)；`dev_user_001` 保留默认 USER。多角色联调可直接用 `dev_provider_001` 登录。
2. **入驻=升级同一管线，混合审核已对付费供给落地（代码已落地）**
   - 现象：`POST /api/auth/apply-provider`（`auth.controller.ts`，请求体 `{ serviceRoles: ServiceRole[] }`）仅需登录即升 SERVICE_PROVIDER、`providerStatus=PENDING`，付费模板创建（`template.service`，`price>0`）对 `providerStatus!==APPROVED` 返回 403。即"入驻=升级、付费前需资质审核"的混合审核已落地。
   - 已落地：把 `DESIGNER`→`SERVICE_PROVIDER`、`designerStatus`→`providerStatus`，并将"升级即单一设计师"扩展为"申请入驻时可多选 serviceRoles"（复合服务角色），审核提交接口 `submit-designer-review`→`submit-provider-review`。

### P2 — 中（体验/完整性）
3. **「存为模板」入口形态**：当前为独立 `ProviderStudio` 页（从作品列表存为模板），非规划建议的编辑器顶栏按钮。功能等价，入口不同；若要更顺手可在 `EditorApp.tsx` 顶栏加入口。
4. **顶部导航不暴露角色工具入口**：服务商/管理员工具仅头像下拉可见，发现性弱。可在 `SiteHeader.tsx` 对 `SERVICE_PROVIDER/ADMIN` 登录态加常驻「工作台」入口。
5. **用户端「导出图片」已实现**（Phase 1）：编辑器「发布」弹窗提供「导出当前页 / 导出长图」两档，封面自动生成(#254)已实现。
6. **管理员「角色管理」页面/接口缺失**：规划中管理员可审批普通用户→服务商、可降权，但当前**无对应页面与后端接口**（入驻为自助，管理员侧无管理 UI）。

### P3 — 低/可选（加固）
7. **图片机审为占位**：`content-safety.service.ts` `scanImage()`（第 166 行）恒真返回，未接腾讯云/阿里云。提交时仅做了**文本敏感词扫描**(35 词 7 类，自动 REJECTED + reviewNote)。
8. **模板名未走 i18n**：模板名称为纯字符串，未做 ug/kk-CN/ky-CN/uz-CN（4 种 RTL）多语。
9. **设计系统资产沉淀未启动**：品牌色板/字体阶梯/起始脚手架空模板库。
10. **内容安全无分级/频控/图片审核**：仅有基础文本敏感词。

> 安全正向点：入驻接口只支持 USER→SERVICE_PROVIDER（自助，可多选 serviceRoles），**无自服务升 ADMIN** 路径；ADMIN 仅能 DB/种子直接赋值（"服务商不可叠加管理层角色"由决策层隔离保证）。

---

## 5. 接驳点速查表（下次优化直接改这几处）

| 改动类型 | 文件 |
|---|---|
| 角色/模板/订单/钱包/申诉模型 | `apps/server/prisma/schema.prisma` |
| JWT 透传 role | `apps/server/src/auth/strategies/jwt.strategy.ts`、`auth.service.ts` |
| 入驻/升级接口 | `apps/server/src/auth/auth.controller.ts`(`upgrade-role`→`apply-provider`)、`auth.service.ts`（`upgradeToDesigner`→`applyForProvider({serviceRoles})`） |
| 模板服务（审核/购买/官方直过/申诉） | `apps/server/src/template/template.service.ts`、`template.controller.ts` |
| 角色守卫 | `apps/server/src/common/guards/roles.guard.ts` + `decorators/roles.decorator.ts` |
| 内容安全 | `apps/server/src/common/services/content-safety.service.ts` |
| 前端 UserInfo/选择器 | `apps/web/src/api/client.ts`、`store/authStore.ts` |
| 前端路由守卫 | `apps/web/src/App.tsx`、`components/RoleRoute.tsx` |
| 角色入口 UI | `apps/web/src/components/SiteHeader.tsx`、`pages/Profile.tsx`、`pages/ProviderStudio.tsx` |
| 服务商/钱包/审核页 | `apps/web/src/pages/ProviderStudio.tsx`、`ProviderWallet.tsx`、`AdminReview.tsx` |
| 种子账号 | `apps/server/prisma/seed.ts` |

---

## 6. 推荐下一批任务清单

| 优先级 | 任务 | 入口/接驳 | 验收 |
|---|---|---|---|
| P1 | 补 SERVICE_PROVIDER/ADMIN 种子账号 | `seed.ts` | ✅ 已落地：`dev_provider_001`(SERVICE_PROVIDER,serviceRoles=[DESIGN],APPROVED,phone=13800000001,pwd=dev123456) + `dev_admin_001`(ADMIN) + `dev_user_001`(USER) |
| P1 | 入驻=升级管线（混合审核已定）：将 DESIGNER→SERVICE_PROVIDER、designerStatus→providerStatus，升级支持多选 serviceRoles | `auth.controller.ts`+`auth.service.ts`+`schema.prisma` | ✅ 已落地：`applyForProvider(serviceRoles)` + `submitProviderReview`；概念见 `role-layer-redefinition.md` |
| P2 | 顶部导航对角色显式暴露工作台入口 | `SiteHeader.tsx` | SERVICE_PROVIDER/ADMIN 登录即见 |
| P2 | 用户端「导出图片」 | `EditorApp.tsx` `PublishModal.tsx` | ✅ 作品可导出单页 PNG 与全部页长图 |
| P2 | 管理员「角色管理」页（审批升级/降权） | 新页面 + 后端接口 | ADMIN 可管理用户角色 |
| P3 | 接入图片机审 | `content-safety.service.ts` scanImage | 提交时调外部审核 API |
| P3 | 模板名 RTL i18n | 模板模型 + i18n | 4 种 RTL 语言模板名 |
| P3 | 设计系统资产沉淀 | 起始脚手架空模板 | 设计师可从模板起步 |

---

## 7. 联调须知（接手即看）
- 本地后端：`http://localhost:3000`；前端 dev：`http://localhost:5173`（vite proxy → 3000）。Docker：`h5design-postgres`(5432)/`h5design-redis`(6379)。
- 角色切换最快方式：登录后调用 `POST /api/auth/apply-provider`（请求体 `{ serviceRoles: ServiceRole[] }`）升 SERVICE_PROVIDER；ADMIN 需 DB/种子直接设 `role='ADMIN'`。
- 验证顺序建议：注册→登录→(申请入驻服务商，多选 serviceRoles)→发供给/存为模板→ADMIN 审核台通过/驳回→公开库可见→付费购买→钱包入账→提现。
