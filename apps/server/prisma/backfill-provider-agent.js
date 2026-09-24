/**
 * 存量服务商归属回填（M2）—— 幂等，可反复运行
 *
 * 背景：`User.agentId`（受管于某代理商）历史上全仓零写入，代理商↔服务商仅靠
 * regionPath 前缀「软匹配」。改造后终审落地会写 agentId，但**存量已审服务商**
 * 仍是 agentId=null，导致 `agentOf` 反向列表为空、归属关系不可信。
 *
 * 本脚本按与后端一致的「最长前缀匹配」规则，为存量服务商补写 agentId：
 *   - 在 role=AGENT 且 ACTIVE 且 regionPath 非空的用户中，取 regionPath 与服务商
 *     regionPath 精确相等或为其前缀（+ "/"）的**最长**一条。
 *   - 无匹配（无辖区覆盖）则跳过，留待人工分配。
 *
 * 用法：node apps/server/prisma/backfill-provider-agent.js [--dry]
 *   --dry 只输出将要执行的变更，不写库。
 */
const path = require('node:path');
const { PrismaClient } = require(path.join(__dirname, 'prisma-client'));

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

/** 最长前缀匹配：返回命中的代理商 id，无匹配返回 null */
function resolveAgentId(regionPath, agents) {
  const candidates = agents
    .filter(
      (a) =>
        !!a.regionPath &&
        (regionPath === a.regionPath || regionPath.startsWith(`${a.regionPath}/`)),
    )
    .sort((a, b) => (b.regionPath?.length ?? 0) - (a.regionPath?.length ?? 0));
  return candidates.length ? candidates[0] : null;
}

async function main() {
  const agents = await prisma.user.findMany({
    where: { role: 'AGENT', status: 'ACTIVE', regionPath: { not: null } },
    select: { id: true, regionPath: true, nickname: true, phone: true },
  });
  console.log(`[backfill] 在册代理商 ${agents.length} 位：`);
  for (const a of agents) {
    console.log(`  · ${a.nickname ?? a.phone ?? a.id}  regionPath=${a.regionPath}`);
  }

  const providers = await prisma.user.findMany({
    where: {
      role: 'SERVICE_PROVIDER',
      agentId: null,
      regionPath: { not: null },
    },
    select: { id: true, nickname: true, phone: true, regionPath: true },
  });
  console.log(`\n[backfill] 待回填服务商 ${providers.length} 位`);

  let updated = 0;
  let skipped = 0;
  for (const p of providers) {
    const agent = resolveAgentId(p.regionPath, agents);
    if (!agent) {
      skipped += 1;
      console.log(
        `  · [跳过·无辖区覆盖] ${p.nickname ?? p.phone ?? p.id} regionPath=${p.regionPath}`,
      );
      continue;
    }
    updated += 1;
    console.log(
      `  · [归属] ${p.nickname ?? p.phone ?? p.id} (${p.regionPath}) → 代理商 ${
        agent.nickname ?? agent.phone ?? agent.id
      } (${agent.regionPath})${DRY ? '  [dry-run 未写入]' : ''}`,
    );
    if (!DRY) {
      await prisma.user.update({ where: { id: p.id }, data: { agentId: agent.id } });
    }
  }

  console.log(
    `\n[backfill] 完成：回填 ${updated} 条，跳过（无辖区覆盖）${skipped} 条${
      DRY ? '（dry-run，未写入）' : ''
    }`,
  );
}

main()
  .catch((e) => {
    console.error('[backfill] 失败：', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
