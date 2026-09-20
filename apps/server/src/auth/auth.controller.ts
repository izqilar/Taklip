import { Body, Controller, Get, Post, Patch, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import type { ServiceRole } from '../../prisma/prisma-client';
import { RegisterDto, LoginDto, UpdateProfileDto, ChangePasswordDto } from './dto/auth.dto';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseGuards(new RateLimitGuard(5, 60_000, 'register'))
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @UseGuards(new RateLimitGuard(10, 60_000, 'login'))
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @UseGuards(new RateLimitGuard(20, 60_000, 'refresh'))
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  /**
   * 签发一次性跨端票据（需登录）：把登录态从一端「安全」带到另一端，
   * 避免把 JWT 明文放进 URL query。落地端用 /auth/exchange 兑换。
   */
  @Post('ticket')
  @UseGuards(AuthGuard('jwt'), new RateLimitGuard(30, 60_000, 'ticket'))
  issueTicket(@Req() req: Express.Request & { user: { id: string } }) {
    return this.authService.issueTicket(req.user.id);
  }

  /**
   * 用一次性票据兑换完整登录令牌（公开，但票据 45s 单次有效）。
   * 落地端 bootstrap 在启动最早阶段消费 URL 里的 ?ticket= 时调用。
   */
  @Post('exchange')
  @UseGuards(new RateLimitGuard(20, 60_000, 'exchange'))
  exchangeTicket(@Body('ticket') ticket: string) {
    return this.authService.exchangeTicket(ticket);
  }

  @Post('me')
  @UseGuards(AuthGuard('jwt'))
  me(@Req() req: Express.Request & { user: { id: string } }) {
    return req.user;
  }

  /** 拉取当前操作者完整自身资料（运营端「我的资料」详情页使用） */
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  getMe(@Req() req: Express.Request & { user: { id: string } }) {
    return this.authService.getMe(req.user.id);
  }

  /** 角色管理管线（P1）：返回操作者角色/区域/权限摘要，供 Refine accessControlProvider */
  @Get('access')
  @UseGuards(AuthGuard('jwt'))
  access(@Req() req: Express.Request & { user: { id: string } }) {
    return this.authService.getAccess(req.user as any);
  }

  /** USER → SERVICE_PROVIDER 申请入驻服务商（需登录，可多选服务类型） */
  @Post('apply-provider')
  @UseGuards(AuthGuard('jwt'), new RateLimitGuard(5, 60_000, 'apply-provider'))
  applyProvider(
    @Req() req: Express.Request & { user: { id: string } },
    @Body() body: { serviceRoles?: ServiceRole[] },
  ) {
    return this.authService.applyForProvider(req.user.id, body.serviceRoles ?? []);
  }

  /** 服务商提交资质审核（混合审核模型）：PENDING → APPROVED，需登录且已是 SERVICE_PROVIDER */
  @Post('submit-provider-review')
  @UseGuards(AuthGuard('jwt'), new RateLimitGuard(5, 60_000, 'submit-provider-review'))
  submitProviderReview(@Req() req: Express.Request & { user: { id: string } }) {
    return this.authService.submitProviderReview(req.user.id);
  }

  /** 已入驻且通过审核的服务商申请扩展业务（增加服务子角色） */
  @Post('provider/expand-services')
  @UseGuards(AuthGuard('jwt'), new RateLimitGuard(5, 60_000, 'provider-expand-services'))
  expandServices(
    @Req() req: Express.Request & { user: { id: string } },
    @Body() body: { serviceRoles?: ServiceRole[] },
  ) {
    return this.authService.expandServiceRoles(req.user.id, body.serviceRoles ?? []);
  }

  /** 管理员批准服务商 pendingServiceRoles（仅 ADMIN 可调用） */
  @Post('provider/approve-services')
  @Roles('ADMIN')
  @UseGuards(AuthGuard('jwt'), RolesGuard, new RateLimitGuard(10, 60_000, 'provider-approve-services'))
  approveServices(
    @Req() req: Express.Request & { user: { id: string } },
    @Body('userId') userId: string,
  ) {
    return this.authService.approveServiceRoles(userId);
  }

  /** 更新账户资料（昵称 / 头像 / 手机），需登录 */
  @Patch('me')
  @UseGuards(AuthGuard('jwt'))
  updateProfile(
    @Req() req: Express.Request & { user: { id: string } },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(req.user.id, dto);
  }

  /** 修改密码，需登录（校验原密码） */
  @Post('change-password')
  @UseGuards(AuthGuard('jwt'), new RateLimitGuard(5, 60_000, 'change-password'))
  changePassword(
    @Req() req: Express.Request & { user: { id: string } },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.id, dto.oldPassword, dto.newPassword);
  }
}
