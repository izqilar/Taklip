/**
 * 代理商 / 服务商 贡献等级定义（P-tier 单一真值源）
 *
 * 等级采用「牌级」命名，与用户 VIP「卡级」(银卡/金卡/黑金) 区分，避免混淆。
 * 金额阈值以「分」存储（与全站金额口径一致），展示时由前端 formatCents 转 ¥。
 *
 * 定档口径（双指标）：
 *  - 晋档：累计值达到阈值即升（鼓励长期贡献）。
 *  - 保档：由每日批跑结合「近 90 天活跃 + 评分红线」评估；本文件只定义晋档阈值，
 *    保档/降级红线在 contribution.service.ts 的 computeXxxTier 内置（评分 < 红线强制降档）。
 */

export interface AgentTierDef {
  level: number;
  code: string;
  nameKey: string;
  /** 辖区累计 GMV 阈值（分） */
  gmvCents: number;
  /** 有效下属服务商数阈值（EFFECTIVE 合同 + APPROVED 资质） */
  effectiveProviders: number;
}

export interface ProviderTierDef {
  level: number;
  code: string;
  nameKey: string;
  /** 累计成交额阈值（分） */
  gmvCents: number;
  /** 完单数阈值（status=paid） */
  completedOrders: number;
  /** 平均评分红线（Review.rating 均值，1..5）；无评价时视为达标 */
  minRating: number;
}

/** 代理商等级 L0 见习 → L4 钻石 */
export const AGENT_TIERS: readonly AgentTierDef[] = [
  { level: 0, code: 'L0', nameKey: 'pages.tier.agent.L0', gmvCents: 0, effectiveProviders: 0 },
  { level: 1, code: 'L1', nameKey: 'pages.tier.agent.L1', gmvCents: 500_000, effectiveProviders: 3 }, // ¥5,000
  { level: 2, code: 'L2', nameKey: 'pages.tier.agent.L2', gmvCents: 3_000_000, effectiveProviders: 8 }, // ¥30,000
  { level: 3, code: 'L3', nameKey: 'pages.tier.agent.L3', gmvCents: 12_000_000, effectiveProviders: 20 }, // ¥120,000
  { level: 4, code: 'L4', nameKey: 'pages.tier.agent.L4', gmvCents: 40_000_000, effectiveProviders: 50 }, // ¥400,000
];

/** 服务商等级 L0 新锐 → L4 钻石 */
export const PROVIDER_TIERS: readonly ProviderTierDef[] = [
  { level: 0, code: 'L0', nameKey: 'pages.tier.provider.L0', gmvCents: 0, completedOrders: 0, minRating: 0 },
  { level: 1, code: 'L1', nameKey: 'pages.tier.provider.L1', gmvCents: 300_000, completedOrders: 10, minRating: 4.0 }, // ¥3,000
  { level: 2, code: 'L2', nameKey: 'pages.tier.provider.L2', gmvCents: 2_000_000, completedOrders: 50, minRating: 4.3 }, // ¥20,000
  { level: 3, code: 'L3', nameKey: 'pages.tier.provider.L3', gmvCents: 8_000_000, completedOrders: 200, minRating: 4.5 }, // ¥80,000
  { level: 4, code: 'L4', nameKey: 'pages.tier.provider.L4', gmvCents: 30_000_000, completedOrders: 600, minRating: 4.7 }, // ¥300,000
];

export interface AgentMetrics {
  gmvCents: number;
  effectiveProviders: number;
}

export interface ProviderMetrics {
  gmvCents: number;
  completedOrders: number;
  avgRating: number;
  reviewCount: number;
}

/** 代理商定档：GMV 或 有效下属服务商 任一达标即晋档（取最高达标档） */
export function computeAgentTier(m: AgentMetrics): number {
  let tier = 0;
  for (const t of AGENT_TIERS) {
    if (m.gmvCents >= t.gmvCents || m.effectiveProviders >= t.effectiveProviders) tier = t.level;
  }
  return tier;
}

/** 服务商定档：GMV + 完单数 + 评分 三项同时达标才晋档；无评价时评分项视为达标 */
export function computeProviderTier(m: ProviderMetrics): number {
  let tier = 0;
  for (const t of PROVIDER_TIERS) {
    const ratingOk = m.reviewCount === 0 ? true : m.avgRating >= t.minRating;
    if (m.gmvCents >= t.gmvCents && m.completedOrders >= t.completedOrders && ratingOk) tier = t.level;
  }
  return tier;
}

/** 贡献评分快照（仅用于展示/诊断，不参与定档） */
export function agentScore(m: AgentMetrics): number {
  return Math.round(m.gmvCents / 100) + m.effectiveProviders * 1000;
}
export function providerScore(m: ProviderMetrics): number {
  return Math.round(m.gmvCents / 100) + m.completedOrders * 100 + Math.round(m.avgRating * 100);
}

export const MAX_AGENT_TIER = AGENT_TIERS.length - 1;
export const MAX_PROVIDER_TIER = PROVIDER_TIERS.length - 1;
