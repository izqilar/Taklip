/**
 * 功能权限点（文档 §5.3：10 域 28 点）。
 * 供角色与权限页的复选框组按层过滤回显（§5.4 三层功能域映射）。
 */

export type LayerKey = 'console' | 'agent' | 'provider' | 'user';

export interface PermPoint {
  key: string;
  label: string;
}

export interface PermDomain {
  /** 域 id，对应 §5.3 序号 ①~⑩ */
  id: string;
  label: string;
  points: PermPoint[];
}

export const PERM_DOMAINS: PermDomain[] = [
  {
    id: 'user',
    label: '用户与账号',
    points: [
      { key: 'user:view', label: '查看用户' },
      { key: 'user:edit', label: '编辑用户' },
    ],
  },
  {
    id: 'provider',
    label: '入驻与服务商',
    points: [
      { key: 'provider:review', label: '服务商入驻审核' },
      { key: 'provider:qualification', label: '资质管理' },
      { key: 'provider:upgrade', label: '业务升级审核' },
    ],
  },
  {
    id: 'content',
    label: '服务与内容',
    points: [
      { key: 'template:publish', label: '模板发布' },
      { key: 'content:offline', label: '内容下架' },
      { key: 'template:review', label: '模板审核' },
      { key: 'qualification:manage', label: '资质审核' },
    ],
  },
  {
    id: 'order',
    label: '订单与履约',
    points: [
      { key: 'order:view', label: '查看订单' },
      { key: 'order:handle', label: '订单处理' },
      { key: 'order:aftersale', label: '售后处理' },
    ],
  },
  {
    id: 'finance',
    label: '财务',
    points: [
      { key: 'finance:view', label: '财务查看' },
      { key: 'withdrawal:review', label: '提现审核' },
      { key: 'withdrawal:operate', label: '提现打款' },
      { key: 'finance:reconcile', label: '财务对账' },
    ],
  },
  {
    id: 'coupon',
    label: '优惠券与权益',
    points: [
      { key: 'coupon:config', label: '券规则配置' },
      { key: 'coupon:issue', label: '发券' },
      { key: 'coupon:view', label: '券查看' },
    ],
  },
  {
    id: 'feedback',
    label: '评价与申诉',
    points: [
      { key: 'feedback:handle', label: '反馈处理' },
      { key: 'appeal:arbitrate', label: '申诉仲裁' },
    ],
  },
  {
    id: 'message',
    label: '消息与公告',
    points: [
      { key: 'announce:publish', label: '公告发布' },
      { key: 'announce:review', label: '公告审核' },
      { key: 'message:send', label: '消息发送' },
    ],
  },
  {
    id: 'system',
    label: '组织与系统',
    points: [
      { key: 'role:manage', label: '角色管理' },
      { key: 'region:manage', label: '区域管理' },
      { key: 'settings:manage', label: '系统设置' },
    ],
  },
  {
    id: 'data',
    label: '数据导出',
    points: [{ key: 'data:export', label: '数据导出' }],
  },
];

/** 按 §5.4 三层功能域映射，返回各层级可见的域 id 列表 */
const LAYER_DOMAIN_IDS: Record<LayerKey, string[]> = {
  console: PERM_DOMAINS.map((d) => d.id), // ①~⑩ 全 10 域
  agent: ['user', 'provider', 'order', 'finance', 'coupon', 'feedback', 'message', 'system', 'data'], // 隐藏 ③ 服务与内容
  provider: ['content', 'order', 'finance', 'feedback', 'message', 'data'], // 隐藏 ①②⑥⑨
  user: [],
};

/** 返回某层级应展示的权限域（含点），用于角色编辑复选框组回显 */
export function layerDomains(layer: LayerKey): PermDomain[] {
  const ids = LAYER_DOMAIN_IDS[layer] ?? [];
  return PERM_DOMAINS.filter((d) => ids.includes(d.id));
}
