'use strict';
/**
 * 只读校准脚本：用与 tier-defs.ts 完全一致的阈值，对真实库数据估算代理商/服务商
 * 贡献等级分布，核对阈值是否合理（是否全部 L0 / 大量 L4 等）。不写库、不调用受保护端点。
 */
const { PrismaClient } = require('D:/MyWorkBuddy/2026-08-10-22-39-56/apps/server/prisma/prisma-client');
const prisma = new PrismaClient();

// —— 阈值（与 apps/server/src/contribution/tier-defs.ts 同步）——
const AGENT_TIERS = [
  { level: 0, gmvCents: 0, effectiveProviders: 0 },
  { level: 1, gmvCents: 500_000, effectiveProviders: 3 },
  { level: 2, gmvCents: 3_000_000, effectiveProviders: 8 },
  { level: 3, gmvCents: 12_000_000, effectiveProviders: 20 },
  { level: 4, gmvCents: 40_000_000, effectiveProviders: 50 },
];
const PROVIDER_TIERS = [
  { level: 0, gmvCents: 0, completedOrders: 0, minRating: 0 },
  { level: 1, gmvCents: 300_000, completedOrders: 10, minRating: 4.0 },
  { level: 2, gmvCents: 2_000_000, completedOrders: 50, minRating: 4.3 },
  { level: 3, gmvCents: 8_000_000, completedOrders: 200, minRating: 4.5 },
  { level: 4, gmvCents: 30_000_000, completedOrders: 600, minRating: 4.7 },
];

function computeAgentTier(m) {
  let tier = 0;
  for (const t of AGENT_TIERS) {
    if (m.gmvCents >= t.gmvCents || m.effectiveProviders >= t.effectiveProviders) tier = t.level;
  }
  return tier;
}
function computeProviderTier(m) {
  let tier = 0;
  for (const t of PROVIDER_TIERS) {
    const ratingOk = m.reviewCount === 0 ? true : m.avgRating >= t.minRating;
    if (m.gmvCents >= t.gmvCents && m.completedOrders >= t.completedOrders && ratingOk) tier = t.level;
  }
  return tier;
}

(async () => {
  // 1) 确认新列存在 + 当前存储分布
  const stored = await prisma.$queryRawUnsafe(`
    SELECT
      SUM(CASE WHEN role='AGENT' THEN 1 ELSE 0 END) AS agents,
      SUM(CASE WHEN role='SERVICE_PROVIDER' THEN 1 ELSE 0 END) AS providers,
      SUM(CASE WHEN role='AGENT' AND agent_tier>0 THEN 1 ELSE 0 END) AS agents_graded,
      SUM(CASE WHEN role='SERVICE_PROVIDER' AND provider_tier>0 THEN 1 ELSE 0 END) AS providers_graded
    FROM "User"
  `);
  console.log('=== 当前存储分布（重算前，应全部 L0）===');
  console.log(stored[0]);

  // 2) 代理商估算
  const agents = await prisma.user.findMany({ where: { role: 'AGENT' }, select: { id: true, nickname: true, agentTier: true } });
  const agentDist = [0, 0, 0, 0, 0];
  let agentMaxGmv = 0, agentMaxSubs = 0;
  for (const a of agents) {
    const [gmvAgg, eff] = await Promise.all([
      prisma.templateOrder.aggregate({ _sum: { amount: true }, where: { status: 'paid', buyer: { agentId: a.id } } }),
      prisma.providerContract.count({ where: { signStage: 'EFFECTIVE', provider: { agentId: a.id, role: 'SERVICE_PROVIDER', providerStatus: 'APPROVED' } } }),
    ]);
    const gmv = gmvAgg._sum.amount ?? 0;
    agentMaxGmv = Math.max(agentMaxGmv, gmv);
    agentMaxSubs = Math.max(agentMaxSubs, eff);
    const tier = computeAgentTier({ gmvCents: gmv, effectiveProviders: eff });
    agentDist[tier]++;
  }
  console.log(`\n=== 代理商 (${agents.length} 个) 估算牌级分布 ===`);
  console.log('L0 L1 L2 L3 L4 =', agentDist.join(' '));
  console.log('单代理商最高 GMV(¥)=', (agentMaxGmv / 100).toFixed(2), ' 最多有效下属=', agentMaxSubs);

  // 3) 服务商估算
  const providers = await prisma.user.findMany({ where: { role: 'SERVICE_PROVIDER' }, select: { id: true, nickname: true, providerStatus: true, providerTier: true } });
  const provDist = [0, 0, 0, 0, 0];
  let provMaxGmv = 0, provMaxOrders = 0, provWithReviews = 0;
  for (const p of providers) {
    if (p.providerStatus !== 'APPROVED') { provDist[0]++; continue; }
    const [gmvAgg, orders, rating] = await Promise.all([
      prisma.templateOrder.aggregate({ _sum: { amount: true }, where: { status: 'paid', template: { authorId: p.id } } }),
      prisma.templateOrder.count({ where: { status: 'paid', template: { authorId: p.id } } }),
      prisma.review.aggregate({ _avg: { rating: true }, _count: { _all: true }, where: { providerId: p.id } }),
    ]);
    const gmv = gmvAgg._sum.amount ?? 0;
    const cnt = rating._count._all ?? 0;
    provMaxGmv = Math.max(provMaxGmv, gmv);
    provMaxOrders = Math.max(provMaxOrders, orders);
    if (cnt > 0) provWithReviews++;
    const tier = computeProviderTier({ gmvCents: gmv, completedOrders: orders, avgRating: rating._avg.rating ?? 0, reviewCount: cnt });
    provDist[tier]++;
  }
  console.log(`\n=== 服务商 (${providers.length} 个, 其中 APPROVED) 估算牌级分布 ===`);
  console.log('L0 L1 L2 L3 L4 =', provDist.join(' '));
  console.log('单服务商最高 GMV(¥)=', (provMaxGmv / 100).toFixed(2), ' 最多完单=', provMaxOrders, ' 有评价的服务商=', provWithReviews);

  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
