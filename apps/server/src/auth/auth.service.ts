import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import type { ServiceRole } from '../../prisma/prisma-client';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import type { JwtUser } from '../common/types/jwt-user';

function vipTierName(level: number) {
  if (level >= 3) return '黑金会员';
  if (level >= 2) return '金卡会员';
  if (level >= 1) return '银卡会员';
  return '普通用户';
}

const SALT_ROUNDS = 10;

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
const ROLE_HOME: Record<string, { origin: 'web' | 'admin'; path: string }> = {
  USER: { origin: 'web', path: '/user/works' },
  SERVICE_PROVIDER: { origin: 'admin', path: '/sp/studio' },
  AGENT: { origin: 'admin', path: '/agent/dashboard' },
  ADMIN: { origin: 'admin', path: '/admin/dashboard' },
};

@Injectable()
export class AuthService {
  /** 跨端一次性票据存储（单实例内存方案；多实例水平扩展应改为 Redis 共享，与 rate-limit.guard 同一约定） */
  private readonly tickets = new Map<string, { userId: string; exp: number }>();
  private readonly TICKET_TTL_MS = 45_000; // 30~60s 区间：45s 单次有效
  private readonly ticketSweeper = setInterval(() => this.sweepExpiredTickets(), 60_000);

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
    const user = await this.prisma.user.create({
      data: {
        phone: dto.phone,
        password: hashedPassword,
        nickname: dto.nickname ?? `用户${dto.phone.slice(-4)}`,
      },
    });

    return this.generateTokens(user.id, user.phone ?? '');
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });
    if (!user || !user.password) {
      throw new UnauthorizedException('手机号或密码错误');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('手机号或密码错误');
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.generateTokens(user.id, user.phone ?? '');
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET ?? 'h5design_refresh_secret_dev',
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
   * USER → SERVICE_PROVIDER 申请入驻（混合审核模型）。
   * 入驻与升级是同一管线：普通用户申请入驻即成为服务商，可多选服务子角色。
   * 幂等：已是 SERVICE_PROVIDER/ADMIN 直接返回当前用户，不降级。
   * 首次申请：role=SERVICE_PROVIDER、写入 serviceRoles、providerStatus=PENDING（需先过资质审核才能上架付费供给）。
   * 已是 SERVICE_PROVIDER：保留原有 providerStatus，仅更新 serviceRoles（复合角色可扩充）。
   * 申请时同时确保该服务商有一个 ProviderWallet。
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
    const isFirstApply = user.role !== 'SERVICE_PROVIDER';
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        role: 'SERVICE_PROVIDER',
        serviceRoles: validRoles,
        // 仅首次申请时初始化为待审核；已是服务商则不回退审核状态
        ...(isFirstApply ? { providerStatus: 'PENDING' } : {}),
      },
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
      },
    });

    await this.prisma.providerWallet.upsert({
      where: { providerId: userId },
      create: { providerId: userId },
      update: {},
    });

    return updated;
  }

  /**
   * 服务商提交资质审核：PENDING → APPROVED。
   * 入驻后即可进入工作台发免费供给；但上架付费供给前必须 APPROVED。
   * 当前为自助审核（轻量混合模型）——真实平台可改为管理员后台审核队列，
   * 此处作为明确的扩展点，复用返回的 providerStatus 驱动前端状态展示。
   *
   * 对于已 APPROVED 的服务商，提交审核会同时把 pendingServiceRoles 合并进 serviceRoles，
   * 实现「增加业务」后的资质审核闭环。
   */
  async submitProviderReview(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('用户不存在');
    if (user.role !== 'SERVICE_PROVIDER') {
      throw new BadRequestException('仅服务商可提交资质审核');
    }

    const alreadyApproved = user.providerStatus === 'APPROVED';
    const mergedRoles = alreadyApproved
      ? Array.from(new Set([...user.serviceRoles, ...(user.pendingServiceRoles ?? [])]))
      : undefined;

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        providerStatus: 'APPROVED',
        ...(mergedRoles ? { serviceRoles: mergedRoles, pendingServiceRoles: [] } : {}),
      },
      select: this.selectUser,
    });
  }

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
    const permissions: string[] =
      user.role === 'ADMIN'
        ? ['user:read', 'user:update', 'user:role', 'provider:review', 'agent:manage', 'region:read', 'wallet:read', 'wallet:manage', 'order:read', 'feedback:read', 'feedback:review', 'message:read', 'message:audit', 'message:manage']
        : user.role === 'AGENT'
          ? ['user:read', 'provider:review', 'region:read', 'feedback:read', 'feedback:agent', 'message:read', 'message:agent', 'message:manage']
          : user.role === 'SERVICE_PROVIDER'
            ? ['feedback:read', 'feedback:own', 'message:read', 'message:own']
            : [];
    return {
      id: user.id,
      role: user.role,
      regionId: user.regionId ?? null,
      regionPath: user.regionPath ?? null,
      scope,
      permissions,
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

  /** 更新账户资料（昵称 / 头像 / 真实姓名 / 个人简介 / 邮箱 / 语言 / 证件号） */
  async updateProfile(
    userId: string,
    dto: {
      nickname?: string;
      avatar?: string;
      realName?: string;
      bio?: string;
      email?: string;
      locale?: string;
      idCard?: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('用户不存在');

    // 实名认证：提交证件号即进入待审（PENDING），认证时间清空，等待管理员裁定
    const identityPending = dto.idCard !== undefined && dto.idCard !== user.idCard;
    const data: Record<string, unknown> = {
      ...(dto.nickname !== undefined ? { nickname: dto.nickname } : {}),
      ...(dto.avatar !== undefined ? { avatar: dto.avatar } : {}),
      ...(dto.realName !== undefined ? { realName: dto.realName } : {}),
      ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
      ...(dto.email !== undefined ? { email: dto.email } : {}),
      ...(dto.locale !== undefined ? { locale: dto.locale } : {}),
      ...(dto.idCard !== undefined ? { idCard: dto.idCard } : {}),
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
    const payload = { sub: userId, phone };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '2h',
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET ?? 'h5design_refresh_secret_dev',
      expiresIn: '7d',
    });

    const user = await this.validateUser(userId);
    return {
      accessToken,
      refreshToken,
      expiresIn: 7200,
      user,
      // 登录后应落地的工作台（统一登录入口按此分流；未知角色兜底为终端用户）
      home: ROLE_HOME[user?.role ?? 'USER'] ?? ROLE_HOME.USER,
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
}
