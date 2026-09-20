# 庆柬云 · 运营端开发文档（React \+ Refine \+ Ant Design 5）

> 部分内容由豆包生成
> 
> 

> 版本：v2\.0（2026\-08\-28）｜依据：已验收 UI 原型 index\.html \+ 真实项目技术栈｜状态：技术实现契约，供运营端（apps/admin）开发落地
> 
> 

# 文档说明

本文档将已验收的「庆柬云 · 分层管理后台」UI 原型，按真实项目技术栈（React 18 \+ Refine \+ Ant Design 5 \+ NestJS/Prisma/PostgreSQL/Redis）翻译为可直接执行的开发契约。读者：运营端前端工程师、服务端工程师、技术负责人。范围：工程结构、Refine 装配、角色权限、Prisma 数据模型、页面与对话框实现规格、设计系统、API 契约与验收清单。

术语：与原型一致——总台（ADMIN 管理总台）、代理商（AGENT）、服务商（SERVICE\_PROVIDER）、用户（USER）；「视角」指页头切换进入某角色层的工作界面；「对象视角」指在角色层内检索并切换到具体对象，查看其名下数据。

约定：本文档所有代码为 TypeScript；路径相对 monorepo 根；接口前缀统一 `/api`；品牌名沿用原型「庆柬云」。

# 技术栈与工程结构

## 技术栈总览

|端|技术|版本|职责|
|---|---|---|---|
|服务端 apps/server|NestJS \+ Prisma|NestJS 10 / Prisma 5|REST API、鉴权、RBAC/ABAC、审核、财务、消息|
|数据库|PostgreSQL（Docker h5design\-postgres）|PG 15\+|业务与权限数据持久化|
|缓存/队列|Redis（Docker h5design\-redis）|Redis 7|会话缓存、计数、消息队列、幂等键|
|运营端 apps/admin|React \+ Refine \+ AntD|React 18 / Refine 4 / AntD 5|四层管理后台 UI（本文档主体）|
|用户端 apps/web|React 18 \+ Vite 5 \+ Konva 9|—|用户端 / H5 编辑器（本文档不展开）|
|共享包 packages/core|类型与工厂函数|—|跨端共享 TS 类型、枚举、状态标签映射、工厂|

## Monorepo 结构

```text
h5design/
├─ apps/
│  ├─ server/                # NestJS：/api
│  │  ├─ src/modules/        # auth / users / regions / agents / providers /
│  │  │                      # templates / orders / wallet / feedback / messages / roles / settings
│  │  └─ prisma/             # schema.prisma、migrations、seed
│  ├─ web/                   # 用户端 / H5 编辑器（端口 5173）
│  └─ admin/                 # 运营端（端口 5174）—— 本文档主体
│     ├─ src/
│     │  ├─ providers/       # dataProvider / authProvider / accessControlProvider / i18n
│     │  ├─ pages/           # console/ agent/ provider/ user 四层页面
│     │  ├─ components/      # 通用列表、详情抽屉、状态标签、对象选择器
│     │  ├─ config/          # resources、主题 token、常量
│     │  └─ App.tsx          # Refine 装配入口
│     └─ vite.config.ts
├─ packages/
│  └─ core/                  # src/types.ts、src/enums.ts、src/factory.ts、src/status.ts
├─ pnpm-workspace.yaml
├─ docker-compose.yml        # h5design-postgres / h5design-redis
└─ package.json
```

## pnpm 与依赖

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

运营端核心依赖：`@refinedev/core`、`@refinedev/antd`、`@refinedev/react-router-v6`、`antd`、`react`、`react-router-dom`、`@tanstack/react-query`、`dayjs`、`react-i18next`、`i18next`、`@h5design/core`（workspace 依赖）。

# 总体架构

## 分层登录模型

|层|角色枚举|菜单数|数据作用域|首页|
|---|---|---|---|---|
|管理总台|ADMIN|13（超集）|ALL（全平台）|经营总览|
|代理商中心|AGENT|8|REGION（本辖区，regionPath 前缀）|辖区概览|
|服务商中心|SERVICE\_PROVIDER|8|SELF（自身）|我的工作台|
|用户视角|USER|7|SELF（单用户）|用户工作台|

登录即定层：JWT 携带 `role` 与 `scope`（regionPath / selfId），前端按层投影菜单，后端按层强制隔离数据。

## 视角切换

总台账号可在「总台 / 代理商 / 服务商 / 用户」四视角间切换（页头 segmented）。切换后侧栏菜单、面包屑、首页、数据作用域、列表接口参数整体联动；三层各有独立首页。总台管理员可进入对象视角：在角色层内按 ID / 用户名 / 昵称 / 手机号 / 区域检索具体对象，整页数据切换到该对象名下（后端聚合接口返回对象 KPI \+ 列表）。

## 可写 / 只读模型

页头账号菜单在「超级管理员（可写 · 可代操作）」与「运维管理员（只读 · 默认只读，单独授权可写）」间切换。只读态：黄色提示条、主操作禁用、行内通过 / 驳回 / 编辑锁定，仅保留查看与导出。后端对只读会话拒绝非 GET 写请求（`403`）。

## 数据隔离（regionPath 注入）

区域表维护 `regionPath`（如 `乌鲁木齐/天山区`）；代理商绑定辖区；服务商挂所属区域与服务类型；订单 / 反馈 / 消息关联主体。后端以当前登录主体推导可见域，所有列表接口注入 `where` 过滤，杜绝越层取数；前端仅负责展示。

# 运营端 Refine 工程装配

## 应用初始化

```tsx
import { Refine, Authenticated } from '@refinedev/core';
import { RefineThemedLayoutV2, ErrorComponent } from '@refinedev/antd';
import { dataProvider } from './providers/dataProvider';
import { authProvider } from './providers/authProvider';
import { accessControlProvider } from './providers/accessControlProvider';
import { i18nProvider } from './providers/i18n';
import { resources } from './config/resources';
import { App as AntdApp, ConfigProvider } from 'antd';
import { antdTheme } from './config/theme';

export default function App() {
  return (
    <ConfigProvider theme={antdTheme}>
      <AntdApp>
        <Refine
          dataProvider={dataProvider}
          authProvider={authProvider}
          accessControlProvider={accessControlProvider}
          i18nProvider={i18nProvider}
          resources={resources}
          options={{ syncWithLocation: true, warnWhenUnsavedChanges: true }}
        >
          <Authenticated key="app">
            <RefineThemedLayoutV2 Sider={LayerSider} Header={LayerHeader}>
              <Routes />
            </RefineThemedLayoutV2>
          </Authenticated>
        </Refine>
      </AntdApp>
    </ConfigProvider>
  );
}
```

要点：`LayerSider` 按当前视角（console / agent / provider / user）过滤资源菜单并渲染分组与角标；`LayerHeader` 承载视角切换 segmented、账号模式（可写 / 只读）与「返回总台」按钮。

## dataProvider 设计

自定义 dataProvider 直连 `/api`，实现 Refine 标准方法并追加 `custom` 用于审核、导出与对象视角聚合。

|方法|HTTP|路径|说明|
|---|---|---|---|
|getList|GET|/api/:resource|分页 / 排序 / 筛选 / 关键词；返回 items \+ total|
|getOne|GET|/api/:resource/:id|详情|
|create|POST|/api/:resource|新建（含「＋新建」入口页面）|
|update|PATCH|/api/:resource/:id|编辑保存|
|deleteOne|DELETE|/api/:resource/:id|按需启用|
|custom|POST|按 action 映射|approve / reject / export / view\-scope / adjust\-user|

```ts
async getList({ resource, pagination, sorters, filters, meta }) {
  const params = buildQuery({ pagination, sorters, filters, meta }); // 见 API 契约章
  const res = await http.get(`/api/${resource}`, { params });
  return { data: res.data.items, total: res.data.total };
}
```

## authProvider（JWT）

```ts
export const authProvider: AuthProvider = {
  login: async ({ username, password }) => {
    const { data } = await http.post('/api/auth/login', { username, password });
    localStorage.setItem('token', data.accessToken);
    localStorage.setItem('me', JSON.stringify(data.user)); // role / scope / layer
    return { success: true, redirectTo: '/' };
  },
  logout: async () => { localStorage.clear(); return { success: true }; },
  check: async () => {
    const token = localStorage.getItem('token');
    return token ? { authenticated: true } : { authenticated: false, redirectTo: '/login' };
  },
  getIdentity: async () => JSON.parse(localStorage.getItem('me') || 'null'),
  getPermissions: async () => {
    const me = JSON.parse(localStorage.getItem('me') || '{}');
    return me.role; // 或 me.permissions 权限点数组
  },
};
```

## accessControlProvider（RBAC / ABAC）

```ts
export const accessControlProvider: AccessControlProvider = {
  can: async ({ resource, action, params }) => {
    const me = getIdentity();
    // 数据作用域维度：resource 是否在该层菜单可见
    if (!inLayer(me.layer, resource)) return { can: false, reason: '当前层级无权访问' };
    // 功能权限维度：权限点检查（如导出需 data:export）
    if (action === 'export' && !me.permissions.includes('data:export')) {
      return { can: false, reason: '缺少导出权限' };
    }
    // 位阶维度：只读账号仅允许 list / show
    if (me.readonly && !['list', 'show'].includes(action)) {
      return { can: false, reason: '当前账号为只读，不可写操作' };
    }
    return { can: true };
  },
};
```

## resources 与动态菜单

resources 为「总台 13 项超集」，每项带 `meta.layer` 与 `meta.group`；`LayerSider` 按当前视角过滤渲染。

```ts
export const resources: ResourceProps[] = [
  { name: 'dashboard', list: '/', meta: { label: '经营总览', layer: 'console', group: '总览与治理', icon: 'Layout' } },
  { name: 'regions', list: '/regions', meta: { label: '区域管理', layer: 'console', group: '总览与治理', icon: 'Environment' } },
  { name: 'agents', list: '/agents', meta: { label: '代理商管理', layer: 'console', group: '总览与治理' } },
  { name: 'providers', list: '/providers', meta: { label: '服务商管理', layer: 'console', group: '总览与治理', badge: 12 } },
  { name: 'users', list: '/users', meta: { label: '用户管理', layer: 'console', group: '运营监管' } },
  { name: 'templates', list: '/templates', meta: { label: '模板审核', layer: 'console', group: '运营监管' } },
  { name: 'orders', list: '/orders', meta: { label: '订单管理', layer: 'console', group: '运营监管' } },
  { name: 'wallets', list: '/wallets', meta: { label: '钱包总览', layer: 'console', group: '财务中心' } },
  { name: 'withdrawals', list: '/withdrawals', meta: { label: '提现审核', layer: 'console', group: '财务中心', badge: 3 } },
  { name: 'feedback', list: '/feedback', meta: { label: '评价与反馈中心', layer: 'console', group: '评价与反馈中心' } },
  { name: 'messages', list: '/messages', meta: { label: '消息中心', layer: 'console', group: '消息中心' } },
  { name: 'roles', list: '/roles', meta: { label: '角色与权限', layer: 'console', group: '系统' } },
  { name: 'settings', list: '/settings', meta: { label: '系统设置', layer: 'console', group: '系统' } },
  // 代理商 / 服务商 / 用户层资源（layer: agent | provider | user）
  { name: 'a-users', list: '/agent/users', meta: { label: '辖区用户', layer: 'agent', group: '代理商中心' } },
  { name: 'a-providers', list: '/agent/providers', meta: { label: '辖区服务商', layer: 'agent', group: '代理商中心' } },
  // ... 完整 36 个资源见附录「四层资源清单」
];
```

## 路由与页面挂载

采用 `react-router-dom` \+ Refine 布局：登录页 `/login`；四层首页与列表页按资源注册；对象视角页复用同一路由组件，读取 `?object=AG001&layer=agent` 查询参数并请求聚合接口。页面级懒加载（`React.lazy`）控制首屏体积。

# 角色与权限

## 角色类型与位阶

总台管理员展开为 5 个职能角色，位阶从高到低：超级管理员 → 运维管理员 → 服务审核员 = 财务管理员 → 在线客服。其他决策层可在管辖范围内设立同类职能角色，并支持自定义角色。

- 超级管理员：所有内容可读可写，可创建 / 授权角色。

- 运维管理员：所有内容默认可读，部分可写（开通权限）。

- 服务审核员：只读 \+ 总台审核类内容（入驻 / 模板 / 公告 / 申诉）。

- 财务管理员：全权处理提现等财务内容（提现 / 钱包 / 流水 / 对账）。

- 在线客服：答复各类问题，除查询回复外无实质业务权限。

## 权限三要素

每条角色记录：归属层级 × 类型（内置 / 自定义）× 职能，叠加数据作用域（ALL / REGION / SELF）、功能权限（权限点勾选集合）、授权边界（数据 / 功能 / 位阶）。底层角色权限不得触达高层权限范围。

## 功能权限点（10 域 28 点）

|\#|功能域|权限点 key（checkbox）|
|---|---|---|
|①|用户与账号|user:view / user:edit|
|②|入驻与服务商|provider:review / provider:qualification / provider:upgrade|
|③|服务与内容|template:publish / content:offline / template:review / qualification:manage|
|④|订单与履约|order:view / order:handle / order:after\-sale|
|⑤|财务|finance:view / withdrawal:review / withdrawal:operate / finance:reconcile|
|⑥|优惠券与权益|coupon:config / coupon:issue / coupon:view|
|⑦|评价与申诉|feedback:handle / appeal:arbitrate|
|⑧|消息与公告|announce:publish / announce:review / message:send|
|⑨|组织与系统|role:manage / region:manage / settings:manage|
|⑩|数据导出|data:export|

## 三层功能域映射

|层级|展示功能域|隐藏|
|---|---|---|
|总台|①\~⑩ 全 10 域|—|
|代理商|①②④⑤⑥⑦⑧⑨⑩|③ 服务与内容|
|服务商|③④⑤⑦⑧⑩|①②⑥⑨|

## 权限落地（ABAC 策略）

```ts
@Injectable()
export class AbacGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user;                 // role / scope(regionPath|selfId) / perms[]
    const { resource, action } = metaOf(ctx); // 由 @Abac('providers', 'review') 注入
    // 1 位阶：只读账号拒绝写动作
    if (user.readonly && !READONLY_OK.has(action)) return false;
    // 2 功能权限
    if (!user.perms.includes(permKey(resource, action))) return false;
    // 3 数据作用域：注入 where（regionPath 前缀 / selfId）
    req.scopeWhere = buildScopeWhere(user);
    return true;
  }
}
```

# 数据模型（Prisma）

## 核心模型概览

模型按「主体（User/Agent/ServiceProvider）→ 业务（Service/Template/Order）→ 资金（Wallet/Ledger/Withdrawal）→ 治理（Feedback/Message/Announcement）→ 权限（Role/Permission/UserRole）→ 权益（Coupon/UserCoupon）」组织；`regionPath` 为字符串前缀路径，是数据隔离的唯一权威字段。

## Prisma schema（节选）

```prisma
enum RoleType { USER SERVICE_PROVIDER AGENT ADMIN }

model User {
  id          String   @id @default(cuid())
  username    String   @unique
  password    String
  role        RoleType
  name        String
  phone       String?
  regionPath  String?           // 隔离前缀，如 '乌鲁木齐/天山区'
  status      Status
  tier        MemberTier        // USER 的会员等级
  balance     Int      @default(0)
  points      Int      @default(0)
  createdAt   DateTime @default(now())
  agent       Agent?
  provider    ServiceProvider?
}

model Region {
  id         String   @id @default(cuid())
  name       String
  level      RegionLevel        // PROVINCE / CITY / DISTRICT
  regionPath String   @unique   // '乌鲁木齐/天山区'
  agentId    String?
  agent      Agent?   @relation(fields: [agentId], references: [id])
}

model Agent {
  id        String   @id @default(cuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id])
  regionId  String
  region    Region   @relation(fields: [regionId], references: [id])
  status    AgentStatus         // NORMAL / REVIEW / DISABLED
  monthlyFlow Int    @default(0)
}

model ServiceProvider {
  id          String   @id @default(cuid())
  userId      String   @unique
  user        User     @relation(fields: [userId], references: [id])
  type        String   // 婚庆主持 / 摄影摄像 ...
  regionPath  String
  status      ProviderStatus    // PENDING_REVIEW / APPROVED / REJECTED / REVIEWING / UPGRADING
  qualification Json?            // 资质项数组
}

model Service {
  id          String  @id @default(cuid())
  providerId  String
  name        String
  type        String
  price       Int
  status      ServiceStatus      // ON_SALE / DRAFT / OFF_SHELF
  template    Boolean @default(false) // 模板审核复用
}

model Order {
  id        String   @id @default(cuid())
  orderNo   String   @unique
  userId    String
  providerId String
  serviceId String
  amount    Int
  status    OrderStatus          // PENDING_ACCEPT / IN_PROGRESS / DONE / AFTER_SALE
  createdAt DateTime @default(now())
}

model Wallet {
  id        String  @id @default(cuid())
  ownerType String  // AGENT / PROVIDER
  ownerId   String
  balance   Int
  frozen    Int
  totalFlow Int
}

model Ledger {
  id        String   @id @default(cuid())
  walletId  String
  type      LedgerType // IN / PENDING / OUT
  amount    Int
  balanceAfter Int
  createdAt DateTime @default(now())
}

model Withdrawal {
  id         String  @id @default(cuid())
  providerId String
  amount     Int
  account    String
  status     ReviewStatus   // PENDING / APPROVED / REJECTED
  createdAt  DateTime @default(now())
}

model Feedback {
  id        String   @id @default(cuid())
  no        String   @unique
  kind      String   // 服务投诉 / 价格争议 / 服务满意 ...
  userId    String
  targetId  String
  status    FeedbackStatus  // NEGOTIATING / HANDLED / UPGRADED / CLOSED
  content   String
  createdAt DateTime @default(now())
}

model Message {
  id        String    @id @default(cuid())
  title     String
  kind      MessageKind  // 订单 / 服务 / 评价 / 权益 / 公告 / 系统通知
  scope     String       // 全平台 / 区域 / 指定用户
  status    MessageStatus // UNREAD / READ / PENDING_REVIEW / PUBLISHED
  body      String?
  createdAt DateTime  @default(now())
}

model Role {
  id        String  @id @default(cuid())
  name      String
  layer     LayerType      // CONSOLE / AGENT / PROVIDER
  type      RoleKind       // BUILTIN / CUSTOM
  scope     ScopeType      // ALL / REGION / SELF
  perms     String[]       // 权限点 key 数组（10 域 28 点）
  level     Int            // 位阶：100 超级 / 90 运维 / 80 审核 / 80 财务 / 60 客服
  accountCount Int @default(0)
}

model UserRole {
  userId String
  roleId String
  @@id([userId, roleId])
}

model Coupon {
  id        String  @id @default(cuid())
  title     String
  amount    Int
  validFrom DateTime
  validTo   DateTime
  condition String?
  status    CouponStatus
}

model UserCoupon {
  id      String  @id @default(cuid())
  userId  String
  coupon  Coupon  @relation(fields: [couponId], references: [id])
  couponId String
  used    Boolean @default(false)
}
```

## packages/core 类型

共享包导出：角色 / 状态 / 层级枚举、权限点常量表、`StatusTag` 映射（`#ok→success、#warn→warning、#bad→error、#mut→default、#ac→processing`）、`createListQuery` / `parseListResult` 工厂函数，运营端与用户端共用，保证状态渲染一致。

# 页面实现规格（四层）

## 通用列表页组件

运营端所有列表页复用同一套组件，由配置驱动（`ListPageConfig`：标题 / 副标题 / 列定义 / 筛选集 / 操作类型 / 新建开关），与原型 PAGES 结构一一对应。

```tsx
interface ListPageConfig {
  title: string; sub: string; chip: string;
  columns: ColumnDef[];            // 含 n(数值右对齐)、status(状态标签列)、render
  filters: FilterTab[];            // { key, label, value? } 可点击筛选按钮
  searchPlaceholder?: string;      // 关键词搜索 + 清空叉
  exportable?: boolean;            // 受 data:export 控制
  actions: 'view' | 'edit' | 'review' | 'ro' | 'none' | 'cfg';
  creatable?: boolean;             // 「＋新建」
  scope?: string;                  // 作用域 chip
}
export function DataListPage({ config, objectScope }: Props) {
  const { data, tableProps, setCurrent } = useList({ resource, filters, sorters });
  return (
    <AntdList header={renderHeader(config, objectScope)}>
      <Table {...tableProps} rowKey="id" columns={buildColumns(config)} />
    </AntdList>
  );
}
```

## 总台 13 页

|资源|页面|列字段|筛选|操作|
|---|---|---|---|---|
|dashboard|经营总览|KPI \+ 区域对比条形图 \+ 代理商绩效表 \+ 待办|—|待办直达|
|regions|区域管理|区域 / 级别 / 代理商 / 服务商数 / 用户数|全部区域·省级·市级·区县级|查看 / 编辑|
|agents|代理商管理|代理商 / 辖区 / 服务商数 / 月流水 / 状态|全部·正常·待复核·停用|查看 / 编辑|
|providers|服务商管理（入驻审核队列）|申请人 / 手机号 / 服务类型 / 区域 / 资质 / 提交时间 / 状态|全部·已通过·已驳回·待审核|查看 / 通过 / 驳回|
|users|用户管理|用户 / 手机号 / 角色 / 区域 / 注册时间 / 状态|全部用户·客户·服务商·代理商·管理员|查看 / 编辑|
|templates|模板审核|模板 / 作者 / 类型 / 价格 / 状态|全部·已上架·待审核·已下架|查看 / 通过 / 驳回|
|orders|订单管理|订单号 / 用户 / 类型 / 金额 / 状态 / 下单时间|全部·待接单·履约中·已完成·售后|—|
|wallets|钱包总览|主体 / 类型 / 可用余额 / 冻结 / 累计流水 / 状态|全部·代理商·服务商|—|
|withdrawals|提现审核|服务商 / 申请金额 / 收款账户 / 申请时间 / 状态|全部·已通过·已驳回·待审核|查看 / 通过 / 驳回|
|feedback|评价与反馈中心|编号 / 类型 / 反馈人 / 对象 / 状态 / 时间|全部反馈·升级仲裁·协商中·已关闭|查看 / 处理|
|messages|消息中心|标题 / 类型 / 接收范围 / 状态 / 发布时间|收件箱·公告审核·已发布|查看 / 通过\(发布\) / 驳回|
|roles|角色与权限|角色 / 归属层级 / 账号数 / 数据作用域 / 功能权限 / 权限位阶 / 类型|全部·总台管理员·代理商·服务商·自定义角色|查看 / 编辑|
|settings|系统设置|分类 / 配置项 / 当前值 / 说明|全部·基础·费用·审核·通知|编辑|

## 代理商中心 8 页

|资源|页面|列字段|筛选|操作|
|---|---|---|---|---|
|a\-dashboard|辖区概览|辖区 KPI \+ 服务类别占比 \+ 辖区服务商列表 \+ 待办|—|待办直达|
|a\-users|辖区用户|用户 / 手机号 / 角色 / 注册时间 / 状态|全部·客户·服务商|查看（仅查看）|
|a\-providers|辖区服务商|服务商 / 类型 / 资质 / 本月接单 / 状态|全部·待初审·待复审·业务升级审核·已通过|查看 / 通过 / 驳回|
|a\-orders|辖区订单|订单号 / 用户 / 类型 / 金额 / 状态 / 时间|全部·履约中·已完成·售后|—|
|a\-wallet|财务中心|科目 / 类型 / 金额 / 时间 / 状态|全部·入账·挂账·出账|—|
|a\-feedback|评价与反馈中心|编号 / 类型 / 用户 / 对象 / 状态 / 时间|全部·协商中·已处理·可升级|查看 / 处理|
|a\-messages|消息中心|标题 / 类型 / 状态 / 时间|全部·待我处理·已读|查看 / 通过\(发布\) / 驳回|
|a\-roles|角色与权限|角色 / 归属层级 / 账号数 / 数据作用域 / 功能权限 / 类型|全部·辖区角色·自定义角色|查看 / 编辑|

## 服务商中心 8 页

|资源|页面|列字段|筛选|操作|
|---|---|---|---|---|
|p\-dashboard|我的工作台|余额/冻结 \+ 在售服务 \+ 订单收益 \+ 待办|—|待办直达|
|p\-services|服务管理|服务 / 类型 / 价格 / 状态|全部·在售·草稿·已下架|查看 / 编辑|
|p\-orders|订单处理|订单号 / 用户 / 服务 / 金额 / 状态 / 时间|全部·待接单·履约中·已完成|—|
|p\-qualification|资质管理|资质项 / 编号 / 有效期 / 审核状态|全部·有效·待审核·已过期|查看 / 编辑|
|p\-wallet|财务中心|科目 / 类型 / 金额 / 时间 / 状态|全部·入账·挂账·提现|—|
|p\-feedback|评价与反馈中心|编号 / 类型 / 对象 / 状态 / 时间|全部·待回应·申诉中·已回应|查看 / 处理|
|p\-messages|消息中心|标题 / 类型 / 状态 / 时间|全部·待我处理·已读|查看 / 通过\(发布\) / 驳回|
|p\-roles|角色与权限|角色 / 归属层级 / 账号数 / 数据作用域 / 功能权限 / 类型|全部·服务角色·自定义角色|查看 / 编辑|

## 用户视角 7 页

按当前选中用户动态渲染，切换用户即联动刷新；操作统一为「查看」（仅只读）。

|资源|页面|列字段|筛选|
|---|---|---|---|
|u\-dashboard|用户工作台|资料卡 \+ 余额/积分/订单/消费 \+ 会员权益卡 \+ 等级测试台 \+ 调整用户数据|—|
|u\-orders|我的订单|订单 / 服务 / 服务商 / 金额 / 时间 / 状态|全部·待服务·已完成|
|u\-providers|我的服务商|服务商 / 服务类型 / 评分 / 关注时间 / 状态|全部·关注中|
|u\-coupons|优惠与权益|优惠券 / 面额 / 有效期 / 使用条件 / 状态|全部·未使用·已使用|
|u\-wallet|我的钱包|时间 / 类型 / 金额 / 变动后余额 / 状态|全部·收入·支出|
|u\-feedback|评价与反馈|服务 / 评分 / 评价内容 / 时间 / 状态|全部·已发布|
|u\-messages|消息中心|标题 / 类型 / 时间 / 状态|全部·待处理·已处理|

## 首页看板实现

四层首页均用 `useCustom` 拉取聚合数据：总台（/api/dashboard）、代理商（/api/agent/dashboard）、服务商（/api/provider/dashboard）、用户（/api/users/:id/dashboard）。看板图表使用 AntD 生态图表库（如 `@ant-design/charts` 或 `recharts`），区域对比用条形图，服务类别占比用柱状 / 环形图；待办卡片点击直达对应列表（`useNavigate` \+ `query` 筛选）。

# 详情对话框实现（AntD）

## 四种操作类型

|类型|适用|实现|按钮|
|---|---|---|---|
|A 仅查看|辖区用户等监督型|Drawer \+ Descriptions 只读|关闭|
|B 查看 \+ 审核|入驻 / 模板 / 提现 / 公告 / 初审复审 / 业务升级|Drawer \+ Descriptions \+ Form（审核意见）|通过 / 驳回（驳回必填）|
|C 查看 \+ 编辑|区域 / 代理 / 用户 / 反馈 / 角色 / 服务 / 资质 / 配置|Drawer 内 Descriptions ↔ Form 切换|查看态「编辑」→ 编辑态「保存 / 取消」|
|D 仅编辑|系统设置|Drawer \+ Form 直开|保存 / 取消|

## Drawer \+ Form 规格

```tsx
export function DetailDrawer({ resource, id, config, onClose }) {
  const { queryResult } = useShow({ resource, id });      // 详情
  const { mutate } = useUpdate();                          // 编辑保存
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [form] = Form.useForm();
  useEffect(() => { if (queryResult.data?.data) form.setFieldsValue(queryResult.data.data); }, [queryResult.data]);
  return (
    <Drawer open title={config.title} width={560} extra={config.actions}>
      {mode === 'view'
        ? <Descriptions column={1} items={buildView(config, queryResult.data?.data)} />
        : <Form form={form} onFinish={save} layout="vertical">{buildForm(config)}</Form>}
    </Drawer>
  );
}
```

要点：编辑态预填当前记录（杜绝空白表单）；保存调 `update` 成功后 invalidate 刷新列表并回查看态；只读账号下编辑 / 保存按钮禁用。

## 审核交互

```tsx
const { mutate: approve } = useCustomMutation();
const approveIt = () => approve({
  url: `/api/${resource}/${id}/approve`,
  method: 'post', values: { comment: form.getFieldValue('comment') },
}, { onSuccess: () => { message.success('已通过'); invalidate(); onClose(); } });

// 驳回：AntD Modal.confirm 内嵌 Form，comment 必填校验，不满足拦截
const rejectIt = () => Modal.confirm({
  title: '驳回确认', content: <Form form={rejForm}><Form.Item name="comment"
    rules={[{ required: true, message: '请填写驳回原因' }]}>
    <Input.TextArea /></Form.Item></Form>,
  onOk: () => approve({ url: `/api/${resource}/${id}/reject`, method: 'post', values: rejForm.getFieldsValue() }),
});
```

审核按钮随只读态锁定；通过 / 驳回后列表状态即时刷新（`useInvalidate`）。

## 角色权限编辑（分层复选框组）

```tsx
const PERM_GROUPS = [
  { domain: '用户与账号', key: 'user', perms: [{ label: '用户查询', key: 'user:view' }, { label: '用户编辑', key: 'user:edit' }] },
  { domain: '入驻与服务商', key: 'provider', perms: [/* provider:review / qualification / upgrade */] },
  // ... 10 域 28 点（见角色与权限章）
];

function PermCheckGroup({ layer, value, onChange }) {
  const groups = PERM_GROUPS.filter(g => layerDomains[layer].includes(g.key)); // 按层过滤
  return (
    <div className="perm-groups">
      {groups.map(g => (
        <Card key={g.key} size="small" title={g.domain}>
          <Checkbox.Group options={g.perms} value={value} onChange={onChange} />
        </Card>
      ))}
    </div>
  );
}
```

功能权限按角色层过滤作用域：总台 10 域、代理商 9 域（隐③）、服务商 6 域（①②⑥⑨ 隐）；编辑回显已勾选权限点，保存写回 `perms` 数组。

# 设计系统（AntD 主题）

## 主题 token

```ts
import type { ThemeConfig } from 'antd';
export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: '#c24b2e',        // 朱砂：品牌 / 主按钮 / KPI 高亮
    colorInfo: '#14676b',           // 青：次级强调 / 数值
    colorBgLayout: '#faf5eb',       // 暖石底色
    colorBgContainer: '#ffffff',
    borderRadius: 6,
    controlHeight: 34,
    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
  },
  components: {
    Table: { headerBg: '#faf5eb', headerColor: '#5b4632' },
    Tag: { borderRadiusSM: 999 },
    Button: { primaryShadow: 'none' },
  },
};
```

## 状态标签映射

|原型前缀|AntD Tag color|语义示例|
|---|---|---|
|\#ok|success|正常 / 已通过 / 已上架 / 已发布|
|\#warn|warning|待审核 / 待复核 / 待处理|
|\#bad|error|停用 / 已驳回 / 售后|
|\#mut|default|草稿 / 待复审 / 未激活|
|\#ac|processing|履约中 / 升级仲裁 / 内置角色|

状态文案全部中文化，无英文键值残留；列表与详情对话框共用同一 `StatusTag` 组件。

# 国际化与 RTL

运营端复用 `react-i18next`：`zh-CN` 为默认，后续按需接入 6 语言。i18nProvider 将 Refine 内置文案与业务资源（菜单、列头、按钮、状态）统一走字典；`dir` 由 `i18n.language` 推导，RTL（阿语等 4 种）下 AntD `ConfigProvider direction="rtl"` 自动翻转布局，运营端表格 / 抽屉 / 表单默认兼容。

# API 契约（dataProvider → /api）

## 通用列表参数

```text
page=1&pageSize=10
sort=field:asc|desc
filter[status]=PENDING_REVIEW
filter[role]=AGENT
q=关键词           # 覆盖 id/名称/昵称/手机号/区域 模糊匹配
scope=agent:AG001 # 对象视角：强制按对象过滤（总台管理员）
导出：GET /api/:resource/export（鉴权 + data:export）
```

## 方法 → 端点映射

|动作|方法与端点|说明|
|---|---|---|
|登录|POST /api/auth/login|返回 accessToken \+ user\(role/scope/perms\)|
|我的信息|GET /api/auth/me|刷新身份与权限|
|列表 / 详情|GET /api/:resource\[/:id\]|dataProvider getList / getOne|
|新建 / 编辑 / 删除|POST / PATCH / DELETE /api/:resource\[/:id\]|create / update / deleteOne|
|审核通过 / 驳回|POST /api/:resource/:id/approve\|reject|驳回 body\.comment 必填；幂等（Redis 幂等键）|
|反馈处理|POST /api/feedback/:id/handle|处理意见 \+ 状态流转|
|公告审核发布|POST /api/messages/:id/approve|通过即发布到接收范围|
|角色权限保存|PATCH /api/roles/:id|perms 权限点数组 \+ 数据作用域|
|对象视角聚合|GET /api/view\-scope?layer=agent\&object=AG001|返回对象 KPI \+ 各列表摘要，总台管理员专用|
|用户数据调整|POST /api/users/:id/adjust|等级测试 / 余额 / 积分调整，仅可写账号|

## 错误码

|HTTP|业务码|场景|前端处理|
|---|---|---|---|
|401|AUTH\_INVALID|令牌失效 / 未登录|跳转 /login|
|403|FORBIDDEN / READONLY|越层访问 / 只读写操作|提示 \+ 禁用操作|
|409|STATE\_CONFLICT|状态机冲突（重复审核等）|刷新列表重试|
|422|VALIDATION|驳回原因缺失 / 字段非法|表单错误提示|
|429|RATE\_LIMIT|频控|退避重试|
|500|INTERNAL|服务异常|异常态提示 \+ 重试|

# 验收清单

1. pnpm monorepo 可一键启动：`pnpm -F server dev`、`pnpm -F admin dev`，Docker 起 PG / Redis。

2. 四层登录与菜单投影正确：总台 13 项全量，低层无高层入口；JWT 角色 / 作用域正确注入。

3. 视角切换联动侧栏 / 面包屑 / 首页 / 数据作用域；三视角「返回总台」按钮右缘对齐、绿色。

4. 对象视角按 ID / 用户名 / 昵称 / 手机号 / 区域检索，整页数据联动；总台管理员可代操作。

5. 超级管理员可写；运维管理员只读（黄条 \+ 操作禁用 \+ 后端 403）。

6. 角色与权限：总台展开 5 职能角色位阶正确；功能权限复选框按层过滤（代理 9 域 / 服务商 6 域）；编辑保存权限组合并回显。

7. 服务商入驻进总台审核队列；代理商辖区服务商支持初审 / 复审 / 业务升级审核。

8. 各页筛选按钮可点击检索；搜索框支持回车与清空叉；导出受 data:export 控制。

9. 详情对话框按 A/B/C/D 实现，驳回原因必填，编辑预填不空白；状态字段全中文无英文键值。

10. 四态（加载 / 空 / 异常 / 只读）齐全；国际化字典与 RTL 方向可切换。

# 未决事项

真实密码策略与令牌刷新机制；数据库 DDL 迁移基线（prisma migrate 首批脚本）；消息推送通道（短信 / IM / 推送）接入；资金账户与支付网关对接；多语言文案与 4 种 RTL 语言包完整性。以上不影响本文档页面与接口契约的实施，由技术选型 / 排期阶段确认。

> （注：部分内容可能由 AI 生成）
