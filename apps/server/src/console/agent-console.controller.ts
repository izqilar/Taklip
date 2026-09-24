import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
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
import { TemplateService } from '../template/template.service';
import { PublishService } from '../publish/publish.service';

type ReqUser = Express.Request & { user: JwtUser };

/**
 * P1：解析代理商「我的团队」接口所用组织 id。
 * - 员工（USER 身份 + AGENT 成员关系）：取其在 OrgStaff 上绑定的代理商 orgId；
 * - legacy 拥有者（AGENT）/ ADMIN 视察：自身即组织（无 subject 机制时回退 req.user.id）。
 */
const agentTeamOrg = (req: ReqUser, subject?: string): string => {
  // 视察视角：ADMIN 选定某代理商后，团队组织落到被视察代理商
  if (subject && req.user.role === 'ADMIN') return subject;
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
    private readonly template: TemplateService,
    private readonly publish: PublishService,
  ) {}

  /** 辖区前缀匹配条件；ADMIN（无 regionPath）返回 undefined → 全量 */
  private regionPrefix(user: JwtUser): { startsWith: string } | undefined {
    return user.role === 'AGENT' && user.regionPath
      ? { startsWith: user.regionPath }
      : undefined;
  }

  /**
   * 视察视角作用域解析（对标 provider-console 的 subjectId）：
   * ADMIN 带 ?subject=<代理商id> 时按被视察代理商的辖区(regionPath)/组织(id)收敛，
   * 否则取自身辖区。被视察对象必须是有效代理商且已配置辖区，否则拒绝（避免数据越权泄漏）。
   */
  private async resolveAgentScope(
    req: ReqUser,
    subject?: string,
  ): Promise<{ regionPath?: string; orgId: string }> {
    if (subject && req.user.role === 'ADMIN') {
      const agent = await this.prisma.user.findUnique({
        where: { id: subject },
        select: { id: true, role: true, regionPath: true },
      });
      if (!agent || agent.role !== 'AGENT') {
        throw new ForbiddenException('被视察对象不是有效代理商');
      }
      if (!agent.regionPath) {
        throw new ForbiddenException('被视察代理商未配置辖区');
      }
      return { regionPath: agent.regionPath, orgId: agent.id };
    }
    const rp = this.regionPrefix(req.user);
    return { regionPath: rp?.startsWith, orgId: req.user.id };
  }

  /** 辖区概览：注册用户 / 服务商 / 订单 / 反馈 + 流水汇总 */
  @Get('dashboard')
  @Roles('AGENT', 'ADMIN')
  @UseGuards(RolesGuard)
  async dashboard(@Req() req: ReqUser, @Query('subject') subject?: string) {
    const scope = await this.resolveAgentScope(req, subject);
    const rp = scope.regionPath ? { startsWith: scope.regionPath } : undefined;
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
    @Query('subject') subject?: string,
  ) {
    const scope = await this.resolveAgentScope(req, subject);
    const rp = scope.regionPath ? { startsWith: scope.regionPath } : undefined;
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
    @Query('subject') subject?: string,
  ) {
    const scope = await this.resolveAgentScope(req, subject);
    const rp = scope.regionPath ? { startsWith: scope.regionPath } : undefined;
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
    @Query('subject') subject?: string,
  ) {
    const scope = await this.resolveAgentScope(req, subject);
    const rp = scope.regionPath ? { startsWith: scope.regionPath } : undefined;
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

  /* ══════════════════ 内容审核 · 模板审核（红线闸口 · 代理一审） ══════════════════
   * 服务商提交模板 → PENDING → 代理商辖区一审（AGENT）→ APPROVED 公开；
   * 总台(ADMIN) 通过 ?subject= 视察辖区抽检，或直接走 /api/templates 总台端点。
   */

  /** 辖区待审模板（PENDING） */
  @Get('templates/pending')
  @Roles('AGENT', 'ADMIN')
  @UseGuards(RolesGuard)
  async templatesPending(@Req() req: ReqUser, @Query('subject') subject?: string) {
    const scope = await this.resolveAgentScope(req, subject);
    return this.template.listAgentPending(scope.regionPath);
  }

  /** 辖区模板审核台（全状态，支持 status / keyword / 分页） */
  @Get('templates')
  @Roles('AGENT', 'ADMIN')
  @UseGuards(RolesGuard)
  async templates(
    @Req() req: ReqUser,
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('subject') subject?: string,
  ) {
    const scope = await this.resolveAgentScope(req, subject);
    const p = page ? Number(page) : 1;
    const ps = Math.min(pageSize ? Number(pageSize) : 20, 100);
    return this.template.listAgentAll(scope.regionPath, status, keyword, (p - 1) * ps, ps);
  }

  /** 代理商一审 / 总台抽检：通过或驳回（驳回须带红线类别） */
  @Patch('templates/:id/review')
  @Roles('AGENT', 'ADMIN')
  @UseGuards(RolesGuard)
  async reviewTemplate(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Body() body: { decision: 'APPROVED' | 'REJECTED'; reviewNote?: string; redlineCategory?: string },
    @Query('subject') subject?: string,
  ) {
    const scope = await this.resolveAgentScope(req, subject);
    return this.template.agentReview(id, body.decision, body.reviewNote, req.user.id, scope.regionPath, body.redlineCategory);
  }

  /* ══════════════════ 内容审核 · 作品(服务)审核（红线闸口 · 代理一审） ════════════════
   * 服务商发布作品 → reviewStatus=review_pending（不公开）→ 代理商辖区一审 → approved 公开。
   */

  /** 辖区待审作品（服务商发布，reviewStatus=review_pending） */
  @Get('projects/pending')
  @Roles('AGENT', 'ADMIN')
  @UseGuards(RolesGuard)
  async projectsPending(@Req() req: ReqUser, @Query('subject') subject?: string) {
    const scope = await this.resolveAgentScope(req, subject);
    return this.publish.listAgentPendingProjects(scope.regionPath);
  }

  /** 辖区作品审核台（仅服务商作品，按 reviewStatus 过滤 + 分页） */
  @Get('projects')
  @Roles('AGENT', 'ADMIN')
  @UseGuards(RolesGuard)
  async projects(
    @Req() req: ReqUser,
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('subject') subject?: string,
  ) {
    const scope = await this.resolveAgentScope(req, subject);
    const p = page ? Number(page) : 1;
    const ps = Math.min(pageSize ? Number(pageSize) : 20, 100);
    return this.publish.listAgentAllProjects(scope.regionPath, status, keyword, (p - 1) * ps, ps);
  }

  /** 代理商一审作品：通过或驳回（驳回须带红线类别） */
  @Patch('projects/:id/review')
  @Roles('AGENT', 'ADMIN')
  @UseGuards(RolesGuard)
  async reviewProject(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Body() body: { decision: 'APPROVED' | 'REJECTED'; reviewNote?: string; redlineCategory?: string },
    @Query('subject') subject?: string,
  ) {
    const scope = await this.resolveAgentScope(req, subject);
    return this.publish.agentReviewProject(id, body.decision, body.reviewNote, req.user.id, scope.regionPath, body.redlineCategory);
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
    @Query('subject') subject?: string,
  ) {
    return this.staff.list('AGENT', agentTeamOrg(req, subject), page ? Number(page) : 1, pageSize ? Number(pageSize) : 20);
  }

  @Get('team/role-pool')
  @OrgAccess('AGENT')
  @UseGuards(OrgAccessGuard)
  async teamRolePool() {
    return this.staff.rolePool('AGENT');
  }

  /* ───────── 加入申请队列（用户「入驻申请」JOIN 隧道 · 拥有者审批台）─────────
   * 与服务商侧完全对齐：申请人始终是普通用户，接收后成为本代理商团队成员。
   */

  @Get('team/join-applications')
  @OrgAccess('AGENT', { requirePerm: 'team:manage' })
  @UseGuards(OrgAccessGuard)
  async listJoinApplications(@Req() req: ReqUser, @Query('status') status?: string) {
    return this.staff.listJoinQueue('AGENT', agentTeamOrg(req), status ?? 'PENDING');
  }

  @Get('team/join-applications/:id')
  @OrgAccess('AGENT', { requirePerm: 'team:manage' })
  @UseGuards(OrgAccessGuard)
  async oneJoinApplication(@Req() req: ReqUser, @Param('id') id: string) {
    return this.staff.oneJoin('AGENT', agentTeamOrg(req), id);
  }

  @Post('team/join-applications/:id/accept')
  @OrgAccess('AGENT', { requirePerm: 'team:manage' })
  @UseGuards(OrgAccessGuard)
  async acceptJoinApplication(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Body() body: { staffRole?: string },
  ) {
    const orgId = agentTeamOrg(req);
    const name = await this.orgDisplayName(orgId);
    return this.staff.acceptJoin(req.user, 'AGENT', orgId, name, id, body);
  }

  @Post('team/join-applications/:id/reject')
  @OrgAccess('AGENT', { requirePerm: 'team:manage' })
  @UseGuards(OrgAccessGuard)
  async rejectJoinApplication(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Body() body: { reviewNote?: string },
  ) {
    const orgId = agentTeamOrg(req);
    const name = await this.orgDisplayName(orgId);
    return this.staff.rejectJoin(req.user, 'AGENT', orgId, name, id, body?.reviewNote ?? '');
  }

  /** 团队展示名（用于给申请人投递回执消息） */
  private async orgDisplayName(orgId: string): Promise<string> {
    const u = await this.prisma.user.findUnique({
      where: { id: orgId },
      select: { nickname: true, realName: true, phone: true },
    });
    if (!u) return '该团队';
    return u.realName || u.nickname || (u.phone ? `${u.phone.slice(0, 3)}****${u.phone.slice(-4)}` : '该团队');
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

  /** 员工操作时间线（P3 可视化）：仅本组织成员可见，受 OrgAccess 保护 */
  @Get('team/:id/audit-logs')
  @OrgAccess('AGENT', { requirePerm: 'team:manage' })
  @UseGuards(OrgAccessGuard)
  async teamMemberAudit(@Req() req: ReqUser, @Param('id') id: string, @Query('take') take?: string) {
    return this.staff.listAudit(id, take ? Number(take) : 100);
  }

  /** 辖区结算汇总（聚合辖区服务商钱包） */
  @Get('wallet')
  @Roles('AGENT', 'ADMIN')
  @UseGuards(RolesGuard)
  async wallet(@Req() req: ReqUser, @Query('subject') subject?: string) {
    const scope = await this.resolveAgentScope(req, subject);
    const rp = scope.regionPath ? { startsWith: scope.regionPath } : undefined;
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

  /* ══════════════════ 辖区业务申请（入驻审批 · 代理一审） ══════════════════
   * 用户「入驻」资格升级隧道：FIRST_PENDING（待初审）→ FIRST_PASSED（待补资料）
   * → FINAL_PENDING（待终审）→ APPROVED（变更平台身份）。
   * 代理商只做「代理一审」（FIRST_PENDING → FIRST_PASSED / REJECTED），**不触碰身份变更**；
   * 身份变更（role 落地）仅总台 ADMIN 终审（final）环节执行。辖区按申请 regionPath 收敛。
   */

  /** 辖区入驻申请队列（只读，regionPath 前缀收敛） */
  @Get('qualifications')
  @Roles('AGENT', 'ADMIN')
  @UseGuards(RolesGuard)
  async qualifications(
    @Req() req: ReqUser,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('subject') subject?: string,
  ) {
    const scope = await this.resolveAgentScope(req, subject);
    const rp = scope.regionPath ? { startsWith: scope.regionPath } : undefined;
    if (req.user.role === 'AGENT' && !scope.regionPath) return { items: [], total: 0 };
    const where: any = rp ? { regionPath: rp } : {};
    if (status) where.status = status;
    const p = page ? Number(page) : 1;
    const ps = Math.min(pageSize ? Number(pageSize) : 20, 100);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.qualificationApplication.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, nickname: true, realName: true, phone: true, role: true } } },
      }),
      this.prisma.qualificationApplication.count({ where }),
    ]);
    return { items, total, page: p, pageSize: ps };
  }

  /** 代理一审（仅 FIRST_PENDING → FIRST_PASSED / REJECTED；不落地身份变更） */
  @Patch('qualifications/:id/review')
  @Roles('AGENT', 'ADMIN')
  @UseGuards(RolesGuard)
  async reviewQualification(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Body() body: { pass: boolean; note?: string },
    @Query('subject') subject?: string,
  ) {
    const scope = await this.resolveAgentScope(req, subject);
    const rp = scope.regionPath;
    const app = await this.prisma.qualificationApplication.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('申请不存在');
    if (rp) {
      if (!app.regionPath || !app.regionPath.startsWith(rp)) {
        throw new ForbiddenException('超出辖区范围');
      }
    } else if (req.user.role === 'AGENT') {
      throw new ForbiddenException('代理商未配置辖区');
    }
    if (app.status !== 'FIRST_PENDING') {
      throw new BadRequestException('当前状态不可初审（仅待初审可代理一审）');
    }
    const status = body.pass ? 'FIRST_PASSED' : 'REJECTED';
    const updated = await this.prisma.qualificationApplication.update({ where: { id }, data: { status } });
    await this.prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        action: 'AGENT_QUALIFICATION_FIRST_REVIEW',
        targetType: 'QUALIFICATION_APPLICATION',
        targetId: id,
        reason: body.note ?? null,
        after: { status },
      },
    });
    return updated;
  }

  /* ══════════════════ 辖区合同管理（只读） ══════════════════
   * 代理商查看辖区内服务商合同（provider.regionPath 前缀收敛）。签约/编辑属服务商自身职能，
   * 代理商仅辖区可见，不做写操作。
   */

  /** 辖区合同列表（regionPath 前缀收敛） */
  @Get('contracts')
  @Roles('AGENT', 'ADMIN')
  @UseGuards(RolesGuard)
  async contracts(
    @Req() req: ReqUser,
    @Query('signStage') signStage?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('subject') subject?: string,
  ) {
    const scope = await this.resolveAgentScope(req, subject);
    const rp = scope.regionPath ? { startsWith: scope.regionPath } : undefined;
    if (req.user.role === 'AGENT' && !scope.regionPath) return { items: [], total: 0 };
    const where: any = rp ? { provider: { regionPath: rp } } : {};
    if (signStage) where.signStage = signStage;
    const p = page ? Number(page) : 1;
    const ps = Math.min(pageSize ? Number(pageSize) : 20, 100);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.providerContract.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { createdAt: 'desc' },
        include: { provider: { select: { id: true, nickname: true, phone: true, regionPath: true } } },
      }),
      this.prisma.providerContract.count({ where }),
    ]);
    return { items, total, page: p, pageSize: ps };
  }

  /* ══════════════════ 辖区提现初审（代理一审 → 总台终审） ══════════════════
   * 代理商对辖区服务商提现做「一审」标记（reviewStage），**不触碰资金闸门**（status 仍 pending）；
   * 资金放行（status pending→paid）与驳回退款仅总台 ADMIN 终审执行。辖区按 provider.regionPath 收敛。
   */

  /** 辖区提现列表（regionPath 前缀收敛） */
  @Get('withdrawals')
  @Roles('AGENT', 'ADMIN')
  @UseGuards(RolesGuard)
  async agentWithdrawals(
    @Req() req: ReqUser,
    @Query('status') status?: string,
    @Query('reviewStage') reviewStage?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('subject') subject?: string,
  ) {
    const scope = await this.resolveAgentScope(req, subject);
    const rp = scope.regionPath ? { startsWith: scope.regionPath } : undefined;
    if (req.user.role === 'AGENT' && !scope.regionPath) return { items: [], total: 0 };
    const where: any = rp ? { provider: { regionPath: rp } } : {};
    if (status) where.status = status;
    if (reviewStage) where.reviewStage = reviewStage;
    const p = page ? Number(page) : 1;
    const ps = Math.min(pageSize ? Number(pageSize) : 20, 100);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.withdrawal.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { createdAt: 'desc' },
        include: {
          provider: { select: { id: true, nickname: true, phone: true, regionPath: true } },
          wallet: { select: { id: true, balance: true } },
        },
      }),
      this.prisma.withdrawal.count({ where }),
    ]);
    return { items, total, page: p, pageSize: ps };
  }

  /** 代理一审标记（仅 pending + AGENT_PENDING 可标记；不动资金） */
  @Patch('withdrawals/:id/review')
  @Roles('AGENT', 'ADMIN')
  @UseGuards(RolesGuard)
  async reviewWithdrawal(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Body() body: { pass: boolean; note?: string },
    @Query('subject') subject?: string,
  ) {
    const scope = await this.resolveAgentScope(req, subject);
    const rp = scope.regionPath;
    const w = await this.prisma.withdrawal.findUnique({
      where: { id },
      include: { provider: { select: { regionPath: true } } },
    });
    if (!w) throw new NotFoundException('提现记录不存在');
    if (rp) {
      if (!w.provider?.regionPath || !w.provider.regionPath.startsWith(rp)) {
        throw new ForbiddenException('超出辖区范围');
      }
    } else if (req.user.role === 'AGENT') {
      throw new ForbiddenException('代理商未配置辖区');
    }
    if (w.status !== 'pending') throw new BadRequestException('该提现已处理（资金闸门已闭合）');
    if (w.reviewStage !== 'AGENT_PENDING') throw new BadRequestException('该提现已初审');
    const stage = body.pass ? 'AGENT_PASSED' : 'AGENT_REJECTED';
    const updated = await this.prisma.withdrawal.update({
      where: { id },
      data: { reviewStage: stage, agentReviewedById: req.user.id, agentReviewedAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        action: 'AGENT_WITHDRAWAL_FIRST_REVIEW',
        targetType: 'WITHDRAWAL',
        targetId: id,
        reason: body.note ?? null,
        after: { reviewStage: stage },
      },
    });
    return updated;
  }

  /* ══════════════════ 招商拓展（代理商专有 · 招商意向池） ══════════════════
   * 区别于服务商自驱动的「入驻申请」隧道：招商意向由代理商主动拓客登记，辖区隔离。
   */

  /** 辖区招商意向列表（regionPath 前缀收敛） */
  @Get('recruits')
  @Roles('AGENT', 'ADMIN')
  @UseGuards(RolesGuard)
  async recruits(
    @Req() req: ReqUser,
    @Query('stage') stage?: string,
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('subject') subject?: string,
  ) {
    const scope = await this.resolveAgentScope(req, subject);
    const rp = scope.regionPath ? { startsWith: scope.regionPath } : undefined;
    if (req.user.role === 'AGENT' && !scope.regionPath) return { items: [], total: 0 };
    const where: any = rp ? { regionPath: rp } : {};
    if (stage) where.stage = stage;
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { phone: { contains: keyword } },
      ];
    }
    const p = page ? Number(page) : 1;
    const ps = Math.min(pageSize ? Number(pageSize) : 20, 100);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.recruitLead.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.recruitLead.count({ where }),
    ]);
    return { items, total, page: p, pageSize: ps };
  }

  /** 新建招商意向（归属当前代理商辖区；regionPath 由辖区推导，保证辖区隔离） */
  @Post('recruits')
  @Roles('AGENT', 'ADMIN')
  @UseGuards(RolesGuard)
  async createRecruit(@Req() req: ReqUser, @Body() body: any, @Query('subject') subject?: string) {
    const scope = await this.resolveAgentScope(req, subject);
    const name = (body.name || '').toString().trim();
    if (!name) throw new BadRequestException('意向主体名称必填');
    const phone = (body.phone || '').toString().trim();
    if (!/^\d{11}$/.test(phone)) throw new BadRequestException('手机号须为 11 位数字');
    // regionPath 默认取辖区前缀；若前端提供，必须落在辖区内（辖区隔离）
    const regionPath = (body.regionPath || scope.regionPath || '').toString().trim();
    if (!regionPath) throw new BadRequestException('代理商未配置辖区，无法登记招商意向');
    if (scope.regionPath && !regionPath.startsWith(scope.regionPath)) {
      throw new ForbiddenException('意向区域超出辖区范围');
    }
    const ownerAgentId = scope.orgId;
    return this.prisma.recruitLead.create({
      data: {
        name,
        phone,
        regionPath,
        regionLabel: body.regionLabel || null,
        intro: (body.intro || '').toString().trim() || null,
        stage: 'NEW',
        ownerAgentId,
      },
    });
  }

  /** 更新招商意向阶段（辖区收敛） */
  @Patch('recruits/:id')
  @Roles('AGENT', 'ADMIN')
  @UseGuards(RolesGuard)
  async updateRecruit(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Body() body: { stage?: string },
    @Query('subject') subject?: string,
  ) {
    const scope = await this.resolveAgentScope(req, subject);
    const rp = scope.regionPath;
    const lead = await this.prisma.recruitLead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('招商意向不存在');
    if (rp) {
      if (!lead.regionPath || !lead.regionPath.startsWith(rp)) {
        throw new ForbiddenException('超出辖区范围');
      }
    } else if (req.user.role === 'AGENT') {
      throw new ForbiddenException('代理商未配置辖区');
    }
    const STAGES = ['NEW', 'CONTACTED', 'WON', 'LOST'];
    const stage = body.stage && STAGES.includes(body.stage) ? body.stage : lead.stage;
    return this.prisma.recruitLead.update({ where: { id }, data: { stage } });
  }

  /* ══════════════════ 批量代理一审（与单条同守卫：辖区收敛 + 状态校验 + 审计） ══════════════════
   * 批量仅做一审标记（入驻 FIRST_PASSED/REJECTED；提现 reviewStage），不触碰身份变更 / 资金闸门；
   * 二者仍由总台 ADMIN 终审。任一条越权 / 状态不可审均计入 failed，不影响其余条（部分成功）。
   */

  /** 批量代理一审 · 入驻审批 */
  @Patch('qualifications/batch-review')
  @Roles('AGENT', 'ADMIN')
  @UseGuards(RolesGuard)
  async batchReviewQualification(
    @Req() req: ReqUser,
    @Body() body: { ids: string[]; pass: boolean; note?: string },
    @Query('subject') subject?: string,
  ) {
    const scope = await this.resolveAgentScope(req, subject);
    const rp = scope.regionPath;
    if (!Array.isArray(body.ids) || !body.ids.length) throw new BadRequestException('请选择至少一条记录');
    const failed: { id: string; reason: string }[] = [];
    let success = 0;
    for (const id of body.ids) {
      try {
        const app = await this.prisma.qualificationApplication.findUnique({ where: { id } });
        if (!app) { failed.push({ id, reason: '申请不存在' }); continue; }
        if (rp) {
          if (!app.regionPath || !app.regionPath.startsWith(rp)) { failed.push({ id, reason: '超出辖区范围' }); continue; }
        } else if (req.user.role === 'AGENT') { failed.push({ id, reason: '代理商未配置辖区' }); continue; }
        if (app.status !== 'FIRST_PENDING') { failed.push({ id, reason: '状态不可初审' }); continue; }
        const status = body.pass ? 'FIRST_PASSED' : 'REJECTED';
        await this.prisma.qualificationApplication.update({ where: { id }, data: { status } });
        await this.prisma.auditLog.create({
          data: {
            actorId: req.user.id,
            action: 'AGENT_QUALIFICATION_FIRST_REVIEW',
            targetType: 'QUALIFICATION_APPLICATION',
            targetId: id,
            reason: body.note ?? null,
            after: { status, batch: true },
          },
        });
        success++;
      } catch (e: any) {
        failed.push({ id, reason: e?.message || '处理失败' });
      }
    }
    return { success, failed };
  }

  /** 批量代理一审 · 提现初审 */
  @Patch('withdrawals/batch-review')
  @Roles('AGENT', 'ADMIN')
  @UseGuards(RolesGuard)
  async batchReviewWithdrawal(
    @Req() req: ReqUser,
    @Body() body: { ids: string[]; pass: boolean; note?: string },
    @Query('subject') subject?: string,
  ) {
    const scope = await this.resolveAgentScope(req, subject);
    const rp = scope.regionPath;
    if (!Array.isArray(body.ids) || !body.ids.length) throw new BadRequestException('请选择至少一条记录');
    const failed: { id: string; reason: string }[] = [];
    let success = 0;
    for (const id of body.ids) {
      try {
        const w = await this.prisma.withdrawal.findUnique({ where: { id }, include: { provider: { select: { regionPath: true } } } });
        if (!w) { failed.push({ id, reason: '提现记录不存在' }); continue; }
        if (rp) {
          if (!w.provider?.regionPath || !w.provider.regionPath.startsWith(rp)) { failed.push({ id, reason: '超出辖区范围' }); continue; }
        } else if (req.user.role === 'AGENT') { failed.push({ id, reason: '代理商未配置辖区' }); continue; }
        if (w.status !== 'pending') { failed.push({ id, reason: '资金闸门已闭合' }); continue; }
        if (w.reviewStage !== 'AGENT_PENDING') { failed.push({ id, reason: '已初审' }); continue; }
        const stage = body.pass ? 'AGENT_PASSED' : 'AGENT_REJECTED';
        await this.prisma.withdrawal.update({
          where: { id },
          data: { reviewStage: stage, agentReviewedById: req.user.id, agentReviewedAt: new Date() },
        });
        await this.prisma.auditLog.create({
          data: {
            actorId: req.user.id,
            action: 'AGENT_WITHDRAWAL_FIRST_REVIEW',
            targetType: 'WITHDRAWAL',
            targetId: id,
            reason: body.note ?? null,
            after: { reviewStage: stage, batch: true },
          },
        });
        success++;
      } catch (e: any) {
        failed.push({ id, reason: e?.message || '处理失败' });
      }
    }
    return { success, failed };
  }
}
