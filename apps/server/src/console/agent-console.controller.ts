import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { OrgAccess } from '../common/decorators/org-access.decorator';
import { OrgAccessGuard, staffOrgIdOf } from '../common/guards/org-access.guard';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtUser } from '../common/types/jwt-user';
import { bucketMonthly, since180 } from './chart-util';
import { StaffService } from './staff.service';
import { CreateStaffDto, UpdateStaffDto } from './dto/staff.dto';

type ReqUser = Express.Request & { user: JwtUser };

/**
 * P1：解析代理商「我的团队」接口所用组织 id。
 * - 员工（USER 身份 + AGENT 成员关系）：取其在 OrgStaff 上绑定的代理商 orgId；
 * - legacy 拥有者（AGENT）/ ADMIN 视察：自身即组织（无 subject 机制时回退 req.user.id）。
 */
const agentTeamOrg = (req: ReqUser): string => {
  if (req.user.role === 'USER') {
    const oid = staffOrgIdOf(req.user, 'AGENT');
    if (!oid) throw new ForbiddenException('非该代理商成员');
    return oid;
  }
  return req.user.id;
};

const userSelect = {
  id: true,
  phone: true,
  nickname: true,
  avatar: true,
  realName: true,
  role: true,
  serviceRoles: true,
  pendingServiceRoles: true,
  providerStatus: true,
  status: true,
  regionId: true,
  regionPath: true,
  agentId: true,
  createdAt: true,
} as const;

/**
 * 代理商中心（AGENT 辖区视角）作用域端点。
 * 辖区匹配沿用国标 regionPath 前缀链（与 DataScopeInterceptor 一致）。
 * 复用现有 /api/tickets、/api/messages 的按角色作用域逻辑覆盖反馈/消息页，
 * 本控制器只负责代理商独有的「辖区用户/服务商/订单/结算/看板」。
 */
@Controller('api/agent')
@UseGuards(AuthGuard('jwt'))
export class AgentConsoleController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly staff: StaffService,
  ) {}

  /** 辖区前缀匹配条件；ADMIN（无 regionPath）返回 undefined → 全量 */
  private regionPrefix(user: JwtUser): { startsWith: string } | undefined {
    return user.role === 'AGENT' && user.regionPath
      ? { startsWith: user.regionPath }
      : undefined;
  }

  /** 辖区概览：注册用户 / 服务商 / 订单 / 反馈 + 流水汇总 */
  @Get('dashboard')
  @Roles('AGENT', 'ADMIN')
  @UseGuards(RolesGuard)
  async dashboard(@Req() req: ReqUser) {
    const rp = this.regionPrefix(req.user);
    const userWhere = rp ? { regionPath: rp } : {};
    const orderWhere = rp ? { buyer: { regionPath: rp } } : {};
    const [
      users,
      providers,
      orderTotal,
      dealOrders,
      refundedOrders,
      refundAgg,
      tickets,
      revenue,
      catAgg,
      revRows,
    ] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { ...userWhere, role: 'USER' } }),
      this.prisma.user.count({ where: { ...userWhere, role: 'SERVICE_PROVIDER' } }),
      this.prisma.templateOrder.count({ where: orderWhere }),
      this.prisma.templateOrder.count({ where: { ...orderWhere, status: 'paid' } }),
      this.prisma.templateOrder.count({ where: { ...orderWhere, status: 'refunded' } }),
      // 辖区退款聚合（金额 + 抽成）：退款率(金额口径) 与辖区流水净额
      this.prisma.templateOrder.aggregate({
        where: { ...orderWhere, status: 'refunded' },
        _sum: { amount: true, platformFee: true },
      }),
      this.prisma.ticket.count({ where: rp ? { regionPath: rp } : {} }),
      this.prisma.templateOrder.aggregate({
        where: orderWhere,
        _sum: { amount: true, platformFee: true },
      }),
      // 图表①：辖区服务商发布的服务按类别占比（findMany + 内存聚合，规避 groupBy 类型约束）
      this.prisma.template.findMany({
        where: rp ? { author: { regionPath: { startsWith: rp.startsWith } } } : {},
        select: { category: true },
      }),
      // 图表②：近 180 天辖区流水（按自然月聚合）
      this.prisma.templateOrder.findMany({
        where: rp
          ? { buyer: { regionPath: rp }, createdAt: { gte: since180() } }
          : { createdAt: { gte: since180() } },
        select: { amount: true, createdAt: true },
        take: 2000,
      }),
    ]);
    const catMap = new Map<string, number>();
    for (const t of catAgg) {
      const c = t.category || '未分类';
      catMap.set(c, (catMap.get(c) ?? 0) + 1);
    }
    const serviceCategoryShare = [...catMap.entries()].map(([category, count]) => ({
      category,
      count,
    }));
    const totalPayCents = revenue._sum.amount ?? 0;
    const refundCents = refundAgg._sum.amount ?? 0;
    // 辖区流水 = 总支付 − 退款（净额，退单冲减）
    const totalRevenueCents = Math.max(0, totalPayCents - refundCents);
    const platformFeeCents = Math.max(
      0,
      (revenue._sum.platformFee ?? 0) - (refundAgg._sum.platformFee ?? 0),
    );
    return {
      users,
      providers,
      orderTotal,
      dealOrders,
      refundedOrders,
      dealRate: orderTotal ? Math.round((dealOrders / orderTotal) * 1000) / 10 : 0,
      returnRate: orderTotal ? Math.round((refundedOrders / orderTotal) * 1000) / 10 : 0,
      refundRate: totalPayCents ? Math.round((refundCents / totalPayCents) * 1000) / 10 : 0,
      tickets,
      totalRevenueCents,
      platformFeeCents,
      serviceCategoryShare,
      monthlyRevenue: bucketMonthly(
        revRows.map((r) => ({ amount: r.amount, date: r.createdAt })),
      ),
    };
  }

  /** 辖区用户（role=USER） */
  @Get('users')
  @Roles('AGENT', 'ADMIN')
  @UseGuards(RolesGuard)
  async users(
    @Req() req: ReqUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
  ) {
    const rp = this.regionPrefix(req.user);
    const where: any = { role: 'USER', ...(rp ? { regionPath: rp } : {}) };
    if (keyword) {
      where.OR = [
        { phone: { contains: keyword } },
        { nickname: { contains: keyword } },
      ];
    }
    const p = page ? Number(page) : 1;
    const ps = Math.min(pageSize ? Number(pageSize) : 20, 100);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { createdAt: 'desc' },
        select: userSelect,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page: p, pageSize: ps };
  }

  /** 辖区服务商（role=SERVICE_PROVIDER） */
  @Get('providers')
  @Roles('AGENT', 'ADMIN')
  @UseGuards(RolesGuard)
  async providers(
    @Req() req: ReqUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
  ) {
    const rp = this.regionPrefix(req.user);
    const where: any = { role: 'SERVICE_PROVIDER', ...(rp ? { regionPath: rp } : {}) };
    if (keyword) {
      where.OR = [
        { phone: { contains: keyword } },
        { nickname: { contains: keyword } },
        { realName: { contains: keyword } },
      ];
    }
    const p = page ? Number(page) : 1;
    const ps = Math.min(pageSize ? Number(pageSize) : 20, 100);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { createdAt: 'desc' },
        select: userSelect,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page: p, pageSize: ps };
  }

  /** 辖区订单（买家落在辖区） */
  @Get('orders')
  @Roles('AGENT', 'ADMIN')
  @UseGuards(RolesGuard)
  async orders(
    @Req() req: ReqUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    const rp = this.regionPrefix(req.user);
    const where: any = rp ? { buyer: { regionPath: rp } } : {};
    if (status) where.status = status;
    const p = page ? Number(page) : 1;
    const ps = Math.min(pageSize ? Number(pageSize) : 10, 100);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.templateOrder.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { createdAt: 'desc' },
        include: {
          buyer: { select: { id: true, nickname: true, phone: true, regionPath: true } },
          template: { select: { id: true, name: true, category: true, cover: true } },
        },
      }),
      this.prisma.templateOrder.count({ where }),
    ]);
    return { items, total, page: p, pageSize: ps };
  }

  /* ══════════════════ 我的团队（OrgStaff · orgType=AGENT） ══════════════════
   * 与服务商层同构：岗位池来自 STAFF_ROLE_POOLS.AGENT（无工种联动），
   * 数据范围白名单 self / region / agent，权限池按 agent 层域 + 红线裁剪。
   */

  @Get('team')
  @OrgAccess('AGENT')
  @UseGuards(OrgAccessGuard)
  async team(
    @Req() req: ReqUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.staff.list('AGENT', agentTeamOrg(req), page ? Number(page) : 1, pageSize ? Number(pageSize) : 20);
  }

  @Get('team/role-pool')
  @OrgAccess('AGENT')
  @UseGuards(OrgAccessGuard)
  async teamRolePool() {
    return this.staff.rolePool('AGENT');
  }

  @Post('team')
  @OrgAccess('AGENT', { requirePerm: 'team:manage' })
  @UseGuards(OrgAccessGuard)
  async createStaff(@Req() req: ReqUser, @Body() dto: CreateStaffDto) {
    return this.staff.create(req.user, 'AGENT', agentTeamOrg(req), dto);
  }

  @Post('team/:id/bind')
  @OrgAccess('AGENT', { requirePerm: 'team:manage' })
  @UseGuards(OrgAccessGuard)
  async bindStaff(@Req() req: ReqUser, @Param('id') id: string) {
    return this.staff.bindUser(req.user, 'AGENT', agentTeamOrg(req), id);
  }

  @Patch('team/:id')
  @OrgAccess('AGENT', { requirePerm: 'team:manage' })
  @UseGuards(OrgAccessGuard)
  async updateStaff(@Req() req: ReqUser, @Param('id') id: string, @Body() dto: UpdateStaffDto) {
    return this.staff.update(req.user, 'AGENT', agentTeamOrg(req), id, dto);
  }

  @Delete('team/:id')
  @OrgAccess('AGENT', { requirePerm: 'team:manage' })
  @UseGuards(OrgAccessGuard)
  async deleteStaff(@Req() req: ReqUser, @Param('id') id: string) {
    return this.staff.remove(req.user, 'AGENT', agentTeamOrg(req), id);
  }

  /** 辖区结算汇总（聚合辖区服务商钱包） */
  @Get('wallet')
  @Roles('AGENT', 'ADMIN')
  @UseGuards(RolesGuard)
  async wallet(@Req() req: ReqUser) {
    const rp = this.regionPrefix(req.user);
    const where = rp ? { provider: { regionPath: rp } } : {};
    const [count, agg] = await this.prisma.$transaction([
      this.prisma.providerWallet.count({ where }),
      this.prisma.providerWallet.aggregate({
        where,
        _sum: { balance: true, totalIncome: true, withdrawn: true },
      }),
    ]);
    return {
      providerCount: count,
      balanceCents: agg._sum.balance ?? 0,
      totalIncomeCents: agg._sum.totalIncome ?? 0,
      withdrawnCents: agg._sum.withdrawn ?? 0,
    };
  }
}
