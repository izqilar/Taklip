import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import type { ServiceRole } from '../../prisma/prisma-client';
import { Prisma } from '../../prisma/prisma-client';
import { loadStaffContext } from '../console/staff-context';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import type { JwtUser } from '../common/types/jwt-user';
import { JWT_REFRESH_SECRET } from './jwt-secrets';

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

/**
 * P1（员工登录落点）：USER 身份 + 有效组织成员关系时，按主要成员关系所在层进入运营端工作台。
 * 员工沿用 USER 平台身份，不新增角色，故落点需由「组织成员关系」推导（文档 §3.2 / §10.1）。
 */
const STAFF_HOME: Record<'PROVIDER' | 'AGENT' | 'CONSOLE', { origin: 'web' | 'admin'; path: string }> = {
  PROVIDER: { origin: 'admin', path: '/sp/studio' },
  AGENT: { origin: 'admin', path: '/agent/dashboard' },
  CONSOLE: { origin: 'admin', path: '/admin/dashboard' },
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
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('该手机号已注册');
      }
      throw e;
    }

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
        ? ['user:read', 'user:update', 'user:role', 'provider:review', 'agent:manage', 'region:read', 'wallet:read', 'wallet:manage', 'order:read', 'feedback:read', 'feedback:review', 'message:read', 'message:audit', 'message:manage']
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
    const home =
      user?.role === 'USER' && staff.length
        ? STAFF_HOME[(staff[0].orgType as 'PROVIDER' | 'AGENT' | 'CONSOLE')] ?? ROLE_HOME.USER
        : ROLE_HOME[user?.role ?? 'USER'] ?? ROLE_HOME.USER;
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
}
