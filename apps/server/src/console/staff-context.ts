/**
 * 组织内员工上下文加载（P1）。
 *
 * 单一真值源：根据绑定账号 userId 从 OrgStaff 计算「当前操作者在本平台各组织内的
 * 有效成员关系」。仅返回 `accountStatus === 'ACTIVE'` 的关系 —— DISABLED 成员被剔除，
 * 从而保证 R-05/R-06「停用必须真生效」（即便 JWT 仍是旧的，每次请求都会重算）。
 *
 * 设计为纯函数（只依赖 PrismaService），便于 jwt.strategy（每次请求）与 auth.service
 * （签发令牌）两侧复用，且无需把 StaffModule 塞进 AuthModule，规避循环依赖。
 *
 * 关联文档：docs/平台角色边界规范化.md §3.3 / §9 / §10.1。
 */
import type { PrismaService } from '../prisma/prisma.service';
import type { StaffMembership } from '../common/types/jwt-user';

/** ACTIVE 成员关系快照（attach 到 req.user.staff / JWT payload.staff） */
export async function loadStaffContext(
  prisma: PrismaService,
  userId: string | undefined | null,
): Promise<StaffMembership[]> {
  if (!userId) return [];
  const rows = await prisma.orgStaff.findMany({
    where: { userId, accountStatus: 'ACTIVE' },
    select: {
      id: true,
      orgType: true,
      orgId: true,
      staffRole: true,
      funcPerms: true,
      dataScope: true,
      accountStatus: true,
    },
  });
  return rows.map((r) => ({
    sid: r.id,
    orgType: r.orgType as StaffMembership['orgType'],
    orgId: r.orgId,
    staffRole: r.staffRole,
    funcPerms: r.funcPerms,
    dataScope: r.dataScope,
    accountStatus: r.accountStatus,
  }));
}
