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
}
