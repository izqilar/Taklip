import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useCustom } from '@refinedev/core';

/**
 * 侧栏菜单待办角标（原型 .mi 的「菜单名 + 统计数字」）。
 *
 * 数值全部来自服务端 `GET /api/console/badges`，按当前角色作用域统计，
 * 且与各列表页的默认筛选口径一致 —— 避免「角标 12 条、点进去只有 3 条」的错位。
 *
 * 取值失败或角色无对应权限时全部回落为 0，即不显示角标（不臆造数字）。
 */
export interface MenuBadges {
  /** 服务商入驻审核：资质待审的服务商数 */
  providerReview: number;
  /** 提现审核：待打款的提现申请数 */
  withdrawals: number;
  /** 模板审核：待审模板数 */
  templates: number;
  /** 评价与反馈中心：尚未关闭的工单数 */
  feedback: number;
  /** 消息中心：待审核的公告数 */
  messages: number;
  /** 订单处理：进行中的订单数（仅服务商视角） */
  orders: number;
}

const ZERO: MenuBadges = {
  providerReview: 0,
  withdrawals: 0,
  templates: 0,
  feedback: 0,
  messages: 0,
  orders: 0,
};

/** 角标轮询间隔（毫秒）：审核动作完成后角标自动回落 */
const POLL_MS = 60_000;

export function useBadges(): MenuBadges {
  const location = useLocation();
  const { data, refetch } = useCustom<MenuBadges>({
    url: 'console/badges',
    method: 'get',
    queryOptions: { retry: false, refetchInterval: POLL_MS },
  });

  // 路由变化时刷新：页面内完成审核后返回列表，角标应立即同步
  useEffect(() => {
    void refetch();
  }, [location.pathname, refetch]);

  const raw = data?.data as Partial<MenuBadges> | undefined;
  if (!raw) return ZERO;
  return {
    providerReview: raw.providerReview ?? 0,
    withdrawals: raw.withdrawals ?? 0,
    templates: raw.templates ?? 0,
    feedback: raw.feedback ?? 0,
    messages: raw.messages ?? 0,
    orders: raw.orders ?? 0,
  };
}
