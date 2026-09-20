import type { PillTone } from '../components/ui/Pill';

/**
 * 统一的工单（反馈/投诉）状态映射。
 *
 * 原先 TICKET_STATUS 在 6 个页面各自定义一份，且同一枚举值映射到不同的 i18n key
 * （例如 OPEN 在 userPages 是 tkOpenReply「待回复」、在 feedback 是 pendingProcess「待处理」、
 * 在 providerPages 是 tkOpenResp「待回应」），导致同一状态在不同界面显示文案不一致。
 * 这里收敛为唯一真值源，所有界面统一文案与色调/色值。
 *
 * 每个状态同时给出 tone（供 <Pill> 使用）与 color（供 antd <Tag> 使用），
 * 下游消费方按需取用其一即可。
 */
export interface StatusMeta {
  /** i18n key（zh-CN / en 均已存在，其余语言走 fallback，不会泄漏原始 key） */
  key: string;
  /** 供 <Pill> 的色调 */
  tone: PillTone;
  /** 供 antd <Tag> 的色值 token */
  color: string;
}

export const TICKET_STATUS: Record<string, StatusMeta> = {
  OPEN: { key: 'pages.status.tkOpenReply', tone: 'warn', color: 'gold' },
  NEGOTIATING: { key: 'pages.msg.negotiating', tone: 'warn', color: 'blue' },
  ESCALATED: { key: 'pages.enum.escalated', tone: 'ac', color: 'volcano' },
  ARBITRATING: { key: 'pages.msg.arbitrating', tone: 'ac', color: 'volcano' },
  CLOSED: { key: 'pages.status.tkClosed', tone: 'ok', color: 'green' },
};

/**
 * 统一的订单状态映射。
 *
 * 原先 userPages 把 paid 标成 svcCompleted「已完成」，而 consolePages 标成 paid「已支付」，
 * 语义不一致（已支付 ≠ 已完成）。这里统一为「已支付」，并收敛为唯一真值源。
 */
export const ORDER_STATUS: Record<string, StatusMeta> = {
  pending: { key: 'pages.enum.pendingPay', tone: 'warn', color: 'orange' },
  paid: { key: 'pages.enum.paid', tone: 'ok', color: 'green' },
  refunded: { key: 'pages.enum.refunded', tone: 'bad', color: 'red' },
  cancelled: { key: 'pages.enum.cancelled', tone: 'mut', color: 'default' },
};
