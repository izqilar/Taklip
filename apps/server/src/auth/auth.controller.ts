import { Body, Controller, Get, Post, Patch, UseGuards, Req, Res, Query, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuthService } from './auth.service';
import type { ServiceRole } from '../../prisma/prisma-client';
import { RegisterDto, LoginDto, UpdateProfileDto, ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto } from './dto/auth.dto';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(200)
  @UseGuards(new RateLimitGuard(5, 60_000, 'register'))
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  @UseGuards(new RateLimitGuard(20, 60_000, 'login'))
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
  issueTicket(
    @Req() req: Express.Request & { user: { id: string; role: string } },
    @Body('subject') subject?: string,
  ) {
    // 跨端桥接票据（运营端用户视角工作台内嵌 Web 页用）：
    // 监督视角（ADMIN / AGENT 在「用户视角」视察他人）可为「被视察对象」签发 Web 端一次性票据，
    // 使内嵌的 Web 页以该用户身份渲染其自有数据；其余角色（USER / SERVICE_PROVIDER）只许
    // 为本账号签发，subject 被忽略 —— 杜绝借 subject 越权冒充他人。
    const canDelegate = req.user.role === 'ADMIN' || req.user.role === 'AGENT';
    const targetId = canDelegate && subject ? subject : req.user.id;
    return this.authService.issueTicket(targetId);
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

  /**
   * 申请入驻服务商（需登录，可多选服务类型）。
   *
   * ⚠️ 语义变更（安全缺口 P-A 收口）：本端点**不再直接变更 `User.role`**，
   * 仅创建 QualificationApplication（status=FIRST_PENDING）进入两段审管线
   * （代理商一审 → 总台终审）。身份变更只在终审 APPROVED 时落地。
   * 正规入口见 `POST /api/user/qualifications`（web `Apply.tsx` 已使用）。
   */
  @Post('apply-provider')
  @UseGuards(AuthGuard('jwt'), new RateLimitGuard(5, 60_000, 'apply-provider'))
  applyProvider(
    @Req() req: Express.Request & { user: { id: string } },
    @Body() body: { serviceRoles?: ServiceRole[] },
  ) {
    return this.authService.applyForProvider(req.user.id, body.serviceRoles ?? []);
  }

  // ⚠️ `POST /api/auth/submit-provider-review`（自助把 providerStatus 置 APPROVED）已下线 —— 安全缺口 P-A。
  // 资质审核必须由总台终审落地，禁止自助通过；旧调用方请改走 QualificationApplication 管线。

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

  // ─────────────────────────────────────────────────────────────
  // 密码找回 / 重置（G-4）
  // ─────────────────────────────────────────────────────────────

  /** 忘记密码：提交任一登录标识，定位账户并发放重置凭证（D1 当前为模拟送达） */
  @Post('forgot-password')
  @HttpCode(200)
  @UseGuards(new RateLimitGuard(5, 60_000, 'forgot-password'))
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  /** 重置密码：凭重置令牌设置新密码 */
  @Post('reset-password')
  @HttpCode(200)
  @UseGuards(new RateLimitGuard(10, 60_000, 'reset-password'))
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // ─────────────────────────────────────────────────────────────
  // 微信扫码登录（G-2）
  // ─────────────────────────────────────────────────────────────

  /** 发起微信扫码：返回 state 与二维码 URL */
  @Post('wechat/qr/start')
  @HttpCode(200)
  @UseGuards(new RateLimitGuard(10, 60_000, 'wechat-qr-start'))
  wechatQrStart() {
    return this.authService.qrStart('wechat');
  }

  /** 轮询微信扫码状态（done 时一次性返回令牌） */
  @Get('wechat/qr/status')
  wechatQrStatus(@Query('state') state: string) {
    return this.authService.qrStatus(state);
  }

  /** 微信开放平台回调（用户扫码确认后由微信重定向至此） */
  @Get('wechat/callback')
  @UseGuards(new RateLimitGuard(10, 60_000, 'wechat-callback'))
  async wechatCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const { redirectUrl } = await this.authService.qrCallback('wechat', code, state);
    return res.redirect(redirectUrl);
  }

  /** 开发态模拟微信扫码（仅非生产可用，无开放平台资质时演练全流程） */
  @Post('wechat/qr/dev-scan')
  @HttpCode(200)
  @UseGuards(new RateLimitGuard(10, 60_000, 'wechat-dev-scan'))
  wechatDevScan(@Body('state') state: string, @Body('openid') openid?: string) {
    return this.authService.qrDevScan('wechat', state, openid);
  }

  // ─────────────────────────────────────────────────────────────
  // QQ 扫码登录（G-3）—— 与微信同构
  // ─────────────────────────────────────────────────────────────

  @Post('qq/qr/start')
  @HttpCode(200)
  @UseGuards(new RateLimitGuard(10, 60_000, 'qq-qr-start'))
  qqQrStart() {
    return this.authService.qrStart('qq');
  }

  @Get('qq/qr/status')
  qqQrStatus(@Query('state') state: string) {
    return this.authService.qrStatus(state);
  }

  @Get('qq/callback')
  @UseGuards(new RateLimitGuard(10, 60_000, 'qq-callback'))
  async qqCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const { redirectUrl } = await this.authService.qrCallback('qq', code, state);
    return res.redirect(redirectUrl);
  }

  @Post('qq/qr/dev-scan')
  @HttpCode(200)
  @UseGuards(new RateLimitGuard(10, 60_000, 'qq-dev-scan'))
  qqDevScan(@Body('state') state: string, @Body('openid') openid?: string) {
    return this.authService.qrDevScan('qq', state, openid);
  }
}
