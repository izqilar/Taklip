import { Injectable, ConflictException, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomInt, createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import type { ServiceRole } from '../../prisma/prisma-client';
import { Prisma } from '../../prisma/prisma-client';
import { loadStaffContext } from '../console/staff-context';
import { RegisterDto, LoginDto, ForgotPasswordDto, ResetPasswordDto, LoginIdentifierType } from './dto/auth.dto';
import type { JwtUser } from '../common/types/jwt-user';
import { JWT_REFRESH_SECRET } from './jwt-secrets';
import { homeForRole } from '../common/identity/role-home';

/** 密码重置令牌有效期（分钟），文档 §3.2 / §5.5 */
const RESET_TOKEN_TTL_MIN = 30;
/** 二维码登录 pending 态有效期（分钟），文档 §5.3 */
const QR_PENDING_TTL_MIN = 5;

function vipTierName(level: number) {
  if (level >= 3) return '黑金会员';
  if (level >= 2) return '金卡会员';
  if (level >= 1) return '银卡会员';
  return '普通用户';
}

const SALT_ROUNDS = 10;

/**
 * 大陆二代身份证号校验：18 位，前 17 位数字，末位数字或 X，按 GB 11643-1999 mod 11-2 校验位验真。
 * 与前端 `validateIdCard`（apps/web/src/user/idCard.ts / 运营端 ProfilePage）同口径，
 * 服务端必须二次校验——前端校验可绕过，身份证是实名认证的唯一凭据。
 */
export function isValidIdCard(id: string): boolean {
  if (!/^\d{17}[\dXx]$/.test(id)) return false;
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checks = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
  let sum = 0;
  for (let i = 0; i < 17; i += 1) sum += Number(id[i]) * weights[i];
  return checks[sum % 11] === id[17].toUpperCase();
}

/**
 * 角色 → 登录后落地的工作台（**单一真值，两端共用**）。
 *
 * 统一登录入口的落点判定全部以此表为准：
 * - `origin` 是逻辑端标识（web = 用户端 :5173；admin = 运营端 :5174），
 *   由各自前端映射为基址（WEB_BASE / ADMIN_BASE），服务端不硬编码域名；
 * - 与本端 origin 一致时前端内部跳转，不一致时走跨端登录态桥接
 *   （?token=&user=，由落地端的 bootstrap.ts 消费）。
 *
 * 改这张表即可改变任意角色的落点，前端无需改动。
 */
// ⚠️ ROLE_HOME / STAFF_HOME 已抽到 src/common/identity/role-home.ts（单一真值源），
// 供 RolesGuard 在 403 响应里回带「当前权威身份」复用。改落点只需改那一个文件。

@Injectable()
export class AuthService {
  /** 跨端一次性票据存储（单实例内存方案；多实例水平扩展应改为 Redis 共享，与 rate-limit.guard 同一约定） */
  private readonly tickets = new Map<string, { userId: string; exp: number }>();
  private readonly TICKET_TTL_MS = 45_000; // 30~60s 区间：45s 单次有效
  private readonly ticketSweeper = setInterval(() => this.sweepExpiredTickets(), 60_000);

  /**
   * 扫码登录 pending 态（单实例内存方案；多实例应迁 Redis，与 tickets 同一约定）。
   * 记录 state → { status, userId?, token?, exp }，供前端轮询 / 回调写入最终令牌。
   */
  private readonly qrStates = new Map<string, { status: 'pending' | 'scanned' | 'done'; userId?: string; token?: { accessToken: string; refreshToken: string; expiresIn: number; user: unknown; home: { origin: 'web' | 'admin'; path: string } }; exp: number }>();
  private readonly qrSweeper = setInterval(() => this.sweepExpiredQr(), 60_000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });
    if (existing) {
      throw new ConflictException('该手机号已注册');
    }

    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);

    // 注册即入驻（P1）：写入实名，**不写 role、不创建入驻申请、不写入任何区域维度**。
    // 区域维度（regionId / regionPath）是访问控制（REGION 作用域）与代理商归属判定的权威输入，
    // 必须由管理员在入驻审核链路中核验写入，绝不可由未鉴权的注册接口自断言（审查 M1/M2）。
    // role 变更与资质落地的唯一真源仍是「提交入驻申请 → 代理一审 → 总台终审 APPROVED」。
    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          phone: dto.phone,
          password: hashedPassword,
          nickname: dto.nickname ?? `用户${dto.phone.slice(-4)}`,
          ...(dto.realName ? { realName: dto.realName } : {}),
        },
      });
    } catch (e) {
      // 并发同号注册（check-then-create 无事务）：DB 唯一约束兜底防重，
      // 败者不应收到 500，转为 409  ConflictException 让前端友好提示。
      // nickname / email 现已加唯一约束（D2 / G-1），重名/重邮箱同样走此分支。
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const target = (e.meta as { target?: string[] })?.target?.[0] ?? '';
        if (target.includes('nickname')) throw new ConflictException('该昵称已被占用');
        if (target.includes('email')) throw new ConflictException('该邮箱已被注册');
        throw new ConflictException('该手机号已注册');
      }
      throw e;
    }

    return this.generateTokens(user.id, user.phone ?? '');
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: this.identifierWhere(dto.type, dto.account),
    });
    // 防枚举（§10 高）：账户不存在 / 纯第三方账号（无密码）统一返回同一文案，不泄露是否存在
    if (!user || !user.password) {
      throw new UnauthorizedException('ACCOUNT_OR_PASSWORD_INVALID');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('ACCOUNT_OR_PASSWORD_INVALID');
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.generateTokens(user.id, user.phone ?? '');
  }

  /**
   * 把「登录标识类型 + 账号值」翻译为 Prisma where 条件（D6 显式 type）。
   * - username 类型映射到 nickname（D2：强制唯一化的昵称承接登录语义）；
   * - realName 不纳入（D3）。
   */
  private identifierWhere(type: LoginIdentifierType, account: string): Prisma.UserWhereInput {
    switch (type) {
      case 'phone':
        return { phone: account };
      case 'email':
        return { email: account };
      case 'userId':
        return { id: account };
      case 'username':
        return { nickname: account };
    }
  }

  /**
   * 忘记密码的账户定位：宽松匹配任一唯一标识（phone / email / nickname / id）。
   * 与登录解析不同，这里不要求前端显式传 type（用户输入的是「任一标识」）。
   */
  private async resolveByIdentifier(identifier: string) {
    return this.prisma.user.findFirst({
      where: {
        OR: [
          { phone: identifier },
          { email: identifier },
          { nickname: identifier },
          { id: identifier },
        ],
      },
    });
  }

  /**
   * 忘记密码（G-4）：定位账户 → 生成哈希重置令牌（sha256，明文不落库）→ 渠道送达。
   * 防枚举（§10 高）：无论账户是否存在都返回同一成功文案「若账户存在，重置凭证已发送」。
   *
   * D1 决策：当前服务端无邮件 / SMS 发送能力，先**模拟送达**——把重置验证码随响应一并返回
   * （devChannel + devCode），由前端以弹窗形式展示，便于开发 / 测试。生产环境接入真实 SMTP/SMS
   * 后，应仅在渠道实际发送、不再回带 devCode。
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.resolveByIdentifier(dto.identifier);
    if (user) {
      const code = this.issueResetCode();
      const hash = createHash('sha256').update(code).digest('hex');
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          resetTokenHash: hash,
          resetTokenExpiry: new Date(Date.now() + RESET_TOKEN_TTL_MIN * 60_000),
          resetTokenUsed: false,
        },
      });
      const delivery = this.notifyReset(user, code);
      // 模拟送达：回带验证码与渠道，前端弹窗展示（D1）。生产接入真实渠道后移除此回带。
      return {
        message: '若账户存在，重置凭证已发送',
        ...(delivery.dev ? { devChannel: delivery.channel, devCode: code } : {}),
      };
    }
    // 防枚举：不泄露账户是否存在
    return { message: '若账户存在，重置凭证已发送' };
  }

  /** 生成 6 位重置验证码（同时作为邮件链接令牌与 SMS 验证码，reset-password 接受其一） */
  private issueResetCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  /**
   * 重置凭证送达（D1 模拟）：按账户可用联系方式选择渠道（有 email 优先邮件，否则短信）。
   * 返回 dev=true 表示当前为「模拟送达」，前端应弹窗展示 devCode。
   */
  private notifyReset(
    user: { email?: string | null; phone?: string | null },
    code: string,
  ): { channel: 'email' | 'sms' | 'none'; dev: boolean } {
    let channel: 'email' | 'sms' | 'none' = 'none';
    if (user.email) channel = 'email';
    else if (user.phone) channel = 'sms';
    // D1：当前无真实发送通道，统一模拟（dev=true）。接入真实 SMTP/SMS 后改为实际发送并 dev=false。
    if (process.env.RESET_DELIVERY_MODE === 'real') {
      // TODO(D1)：真实发送（邮件含 ?token=code 链接 / 短信下发 code）。当前未实现，降级为模拟。
      return { channel, dev: true };
    }
    return { channel, dev: true };
  }

  /**
   * 重置密码（G-4）：校验哈希令牌 + 未过期 + 未使用 → 写新密码（bcrypt）→ 作废令牌。
   * D4：纯第三方账号（password=null）首次重置即「绑定密码」，属预期行为（引导设置密码）。
   */
  async resetPassword(dto: ResetPasswordDto) {
    const hash = createHash('sha256').update(dto.token).digest('hex');
    const user = await this.prisma.user.findFirst({ where: { resetTokenHash: hash } });
    if (
      !user ||
      user.resetTokenUsed ||
      !user.resetTokenExpiry ||
      user.resetTokenExpiry < new Date()
    ) {
      throw new BadRequestException('RESET_TOKEN_INVALID');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: await bcrypt.hash(dto.newPassword, SALT_ROUNDS),
        resetTokenUsed: true,
        resetTokenHash: null,
        resetTokenExpiry: null,
      },
    });
    return { message: '密码已重置' };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: JWT_REFRESH_SECRET,
      });
      await this.prisma.user.update({ where: { id: payload.sub }, data: { lastLoginAt: new Date() } });
      return this.generateTokens(payload.sub, payload.phone);
    } catch {
      throw new UnauthorizedException('刷新令牌无效或已过期');
    }
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        nickname: true,
        avatar: true,
        realName: true,
        bio: true,
        email: true,
        vipLevel: true,
        locale: true,
        role: true,
        serviceRoles: true,
        pendingServiceRoles: true,
        providerStatus: true,
        // 顶栏账号胶囊的「已实名 / 资质有效」标签需要，登录响应必须带回
        realNameStatus: true,
        // —— 角色管理管线（P0）：登录/注册/刷新响应必须带回区域维度，
        //     否则 web 端（如 AgentStudio）拿到 user.regionPath=undefined，
        //     无法在首屏渲染代理商辖区。JWT 守卫路径(jwt.strategy)已含这些字段。 ——
        regionId: true,
        agentId: true,
        regionPath: true,
        status: true,
        // 账户详情页审计/资产字段
        lastLoginAt: true,
        points: true,
        totalSpent: true,
        userBalance: true,
        followingProviderCount: true,
      },
    });
  }

  /**
   * 用户申请入驻服务商 —— **入驻管线唯一真源**（QualificationApplication 两段审）。
   *
   * ⚠️ 历史行为（已废弃，安全缺口 P-A）：本方法曾直接把 `role` 改成 SERVICE_PROVIDER、
   * `providerStatus` 置 PENDING，任何人自助即可成为服务商，完全绕过代理商一审与总台终审。
   *
   * 现行语义：**仅创建入驻申请**（status=FIRST_PENDING），不动 role / providerStatus。
   * 身份变更与资质落地只在 ADMIN 终审 APPROVED 时，由 user-console 的
   * `applyQualificationResult` 统一执行（含 regionPath / agentId 归属与钱包初始化）。
   *
   * 已是已审服务商：转为「扩展业务」管线（写入 pendingServiceRoles 待 ADMIN 批准），不自助生效。
   */
  async applyForProvider(userId: string, serviceRoles: ServiceRole[]) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    if (user.role === 'ADMIN') {
      throw new BadRequestException('管理员无需申请入驻服务商');
    }

    // 至少选择一种服务类型；缺省兜底为 DESIGN
    const validRoles: ServiceRole[] =
      serviceRoles && serviceRoles.length > 0 ? serviceRoles : ['DESIGN'];

    // 已是服务商：不再自助升级，走受审的扩展业务管线
    if (user.role === 'SERVICE_PROVIDER') {
      if (user.providerStatus === 'APPROVED') {
        return this.expandServiceRoles(userId, validRoles);
      }
      throw new BadRequestException('您的服务商资质正在审核中，请等待总台审核结果');
    }

    // 防重复建单：在途申请（一审待审 / 一审通过 / 终审待审）直接复用
    const dup = await this.prisma.qualificationApplication.findFirst({
      where: {
        userId,
        kind: 'provider',
        status: { in: ['FIRST_PENDING', 'FIRST_PASSED', 'FINAL_PENDING'] },
      },
    });
    if (dup) return { ...dup, duplicated: true };

    return this.prisma.qualificationApplication.create({
      data: {
        userId,
        kind: 'provider',
        status: 'FIRST_PENDING',
        reason: '用户自助提交入驻服务商申请',
        serviceScopes: validRoles,
        // 归属基线（M2 修复）：不再沿用注册/用户自填的 regionPath（未经管理员核验、可被自断言）。
        // 申请的 regionPath 必须由用户在「提交入驻申请」表单中显式填写并经一审/终审核验；
        // 此处置空，确保代理商归属判定只基于受核验的申请区域，杜绝非核验值影响归属。
        regionPath: null,
      },
    });
  }

  // ⚠️ `submitProviderReview`（自助把 providerStatus 置 APPROVED）已移除 —— 安全缺口 P-A。
  // 资质审核不再允许自助通过：统一由 QualificationApplication 两段审管线承载
  // （代理商一审 → 总台终审 APPROVED 时由 user-console.applyQualificationResult 落地）。
  // 保留此说明以标注端点去向，勿再恢复任何自助审批路径。

  /**
   * 已入驻服务商申请扩展业务：把新的服务子角色写入 pendingServiceRoles 等待审核，
   * 不会立即影响已生效的 serviceRoles。
   */
  async expandServiceRoles(userId: string, serviceRoles: ServiceRole[]) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('用户不存在');
    if (user.role !== 'SERVICE_PROVIDER') {
      throw new BadRequestException('仅服务商可申请扩展业务');
    }
    if (user.providerStatus !== 'APPROVED') {
      throw new BadRequestException('仅资质审核已通过的服务商可增加业务');
    }

    const validRoles = serviceRoles && serviceRoles.length > 0 ? serviceRoles : [];
    const existing = new Set([...user.serviceRoles, ...(user.pendingServiceRoles ?? [])]);
    const toAdd = validRoles.filter((r) => !existing.has(r));
    if (toAdd.length === 0) {
      throw new BadRequestException('所选业务已全部在生效或审核中');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { pendingServiceRoles: { set: [...(user.pendingServiceRoles ?? []), ...toAdd] } },
      select: this.selectUser,
    });
  }

  /**
   * 管理员批准服务商的 pendingServiceRoles：合并进 serviceRoles 并清空 pending。
   */
  async approveServiceRoles(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('用户不存在');
    if (user.role !== 'SERVICE_PROVIDER') {
      throw new BadRequestException('仅服务商可审批业务资质');
    }

    const mergedRoles = Array.from(new Set([...user.serviceRoles, ...(user.pendingServiceRoles ?? [])]));
    return this.prisma.user.update({
      where: { id: userId },
      data: { serviceRoles: mergedRoles, pendingServiceRoles: [] },
      select: this.selectUser,
    });
  }

  /**
   * 角色管理管线（P1）：当前操作者的权限摘要，供 Refine accessControlProvider 使用。
   * scope 表示数据作用域：ALL(管理员全量) / REGION(代理商辖区) / SELF(仅自己)。
   */
  getAccess(user: JwtUser) {
    const scope = user.role === 'ADMIN' ? 'ALL' : user.role === 'AGENT' ? 'REGION' : 'SELF';
    const baseline: string[] =
      user.role === 'ADMIN'
        ? ['user:read', 'user:update', 'user:role', 'user:delete', 'provider:review', 'agent:manage', 'region:read', 'wallet:read', 'wallet:manage', 'order:read', 'feedback:read', 'feedback:review', 'message:read', 'message:audit', 'message:manage', 'contract:manage']
        : user.role === 'AGENT'
          ? ['user:read', 'provider:review', 'region:read', 'feedback:read', 'feedback:agent', 'message:read', 'message:agent', 'message:manage']
          : user.role === 'SERVICE_PROVIDER'
            ? ['feedback:read', 'feedback:own', 'message:read', 'message:own']
            : [];
    // P1（guard 消费权限）：员工（USER 身份 + 有效成员关系）的岗位权限合并进可用权限集。
    // legacy 角色持有者也保留其基线；员工叠加其所在组织授予的 funcPerms。
    const staffPerms = (user.staff ?? []).flatMap((s) => s.funcPerms ?? []);
    const permissions = Array.from(new Set([...baseline, ...staffPerms]));
    return {
      id: user.id,
      role: user.role,
      regionId: user.regionId ?? null,
      regionPath: user.regionPath ?? null,
      scope,
      permissions,
      // P1：组织成员关系清单（供前端 accessControlProvider 判断「是否在某组织内」及写操作门控）
      staff: (user.staff ?? []).map((s) => ({
        sid: s.sid,
        orgType: s.orgType,
        orgId: s.orgId,
        staffRole: s.staffRole,
        dataScope: s.dataScope,
        // 必带 funcPerms：前端据此判定员工能否执行 team:manage 等写操作（与后端 OrgAccessGuard 同源）
        funcPerms: s.funcPerms ?? [],
      })),
    };
  }

  private selectUser = {
    id: true,
    phone: true,
    nickname: true,
    avatar: true,
    realName: true,
    bio: true,
    email: true,
    wxOpenid: true,
    idCard: true,
    // 证件影像（账户详情「身份认证资料」区块：人像面 / 国徽面）
    idCardFront: true,
    idCardBack: true,
    realNameStatus: true,
    realNameVerifiedAt: true,
    vipLevel: true,
    locale: true,
    role: true,
    serviceRoles: true,
    pendingServiceRoles: true,
    providerStatus: true,
    // —— 角色管理管线（P0）——
    regionId: true,
    agentId: true,
    regionPath: true,
    status: true,
    // 账户详情页审计/资产字段（createdAt 缺失会让「注册/入驻时间」显示 —）
    createdAt: true,
    lastLoginAt: true,
    points: true,
    totalSpent: true,
    userBalance: true,
    followingProviderCount: true,
    // —— 关联业务快照（只读展示）——
    providerWallet: { select: { balance: true, frozen: true, totalIncome: true, withdrawn: true } },
    region: { select: { id: true, code: true, name: true, regionPath: true } },
    agent: { select: { id: true, nickname: true, phone: true } },
    _count: { select: { projects: true, templates: true, orders: true, withdrawals: true } },
  } as const;

  /** 拉取当前操作者完整自身资料（供运营端「账户详情」详情页） */
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: this.selectUser });
    if (!user) throw new UnauthorizedException('用户不存在');
    const roleExtra = await this.buildRoleExtra(user);
    return { ...user, ...roleExtra };
  }

  /**
   * 按角色聚合「账户详情」第四区块所需的只读业务指标。
   * 既用于登录者自身（getMe），也用于管理员 / 代理商查看被监督对象（admin/users/:id）。
   * 入参只需 id / role / regionPath / vipLevel 四个字段。
   */
  async buildRoleExtra(user: {
    id: string;
    role: string;
    regionPath?: string | null;
    vipLevel?: number | null;
  }): Promise<Record<string, unknown>> {
    const userId = user.id;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const regionPrefix = user.regionPath ?? '';

    // ── 各角色专属只读业务区块 ──
    let roleExtra: Record<string, unknown> = {};

    if (user.role === 'ADMIN') {
      const access = this.getAccess(user as any);
      const permLabelMap: Record<string, string> = {
        'user:read': '用户查询', 'user:update': '用户编辑', 'user:role': '角色管理',
        'provider:review': '入驻审核', 'agent:manage': '区域管理', 'region:read': '区域查询',
        'wallet:read': '流水查询', 'wallet:manage': '钱包管理', 'order:read': '订单查询',
        'feedback:read': '反馈处理', 'feedback:review': '申诉仲裁',
        'message:read': '站内信收发', 'message:audit': '公告审核', 'message:manage': '公告发布',
      };
      const permissionTags = access.permissions.map((p) => permLabelMap[p] ?? p);
      roleExtra = {
        adminRole: '超级管理员',
        permissionLevel: 100,
        permissionTags,
      };
    } else if (user.role === 'AGENT' && regionPrefix) {
      const [monthlyTurnoverAgg, userCount, providerCount, monthlyOrdersAgg, pendingReviews] = await Promise.all([
        this.prisma.templateOrder.aggregate({
          where: { createdAt: { gte: startOfMonth }, buyer: { regionPath: { startsWith: regionPrefix } } },
          _sum: { amount: true },
        }),
        this.prisma.user.count({ where: { regionPath: { startsWith: regionPrefix }, role: 'USER' } }),
        this.prisma.user.count({ where: { regionPath: { startsWith: regionPrefix }, role: 'SERVICE_PROVIDER' } }),
        this.prisma.templateOrder.count({ where: { createdAt: { gte: startOfMonth }, buyer: { regionPath: { startsWith: regionPrefix } } } }),
        this.prisma.user.count({ where: { regionPath: { startsWith: regionPrefix }, role: 'SERVICE_PROVIDER', providerStatus: 'PENDING' } }),
      ]);
      const monthlyTurnover = monthlyTurnoverAgg._sum.amount ?? 0;
      roleExtra = {
        monthlyTurnover,
        commission: Math.round(monthlyTurnover * 0.1),
        userCount,
        providerCount,
        monthlyOrders: monthlyOrdersAgg,
        pendingProviderReviews: pendingReviews,
      };
    } else if (user.role === 'SERVICE_PROVIDER') {
      const [onSaleServices, monthlyIncomeAgg] = await Promise.all([
        this.prisma.template.count({ where: { authorId: userId, status: 'APPROVED' } }),
        this.prisma.templateOrder.aggregate({
          where: { createdAt: { gte: startOfMonth }, template: { authorId: userId } },
          _sum: { amount: true },
        }),
      ]);
      roleExtra = {
        onSaleServices,
        monthlyIncome: monthlyIncomeAgg._sum.amount ?? 0,
      };
    } else if (user.role === 'USER') {
      const activeOrders = await this.prisma.templateOrder.count({
        where: { buyerId: userId, status: 'paid', createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
      });
      roleExtra = {
        vipTier: vipTierName(user.vipLevel ?? 0),
        activeOrders,
      };
    }

    return roleExtra;
  }

  /** 更新账户资料（昵称 / 头像 / 手机 / 真实姓名 / 个人简介 / 邮箱 / 语言 / 证件号 / 证件影像） */
  async updateProfile(
    userId: string,
    dto: {
      nickname?: string;
      avatar?: string;
      phone?: string;
      realName?: string;
      bio?: string;
      email?: string;
      locale?: string;
      idCard?: string;
      idCardFront?: string;
      idCardBack?: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('用户不存在');

    // 手机号：唯一索引保护，先自查给出可读错误（否则 P2002 直接 500）
    if (dto.phone !== undefined && dto.phone !== user.phone) {
      const dup = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
      if (dup && dup.id !== userId) throw new ConflictException('手机号已被占用');
    }
    // 邮箱 / 昵称：已加唯一约束（G-1 / D2），先自查避免 P2002 直接 500
    if (dto.email !== undefined && dto.email !== user.email) {
      const dup = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (dup && dup.id !== userId) throw new ConflictException('该邮箱已被注册');
    }
    if (dto.nickname !== undefined && dto.nickname !== user.nickname) {
      const dup = await this.prisma.user.findUnique({ where: { nickname: dto.nickname } });
      if (dup && dup.id !== userId) throw new ConflictException('该昵称已被占用');
    }
    // 身份证号：验真（格式 + 校验位），非法直接拒绝，避免脏数据进入实名认证管线
    if (dto.idCard !== undefined && dto.idCard !== '' && dto.idCard !== user.idCard) {
      if (!isValidIdCard(dto.idCard)) throw new BadRequestException('身份证号校验失败，请核对后重填');
    }

    // 实名认证：提交证件号即进入待审（PENDING），认证时间清空，等待管理员裁定
    const identityPending = dto.idCard !== undefined && dto.idCard !== user.idCard;
    const data: Record<string, unknown> = {
      ...(dto.nickname !== undefined ? { nickname: dto.nickname } : {}),
      ...(dto.avatar !== undefined ? { avatar: dto.avatar } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      ...(dto.realName !== undefined ? { realName: dto.realName } : {}),
      ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
      ...(dto.email !== undefined ? { email: dto.email } : {}),
      ...(dto.locale !== undefined ? { locale: dto.locale } : {}),
      ...(dto.idCard !== undefined ? { idCard: dto.idCard } : {}),
      ...(dto.idCardFront !== undefined ? { idCardFront: dto.idCardFront } : {}),
      ...(dto.idCardBack !== undefined ? { idCardBack: dto.idCardBack } : {}),
    };
    if (identityPending) {
      data.realNameStatus = 'PENDING';
      data.realNameVerifiedAt = null;
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: this.selectUser,
    });
    return updated;
  }

  /** 修改密码：校验旧密码后写入新密码 */
  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.password) throw new UnauthorizedException('用户不存在');

    const ok = await bcrypt.compare(oldPassword, user.password);
    if (!ok) throw new BadRequestException('原密码不正确');

    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
      select: this.selectUser,
    });
    return updated;
  }

  private async generateTokens(userId: string, phone: string) {
    // ⚠️ R-05 / R-06（P1）：账户被停用（User.status === DISABLED）禁止签发任何令牌。
    // 这是「登录 / 刷新 / 跨端兑换」的统一闸门；即便 JWT 校验路径(jwt.strategy)已拦截，
    // 也必须从登录源头拒绝，否则停用员工仍能凭密码换取令牌（红线形同虚设）。
    // 注册产生的新用户 status 默认 ACTIVE，不受此影响。
    const acct = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
    if (acct?.status === 'DISABLED') {
      throw new UnauthorizedException('账户已被停用');
    }
    // P1：组织内员工上下文快照（随 JWT 携带，供下游服务 / 前端读取；
    // 但真正的鉴权仍以 jwt.strategy 每次请求重算的 req.user.staff 为准）。
    const staff = await loadStaffContext(this.prisma, userId);
    const payload = { sub: userId, phone, staff };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '2h',
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });

    const user = await this.validateUser(userId);
    // P1（员工登录落点）：USER + 有效成员关系 → 进入对应层运营端；否则按角色落点
    const home = homeForRole(user?.role, staff);
    return {
      accessToken,
      refreshToken,
      expiresIn: 7200,
      user: { ...user, staff },
      // 登录后应落地的工作台（统一登录入口按此分流；未知角色兜底为终端用户）
      home,
    };
  }

  /**
   * 签发一次性跨端票据：用于把登录态从一端「安全」带到另一端，
   * 避免把 JWT 明文放进 URL query（会进历史 / Referer / 网关日志）。
   *
   * 调用方必须已登录（Bearer 有效 accessToken），由 AuthGuard('jwt') 保证。
   * 票据绑定 userId，45s 内有效、兑换一次即作废。
   */
  issueTicket(userId: string): { ticket: string } {
    const ticket = randomBytes(24).toString('hex');
    this.tickets.set(ticket, { userId, exp: Date.now() + this.TICKET_TTL_MS });
    return { ticket };
  }

  /**
   * 用一次性票据兑换完整登录令牌（与登录响应同构：accessToken/refreshToken/user/home）。
   * 公开接口（无需鉴权），但票据本身 45s 单次有效，泄露窗口极小。
   */
  async exchangeTicket(ticket: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user: unknown;
    home: { origin: 'web' | 'admin'; path: string };
  }> {
    const rec = this.tickets.get(ticket);
    if (!rec) {
      throw new UnauthorizedException('票据无效或已被使用');
    }
    // 无论是否有效，取出即作废（一次性）
    this.tickets.delete(ticket);
    if (Date.now() > rec.exp) {
      throw new UnauthorizedException('票据已过期，请重新登录');
    }
    const user = await this.validateUser(rec.userId);
    return this.generateTokens(rec.userId, user?.phone ?? '');
  }

  /** 定时清理过期票据，避免 Map 无限增长（防御性，兑换时也已做过期判断） */
  private sweepExpiredTickets(): void {
    const now = Date.now();
    for (const [k, v] of this.tickets) {
      if (now > v.exp) this.tickets.delete(k);
    }
  }

  /** 定时清理过期的扫码 pending 态 */
  private sweepExpiredQr(): void {
    const now = Date.now();
    for (const [k, v] of this.qrStates) {
      if (now > v.exp) this.qrStates.delete(k);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 微信 / QQ 扫码登录（G-2 / G-3）
  // 流程：qr/start 生成 state + qrcodeUrl → 前端轮询 qr/status →
  //        用户扫码确认 → 平台回调 callback?code&state → 换 openid →
  //        静默注册/登录 → 写 done + token；前端轮询拿到 token 落地。
  // ⚠️ state 必须校验回放（§10 严重，防 CSRF 账号绑定劫持），且一次性。
  // 配置（严禁硬编码）：WX_APPID/WX_APPSECRET/WX_REDIRECT_URI、QQ_APPID/QQ_APPKEY/QQ_REDIRECT_URI。
  // ─────────────────────────────────────────────────────────────

  private getOAuthConfig(provider: 'wechat' | 'qq') {
    if (provider === 'wechat') {
      return {
        appid: process.env.WX_APPID,
        secret: process.env.WX_APPSECRET,
        redirectUri: process.env.WX_REDIRECT_URI,
      };
    }
    return {
      appid: process.env.QQ_APPID,
      secret: process.env.QQ_APPKEY,
      redirectUri: process.env.QQ_REDIRECT_URI,
    };
  }

  /** 构造平台扫码 URL（state 防 CSRF） */
  private buildQrUrl(provider: 'wechat' | 'qq', cfg: { appid?: string; redirectUri?: string }, state: string): string {
    const ru = encodeURIComponent(cfg.redirectUri ?? '');
    if (provider === 'wechat') {
      return `https://open.weixin.qq.com/connect/qrconnect?appid=${cfg.appid}&redirect_uri=${ru}&response_type=code&scope=snsapi_login&state=${state}`;
    }
    return `https://graph.qq.com/oauth2.0/authorize?response_type=code&client_id=${cfg.appid}&redirect_uri=${ru}&state=${state}&scope=get_user_info`;
  }

  /** 发起扫码：生成 state 并落 pending 态（TTL 5min），返回二维码 URL 与是否已完成配置 */
  async qrStart(provider: 'wechat' | 'qq') {
    const cfg = this.getOAuthConfig(provider);
    const state = randomBytes(16).toString('hex');
    this.qrStates.set(state, { status: 'pending', exp: Date.now() + QR_PENDING_TTL_MIN * 60_000 });
    const configured = !!cfg.appid && !!cfg.redirectUri;
    return {
      state,
      qrcodeUrl: configured ? this.buildQrUrl(provider, cfg, state) : '',
      configured,
    };
  }

  /** 轮询扫码状态；done 时一次性返回令牌（取出即作废） */
  async qrStatus(state: string): Promise<{ status: 'pending' | 'scanned' | 'done' | 'expired'; token?: { accessToken: string; refreshToken: string; expiresIn: number; user: unknown; home: { origin: 'web' | 'admin'; path: string } } }> {
    const rec = this.qrStates.get(state);
    if (!rec || Date.now() > rec.exp) {
      this.qrStates.delete(state);
      return { status: 'expired' };
    }
    if (rec.status === 'done' && rec.token) {
      this.qrStates.delete(state);
      return { status: 'done', token: rec.token };
    }
    return { status: rec.status };
  }

  /** 平台回调：校验 state → 换 openid → 静默注册/登录 → 写 done + token */
  async qrCallback(provider: 'wechat' | 'qq', code: string, state: string) {
    const rec = this.qrStates.get(state);
    if (!rec || rec.status === 'done' || Date.now() > rec.exp) {
      throw new BadRequestException('QR_STATE_INVALID');
    }
    const cfg = this.getOAuthConfig(provider);
    const openid = await this.exchangeCodeForOpenid(provider, cfg, code);
    const field: 'wxOpenid' | 'qqOpenid' = provider === 'wechat' ? 'wxOpenid' : 'qqOpenid';
    const user = await this.findOrCreateByOpenid(field, openid);
    const token = await this.generateTokens(user.id, user.phone ?? '');
    rec.status = 'done';
    rec.token = token;
    rec.userId = user.id;
    this.qrStates.set(state, rec);
    // 回调由平台重定向到 redirect_uri；处理完成后引导回前端（前端轮询 qr/status 已可拿到 token，
    // 此处重定向仅用于关闭扫码窗口 / 给出可视反馈）。
    const frontend = (cfg.redirectUri ?? '').split('?')[0] || '';
    return { redirectUrl: `${frontend}?login=success&state=${state}` };
  }

  /** code 换 openid（平台差异封装） */
  private async exchangeCodeForOpenid(provider: 'wechat' | 'qq', cfg: { appid?: string; secret?: string; redirectUri?: string }, code: string): Promise<string> {
    if (provider === 'wechat') {
      const url = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${cfg.appid}&secret=${cfg.secret}&code=${code}&grant_type=authorization_code`;
      const res = await fetch(url);
      const json = (await res.json()) as { openid?: string; errcode?: number; errmsg?: string };
      if (!json.openid) throw new BadRequestException(`WECHAT_OAUTH_FAILED:${json.errmsg ?? json.errcode}`);
      return json.openid;
    }
    // QQ：先换 access_token（返回 key=value 串），再换 openid（返回 callback({...})）
    const tokenUrl = `https://graph.qq.com/oauth2.0/token?grant_type=authorization_code&client_id=${cfg.appid}&client_secret=${cfg.secret}&code=${code}&redirect_uri=${encodeURIComponent(cfg.redirectUri ?? '')}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenText = await tokenRes.text();
    const accessToken = new URLSearchParams(tokenText).get('access_token');
    if (!accessToken) throw new BadRequestException('QQ_OAUTH_TOKEN_FAILED');
    const meRes = await fetch(`https://graph.qq.com/oauth2.0/me?access_token=${accessToken}`);
    const meText = await meRes.text();
    const m = meText.match(/\{[^{}]*\}/);
    if (!m) throw new BadRequestException('QQ_OAUTH_OPENID_FAILED');
    const me = JSON.parse(m[0]) as { openid?: string };
    if (!me.openid) throw new BadRequestException('QQ_OAUTH_OPENID_FAILED');
    return me.openid;
  }

  /** 按 openid 查找或静默注册（纯第三方账号：password=null, role=USER） */
  private async findOrCreateByOpenid(field: 'wxOpenid' | 'qqOpenid', openid: string) {
    const where: Prisma.UserWhereUniqueInput =
      field === 'wxOpenid' ? { wxOpenid: openid } : { qqOpenid: openid };
    let user = await this.prisma.user.findUnique({ where });
    if (user) return user;
    const nickname = `${field === 'wxOpenid' ? '微信用户' : 'QQ用户'}${randomBytes(3).toString('hex')}`;
    const data: Prisma.UserCreateInput =
      field === 'wxOpenid'
        ? { wxOpenid: openid, password: null, nickname, role: 'USER' }
        : { qqOpenid: openid, password: null, nickname, role: 'USER' };
    try {
      user = await this.prisma.user.create({ data });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        user = await this.prisma.user.findUnique({ where });
        if (user) return user;
      }
      throw e;
    }
    return user;
  }

  /**
   * 开发态模拟扫码（仅非生产可用）：在没有真实微信/QQ 开放平台资质时，
   * 让扫码登录全流程可被端到端演练。生产环境拒绝（Forbidden）。
   */
  async qrDevScan(provider: 'wechat' | 'qq', state: string, openid?: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('DEV_ONLY');
    }
    const rec = this.qrStates.get(state);
    if (!rec) throw new BadRequestException('QR_STATE_INVALID');
    rec.status = 'scanned';
    this.qrStates.set(state, rec);
    const oid = openid || `dev_${provider}_${randomBytes(6).toString('hex')}`;
    const field: 'wxOpenid' | 'qqOpenid' = provider === 'wechat' ? 'wxOpenid' : 'qqOpenid';
    const user = await this.findOrCreateByOpenid(field, oid);
    const token = await this.generateTokens(user.id, user.phone ?? '');
    rec.status = 'done';
    rec.token = token;
    rec.userId = user.id;
    this.qrStates.set(state, rec);
    return { ok: true as const };
  }
}

