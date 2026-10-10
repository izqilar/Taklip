'use strict';
/**
 * 一次性 E2E：直接实例化编译后的 PrismaService / AuditService / ContributionService
 * （均为普通构造注入类，无需 Nest DI 容器），调用真实 ContributionService.recomputeAll()，
 * 将贡献等级写入 User 表，并回读校验。不依赖受保护的管理端点。
 */
const SERVER_DIST = 'D:/MyWorkBuddy/2026-08-10-22-39-56/apps/server/dist';

process.on('unhandledRejection', (r) => { console.error('UNHANDLED REJECTION:', r && r.stack ? r.stack : String(r)); process.exit(1); });

(async () => {
  try {
    console.log('[1] requiring classes...');
    const { PrismaService } = require(pathSafe('prisma', 'prisma.service'));
    const { AuditService } = require(pathSafe('audit', 'audit.service'));
    const { ContributionService } = require(pathSafe('contribution', 'contribution.service'));

    console.log('[2] instantiating PrismaService (connect)...');
    const prisma = new PrismaService();
    await prisma.onModuleInit();
    console.log('[3] DB connected');

    const audit = new AuditService(prisma);
    const svc = new ContributionService(prisma, audit);
    console.log('[4] ContributionService ready');

    console.log('[5] calling recomputeAll()...');
    const result = await svc.recomputeAll();
    console.log('[6] recomputeAll 返回: agents=' + result.agents + ' providers=' + result.providers);

    const after = await prisma.$queryRawUnsafe(`
      SELECT
        SUM(CASE WHEN role='AGENT' THEN 1 ELSE 0 END) AS agents,
        SUM(CASE WHEN role='SERVICE_PROVIDER' THEN 1 ELSE 0 END) AS providers,
        SUM(CASE WHEN role='AGENT' AND agent_tier>0 THEN 1 ELSE 0 END) AS agents_graded,
        SUM(CASE WHEN role='SERVICE_PROVIDER' AND provider_tier>0 THEN 1 ELSE 0 END) AS providers_graded
      FROM "User"
    `);
    const a = after[0];
    console.log('[7] 重算后存储分布: agents=' + a.agents + ' providers=' + a.providers +
      ' agents_graded=' + a.agents_graded + ' providers_graded=' + a.providers_graded);

    const samples = await prisma.$queryRawUnsafe(`
      SELECT role, nickname, agent_tier, provider_tier, tier_score, tier_updated_at
      FROM "User"
      WHERE role IN ('AGENT','SERVICE_PROVIDER')
      ORDER BY GREATEST(agent_tier, provider_tier) DESC, tier_score DESC
      LIMIT 5
    `);
    console.log('[8] 等级最高 Top5 样例:');
    for (const s of samples) {
      console.log(`    ${s.role}\t${s.nickname ?? '(no name)'}\tagentTier=${s.agent_tier}\tproviderTier=${s.provider_tier}\tscore=${s.tier_score}\tupdated=${s.tier_updated_at}`);
    }

    await prisma.$disconnect();
    console.log('[9] done (exit)');
    process.exit(0);
  } catch (e) {
    console.error('E2E recompute failed:', e && e.stack ? e.stack : String(e));
    process.exit(1);
  }
})();

function pathSafe(...parts) {
  // 避免裸 require 在 pnpm 下解析到旧的 store client：用绝对物理路径
  return require('path').join('D:/MyWorkBuddy/2026-08-10-22-39-56/apps/server/dist', ...parts);
}
