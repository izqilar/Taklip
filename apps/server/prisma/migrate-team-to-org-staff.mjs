/**
 * 一次性迁移：ProviderTeamMember → OrgStaff（orgType=PROVIDER）。
 *
 * 文档：docs/平台角色边界规范化.md §4.2
 *  - 旧表 **保留不删**（作备份），P2 统一时再清理
 *  - 对外契约 /api/provider/team 不变（响应补 teamRole 别名），前端零感知
 *  - 幂等：按 memberNo upsert，重复执行不会重复建记录
 *  - serviceType 为空串转 null；dataScope 非法值回落 'self'；funcPerms 按 PROVIDER 层权限池裁剪
 *
 * 用法：node prisma/migrate-team-to-org-staff.mjs
 */
import { PrismaClient } from '../prisma/prisma-client/index.js';

const prisma = new PrismaClient();

const PROVIDER_PERM_POOL = [
  'order:view', 'order:handle', 'order:aftersale', 'message:send',
  'template:publish', 'content:offline', 'data:export', 'qualification:manage',
];
const PROVIDER_SCOPES = ['self', 'service', 'provider'];

/**
 * 存量 funcPerms 是中文功能名（原型 TEAM_FUNCS 口径），新体系存的是权限点 key。
 * 迁移时做一次映射，否则存量记录的权限会被整池裁掉变空。
 */
const CN_PERM_ALIAS = {
  订单查询: 'order:view',
  订单处理: 'order:handle',
  售后处理: 'order:aftersale',
  站内信收发: 'message:send',
  '模板/服务上架': 'template:publish',
  内容下架: 'content:offline',
  列表数据导出: 'data:export',
  资质管理: 'qualification:manage',
};

async function main() {
  const rows = await prisma.providerTeamMember.findMany({ orderBy: { createdAt: 'asc' } });
  console.log(`存量 ProviderTeamMember = ${rows.length} 条`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let trimmedPerms = 0;
  let fixedScope = 0;
  let aliasedPerms = 0;

  for (const m of rows) {
    const memberNo = m.memberNo;
    if (!memberNo) { skipped++; continue; }

    let scope = (m.dataScope || 'self').toString().trim() || 'self';
    if (!PROVIDER_SCOPES.includes(scope)) { scope = 'self'; fixedScope++; }

    // 中文功能名 → 权限点 key，再按 PROVIDER 池裁剪
    const rawPerms = Array.isArray(m.funcPerms) ? m.funcPerms : [];
    const mapped = rawPerms.map((p) => CN_PERM_ALIAS[p] ?? p);
    if (mapped.some((p, i) => p !== rawPerms[i])) aliasedPerms++;
    const perms = [...new Set(mapped.filter((p) => PROVIDER_PERM_POOL.includes(p)))];
    if (perms.length !== rawPerms.length) trimmedPerms++;

    const payload = {
      orgType: 'PROVIDER',
      orgId: m.providerId,
      name: m.name,
      phone: m.phone,
      accountStatus: ['ACTIVE', 'PENDING', 'DISABLED'].includes(m.accountStatus) ? m.accountStatus : 'ACTIVE',
      serviceType: m.serviceType ? m.serviceType : null,
      staffRole: m.teamRole || '执行专员',
      duties: Array.isArray(m.duties) ? m.duties : [],
      funcPerms: perms,
      dataScope: scope,
      personality: m.personality ?? null,
    };

    const exist = await prisma.orgStaff.findUnique({ where: { memberNo }, select: { id: true } });
    if (exist) {
      await prisma.orgStaff.update({ where: { memberNo }, data: payload });
      updated++;
    } else {
      await prisma.orgStaff.create({ data: { memberNo, ...payload } });
      created++;
    }
  }

  const [oldCount, newCount] = await Promise.all([
    prisma.providerTeamMember.count(),
    prisma.orgStaff.count({ where: { orgType: 'PROVIDER' } }),
  ]);

  console.log(`✓ 新建 ${created} 条 · 更新 ${updated} 条 · 跳过（无工号）${skipped} 条`);
  console.log(`✓ 中文权限名映射 ${aliasedPerms} 条 · 越权项裁剪 ${trimmedPerms} 条 · 非法 dataScope 回落 ${fixedScope} 条`);
  console.log(`\n核对：ProviderTeamMember=${oldCount}（保留作备份） · OrgStaff(PROVIDER)=${newCount}`);
}

main()
  .catch((e) => { console.error('迁移失败：', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
