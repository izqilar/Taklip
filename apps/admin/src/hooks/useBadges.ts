import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useCustom } from '@refinedev/core';
import { useLayer } from '../providers/layerContext';

/**
 * 侧栏菜单待办角标（原型 .mi 的「菜单名 + 统计数字」）。
 *
 * 数值全部来自服务端 `GET /api/console/badges`，按当前角色作用域统计，
 * 且与各列表页的默认筛选口径一致 —— 避免「角标 12 条、点进去只有 3 条」的错位。
 *
 * 取值失败或角色无对应权限时全部回落为 0，即不显示角标（不臆造数字）。
 *
 * 作用域与运营端「视察门控」一致：
 *  - 自身视角（ADMIN 总台自查 / 真实 SERVICE_PROVIDER·AGENT·USER 自有工作台）：
 *    展示当前登录账号自身的聚合待办（真实角色无 subject，后端按自身 JWT 身份统计）。
 *  - 仅 ADMIN 视察他人（agent/provider/user 非自身视角）：需先检索选定具体账号，
 *    角标才反映该账号的真实待办；未选定任何账号时一律为 0（不泄露管理员全局数据）。
 *  （注意：真实角色登录运营端是其【自己】的工作台，绝不可被当成「未选视察对象」而清零角标。）
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
  /** 用户视角·通知公告：本人可见、已发布、未读(无回执)的公告数 */
  noticeUnread: number;
  /** 用户视角·业务消息：本人可见、已发布、未读(无回执)的业务消息数（待处理子集） */
  messagePending: number;
  /** 用户视角·我的反馈：本人发起、未关闭的工单数（待回复子集） */
  feedbackPending: number;
  /** 服务商 / 代理商·团队管理：本组织收到的「加入团队」在途(PENDING)申请数 */
  joinPending: number;
  // ── 代理商视角新增角标（v2 红线闸口 + 辖区治理）──
  /** 代理商·入驻审批：辖区待初审/复审的入驻申请数 */
  onboarding: number;
  /** 代理商·资质审核：辖区资质待审数 */
  qualification: number;
  /** 代理商·模板审核：本辖区待审(PENDING)模板数（仅 regionPath，区别于总台 templates） */
  templateReview: number;
  /** 代理商·服务审核：本辖区待审(REVIEW_PENDING)服务/作品数 */
  serviceReview: number;
  /** 代理商·意见反馈：辖区待处理投诉/建议工单数 */
  agentComplaints: number;
  /** 代理商·提现初审：辖区服务商提现待初审(pending)数 */
  withdrawReview: number;
  /** 代理商·招商申请：辖区招商新申请数 */
  investPending: number;
  /** 代理商·业务消息：待处理业务消息数（区别于总台 messages） */
  agentMessages: number;
}

const ZERO: MenuBadges = {
  providerReview: 0,
  withdrawals: 0,
  templates: 0,
  feedback: 0,
  messages: 0,
  orders: 0,
  noticeUnread: 0,
  messagePending: 0,
  feedbackPending: 0,
  joinPending: 0,
  // ── 代理商视角新增角标 ──
  onboarding: 0,
  qualification: 0,
  templateReview: 0,
  serviceReview: 0,
  agentComplaints: 0,
  withdrawReview: 0,
  investPending: 0,
  agentMessages: 0,
};

/** 角标轮询间隔（毫秒）：审核动作完成后角标自动回落 */
const POLL_MS = 60_000;

export function useBadges(): MenuBadges {
  const location = useLocation();
  const { view, objectScope, isOwnView } = useLayer();

  // 是否为「ADMIN 视察他人」：非自身视角且已选定被视察对象。
  // 真实角色自有工作台（isOwnView）不带 subject，后端用自身 JWT 身份统计。
  const inspecting = !isOwnView && !!objectScope?.id;
  const subject = inspecting ? objectScope!.id : null;
  // 启用：自身视角（含真实角色）恒启用；ADMIN 仅在其确实在视察他人时启用
  const enabled = isOwnView || inspecting;

  const url = subject ? `console/badges?subject=${encodeURIComponent(subject)}` : 'console/badges';

  const { data, refetch } = useCustom<MenuBadges>({
    url,
    method: 'get',
    queryOptions: { retry: false, refetchInterval: POLL_MS, enabled },
  });

  // 路由变化时刷新：页面内完成审核后返回列表，角标应立即同步
  useEffect(() => {
    if (enabled) void refetch();
  }, [location.pathname, refetch, enabled]);

  // 未启用（非总台且无视察对象）或数据未返回：一律 0
  if (!enabled) return ZERO;
  const raw = data?.data as Partial<MenuBadges> | undefined;
  if (!raw) return ZERO;
  return {
    providerReview: raw.providerReview ?? 0,
    withdrawals: raw.withdrawals ?? 0,
    templates: raw.templates ?? 0,
    feedback: raw.feedback ?? 0,
    messages: raw.messages ?? 0,
    orders: raw.orders ?? 0,
    noticeUnread: raw.noticeUnread ?? 0,
    messagePending: raw.messagePending ?? 0,
    feedbackPending: raw.feedbackPending ?? 0,
    joinPending: raw.joinPending ?? 0,
    // ── 代理商视角新增角标 ──
    onboarding: raw.onboarding ?? 0,
    qualification: raw.qualification ?? 0,
    templateReview: raw.templateReview ?? 0,
    serviceReview: raw.serviceReview ?? 0,
    agentComplaints: raw.agentComplaints ?? 0,
    withdrawReview: raw.withdrawReview ?? 0,
    investPending: raw.investPending ?? 0,
    agentMessages: raw.agentMessages ?? 0,
  };
}
