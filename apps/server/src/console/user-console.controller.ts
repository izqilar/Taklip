import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  Req,
  UseGuards,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtUser } from '../common/types/jwt-user';

type ReqUser = Express.Request & { user: JwtUser };

/** 用户视角监督镜像的默认演示用户（种子数据 phone）。无 userId 时回落到此用户。 */
const DEMO_USER_PHONE = '13900001001';

/**
 * 入驻资料是否强制齐全（缺件直接 400，不让空壳申请进一审）。
 *
 * 当前为 **false（兼容态）**：web 端 Apply.tsx 尚未收集资质材料，强制会直接打断现有提交。
 * 待 P1「注册即入驻 / 资料页」上线后改为 true，届时代理商第一闸口审到的必是真材料。
 * 无论开关如何，只要请求带了任一材料字段，就按「填了必须填全」校验。
 */
/**
 * 材料是否强制必填。
 * false 时是「填了就须填全」的兼容态（老入口未收集材料，强制会直接打断提交）；
 * Apply.tsx 与 /onboarding 均已收集完整主体材料后，置为 true —— 让代理商第一闸口
 * 审到的是真实资质材料，而不是空壳申请。
 */
const MATERIALS_REQUIRED = true;

/**
 * 用户视角业务编号生成器 —— 与 UI_Design/index.html 原型样例编号格式严格对齐。
 *  订单 QD…0316（存 QD202608270316，展示取尾 4 位）
 *  服务商 SP001 / 优惠券 CP-2001 / 钱包流水 W-1001
 *  业务消息 M-1001 / 通知公告 N-901 / 我的反馈 FB-2713（递减）
 */
const CODE = {
  orderNo: (d: Date, seq: number) =>
    `QD${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(seq).padStart(4, '0')}`,
  provider: (seq: number) => 'SP' + String(seq).padStart(3, '0'),
  coupon: (i: number) => 'CP-' + (2001 + i),
  wallet: (i: number) => 'W-' + (1001 + i),
  message: (i: number) => 'M-' + (1001 + i),
  notice: (i: number) => 'N-' + (901 + i),
  feedback: (seq: number) => 'FB-' + seq,
};

/** 原型 u-messages 筛选 chip 的状态取值集合（待处理 / 已处理） */
const MSG_TODO_STATUS = ['未读', '待支付', '待确认收货', '待评价', '待回复', '处理中'];
const MSG_DONE_STATUS = ['已读', '已完成', '已到账', '已退款', '已取消'];

/** 订单履约态（用户视角「我的订单」状态列） */
const SERVICE_STATUS: Record<string, { text: string }> = {
  pending_service: { text: '待服务' },
  in_service: { text: '履约中' },
  completed: { text: '已完成' },
  refunded: { text: '已退款' },
};

const USER_SELECT = {
  id: true,
  phone: true,
  nickname: true,
  avatar: true,
  realName: true,
  role: true,
  providerStatus: true,
  status: true,
  regionPath: true,
  createdAt: true,
} as const;

/**
 * 用户视角（USER · 运营端监督镜像）作用域端点。
 * ADMIN / AGENT = 监督镜像（可指定 userId 看他人，AGENT 受辖区 regionPath 约束）；
 * USER = 自助视角（userId 一律忽略，恒取本人，见 resolveUserId / resolveTarget）。
 * 注意：平台当前无 Coupon / 用户钱包(UserWallet) 模型，故
 *  - coupons 恒为 0（字段保留以便后续接入，不伪造数据）
 *  - wallet 对普通 USER 返回 isProvider:false 且余额全 0（诚实空态）
 */
@Controller('api/user')
@UseGuards(AuthGuard('jwt'))
export class UserConsoleController {
  constructor(private readonly prisma: PrismaService) {}

  /** 把监督目标落在当前操作者可见范围内（AGENT 限辖区） */
  private async resolveTarget(id: string, user: JwtUser) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        regionPath: true,
        // 工作台资料卡所需字段（原型 .ucard）
        nickname: true,
        realName: true,
        phone: true,
        vipLevel: true,
        createdAt: true,
        region: { select: { name: true } },
      },
    });
    if (!target) throw new NotFoundException('目标用户不存在');
    // 普通 USER 登录运营端是「自助视角」：只看自己，不能指定他人
    if (user.role === 'USER' && target.id !== user.id) {
      throw new ForbiddenException('普通用户只能查看自己的数据');
    }
    if (user.role === 'AGENT') {
      if (!user.regionPath || !(target.regionPath ?? '').startsWith(user.regionPath)) {
        throw new ForbiddenException('该用户不在你的辖区内');
      }
    }
    return target;
  }

  /** 解析监督目标 id：显式 userId 优先；USER 恒为本人；否则回落种子演示用户 */
  private async resolveUserId(userId: string | undefined, user: JwtUser): Promise<string> {
    // 普通 USER 登录运营端是「自助视角」：忽略 userId，一律取自己
    if (user.role === 'USER') return user.id;
    if (userId) {
      await this.resolveTarget(userId, user);
      return userId;
    }
    const demo = await this.prisma.user.findFirst({
      where: { phone: DEMO_USER_PHONE },
      select: { id: true },
    });
    if (!demo) throw new NotFoundException('未指定 userId 且默认演示用户不存在');
    return demo.id;
  }

  /** 用户可见消息判定（复用 MessageService.inbox 的可见性规则） */
  private visibleToUser(
    regionPath: string | null,
    m: { scope: string; regionPath: string | null; targetRole: string | null; recipientId?: string | null },
    userId?: string,
  ): boolean {
    if (m.scope === 'GLOBAL') return true;
    if (m.scope === 'REGION') {
      return !!regionPath && !!m.regionPath && regionPath.startsWith(m.regionPath);
    }
    if (m.scope === 'OWN') return m.targetRole === 'USER';
    // 指定接收人（加入团队申请的接收 / 拒绝回执）
    if (m.scope === 'USER') return !!m.recipientId && !!userId && m.recipientId === userId;
    return false;
  }

  /** 对象视角检索：按 ID / 用户名(昵称) / 姓名 / 手机号模糊检索用户；可指定 role 限定视图对象类型（AGENT 仅辖区） */
  @Get('resolve')
  @Roles('ADMIN', 'AGENT')
  @UseGuards(RolesGuard)
  async resolve(
    @Req() req: ReqUser,
    @Query('phone') phone?: string,
    @Query('keyword') keyword?: string,
    @Query('role') role?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const rp = user_role_regionPrefix(req.user);
    const where: any = {};
    if (rp) where.regionPath = { startsWith: rp };
    // 视察窗口按当前视角限定对象类型：服务商视角只出服务商、用户视角只出用户……
    if (role) where.role = role;
    if (phone) {
      where.phone = { contains: phone };
    } else if (keyword) {
      where.OR = [
        { id: { contains: keyword } },
        { nickname: { contains: keyword } },
        { realName: { contains: keyword } },
        { phone: { contains: keyword } },
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
        select: USER_SELECT,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page: p, pageSize: ps };
  }

  /** 用户工作台概览（监督镜像） */
  @Get('dashboard')
  @Roles('ADMIN', 'AGENT', 'USER')
  @UseGuards(RolesGuard)
  async dashboard(@Req() req: ReqUser, @Query('userId') userId?: string) {
    const id = await this.resolveUserId(userId, req.user);
    const target = await this.resolveTarget(id, req.user);
    const [
      orderTotal,
      dealOrders,
      refundedOrders,
      payAgg,
      refundAgg,
      provRows,
      feedbackCount,
      wallet,
      msgRows,
    ] = await this.prisma.$transaction([
      this.prisma.templateOrder.count({ where: { buyerId: id } }),
      this.prisma.templateOrder.count({ where: { buyerId: id, status: 'paid' } }),
      this.prisma.templateOrder.count({ where: { buyerId: id, status: 'refunded' } }),
      // 全量支付金额（退款率金额口径分母）
      this.prisma.templateOrder.aggregate({ where: { buyerId: id }, _sum: { amount: true } }),
      // 退款金额（退款率分子）
      this.prisma.templateOrder.aggregate({
        where: { buyerId: id, status: 'refunded' },
        _sum: { amount: true },
      }),
      this.prisma.templateOrder.findMany({
        where: { buyerId: id },
        distinct: ['templateId'],
        select: { templateId: true },
      }),
      this.prisma.ticket.count({ where: { reporterId: id } }),
      this.prisma.providerWallet.findUnique({ where: { providerId: id } }),
      this.prisma.message.findMany({
        where: { status: 'PUBLISHED' },
        select: { type: true, scope: true, regionPath: true, targetRole: true },
      }),
    ]);
    const providers = provRows.length;
    // KPI「业务消息」同列表口径：排除权威公告（归通知公告页）
    const messages = msgRows.filter(
      (m) => m.type !== 'ANNOUNCEMENT' && this.visibleToUser(target.regionPath, m, id),
    ).length;
    const totalPayCents = payAgg._sum.amount ?? 0;
    const refundCents = refundAgg._sum.amount ?? 0;
    // 工作台 KPI：积分 / 钱包余额 / 待评价订单（已支付且未评价）
    const me = await this.prisma.user.findUnique({
      where: { id },
      select: { points: true, userBalance: true, lastLoginAt: true, followingProviderCount: true },
    });
    const paidOrders = await this.prisma.templateOrder.findMany({
      where: { buyerId: id, status: 'paid' },
      select: { id: true },
    });
    // KPI 副标题：本月充值 / 待服务 / 履约中（原型 .kpi .d）
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [monthRecharge, pendingServiceOrders, inServiceOrders, myCoupons, activeOrders] =
      await this.prisma.$transaction([
      this.prisma.walletLog.aggregate({
        where: { userId: id, type: 'RECHARGE', status: 'SUCCESS', createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      this.prisma.templateOrder.count({ where: { buyerId: id, serviceStatus: 'pending_service' } }),
      this.prisma.templateOrder.count({ where: { buyerId: id, serviceStatus: 'in_service' } }),
      this.prisma.userCoupon.count({ where: { userId: id } }),
      // 进行中订单：近 30 天已支付订单（与运营端 /auth/me 的 activeOrders 口径一致）
      this.prisma.templateOrder.count({
        where: { buyerId: id, status: 'paid', createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      }),
    ]);
    const reviewedOrderIds = new Set(
      (
        await this.prisma.review.findMany({
          where: { userId: id, orderId: { in: paidOrders.map((o) => o.id) } },
          select: { orderId: true },
        })
      ).map((r) => r.orderId),
    );
    const pendingReviewOrders = paidOrders.filter((o) => !reviewedOrderIds.has(o.id)).length;
    return {
      userId: id,
      // 资料卡：原型 ucard 展示姓名 / 手机 / 城市 / 注册时间 / 会员等级
      profile: {
        id: target.id,
        nickname: target.nickname ?? null,
        realName: target.realName ?? null,
        phone: target.phone ?? null,
        vipLevel: target.vipLevel ?? 0,
        regionPath: target.regionPath ?? null,
        regionName: target.region?.name ?? null,
        createdAt: target.createdAt,
      },
      orders: orderTotal,
      dealOrders,
      refundedOrders,
      dealRate: orderTotal ? Math.round((dealOrders / orderTotal) * 1000) / 10 : 0,
      returnRate: orderTotal ? Math.round((refundedOrders / orderTotal) * 1000) / 10 : 0,
      refundRate: totalPayCents ? Math.round((refundCents / totalPayCents) * 1000) / 10 : 0,
      providers,
      coupons: myCoupons,
      // 累计消费 = 已支付 − 已退款（净额，与成交口径一致）
      totalSpentCents: Math.max(0, totalPayCents - refundCents),
      hasWallet: !!wallet,
      balanceCents: wallet?.balance ?? me?.userBalance ?? 0,
      totalIncomeCents: wallet?.totalIncome ?? 0,
      withdrawnCents: wallet?.withdrawn ?? 0,
      points: me?.points ?? 0,
      // 账户详情对齐运营端：最后登录 / 关注服务商数
      lastLoginAt: me?.lastLoginAt ?? null,
      followingProviderCount: me?.followingProviderCount ?? 0,
      // 进行中订单（近 30 天已支付）与其中待评价的数
      activeOrders,
      pendingReviewOrders,
      reviewCount: reviewedOrderIds.size,
      feedback: feedbackCount,
      messages,
      // —— KPI 副标题所需（原型：+ ¥500 本月充值 / 可兑换 8 张券 / 待服务 1 · 待评价 1 / 共 12 笔）——
      monthRechargeCents: monthRecharge._sum.amount ?? 0,
      pendingServiceOrders,
      inServiceOrders,
      // 积分兑券：每 400 积分可兑 1 张券（原型 3260 分 → 8 张）
      exchangeableCoupons: Math.floor((me?.points ?? 0) / 400),
    };
  }

  /** 我的订单（买家视角）：附带评价状态，供「评价 / 追评」判定 */
  @Get('orders')
  @Roles('ADMIN', 'AGENT', 'USER')
  @UseGuards(RolesGuard)
  async orders(
    @Req() req: ReqUser,
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('serviceStatus') serviceStatus?: string,
  ) {
    const id = await this.resolveUserId(userId, req.user);
    await this.resolveTarget(id, req.user);
    const where: any = { buyerId: id };
    if (status) where.status = status;
    // 用户视角按履约态筛选（待服务 / 履约中 / 已完成 / 已退款）
    if (serviceStatus) where.serviceStatus = serviceStatus;
    const p = page ? Number(page) : 1;
    const ps = Math.min(pageSize ? Number(pageSize) : 10, 100);
    const [rows, total, reviews] = await this.prisma.$transaction([
      this.prisma.templateOrder.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { createdAt: 'desc' },
        include: {
          buyer: { select: { id: true, nickname: true, phone: true } },
          template: {
            select: {
              id: true,
              name: true,
              category: true,
              cover: true,
              author: { select: { id: true, nickname: true, realName: true } },
            },
          },
        },
      }),
      this.prisma.templateOrder.count({ where }),
      this.prisma.review.findMany({ where: { userId: id } }),
    ]);
    const rvByOrder = new Map(reviews.filter((r) => !!r.orderId).map((r) => [r.orderId as string, r]));
    const items = rows.map((o) => {
      const rv = rvByOrder.get(o.id);
      return {
        ...o,
        // 业务单号（原型 QD…0316）：无单号时按创建时间稳定派生
        orderNo: o.orderNo ?? CODE.orderNo(o.createdAt, Number(o.id.slice(-4).replace(/\D/g, '')) || 0),
        serviceStatusText: SERVICE_STATUS[o.serviceStatus]?.text ?? o.serviceStatus,
        // 原型：订单详情在「已评价」时追加评价等级与评价内容
        reviewed: !!rv,
        rating: rv?.rating ?? null,
        reviewContent: rv?.content ?? null,
      };
    });
    return { items, total, page: p, pageSize: ps };
  }

  /**
   * 我的作品（原型 u-works）：前端编辑器设计的个人请柬作品。
   * 监督镜像：ADMIN / AGENT 可指定 userId 看他人，USER 恒取本人（resolveUserId）。
   * 返回精简字段（含 publishCode / viewCount），并附带完整 schema，
   * 供运营端用统一渲染器（@h5design/render 的 SchemaThumbnail）真实渲染首屏缩略图，
   * 与 web 端「我的作品」像素一致。注意：schema 已按监督权限在服务端正确解析，
   * 不依赖 web 的 /api/projects/:id（该接口按请求者自身 id 取数，监督视角取不到他人作品）。
   */
  @Get('works')
  @Roles('ADMIN', 'AGENT', 'USER')
  @UseGuards(RolesGuard)
  async works(@Req() req: ReqUser, @Query('userId') userId?: string) {
    const id = await this.resolveUserId(userId, req.user);
    await this.resolveTarget(id, req.user);
    const rows = await this.prisma.project.findMany({
      where: { userId: id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        cover: true,
        status: true,
        publishCode: true,
        viewCount: true,
        createdAt: true,
        updatedAt: true,
        schema: true,
        draftSchema: true,
      },
    });
    // 返回完整 schema（含 version / pages / elements），由前端统一渲染器消费。
    // 草稿优先：draftSchema ?? schema，与编辑器（loadProject draftSchema ?? schema）及 web 端 findAll 对齐。
    const items = rows.map((r) => ({
      ...r,
      schema: (r.draftSchema && typeof r.draftSchema === 'object') ? r.draftSchema : r.schema,
    }));
    return { items, total: items.length };
  }

  /** 我的服务商（我购买过服务的服务商去重列表） */
  @Get('providers')
  @Roles('ADMIN', 'AGENT', 'USER')
  @UseGuards(RolesGuard)
  async providers(
    @Req() req: ReqUser,
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const id = await this.resolveUserId(userId, req.user);
    await this.resolveTarget(id, req.user);
    // 「我的服务商」= 我购买过的模板的作者（经 templateId → authorId 一跳），
    // 不能拿 templateId 直接去 User 表匹配 id —— 那样永远查不到。
    const bought = await this.prisma.templateOrder.findMany({
      where: { buyerId: id },
      distinct: ['templateId'],
      select: { templateId: true },
    });
    const tplIds = bought.map((t) => t.templateId);
    const authors = tplIds.length
      ? (
          await this.prisma.template.findMany({
            where: { id: { in: tplIds } },
            select: { authorId: true },
          })
        ).map((t) => t.authorId)
      : [];
    const providerIds = [...new Set(authors.filter((a): a is string => !!a))];
    const p = page ? Number(page) : 1;
    const ps = Math.min(pageSize ? Number(pageSize) : 20, 100);
    const [rows, total, reviews, firstOrders] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: { id: { in: providerIds }, role: 'SERVICE_PROVIDER' },
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          nickname: true,
          phone: true,
          realName: true,
          providerStatus: true,
          serviceRoles: true,
          regionPath: true,
        },
      }),
      this.prisma.user.count({ where: { id: { in: providerIds }, role: 'SERVICE_PROVIDER' } }),
      this.prisma.review.findMany({ where: { userId: id } }),
      // 关注时间：取与该服务商的首次成交时间（平台暂无独立关注模型）
      this.prisma.templateOrder.findMany({
        where: { buyerId: id },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true, template: { select: { authorId: true } } },
      }),
    ]);
    const rvByProvider = new Map(
      reviews.filter((r) => !!r.providerId).map((r) => [r.providerId as string, r]),
    );
    const firstAt = new Map<string, string>();
    for (const o of firstOrders) {
      const aid = o.template?.authorId;
      if (aid && !firstAt.has(aid)) firstAt.set(aid, o.createdAt.toISOString());
    }
    // 原型编号 SP001…：按服务商注册时间生成全局稳定序号（不随分页漂移）
    const allProviders = await this.prisma.user.findMany({
      where: { role: 'SERVICE_PROVIDER' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    const spSeq = new Map(allProviders.map((u, i) => [u.id, i + 1]));
    const items = rows.map((u) => {
      const rv = rvByProvider.get(u.id);
      return {
        ...u,
        // 原型：编号 SP001（三位序号）
        code: CODE.provider(spSeq.get(u.id) ?? 0),
        rating: rv?.rating ?? null,
        reviewContent: rv?.content ?? null,
        reviewed: !!rv,
        followedAt: firstAt.get(u.id) ?? null,
      };
    });
    return { items, total, page: p, pageSize: ps };
  }

  /** 评价与反馈（本人发起） */
  @Get('feedback')
  @Roles('ADMIN', 'AGENT', 'USER')
  @UseGuards(RolesGuard)
  async feedback(
    @Req() req: ReqUser,
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    const id = await this.resolveUserId(userId, req.user);
    await this.resolveTarget(id, req.user);
    const where: any = { reporterId: id };
    if (status) where.status = status;
    const p = page ? Number(page) : 1;
    const ps = Math.min(pageSize ? Number(pageSize) : 10, 100);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { createdAt: 'desc' },
        include: {
          reporter: { select: { id: true, nickname: true, phone: true, role: true } },
          target: { select: { id: true, nickname: true, phone: true, role: true } },
        },
      }),
      this.prisma.ticket.count({ where }),
    ]);
    return { items, total, page: p, pageSize: ps };
  }

  /** 消息中心（用户可见的已发布消息） */
  @Get('messages')
  @Roles('ADMIN', 'AGENT', 'USER')
  @UseGuards(RolesGuard)
  async messages(
    @Req() req: ReqUser,
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const id = await this.resolveUserId(userId, req.user);
    const target = await this.resolveTarget(id, req.user);
    const all = await this.prisma.message.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, nickname: true, phone: true, role: true } } },
    });
    // 业务消息不含权威公告（ANNOUNCEMENT 归「通知公告」页），与侧栏气泡 messagePending 口径一致
    const visible = all.filter(
      (m) => m.type !== 'ANNOUNCEMENT' && this.visibleToUser(target.regionPath, m, id),
    );
    const reads = await this.prisma.messageRead.findMany({ where: { userId: id } });
    const readSet = new Set(reads.map((r) => r.messageId));
    const p = page ? Number(page) : 1;
    const ps = Math.min(pageSize ? Number(pageSize) : 10, 100);
    const start = (p - 1) * ps;
    const items = visible.slice(start, start + ps).map((m, i) => {
      // 状态由已读回执判定（原型状态取值含 待支付/待确认收货/待评价/待回复/处理中 …，
      // 平台 Message 模型目前只有已读回执，故真实状态只有 未读 / 已读）
      const status = readSet.has(m.id) ? '已读' : '未读';
      return {
        ...m,
        code: CODE.message(start + i),
        read: readSet.has(m.id),
        status,
        // 供「待处理 / 已处理」chip 判定（取值集合对齐原型 v:[] 配置）
        pending: MSG_TODO_STATUS.includes(status),
      };
    });
    return {
      items,
      total: visible.length,
      page: p,
      pageSize: ps,
    };
  }

  /**
   * 业务消息详情（web MessageDetail 弹窗取数）。
   * 2026-09-24 E2E 发现：前端一直调 GET /api/user/messages/:id，但服务端从未实现该路由
   * （404 Not Found），详情弹窗永远停在「加载中…」。与列表同口径过滤（含 scope=USER 定向投递），
   * 编号按其在可见列表中的序号生成，保证与列表行 M-10xx 一致。
   */
  @Get('messages/:id')
  @Roles('ADMIN', 'AGENT', 'USER')
  @UseGuards(RolesGuard)
  async messageDetail(
    @Req() req: ReqUser,
    @Param('id') mid: string,
    @Query('userId') userId?: string,
  ) {
    const id = await this.resolveUserId(userId, req.user);
    const target = await this.resolveTarget(id, req.user);
    const all = await this.prisma.message.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, nickname: true, phone: true, role: true } } },
    });
    const visible = all.filter(
      (m) => m.type !== 'ANNOUNCEMENT' && this.visibleToUser(target.regionPath, m, id),
    );
    const idx = visible.findIndex((m) => m.id === mid);
    // 不可见 / 不存在一律 404：不给越权探测空间
    if (idx < 0) throw new NotFoundException('消息不存在或不可见');
    const m = visible[idx];
    const readRow = await this.prisma.messageRead.findUnique({
      where: { messageId_userId: { messageId: mid, userId: id } },
    });
    return { ...m, code: CODE.message(idx), read: !!readRow, status: readRow ? '已读' : '未读' };
  }

  /** 我的钱包（诚实：普通 USER 无钱包，isProvider=false 且余额为 0） */
  @Get('wallet')
  @Roles('ADMIN', 'AGENT', 'USER')
  @UseGuards(RolesGuard)
  async wallet(@Req() req: ReqUser, @Query('userId') userId?: string) {
    const id = await this.resolveUserId(userId, req.user);
    await this.resolveTarget(id, req.user);
    const u = await this.prisma.user.findUnique({
      where: { id },
      select: { userBalance: true, points: true },
    });
    const [w, payAgg, refundAgg] = await this.prisma.$transaction([
      this.prisma.providerWallet.findUnique({ where: { providerId: id } }),
      this.prisma.templateOrder.aggregate({ where: { buyerId: id }, _sum: { amount: true } }),
      this.prisma.templateOrder.aggregate({
        where: { buyerId: id, status: 'refunded' },
        _sum: { amount: true },
      }),
    ]);
    return {
      isProvider: !!w,
      balanceCents: w?.balance ?? u?.userBalance ?? 0,
      totalIncomeCents: w?.totalIncome ?? 0,
      withdrawnCents: w?.withdrawn ?? 0,
      // 累计消费与工作台 KPI 同口径：已支付 − 已退款
      totalSpentCents: Math.max(0, (payAgg._sum.amount ?? 0) - (refundAgg._sum.amount ?? 0)),
      points: u?.points ?? 0,
    };
  }

  /* ══════════ 我的评价（Review） ══════════ */

  /**
   * 我的评价列表。
   * 表头：订单编号 / 服务 / 评分 / 评价内容 / 时间 / 状态（原型 u-feedback）
   */
  @Get('reviews')
  @Roles('ADMIN', 'AGENT', 'USER')
  @UseGuards(RolesGuard)
  async reviews(
    @Req() req: ReqUser,
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const id = await this.resolveUserId(userId, req.user);
    await this.resolveTarget(id, req.user);
    const p = page ? Number(page) : 1;
    const ps = Math.min(pageSize ? Number(pageSize) : 10, 100);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where: { userId: id },
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.count({ where: { userId: id } }),
    ]);
    const orderIds = [...new Set(rows.map((r) => r.orderId).filter((x): x is string => !!x))];
    const orders = orderIds.length
      ? await this.prisma.templateOrder.findMany({
          where: { id: { in: orderIds } },
          select: { id: true, orderNo: true, createdAt: true, template: { select: { name: true } } },
        })
      : [];
    const nameByOrder = new Map(orders.map((o) => [o.id, o.template?.name ?? '—']));
    const noByOrder = new Map(
      orders.map((o) => [
        o.id,
        o.orderNo ?? CODE.orderNo(o.createdAt, Number(o.id.slice(-4).replace(/\D/g, '')) || 0),
      ]),
    );
    const items = rows.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      orderNo: r.orderId ? noByOrder.get(r.orderId) ?? null : null,
      serviceName: r.orderId ? nameByOrder.get(r.orderId) ?? '—' : '—',
      rating: r.rating,
      content: r.content,
      createdAt: r.createdAt,
      status: '已发布',
    }));
    return { items, total, page: p, pageSize: ps };
  }

  /**
   * 提交 / 追评。同一用户对同一订单（或同一服务商）只保留一条评价：
   * 已存在则覆盖星级与评语（即「追评」语义）。
   */
  @Post('reviews')
  @Roles('ADMIN', 'AGENT', 'USER')
  @UseGuards(RolesGuard)
  async createReview(
    @Req() req: ReqUser,
    @Body() body: { orderId?: string; providerId?: string; rating: number; content: string; userId?: string },
  ) {
    const id = await this.resolveUserId(body.userId, req.user);
    await this.resolveTarget(id, req.user);
    const rating = Number(body.rating);
    if (!rating || rating < 1 || rating > 5) throw new BadRequestException('评分应为 1~5 星');
    const content = String(body.content ?? '').trim();
    if (!content) throw new BadRequestException('请填写评语');
    if (!body.orderId && !body.providerId) throw new BadRequestException('缺少评价对象');

    if (body.orderId) {
      const order = await this.prisma.templateOrder.findUnique({ where: { id: body.orderId } });
      if (!order || order.buyerId !== id) throw new ForbiddenException('订单不属于该用户');
    }
    const existing = await this.prisma.review.findFirst({
      where: body.orderId ? { userId: id, orderId: body.orderId } : { userId: id, providerId: body.providerId! },
    });
    if (existing) {
      return this.prisma.review.update({
        where: { id: existing.id },
        data: { rating, content },
      });
    }
    return this.prisma.review.create({
      data: {
        userId: id,
        orderId: body.orderId ?? null,
        providerId: body.providerId ?? null,
        rating,
        content,
      },
    });
  }

  /* ══════════ 我的反馈（Ticket） ══════════ */

  /**
   * 我的反馈列表（原型 u-complaints）。
   * 表头：编号 / 主题 / 类型 / 对象 / 时间 / 状态；数据源为本人发起的工单。
   */
  @Get('complaints')
  @Roles('ADMIN', 'AGENT', 'USER')
  @UseGuards(RolesGuard)
  async complaints(
    @Req() req: ReqUser,
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    const id = await this.resolveUserId(userId, req.user);
    await this.resolveTarget(id, req.user);
    const where: any = { reporterId: id };
    if (status) where.status = status;
    const p = page ? Number(page) : 1;
    const ps = Math.min(pageSize ? Number(pageSize) : 10, 100);
    const [rows, total, allSameUser] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { createdAt: 'desc' },
        include: {
          reporter: { select: { id: true, nickname: true, phone: true, role: true } },
          target: { select: { id: true, nickname: true, phone: true, role: true } },
        },
      }),
      this.prisma.ticket.count({ where }),
      // 编号需跨页稳定：按该用户全部反馈的时间倒序推全局序号（原型 FB_SEQ 自增语义）
      this.prisma.ticket.findMany({
        where: { reporterId: id },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      }),
    ]);
    const seqOf = new Map(allSameUser.map((t, i) => [t.id, 2713 - i]));
    const items = rows.map((t) => ({ ...t, code: 'FB-' + (seqOf.get(t.id) ?? 0) }));
    return { items, total, page: p, pageSize: ps };
  }

  /** 新增反馈（原型 pg-fbnew 提交） */
  @Post('complaints')
  @Roles('ADMIN', 'AGENT', 'USER')
  @UseGuards(RolesGuard)
  async createComplaint(
    @Req() req: ReqUser,
    @Body()
    body: {
      userId?: string;
      title: string;
      type?: string;
      dept?: string;
      targetId?: string;
      content: string;
      draft?: boolean;
    },
  ) {
    const id = await this.resolveUserId(body.userId, req.user);
    const target = await this.resolveTarget(id, req.user);
    const title = String(body.title ?? '').trim();
    const content = String(body.content ?? '').trim();
    if (!title) throw new BadRequestException('请填写反馈主题');
    if (!content) throw new BadRequestException('请填写反馈内容');
    const type = (body.type ?? 'CONSULT').toUpperCase();
    // 原型 FB_TYPES：售后 / 建议 / 咨询 / 投诉 / 其他
    const allowed = [
      'COMPLAINT',
      'PRAISE',
      'SUGGESTION',
      'CONSULT',
      'APPEAL',
      'AFTERSALE',
      'OTHER',
    ];
    return this.prisma.ticket.create({
      data: {
        type: (allowed.includes(type) ? type : 'CONSULT') as any,
        title,
        content,
        status: (body.draft ? 'OPEN' : 'OPEN') as any,
        regionPath: target.regionPath ?? null,
        reporterId: id,
        reporterRole: 'USER' as any,
        targetId: body.targetId || null,
      },
    });
  }

  /** 反馈详情（原型 pg-fbdetail：左信息 + 右处理流程 + 回复日志） */
  @Get('complaints/:id')
  @Roles('ADMIN', 'AGENT', 'USER')
  @UseGuards(RolesGuard)
  async complaint(@Req() req: ReqUser, @Param('id') id: string) {
    const t = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        reporter: { select: { id: true, nickname: true, phone: true, role: true } },
        target: { select: { id: true, nickname: true, phone: true, role: true } },
        assignee: { select: { id: true, nickname: true, role: true } },
      },
    });
    if (!t) throw new NotFoundException('反馈不存在');
    await this.resolveTarget(t.reporterId, req.user);
    const seq = await this.prisma.ticket.count({
      where: { reporterId: t.reporterId, createdAt: { gt: t.createdAt } },
    });
    return { ...t, code: 'FB-' + (2713 - seq) };
  }

  /* ══════════ 通知公告 / 已读回执 ══════════ */

  /**
   * 通知公告（原型 u-notices）：本人可见的权威公告（ANNOUNCEMENT）。
   * 状态由 MessageRead 回执判定：已读 / 未读。
   * kind='qualification' 的资格通知由入驻申请初审通过（FIRST_PASSED）派生，
   * 可继续进入「填写资料」页补充完整资料。
   */
  @Get('notices')
  @Roles('ADMIN', 'AGENT', 'USER')
  @UseGuards(RolesGuard)
  async notices(
    @Req() req: ReqUser,
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const id = await this.resolveUserId(userId, req.user);
    const target = await this.resolveTarget(id, req.user);
    const [all, reads, apps] = await this.prisma.$transaction([
      this.prisma.message.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { createdAt: 'desc' },
        include: { author: { select: { id: true, nickname: true, role: true } } },
      }),
      this.prisma.messageRead.findMany({ where: { userId: id } }),
      this.prisma.qualificationApplication.findMany({ where: { userId: id, status: 'FIRST_PASSED' } }),
    ]);
    const readSet = new Set(reads.map((r) => r.messageId));
    const anns = all.filter(
      (m) => m.type === 'ANNOUNCEMENT' && this.visibleToUser(target.regionPath, m, id),
    );
    const rows: any[] = anns.map((m) => ({
      id: m.id,
      kind: 'message',
      title: m.title,
      type: '公告',
      content: m.content,
      createdAt: m.createdAt,
      author: m.author,
      status: readSet.has(m.id) ? '已读' : '未读',
    }));
    // 资格通知（初审通过 → 可填写资料）
    for (const a of apps) {
      rows.push({
        id: a.id,
        kind: 'qualification',
        fillKind: a.kind === 'agent' ? 'agent' : 'provider',
        title: `${a.kind === 'agent' ? '代理商' : '服务商'}入驻资格初审通过`,
        type: '资格通知',
        content: '初审已通过，请补充完整资料后进入管理总台终审。',
        createdAt: a.updatedAt,
        author: null,
        status: '初审通过',
      });
    }
    rows.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    const p = page ? Number(page) : 1;
    const ps = Math.min(pageSize ? Number(pageSize) : 10, 100);
    const start = (p - 1) * ps;
    const items = rows.slice(start, start + ps).map((r, i) => ({
      ...r,
      code: CODE.notice(start + i),
    }));
    return { items, total: rows.length, page: p, pageSize: ps };
  }

  /** 标记已读（原型：查看公告后状态由未读 → 已读） */
  @Post('notices/:id/read')
  @Roles('ADMIN', 'AGENT', 'USER')
  @UseGuards(RolesGuard)
  async readNotice(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Body() body: { userId?: string },
  ) {
    const uid = await this.resolveUserId(body?.userId, req.user);
    await this.resolveTarget(uid, req.user);
    await this.prisma.messageRead.upsert({
      where: { messageId_userId: { messageId: id, userId: uid } },
      create: { messageId: id, userId: uid },
      update: {},
    });
    return { ok: true };
  }

  /** 业务消息标记已读 */
  @Post('messages/:id/read')
  @Roles('ADMIN', 'AGENT', 'USER')
  @UseGuards(RolesGuard)
  async readMessage(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Body() body: { userId?: string },
  ) {
    const uid = await this.resolveUserId(body?.userId, req.user);
    await this.resolveTarget(uid, req.user);
    await this.prisma.messageRead.upsert({
      where: { messageId_userId: { messageId: id, userId: uid } },
      create: { messageId: id, userId: uid },
      update: {},
    });
    return { ok: true };
  }

  /* ══════════ 优惠与权益（Coupon / UserCoupon） ══════════ */

  /**
   * 我的优惠券（原型 u-coupons）。
   * 表头：编号 / 优惠券 / 面额 / 有效期 / 使用条件 / 状态
   * 编号沿用券种自身 code（CP-2001…），跨页稳定。
   */
  @Get('coupons')
  @Roles('ADMIN', 'AGENT', 'USER')
  @UseGuards(RolesGuard)
  async coupons(
    @Req() req: ReqUser,
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const id = await this.resolveUserId(userId, req.user);
    await this.resolveTarget(id, req.user);
    const p = page ? Number(page) : 1;
    const ps = Math.min(pageSize ? Number(pageSize) : 10, 100);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.userCoupon.findMany({
        where: { userId: id },
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { receivedAt: 'desc' },
        include: { coupon: true },
      }),
      this.prisma.userCoupon.count({ where: { userId: id } }),
    ]);
    const items = rows.map((uc) => ({
      id: uc.id,
      code: uc.coupon.code,
      name: uc.coupon.name,
      amountCents: uc.coupon.amount,
      benefit: uc.coupon.benefit ?? null,
      // 面额展示：0 元券展示权益描述（如「免排期」）
      amountText: uc.coupon.amount > 0 ? uc.coupon.amount : uc.coupon.benefit ?? '—',
      condition:
        uc.coupon.condition ??
        (uc.coupon.minSpend > 0 ? `满 ${(uc.coupon.minSpend / 100).toFixed(0)} 元可用` : '无门槛'),
      validUntil: uc.coupon.validUntil,
      receivedAt: uc.receivedAt,
      usedAt: uc.usedAt,
      status: uc.status === 'USED' ? '已使用' : uc.status === 'EXPIRED' ? '已过期' : '未使用',
    }));
    return { items, total, page: p, pageSize: ps, hasModel: true };
  }

  /**
   * 我的钱包流水（原型 u-wallet）。
   * 表头：流水号 / 时间 / 类型 / 金额 / 变动后余额 / 状态
   * 流水号 W-1001 起，按展示序（最新在前）分配，跨页稳定。
   */
  @Get('wallet/logs')
  @Roles('ADMIN', 'AGENT', 'USER')
  @UseGuards(RolesGuard)
  async walletLogs(
    @Req() req: ReqUser,
    @Query('userId') userId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const id = await this.resolveUserId(userId, req.user);
    await this.resolveTarget(id, req.user);
    const p = page ? Number(page) : 1;
    const ps = Math.min(pageSize ? Number(pageSize) : 10, 100);
    const [all, total] = await this.prisma.$transaction([
      this.prisma.walletLog.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.walletLog.count({ where: { userId: id } }),
    ]);
    const seqOf = new Map(all.map((l, i) => [l.id, i]));
    const items = all.slice((p - 1) * ps, (p - 1) * ps + ps).map((l) => ({
      id: l.id,
      code: CODE.wallet(seqOf.get(l.id) ?? 0),
      createdAt: l.createdAt,
      // 类型：RECHARGE 充值 / CONSUME 消费 / REFUND 退款 / GIFT 权益赠送
      type:
        l.type === 'RECHARGE'
          ? '充值'
          : l.type === 'CONSUME'
            ? '消费'
            : l.type === 'REFUND'
              ? '退款'
              : '权益',
      amountCents: l.amount,
      balanceCents: l.balanceAfter,
      status: l.status === 'SUCCESS' ? '成功' : l.status === 'PENDING' ? '处理中' : '失败',
      note: l.note ?? null,
    }));
    return { items, total, page: p, pageSize: ps, hasModel: true };
  }

  /* ══════════ 调整用户数据（原型 #uAdjModal） ══════════ */

  @Post('adjust')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async adjust(
    @Req() req: ReqUser,
    @Body() body: { userId?: string; vipLevel?: number; balance?: number; points?: number },
  ) {
    const id = await this.resolveUserId(body.userId, req.user);
    await this.resolveTarget(id, req.user);
    const data: any = {};
    if (body.vipLevel != null) data.vipLevel = Number(body.vipLevel);
    if (body.balance != null) data.userBalance = Math.max(0, Math.round(Number(body.balance) * 100));
    if (body.points != null) data.points = Math.max(0, Math.round(Number(body.points)));
    if (!Object.keys(data).length) throw new BadRequestException('没有需要调整的字段');
    const u = await this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, vipLevel: true, userBalance: true, points: true, totalSpent: true },
    });
    return { ...u, balanceCents: u.userBalance };
  }

  /* ══════════ 入驻申请（成为代理商 / 成为服务商 + 填写资料） ══════════ */

  @Get('qualifications')
  @Roles('ADMIN', 'AGENT', 'USER')
  @UseGuards(RolesGuard)
  async qualifications(@Req() req: ReqUser, @Query('userId') userId?: string) {
    const id = await this.resolveUserId(userId, req.user);
    await this.resolveTarget(id, req.user);
    return this.prisma.qualificationApplication.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('qualifications')
  @Roles('ADMIN', 'AGENT', 'USER')
  @UseGuards(RolesGuard)
  async createQualification(
    @Req() req: ReqUser,
    @Body()
    body: {
      userId?: string;
      kind: string;
      reason: string;
      serviceScopes?: string[];
      regionPath?: string;
      regionLabel?: string;
      // —— M3：材料前置 —— 允许在提交申请时即带上真实资质材料，
      // 使代理商第一闸口审的是真材料（原流程材料只能在一审通过后补填）。
      applicantName?: string;
      phone?: string;
      certType?: string;
      certNo?: string;
      certExpire?: string;
      certLongTerm?: boolean;
      issuer?: string;
      attachments?: string[];
    },
  ) {
    const id = await this.resolveUserId(body.userId, req.user);
    await this.resolveTarget(id, req.user);
    const kind = body.kind === 'agent' ? 'agent' : 'provider';
    const reason = String(body.reason ?? '').trim();
    if (!reason) throw new BadRequestException('请填写申请理由');
    if (kind === 'provider' && !(body.serviceScopes ?? []).length) {
      throw new BadRequestException('请至少选择一项服务类型');
    }
    // 区域语义：代理商 = 辖区（必填）；服务商 = 开展服务区域（**必填**，决策 7）
    // 服务商区域留空会产出「不落入任何代理商辖区」的孤立主体，无人一审，故改为必填。
    if (!body.regionPath) {
      throw new BadRequestException(
        kind === 'agent' ? '请选择完整的代理辖区（省 / 市 / 区县）' : '请选择开展服务的区域',
      );
    }
    // —— 代理商辖区深度校验：必须选到区县（regionPath = "省/市/区"）——
    // 仅选到省/市会产生「一个代理商罩住整个省」的超大辖区，且与既有市级代理商重叠。
    if (kind === 'agent' && body.regionPath) {
      const depth = String(body.regionPath).split('/').filter(Boolean).length;
      if (depth < 3) {
        throw new BadRequestException('请选择完整的代理辖区（省 / 市 / 区县）');
      }
      // —— 辖区重叠预检（前移）：原实现只在总台终审前拦截，用户要等到终审才知道填错。
      const conflict = await this.findRegionConflict(body.regionPath, id);
      if (conflict) {
        throw new BadRequestException(
          `代理辖区与既有代理商重叠（${conflict.regionPath}），同一辖区仅允许一个代理商`,
        );
      }
    }

    // —— 材料完整性（分级）—— MATERIALS_REQUIRED=true 时强制；否则「填了就须填全」，
    // 现状（Apply.tsx 尚未收集材料）下保持兼容，仅打 MATERIAL_MISSING 风险旗标。
    const attachments = (body.attachments ?? []).filter((x: any) => !!String(x ?? '').trim());
    const certNo = (body.certNo ?? '').toString().trim();
    const applicantName = (body.applicantName ?? '').toString().trim();
    const certType = (body.certType ?? '').toString().trim();
    const certExpire = (body.certExpire ?? '').toString().trim();
    const certLongTerm = !!body.certLongTerm;
    const hasAnyMaterial = !!applicantName || !!certNo || attachments.length > 0;
    const missing: string[] = [];
    if (!applicantName) missing.push('申请人姓名');
    if (!(body.phone ?? '').toString().trim()) missing.push('联系手机');
    if (!certType) missing.push('证件类型');
    if (!certNo) missing.push('证件号码');
    if (!certLongTerm && !certExpire) missing.push('证件有效期');
    if (!attachments.length) missing.push('资质附件');
    const materialComplete = missing.length === 0;
    if (missing.length && (MATERIALS_REQUIRED || hasAnyMaterial)) {
      throw new BadRequestException(`资料不完整，请补充：${missing.join('、')}`);
    }

    // —— 风险旗标（提交时自动预检，供总台终审参考）——
    const riskFlags: string[] = [];
    if (!materialComplete) riskFlags.push('MATERIAL_MISSING');
    if (certNo) {
      // —— 主体唯一性（决策 8）——
      // ① 命中**已入驻主体**（APPROVED，即已落地身份的服务商/代理商）→ 直接拦截：
      //    同一证件号已是平台主体，换手机号重开即为重复入驻。
      // ② 仅命中**在途申请** → 不拦截，只打旗标告警：可能是同一主体误重复提交，
      //    也可能是历史脏数据（同号不同主体），交由人工在终审判定，避免误伤。
      const approvedDup = await this.prisma.qualificationApplication.findFirst({
        where: { certNo, userId: { not: id }, status: 'APPROVED' },
        select: { id: true, kind: true },
      });
      if (approvedDup) {
        throw new BadRequestException('该证件号码已是平台入驻主体，不可重复注册');
      }
      const pendingDup = await this.prisma.qualificationApplication.findFirst({
        where: {
          certNo,
          userId: { not: id },
          status: { in: ['FIRST_PENDING', 'FIRST_PASSED', 'FINAL_PENDING'] },
        },
        select: { id: true },
      });
      if (pendingDup) riskFlags.push('DUPLICATE_CERT_NO');
    }
    if (kind === 'provider') {
      const rp = (body.regionPath ?? '').toString().trim();
      if (!rp) riskFlags.push('NO_REGION');
      else if (!(await this.resolveAgentId(rp))) riskFlags.push('NO_AGENT_COVERAGE');
    }

    const dup = await this.prisma.qualificationApplication.findFirst({
      where: { userId: id, kind, status: { in: ['FIRST_PENDING', 'FIRST_PASSED', 'FINAL_PENDING'] } },
    });
    if (dup) return { ...dup, duplicated: true };
    return this.prisma.qualificationApplication.create({
      data: {
        userId: id,
        kind,
        status: 'FIRST_PENDING',
        reason,
        serviceScopes: body.serviceScopes ?? [],
        regionPath: body.regionPath,
        regionLabel: body.regionLabel ?? null,
        // M3：材料随申请一并落库（可选）
        applicantName: applicantName || null,
        phone: (body.phone ?? '').toString().trim() || null,
        certType: certType || null,
        certNo: certNo || null,
        certExpire: certExpire || null,
        certLongTerm,
        issuer: (body.issuer ?? '').toString().trim() || null,
        attachments,
        materialSubmittedAt: materialComplete ? new Date() : null,
        riskFlags,
      },
    });
  }

  /* ══════════════════ 加入团队申请（JOIN 隧道）══════════════════
   * 与「入驻」（QualificationApplication，会变更 User.role）区分：
   * 加入只建立 OrgStaff 员工关系，申请人身份仍是普通用户。
   * 审批方为**目标团队拥有者**（单人审批），回执经「业务消息」投递。
   */

  /** 团队候选检索：按层次（服务商 / 代理商）+ 区域 + 关键词过滤可加入的团队 */
  @Get('join-targets')
  @Roles('ADMIN', 'AGENT', 'USER')
  @UseGuards(RolesGuard)
  async joinTargets(
    @Query('orgType') orgType?: string,
    @Query('regionId') regionId?: string,
    @Query('keyword') keyword?: string,
  ) {
    const wantRole = orgType === 'AGENT' ? 'AGENT' : 'SERVICE_PROVIDER';
    const rows = await this.prisma.user.findMany({
      where: { role: wantRole, status: 'ACTIVE' },
      select: {
        id: true,
        nickname: true,
        realName: true,
        phone: true,
        regionPath: true,
        providerStatus: true,
        region: { select: { name: true } },
      },
      take: 200,
    });

    // 区域过滤：选中区域的 regionPath 前缀与被检索团队互相包含其一都算命中
    // （团队档案可能只登记到市 / 省级，而用户选择了区县，反之亦然）
    let rp: string | null = null;
    if (regionId) {
      const r = await this.prisma.region.findUnique({
        where: { id: regionId },
        select: { regionPath: true },
      });
      rp = r?.regionPath ?? null;
    }
    const kw = (keyword ?? '').toString().trim();

    return rows
      .filter((u) => {
        if (rp) {
          const up = u.regionPath ?? '';
          if (!up) return false;
          if (!(up.startsWith(rp) || rp.startsWith(up))) return false;
        }
        if (kw) {
          const name = u.realName || u.nickname || '';
          if (!name.includes(kw) && !(u.phone ?? '').includes(kw)) return false;
        }
        return true;
      })
      .map((u) => ({
        id: u.id,
        name: u.realName || u.nickname || '未命名团队',
        phone: u.phone ? `${u.phone.slice(0, 3)}****${u.phone.slice(-4)}` : null,
        regionLabel: u.region?.name ?? null,
        regionPath: u.regionPath,
      }));
  }

  /** 提交加入申请 */
  @Post('join-applications')
  @Roles('ADMIN', 'AGENT', 'USER')
  @UseGuards(RolesGuard)
  async createJoinApplication(
    @Req() req: ReqUser,
    @Body()
    body: {
      userId?: string;
      orgType?: string;
      orgId?: string;
      regionPath?: string;
      regionLabel?: string;
      reason?: string;
    },
  ) {
    const id = await this.resolveUserId(body.userId, req.user);
    const target = await this.resolveTarget(id, req.user);
    if (target.role !== 'USER') {
      throw new BadRequestException('当前身份不支持加入团队（仅普通用户可申请）');
    }

    const orgType = body.orgType === 'AGENT' ? 'AGENT' : 'PROVIDER';
    const orgId = (body.orgId ?? '').toString().trim();
    if (!orgId) throw new BadRequestException('请选择要加入的团队');

    const org = await this.prisma.user.findUnique({
      where: { id: orgId },
      select: { id: true, role: true, status: true },
    });
    if (!org) throw new NotFoundException('目标团队不存在');
    if (org.role !== (orgType === 'AGENT' ? 'AGENT' : 'SERVICE_PROVIDER')) {
      throw new BadRequestException('目标团队与所选层次不匹配');
    }
    if (org.status !== 'ACTIVE') throw new BadRequestException('该团队暂不接受新成员');

    const existed = await this.prisma.orgStaff.findFirst({
      where: { orgType, orgId, userId: id },
      select: { id: true },
    });
    if (existed) throw new BadRequestException('你已是该团队成员');

    const reason = String(body.reason ?? '').trim();
    if (!reason) throw new BadRequestException('请填写申请说明');

    const dup = await this.prisma.teamJoinApplication.findFirst({
      where: { userId: id, orgType, orgId, status: 'PENDING' },
    });
    if (dup) return { ...dup, duplicated: true };

    return this.prisma.teamJoinApplication.create({
      data: {
        userId: id,
        orgType,
        orgId,
        regionPath: body.regionPath ?? null,
        regionLabel: body.regionLabel ?? null,
        reason,
      },
    });
  }

  /** 我的加入申请（含团队名 + 拒绝详情 + 业务编号） */
  @Get('join-applications')
  @Roles('ADMIN', 'AGENT', 'USER')
  @UseGuards(RolesGuard)
  async myJoinApplications(@Req() req: ReqUser, @Query('userId') userId?: string) {
    const id = await this.resolveUserId(userId, req.user);
    const items = await this.prisma.teamJoinApplication.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
    });
    const orgIds = Array.from(new Set(items.map((i) => i.orgId)));
    const orgs = await this.prisma.user.findMany({
      where: { id: { in: orgIds } },
      select: { id: true, nickname: true, realName: true, phone: true },
    });
    const map = new Map(orgs.map((o) => [o.id, o]));
    return items.map((it, i) => {
      const o = map.get(it.orgId);
      const d = new Date(it.createdAt);
      const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
      return {
        ...it,
        code: `JA-${ymd}-${(it.id || '').slice(-4).toUpperCase()}`,
        orgName: o ? o.realName || o.nickname || `${(o.phone ?? '').slice(0, 3)}****${(o.phone ?? '').slice(-4)}` : '未知团队',
      };
    });
  }

  /** 撤回入驻申请（本人自助；仅未进入终审结果态可撤） */
  @Delete('qualifications/:id')
  @Roles('ADMIN', 'AGENT', 'USER')
  @UseGuards(RolesGuard)
  async withdrawQualification(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Query('userId') userId?: string,
  ) {
    const uid = await this.resolveUserId(userId, req.user);
    const cur = await this.prisma.qualificationApplication.findFirst({ where: { id, userId: uid } });
    if (!cur) throw new NotFoundException('申请不存在或无权操作');
    if (!['FIRST_PENDING', 'FIRST_PASSED'].includes(cur.status)) {
      throw new BadRequestException('当前申请状态不可撤回');
    }
    // 软删除（原为物理 delete）：保留申请历史与审计留痕，与 JOIN 隧道 WITHDRAWN 语义一致，
    // 同时支撑「驳回后重新提交」的历史溯源（resubmitOfId）。
    await this.prisma.qualificationApplication.update({
      where: { id },
      data: { status: 'WITHDRAWN' },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: uid,
        action: 'QUALIFICATION_WITHDRAWN',
        targetType: 'QUALIFICATION_APPLICATION',
        targetId: id,
        after: { status: 'WITHDRAWN' },
      },
    });
    return { ok: true };
  }

  /** 撤回（仅 PENDING 可撤） */
  @Delete('join-applications/:id')
  @Roles('ADMIN', 'AGENT', 'USER')
  @UseGuards(RolesGuard)
  async withdrawJoinApplication(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Query('userId') userId?: string,
  ) {
    const uid = await this.resolveUserId(userId, req.user);
    const cur = await this.prisma.teamJoinApplication.findFirst({ where: { id, userId: uid } });
    if (!cur) throw new NotFoundException('申请不存在或无权操作');
    if (cur.status !== 'PENDING') throw new BadRequestException('已处理的申请不可撤回');
    await this.prisma.teamJoinApplication.update({ where: { id }, data: { status: 'WITHDRAWN' } });
    return { ok: true };
  }

  /**
   * 入驻申请初审 / 终审（运营端动作）。
   * FIRST_PENDING → FIRST_PASSED（生成「资格初审通过」通知，用户可填写资料）/ REJECTED
   * FINAL_PENDING → APPROVED / REJECTED
   */
  @Post('qualifications/:id/review')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async reviewQualification(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Body() body: { pass: boolean; final?: boolean; note?: string },
  ) {
    const app = await this.prisma.qualificationApplication.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('申请不存在');
    const note = (body.note ?? '').toString().trim() || null;
    // 驳回原因必填：无原因的驳回等于让用户无从整改，也无法在审计中追溯判定依据。
    if (!body.pass && !note) throw new BadRequestException('请填写驳回原因');

    // 代理商终审前置校验（M2 / P-F）：辖区唯一性。
    // 必须在写入申请状态**之前**拦截，否则会出现「申请已 APPROVED 但身份未落地」的不一致。
    if (body.final && body.pass && app.kind === 'agent' && app.regionPath) {
      const conflict = await this.findRegionConflict(app.regionPath, app.userId);
      if (conflict) {
        throw new BadRequestException(
          `代理辖区与既有代理商重叠（${conflict.regionPath}），同一辖区仅允许一个代理商`,
        );
      }
    }

    const status = body.final
      ? body.pass
        ? 'APPROVED'
        : 'REJECTED'
      : body.pass
        ? 'FIRST_PASSED'
        : 'REJECTED';
    const updated = await this.prisma.qualificationApplication.update({
      where: { id },
      data: {
        status,
        reviewNote: note,
        ...(body.final
          ? { finalReviewedById: req.user.id, finalReviewedAt: new Date() }
          : { firstReviewedById: req.user.id, firstReviewedAt: new Date() }),
      },
    });

    // 审计留痕：终审此前完全没有审计记录（一审有 AGENT_QUALIFICATION_FIRST_REVIEW）
    await this.prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        action: body.final
          ? 'ADMIN_QUALIFICATION_FINAL_REVIEW'
          : 'ADMIN_QUALIFICATION_FIRST_REVIEW',
        targetType: 'QUALIFICATION_APPLICATION',
        targetId: id,
        reason: note,
        after: { status },
      },
    });

    // 终审通过 → 落地资格升级（决策：入驻走总台 ADMIN 审批，通过后用户成为服务商 / 代理商，
    // 登录落点由既有 ROLE_HOME 自动切换到对应工作台）
    await this.applyQualificationResult(app, status);

    // 结果通知（此前入驻管线**没有任何审核回执**，用户只能靠刷新页面猜状态）
    await this.notifyQualificationResult(req.user, app, status, note);
    return updated;
  }

  /**
   * 入驻审核回执：以「指定接收人」消息投递（MessageScope=USER），
   * 与 JOIN 隧道 notifyJoinResult 同口径，用户在 web 端「业务消息」可见。
   */
  private async notifyQualificationResult(
    actor: JwtUser,
    app: { id: string; userId: string; kind: string },
    status: string,
    note: string | null,
  ) {
    const layer = app.kind === 'agent' ? '代理商' : '服务商';
    const code = `入驻申请 ${(app.id || '').slice(-6).toUpperCase()}`;
    const map: Record<string, { title: string; content: string }> = {
      FIRST_PASSED: {
        title: `${layer}入驻资格初审通过`,
        content: '您的入驻申请已通过辖区代理商初审，请补充完整资料后进入管理总台终审。',
      },
      APPROVED: {
        title: `${layer}入驻申请已通过`,
        content: '您的入驻申请已通过管理总台终审，资质已生效，登录后将进入对应工作台。',
      },
      REJECTED: {
        title: `${layer}入驻申请未通过`,
        content: note ? `未通过原因：${note}。请修改后重新提交。` : '您的入驻申请未通过，请修改后重新提交。',
      },
    };
    const t = map[status];
    if (!t) return;
    await this.prisma.message.create({
      data: {
        type: 'NOTICE',
        scope: 'USER',
        title: `${t.title}（${code}）`,
        content: t.content,
        status: 'PUBLISHED',
        authorId: actor.id,
        authorRole: actor.role as any,
        recipientId: app.userId,
      },
    });
  }

  /**
   * 入驻终审结果落地（SETTLE 隧道的「身份变更」环节）：
   *  - kind=provider → role=SERVICE_PROVIDER，资质状态 APPROVED，写入服务类型
   *  - kind=agent    → role=AGENT，绑定辖区 regionId / regionPath
   * 仅 APPROVED 落变更；REJECTED 仅改申请自身状态（用户仍为普通用户）。
   */
  private async applyQualificationResult(
    app: { id: string; userId: string; kind: string; serviceScopes: string[]; regionPath: string | null },
    status: string,
  ) {
    if (status !== 'APPROVED') return;

    if (app.kind === 'provider') {
      const scopes = app.serviceScopes ?? [];
      const valid = scopes.filter((s): s is any =>
        ['DESIGN', 'PHOTO', 'VENUE', 'FLORAL', 'STEWARD', 'PERFORM'].includes(s),
      );

      // —— 归属判定（M2 / P-C、P-D）——
      // 旧缺陷：终审只写 role/providerStatus/serviceRoles，不落 regionPath / agentId，
      // 导致已审服务商可能 regionPath=null，永不出现在代理商辖区列表中（agentOf 反向列表恒空）。
      const regionPath = app.regionPath ?? null;
      const agentId = regionPath ? await this.resolveAgentId(regionPath) : null;

      await this.prisma.user.update({
        where: { id: app.userId },
        data: {
          role: 'SERVICE_PROVIDER',
          providerStatus: 'APPROVED',
          ...(valid.length ? { serviceRoles: valid } : {}),
          // 固化申请区域到用户本体
          ...(regionPath ? { regionPath } : {}),
          // 受管代理商：最长前缀匹配；无辖区覆盖时留空，留待人工分配（不阻断审批）
          ...(agentId ? { agentId } : {}),
        },
      });

      // 钱包初始化：随「入驻真源收敛」从 auth.applyForProvider 迁移至此
      // （原自助升级即建钱包；现只有终审通过的服务商才是真服务商，故在此建）
      await this.prisma.providerWallet.upsert({
        where: { providerId: app.userId },
        create: { providerId: app.userId },
        update: {},
      });

      // M4：终审通过后由系统自动生成标准主合同草稿（服务商线上签署）。
      // 注意 partyA 恒为平台主体 —— 代理商**不是**签约方，避免产生错误法律外观。
      await this.ensureProviderContract(app.userId, regionPath, valid[0] ?? 'DESIGN');
      return;
    }

    // 代理商：辖区落到 User.regionId / regionPath（regionPath 为该区域的代码前缀链）
    let regionId: string | null = null;
    if (app.regionPath) {
      const region = await this.prisma.region.findFirst({
        where: { regionPath: app.regionPath },
        select: { id: true },
      });
      regionId = region?.id ?? null;
    }
    await this.prisma.user.update({
      where: { id: app.userId },
      data: {
        role: 'AGENT',
        ...(regionId ? { regionId } : {}),
        ...(app.regionPath ? { regionPath: app.regionPath } : {}),
      },
    });
  }

  /** 填写资料（原型 pg-fill 提交）：初审通过后补充完整资料进入终审 */
  @Post('qualifications/:id/fill')
  @Roles('ADMIN', 'AGENT', 'USER')
  @UseGuards(RolesGuard)
  async fillQualification(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Body()
    body: {
      userId?: string;
      applicantName?: string;
      phone?: string;
      certType?: string;
      certNo?: string;
      certExpire?: string;
      certLongTerm?: boolean;
      issuer?: string;
      attachments?: string[];
    },
  ) {
    const uid = await this.resolveUserId(body.userId, req.user);
    await this.resolveTarget(uid, req.user);
    const app = await this.prisma.qualificationApplication.findUnique({ where: { id } });
    if (!app || app.userId !== uid) throw new NotFoundException('申请不存在');
    // M3：材料提交前移 —— 允许在代理商一审之前（FIRST_PENDING）提交真实资质，
    // 让第一闸口审的是真材料而非空壳；仍兼容原「一审通过后补填」流程。
    if (!['FIRST_PENDING', 'FIRST_PASSED'].includes(app.status)) {
      throw new BadRequestException('当前阶段不可填写资料');
    }
    if (!body.applicantName?.trim()) throw new BadRequestException('请填写申请方名称');
    if (!/^\d{11}$/.test(String(body.phone ?? ''))) throw new BadRequestException('请填写 11 位手机号');
    if (!body.certNo?.trim()) throw new BadRequestException('请填写证件编号');
    if (!body.certLongTerm && !body.certExpire) throw new BadRequestException('请选择有效期或勾选长期有效');
    return this.prisma.qualificationApplication.update({
      where: { id },
      data: {
        applicantName: body.applicantName,
        phone: body.phone,
        certType: body.certType ?? null,
        certNo: body.certNo,
        certExpire: body.certExpire ?? null,
        certLongTerm: !!body.certLongTerm,
        issuer: body.issuer ?? null,
        attachments: body.attachments ?? [],
        // 一审通过（FIRST_PASSED）后补填 → 直接进入终审待审；
        // 一审前（FIRST_PENDING）提交 → 维持待一审，待代理商审完再进终审。
        ...(app.status === 'FIRST_PASSED' ? { status: 'FINAL_PENDING' } : {}),
      },
    });
  }

  /* ══════════ 归属判定辅助（M2）══════════
   * 服务商 ↔ 代理商的显式归属落点是 `User.agentId`（受管于某代理商）。
   * 历史实现仅靠 regionPath 前缀「软匹配」，agentId 全仓零写入（缺陷 P-C），
   * 且终审不固化 regionPath，导致已审服务商可能不出现在任何代理商辖区（P-D）。
   * 以下两个方法在终审落地时完成「区域 → 受管代理商」的解析与冲突拦截。
   */

  /**
   * 按「最长前缀匹配」解析受管代理商：
   * 在 role=AGENT 且 ACTIVE 且 regionPath 非空的用户中，取 regionPath 与入参
   * 精确相等或为其前缀（+ "/"）的**最长**一条 —— 最精确辖区优先。
   * 无匹配返回 null（无辖区覆盖，留待人工分配），不阻断审批。
   */
  private async resolveAgentId(regionPath: string): Promise<string | null> {
    const agents = await this.prisma.user.findMany({
      where: { role: 'AGENT', status: 'ACTIVE', regionPath: { not: null } },
      select: { id: true, regionPath: true },
    });
    const candidates = agents
      .filter(
        (a) =>
          !!a.regionPath &&
          (regionPath === a.regionPath || regionPath.startsWith(`${a.regionPath}/`)),
      )
      .sort((a, b) => (b.regionPath?.length ?? 0) - (a.regionPath?.length ?? 0));

    if (candidates.length === 0) return null;
    if (candidates.length > 1 && candidates[0].regionPath === candidates[1].regionPath) {
      // 辖区重叠属配置异常，应由代理商入驻时的 findRegionConflict 拦截；此处仅告警不阻断
      console.warn(
        `[onboarding] 辖区重叠：${candidates[0].regionPath} 存在多个代理商，归属取其中一个`,
      );
    }
    return candidates[0].id;
  }

  /**
   * 辖区冲突检测：判断新辖区与既有代理商辖区是否重叠（相等 / 互为前缀）。
   * 双向覆盖：既有辖区为新辖区的祖先（65 vs 65/6501）或后代（65/6501 vs 65）均算重叠。
   *
   * 说明：未采用 DB 唯一约束，因为 regionPath 需被同辖区多个服务商共用，
   * 硬唯一约束会误伤服务商；故在代理商入驻写入侧做应用层拦截（P-F）。
   */
  private async findRegionConflict(regionPath: string, excludeUserId: string) {
    const agents = await this.prisma.user.findMany({
      where: { role: 'AGENT', status: 'ACTIVE', regionPath: { not: null } },
      select: { id: true, regionPath: true },
    });
    return (
      agents.find(
        (a) =>
          a.id !== excludeUserId &&
          !!a.regionPath &&
          (a.regionPath === regionPath ||
            a.regionPath.startsWith(`${regionPath}/`) ||
            regionPath.startsWith(`${a.regionPath}/`)),
      ) ?? null
    );
  }

  /**
   * M4：确保服务商持有一份标准主合同（终审通过后由系统自动生成草稿，
   * 无需人工起草、代理商也不介入 —— 这才是真正的减负）。
   *
   * - 幂等：已存在 MAIN 合同则直接返回，不重复生成。
   * - 签约方：甲方恒为平台（管理总台），**代理商不作为签约方**，
   *   避免产生「代理商是合同一方」的错误法律外观。
   * - 生成后置于 AWAIT_PROVIDER_SIGN，由服务商线上发起签署；
   *   再由总台推进 APPROVING → EFFECTIVE（见 provider-console 的 advance 端点）。
   */
  private async ensureProviderContract(
    providerId: string,
    regionPath: string | null,
    serviceType: string,
  ) {
    const existing = await this.prisma.providerContract.findFirst({
      where: { providerId, type: 'MAIN' },
    });
    if (existing) return existing;

    const year = new Date().getFullYear();
    const prefix = `HT-${year}-SP`;
    const last = await this.prisma.providerContract.findMany({
      where: { contractNo: { startsWith: prefix } },
      orderBy: { contractNo: 'desc' },
      take: 1,
      select: { contractNo: true },
    });
    const seqRaw = last.length ? Number(last[0].contractNo.slice(prefix.length)) : 0;
    const seq = Number.isFinite(seqRaw) ? seqRaw + 1 : 1;
    const contractNo = `${prefix}${String(seq).padStart(3, '0')}`;

    const expireDate = new Date();
    expireDate.setFullYear(expireDate.getFullYear() + 1);

    return this.prisma.providerContract.create({
      data: {
        providerId,
        contractNo,
        type: 'MAIN',
        name: '平台服务主合同',
        partyA: '庆柬云平台（管理总台）',
        serviceType,
        region: regionPath ?? null,
        signStage: 'AWAIT_PROVIDER_SIGN',
        expireDate,
      },
    });
  }
}

/** AGENT 辖区前缀；ADMIN 返回 undefined（全量） */
function user_role_regionPrefix(user: JwtUser): string | undefined {
  return user.role === 'AGENT' && user.regionPath ? user.regionPath : undefined;
}
