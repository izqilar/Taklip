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
  FontSizeOutlined,
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
  | 'orders'; // 订单处理：已支付待履约(paid)的订单数（服务商待处理子集）

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
  | 'teamsetting';

/** 侧栏自上而下的分组展示顺序（不依赖 resources 声明顺序） */
export const GROUP_ORDER: MenuGroupKey[] = [
  'overview',
  'databoard',
  'trade',
  'orderfulfill',
  'ops',
  'servicecontent',
  'qualification',
  'finance',
  'feedback',
  'message',
  'teamsetting',
  'personal',
  'system',
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
  teamsetting: '团队与设置',
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
    name: 'admin/templates',
    list: '/admin/templates',
    meta: META('模板审核', 'console', { group: 'ops', icon: <FileImageOutlined />, badgeKey: 'templates' }),
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

  // ===================== 代理商中心（AGENT · 8 项）=====================
  {
    name: 'agent/center',
    meta: META('代理商中心', 'agent', { icon: <ApartmentOutlined />, home: '/agent/dashboard' }),
  },
  {
    name: 'agent/dashboard',
    list: '/agent/dashboard',
    meta: META('辖区概览', 'agent', { icon: <DashboardOutlined /> }),
  },
  {
    name: 'agent/users',
    list: '/agent/users',
    meta: META('辖区用户', 'agent', { icon: <TeamOutlined /> }),
  },
  {
    name: 'agent/providers',
    list: '/agent/providers',
    meta: META('辖区服务商', 'agent', { icon: <ShopOutlined />, badgeKey: 'providerReview' }),
  },
  {
    name: 'agent/orders',
    list: '/agent/orders',
    meta: META('辖区订单', 'agent', { icon: <ShoppingOutlined /> }),
  },
  {
    name: 'agent/wallet',
    list: '/agent/wallet',
    meta: META('结算与钱包', 'agent', { icon: <WalletOutlined /> }),
  },
  {
    name: 'agent/feedback',
    list: '/agent/feedback',
    meta: META('评价与反馈中心', 'agent', { icon: <CommentOutlined />, badgeKey: 'feedback' }),
  },
  {
    name: 'agent/messages',
    list: '/agent/messages',
    meta: META('消息中心', 'agent', { icon: <NotificationOutlined />, badgeKey: 'messages' }),
  },
  {
    name: 'agent/roles',
    list: '/agent/roles',
    meta: META('角色与权限', 'agent', { group: 'system', icon: <SafetyOutlined /> }),
  },
  {
    name: 'account/profile-agent',
    list: '/account/profile',
    meta: META('账户详情', 'agent', { group: 'system', icon: <IdcardOutlined /> }),
  },

  // ===================== 服务商中心（SERVICE_PROVIDER · 原型 MENU.provider · 7 组 18 项）=====================
  {
    name: 'sp/center',
    meta: META('服务商中心', 'provider', { icon: <ShopOutlined />, home: '/sp/studio' }),
  },
  // ── 数据看板 ──
  {
    name: 'sp/studio',
    list: '/sp/studio',
    meta: META('我的工作台', 'provider', { group: 'databoard', icon: <DashboardOutlined /> }),
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
    name: 'sp/services',
    list: '/sp/services',
    meta: META('服务管理', 'provider', { group: 'servicecontent', icon: <FileImageOutlined /> }),
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
    name: 'sp/feedback',
    list: '/sp/feedback',
    meta: META('我的评价', 'provider', { group: 'servicecontent', icon: <StarOutlined /> }),
  },
  {
    name: 'sp/complaints',
    list: '/sp/complaints',
    meta: META('意见反馈', 'provider', { group: 'servicecontent', icon: <FileTextOutlined />, badgeKey: 'feedback' }),
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
    meta: META('收入明细', 'provider', { group: 'finance', icon: <WalletOutlined /> }),
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
    meta: META('通知公告', 'provider', { group: 'message', icon: <NotificationOutlined /> }),
  },
  {
    name: 'sp/messages',
    list: '/sp/messages',
    meta: META('业务消息', 'provider', { group: 'message', icon: <BellOutlined /> }),
  },
  // ── 团队与设置 ──
  {
    name: 'sp/team',
    list: '/sp/team',
    meta: META('我的团队', 'provider', { group: 'teamsetting', icon: <TeamOutlined /> }),
  },
  {
    name: 'sp/clients',
    list: '/sp/clients',
    meta: META('我的客户', 'provider', { group: 'teamsetting', icon: <BankOutlined /> }),
  },
  {
    name: 'account/profile-provider',
    list: '/account/profile',
    meta: META('账户详情', 'provider', { group: 'teamsetting', icon: <IdcardOutlined /> }),
  },

  // ===================== 用户视角（USER · 10 项 · 原型 MENU.user 四组）=====================
  // 还原依据：docs/庆柬云 · 用户视角UI原型还原开发文档.md §三 + UI_Design/index.html MENU.user
  // 交易中心：我的工作台 / 我的服务商 / 我的订单
  // 评价与反馈：我的评价 / 我的反馈
  // 消息中心：通知公告 / 业务消息
  // 个人中心：我的钱包 / 优惠与权益 / 账户详情
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
    meta: META('我的反馈', 'user', { group: 'feedback', icon: <FileTextOutlined /> }),
  },
  {
    name: 'user/notices',
    list: '/user/notices',
    meta: META('通知公告', 'user', { group: 'message', icon: <NotificationOutlined /> }),
  },
  {
    name: 'user/messages',
    list: '/user/messages',
    meta: META('业务消息', 'user', { group: 'message', icon: <BellOutlined /> }),
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
