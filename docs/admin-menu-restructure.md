# 庆柬云管理后台 · UI 与菜单优化开发文档

> 目标：按"管理总台 / 代理商中心 / 服务商中心 / 用户中心"四层架构重构后台菜单，新增「评价与反馈中心」「消息中心」两大模块，统一权限与命名规范。
> 适用范围：`apps/admin`（Refine + antd 后台，端口 5174）。用户中心落在 web 端，后台仅保留「用户管理」监督入口。

---

## 1. 现状基线

| 项 | 现状 |
|---|---|
| 菜单 | 扁平 8 项，无分组、无图标 |
| 分组能力 | Refine 原生支持 `meta.parent`，无需自定义 Menu |
| 权限 | `accessControlProvider.can()` 经 `permFor` 映射 `permissions[]` 做菜单显隐；未映射资源默认可见 |
| 数据作用域 | 前端无 DataScopeInterceptor，辖区隔离 100% 靠后端按 JWT 过滤 |
| 业务页面 | 已有：dashboard / users / agents / provider-review / wallets / withdrawals / orders / regions |
| 缺失页面 | 消息中心 / 评价与反馈 / 投诉 全部为零 |
| 命名坑 | `wallets.tsx` 取数用 `resource:'wallet'`，菜单却是 `admin/wallets`，前缀不一致 |

---

## 2. 四层菜单架构（定稿）

### 2.1 后台资源树（最终结构）

```
管理总台 (admin/console)                [ADMIN]
├─ 数据看板          admin/dashboard
├─ 用户管理          admin/users            (监督全部 app 用户)
├─ 代理商管理        admin/agents
├─ 服务商审核        admin/provider-review
├─ 区域管理          admin/regions          (统一加 admin/ 前缀，原 'regions')
├─ 财务中心          admin/finance          (父分组)
│   ├─ 钱包总览      admin/wallets
│   ├─ 提现审核      admin/withdrawals
│   └─ 订单管理      admin/orders
├─ 评价与反馈中心    admin/feedback
├─ 升级反馈仲裁      admin/feedback-review  (总台处理升级工单)
├─ 消息中心          admin/messages
├─ 权威公告审核      admin/message-audit
└─ 系统设置          admin/settings

代理商中心 (agent/center)              [AGENT · 辖区]
├─ 辖区概览          agent/dashboard
├─ 辖区用户          agent/users            (后端 regionPath 过滤)
├─ 辖区服务商        agent/providers
├─ 辖区订单          agent/orders
├─ 结算与钱包        agent/wallet
├─ 评价与反馈中心    agent/feedback         (辖区纠纷协商/可升级)
└─ 消息中心          agent/messages         (含「我的待审」)

服务商中心 (sp/center)                 [SERVICE_PROVIDER]
├─ 我的工作台        sp/studio
├─ 服务管理          sp/services
├─ 订单处理          sp/orders
├─ 资质管理          sp/qualification
├─ 钱包与提现        sp/wallet
├─ 评价与反馈中心    sp/feedback            (我的反馈/被诉回应/申诉)
└─ 消息中心          sp/messages            (仅一般消息)

用户中心 → web 端 (apps/web)，后台仅保留「用户管理」入口
```

### 2.2 角色 → 可见模块映射

| 角色 | 可见视图 | 数据作用域 |
|---|---|---|
| ADMIN | 管理总台（全菜单） | ALL |
| AGENT | 代理商中心 | REGION（regionPath 前缀） |
| SERVICE_PROVIDER | 服务商中心 | SELF（自身） |
| USER | 不进后台，走 web 端用户中心 | 自身 |

---

## 3. 实施一：菜单分组重构（纯前端）

### 3.1 resources 重组（`src/App.tsx`）

父分组项用「只有 `name` + `meta.label` + 无 `list`」声明；子项加 `meta.parent` 指向父 `name`。Refine `useMenu` 默认对无可见子项的分组头自动隐藏。

```ts
const resources = [
  { name: 'admin/console', meta: { label: '管理总台', icon: <AppstoreOutlined /> } },
  { name: 'admin/dashboard', list: '/admin/dashboard', meta: { label: '数据看板', parent: 'admin/console' } },
  { name: 'admin/users', list: '/admin/users', show: '/admin/users/show/:id', edit: '/admin/users/edit/:id', meta: { label: '用户管理', parent: 'admin/console' } },
  { name: 'admin/agents', list: '/admin/agents', create: '/admin/agents/create', edit: '/admin/agents/edit/:id', meta: { label: '代理商管理', parent: 'admin/console' } },
  { name: 'admin/provider-review', list: '/admin/provider-review', meta: { label: '服务商审核', parent: 'admin/console' } },
  { name: 'admin/regions', list: '/regions', meta: { label: '区域管理', parent: 'admin/console' } },
  { name: 'admin/finance', meta: { label: '财务中心', parent: 'admin/console' } },
  { name: 'admin/wallets', list: '/admin/wallets', meta: { label: '钱包总览', parent: 'admin/finance' } },
  { name: 'admin/withdrawals', list: '/admin/withdrawals', meta: { label: '提现审核', parent: 'admin/finance' } },
  { name: 'admin/orders', list: '/admin/orders', meta: { label: '订单管理', parent: 'admin/finance' } },
  { name: 'admin/feedback', list: '/admin/feedback', meta: { label: '评价与反馈中心', parent: 'admin/console' } },
  { name: 'admin/feedback-review', list: '/admin/feedback/escalated', meta: { label: '升级反馈仲裁', parent: 'admin/console' } },
  { name: 'admin/messages', list: '/admin/messages', meta: { label: '消息中心', parent: 'admin/console' } },
  { name: 'admin/message-audit', list: '/admin/messages/audit', meta: { label: '权威公告审核', parent: 'admin/console' } },
  { name: 'admin/settings', list: '/admin/settings', meta: { label: '系统设置', parent: 'admin/console' } },

  { name: 'agent/center', meta: { label: '代理商中心', icon: <ApartmentOutlined /> } },
  { name: 'agent/dashboard', list: '/agent/dashboard', meta: { label: '辖区概览', parent: 'agent/center' } },
  { name: 'agent/users', list: '/agent/users', meta: { label: '辖区用户', parent: 'agent/center' } },
  { name: 'agent/providers', list: '/agent/providers', meta: { label: '辖区服务商', parent: 'agent/center' } },
  { name: 'agent/orders', list: '/agent/orders', meta: { label: '辖区订单', parent: 'agent/center' } },
  { name: 'agent/wallet', list: '/agent/wallet', meta: { label: '结算与钱包', parent: 'agent/center' } },
  { name: 'agent/feedback', list: '/agent/feedback', meta: { label: '评价与反馈中心', parent: 'agent/center' } },
  { name: 'agent/messages', list: '/agent/messages', meta: { label: '消息中心', parent: 'agent/center' } },

  { name: 'sp/center', meta: { label: '服务商中心', icon: <ShopOutlined /> } },
  { name: 'sp/studio', list: '/sp/studio', meta: { label: '我的工作台', parent: 'sp/center' } },
  { name: 'sp/services', list: '/sp/services', meta: { label: '服务管理', parent: 'sp/center' } },
  { name: 'sp/orders', list: '/sp/orders', meta: { label: '订单处理', parent: 'sp/center' } },
  { name: 'sp/qualification', list: '/sp/qualification', meta: { label: '资质管理', parent: 'sp/center' } },
  { name: 'sp/wallet', list: '/sp/wallet', meta: { label: '钱包与提现', parent: 'sp/center' } },
  { name: 'sp/feedback', list: '/sp/feedback', meta: { label: '评价与反馈中心', parent: 'sp/center' } },
  { name: 'sp/messages', list: '/sp/messages', meta: { label: '消息中心', parent: 'sp/center' } },
];
```

### 3.2 命名一致性修复
- `src/pages/wallets.tsx` 取数 `resource` 由 `'wallet'` 改为 `'admin/wallets'`，与菜单权限判定一致。

---

## 4. 实施二：权限映射扩展（`accessControlProvider.ts`）

`permFor` 扩充新模块权限串；新增 `canSeeByRole()` 按登录角色控制四层分组可见性（前端菜单显隐，数据权限仍由后端保证）。未映射资源保持 `null`（默认可见，避免误隐藏分组头）。

```ts
function permFor(resource: string, action: string): string | null {
  if (action === 'user:role') return 'user:role';
  if (resource === 'admin/users') return action === 'edit' ? 'user:update' : 'user:read';
  if (resource === 'admin/provider-review') return 'provider:review';
  if (resource === 'admin/agents') return 'agent:manage';
  if (resource === 'admin/regions') return 'region:read';
  if (resource === 'admin/wallets') return 'wallet:read';
  if (resource === 'admin/withdrawals') return 'wallet:manage';
  if (resource === 'admin/orders') return 'order:read';
  if (resource === 'admin/dashboard') return 'user:read';
  if (resource === 'admin/feedback') return 'feedback:read';
  if (resource === 'admin/feedback-review') return 'feedback:review';
  if (resource === 'agent/feedback') return 'feedback:agent';
  if (resource === 'sp/feedback') return 'feedback:own';
  if (resource === 'admin/messages') return 'message:read';
  if (resource === 'admin/message-audit') return 'message:audit';
  if (resource === 'agent/messages') return 'message:agent';
  if (resource === 'sp/messages') return 'message:own';
  return null;
}

function canSeeByRole(resource: string | undefined, role: string | undefined): boolean | null {
  if (!resource) return null;
  if (resource === 'admin/console' || resource === 'admin/finance') return role === 'ADMIN';
  if (resource.startsWith('agent/')) return role === 'AGENT' || role === 'ADMIN';
  if (resource.startsWith('sp/')) return role === 'SERVICE_PROVIDER' || role === 'ADMIN';
  return null;
}
```

**后端配套**：`auth.service.getAccess()` 需为各角色补齐 `feedback:*` / `message:*` 权限串；`DataScopeInterceptor` 按 `role+regionPath` 注入 where（ADMIN=ALL、AGENT=REGION、SERVICE_PROVIDER=SELF）。

---

## 5. 实施三：评价与反馈中心（新建模块）

### 5.1 类型与状态机
- 反馈类型枚举：`COMPLAINT`(投诉) / `PRAISE`(好评感谢) / `SUGGESTION`(建议) / `CONSULT`(咨询) / `APPEAL`(申诉)
- 状态机：`PENDING` → `NEGOTIATING`(协商中, AGENT) → `ESCALATED`(已升级) → `ARBITRATING`(仲裁中, ADMIN) → `CLOSED`
- 升级链路：用户/服务商发起 → 辖区代理商协商 → 协商不成转总台仲裁（`escalatedTo` 标记）

### 5.2 各角色页面分支（同一 `feedback.tsx`，按当前角色渲染）
- ADMIN：`admin/feedback`（全部）+ `admin/feedback-review`（ESCALATED 队列）
- AGENT：`agent/feedback`（辖区内 regionPath 过滤，可协商/升级）
- SP：`sp/feedback`（被诉回应/申诉，向上层咨询）

### 5.3 后端接口约定（REST）
```
GET  /api/feedback              ?status=&type=&scope=  列表（受 DataScopeInterceptor 隔离）
POST /api/feedback              发起反馈 { type, targetId, content }
PATCH /api/feedback/:id/negotiate  代理商协商回复
POST /api/feedback/:id/escalate    升级转总台
PATCH /api/feedback/:id/arbitrate  总台仲裁/关闭
```
> 后端模块：`apps/server/src/ticket/`（controller/service/dto + Prisma model `Feedback`）。

---

## 6. 实施四：消息中心（新建模块）

### 6.1 消息类型与范围约束
| 角色 | 发布范围 | 权威公告(ANNOUNCEMENT) | 一般消息(NOTICE) | 诉求(APPEAL) |
|---|---|---|---|---|
| 总台 | 全局 / 指定区域 | ✅ 直发 | ✅ | — |
| 代理商 | 仅本辖区 | ⚠️ 需总台审核 | ✅ 直发 | — |
| 服务商 | 自身用户 / 上级 | ❌ | ✅ | — |
| 用户 | 相关服务商 | ❌ | ✅ | ✅ |

### 6.2 子菜单
- 总台：`消息中心`(收件箱+发布) / `权威公告审核`(审批代理商提交的 ANNOUNCEMENT)
- 代理商：`消息中心`(收件箱+发布) / 发布页内含「我的待审」状态
- 服务商 / 用户：仅收件箱 + 一般消息发布

### 6.3 组件复用
- 收件箱：`List` + `useTable`，`receiverId/scope` 过滤
- 发布框：表单（类型 Radio + 范围 Select + 内容 TextArea）；代理商选 ANNOUNCEMENT 时 `status=DRAFT` 进审核队列
- 审核：`admin/message-audit` 列表 + 批准/驳回（`PATCH /api/messages/:id/audit`）

### 6.4 后端接口约定（REST）
```
GET  /api/messages            ?folder=inbox|sent&scope=   收件箱/已发
POST /api/messages            发布 { type, scope, regionPath?, receiverIds?, content }
GET  /api/messages/audit      待审权威公告（ADMIN）
PATCH /api/messages/:id/audit  批准/驳回
```
> 后端模块：`apps/server/src/message/`（controller/service/dto + Prisma model `Message`）。

---

## 7. 实施五（增强，可选）：数据作用域上下文

新增 `useAccessInfo()` Context（`apps/admin/src/context/accessInfo.tsx`）：登录后从 `GET /auth/access` 存入 Context（而非仅 provider 内存 cache），暴露 `{ role, regionId, regionPath, scope, permissions }` 供页面消费。非必做项，辖区数据隔离仍由后端保证。

---

## 8. 落地任务分解（建议顺序）

| 阶段 | 任务 | 交付 |
|---|---|---|
| P1 | `App.tsx` resources 重组 + 图标 + `regions` 前缀统一 | 四层菜单可见 |
| P2 | `accessControlProvider.permFor` 扩展 + `wallets.tsx` 前缀修复 | 按角色显隐 |
| P3 | 后端 `ticket` 模块 + `feedback.tsx`（三角色分支） | 评价与反馈中心可用 |
| P4 | 后端 `message` 模块 + `messages.tsx`（收件箱/发布/审核） | 消息中心可用 |
| P5 | `typecheck` + 角色显隐/发布范围/反馈升级流 E2E 验证 | 验收 |

## 9. 风险与注意事项
1. **权限串默认可见**：未映射资源 `permFor` 返回 `null` → 默认可见。新增分组父项务必保持 `null` 或显式映射，避免子项全不可见时分组头误显/误隐。
2. **命名统一**：所有后台 resource 统一 `admin/` 前缀，避免 `wallet` 类错位。
3. **后端强依赖**：消息/反馈两大模块需后端 `ticket`/`message` 模块与 `getAccess` 权限串补齐，否则前端页面无数据。
4. **scope 注入**：纯前端无法注入 `regionPath`；辖区/自身隔离依赖后端 `DataScopeInterceptor`，前端仅传 filters。

## 10. 落地产物文件清单
- 改：`apps/admin/src/App.tsx`、`src/providers/accessControlProvider.ts`、`src/pages/wallets.tsx`
- 新建：`src/pages/feedback.tsx`、`src/pages/messages.tsx`、`src/pages/settings.tsx`、`src/pages/Placeholder.tsx`
- 后端新建：`apps/server/src/ticket/**`、`apps/server/src/message/**`
- 后端改：`apps/server/src/auth/auth.service.ts`(getAccess 补串)
- 文档：`docs/admin-menu-restructure.md`

---

## 11. 实现状态（2026-08-26 落地）

P1–P4 已全部实现并验证通过：

| 模块 | 状态 | 验证 |
|---|---|---|
| 四层菜单分组（P1） | ✅ | admin typecheck + 前端 5174 在线 |
| 权限映射（P2） | ✅ | `getAccess` 已含 `feedback:*`/`message:*` 串 |
| 评价与反馈中心（P3） | ✅ | `POST/GET/escalate/resolve` 经 curl 验证；升级流（AGENT→ADMIN）可用 |
| 消息中心（P4） | ✅ | 权威公告审核流（AGENT 发→PENDING→ADMIN 审核→PUBLISHED）经 curl 验证；SP 仅可发 NOTICE 已验证 |

---

## 12. 权威还原文档（取代本文件作为 UI 还原依据）

> 本文件记录「四层菜单分组 + 评价与反馈/消息中心模块」的重构过程与产物，属于**过程文档**。
> **UI 原型按原样还原到运营端的唯一权威依据**为：`docs/庆柬云 · 运营端UI还原标准开发文档.md`
> （整合原型 `UI_Design/ui-run/console/index.html` + 设计契约 A + 技术契约 B，含 15 章 + 原型→代码逐页追溯附录 + 实现任务清单）。新功能开发请以该标准文档为准，本文件仅作历史参考。

### 后端模型（Prisma）
- `Ticket`（含 `TicketType`/`TicketStatus` 枚举，reporter/target/assignee 三方关系，regionPath 辖区作用域）
- `Message`（含 `MessageType`/`MessageScope`/`MessageStatus` 枚举，author 关系，regionPath/targetRole 作用域）

### 作用域规则（前端仅传 filters，真实隔离在后端）
- **Ticket.list**：ADMIN 全量；AGENT `regionPath` 前缀匹配 + 本人认领；SP 被诉/本人发起；USER 本人发起。
- **Message.inbox**：ADMIN 见全部已发布；其余按 `scope` 过滤（GLOBAL 全可见 / REGION regionPath 前缀 / OWN targetRole 匹配）。
- **Message.create** 角色约束：ADMIN 可 ANNOUNCEMENT/NOTICE（全局或区域）；AGENT 可 ANNOUNCEMENT(→PENDING 待审)/NOTICE（辖区）；SP 仅 NOTICE（指定角色）；USER 后台不接受直发。
