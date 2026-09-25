import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import type { Prisma } from '../../prisma/prisma-client';
import type { Role, UserStatus, ProviderStatus } from '../../prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { WalletService } from '../wallet/wallet.service';
import { RegionService } from '../region/region.service';
import { AuditService } from '../audit/audit.service';
import type { JwtUser } from '../common/types/jwt-user';
import { UpdateFeeConfigDto } from './dto/admin.dto';

/** 平台分账费率全局单例行的固定主键 */
const FEE_CONFIG_ID = 'default';

const userListSelect = {
  id: true,
  phone: true,
  nickname: true,
  avatar: true,
  realName: true,
  bio: true,
  email: true,
  role: true,
  serviceRoles: true,
  pendingServiceRoles: true,
  providerStatus: true,
  status: true,
  regionId: true,
  regionPath: true,
  agentId: true,
  vipLevel: true,
  locale: true,
  wxOpenid: true,
  createdAt: true,
  providerWallet: { select: { balance: true, totalIncome: true, withdrawn: true } },
  region: { select: { id: true, code: true, name: true, regionPath: true } },
  agent: { select: { id: true, nickname: true, phone: true } },
} as const;

/**
 * 用户详情（监督镜像）选择集：在列表选择集之上补齐「四类角色个人资料字段规范」
 * 要求的资质与资产字段，供运营端「用户资料」抽屉渲染与「账户详情」一致的四分区。
 * 注意：证件号属敏感信息，仅详情返回，不进列表接口。
 */
const userDetailSelect = {
  ...userListSelect,
  idCard: true,
  // 证件影像（人像面 / 国徽面）：账户详情「身份认证资料」区块展示
  idCardFront: true,
  idCardBack: true,
  realNameStatus: true,
  realNameVerifiedAt: true,
  lastLoginAt: true,
  points: true,
  totalSpent: true,
  userBalance: true,
  followingProviderCount: true,
  updatedAt: true,
  providerWallet: { select: { balance: true, frozen: true, totalIncome: true, withdrawn: true } },
} as const;

/**
 * 回收站（僵尸用户）列表选择集：在列表选择集之上补充 zombieAt（进入回收站时间），
 * 供运营端「回收站·僵尸用户」列表渲染「回收时间」一列。
 */
const zombieListSelect = { ...userListSelect, zombieAt: true } as const;

/** 回收站用户详情选择集：在详情选择集之上补充 zombieAt */
const zombieDetailSelect = { ...userDetailSelect, zombieAt: true } as const;

/**
 * 证件号脱敏（审查 L4）：保留前 4 位与后 4 位，中间以 * 填充，
 * 既满足「核对身份」所需的可见片段，又避免完整身份证号在运营端界面/响应中明文暴露。
 */
export function maskIdCard(idCard: string): string {
  const v = idCard.trim();
  if (v.length <= 8) return v.slice(0, 2) + '*'.repeat(Math.max(v.length - 2, 1));
  return v.slice(0, 4) + '*'.repeat(v.length - 8) + v.slice(-4);
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly walletService: WalletService,
    private readonly regionService: RegionService,
    private readonly audit: AuditService,
  ) {}

  /** 用户列表：合并数据作用域（ADMIN 全量 / AGENT 辖区） */
  async listUsers(params: {
    page?: number;
    pageSize?: number;
    role?: Role;
    keyword?: string;
    regionPath?: string;
    scope: Prisma.UserWhereInput;
  }) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const pageSize = Math.min(params.pageSize && params.pageSize > 0 ? params.pageSize : 20, 100);
    // 回收站用户（isZombie）不出现在正常用户管理中，避免「已删除」记录与活跃用户混淆
    const where: Prisma.UserWhereInput = { ...params.scope, isZombie: false };

    if (params.role) where.role = params.role;
    if (params.regionPath) {
      where.regionPath = { startsWith: params.regionPath };
    }
    if (params.keyword) {
      const kw = params.keyword;
      where.OR = [
        { phone: { contains: kw } },
        { nickname: { contains: kw } },
        { realName: { contains: kw } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: userListSelect,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  /** 用户详情：受数据作用域约束（辖区外返回 404）。附带角色衍生指标，供四分区「账户详情」渲染。
   * @param viewerRole 调用者角色：仅 ADMIN 可见完整证件号；AGENT 等其他角色返回掩码后的 idCard（审查 L4）。
   */
  async getUserById(id: string, scope: Prisma.UserWhereInput, viewerRole?: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, ...scope, isZombie: false },
      select: userDetailSelect,
    });
    if (!user) throw new NotFoundException('用户不存在或不在你的管辖范围');
    const roleExtra = await this.authService.buildRoleExtra(user);
    // 最小权限：证件号属敏感信息，仅总台管理员可见明文；代理商等次级监督角色返回掩码。
    const maskedIdCard =
      viewerRole === 'ADMIN' || !user.idCard ? user.idCard : maskIdCard(user.idCard);
    return { ...user, idCard: maskedIdCard, ...roleExtra };
  }

  /** 启用/禁用账号（ADMIN 专用）。禁止禁用自己以免锁死。 */
  async setUserStatus(operatorId: string, targetId: string, status: UserStatus) {
    if (operatorId === targetId && status === 'DISABLED') {
      throw new BadRequestException('不能禁用自己的账号');
    }
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('目标用户不存在');
    return this.prisma.user.update({
      where: { id: targetId },
      data: { status },
      select: userListSelect,
    });
  }

  /** 分配角色（ADMIN 专用）。禁止自改角色、禁止降级管理员。 */
  async assignRole(operatorId: string, targetId: string, role: Role) {
    if (operatorId === targetId) {
      throw new ForbiddenException('不能修改自己的角色');
    }
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('目标用户不存在');
    if (target.role === 'ADMIN') {
      throw new ForbiddenException('管理员角色不可被修改');
    }
    // 角色管理管线（P1/P5）：禁止将任何人（含自己）提升为 ADMIN，防越权自升（见 docs/role-management-pipeline.md §4.3）
    if (role === 'ADMIN') {
      throw new BadRequestException('禁止将用户提升为管理员');
    }
    return this.prisma.user.update({
      where: { id: targetId },
      data: { role },
      select: userListSelect,
    });
  }

  /**
   * 服务商资质审核队列：按 providerStatus 筛选（对齐侧栏「入驻审核」角标），受辖区约束
   * 返回字段附带 regionNamePath（省/市/区中文名称路径），便于前端直接渲染。
   */
  async listProviderReview(scope: Prisma.UserWhereInput, providerStatus?: string) {
    const where: Prisma.UserWhereInput = { ...scope, role: 'SERVICE_PROVIDER' };
    if (providerStatus) (where as Record<string, unknown>).providerStatus = providerStatus;
    const rows = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        phone: true,
        nickname: true,
        realName: true,
        role: true,
        serviceRoles: true,
        pendingServiceRoles: true as true,
        providerStatus: true,
        regionId: true,
        regionPath: true,
        region: { select: { id: true, name: true, regionPath: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    // 解析区域名称路径并附在每条记录上，避免前端二次查树
    const enriched = await Promise.all(
      rows.map(async (r) => ({
        ...r,
        regionNamePath: await this.regionService.getNamePathByCodePath(r.regionPath),
      })),
    );
    return enriched;
  }

  /** 校验目标用户是否落在操作者辖区内（AGENT 必须、ADMIN 跳过） */
  private assertWithinScope(operator: JwtUser, target: { regionPath?: string | null }) {
    if (operator.role === 'AGENT' && operator.regionPath) {
      if (!target.regionPath || !target.regionPath.startsWith(operator.regionPath)) {
        throw new ForbiddenException('该服务商不在你的管辖范围内');
      }
    }
  }

  /** 批准服务商资质/扩展业务。支持两种待审形态：
   *  1) 初始入驻审核：providerStatus === PENDING（或 REJECTED 后重新申请）→ APPROVED
   *  2) 已入驻服务商扩展业务：pendingServiceRoles 非空 → 合并进 serviceRoles
   * 幂等：已通过且无待扩展业务则 409（STATE_CONFLICT）。
   */
  async approveProvider(operator: JwtUser, targetId: string, reason?: string) {
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('目标用户不存在');
    if (target.role !== 'SERVICE_PROVIDER') {
      throw new BadRequestException('仅服务商存在待审业务');
    }
    this.assertWithinScope(operator, target);

    const isInitial = target.providerStatus === 'PENDING';
    const isRejected = target.providerStatus === 'REJECTED';
    const hasPending = (target.pendingServiceRoles ?? []).length > 0;

    if (!isInitial && !isRejected && !hasPending) {
      throw new ConflictException('该服务商暂无待审业务，无法重复审批（STATE_CONFLICT）');
    }

    const mergedRoles = hasPending
      ? Array.from(new Set([...(target.serviceRoles ?? []), ...(target.pendingServiceRoles ?? [])]))
      : target.serviceRoles ?? [];

    const before = {
      providerStatus: target.providerStatus,
      serviceRoles: target.serviceRoles,
      pendingServiceRoles: target.pendingServiceRoles,
    };

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: {
        providerStatus: 'APPROVED' as ProviderStatus,
        serviceRoles: mergedRoles,
        pendingServiceRoles: [],
      },
      select: {
        id: true,
        providerStatus: true,
        serviceRoles: true,
        pendingServiceRoles: true,
      },
    });

    await this.audit.log({
      actor: operator,
      action: 'PROVIDER_APPROVE',
      targetType: 'USER',
      targetId,
      reason: reason ?? null,
      before,
      after: {
        providerStatus: updated.providerStatus,
        serviceRoles: updated.serviceRoles,
        pendingServiceRoles: updated.pendingServiceRoles,
      },
    });

    return updated;
  }

  /**
   * 驳回服务商资质/扩展业务。
   *  1) 初始入驻审核 PENDING → REJECTED，并清空 serviceRoles / pendingServiceRoles
   *  2) 已入驻扩展业务 → 仅清空 pendingServiceRoles，保留已有 serviceRoles
   * 幂等：已驳回且无待扩展业务则 409（STATE_CONFLICT）。
   * reason 为审核意见，当前 User 模型无对应持久化列，仅作审计入参。
   */
  async rejectProvider(operator: JwtUser, targetId: string, reason?: string) {
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('目标用户不存在');
    if (target.role !== 'SERVICE_PROVIDER') {
      throw new BadRequestException('仅服务商存在待审业务');
    }
    this.assertWithinScope(operator, target);

    const isInitial = target.providerStatus === 'PENDING';
    const hasPending = (target.pendingServiceRoles ?? []).length > 0;

    if (!isInitial && target.providerStatus === 'REJECTED' && !hasPending) {
      throw new ConflictException('该服务商暂无待审业务，无法重复驳回（STATE_CONFLICT）');
    }

    const before = {
      providerStatus: target.providerStatus,
      serviceRoles: target.serviceRoles,
      pendingServiceRoles: target.pendingServiceRoles,
    };

    const data: Prisma.UserUpdateInput = isInitial
      ? {
          providerStatus: 'REJECTED' as ProviderStatus,
          serviceRoles: [],
          pendingServiceRoles: [],
        }
      : { pendingServiceRoles: [] };

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data,
      select: {
        id: true,
        providerStatus: true,
        serviceRoles: true,
        pendingServiceRoles: true,
      },
    });

    await this.audit.log({
      actor: operator,
      action: 'PROVIDER_REJECT',
      targetType: 'USER',
      targetId,
      reason: reason ?? null,
      before,
      after: {
        providerStatus: updated.providerStatus,
        serviceRoles: updated.serviceRoles,
        pendingServiceRoles: updated.pendingServiceRoles,
      },
    });

    return updated;
  }

  /**
   * 编辑服务商资料：对齐运营端「服务商管理·编辑」弹窗。
   * - 可改：nickname（服务商名称）、regionId（绑定辖区）、providerStatus（资质状态）
   * - 受辖区约束（AGENT 必须落在自身 regionPath 下；ADMIN 跳过）
   * - regionId 通过 RegionService 校验存在性，并同步写入 regionPath
   * - reason 为编辑理由（运营端强制留痕），写入审计日志
   */
  async updateProviderReview(
    operator: JwtUser,
    targetId: string,
    dto: {
      nickname?: string;
      regionId?: string;
      providerStatus?: ProviderStatus;
      reason?: string;
    },
  ) {
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('服务商不存在');
    if (target.role !== 'SERVICE_PROVIDER') {
      throw new BadRequestException('该用户不是服务商');
    }
    this.assertWithinScope(operator, target);

    if (!dto.reason || !dto.reason.trim()) {
      throw new BadRequestException('编辑理由不能为空');
    }

    const before = {
      nickname: target.nickname,
      providerStatus: target.providerStatus,
      regionId: target.regionId,
      regionPath: target.regionPath,
    };

    const data: Prisma.UserUpdateInput = {};
    if (dto.nickname !== undefined) data.nickname = dto.nickname;
    if (dto.providerStatus !== undefined) data.providerStatus = dto.providerStatus;
    if (dto.regionId !== undefined) {
      const region = await this.regionService.getById(dto.regionId);
      if (!region) throw new BadRequestException('所选区域不存在');
      data.region = { connect: { id: region.id } };
      data.regionPath = region.regionPath;
    }

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data,
      select: {
        id: true,
        phone: true,
        nickname: true,
        realName: true,
        role: true,
        serviceRoles: true,
        pendingServiceRoles: true,
        providerStatus: true,
        regionId: true,
        regionPath: true,
      },
    });

    await this.audit.log({
      actor: operator,
      action: 'PROVIDER_EDIT',
      targetType: 'USER',
      targetId,
      reason: dto.reason.trim(),
      before,
      after: {
        nickname: updated.nickname,
        providerStatus: updated.providerStatus,
        regionId: updated.regionId,
        regionPath: updated.regionPath,
      },
    });

    const regionNamePath = await this.regionService.getNamePathByCodePath(updated.regionPath);
    return { ...updated, regionNamePath };
  }

  /**
   * 删除服务商账号（总台「服务商管理·删除」，用于清理僵尸用户 / 错误账户记录）。
   *
   * 安全策略：
   *  - 仅总台超级管理员可调用（控制器 @Roles('ADMIN')）；运维管理员（只读）侧
   *    按钮为前端禁用态，不会发出请求。AGENT 调用时叠加辖区校验，越界即 403。
   *  - 禁止删除：当前登录账号自身 / ADMIN 角色账号 / 非服务商账号。
   *  - **业务留痕闸门**：存在订单、合同、提现记录、钱包流水/余额、名下下级账号时拒绝，
   *    提示改用「禁用」—— 僵尸用户与错误账户本就不该有这些留痕，避免破坏资金与法律追溯链。
   *  - 通过闸门后，在单个事务内按依赖顺序清理该账号的个人数据再删账号；
   *    若仍触发外键约束（P2003），事务整体回滚并回 409，绝不产生「半删除」脏状态。
   */
  async deleteProviderAccount(operator: JwtUser, targetId: string, reason?: string) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        phone: true,
        nickname: true,
        realName: true,
        role: true,
        serviceRoles: true,
        pendingServiceRoles: true,
        providerStatus: true,
        regionId: true,
        regionPath: true,
        status: true,
      },
    });
    if (!target) throw new NotFoundException('服务商不存在');
    if (target.id === operator.id) throw new BadRequestException('不能删除当前登录账号');
    if (target.role === 'ADMIN') throw new ForbiddenException('管理员账号不可删除');
    if (target.role !== 'SERVICE_PROVIDER') {
      throw new BadRequestException('该用户不是服务商（本入口仅清理服务商账号）');
    }
    this.assertWithinScope(operator, target);

    // —— 业务留痕闸门 ——
    const [orders, contracts, withdrawals, walletLogs, wallet, subordinates] =
      await this.prisma.$transaction([
        this.prisma.templateOrder.count({
          where: { OR: [{ buyerId: targetId }, { template: { authorId: targetId } }] },
        }),
        this.prisma.providerContract.count({ where: { providerId: targetId } }),
        this.prisma.withdrawal.count({ where: { providerId: targetId } }),
        this.prisma.walletLog.count({ where: { userId: targetId } }),
        this.prisma.providerWallet.findUnique({ where: { providerId: targetId } }),
        this.prisma.user.count({ where: { agentId: targetId } }),
      ]);
    const blockers: string[] = [];
    if (orders) blockers.push(`成交/购买订单 ${orders} 笔`);
    if (contracts) blockers.push(`合同 ${contracts} 份`);
    if (withdrawals) blockers.push(`提现记录 ${withdrawals} 条`);
    if (walletLogs) blockers.push(`钱包流水 ${walletLogs} 条`);
    if (
      wallet &&
      (wallet.balance !== 0 || wallet.frozen !== 0 || wallet.totalIncome !== 0 || wallet.withdrawn !== 0)
    ) {
      blockers.push('钱包存在余额 / 收益');
    }
    if (subordinates) blockers.push(`名下 ${subordinates} 个下级账号`);
    if (blockers.length) {
      throw new ConflictException(
        `该账号存在业务留痕（${blockers.join('、')}），不可物理删除；请改用「禁用」以保留追溯链`,
      );
    }

    const before = {
      phone: target.phone,
      nickname: target.nickname,
      realName: target.realName,
      providerStatus: target.providerStatus,
      regionId: target.regionId,
      regionPath: target.regionPath,
      serviceRoles: target.serviceRoles,
      pendingServiceRoles: target.pendingServiceRoles,
      accountStatus: target.status,
    };

    await this.cascadeDeleteUserData(targetId);

    await this.audit.log({
      actor: operator,
      action: 'PROVIDER_DELETE',
      targetType: 'USER',
      targetId,
      reason: reason?.trim() || '总台删除服务商账号',
      before,
      after: null,
    });

    return { id: targetId, deleted: true, phone: target.phone, nickname: target.nickname };
  }

  /**
   * 级联物理删除某用户及其全部从属数据（在单个事务内按依赖顺序清理，无业务留痕则不留孤儿行）。
   * 被「服务商管理·删除」(deleteProviderAccount，经业务留痕闸门后) 与「回收站·彻底删除」(purgeZombieUser) 复用。
   * 若仍触发外键约束（P2003），事务整体回滚并抛 409，绝不产生「半删除」脏状态。
   */
  private async cascadeDeleteUserData(targetId: string) {
    try {
      await this.prisma.$transaction(async (tx) => {
        // 依赖顺序：先叶子（级联由 Project→ProjectVersion 承担）后主体
        await tx.messageRead.deleteMany({ where: { userId: targetId } });
        await tx.review.deleteMany({
          where: { OR: [{ userId: targetId }, { providerId: targetId }] },
        });
        await tx.ticket.deleteMany({
          where: { OR: [{ reporterId: targetId }, { targetId }, { assigneeId: targetId }] },
        });
        await tx.message.deleteMany({
          where: { OR: [{ authorId: targetId }, { recipientId: targetId }] },
        });
        await tx.templateAppeal.deleteMany({ where: { providerId: targetId } });
        await tx.project.deleteMany({ where: { userId: targetId } });
        await tx.asset.deleteMany({ where: { userId: targetId } });
        await tx.template.deleteMany({ where: { authorId: targetId } });
        await tx.qualificationApplication.deleteMany({ where: { userId: targetId } });
        await tx.userCoupon.deleteMany({ where: { userId: targetId } });
        await tx.teamJoinApplication.deleteMany({ where: { userId: targetId } });
        // 服务商自有的无外键附属数据（不留孤儿行）
        await tx.providerSchedule.deleteMany({ where: { providerId: targetId } });
        await tx.providerLicense.deleteMany({ where: { providerId: targetId } });
        await tx.providerClientReach.deleteMany({ where: { providerId: targetId } });
        await tx.providerClient.deleteMany({ where: { providerId: targetId } });
        await tx.withdrawal.deleteMany({ where: { providerId: targetId } });
        await tx.walletLog.deleteMany({ where: { userId: targetId } });
        await tx.providerWallet.deleteMany({ where: { providerId: targetId } });
        // 员工档案属「组织资产」：仅解绑 userId，不删除档案本身
        await tx.orgStaff.updateMany({ where: { userId: targetId }, data: { userId: null } });
        await tx.user.delete({ where: { id: targetId } });
      });
    } catch (e: any) {
      // P2003 = 外键约束：仍有业务数据引用该账号。事务已整体回滚，无脏数据。
      if (e?.code === 'P2003') {
        throw new ConflictException('该账号仍被其他业务数据引用，无法删除；请改用「禁用」');
      }
      throw e;
    }
  }

  /**
   * 软删除用户至回收站（总台「用户管理·删除」）：标记 isZombie=true，记录 zombieAt，并停用账号。
   * 不物理删除任何数据，保留完整追溯链；后续可从回收站「激活」恢复原数据，或「彻底删除」物理清除。
   * 仅 ADMIN（含具备 user:delete 权限的运维管理员）可调，控制器 @Roles('ADMIN') 已拦截。
   */
  async softDeleteUser(operator: JwtUser, targetId: string, reason?: string) {
    if (operator.id === targetId) throw new BadRequestException('不能删除当前登录账号');
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        phone: true,
        nickname: true,
        realName: true,
        role: true,
        status: true,
        isZombie: true,
        providerStatus: true,
        regionId: true,
        regionPath: true,
        serviceRoles: true,
        pendingServiceRoles: true,
      },
    });
    if (!target) throw new NotFoundException('目标用户不存在');
    if (target.isZombie) throw new BadRequestException('该用户已在回收站中');
    if (target.role === 'ADMIN') throw new ForbiddenException('管理员账号不可删除');

    const before = {
      phone: target.phone,
      nickname: target.nickname,
      realName: target.realName,
      role: target.role,
      status: target.status,
    };

    await this.prisma.user.update({
      where: { id: targetId },
      data: { isZombie: true, zombieAt: new Date(), status: 'DISABLED' },
    });

    await this.audit.log({
      actor: operator,
      action: 'USER_SOFT_DELETE',
      targetType: 'USER',
      targetId,
      reason: reason?.trim() || '用户管理删除至回收站',
      before,
      after: { isZombie: true, status: 'DISABLED', zombieAt: new Date().toISOString() },
    });

    return { id: targetId, zombie: true, status: 'DISABLED' };
  }

  /** 回收站：僵尸用户列表（isZombie=true），按回收时间倒序 */
  async listZombieUsers(params: { page?: number; pageSize?: number; keyword?: string }) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const pageSize = Math.min(params.pageSize && params.pageSize > 0 ? params.pageSize : 20, 100);
    const where: Prisma.UserWhereInput = { isZombie: true };
    if (params.keyword) {
      const kw = params.keyword;
      where.OR = [
        { phone: { contains: kw } },
        { nickname: { contains: kw } },
        { realName: { contains: kw } },
      ];
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { zombieAt: 'desc' },
        select: zombieListSelect,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  /** 回收站：僵尸用户详情（受 isZombie 约束，正常用户管理接口不可见） */
  async getZombieUserById(id: string, viewerRole?: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, isZombie: true },
      select: zombieDetailSelect,
    });
    if (!user) throw new NotFoundException('回收站中不存在该用户');
    const roleExtra = await this.authService.buildRoleExtra(user);
    const maskedIdCard =
      viewerRole === 'ADMIN' || !user.idCard ? user.idCard : maskIdCard(user.idCard);
    return { ...user, idCard: maskedIdCard, ...roleExtra };
  }

  /**
   * 回收站：激活（恢复原数据）。将 isZombie 复位、状态置 ACTIVE，用户重新回到正常用户管理列表。
   * 对应「若该用户后续重新注册，可激活此前删除的僵尸用户记录恢复原数据」——直接恢复原记录而非新建重复账号。
   */
  async activateZombieUser(operator: JwtUser, targetId: string, reason?: string) {
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('用户不存在');
    if (!target.isZombie) throw new BadRequestException('该用户不在回收站中，无需激活');
    if (operator.id === targetId) throw new BadRequestException('不能激活当前登录账号');

    const before = { isZombie: true, status: target.status };
    await this.prisma.user.update({
      where: { id: targetId },
      data: { isZombie: false, zombieAt: null, status: 'ACTIVE' },
    });

    await this.audit.log({
      actor: operator,
      action: 'USER_RESTORE',
      targetType: 'USER',
      targetId,
      reason: reason?.trim() || '回收站激活·恢复原数据',
      before,
      after: { isZombie: false, status: 'ACTIVE' },
    });

    return { id: targetId, restored: true, status: 'ACTIVE' };
  }

  /**
   * 回收站：彻底删除（物理清除）。仅针对回收站内用户；复用 cascadeDeleteUserData 级联清理从属数据。
   * 与「服务商管理·删除」不同，此处不设置业务留痕闸门——用户已在回收站中，运营明确选择彻底清除。
   * 仍受外键约束保护：若有未预料到的引用，事务回滚并报 409。
   */
  async purgeZombieUser(operator: JwtUser, targetId: string, reason?: string) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        phone: true,
        nickname: true,
        realName: true,
        role: true,
        status: true,
        isZombie: true,
        providerStatus: true,
        regionId: true,
        regionPath: true,
        serviceRoles: true,
        pendingServiceRoles: true,
      },
    });
    if (!target) throw new NotFoundException('用户不存在');
    if (!target.isZombie) throw new BadRequestException('仅回收站内的用户可被彻底删除');
    if (operator.id === targetId) throw new BadRequestException('不能删除当前登录账号');
    if (target.role === 'ADMIN') throw new ForbiddenException('管理员账号不可删除');

    const before = {
      phone: target.phone,
      nickname: target.nickname,
      realName: target.realName,
      role: target.role,
      status: target.status,
    };

    await this.cascadeDeleteUserData(targetId);

    await this.audit.log({
      actor: operator,
      action: 'USER_PURGE',
      targetType: 'USER',
      targetId,
      reason: reason?.trim() || '回收站彻底删除',
      before,
      after: null,
    });

    return { id: targetId, purged: true };
  }

  /** 角色管理管线：当前操作者可做的权限摘要，供 Refine accessControlProvider 使用 */
  getPermissions(role: Role): string[] {
    if (role === 'ADMIN') {
      return [
        'user:read',
        'user:update',
        'user:role',
        'user:delete',
        'provider:review',
        'agent:manage',
        'region:read',
        'wallet:read',
        'wallet:manage',
        'order:read',
      ];
    }
    if (role === 'AGENT') {
      return ['user:read', 'provider:review', 'region:read'];
    }
    return [];
  }

  // —— 支付闭环（管理员侧） ——

  /** 提现记录列表（全量，支持状态筛选） */
  async listWithdrawals(params: { status?: string; skip?: number; take?: number }) {
    const where: Prisma.WithdrawalWhereInput = {};
    if (params.status) where.status = params.status;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.withdrawal.findMany({
        where,
        skip: params.skip ?? 0,
        take: params.take ?? 50,
        orderBy: { createdAt: 'desc' },
        include: {
          provider: {
            select: { id: true, nickname: true, phone: true, avatar: true },
          },
          wallet: { select: { id: true, balance: true } },
        },
      }),
      this.prisma.withdrawal.count({ where }),
    ]);
    return { items, total };
  }

  /** 批准提现（调用 WalletService 业务规则，并写审计留痕） */
  async approveWithdrawal(operator: JwtUser, id: string, reason?: string) {
    const w = await this.prisma.withdrawal.findUnique({ where: { id } });
    const before = w ? { status: w.status, amount: w.amount } : undefined;
    const updated = await this.walletService.approveWithdrawal(id);
    await this.audit.log({
      actor: operator,
      action: 'WITHDRAWAL_APPROVE',
      targetType: 'WITHDRAWAL',
      targetId: id,
      reason: reason ?? null,
      before,
      after: { status: (updated as any)?.status },
    });
    return updated;
  }

  /** 驳回提现（调用 WalletService 业务规则，回退余额，并写审计留痕） */
  async rejectWithdrawal(operator: JwtUser, id: string, reason?: string) {
    const w = await this.prisma.withdrawal.findUnique({ where: { id } });
    const before = w ? { status: w.status, amount: w.amount } : undefined;
    const updated = await this.walletService.rejectWithdrawal(id);
    await this.audit.log({
      actor: operator,
      action: 'WITHDRAWAL_REJECT',
      targetType: 'WITHDRAWAL',
      targetId: id,
      reason: reason ?? null,
      before,
      after: { status: (updated as any)?.status },
    });
    return updated;
  }

  /** 审计留痕列表（ADMIN 查看，可按 targetType/targetId/action 过滤） */
  async listAuditLogs(params: {
    targetType?: string;
    targetId?: string;
    action?: string;
    take?: number;
  }) {
    const where: Prisma.AuditLogWhereInput = {};
    if (params.targetType) where.targetType = params.targetType;
    if (params.targetId) where.targetId = params.targetId;
    if (params.action) where.action = params.action;
    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.take ?? 100,
    });
  }

  /** 订单列表（全量，支持状态/模板/买家筛选） */
  async listOrders(params: {
    status?: string;
    buyerId?: string;
    templateId?: string;
    skip?: number;
    take?: number;
  }) {
    const where: Prisma.TemplateOrderWhereInput = {};
    if (params.status) where.status = params.status;
    if (params.buyerId) where.buyerId = params.buyerId;
    if (params.templateId) where.templateId = params.templateId;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.templateOrder.findMany({
        where,
        skip: params.skip ?? 0,
        take: params.take ?? 50,
        orderBy: { createdAt: 'desc' },
        include: {
          buyer: { select: { id: true, nickname: true, phone: true } },
          template: { select: { id: true, name: true, category: true, cover: true } },
        },
      }),
      this.prisma.templateOrder.count({ where }),
    ]);
    return { items, total };
  }

  /** 管理后台数据看板汇总 */
  async getStats() {
    const [users, providers, agents, orders, pendingWithdrawals] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: 'SERVICE_PROVIDER' } }),
      this.prisma.user.count({ where: { role: 'AGENT' } }),
      this.prisma.templateOrder.count(),
      this.prisma.withdrawal.count({ where: { status: 'pending' } }),
    ]);

    // 平台总流水与已提现汇总（聚合钱包/订单）
    const [{ _sum: revenueSum }] = await this.prisma.$transaction([
      this.prisma.templateOrder.aggregate({ _sum: { amount: true, platformFee: true } }),
    ]);
    const [{ _sum: withdrawnSum }] = await this.prisma.$transaction([
      this.prisma.providerWallet.aggregate({ _sum: { withdrawn: true } }),
    ]);
    const totalRevenueCents = revenueSum.amount ?? 0;
    const platformFeeCents = revenueSum.platformFee ?? 0;
    const totalWithdrawnCents = withdrawnSum.withdrawn ?? 0;

    return {
      users,
      providers,
      agents,
      orders,
      pendingWithdrawals,
      totalRevenueCents,
      platformFeeCents,
      totalWithdrawnCents,
    };
  }

  /* ══════════════════ 财务中心 · 分账费率 ══════════════════
   * 全局单例配置（id 恒为 'default'），承载运营端「分账费率」页。
   * 三方比例恒等式：platformRate + agentRate + providerRate = 100
   * —— providerRate 不接收前端入参，由服务端推导，避免被手工写歪。
   */

  /**
   * 读取分账费率。首次访问时以 Prisma 默认值即时建行，
   * 保证前端表单永远有初始值（无需手工 seed）。
   */
  async getFeeConfig() {
    const existing = await this.prisma.platformFeeConfig.findUnique({
      where: { id: FEE_CONFIG_ID },
    });
    if (existing) return existing;
    return this.prisma.platformFeeConfig.create({ data: { id: FEE_CONFIG_ID } });
  }

  /**
   * 更新分账费率（只更新传入字段）。
   * 校验：① 平台抽成 + 代理商分账 ≤ 100（否则服务商分账为负）
   *      ② 类目费率覆盖值必须是 0-100 的整数百分比
   */
  async updateFeeConfig(operator: JwtUser, dto: UpdateFeeConfigDto) {
    const current = await this.getFeeConfig();

    const platformRate = dto.platformRate ?? current.platformRate;
    const agentRate = dto.agentRate ?? current.agentRate;
    if (platformRate + agentRate > 100) {
      throw new BadRequestException('平台抽成与代理商分账之和不能超过 100%');
    }
    if (platformRate + agentRate < 0) {
      throw new BadRequestException('分账比例不能为负数');
    }
    const providerRate = 100 - platformRate - agentRate;

    if (dto.categoryRates) {
      const invalid = Object.entries(dto.categoryRates).filter(
        ([, v]) => typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 100,
      );
      if (invalid.length) {
        throw new BadRequestException('类目费率必须为 0-100 的整数百分比');
      }
    }

    const before = {
      platformRate: current.platformRate,
      agentRate: current.agentRate,
      providerRate: current.providerRate,
      settlePeriod: current.settlePeriod,
      minWithdrawCents: current.minWithdrawCents,
    };

    const updated = await this.prisma.platformFeeConfig.update({
      where: { id: FEE_CONFIG_ID },
      data: {
        platformRate,
        agentRate,
        providerRate,
        ...(dto.settlePeriod ? { settlePeriod: dto.settlePeriod } : {}),
        ...(dto.categoryRates
          ? { categoryRates: dto.categoryRates as Prisma.InputJsonValue }
          : {}),
        ...(dto.minWithdrawCents !== undefined
          ? { minWithdrawCents: dto.minWithdrawCents }
          : {}),
        updatedBy: operator.id,
      },
    });

    await this.audit.log({
      actor: operator,
      action: 'FEE_CONFIG_UPDATE',
      targetType: 'PLATFORM_FEE_CONFIG',
      targetId: FEE_CONFIG_ID,
      reason: '总台更新平台分账费率',
      before,
      after: {
        platformRate: updated.platformRate,
        agentRate: updated.agentRate,
        providerRate: updated.providerRate,
        settlePeriod: updated.settlePeriod,
        minWithdrawCents: updated.minWithdrawCents,
      },
    });

    return updated;
  }
}
