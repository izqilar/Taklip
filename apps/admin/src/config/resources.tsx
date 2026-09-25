import type { ResourceProps } from '@refinedev/core';
import type { ReactNode } from 'react';
import {
  AppstoreOutlined,
  DashboardOutlined,
  EnvironmentOutlined,
  ApartmentOutlined,
  ShopOutlined,
  TeamOutlined,
  FileImageOutlined,
  ShoppingOutlined,
  WalletOutlined,
  TransactionOutlined,
  CommentOutlined,
  NotificationOutlined,
  SafetyOutlined,
  SettingOutlined,
  UserOutlined,
  IdcardOutlined,
  HomeOutlined,
  StarOutlined,
  FileTextOutlined,
  BellOutlined,
  CalendarOutlined,
  DollarOutlined,
  FileDoneOutlined,
  FileProtectOutlined,
  BankOutlined,
  GiftOutlined,
  UserAddOutlined,
  FontSizeOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import type { LayerKey } from './permGroups';

/**
 * 四层资源注册（文档 §7，共 59 项；含总台系统设置下的「字体管理」）。
 * - resource.name 即 dataProvider 拼接的 /api 路径（与后端端点一致）
 * - meta.layer  决定视角投影（侧栏按当前视角渲染）
 * - meta.group  侧栏分组标签
 * - meta.icon / meta.badgeKey 角标（待办数语义键）
 * - meta.home   该层首页路由（视角切换落点）
 */

/**
 * 侧栏角标语义键。
 * 原型 .mi 的角标是「菜单名 + 该菜单待办数」，数字必须来自真实业务统计，
 * 故此处只声明语义，具体数值由 GET /api/console/badges 按角色作用域下发。
 *
 * 关键契约：每个数字都是对应业务的【新增的待处理（pending）子集】，绝不统计全表记录数。
 * 例如提现审核只数待打款、模板审核只数待审、评价与反馈只数未关闭工单、消息中心只数待审公告。
 */
export type BadgeKey =
  | 'providerReview' // 服务商入驻审核：资质待审(PENDING)的服务商数（待处理子集）
  | 'withdrawals' // 提现审核：待打款(pending)的提现申请数（待处理子集）
  | 'templates' // 模板审核：待审(PENDING)的模板数（待处理子集）
  | 'feedback' // 评价与反馈中心：未关闭(待处理)的工单数（待处理子集，非全表）
  | 'messages' // 消息中心：待审核(PENDING)的公告数（待处理子集）
  | 'orders' // 订单处理：已支付待履约(paid)的订单数（服务商待处理子集）
  | 'noticeUnread' // 用户视角·通知公告：本人可见、已发布、未读(无回执)的公告数
  | 'messagePending' // 用户视角·业务消息：本人可见、已发布、未读(无回执)的业务消息数（待处理子集）
  | 'feedbackPending' // 用户视角·我的反馈：本人发起、未关闭的工单数（待回复子集）
  | 'joinPending' // 服务商/代理商·团队管理：本组织收到的「加入团队」在途(PENDING)申请数
  // ── 代理商视角新增角标语义键（v2 红线闸口 + 辖区治理）──
  | 'onboarding' // 代理商·入驻审批：辖区待初审/复审的入驻申请数
  | 'qualification' // 代理商·资质审核：辖区资质待审数
  | 'templateReview' // 代理商·模板审核：本辖区待审(PENDING)模板数（仅 regionPath，区别于总台 templates）
  | 'serviceReview' // 代理商·服务审核：本辖区待审(REVIEW_PENDING)服务/作品数
  | 'agentComplaints' // 代理商·意见反馈：辖区待处理投诉/建议工单数
  | 'withdrawReview' // 代理商·提现初审：辖区服务商提现待初审(pending)数
  | 'investPending' // 代理商·招商申请：辖区招商新申请数
  | 'agentMessages'; // 代理商·业务消息：待处理业务消息数（区别于总台 messages）

/**
 * 侧栏分组键。
 * 2026-09-01 调整：
 *  - 「评价与反馈」「消息中心」两个模块合并为一个「评价与反馈」分组；
 *  - 「系统」分组更名为「系统设置」；
 *  - 「区域管理」由「总览与治理」移入「系统设置」。
 * 2026-09-09 调整（用户视角原型还原）：
 *  - 用户视角按原型 MENU.user 分为 交易中心 / 评价与反馈 / 消息中心 / 个人中心 四组。
 * 分组标题走 i18n `group.<key>`，见 GROUP_LABEL。
 */
export type MenuGroupKey =
  | 'overview'
  | 'ops'
  | 'finance'
  | 'feedback'
  | 'system'
  // ── 用户视角四组（原型 MENU.user）──
  | 'trade'
  | 'message'
  | 'personal'
  // ── 服务商视角七组（原型 MENU.provider）──
  | 'databoard'
  | 'orderfulfill'
  | 'servicecontent'
  | 'qualification'
  | 'teamsetting'
  // ── 代理商视角新增四组（v2 标准化：辖区治理 + 红线把关）──
  | 'providersupervise' // 辖区服务商（代理商监督簇）
  | 'contentreview' // 内容审核（红线把关核心，独立成组）
  | 'regionops' // 辖区运营
  | 'recruit' // 招商拓展（代理商专有拓客）
  | 'contract' // 合同中枢（总台治理专属分组）
  | 'recycle'; // 回收站（僵尸用户，侧栏最底部）

/** 侧栏自上而下的分组展示顺序（不依赖 resources 声明顺序） */
export const GROUP_ORDER: MenuGroupKey[] = [
  'overview',
  'databoard',
  // ── 代理商视角四组（紧跟数据看板，相对顺序：辖区服务商 → 内容审核 → 辖区运营 → 招商拓展）──
  'providersupervise',
  'contentreview',
  // ── 总台：内容审核 → 运营监管(ops) → 招商拓展（原 recruit 在 ops 前，现 ops 上提）──
  'ops',
  'regionops',
  'recruit',
  'trade',
  'orderfulfill',
  'servicecontent',
  'qualification',
  'finance',
  // ── 总台治理专属：合同中枢（财务中心之后、评价与反馈之前）──
  'contract',
  'feedback',
  'message',
  'teamsetting',
  'personal',
  'system',
  'recycle',
];

/** 分组默认标题（中文）；其余语言由 i18n `group.<key>` 覆盖，缺失时回退到此处 */
export const GROUP_LABEL: Record<MenuGroupKey, string> = {
  overview: '总览与治理',
  ops: '运营监管',
  finance: '财务中心',
  feedback: '评价与反馈',
  system: '系统设置',
  trade: '交易中心',
  message: '消息中心',
  personal: '个人中心',
  // ── 服务商视角七组（原型 MENU.provider）──
  databoard: '数据看板',
  orderfulfill: '订单履约',
  servicecontent: '服务与内容',
  qualification: '资质中心',
  teamsetting: '工作台设置',
  // ── 代理商视角四组（v2）──
  providersupervise: '辖区服务商',
  contentreview: '内容审核',
  regionops: '辖区运营',
  recruit: '招商拓展',
  // ── 总台治理专属分组 ──
  contract: '合同中枢',
  // ── 回收站（侧栏最底部）──
  recycle: '回收站',
};

export interface ResourceMeta {
  label: string;
  layer: LayerKey;
  group?: MenuGroupKey;
  icon?: ReactNode;
  /** 角标语义键；未声明则该菜单不显示角标 */
  badgeKey?: BadgeKey;
  home?: string;
  /** 细粒度权限 action 覆盖（见 accessControlProvider.permFor） */
  action?: string;
}

const META = (
  label: string,
  layer: LayerKey,
  extra: Partial<ResourceMeta> = {},
): ResourceMeta => ({ label, layer, ...extra });

export const resources: ResourceProps[] = [
  // ===================== 管理总台（ADMIN · 13 项）=====================
  {
    name: 'admin/console',
    meta: META('管理总台', 'console', { icon: <AppstoreOutlined />, home: '/admin/dashboard' }),
  },
  {
    name: 'admin/dashboard',
    list: '/admin/dashboard',
    meta: META('经营总览', 'console', { group: 'overview', icon: <DashboardOutlined /> }),
  },
  {
    name: 'admin/agents',
    list: '/admin/agents',
    create: '/admin/agents/create',
    edit: '/admin/agents/edit/:id',
    meta: META('代理商管理', 'console', { group: 'overview', icon: <ApartmentOutlined /> }),
  },
  {
    name: 'admin/provider-review',
    list: '/admin/provider-review',
    meta: META('服务商管理', 'console', { group: 'overview', icon: <ShopOutlined />, badgeKey: 'providerReview' }),
  },
  {
    name: 'admin/users',
    list: '/admin/users',
    show: '/admin/users/show/:id',
    edit: '/admin/users/edit/:id',
    meta: META('用户管理', 'console', { group: 'ops', icon: <TeamOutlined /> }),
  },
  {
    // 回收站·僵尸用户：从用户管理删除的用户先回收至此，可激活恢复或彻底删除。
    // 仅具备 user:delete 权限的管理员可见（侧栏由 LayerSider 经 useCan 门控）。
    name: 'admin/zombie-users',
    list: '/admin/zombie-users',
    show: '/admin/zombie-users/show/:id',
    meta: META('僵尸用户', 'console', { group: 'recycle', icon: <DeleteOutlined /> }),
  },
  {
    name: 'admin/templates',
    list: '/admin/templates',
    meta: META('模板审核', 'console', { group: 'contentreview', icon: <FileImageOutlined />, badgeKey: 'templates' }),
  },
  {
    name: 'admin/orders',
    list: '/admin/orders',
    meta: META('订单管理', 'console', { group: 'ops', icon: <ShoppingOutlined /> }),
  },
  {
    name: 'admin/finance',
    meta: META('财务中心', 'console', { group: 'finance', icon: <WalletOutlined /> }),
  },
  {
    name: 'admin/wallets',
    list: '/admin/wallets',
    meta: META('钱包总览', 'console', { group: 'finance', icon: <WalletOutlined /> }),
  },
  {
    name: 'admin/withdrawals',
    list: '/admin/withdrawals',
    meta: META('提现审核', 'console', { group: 'finance', icon: <TransactionOutlined />, badgeKey: 'withdrawals' }),
  },
  // 评价与反馈分组：原「评价与反馈」「消息中心」两个模块合并（二级菜单：消息中心 / 评价与反馈中心）
  {
    name: 'admin/messages',
    list: '/admin/messages',
    meta: META('消息中心', 'console', { group: 'feedback', icon: <NotificationOutlined />, badgeKey: 'messages' }),
  },
  {
    name: 'admin/feedback',
    list: '/admin/feedback',
    meta: META('评价与反馈中心', 'console', { group: 'feedback', icon: <CommentOutlined />, badgeKey: 'feedback' }),
  },
  // 入驻审批台（总台 ADMIN）：用户「入驻」资格升级隧道的两阶段审核
  {
    name: 'admin/qualifications',
    list: '/admin/qualifications',
    meta: META('入驻审批', 'console', { group: 'ops', icon: <FileDoneOutlined /> }),
  },
  {
    name: 'admin/regions',
    list: '/regions',
    meta: META('区域管理', 'console', { group: 'system', icon: <EnvironmentOutlined /> }),
  },
  {
    name: 'admin/roles',
    list: '/admin/roles',
    meta: META('角色与权限', 'console', { group: 'system', icon: <SafetyOutlined /> }),
  },
  {
    name: 'account/profile',
    list: '/account/profile',
    meta: META('账户详情', 'console', { group: 'system', icon: <IdcardOutlined /> }),
  },
  {
    name: 'admin/settings',
    list: '/admin/settings',
    meta: META('系统设置', 'console', { group: 'system', icon: <SettingOutlined /> }),
  },
  {
    name: 'admin/fonts',
    list: '/admin/fonts',
    meta: META('字体管理', 'console', { group: 'system', icon: <FontSizeOutlined /> }),
  },
  {
    name: 'admin/audit-logs',
    list: '/admin/audit-logs',
    meta: META('操作日志', 'console', { group: 'system', icon: <FileProtectOutlined /> }),
  },
  {
    name: 'admin/redline-words',
    list: '/admin/redline-words',
    meta: META('红线词库', 'console', { group: 'system', icon: <FileProtectOutlined /> }),
  },
  // ── 内容审核（总台全量 oversight）：服务审核 / 作品审核（占位期「该功能即将上线」）──
  {
    name: 'admin/service-review',
    list: '/admin/service-review',
    meta: META('服务审核', 'console', { group: 'contentreview', icon: <AppstoreOutlined />, badgeKey: 'serviceReview' }),
  },
  {
    name: 'admin/work-review',
    list: '/admin/work-review',
    meta: META('作品审核', 'console', { group: 'contentreview', icon: <FileTextOutlined />, badgeKey: 'templateReview' }),
  },
  // ── 招商拓展（总台全量 oversight）：招商申请 / 意向池 ──
  {
    name: 'admin/invest',
    list: '/admin/invest',
    meta: META('招商申请', 'console', { group: 'recruit', icon: <UserAddOutlined />, badgeKey: 'investPending' }),
  },
  {
    name: 'admin/pool',
    list: '/admin/pool',
    meta: META('意向池', 'console', { group: 'recruit', icon: <BankOutlined /> }),
  },
  // ── 财务中心：结算总览 / 分账费率 ──
  {
    name: 'admin/settle',
    list: '/admin/settle',
    meta: META('结算总览', 'console', { group: 'finance', icon: <WalletOutlined /> }),
  },
  {
    name: 'admin/fee-config',
    list: '/admin/fee-config',
    meta: META('分账费率', 'console', { group: 'finance', icon: <DollarOutlined /> }),
  },
  // ── 合同中枢（总台治理专属）：平台合同管理 ──
  {
    name: 'admin/contracts',
    list: '/admin/contracts',
    meta: META('平台合同管理', 'console', { group: 'contract', icon: <FileProtectOutlined /> }),
  },

  // ===================== 代理商中心（AGENT · v2 标准化 · 8 组 21 项）=====================
  {
    name: 'agent/center',
    meta: META('代理商中心', 'agent', { icon: <ApartmentOutlined />, home: '/agent/dashboard' }),
  },
  // ── 数据看板 ──
  {
    name: 'agent/dashboard',
    list: '/agent/dashboard',
    meta: META('辖区经营概览', 'agent', { group: 'databoard', icon: <DashboardOutlined /> }),
  },
  // ── 辖区服务商（代理商监督簇）──
  {
    name: 'agent/providers',
    list: '/agent/providers',
    meta: META('辖区服务商', 'agent', { group: 'providersupervise', icon: <ShopOutlined />, badgeKey: 'providerReview' }),
  },
  {
    name: 'agent/apply',
    list: '/agent/apply',
    meta: META('入驻审批', 'agent', { group: 'providersupervise', icon: <FileDoneOutlined />, badgeKey: 'onboarding' }),
  },
  {
    name: 'agent/qualification',
    list: '/agent/qualification',
    meta: META('资质审核', 'agent', { group: 'providersupervise', icon: <SafetyOutlined />, badgeKey: 'qualification' }),
  },
  {
    name: 'agent/contract',
    list: '/agent/contract',
    meta: META('合同管理', 'agent', { group: 'providersupervise', icon: <FileProtectOutlined /> }),
  },
  // ── 内容审核（v2 红线把关核心，独立成组）──
  {
    name: 'agent/template-review',
    list: '/agent/template-review',
    meta: META('模板审核', 'agent', { group: 'contentreview', icon: <FileImageOutlined />, badgeKey: 'templateReview' }),
  },
  {
    name: 'agent/service-review',
    list: '/agent/service-review',
    meta: META('服务审核', 'agent', { group: 'contentreview', icon: <AppstoreOutlined />, badgeKey: 'serviceReview' }),
  },
  // ── 辖区运营 ──
  {
    name: 'agent/users',
    list: '/agent/users',
    meta: META('辖区用户', 'agent', { group: 'regionops', icon: <TeamOutlined /> }),
  },
  {
    name: 'agent/orders',
    list: '/agent/orders',
    meta: META('辖区订单', 'agent', { group: 'regionops', icon: <ShoppingOutlined /> }),
  },
  {
    name: 'agent/feedback',
    list: '/agent/feedback',
    meta: META('服务评价', 'agent', { group: 'regionops', icon: <StarOutlined />, badgeKey: 'feedback' }),
  },
  {
    name: 'agent/complaints',
    list: '/agent/complaints',
    meta: META('意见反馈', 'agent', { group: 'regionops', icon: <FileTextOutlined />, badgeKey: 'agentComplaints' }),
  },
  // ── 招商拓展（代理商专有）──
  {
    name: 'agent/invest',
    list: '/agent/invest',
    meta: META('招商申请', 'agent', { group: 'recruit', icon: <UserAddOutlined />, badgeKey: 'investPending' }),
  },
  {
    name: 'agent/pool',
    list: '/agent/pool',
    meta: META('意向池', 'agent', { group: 'recruit', icon: <BankOutlined /> }),
  },
  // ── 财务中心 ──
  {
    name: 'agent/settle',
    list: '/agent/settle',
    meta: META('结算总览', 'agent', { group: 'finance', icon: <WalletOutlined /> }),
  },
  {
    name: 'agent/withdraw-review',
    list: '/agent/withdraw-review',
    meta: META('提现初审', 'agent', { group: 'finance', icon: <DollarOutlined />, badgeKey: 'withdrawReview' }),
  },
  // ── 消息中心 ──
  {
    name: 'agent/notices',
    list: '/agent/notices',
    meta: META('通知公告', 'agent', { group: 'message', icon: <NotificationOutlined />, badgeKey: 'noticeUnread' }),
  },
  {
    name: 'agent/messages',
    list: '/agent/messages',
    meta: META('业务消息', 'agent', { group: 'message', icon: <BellOutlined />, badgeKey: 'agentMessages' }),
  },
  // ── 工作台设置（2026-09-23：与服务商侧完全对齐，拆为「团队管理」+「员工角色」）──
  {
    name: 'agent/team',
    list: '/agent/team',
    meta: META('团队管理', 'agent', { group: 'teamsetting', icon: <TeamOutlined />, badgeKey: 'joinPending' }),
  },
  {
    name: 'agent/roles',
    list: '/agent/roles',
    meta: META('员工角色', 'agent', { group: 'teamsetting', icon: <SafetyOutlined /> }),
  },
  {
    name: 'account/profile-agent',
    list: '/account/profile',
    meta: META('账户详情', 'agent', { group: 'teamsetting', icon: <IdcardOutlined /> }),
  },

  // ===================== 服务商中心（SERVICE_PROVIDER · 原型 MENU.provider · 7 组 18 项）=====================
  {
    name: 'sp/center',
    meta: META('服务商中心', 'provider', { icon: <ShopOutlined />, home: '/sp/studio' }),
  },
  // ── 我的工作台（顶层项，不归入任何分组：既是视角落点也是经营首页）──
  {
    name: 'sp/studio',
    list: '/sp/studio',
    meta: META('我的工作台', 'provider', { icon: <DashboardOutlined /> }),
  },
  // ── 订单履约 ──
  {
    name: 'sp/orders',
    list: '/sp/orders',
    meta: META('我的订单', 'provider', { group: 'orderfulfill', icon: <ShoppingOutlined />, badgeKey: 'orders' }),
  },
  {
    name: 'sp/schedule',
    list: '/sp/schedule',
    meta: META('档期管理', 'provider', { group: 'orderfulfill', icon: <CalendarOutlined /> }),
  },
  // ── 服务与内容 ──
  {
    name: 'sp/clients',
    list: '/sp/clients',
    meta: META('我的客户', 'provider', { group: 'servicecontent', icon: <BankOutlined /> }),
  },
  {
    name: 'sp/works',
    list: '/sp/works',
    meta: META('作品管理', 'provider', { group: 'servicecontent', icon: <FileImageOutlined /> }),
  },
  {
    name: 'sp/templates',
    list: '/sp/templates',
    meta: META('模板管理', 'provider', { group: 'servicecontent', icon: <AppstoreOutlined />, badgeKey: 'templates' }),
  },
  {
    name: 'sp/services',
    list: '/sp/services',
    meta: META('服务管理', 'provider', { group: 'servicecontent', icon: <FileImageOutlined /> }),
  },
  // ── 评价与反馈（与用户视角同组名，归并「我的评价 / 意见反馈」）──
  {
    name: 'sp/feedback',
    list: '/sp/feedback',
    meta: META('我的评价', 'provider', { group: 'feedback', icon: <StarOutlined /> }),
  },
  {
    name: 'sp/complaints',
    list: '/sp/complaints',
    meta: META('意见反馈', 'provider', { group: 'feedback', icon: <FileTextOutlined />, badgeKey: 'feedback' }),
  },
  // ── 资质中心 ──
  {
    name: 'sp/apply',
    list: '/sp/apply',
    meta: META('业务申请', 'provider', { group: 'qualification', icon: <FileDoneOutlined /> }),
  },
  {
    name: 'sp/qualification',
    list: '/sp/qualification',
    meta: META('资质管理', 'provider', { group: 'qualification', icon: <SafetyOutlined /> }),
  },
  {
    name: 'sp/contract',
    list: '/sp/contract',
    meta: META('合同管理', 'provider', { group: 'qualification', icon: <FileProtectOutlined /> }),
  },
  // ── 财务中心 ──
  {
    name: 'sp/income',
    list: '/sp/income',
    meta: META('账单明细', 'provider', { group: 'finance', icon: <WalletOutlined /> }),
  },
  {
    name: 'sp/withdraw',
    list: '/sp/withdraw',
    meta: META('提现管理', 'provider', { group: 'finance', icon: <DollarOutlined />, badgeKey: 'withdrawals' }),
  },
  {
    name: 'sp/wallet',
    list: '/sp/wallet',
    meta: META('我的钱包', 'provider', { group: 'finance', icon: <BankOutlined /> }),
  },
  // ── 消息中心 ──
  {
    name: 'sp/notices',
    list: '/sp/notices',
    meta: META('通知公告', 'provider', { group: 'message', icon: <NotificationOutlined />, badgeKey: 'noticeUnread' }),
  },
  {
    name: 'sp/messages',
    list: '/sp/messages',
    meta: META('业务消息', 'provider', { group: 'message', icon: <BellOutlined />, badgeKey: 'messagePending' }),
  },
  // ── 工作台设置（2026-09-23 拆分：「团队与角色」→「团队管理」+「员工角色」）──
  // 团队管理：引入按钮（web 端「入驻申请」加入隧道）→ 接收 / 拒绝
  {
    name: 'sp/team',
    list: '/sp/team',
    meta: META('团队管理', 'provider', { group: 'teamsetting', icon: <TeamOutlined />, badgeKey: 'joinPending' }),
  },
  // 员工角色：已组队成员的岗位 / 权限配置（仍走 provider/team API）
  {
    name: 'sp/roles',
    list: '/sp/roles',
    meta: META('员工角色', 'provider', { group: 'teamsetting', icon: <SafetyOutlined /> }),
  },
  {
    name: 'account/profile-provider',
    list: '/account/profile',
    meta: META('账户详情', 'provider', { group: 'teamsetting', icon: <IdcardOutlined /> }),
  },

  // ===================== 用户视角（USER · 11 项 · 原型 MENU.user 四组）=====================
  // 还原依据：docs/庆柬云 · 用户视角UI原型还原开发文档.md §三 + UI_Design/index.html MENU.user
  // 交易中心：我的工作台 / 我的服务商 / 我的订单
  // 评价与反馈：我的评价 / 我的反馈
  // 消息中心：通知公告 / 业务消息
  // 个人中心：我的钱包 / 优惠与权益 / 入驻申请 / 账户详情（与 web 端同序，2026-09-24 对齐）
  {
    name: 'user/center',
    meta: META('用户视角', 'user', { icon: <UserOutlined />, home: '/user/dashboard' }),
  },
  {
    name: 'user/dashboard',
    list: '/user/dashboard',
    meta: META('我的工作台', 'user', { group: 'trade', icon: <HomeOutlined /> }),
  },
  {
    name: 'user/providers',
    list: '/user/providers',
    meta: META('我的服务商', 'user', { group: 'trade', icon: <ShopOutlined /> }),
  },
  {
    name: 'user/orders',
    list: '/user/orders',
    meta: META('我的订单', 'user', { group: 'trade', icon: <ShoppingOutlined /> }),
  },
  {
    name: 'user/works',
    list: '/user/works',
    meta: META('我的作品', 'user', { group: 'trade', icon: <FileImageOutlined /> }),
  },
  {
    name: 'user/reviews',
    list: '/user/reviews',
    meta: META('我的评价', 'user', { group: 'feedback', icon: <StarOutlined /> }),
  },
  {
    name: 'user/complaints',
    list: '/user/complaints',
    create: '/user/complaints/new',
    meta: META('我的反馈', 'user', { group: 'feedback', icon: <FileTextOutlined />, badgeKey: 'feedbackPending' }),
  },
  {
    name: 'user/notices',
    list: '/user/notices',
    meta: META('通知公告', 'user', { group: 'message', icon: <NotificationOutlined />, badgeKey: 'noticeUnread' }),
  },
  {
    name: 'user/messages',
    list: '/user/messages',
    meta: META('业务消息', 'user', { group: 'message', icon: <BellOutlined />, badgeKey: 'messagePending' }),
  },
  {
    name: 'user/wallet',
    list: '/user/wallet',
    meta: META('我的钱包', 'user', { group: 'personal', icon: <WalletOutlined /> }),
  },
  {
    name: 'user/coupons',
    list: '/user/coupons',
    meta: META('优惠与权益', 'user', { group: 'personal', icon: <GiftOutlined /> }),
  },
  // 入驻申请：与 web 端个人中心分组对齐（2026-09-24 新增 —— JOIN 加入 / SETTLE 入驻双隧道）
  // 位置同 web 端：我的钱包 → 优惠与权益 → 入驻申请 → 账户详情
  {
    name: 'user/apply',
    list: '/user/apply',
    meta: META('入驻申请', 'user', { group: 'personal', icon: <UserAddOutlined /> }),
  },
  {
    name: 'account/profile-user',
    list: '/account/profile',
    meta: META('账户详情', 'user', { group: 'personal', icon: <IdcardOutlined /> }),
  },
];

/** 各层首页路由（视角切换落点） */
export const LAYER_HOME: Record<LayerKey, string> = {
  console: '/admin/dashboard',
  agent: '/agent/dashboard',
  provider: '/sp/studio',
  user: '/user/dashboard',
};

/** 各层视角切换展示名 */
export const LAYER_LABEL: Record<LayerKey, string> = {
  console: '总台',
  agent: '代理商',
  provider: '服务商',
  user: '用户',
};
