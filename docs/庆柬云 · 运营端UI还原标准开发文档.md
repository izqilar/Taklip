# 庆柬云 · 运营端 UI 原型还原 — 标准开发文档

> 版本：v1.0（2026-08-28）｜依据：`UI_Design/ui-run/console/index.html`（已验收原型）+ `UI_Design/庆柬云 · 分层管理后台 开发文档.md`（设计契约 A）+ `docs/庆柬云 · 运营端开发文档（React+Refine+AntD5）.md`（技术契约 B）｜状态：**唯一权威还原依据**
>
> 本文档整合 A 的设计意图 + B 的技术落地框架，并补齐 B 的缺口（对象聚合字段、首页看板字段级规格、原型→代码逐页追溯附录、组件/目录规范章、里程碑与测试策略）。设计令牌以 **index.html 原型为真值**。

---

# 1. 文档说明与术语表

## 1.1 读者与范围
读者：产品负责人、运营端（apps/admin）前后端工程师、技术负责人。
范围：把 `index.html` 原型**按原样还原**到运营端后台的完整契约——总体架构、角色权限、菜单与页面规格、详情对话框、数据模型、设计系统、API 契约、还原追溯与里程碑。

## 1.2 术语表（统一，避免再歧义）
| 术语 | 英文 | 包 | 端口 | 说明 |
|---|---|---|---|---|
| 服务端 | Server | `apps/server` | :3000（`/api`） | 唯一后端，被全部前端共用 |
| **运营端** | Admin Console | `apps/admin` | :5174 | 本文档主体（ADMIN/AGENT/SP/USER 四视角后台） |
| 用户端 | User App (H5) | `apps/web` | :5173 | C 端，含少量自助；原型的「用户视角」为其后台监督镜像 |
| 项目品牌 | 庆柬云 / TAKLIP Cloud | — | — | 运营端产品品牌，Logo 双品牌分色（庆=红 / 云=金） |
| 仓库代号 | 请柬云 / h5design | — | — | monorepo 仓库与包名（`@h5design/*`） |

- **视角（View）**：页头切换进入某角色层的工作界面（总台/代理商/服务商/用户）。
- **对象视角（Object Scope）**：在角色层内检索并切到某一具体代理商/服务商/用户，整页数据联动到该对象名下。
- 角色枚举（与服务端一致）：`USER` / `SERVICE_PROVIDER` / `AGENT` / `ADMIN`。**注意**：运营端 `accessControlProvider` 当前误用 `'SP'`，须修正为 `'SERVICE_PROVIDER'`（见 §16 实现任务清单）。

---

# 2. 项目概述

## 2.1 背景与目标
平台采用「一个后端 · 多角色分层登录」：登录即定层；菜单=该层作用域投影；低层看不到高层入口；权限不越层。目标：一套后端承载四个决策层级（总台统筹、代理商辖区二级治理、服务商业务开展、用户监督镜像）。

## 2.2 设计原则
1. 一个后端、分层治理、总台统筹：菜单按层级投影，低层无高层入口。
2. 总台 13 项超集 + 页头视角切换：通过「总台/代理商/服务商/用户」切换进入各层。
3. 可写/只读按账号：超级管理员可写（可代操作）；运维管理员默认只读，单独授权可写。
4. 服务商入驻审核进总台审核队列，总台统一把关。
5. 底层角色权限不得触达高层范围。

## 2.3 非目标
本阶段不含移动端 C 端、支付通道、消息推送通道细节、真实鉴权与数据库 DDL（DDL 见 §16 待办）。原型的「用户视角」7 页作为**运营端监督镜像**全量收录规格，其实现落点（web 端 vs 运营端）留待实现阶段确认，不影响字段规格。

---

# 3. 技术方案与工程结构

## 3.1 技术栈总表（与项目实际一致，已核对 package.json）
| 端 | 技术 | 版本 | 职责 |
|---|---|---|---|
| 服务端 `apps/server` | NestJS + Prisma | NestJS 10 / Prisma 5 | REST API、鉴权、RBAC/ABAC、审核、财务、消息 |
| 数据库 | PostgreSQL（Docker `h5design-postgres`） | PG 15+ | 业务与权限持久化 |
| 缓存/队列 | Redis（Docker `h5design-redis`） | Redis 7 | 会话、计数、幂等键、消息队列 |
| **运营端 `apps/admin`** | React + Refine + AntD | React 18 / Refine 4 / AntD 5 | 四层管理后台 UI（本文档主体） |
| 用户端 `apps/web` | React 18 + Vite 5 + Konva 9 | — | 用户端 / H5 编辑器 |
| 共享包 `packages/core` | TS 类型/枚举/工厂 | — | 跨端共享类型、状态映射、`StatusTag` |

> **依赖缺口（需在实现阶段补齐）**：① 服务端 `package.json` 未声明 Redis 客户端（ioredis/@nestjs/ioredis），需补装并纳入 Docker；② 运营端 `package.json` 未声明 `react-i18next`/`i18next`/`dayjs`/`@tanstack/react-query`/`@h5design/core`，而 B 章 4/10/13 已引用，须补装；③ 图表库（`@ant-design/charts` 或 `echarts-for-react`）需新增，用于还原原型手写 SVG 图表。

## 3.2 Monorepo 结构（对齐 B）
```
h5design/
├─ apps/
│  ├─ server/                # NestJS /api
│  ├─ web/                   # 用户端 :5173
│  └─ admin/                 # 运营端 :5174 —— 本文档主体
│     ├─ src/
│     │  ├─ providers/       # dataProvider / authProvider / accessControlProvider / i18nProvider
│     │  ├─ pages/           # console/ agent/ provider/ user 四层页面
│     │  ├─ components/      # 通用列表、详情抽屉、状态标签、对象选择器、图表封装
│     │  ├─ config/          # resources、theme(antdTheme)、constants
│     │  └─ App.tsx          # Refine 装配入口
│     └─ vite.config.ts      # port:5174
├─ packages/core/            # src/{types,enums,factory,status}.ts
├─ pnpm-workspace.yaml       # apps/* packages/*
└─ docker-compose.yml        # h5design-postgres / h5design-redis
```
## 3.3 端口表
| 端 | 端口 | 说明 |
|---|---|---|
| 服务端 | 3000（`/api`） | 唯一后端 |
| 用户端 | 5173 | Vite dev，proxy→3000 |
| 运营端 | 5174 | Vite dev，dataProvider 直连 3000 |

---

# 4. 总体架构

## 4.1 分层登录模型
| 层 | 角色枚举 | 菜单数 | 数据作用域 | 首页 |
|---|---|---|---|---|
| 管理总台 | ADMIN | 13（超集） | ALL（全平台） | 经营总览 |
| 代理商中心 | AGENT | 8 | REGION（regionPath 前缀） | 辖区概览 |
| 服务商中心 | SERVICE_PROVIDER | 8 | SELF（自身） | 我的工作台 |
| 用户视角 | USER | 7 | SELF（单用户） | 用户工作台 |

登录即定层：JWT 携带 `role` 与 `scope`（regionPath / selfId），前端按层投影菜单，后端按层强制隔离数据。

## 4.2 视角切换机制
页头 `segmented` 切换「总台/代理商/服务商/用户」；切换后侧栏菜单、面包屑、首页、数据作用域、页题整体联动；各层独立首页，登录/切换后自动落位。代理商/服务商/用户视角页顶部含绿色「返回总台」按钮，右缘对齐角色标签。

## 4.3 可写/只读模型
页头账号菜单在「超级管理员（可写·可代操作）/ 运维管理员（只读·默认只读，单独授权可写）」间切换。只读态：黄色提示条常驻、主操作（新建/通过/驳回/编辑/调整用户数据）禁用、行内操作锁定；后端对只读会话拒绝非 GET 写请求（`403`）。

## 4.4 数据隔离（regionPath 注入）
区域表维护 `regionPath`（如 `乌鲁木齐/天山区`）；代理商绑定辖区；服务商挂所属区域与服务类型；订单/反馈/消息关联主体。后端以登录主体推导可见域，所有列表接口注入 `where` 过滤；前端仅展示。

---

# 5. 角色与权限体系

## 5.1 角色类型与位阶（总台展开 5 职能）
超级管理员 → 运维管理员 → 服务审核员 = 财务管理员 → 在线客服（位阶 100/90/80/80/60）。其他决策层可在管辖范围内设同类职能角色，并支持自定义角色。

## 5.2 权限三要素
每条角色记录：归属层级 × 类型（内置/自定义）× 职能，叠加数据作用域（ALL/REGION/SELF）、功能权限（权限点勾选集合）、授权边界（数据/功能/位阶）。

## 5.3 功能权限点（10 域 28 点，带 key）
| # | 功能域 | 权限点 key |
|---|---|---|
| ① | 用户与账号 | `user:view` / `user:edit` |
| ② | 入驻与服务商 | `provider:review` / `provider:qualification` / `provider:upgrade` |
| ③ | 服务与内容 | `template:publish` / `content:offline` / `template:review` / `qualification:manage` |
| ④ | 订单与履约 | `order:view` / `order:handle` / `order:aftersale` |
| ⑤ | 财务 | `finance:view` / `withdrawal:review` / `withdrawal:operate` / `finance:reconcile` |
| ⑥ | 优惠券与权益 | `coupon:config` / `coupon:issue` / `coupon:view` |
| ⑦ | 评价与申诉 | `feedback:handle` / `appeal:arbitrate` |
| ⑧ | 消息与公告 | `announce:publish` / `announce:review` / `message:send` |
| ⑨ | 组织与系统 | `role:manage` / `region:manage` / `settings:manage` |
| ⑩ | 数据导出 | `data:export` |

## 5.4 三层功能域映射
| 层级 | 展示功能域 | 隐藏 |
|---|---|---|
| 总台 | ①~⑩ 全 10 域 | — |
| 代理商 | ①②④⑤⑥⑦⑧⑨⑩ | ③ 服务与内容 |
| 服务商 | ③④⑤⑦⑧⑩ | ①②⑥⑨ |

## 5.5 角色-权限示例（总台）
| 角色 | 勾选权限点 |
|---|---|
| 超级管理员 | 28 项全勾 |
| 运维管理员 | user:view、order:view、finance:view、coupon:view、feedback:handle、data:export |
| 服务审核员 | provider:*、template:review、feedback:handle、appeal:arbitrate、announce:review、data:export |
| 财务管理员 | finance:*、coupon:view、data:export |
| 在线客服 | user:view、order:view、feedback:handle、message:send |

## 5.6 落地（前端 + 后端）
- 前端 `accessControlProvider.can()`：`inLayer(me.layer, resource)`（数据作用域维度）+ 权限点检查（如 `export` 需 `data:export`）+ 只读维度（仅 `list/show`）。
- 后端 `AbacGuard`：`user.readonly` 拦截写动作 → `403`；`user.perms` 含 `permKey(resource, action)` 才放行；注入 `scopeWhere`（regionPath 前缀 / selfId）。

---

# 6. 界面框架、布局规范与组件/目录规范

## 6.1 三段式布局
顶部页头（品牌 + 视角切换 + 对象选择入口 + 账号模式）｜左侧侧栏（按当前视角渲染菜单，含分组与角标）｜主内容区（面包屑 + 页题 + 工具条 + 数据表 + 分页）。
- **页头要素**：品牌「庆柬云」；当前视角 crumb；视角切换 segmented；账号菜单（可写/只读标签）；对象视角工具栏（ID/用户名/昵称/手机号/区域模糊检索下拉，选中后整页联动）。
- **侧栏**：按 `MENU[VIEW]` 渲染分组与菜单项，当前项高亮，含待办角标（入驻审核 12、提现审核 3）。
- **内容区/列表页统一引擎**：标题 + 副标题 + 作用域 chip + 分类筛选按钮 + 关键词搜索（含搜索按钮与悬停清空叉）+ 导出按钮 + 数据表 + 总条数 + 「＋新建」主操作。操作列按页渲染「查看/编辑/通过/驳回/处理」。

## 6.2 组件命名与目录规范（补 B 缺口）
```
apps/admin/src/
├─ components/
│  ├─ layout/        LayerSider.tsx, LayerHeader.tsx, ReadonlyBanner.tsx, ObjectScopeBar.tsx
│  ├─ list/          DataListPage.tsx, ColumnBuilder.tsx, FilterTabs.tsx, SearchBox.tsx
│  ├─ detail/        DetailDrawer.tsx, PermCheckGroup.tsx, ReviewActions.tsx
│  ├─ common/        StatusTag.tsx, EmptyState.tsx, ErrorState.tsx, ChartCard.tsx
│  └─ charts/        BarCompare.tsx, DonutShare.tsx   # 封装 @ant-design/charts
├─ config/
│  ├─ resources.ts   # 36 资源注册（meta.layer/group/icon/badge）
│  ├─ theme.ts       # antdTheme（原型令牌）
│  └─ permGroups.ts  # 10 域 28 点 + 分层过滤
└─ pages/
   ├─ console/  agent/  provider/  user/   # 四层页面（每页 = DataListPage 配置 + DetailDrawer 配置）
```
- 页面组件统一以 `XxxList` / `XxxDrawer` 命名；列表由 `ListPageConfig` 配置驱动，禁止在页面内手写重复 Table 渲染。
- 状态标签全局唯一组件 `StatusTag`（见 §11），禁止页面内自定义颜色。

---

# 7. 菜单与页面清单（四层 36 资源）

> 下表 `原型 PAGES key` 直接取自 index.html `MENU`/`PAGES`，`resource` 为 B 约定名（与 dataProvider 路径一致），`端点` 为后端 `/api/:resource`。

## 7.1 总台（13 项 · 6 分组）
| 分组 | 菜单项 | 原型 key | resource | 角标 |
|---|---|---|---|---|
| 总览与治理 | 经营总览 | dashboard | dashboard | — |
| 总览与治理 | 区域管理 | regions | regions | — |
| 总览与治理 | 代理商管理 | agents | agents | — |
| 总览与治理 | 服务商管理（入驻审核） | review | providers | 12 |
| 运营监管 | 用户管理 | users | users | — |
| 运营监管 | 模板审核 | templates | templates | — |
| 运营监管 | 订单管理 | orders | orders | — |
| 财务中心 | 钱包总览 | wallets | wallets | — |
| 财务中心 | 提现审核 | withdrawals | withdrawals | 3 |
| 评价与反馈中心 | 评价与反馈中心 | feedback | feedback | 2 |
| 消息中心 | 消息中心 | messages | messages | 1 |
| 系统 | 角色与权限 | roles | roles | — |
| 系统 | 系统设置 | settings | settings | — |

## 7.2 代理商中心（8 项）
辖区概览(dashboard/a-dashboard) · 辖区用户(a-users) · 辖区服务商(a-providers) · 辖区订单(a-orders) · 财务中心(a-wallet) · 评价与反馈中心(a-feedback,2) · 消息中心(a-messages,1) · 角色与权限(a-roles)

## 7.3 服务商中心（8 项）
我的工作台(dashboard/p-dashboard) · 服务管理(p-services) · 订单处理(p-orders) · 资质管理(p-qualification) · 财务中心(p-wallet) · 评价与反馈中心(p-feedback) · 消息中心(p-messages) · 角色与权限(p-roles)

## 7.4 用户中心（7 项 · 运营端监督镜像）
用户工作台(dashboard/u-dashboard) · 我的订单(u-orders) · 我的服务商(u-providers) · 优惠与权益(u-coupons) · 我的钱包(u-wallet) · 评价与反馈(u-feedback) · 消息中心(u-messages)

---

# 8. 页面实现规格（四层 · 逐页）

> 列字段/筛选/操作以 index.html `PAGES` 逐字还原。`ListPageConfig`：`{title,sub,chip,columns,filters,search,exportable,actions,creatable,scope}`。

## 8.1 总台 13 页
| 页面 | 列字段 | 筛选 | 操作 |
|---|---|---|---|
| 区域管理 | 区域/级别/代理商/服务商数/用户数 | 全部区域·省级·市级·区县级 | 查看/编辑 |
| 代理商管理 | 代理商/辖区/服务商数/月流水/状态 | 全部·正常·待复核·停用 | 查看/编辑 |
| 服务商管理 | 申请人/手机号/服务类型/所属区域/资质/提交时间/状态 | 全部·已通过·已驳回·待审核 | 查看/通过/驳回 |
| 用户管理 | 用户/手机号/角色/所属区域/注册时间/状态 | 全部用户·客户·服务商·代理商·管理员 | 查看/编辑（仅角色/区域/状态） |
| 模板审核 | 模板/作者/类型/价格/状态 | 全部·已上架·待审核·已下架 | 查看/通过/驳回 |
| 订单管理 | 订单号/用户/类型/金额/状态/下单时间 | 全部·待接单·履约中·已完成·售后 | — |
| 钱包总览 | 主体/类型/可用余额/冻结/累计流水/状态 | 全部·代理商·服务商 | — |
| 提现审核 | 服务商/申请金额/收款账户/申请时间/状态 | 全部·已通过·已驳回·待审核 | 查看/通过/驳回 |
| 评价与反馈中心 | 编号/类型/反馈人/对象/状态/时间 | 全部反馈·升级仲裁·协商中·已关闭 | 查看/处理 |
| 消息中心 | 标题/类型/接收范围/状态/发布时间 | 收件箱·公告审核·已发布 | 查看/通过(发布)/驳回 |
| 角色与权限 | 角色/归属层级/账号数/数据作用域/功能权限/权限位阶/类型 | 全部·总台管理员·代理商·服务商·自定义角色 | 查看/编辑 |
| 系统设置 | 分类/配置项/当前值/说明 | 全部·基础·费用·审核·通知 | 编辑 |

## 8.2 代理商中心 8 页
| 页面 | 列字段 | 筛选 | 操作 |
|---|---|---|---|
| 辖区概览(首页) | 辖区 KPI + 服务类别占比 + 辖区服务商列表 + 待办 | — | 待办直达 |
| 辖区用户 | 用户/手机号/角色/注册时间/状态 | 全部·客户·服务商 | 查看（仅查看） |
| 辖区服务商 | 服务商/类型/资质/本月接单/状态 | 全部·待初审·待复审·业务升级审核·已通过 | 查看/通过/驳回 |
| 辖区订单 | 订单号/用户/类型/金额/状态/时间 | 全部·履约中·已完成·售后 | — |
| 财务中心 | 科目/类型/金额/时间/状态 | 全部·入账·挂账·出账 | — |
| 评价与反馈中心 | 编号/类型/用户/对象/状态/时间 | 全部·协商中·已处理·可升级 | 查看/处理 |
| 消息中心 | 标题/类型/状态/时间 | 全部·待处理·已处理·我发布的 | 查看/通过(发布)/驳回 |
| 角色与权限 | 角色/归属层级/账号数/数据作用域/功能权限/类型 | 全部·辖区角色·自定义角色 | 查看/编辑 |

## 8.3 服务商中心 8 页
| 页面 | 列字段 | 筛选 | 操作 |
|---|---|---|---|
| 我的工作台(首页) | 余额/冻结 + 在售服务 + 订单收益 + 待办 | — | 待办直达 |
| 服务管理 | 服务/类型/价格/状态 | 全部·在售·草稿·已下架 | 查看/编辑 |
| 订单处理 | 订单号/用户/服务/金额/状态/时间 | 全部·待接单·履约中·已完成 | — |
| 资质管理 | 资质项/编号/有效期/审核状态 | 全部·有效·待审核·已过期 | 查看/编辑 |
| 财务中心 | 科目/类型/金额/时间/状态 | 全部·入账·挂账·提现 | — |
| 评价与反馈中心 | 编号/类型/对象/状态/时间 | 全部·待回应·申诉中·已回应 | 查看/处理 |
| 消息中心 | 标题/类型/状态/时间 | 全部·待处理·已处理 | 查看/通过(发布)/驳回 |
| 角色与权限 | 角色/归属层级/账号数/数据作用域/功能权限/类型 | 全部·服务角色·自定义角色 | 查看/编辑 |

## 8.4 用户视角 7 页（运营端监督镜像，仅查看）
| 页面 | 列字段 | 筛选 |
|---|---|---|
| 用户工作台(首页) | 资料卡(头像/姓名/等级/ID/手机/城市/注册时间) + 余额/积分/进行中订单/累计消费 + 会员权益卡 + 等级测试台 + 「调整用户数据」 | — |
| 我的订单 | 订单/服务/服务商/金额/时间/状态 | 全部·待服务·已完成 |
| 我的服务商 | 服务商/服务类型/评分/关注时间/状态 | 全部·关注中 |
| 优惠与权益 | 优惠券/面额/有效期/使用条件/状态 | 全部·未使用·已使用 |
| 我的钱包 | 时间/类型/金额/变动后余额/状态 | 全部·收入·支出 |
| 评价与反馈 | 服务/评分/评价内容/时间/状态 | 全部·已发布 |
| 消息中心 | 标题/类型/时间/状态 | 全部·待处理·已处理 |

## 8.5 首页看板字段级规格（补 A 缺口）
- **总台·经营总览**：核心 KPI（流水/用户/订单，数值右对齐，主色高亮）；区域对比条形图（各省级辖区流水）；代理商绩效表（月流水排行）；待办卡片（入驻审核/提现/评价，点击直达列表）；入驻审核队列直通。
- **代理商·辖区概览**：辖区 KPI（流水/用户/服务商/订单）；服务类别占比（环形图）；辖区服务商列表；待办直达。
- **服务商·我的工作台**：余额与冻结；在售服务数；订单与收益；待办（待接单/待交付/申诉）。
- **用户·用户工作台**：资料卡 + 余额/积分/进行中订单/累计消费 + 会员权益卡（按 TIERS 渲染样式与权益清单）+ 等级测试台（模拟切换会员等级预览权益）+ 「调整用户数据」（可写账号可调等级/余额/积分）。

---

# 9. 详情对话框规格

## 9.1 四类操作
| 类型 | 适用 | 形态 | 按钮 |
|---|---|---|---|
| A 仅查看 | 监督型（辖区用户、用户视角各页） | Drawer + Descriptions 只读 | 关闭 |
| B 查看+审核 | 入驻/模板/提现/公告/初审复审/业务升级 | Drawer + Descriptions + 审核意见 Form | 通过/驳回（驳回必填） |
| C 查看+编辑 | 区域/代理/用户/反馈/角色/服务/资质/配置 | Drawer 内 Descriptions↔Form | 查看态「编辑」→ 编辑态「保存/取消」 |
| D 仅编辑 | 系统设置 | Drawer + Form 直开 | 保存/取消 |

## 9.2 总台对话框字段
| 页面 | 查看字段 | 编辑/审核字段 |
|---|---|---|
| 区域管理 | 区域名称/级别/绑定代理商/服务商数/用户数 | 区域名称/级别(下拉)/绑定代理商 |
| 代理商管理 | 代理商名称/所属辖区/服务商数/月流水/状态 | 代理商名称/绑定辖区/状态(正常·待复核·停用) |
| 服务商管理 | 申请人/手机号/服务类型/所属区域/资质/提交时间/状态 | 审核意见(驳回必填)+通过/驳回 |
| 用户管理 | 用户/手机号/角色/所属区域/注册时间/状态 | 角色(客户·服务商·代理商·管理员)/所属区域/状态(正常·停用) |
| 模板审核 | 模板名称/作者/类型/价格/状态 | 审核意见+通过/驳回 |
| 提现审核 | 服务商/申请金额/收款账户/申请时间/状态 | 审核意见+通过/驳回 |
| 评价与反馈中心 | 编号/类型/反馈人/对象/状态/时间/内容 | 处理意见+状态流转(协商中·已关闭·升级仲裁) |
| 消息中心 | 标题/类型/接收范围/状态/发布时间/正文 | 审核意见+通过(发布)/驳回 |
| 角色与权限 | 角色名称/归属层级/账号数/数据作用域/功能权限/位阶/类型 | 角色名称/数据作用域/功能权限(10 域复选框组，按层过滤回显) |
| 系统设置 | —（仅编辑） | 分类/配置项/当前值/说明 |

## 9.3 代理商/服务商对话框字段
| 页面 | 查看字段 | 编辑/审核字段 |
|---|---|---|
| 辖区用户(代理) | 用户/手机号/角色/注册时间/状态 | —（仅查看） |
| 辖区服务商(代理) | 服务商/服务类型/资质/本月接单/状态/联系电话 | 审核意见+通过/驳回（按状态对应初审/复审/业务升级） |
| 辖区评价与反馈(代理) | 编号/类型/用户/对象/状态/时间 | 处理意见+状态流转(协商中·已处理·可升级) |
| 辖区消息中心(代理) | 标题/类型/状态/时间/正文 | 审核意见+通过(发布)/驳回 |
| 辖区角色与权限(代理) | 角色名称/归属层级/账号数/数据作用域/功能权限/类型 | 角色名称/数据作用域/功能权限(复选框组，代理层 9 域) |
| 服务管理(服务商) | 服务名称/类型/价格/状态 | 服务名称/类型/价格/状态(在售·草稿·已下架) |
| 资质管理(服务商) | 资质项/编号/有效期/审核状态 | 资质项/有效期/审核状态(有效·待审核·已过期) |
| 服务评价与反馈 | 编号/类型/对象/状态/时间/内容 | 回应说明+状态流转(待回应·申诉中·已回应) |
| 服务角色与权限 | 角色名称/归属层级/账号数/数据作用域/功能权限/类型 | 角色名称/数据作用域/功能权限(复选框组，服务商层 6 域) |

## 9.4 用户视角对话框（仅查看）
我的订单(服务/服务商/金额/下单时间/订单号) · 我的服务商(服务商/服务类型/评分/关注时间) · 优惠与权益(优惠券/面额/有效期/使用条件) · 我的钱包(时间/类型/金额/变动后余额) · 评价与反馈(服务/评分/评价内容/时间) · 消息中心(标题/类型/时间)

## 9.5 对话框交互规则
- 审核：通过一键更新状态（待审核→已通过）；驳回必填原因并校验拦截；随只读态锁定。
- 编辑：查看态显示「编辑」，进入编辑后变「保存」+「取消」；保存写入并刷新列表后回查看态；预填当前记录（杜绝空白表单）。
- 权限回显：角色编辑时功能权限为复选框组，按当前角色已勾选点回显 + 按层过滤域；保存写回权限点数组。
- 状态字段统一 `StatusTag`（#ok/#warn/#bad/#mut/#ac 前缀），列表与对话框一致，无英文键值残留。

---

# 10. 数据模型

## 10.1 对象聚合字段（补 B 缺口，供对象视角聚合接口返回）
- **AGENTS（代理商）**：id / name / nick / phone / region / 流水 / 用户 / 服务商 / 订单 / 待办 / 服务类别 / 辖区服务商列表。
- **PROVIDERS（服务商）**：id / name / nick / phone / type / region / 余额 / 冻结 / 在售 / 订单 / 收益 / 服务 / 订单列表。
- **USERS（用户）**：id / name / phone / city / tier(普通/银卡/金卡/黑金) / reg / 余额 / 积分 / 进行中订单 / 累计消费 / 订单 / 关注 / 券 / 钱包流水 / 评价 / 消息。
- **TIERS（会员等级）**：每级含样式类与权益清单（折扣、优先排期、金牌管家等）。

## 10.2 Prisma schema（节选自 B，regionPath 为隔离唯一权威字段）
```prisma
enum RoleType { USER SERVICE_PROVIDER AGENT ADMIN }
model User { id String @id @default(cuid()); username String @unique; password String;
  role RoleType; name String; phone String?; regionPath String?; status Status;
  tier MemberTier; balance Int @default(0); points Int @default(0); createdAt DateTime @default(now()) }
model Region { id String @id @default(cuid()); name String; level RegionLevel;
  regionPath String @unique; agentId String?; agent Agent? @relation(fields:[agentId],references:[id]) }
model Agent { id String @id @default(cuid()); userId String @unique; user User @relation(fields:[userId],references:[id]);
  regionId String; region Region @relation(fields:[regionId],references:[id]); status AgentStatus; monthlyFlow Int @default(0) }
model ServiceProvider { id String @id @default(cuid()); userId String @unique; user User @relation(fields:[userId],references:[id]);
  type String; regionPath String; status ProviderStatus; qualification Json? }
model Service { id String @id @default(cuid()); providerId String; name String; type String; price Int;
  status ServiceStatus; template Boolean @default(false) }
model Order { id String @id @default(cuid()); orderNo String @unique; userId String; providerId String;
  serviceId String; amount Int; status OrderStatus; createdAt DateTime @default(now()) }
model Wallet { id String @id @default(cuid()); ownerType String; ownerId String; balance Int; frozen Int; totalFlow Int }
model Ledger { id String @id @default(cuid()); walletId String; type LedgerType; amount Int; balanceAfter Int; createdAt DateTime @default(now()) }
model Withdrawal { id String @id @default(cuid()); providerId String; amount Int; account String; status ReviewStatus; createdAt DateTime @default(now()) }
model Feedback { id String @id @default(cuid()); no String @unique; kind String; userId String; targetId String;
  status FeedbackStatus; content String; createdAt DateTime @default(now()) }
model Message { id String @id @default(cuid()); title String; kind MessageKind; scope String;
  status MessageStatus; body String?; createdAt DateTime @default(now()) }
model Role { id String @id @default(cuid()); name String; layer LayerType; type RoleKind;
  scope ScopeType; perms String[]; level Int; accountCount Int @default(0) }
model UserRole { userId String; roleId String; @@id([userId,roleId]) }
model Coupon { id String @id @default(cuid()); title String; amount Int; validFrom DateTime; validTo DateTime; condition String?; status CouponStatus }
model UserCoupon { id String @id @default(cuid()); userId String; couponId String; used Boolean @default(false) }
```
## 10.3 packages/core 类型
导出角色/状态/层级枚举、权限点常量表、`StatusTag` 映射（`#ok→success #warn→warning #bad→error #mut→default #ac→processing`）、`createListQuery`/`parseListResult` 工厂，运营端与用户端共用。

---

# 11. 设计系统（以 index.html 原型令牌为真值）

## 11.1 色彩令牌（取自 index.html `:root` CSS 变量）
| 用途 | 原型变量 | 取值 |
|---|---|---|
| 强调主色（朱砂） | `--accent` | `#c24b2e`（品牌名/主按钮/KPI 高亮） |
| 副色（青） | `--accent-2` | `#14676b`（次级强调/数值） |
| 页面底色 | `--page` | `#f5f2ec`（背景/卡片） |
| 容器底 | `--bg` | `#fffefb` |
| 次级面板 | `--panel-2` | `#f3eee7` |
| 正文墨色 | `--ink-1/2/3` | `#2a2118` / `#4c4236` / `#86765f` |
| 成功 | `--up` | `#1d7a6b` |
| 危险 | `--down` | `#c02b33` |
| 警示 | `--warn` | `#b77a16` |
| 返回总台按钮 | — | 绿色（三视角页顶部，右缘对齐角色标签） |

> 注：文档 A 设计系统写「暖石 `#faf5eb`」为近似；**以原型 `#f5f2ec/#fffefb` 为真值**。当前运营端代码 `colorPrimary:'#C81E42'` 须更新为 `#c24b2e`（见 §16）。

## 11.2 字阶 / 圆角 / 动效
KPI 数字 27px、页题 18px、正文 14px、表头 12.5px；圆角：卡片 10 / 控件 6 / 胶囊 999；动效统一 180ms。

## 11.3 antdTheme（运营端 ConfigProvider）
```ts
export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: '#c24b2e', colorInfo: '#14676b',
    colorBgLayout: '#f5f2ec', colorBgContainer: '#fffefb',
    colorSuccess: '#1d7a6b', colorError: '#c02b33', colorWarning: '#b77a16',
    borderRadius: 6, controlHeight: 34,
    fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif",
  },
  components: { Table: { headerBg:'#f3eee7', headerColor:'#5b4632' },
    Tag: { borderRadiusSM: 999 }, Button: { primaryShadow:'none' } },
};
```
## 11.4 状态标签映射（全局唯一 `StatusTag`）
| 原型前缀 | AntD color | 语义示例 |
|---|---|---|
| #ok | success | 正常/已通过/已上架/已发布 |
| #warn | warning | 待审核/待复核/待处理 |
| #bad | error | 停用/已驳回/售后 |
| #mut | default | 草稿/待复审/未激活 |
| #ac | processing | 履约中/升级仲裁/内置角色 |

## 11.5 四态
加载态（骨架）、空状态（引导）、异常态（错误+重试）、只读态（顶部黄条+操作禁用）。

---

# 12. API 契约（dataProvider → /api）

## 12.1 通用列表参数
```
page=1&pageSize=10
sort=field:asc|desc
filter[status]=PENDING_REVIEW
filter[role]=AGENT
q=关键词                      # 覆盖 id/名称/昵称/手机号/区域 模糊
scope=agent:AG001            # 对象视角：强制按对象过滤（总台管理员）
导出：GET /api/:resource/export   # 鉴权 + data:export
```
## 12.2 方法 → 端点映射
| 动作 | 方法与端点 | 说明 |
|---|---|---|
| 登录 | POST /api/auth/login | 返回 accessToken + user(role/scope/perms) |
| 我的信息 | GET /api/auth/me | 刷新身份与权限 |
| 列表/详情 | GET /api/:resource[/:id] | getList/getOne |
| 新建/编辑/删除 | POST/PATCH/DELETE /api/:resource[/:id] | create/update/deleteOne |
| 审核通过/驳回 | POST /api/:resource/:id/approve\|reject | 驳回 body.comment 必填；Redis 幂等键 |
| 反馈处理 | POST /api/feedback/:id/handle | 处理意见+状态流转 |
| 公告审核发布 | POST /api/messages/:id/approve | 通过即发布到接收范围 |
| 角色权限保存 | PATCH /api/roles/:id | perms 数组 + 数据作用域 |
| 对象视角聚合 | GET /api/view-scope?layer=agent&object=AG001 | 对象 KPI+各列表摘要，总台管理员专用 |
| 用户数据调整 | POST /api/users/:id/adjust | 等级/余额/积分调整，仅可写账号 |

## 12.3 错误码
| HTTP | 业务码 | 场景 | 前端处理 |
|---|---|---|---|
| 401 | AUTH_INVALID | 令牌失效 | 跳 /login |
| 403 | FORBIDDEN/READONLY | 越层/只读写 | 提示+禁用 |
| 409 | STATE_CONFLICT | 状态机冲突 | 刷新重试 |
| 422 | VALIDATION | 驳回原因缺失 | 表单错误 |
| 429 | RATE_LIMIT | 频控 | 退避重试 |
| 500 | INTERNAL | 异常 | 异常态+重试 |

---

# 13. 国际化与 RTL
运营端用 `react-i18next`，`zh-CN` 默认，后续接 6 语言（含 4 种 RTL）。`i18nProvider` 将 Refine 内置文案与业务资源（菜单/列头/按钮/状态）走字典；`dir` 由 `i18n.language` 推导，RTL 下 AntD `ConfigProvider direction="rtl"` 自动翻转。表格/抽屉/表单默认兼容。

---

# 14. 验收清单（逐层）
1. 四层登录与菜单投影正确，总台 13 项全量、低层无高层入口；JWT 角色/作用域注入正确。
2. 视角切换联动侧栏/面包屑/首页/数据作用域；三视角「返回总台」绿色、右缘对齐。
3. 对象视角按 ID/用户名/昵称/手机号/区域检索，整页联动到所选对象；总台管理员可代操作。
4. 超级管理员可写；运维管理员只读（黄条+禁用+后端 403）。
5. 角色与权限：总台 5 职能位阶正确；复选框按层过滤（代理 9 域/服务商 6 域）；编辑保存并回显。
6. 服务商入驻进总台审核队列；代理商辖区支持初审/复审/业务升级审核。
7. 各页筛选按钮可点击检索；搜索框支持回车与清空叉；导出受 `data:export` 控制。
8. 详情对话框按 A/B/C/D 实现，驳回必填，编辑预填不空白；状态字段全中文无英文键值。
9. 四态齐全；图表（条形/环形）还原原型 SVG 图；国际化字典与 RTL 可切换。
10. 设计令牌以原型 `#c24b2e/#14676b/#f5f2ec` 为真值，全站一致。

---

# 15. 未决事项与里程碑/测试策略

## 15.1 未决事项
真实密码策略与令牌刷新；数据库 DDL 迁移基线（prisma migrate 首批脚本，**含 `Wallet`/`Message`/`Feedback`/`Role` 等现有模型 + 本文档 §10 对象聚合所需索引**）；消息推送通道；支付网关对接；多语言 4 种 RTL 语言包完整性。以上不影响页面与接口契约实施。

## 15.2 里程碑（建议）
- **M1 还原骨架**：§6 组件/目录规范 + §7 四层 36 资源注册 + §11 主题令牌替换 `#C81E42`→`#c24b2e` + §5.6 角色枚举 `'SP'`→`'SERVICE_PROVIDER'` 修复。
- **M2 总台层真实化**：users/agents/providers/users/orders/withdrawals/templates/regions/roles/settings 接真实 `/api`（补齐 `api/admin/wallets`、`api/templates`、`api/roles` 端点）。
- **M3 agent/sp/user 三层**：14 页占位→真实实现 + 对象视角聚合接口 `view-scope` + 首页看板（图表库）。
- **M4 详情与审核流**：A/B/C/D 四类 Drawer + 权限复选框组 + 审核幂等；消息中心审核流。
- **M5 质量**：i18n/RTL、四态、E2E 验收（§14）。

## 15.3 测试策略
- 单元：`StatusTag`、权限点过滤 `layerDomains`、状态机流转。
- 集成：dataProvider↔`/api` 映射、AbacGuard 三维校验（作用域/权限/位阶）。
- E2E（Playwright）：四层登录投影、视角切换联动、审核通过/驳回、只读锁定、对象视角联动、导出权限。
- 视觉回归：与原型 index.html 逐页截图比对（令牌/间距/状态色）。

---

# 附录 A：原型 → 代码 逐页追溯表
> 保证 index.html 每个菜单项在运营端均有落点。原型键取自 `index.html` `MENU`/`PAGES`，资源名取自 §7，端点为 `GET /api/:resource`（审核动作见 §12.2）。

| 层 | 原型菜单 | 原型 PAGES key | resource | 端点 | 操作类型 |
|---|---|---|---|---|---|
| 总台 | 经营总览 | dashboard | dashboard | /api/dashboard | 首页 |
| 总台 | 区域管理 | regions | regions | /api/regions | C |
| 总台 | 代理商管理 | agents | agents | /api/agents | C |
| 总台 | 服务商管理 | review | providers | /api/providers | B |
| 总台 | 用户管理 | users | users | /api/users | C |
| 总台 | 模板审核 | templates | templates | /api/templates | B |
| 总台 | 订单管理 | orders | orders | /api/orders | — |
| 总台 | 钱包总览 | wallets | wallets | /api/admin/wallets ⚠缺失 | — |
| 总台 | 提现审核 | withdrawals | withdrawals | /api/withdrawals | B |
| 总台 | 评价与反馈中心 | feedback | feedback | /api/feedback | C |
| 总台 | 消息中心 | messages | messages | /api/messages | B |
| 总台 | 角色与权限 | roles | roles | /api/roles ⚠缺失 | C |
| 总台 | 系统设置 | settings | settings | /api/settings ⚠缺失 | D |
| 代理 | 辖区概览 | dashboard(a) | a-dashboard | /api/agent/dashboard ⚠缺失 | 首页 |
| 代理 | 辖区用户 | a-users | a-users | /api/agent/users ⚠缺失 | A |
| 代理 | 辖区服务商 | a-providers | a-providers | /api/agent/providers ⚠缺失 | B |
| 代理 | 辖区订单 | a-orders | a-orders | /api/agent/orders ⚠缺失 | — |
| 代理 | 财务中心 | a-wallet | a-wallet | /api/agent/wallet ⚠缺失 | — |
| 代理 | 评价与反馈中心 | a-feedback | a-feedback | /api/agent/feedback ⚠缺失 | C |
| 代理 | 消息中心 | a-messages | a-messages | /api/agent/messages ⚠缺失 | B |
| 代理 | 角色与权限 | a-roles | a-roles | /api/agent/roles ⚠缺失 | C |
| 服务商 | 我的工作台 | dashboard(p) | p-dashboard | /api/provider/dashboard ⚠缺失 | 首页 |
| 服务商 | 服务管理 | p-services | p-services | /api/provider/services ⚠缺失 | C |
| 服务商 | 订单处理 | p-orders | p-orders | /api/provider/orders ⚠缺失 | — |
| 服务商 | 资质管理 | p-qualification | p-qualification | /api/provider/qualification ⚠缺失 | C |
| 服务商 | 财务中心 | p-wallet | p-wallet | /api/provider/wallet ⚠缺失 | — |
| 服务商 | 评价与反馈中心 | p-feedback | p-feedback | /api/provider/feedback ⚠缺失 | C |
| 服务商 | 消息中心 | p-messages | p-messages | /api/provider/messages ⚠缺失 | B |
| 服务商 | 角色与权限 | p-roles | p-roles | /api/provider/roles ⚠缺失 | C |
| 用户 | 用户工作台 | dashboard(u) | u-dashboard | /api/users/:id/dashboard ⚠缺失 | 首页 |
| 用户 | 我的订单 | u-orders | u-orders | /api/users/:id/orders ⚠缺失 | A |
| 用户 | 我的服务商 | u-providers | u-providers | /api/users/:id/providers ⚠缺失 | A |
| 用户 | 优惠与权益 | u-coupons | u-coupons | /api/users/:id/coupons ⚠缺失 | A |
| 用户 | 我的钱包 | u-wallet | u-wallet | /api/users/:id/wallet ⚠缺失 | A |
| 用户 | 评价与反馈 | u-feedback | u-feedback | /api/users/:id/feedback ⚠缺失 | A |
| 用户 | 消息中心 | u-messages | u-messages | /api/users/:id/messages ⚠缺失 | A |

⚠ = 当前后端尚无对应端点，须在 M2/M3 阶段补齐（含 `api/admin/wallets`、各 agent/sp/user 自助与聚合端点）。

# 附录 B：实现任务清单（代码改造项，不在本文档阶段执行）
1. **主题令牌**：`apps/admin/src/App.tsx` 与 `main.tsx` 的 `#C81E42`→`#c24b2e`，并按 §11 落地 antdTheme 全套令牌（青/暖石/状态色）。
2. **角色枚举 bug**：`accessControlProvider.canSeeByRole` 的 `'SP'`→`'SERVICE_PROVIDER'`（否则服务商中心不可见）。
3. **依赖补齐**：服务端补 Redis 客户端；运营端补 `react-i18next`/`i18next`/`dayjs`/`@tanstack/react-query`/`@h5design/core` 与图表库。
4. **缺失端点**：按附录 A ⚠ 清单补齐后端 controller/service（wallets、templates、roles、settings、agent/*、provider/*、user/*、view-scope）。
5. **占位替换**：agent/sp 共 14 页 `PlaceholderPage` → 真实 `DataListPage`+`DetailDrawer`；系统设置 → 真实配置表。
6. **图表还原**：原型手写 SVG（条形/环形）→ 图表库封装组件（§6.2 `charts/`）。

> 本文档为还原依据，不修改任何源码；以上清单在执行阶段逐项落地。
