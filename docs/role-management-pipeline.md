# 角色管理管线（Role Management Pipeline）— 开发文档

> **文档版本**：v1.0.0
> **最后更新**：2026-08-24
> **状态**：已落地（P0–P5 全部完成，权限矩阵运行时验证全绿）
> **上游引用**：`docs/role-system-handoff.md`、`docs/role-layer-redefinition.md`、`docs/user-role-optimization-plan.md`、`docs/template-pipeline-design.md`
> **技术选型**：Refine + `@refinedev/antd` + `@refinedev/simple-rest` 直连现有 NestJS 后端；后端复用 `apps/server`

---

## 目录

- [1. 概述](#1-概述)
- [2. 角色与区域模型](#2-角色与区域模型)
- [3. 数据权限架构](#3-数据权限架构)
- [4. 后端接口定义](#4-后端接口定义)
- [5. 前端（Refine）实现要点](#5-前端refine实现要点)
- [6. 权限矩阵](#6-权限矩阵)
- [7. 迁移与种子](#7-迁移与种子)
- [8. 里程碑](#8-里程碑)
- [9. 附录](#9-附录)

---

## 1. 概述

### 1.1 背景与目标

平台当前已具备三层角色决策层（普通用户 / 服务商 / 管理员）与服务商复合子角色 `serviceRoles`、审核态 `pendingServiceRoles`、`providerStatus` 闸门（详见上游文档，本章不重复）。随着业务推进，出现两类新需求：

1. **按角色呈现不同后台界面**：不同用户层登录后，所能看到与操作的功能应按角色显示/隐藏（RBAC 显隐）。
2. **行政区域代理**：未来按省/市/区开展代理服务——服务商分布在不同地区，代理商（AGENT）专门负责某一地区，其管辖范围内包含该地区的各类服务商与用户。

本管线目标：在现有 NestJS + Prisma 后端之上，**系统化**地重规划角色管理，把角色从"三层"扩展为"四层"，并引入**区域数据权限（ABAC）**，配套一个基于 Refine 的管理后台，使管理员/代理商可按角色与区域对服务商、用户进行可视化管理。

### 1.2 范围

| 范围 | 说明 |
|------|------|
| ✅ 包含 | 四层角色模型（含 AGENT）、Region 区域模型、后端数据权限架构、管理员/代理商接口、Refine 管理后台、apps/web 菜单显隐修正、迁移与种子、权限矩阵 |
| ⛔ 不包含（引用上游） | 既有三层模型定义、`serviceRoles` 复合子角色语义、`providerStatus` 付费闸门、模板审核/变现闭环——均引用 `docs/role-system-handoff.md` 等，不重复描述 |

### 1.3 技术选型

| 层 | 选型 | 说明 |
|----|------|------|
| 管理后台框架 | **Refine** | Headless React 管理框架，CRUD 与 access control 开箱即用 |
| 管理后台 UI | `@refinedev/antd` | 复用 Ant Design 组件（Table/Form/Tree/Cascader） |
| 数据适配器 | `@refinedev/simple-rest` | 直连现有 NestJS REST（必要时自定义 data provider）；v1 不引入与现有自定义控制器耦合的专用 nestjs 包 |
| 工程位置 | `apps/admin` | 与 `apps/web`、`apps/server` 同 monorepo |
| 后端 | 复用 `apps/server` | 扩展 `admin` / `region` / `agent` 模块，复用 `expand-services` / `approve-services` |

### 1.4 基路径约定

> **注意**：本平台认证后端实际以 `/api` 为基路径（如 `/api/auth/me`、`/api/auth/provider/expand-services`），与 `docs/standard-dev-doc.md` 第 5 章所述 `/api/v1` 约定**不一致**（认证模块先行落地，未带版本前缀）。本管线沿用真实后端的 **`/api`** 基路径，新增接口置于 `/api/admin/*`、`/api/regions/*`、`/api/auth/access`。

---

## 2. 角色与区域模型

### 2.1 角色决策层（四层）

角色由 `User.role` 单值枚举定义，互斥：

| 角色 | 枚举值 | 管辖范围 | 说明 |
|------|--------|---------|------|
| 普通用户 | `USER` | 仅本人数据 | 消费端，浏览/制作/发布个人 H5 |
| 服务商 | `SERVICE_PROVIDER` | 本机构（`serviceRoles` 决定可提供的服务种类） | 供给端，复合多服务子角色（见 2.2） |
| 代理商 | `AGENT` | **某行政区域（regionId 绑定区/县）及其子树** | 🆕 本管线新增；管辖区内服务商与用户 |
| 管理员 | `ADMIN` | 全局 | 治理端，用户/角色/审核/区域管理；不可自助、不可叠加 |

> AGENT 在 v1 折叠进 `User`（`role=AGENT` + `regionId` 管辖区），不单独建 Agent 模型，以降低复杂度；后续如需合同/备注再建 `AgentProfile`。

### 2.2 服务商复合子角色（引用上游）

`serviceRoles: ServiceRole[]` 仅对 `SERVICE_PROVIDER` 有效，取值：`DESIGN / PHOTO / VENUE / FLORAL / STEWARD / PERFORM`（枚举开放扩展）。审核中态走 `pendingServiceRoles`，由 `expand-services`（用户提交）→ `approve-services`（管理员合并进 `serviceRoles`）闭环。语义详见 `docs/role-layer-redefinition.md`，本管线**不重复定义**。

### 2.3 Region 区域模型

行政区域采用**省/市/区三级自引用树**，绑定国家标准行政区划代码（GB/T 2260）。

```prisma
model Region {
  id       String  @id @default(cuid())
  code     String  @unique              // 6 位国标行政区划代码
  name     String
  level    Int                         // 1=省 2=市 3=区/县
  parentId String? @map("parent_id")
  parent   Region? @relation("RT", fields:[parentId], references:[id])
  children Region[] @relation("RT")
  users    User[]
  @@index([parentId]) @@index([level])
}
```

- `regionPath`：冗余路径字段（如 `"<省ID>/<市ID>/<区ID>"`），用于**辖区子树前缀匹配**，避免递归 join。
- Agent 绑定到**区/县（level=3）**，其辖区 = 该区及其 `regionPath` 前缀命中的所有子节点（本平台省/市/区为三级，区下无更深节点；若未来下沉到街道，仅需扩展 level）。

### 2.4 User 模型扩展

在现有 `User` 上新增以下字段（其余字段保留）：

```prisma
model User {
  // …现有字段（phone/nickname/avatar/role/serviceRoles/pendingServiceRoles/providerStatus/realName/bio/email 等）
  regionId   String?  @map("region_id")    // 本人所属区/县
  region     Region?  @relation(fields:[regionId], references:[id])
  agentId    String?  @map("agent_id")     // 受管于某代理商 User.id（辖区用户/服务商标记）
  regionPath String?  @map("region_path")  // 冗余路径，便于辖区查询
  status     UserStatus @default(ACTIVE)   // 启停闸门
}

enum UserStatus { ACTIVE DISABLED }
enum Role { USER SERVICE_PROVIDER AGENT ADMIN }   // 新增 AGENT
```

### 2.5 关系示意

```
Region 树 (省/市/区)
 ├─ 新疆维吾尔自治区
 │   └─ 乌鲁木齐市
 │       └─ 天山区  ←── Agent A (role=AGENT, regionId=天山区)
 │                ├─ Provider P1 (regionId=天山区, serviceRoles=[DESIGN])
 │                └─ User U1    (regionId=天山区)
 └─ 北京市
     └─ 朝阳区  ←── Agent B
         └─ Provider P2 …

User.role ∈ {USER, SERVICE_PROVIDER, AGENT, ADMIN}
User(AGENT).regionId  → 其管辖区；辖区 = regionPath 前缀命中的 Region 子树
User(普通/服务商).regionId → 本人所属区（用于归属统计与代理商辖区聚合）
```

---

## 3. 数据权限架构

### 3.1 核心原则

**前端显隐 + 后端过滤 = 数据权限双保险，后端为唯一真相源。**

- 前端（Refine `accessControlProvider`）只决定菜单/按钮"显不显示"，**不能作为安全边界**（任何人可改请求绕过）。
- 后端每个列表/详情查询，按 `caller.role + caller.regionId` 注入 `where` 条件，确保越权数据不可达。

### 3.2 JWT 投影修复（前置依赖）

现有 `jwt.strategy.ts` 的 `validate()` 返回的 `req.user` 比 `selectUser` 投影少了 `realName/bio/email/pendingServiceRoles`，且**完全不含区域维度**。必须先补齐，否则后端拦截器与前端 accessControlProvider 都拿不到区域信息。

`req.user` 至少应包含：

```typescript
interface JwtPayload {
  id: string;
  role: 'USER' | 'SERVICE_PROVIDER' | 'AGENT' | 'ADMIN';
  regionId?: string | null;
  regionPath?: string | null;
  agentId?: string | null;
  status: 'ACTIVE' | 'DISABLED';
  // 后台所需的展示字段
  realName?: string | null;
  bio?: string | null;
  email?: string | null;
  pendingServiceRoles?: ServiceRole[];
}
```

### 3.3 RolesGuard（角色级，保留）

沿用现有 `RolesGuard` + `@Roles(...)` 装饰器，做**角色层**准入（如 `@Roles('ADMIN')`）。本管线仅扩展枚举支持 `AGENT`。

### 3.4 DataScopeInterceptor（数据级，新增）

新增 `apps/server/src/common/interceptors/data-scope.interceptor.ts`，读取 `req.user`，对受管查询注入辖区 `where`：

```typescript
// 伪代码
buildScope(caller: JwtPayload) {
  if (caller.role === 'ADMIN') return {};                                   // 全量
  if (caller.role === 'AGENT')  return { regionPath: { startsWith: caller.regionPath } }; // 辖区内
  return { id: caller.id };                                                 // 普通用户仅本人
}
```

- 管理员接口：`@Roles('ADMIN')` + `RolesGuard`。
- 代理商可见接口：`@Roles('ADMIN', 'AGENT')` + `DataScopeInterceptor`（自动收窄到辖区）。
- 辖区子树解析用 `regionPath` 前缀匹配（如 `startsWith "天山区ID"`），避免递归 join。

---

## 4. 后端接口定义

### 4.1 通用约定

| 项 | 规范 |
|----|------|
| 基路径 | `/api`（见 1.4） |
| 认证 | `Authorization: Bearer <accessToken>` |
| 分页 | `page`（从 1）、`pageSize`（默认 20） |
| 响应 | 沿用现有 `{ code, message, data }` 结构（`code=0` 成功） |

### 4.2 接口清单

| 方法 | 路径 | 说明 | Guard |
|------|------|------|-------|
| GET | `/api/admin/users` | 用户列表（分页，支持 role/region 过滤） | ADMIN 全量 / AGENT 辖区 |
| GET | `/api/admin/users/:id` | 用户详情 | 同上 + 本人 |
| POST | `/api/admin/users/:id/status` | 启停账号（`status`: ACTIVE/DISABLED） | ADMIN |
| POST | `/api/admin/users/:id/role` | 角色分配（**禁止将任何人（含自己）升为 ADMIN**） | ADMIN |
| GET | `/api/admin/provider-review` | 待审队列（`pendingServiceRoles`） | ADMIN / AGENT 辖区 |
| POST | `/api/admin/provider-review/:id/approve` | 通过（复用 `approve-services` 逻辑） | ADMIN / AGENT 辖区 |
| POST | `/api/admin/provider-review/:id/reject` | 驳回（清空 `pendingServiceRoles` 并记审核日志） | ADMIN / AGENT 辖区 |
| GET | `/api/admin/agents` | 代理商列表 | ADMIN |
| POST | `/api/admin/agents` | 新建代理商（创建 `role=AGENT` 用户并绑定 `regionId`） | ADMIN |
| PATCH | `/api/admin/agents/:id/region` | 修改代理商辖区（`regionId` + 重算 `regionPath`） | ADMIN |
| GET | `/api/regions/tree` | 区域树读取（省/市/区） | 登录即可 |
| GET | `/api/auth/access` | 返回 `{ role, regionId, regionPath, permissions[] }` 供 Refine | 登录即可 |

### 4.3 关键逻辑

- **角色分配**：`POST /api/admin/users/:id/role` 入参 `role` 取值限定为 `USER`/`SERVICE_PROVIDER`/`AGENT`，**拒绝 `ADMIN`**（管理员晋升走独立线下/种子流程，防越权自升）。
- **服务商审核**：`approve` 直接复用现有 `approveServiceRoles(userId)`（将 `pendingServiceRoles` 合并入 `serviceRoles` 并清空 pending）；`reject` 清空 `pendingServiceRoles` 并写审核日志。
- **代理商新建**：创建 `User({ role: 'AGENT', regionId, regionPath, status: 'ACTIVE' })`，可选 `agentId` 关联上级；初始密码走重置流程。
- **区域树**：`/api/regions/tree` 返回三级嵌套 JSON，前端 `Cascader`/`TreeSelect` 直接消费。

### 4.4 新建模块

```
apps/server/src/
 ├─ admin/      admin.controller.ts  admin.service.ts  admin.module.ts  dto/
 ├─ region/     region.controller.ts region.service.ts region.module.ts
 ├─ agent/      agent.controller.ts  agent.service.ts  agent.module.ts
 └─ common/interceptors/data-scope.interceptor.ts
```

---

## 5. 前端（Refine）实现要点

### 5.1 工程结构

新建 `apps/admin`（Refine + `@refinedev/antd` + `@refinedev/simple-rest`），通过 `simple-rest` 的 `apiUrl` 指向 `apps/server` 基址（如 `http://localhost:3000/api`）。

### 5.2 accessControlProvider（RBAC + ABAC）

`apps/admin/src/providers/accessControl.ts`：首次登录缓存 `GET /api/auth/access` 结果，`can({ resource, action })` 据 `role` + `regionId` 返回 `{ can }`。

```typescript
// 伪代码
accessControlProvider = {
  async can({ resource, action }) {
    const me = await getAccess();             // 缓存的 /api/auth/access
    const allowed = ROLE_MATRIX[me.role]?.[resource]?.[action];
    if (allowed === 'SCOPED') return { can: !!me.regionId }; // 代理商需先绑定辖区
    return { can: !!allowed };
  },
};
```

菜单/按钮通过 `meta.roles` 或 `accessControlProvider` 显隐，普通用户登录管理后台时绝大多数资源 `can:false` → 自动隐藏。

### 5.3 资源与菜单

| resource | list | create | edit | show | 可见角色 |
|----------|------|--------|------|------|---------|
| users | ✅ | ❌ | ✅(status/role) | ✅ | ADMIN / AGENT(辖区) |
| providers(审核) | ✅ | ❌ | ❌ | ✅ | ADMIN / AGENT(辖区) |
| agents | ✅ | ✅ | ✅(region) | ✅ | ADMIN |
| regions | ✅(tree) | ❌ | ❌ | ❌ | 登录即可 |

### 5.4 区域选择组件

`Cascader`（新增/编辑代理商辖区）与 `TreeSelect`（区域筛选）均绑定 `GET /api/regions/tree`，回显为"省 / 市 / 区"路径。

### 5.5 i18n

- `apps/admin/src/i18n` 独立命名空间（antd locale + 自身 key）。
- 复用 `apps/web` 现有展示词（nav/provider/settings 等）。
- 新增 `role.USER / role.SERVICE_PROVIDER / role.AGENT / role.ADMIN`、`agent.*` 等 key（六语言含 RTL）。

### 5.6 apps/web 配套修正（UX 缺口）

现有 `SiteHeader` 个人账号菜单未做角色过滤（普通 USER 也能看到"工作台/服务商入住"入口，靠路由驳回）。本管线一并修正：

| 文件 | 改动 |
|------|------|
| `apps/web/src/components/SiteHeader.tsx` | "服务商入住"按钮仅 `isProvider` 显；"工作台"菜单项加 `isProvider \|\| isProviderApproved` 过滤；新增 AGENT 入口 `/agent/studio`（仅 `isAgent`） |
| `apps/web/src/components/RoleRoute.tsx` | 扩展 4 角色，新增 AGENT 守卫 |
| `apps/web/src/App.tsx` | 补 `/agent/studio` 路由 |
| `apps/web/src/store/authStore.ts` | 派生 `isAgent`（`user.role === 'AGENT'`） |
| `apps/web/src/i18n/locales/*/common.json` | 新增 `role.*` 展示 key（六语言含 RTL） |

---

## 6. 权限矩阵

行=角色，列=资源与操作。`●`=可操作 `○`=仅查看/本人 `—`=不可见。

| 资源 \ 角色 | USER | SERVICE_PROVIDER | AGENT | ADMIN |
|-------------|------|------------------|-------|-------|
| **users** 列表 | — | — | ○ 辖区内 | ● 全量 |
| **users** 详情 | ○ 本人 | ○ 本人 | ○ 辖区内 | ● 全量 |
| **users** 启停 | — | — | — | ● |
| **users** 角色分配 | — | — | — | ●（禁升 ADMIN） |
| **providers** 待审列表 | — | ○ 本人提交 | ○ 辖区内 | ● 全量 |
| **providers** 审批通过/驳回 | — | — | ● 辖区内 | ● 全量 |
| **agents** 管理 | — | — | — | ● |
| **regions** 树读取 | ○ 本人区 | ○ 本人区 | ○ 本人区 | ● 全量 |
| **templates** 审核（`/admin/review`） | — | — | — | ●（引用上游） |

> AGENT 的"辖区内"由 `DataScopeInterceptor` 按 `regionPath` 前缀强制生效；前端隐藏仅为体验，后端过滤为安全边界。

---

## 7. 迁移与种子

### 7.1 数据库变更

1. 改 `apps/server/prisma/schema.prisma`（新增 `Region` 模型、`User.regionId/agentId/regionPath/status`、`Role` 加 `AGENT`、`UserStatus` 枚举）。
2. `npx prisma generate` → `npx prisma db push`（或 `prisma migrate dev` 生成迁移）。

### 7.2 行政区划种子

- **来源**：`modood/Administrative-divisions-of-China`（GB/T 2260 省/市/区 JSON）或 stats.gov.cn 行政区划代码。
- 新增 `apps/server/prisma/seed-regions.ts`：读取数据集，写入三级 `Region` 树，并计算 `regionPath`（如 `"<省ID>/<市ID>/<区ID>"`）。

### 7.3 初始账号

- 扩展 `apps/server/prisma/seed.ts`：确保初始 `ADMIN` 存在（沿用 `dev_admin_001` 体系），可绑定某 region 做演示。

### 7.4 兼容注意

- 存量用户 `regionId` 为空，按 `buildScope` 规则：USER 仅看本人（不受影响），AGENT/ADMIN 新建时必填 `regionId`，不存在"无区域 AGENT"的中间态。

---

## 8. 里程碑

| Phase | 内容 | 交付物 | 验收 |
|-------|------|--------|------|
| **P0** ✅ | 数据模型 + 迁移 + 行政区划种子 | [x] `Region`/`User` 扩展 [x] `db push` [x] `seed-regions.ts` | Region 树可查(31/342/2978)，ADMIN 种子就绪，JWT 投影含区域维度（已运行时验证） |
| **P1** ✅ | 后端区域权限 + 管理员接口 | [x] `DataScopeInterceptor` [x] `/api/admin/*` [x] `/api/auth/access` [x] JWT 投影修复 | 接口按 `role+region` 正确收窄（运行时验证：ADMIN scope=ALL/users=5，AGENT scope=REGION 仅见本区 2 条，401 守卫生效） |
| **P2** ✅ | Refine 后台搭起 + accessControlProvider | [x] `apps/admin` 工程 [x] resources [x] 菜单显隐(accessControlProvider) | `apps/admin` `tsc --noEmit` EXIT=0；登录后按 permissions 显隐菜单 |
| **P3** ✅ | Agent 辖区管理 | [x] `/api/admin/agents`(list/create/PATCH region) [x] 前端代理商 CRUD [x] 区域 Cascader | 新建代理商绑定辖区(regionPath=11/1101/110101)，登录后 scope=REGION 仅看本区；`/api/admin/agents` 对非 ADMIN 返回 403 |
| **P4** ✅ | apps/web 菜单显隐修正 | [x] `SiteHeader` 过滤(roles) [x] `RoleRoute` 4 角色 [x] `isAgent` + `role.*` i18n(6 语言) | `apps/web` `tsc --noEmit` EXIT=0；USER 不显服务商/代理商入口，AGENT 显 `/agent/studio` |
| **P5** ✅ | 联调与权限矩阵验收 | [x] 四角色 × 资源权限矩阵走查 [x] 越权用例测试 | 权限矩阵全绿：`ADMIN`=ALL/6权、`AGENT`=REGION/3权、`SERVICE_PROVIDER`/`USER`=SELF/0权；越权 401/403 全部被拦；后端 `nest build` EXIT=0。**P5 走查中补强**：`assignRole` 新增"禁止将任何人提为 ADMIN"守卫（对齐 docs §4.3）、新增 `GET /api/admin/agents/:id` 供前台改辖区页回填；E2E 脚本 `temp/p5-permission-matrix.js` 39/39 通过 |

---

## 9. 附录

### 9.1 术语表

| 术语 | 说明 |
|------|------|
| AGENT | 代理商角色，绑定某行政区域，管辖区内服务商与用户 |
| Region | 行政区域（省/市/区），三级自引用树 |
| regionPath | 区域冗余路径，用于辖区子树前缀匹配 |
| DataScopeInterceptor | 后端数据权限拦截器，按 `role+regionId` 注入查询条件 |
| accessControlProvider | Refine 前端权限 Provider，做 RBAC+ABAC 显隐 |
| ABAC | 基于属性（含区域）的访问控制 |

### 9.2 上游文档索引

| 文档 | 内容 |
|------|------|
| `docs/role-system-handoff.md` | 三层决策层、serviceRoles、providerStatus 闸门、交接状态 |
| `docs/role-layer-redefinition.md` | 角色层重定义、服务商复合多角色语义 |
| `docs/user-role-optimization-plan.md` | USER 侧优化计划与落地状态 |
| `docs/template-pipeline-design.md` | 模板审核/变现闭环（ADMIN 审核台引用） |

### 9.3 已知文档滞后（待后续校正）

- `docs/role-system-handoff.md` 描述"无独立 `pendingServiceRoles` 字段"，但代码已实现 `pendingServiceRoles`（`expand-services` 提交 → `approve-services` 合并），以**代码为准**。本管线不重写上游文档（按范围决策），建议后续在 handoff 文档补一行校正说明。

> **文档维护说明**：本管线方案随实现推进更新，里程碑交付后同步勾选交付物。
