import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Prisma } from '../../prisma/prisma-client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { OrgAccess } from '../common/decorators/org-access.decorator';
import { OrgAccessGuard } from '../common/guards/org-access.guard';
import { DataScopeInterceptor } from '../common/interceptors/data-scope.interceptor';
import { UseInterceptors } from '@nestjs/common';
import type { JwtUser } from '../common/types/jwt-user';
import { AdminService } from './admin.service';
import { WalletService } from '../wallet/wallet.service';
import { StaffService } from '../console/staff.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  UpdateUserStatusDto,
  AssignRoleDto,
  ListUsersQueryDto,
  UpdateProviderReviewDto,
} from './dto/admin.dto';
import { CreateStaffDto, UpdateStaffDto } from '../console/dto/staff.dto';

type AdminRequest = Express.Request & {
  user: JwtUser;
  dataScope?: Prisma.UserWhereInput;
};

/** 总台组织 id：总台内部员工全局共享一个组织，不按账号切分 */
const CONSOLE_ORG_ID = 'console';

@Controller('api/admin')
@UseGuards(AuthGuard('jwt'))
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly walletService: WalletService,
    private readonly staff: StaffService,
    private readonly prisma: PrismaService,
  ) {}

  /** 用户列表（ADMIN 全量 / AGENT 辖区） */
  @Get('users')
  @Roles('ADMIN', 'AGENT')
  @UseGuards(RolesGuard)
  @UseInterceptors(DataScopeInterceptor)
  listUsers(@Query() query: ListUsersQueryDto, @Req() req: AdminRequest) {
    return this.adminService.listUsers({
      page: query.page ? Number(query.page) : undefined,
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
      role: query.role,
      keyword: query.keyword,
      regionPath: query.regionPath,
      scope: req.dataScope ?? {},
    });
  }

  /** 用户详情（受辖区约束） */
  @Get('users/:id')
  @Roles('ADMIN', 'AGENT')
  @UseGuards(RolesGuard)
  @UseInterceptors(DataScopeInterceptor)
  getUser(@Param('id') id: string, @Req() req: AdminRequest) {
    return this.adminService.getUserById(id, req.dataScope ?? {});
  }

  /** 启用/禁用账号（ADMIN 专用） */
  @Post('users/:id/status')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  setStatus(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.adminService.setUserStatus(req.user.id, id, dto.status);
  }

  /** 分配角色（ADMIN 专用） */
  @Post('users/:id/role')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  assignRole(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.adminService.assignRole(req.user.id, id, dto.role);
  }

  /** 服务商资质审核队列（ADMIN / AGENT 辖区）；?providerStatus 筛选资质状态，对齐侧栏角标 */
  @Get('provider-review')
  @Roles('ADMIN', 'AGENT')
  @UseGuards(RolesGuard)
  @UseInterceptors(DataScopeInterceptor)
  providerReview(
    @Req() req: AdminRequest,
    @Query('providerStatus') providerStatus?: string,
  ) {
    return this.adminService.listProviderReview(req.dataScope ?? {}, providerStatus);
  }

  /**
   * 入驻申请审核队列（总台 ADMIN）——「入驻资格升级」隧道的总台审批台。
   * 状态含义：FIRST_PENDING 待初审 / FIRST_PASSED 待用户补资料 / FINAL_PENDING 待终审 / APPROVED / REJECTED。
   * 与 provider-review（已有服务商的扩展业务资质）是两条不同的队列，勿混用。
   */
  @Get('qualifications')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async listQualifications(@Query('status') status?: string, @Query('kind') kind?: string) {
    const where: any = {};
    if (status) where.status = status;
    // 入驻层次筛选（服务商 / 代理商），与代理商侧 kind 过滤同口径
    if (kind) where.kind = kind;
    const items = await this.prisma.qualificationApplication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: {
          select: { id: true, nickname: true, realName: true, phone: true, role: true, regionPath: true },
        },
      },
    });

    // 审核人姓名与历史申请数（运营端详情需要「谁审的 / 申请人往期是否多次被拒」）
    const reviewerIds = [
      ...new Set(
        items
          .flatMap((i: any) => [i.firstReviewedById, i.finalReviewedById])
          .filter((x): x is string => !!x),
      ),
    ];
    const reviewers = reviewerIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: reviewerIds } },
          select: { id: true, nickname: true, realName: true },
        })
      : [];
    const reviewerMap = new Map(reviewers.map((r) => [r.id, r.realName || r.nickname || '—']));

    const userIds = [...new Set(items.map((i: any) => i.userId).filter(Boolean))];
    const hist = userIds.length
      ? await this.prisma.qualificationApplication.groupBy({
          by: ['userId'],
          where: { userId: { in: userIds as string[] }, status: { in: ['REJECTED', 'WITHDRAWN'] } },
          _count: { _all: true },
        })
      : [];
    const histMap = new Map(hist.map((h: any) => [h.userId, h._count?._all ?? 0]));

    const data = items.map((i: any) => ({
      ...i,
      firstReviewerName: i.firstReviewedById ? reviewerMap.get(i.firstReviewedById) ?? null : null,
      finalReviewerName: i.finalReviewedById ? reviewerMap.get(i.finalReviewedById) ?? null : null,
      historyCount: histMap.get(i.userId) ?? 0,
    }));
    return { items: data, total: data.length };
  }

  /**
   * 入驻申请风险预检（M5 / 方案 §3.3）——**只标记、不自动放行**。
   *
   * 设计取舍：自动审批一旦误批，不良主体即可开展业务并收取消费者定金，损失不可逆；
   * 因此本端点只把风险信号结构化呈现给总台审核人（并在终审时写入审计），
   * 裁定权始终在人工。触发项：重复主体 / 证件过期 / 材料缺失 / 辖区无代理商覆盖 /
   * 申请人账户异常 / 申请人已有被驳回历史。
   */
  @Get('qualifications/:id/precheck')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async precheckQualification(@Param('id') id: string) {
    const app = await this.prisma.qualificationApplication.findUnique({
      where: { id },
      include: { user: { select: { id: true, status: true, role: true, providerStatus: true, regionPath: true } } },
    });
    if (!app) throw new NotFoundException('申请不存在');

    const items: { code: string; level: 'HIGH' | 'MID' | 'LOW'; text: string }[] = [];
    const push = (code: string, level: 'HIGH' | 'MID' | 'LOW', text: string) => items.push({ code, level, text });

    // ① 重复主体：同证件号命中其它已入驻主体 / 在途申请
    if (app.certNo) {
      const dupApproved = await this.prisma.qualificationApplication.count({
        where: { certNo: app.certNo, userId: { not: app.userId }, status: 'APPROVED' },
      });
      if (dupApproved > 0) push('DUPLICATE_SUBJECT', 'HIGH', `证件号 ${app.certNo} 已存在已入驻主体，疑似重复入驻`);
      else {
        const dupPending = await this.prisma.qualificationApplication.count({
          where: {
            certNo: app.certNo,
            userId: { not: app.userId },
            status: { in: ['FIRST_PENDING', 'FIRST_PASSED', 'FINAL_PENDING'] },
          },
        });
        if (dupPending > 0) push('DUPLICATE_PENDING', 'MID', `证件号 ${app.certNo} 存在他人在途申请，需人工比对是否同一主体`);
      }
    }
    // ② 证件过期
    if (app.certExpire && !app.certLongTerm) {
      const exp = new Date(app.certExpire);
      if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
        push('CERT_EXPIRED', 'HIGH', `证件已于 ${app.certExpire} 过期`);
      }
    }
    // ③ 材料缺失
    const missing: string[] = [];
    if (!app.applicantName) missing.push('申请人姓名');
    if (!app.phone) missing.push('联系手机');
    if (!app.certNo) missing.push('证件号码');
    if (!app.certLongTerm && !app.certExpire) missing.push('证件有效期');
    if (!(app.attachments ?? []).length) missing.push('资质附件');
    if (missing.length) push('MATERIAL_MISSING', 'HIGH', `资料缺失：${missing.join('、')}`);
    // ④ 辖区无代理商覆盖（仅服务商）
    let covered: string | null = null;
    if (app.kind === 'provider' && app.regionPath) {
      const agents = await this.prisma.user.findMany({
        where: { role: 'AGENT', status: 'ACTIVE', regionPath: { not: null } },
        select: { id: true, regionPath: true },
      });
      const hit = agents
        .filter((a) => a.regionPath && (app.regionPath!.startsWith(`${a.regionPath}/`) || app.regionPath === a.regionPath))
        .sort((a, b) => (b.regionPath?.length ?? 0) - (a.regionPath?.length ?? 0))[0];
      if (hit) covered = hit.id;
      else push('NO_AGENT_COVERAGE', 'MID', '所选区域暂无代理商覆盖，通过后将成为无人一审的孤立主体');
    }
    // ⑤ 申请人账户异常
    if ((app.user as any)?.status && (app.user as any).status !== 'ACTIVE') {
      push('ACCOUNT_ABNORMAL', 'HIGH', `申请人账户状态为 ${(app.user as any).status}`);
    }
    // ⑥ 往期被驳回 / 撤回次数（重提风险）
    const history = await this.prisma.qualificationApplication.count({
      where: { userId: app.userId, status: { in: ['REJECTED', 'WITHDRAWN'] } },
    });
    if (history > 0) push('RESUBMIT_HISTORY', 'LOW', `该申请人有 ${history} 次历史被驳回 / 撤回记录`);

    const high = items.filter((i) => i.level === 'HIGH').length;
    return {
      id: app.id,
      flags: app.riskFlags ?? [],
      items,
      // 人工裁定提示：有 HIGH 项时建议重点核查，但**不阻断**终审（裁定权归人工）
      suggestion: high > 0 ? 'MANUAL_REQUIRED' : items.length ? 'REVIEW_CAREFULLY' : 'CLEAN',
      agentIdCovered: covered,
    };
  }

  /**
   * 代理商一审质量护栏（M6）—— 供总台逆向审计「第一闸口」是否形同橡皮图章。
   * 指标：一审通过 / 驳回量、平均一审时长、一审通过但被总台终审驳回的「推翻数」。
   * 推翻率过高说明该代理商把关失效，需总台介入复核。
   */
  @Get('agent-review-quality')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async agentReviewQuality() {
    const agents = await this.prisma.user.findMany({
      where: { role: 'AGENT' },
      select: { id: true, nickname: true, realName: true, regionPath: true },
    });
    const reviewed = await this.prisma.qualificationApplication.findMany({
      where: { firstReviewedById: { not: null } },
      select: {
        firstReviewedById: true,
        firstReviewedAt: true,
        createdAt: true,
        status: true,
        finalReviewedAt: true,
        kind: true,
      },
    });
    const rows = agents.map((a) => {
      const mine = reviewed.filter((r) => r.firstReviewedById === a.id);
      const passed = mine.filter((r) => r.status !== 'REJECTED');
      const rejected = mine.filter((r) => r.status === 'REJECTED');
      // 推翻：一审已通过（进入过终审环节）但最终被终审驳回
      const overturned = mine.filter((r) => r.status === 'REJECTED' && !!r.finalReviewedAt);
      const durations = mine
        .map((r) => (r.firstReviewedAt ? r.firstReviewedAt.getTime() - r.createdAt.getTime() : null))
        .filter((x): x is number => typeof x === 'number' && x >= 0);
      const avgHours = durations.length
        ? durations.reduce((s, x) => s + x, 0) / durations.length / 3600_000
        : 0;
      return {
        agentId: a.id,
        agentName: a.realName || a.nickname || '—',
        regionPath: a.regionPath,
        firstReviewed: mine.length,
        passed: passed.length,
        rejected: rejected.length,
        overturned: overturned.length,
        overturnRate: mine.length ? Number((overturned.length / mine.length).toFixed(3)) : 0,
        avgFirstReviewHours: Number(avgHours.toFixed(2)),
      };
    });
    rows.sort((x, y) => y.firstReviewed - x.firstReviewed);
    return { items: rows, total: rows.length };
  }

  /** 批准服务商扩展业务 */
  @Post('provider-review/:id/approve')
  @Roles('ADMIN', 'AGENT')
  @UseGuards(RolesGuard)
  @UseInterceptors(DataScopeInterceptor)
  approve(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body() body: { reason?: string; note?: string },
  ) {
    return this.adminService.approveProvider(req.user, id, body?.reason ?? body?.note);
  }

  /** 驳回服务商扩展业务 */
  @Post('provider-review/:id/reject')
  @Roles('ADMIN', 'AGENT')
  @UseGuards(RolesGuard)
  @UseInterceptors(DataScopeInterceptor)
  reject(@Req() req: AdminRequest, @Param('id') id: string, @Body() body: { reason?: string }) {
    return this.adminService.rejectProvider(req.user, id, body?.reason);
  }

  /**
   * 编辑服务商资料（昵称/辖区/资质状态）。用于运营端「服务商管理·编辑」弹窗。
   * 资质状态（providerStatus）允许手动覆写，便于先纠正状态再走审核流程。
   */
  @Patch('provider-review/:id')
  @Roles('ADMIN', 'AGENT')
  @UseGuards(RolesGuard)
  @UseInterceptors(DataScopeInterceptor)
  updateProvider(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body() dto: UpdateProviderReviewDto,
  ) {
    return this.adminService.updateProviderReview(req.user, id, dto);
  }

  // —— 支付闭环（管理员侧） ——

  /** 提现记录列表（ADMIN 全量，支持 ?status=pending 筛选） */
  @Get('withdrawals')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  listWithdrawals(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = page ? Number(page) : 1;
    const ps = pageSize ? Number(pageSize) : 10;
    return this.adminService.listWithdrawals({
      status,
      skip: (p - 1) * ps,
      take: ps,
    });
  }

  /** 批准提现 */
  @Post('withdrawals/:id/approve')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  approveWithdrawal(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body() body: { reason?: string; note?: string },
  ) {
    return this.adminService.approveWithdrawal(req.user, id, body?.reason ?? body?.note);
  }

  /** 驳回提现（回退余额） */
  @Post('withdrawals/:id/reject')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  rejectWithdrawal(
    @Req() req: AdminRequest,
    @Param('id') id: string,
    @Body() body: { reason?: string; note?: string },
  ) {
    return this.adminService.rejectWithdrawal(req.user, id, body?.reason ?? body?.note);
  }

  /** 审计留痕列表（ADMIN 全量，可按目标类型/对象/动作过滤） */
  @Get('audit-logs')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  listAuditLogs(
    @Query('targetType') targetType?: string,
    @Query('targetId') targetId?: string,
    @Query('action') action?: string,
    @Query('take') take?: string,
  ) {
    return this.adminService.listAuditLogs({
      targetType,
      targetId,
      action,
      take: take ? Number(take) : 100,
    });
  }

  /** 订单列表（ADMIN 全量） */
  @Get('orders')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  listOrders(
    @Query('status') status?: string,
    @Query('buyerId') buyerId?: string,
    @Query('templateId') templateId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = page ? Number(page) : 1;
    const ps = pageSize ? Number(pageSize) : 10;
    return this.adminService.listOrders({
      status,
      buyerId,
      templateId,
      skip: (p - 1) * ps,
      take: ps,
    });
  }

  /** 钱包总览（ADMIN 全量，分页；运营端 wallets 页资源 admin/wallets） */
  @Get('wallets')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  listWallets(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = page ? Number(page) : 1;
    const ps = pageSize ? Number(pageSize) : 20;
    return this.walletService.listAllWallets((p - 1) * ps, ps);
  }

  /** 管理看板汇总数据 */
  @Get('stats')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  stats() {
    return this.adminService.getStats();
  }

  /* ══════════════════ 我的团队（OrgStaff · orgType=CONSOLE） ══════════════════
   * 总台内部员工。orgId 固定为 'console'（总台不按账号切分，全局共享一个组织）。
   * 数据范围白名单 self / all；权限池为 10 域全集（已裁掉 role:manage / settings:manage）。
   */

  @Get('team')
  @OrgAccess('CONSOLE')
  @UseGuards(OrgAccessGuard)
  team(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.staff.list('CONSOLE', CONSOLE_ORG_ID, page ? Number(page) : 1, pageSize ? Number(pageSize) : 20);
  }

  @Get('team/role-pool')
  @OrgAccess('CONSOLE')
  @UseGuards(OrgAccessGuard)
  teamRolePool() {
    return this.staff.rolePool('CONSOLE');
  }

  @Post('team')
  @OrgAccess('CONSOLE', { requirePerm: 'team:manage' })
  @UseGuards(OrgAccessGuard)
  createStaff(@Req() req: AdminRequest, @Body() dto: CreateStaffDto) {
    return this.staff.create(req.user, 'CONSOLE', CONSOLE_ORG_ID, dto);
  }

  @Post('team/:id/bind')
  @OrgAccess('CONSOLE', { requirePerm: 'team:manage' })
  @UseGuards(OrgAccessGuard)
  bindStaff(@Req() req: AdminRequest, @Param('id') id: string) {
    return this.staff.bindUser(req.user, 'CONSOLE', CONSOLE_ORG_ID, id);
  }

  @Patch('team/:id')
  @OrgAccess('CONSOLE', { requirePerm: 'team:manage' })
  @UseGuards(OrgAccessGuard)
  updateStaff(@Req() req: AdminRequest, @Param('id') id: string, @Body() dto: UpdateStaffDto) {
    return this.staff.update(req.user, 'CONSOLE', CONSOLE_ORG_ID, id, dto);
  }

  @Delete('team/:id')
  @OrgAccess('CONSOLE', { requirePerm: 'team:manage' })
  @UseGuards(OrgAccessGuard)
  deleteStaff(@Req() req: AdminRequest, @Param('id') id: string) {
    return this.staff.remove(req.user, 'CONSOLE', CONSOLE_ORG_ID, id);
  }

  /** 员工操作时间线（P3 可视化）：总台层成员审计，受 OrgAccess 保护 */
  @Get('team/:id/audit-logs')
  @OrgAccess('CONSOLE', { requirePerm: 'team:manage' })
  @UseGuards(OrgAccessGuard)
  teamMemberAudit(@Req() req: AdminRequest, @Param('id') id: string, @Query('take') take?: string) {
    return this.staff.listAudit(id, take ? Number(take) : 100);
  }
}
