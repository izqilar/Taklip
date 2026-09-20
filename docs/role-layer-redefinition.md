# 角色层重新定义（Role Layer Redefinition）

> **定位**：本文件是 `docs/role-system-handoff.md` 与 `docs/user-role-optimization-plan.md` 的**概念上游**。
> **背景**：平台原"三层角色"中，**设计师（DESIGNER）**的定义跑偏——"升级"只产出单一"设计师"角色。
> 实际业务中，普通用户升级后应是**服务商**，可同时具备多种服务能力（设计 / 摄影 / 场地 / 花艺 / 执事 / 演艺）。
> 本文定义**目标角色模型**（决策层 + 服务角色复合），并将"设计师"语义改造为"服务商"。
> **性质**：纯概念 / 规划定义；代码迁移（第 6 节映射的全部项）已于 2026-08-23 落地，详见两篇下游文档与 `role-system-handoff.md` 的「✅ 代码落地」callout。

---

## 1. 三层决策层（Decision Layers）

平台角色在"决策层（tier）"上严格分为三层，顶层治理与供给 / 消费解耦：

| 决策层 | 含义 | 定位 | 是否可叠加服务角色 |
|---|---|---|---|
| **USER 普通用户** | 平台核心消费者（做 / 发请柬的人） | 消费层 | 否（`serviceRoles` 恒空） |
| **SERVICE_PROVIDER 服务商** | 平台供给侧（原"设计师"的泛化） | 供给层 | 是（1..n 复合） |
| **ADMIN 管理员** | 平台治理方（审核 / 下架 / 角色管理） | 治理层 | 否（治理层，非服务能力） |

**决策层是单值互斥的**：一个用户在任意时刻只处于一层。
- `USER` → 申请入驻 → `SERVICE_PROVIDER`
- `ADMIN` 不能由用户自助获得，仅 DB / 种子赋值（安全约束保留）
- `SERVICE_PROVIDER` **不能**叠加 `ADMIN` 类能力（"不能包含管理层角色"由决策层隔离保证）

---

## 2. 服务商子角色（Service Roles / 服务类型）

服务商不是一个单一角色，而是"具备一种或多种服务能力的供给方"。服务子角色枚举：

| ServiceRole | 中文名 | 业务含义 | 典型供给物 |
|---|---|---|---|
| `DESIGN` | 特约设计 | 请柬 / 模板设计 | 模板、设计作品 |
| `PHOTO` | 光影记录 | 摄影摄像 | 摄影套餐 / 成片 |
| `VENUE` | 宴会场地 | 餐饮 / 场地服务商 | 场地 / 宴席套餐 |
| `FLORAL` | 花艺礼赠 | 插花、礼仪、礼赠 | 花艺 / 伴手礼 |
| `STEWARD` | 仪式执事 | 主持、伴郎伴娘、仪式参与 | 主持 / 执行服务 |
| `PERFORM` | 演艺星团 | 演艺表演团体 | 演出 / 节目 |

> 该枚举是**开放扩展**的：未来新增服务类型只需加枚举值 + 对应供给模块，不改动决策层结构。

---

## 3. 复合角色模型（Composite Model）

目标数据形态：

```prisma
enum Role {
  USER
  SERVICE_PROVIDER   // 原 DESIGNER
  ADMIN
}

enum ServiceRole {     // 新增：服务商子角色
  DESIGN
  PHOTO
  VENUE
  FLORAL
  STEWARD
  PERFORM
}

enum ProviderStatus {  // 原 DesignerStatus
  PENDING
  APPROVED
}

model User {
  role          Role          @default(USER)          // 决策层，单值
  serviceRoles  ServiceRole[]                          // 仅 role=SERVICE_PROVIDER 时 1..n；其余空
  providerStatus ProviderStatus @default(PENDING)     // 仅 SERVICE_PROVIDER 有效
  ...
}
```

组合示例：
- 纯消费者：`role=USER, serviceRoles=[], providerStatus=N/A`
- 单一服务商：`role=SERVICE_PROVIDER, serviceRoles=[DESIGN], providerStatus=APPROVED`
- 复合服务商：`role=SERVICE_PROVIDER, serviceRoles=[PHOTO, FLORAL, STEWARD], providerStatus=APPROVED`
- 管理员：`role=ADMIN, serviceRoles=[], providerStatus=N/A`

**语义要点**
- "普通用户的属性可以设计为多种角色" = 入驻后 `serviceRoles` 可多选复合，但**绝不包含 ADMIN**（治理层不可作为服务属性叠加）。
- `serviceRoles` 决定**能发什么供给**；`providerStatus` 决定**能否发付费供给**。

---

## 4. 入驻 / 升级管线（Onboarding Pipeline）

"升级"与"服务商入驻"是**同一管线**（升级要求与入驻要求一致）：

```
普通用户
  │  点击「申请入驻服务商」
  ▼
[1] 选择服务类型（多选：DESIGN / PHOTO / VENUE / FLORAL / STEWARD / PERFORM）
  ▼
[2] 资质提交 → providerStatus = PENDING
  ▼
[3] 资质审核（混合审核）
      ├─ 当前（轻量自助）：提交即 APPROVED（MVP）
      └─ 目标（平台风控）：管理员在 /admin/review 审核队列通过 → APPROVED
  ▼
[4] 成为 SERVICE_PROVIDER（role 置位，serviceRoles 写入所选）
  ▼
[5] 能力解锁
      ├─ 免费供给：立即可发（按 serviceRoles 对应模块）
      └─ 付费供给：需 providerStatus = APPROVED（否则后端 403 闸门）
```

**闸门规则（与现有混合审核一致，仅把"设计师"泛化为"服务商"）**
- 免费供给：入驻后即可发（按所选 `serviceRoles` 的能力模块）。
- 付费供给：`providerStatus !== APPROVED` → 403（沿用 `template.service` 付费闸门逻辑，扩展为"任一 serviceRole 允许售卖"即对 `providerStatus` 校验）。
- 中途增删服务类型：已入驻服务商可在「服务商设置」追加 / 缩减 `serviceRoles`（新增类型仍需走 [2][3] 审核；缩减即时生效，不影响已上架）。

---

## 5. 决策层权限矩阵（Permission Matrix）

| 能力 | USER | SERVICE_PROVIDER | ADMIN |
|---|---|---|---|
| 做 / 发布请柬（H5） | ✅ | ✅ | ✅ |
| 逛 / 克隆免费模板 | ✅ | ✅ | ✅ |
| 购买 + 使用付费模板 | ✅ | ✅ | ✅ |
| 发免费供给（按 serviceRoles） | ❌ | ✅ | ✅ |
| 发付费供给（需 APPROVED） | ❌ | ✅ | ✅ |
| 收益 / 钱包 / 提现 | ❌ | ✅（按 serviceRoles 入账） | ✅（平台总账，未做） |
| 审核台 / 违规下架 | ❌ | ❌ | ✅ |
| 角色 / 资质管理（审批他人入驻、降权） | ❌ | ❌ | ✅ |
| 申请入驻服务商 | 自助申请 | — | — |

**serviceRoles 对供给的细化**（服务商内部可见性）：

| 服务子角色 | 可见 / 可操作的供给模块 |
|---|---|
| `DESIGN` | 模板库、设计作品 |
| `PHOTO` | 摄影作品集 / 套餐 |
| `VENUE` | 场地 / 宴席套餐 |
| `FLORAL` | 花艺 / 礼赠 |
| `STEWARD` | 主持 / 执行服务 |
| `PERFORM` | 演艺节目 |

> MVP 阶段：工作台以"统一服务商工作台"承载所有已启用 `serviceRoles`；各子角色独立供给模块为后续迭代。

---

## 6. 与现有代码的映射（现状 → 目标，已于 2026-08-23 全部落地）

| 概念 | 代码现状（handoff 快照） | 目标（本文档） | 迁移动作（已落地） |
|---|---|---|---|
| 中层角色 | `Role.DESIGNER` | `Role.SERVICE_PROVIDER` | ✅ 改枚举值 |
| 资质状态 | `User.designerStatus`（PENDING/APPROVED） | `User.providerStatus` | ✅ 字段改名 |
| 升级接口 | `POST /api/auth/upgrade-role` → `upgradeToDesigner` | `POST /api/auth/apply-provider` → `applyForProvider({ serviceRoles })` | ✅ 接口 / 方法改签名 |
| 审核提交 | `POST /api/auth/submit-designer-review` | `POST /api/auth/submit-provider-review` | ✅ 端点改名 |
| 多角色 | 无 | `User.serviceRoles ServiceRole[]` | ✅ **新增字段**（PostgreSQL 标量列表）已写入 schema + 前端 UserInfo + 入驻多选弹窗 |
| 前端标志 | `isDesigner` / `isDesignerApproved` | `isProvider` / `isProviderApproved` | ✅ store 派生改名 |
| 工作台路由 | `/designer/studio` `/designer/wallet` | `/provider/studio` `/provider/wallet`（旧路径已留别名重定向） | ✅ 路由改名 |
| 种子账号 | `dev_designer_001 (DESIGNER)` | `dev_provider_001 (SERVICE_PROVIDER, serviceRoles=[DESIGN], APPROVED)` | ✅ 种子改寫 |

> ✅ **代码现状（2026-08-23）**：`DESIGNER`→`SERVICE_PROVIDER`、`designerStatus`→`providerStatus`、`serviceRoles` 复合角色、`isDesigner`→`isProvider` 等迁移**已全部落地**（后端 schema/auth/template/wallet/order + 前端 client/authStore/App/SiteHeader/Profile/Settings/ProviderStudio/ProviderWallet/i18n 六语言）；入驻（`apply-provider`，多选 serviceRoles）与资质审核（`submit-provider-review`）接口已上线。本文档定义的"服务商"模型已从目标态变为代码实态。

---

## 7. 关键决策与边界（已确认）

- 三层决策层结构不变（USER / 服务商 / ADMIN）；"设计师"是服务商的**一种子角色**，不再是独立中层。
- 服务商可复合多服务角色；ADMIN 不可作为服务属性叠加（决策层隔离）。
- 入驻 = 升级，单一管线；付费供给闸门保留混合审核。
- 服务子角色枚举开放扩展。

---

## 8. 待下游文档落地 / 标注

- `docs/role-system-handoff.md`：以本文档为上游，将 DESIGNER 语义改为 SERVICE_PROVIDER + serviceRoles，并标注代码现状（见文内「概念迁移」callout）。
- `docs/user-role-optimization-plan.md`：P1 决策改为"服务商入驻混合审核（多角色复合）"；Phase 4 改为"服务商入驻引导（多选服务类型）"；全局"设计师"措辞改为"服务商"口径。
