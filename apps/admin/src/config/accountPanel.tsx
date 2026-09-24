import type { ReactNode } from 'react';
import {
  FileImageOutlined,
  GiftOutlined,
  IdcardOutlined,
  NotificationOutlined,
  SafetyOutlined,
  SettingOutlined,
  ShoppingOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import type { BadgeKey } from './resources';
import type { LayerKey } from './permGroups';

/**
 * 账号下拉面板的四层差异化元数据（原型 UI_Design/index.html 的 ACCPANEL_META）。
 *
 * 关键分派口径（务必看清，别按原型那套「跟着视角换人」照抄）：
 *   - 原型是静态演示，切换视角会连人一起换（张敏 / 阿依古丽 / 麦麦提 / 买买提）。
 *   - 本 app 的胶囊是「操作员锚点」：登录的人不会因切视角而变，变的只是他在看哪一层。
 *
 * 所以拆成两张表：
 *   ①【待办事项】按【操作员角色】分派 —— 待办是「我自己要处理的事」，
 *      数字来自 GET /api/console/badges，服务端已按角色作用域统计（ADMIN 全量 / AGENT 辖区 / SP 自身）。
 *   ②【快捷入口 + 底部工具】按【当前视角层】分派 —— 这是「我要去哪页」，
 *      跟着当前所在的层走，管理员切到用户视角时给的就是用户视角的入口。
 */

/** 待办格：数字 = badges[badgeKey]，hot 表示需要优先处理（朱砂字，原型 .n.hot） */
export interface AccountTodo {
  label: string;
  badge: BadgeKey;
  hot?: boolean;
  to: string;
}

/** 快捷入口格（原型 .ap-link，带 16px 图标） */
export interface AccountLink {
  label: string;
  icon: ReactNode;
  to: string;
}

/** 底部工具（原型 .ap-tool，纯文字横排） */
export interface AccountTool {
  label: string;
  to: string;
}

/** ① 待办事项 —— 按操作员角色 */
export const ACCOUNT_TODOS: Record<string, AccountTodo[]> = {
  // 总台：四条审核队列 + 公告待审
  ADMIN: [
    { label: '待审核入驻', badge: 'providerReview', hot: true, to: '/admin/provider-review' },
    { label: '待审核模板', badge: 'templates', to: '/admin/templates' },
    { label: '待审核提现', badge: 'withdrawals', hot: true, to: '/admin/withdrawals' },
    { label: '待审公告', badge: 'messages', hot: true, to: '/admin/messages' },
  ],
  // 代理商：辖区内的服务商初审 / 提现打款 / 工单 / 自己提交待总台审的公告
  AGENT: [
    { label: '待审服务商', badge: 'providerReview', hot: true, to: '/agent/providers' },
    { label: '待打款提现', badge: 'withdrawals', hot: true, to: '/agent/providers' },
    { label: '未关闭工单', badge: 'feedback', to: '/agent/feedback' },
    { label: '待审公告', badge: 'messages', hot: true, to: '/agent/messages' },
  ],
  // 服务商：自己模板的待接单 / 待审模板 / 待打款 / 未关闭工单
  SERVICE_PROVIDER: [
    { label: '待接单', badge: 'orders', hot: true, to: '/sp/orders' },
    { label: '待审模板', badge: 'templates', to: '/sp/services' },
    { label: '待打款', badge: 'withdrawals', hot: true, to: '/sp/wallet' },
    { label: '未关闭工单', badge: 'feedback', hot: true, to: '/sp/feedback' },
  ],
  // 注册用户：运营端不放行 USER 登录，此分支仅作兜底（恒为 0，不臆造数字）
  USER: [],
};

/** ② 快捷入口 + 底部工具 —— 按当前视角层 */
export const ACCOUNT_NAV: Record<LayerKey, { links: AccountLink[]; tools: AccountTool[] }> = {
  console: {
    links: [
      { label: '角色与权限', icon: <SafetyOutlined />, to: '/admin/roles' },
      { label: '系统设置', icon: <SettingOutlined />, to: '/admin/settings' },
    ],
    tools: [
      { label: '区域管理', to: '/regions' },
      { label: '数据导出', to: '/admin/users' },
      { label: '公告管理', to: '/admin/messages' },
      { label: '反馈中心', to: '/admin/feedback' },
      { label: '账户详情', to: '/account/profile' },
    ],
  },
  agent: {
    links: [
      { label: '财务中心', icon: <WalletOutlined />, to: '/agent/wallet' },
      { label: '消息中心', icon: <NotificationOutlined />, to: '/agent/messages' },
    ],
    tools: [
      { label: '辖区用户', to: '/agent/users' },
      { label: '辖区订单', to: '/agent/orders' },
      { label: '评价反馈', to: '/agent/feedback' },
      { label: '团队管理', to: '/agent/team' },
      { label: '员工角色', to: '/agent/roles' },
      { label: '账户详情', to: '/account/profile' },
    ],
  },
  provider: {
    links: [
      { label: '服务管理', icon: <FileImageOutlined />, to: '/sp/services' },
      { label: '订单处理', icon: <ShoppingOutlined />, to: '/sp/orders' },
      { label: '资质管理', icon: <IdcardOutlined />, to: '/sp/qualification' },
    ],
    tools: [
      { label: '财务中心', to: '/sp/wallet' },
      { label: '评价反馈', to: '/sp/feedback' },
      { label: '团队管理', to: '/sp/team' },
      { label: '员工角色', to: '/sp/roles' },
      { label: '账户详情', to: '/account/profile' },
    ],
  },
  user: {
    links: [
      { label: '我的订单', icon: <ShoppingOutlined />, to: '/user/orders' },
      { label: '优惠与权益', icon: <GiftOutlined />, to: '/user/coupons' },
      { label: '我的钱包', icon: <WalletOutlined />, to: '/user/wallet' },
    ],
    tools: [
      { label: '我的服务商', to: '/user/providers' },
      { label: '评价反馈', to: '/user/feedback' },
      { label: '消息中心', to: '/user/messages' },
      { label: '账户详情', to: '/account/profile' },
    ],
  },
};

/**
 * 权限模式（原型 .ap-modes）—— 仅总台管理员可见，与 LayerContext 的 readonly 联动。
 * 原型文案：超级管理员「全量权限 · 可代操作」、运维管理员「部分权限 · 默认只读」。
 */
export const ACCOUNT_MODES = [
  { key: 'super', title: '超级管理员', desc: '全量权限 · 可代操作', readonly: false },
  { key: 'ops', title: '运维管理员', desc: '部分权限 · 默认只读', readonly: true },
] as const;
