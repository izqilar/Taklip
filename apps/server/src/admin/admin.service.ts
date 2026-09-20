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
  realNameStatus: true,
  realNameVerifiedAt: true,
  lastLoginAt: true,
  points: true,
  totalSpent: true,
  userBalance: true,
  followingProviderCount: true,
  providerWallet: { select: { balance: true, frozen: true, totalIncome: true, withdrawn: true } },
} as const;

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
    const where: Prisma.UserWhereInput = { ...params.scope };

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

  /** 用户详情：受数据作用域约束（辖区外返回 404）。附带角色衍生指标，供四分区「账户详情」渲染。 */
  async getUserById(id: string, scope: Prisma.UserWhereInput) {
    const user = await this.prisma.user.findFirst({
      where: { id, ...scope },
      select: userDetailSelect,
    });
    if (!user) throw new NotFoundException('用户不存在或不在你的管辖范围');
    const roleExtra = await this.authService.buildRoleExtra(user);
    return { ...user, ...roleExtra };
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

  /** 角色管理管线：当前操作者可做的权限摘要，供 Refine accessControlProvider 使用 */
  getPermissions(role: Role): string[] {
    if (role === 'ADMIN') {
      return [
        'user:read',
        'user:update',
        'user:role',
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
}
