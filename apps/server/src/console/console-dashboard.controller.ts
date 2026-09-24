import { Controller, Get, Query, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtUser } from '../common/types/jwt-user';

type ReqUser = Express.Request & { user: JwtUser };

/** 近 N 天的时间下限（自然日零点） */
function sinceDays(n: number, now: Date = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (n - 1));
  return d;
}

/** 近 N 天日期键序列（MM-DD） */
function lastDays(n: number, now: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    keys.push(
      `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
  }
  return keys;
}

/**
 * 管理总台看板（ADMIN 全盘视角）。
 * 与 agent/provider/user 三个 console 控制器同构，单独提供总台独有的
 * KPI / 区域对比 / 流水趋势 / 代理商绩效 TOP5 / 待办计数 / 入驻审核摘要。
 */
@Controller('api/console')
@UseGuards(AuthGuard('jwt'))
export class ConsoleDashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('dashboard')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  async dashboard(@Req() _req: ReqUser) {
    const since14 = sinceDays(14);

    const [
      users,
      providers,
      pendingProviders,
      orderTotal,
      dealOrders,
      refundedOrders,
      refundAgg,
      pendingWithdrawals,
      pendingAnnouncements,
      escalatedTickets,
      revenueAgg,
      regionRows,
      trendRows,
      agents,
      reviewRows,
    ] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { role: 'USER' } }),
      this.prisma.user.count({ where: { role: 'SERVICE_PROVIDER' } }),
      this.prisma.user.count({
        where: { role: 'SERVICE_PROVIDER', providerStatus: 'PENDING' },
      }),
      this.prisma.templateOrder.count(),
      this.prisma.templateOrder.count({ where: { status: 'paid' } }),
      this.prisma.templateOrder.count({ where: { status: 'refunded' } }),
      // 退款聚合（金额 + 抽成）：用于「退款率(金额口径)」与总流水净额冲减
      this.prisma.templateOrder.aggregate({
        where: { status: 'refunded' },
        _sum: { amount: true, platformFee: true },
      }),
      this.prisma.withdrawal.count({ where: { status: 'pending' } }),
      this.prisma.message.count({ where: { status: 'PENDING' } }),
      this.prisma.ticket.count({ where: { escalatedTo: 'ADMIN' } }),
      this.prisma.templateOrder.aggregate({
        _sum: { amount: true, platformFee: true },
      }),
      // 图表①：区域经营对比 —— 按买家 regionPath 归属的区/县聚合流水与订单量
      this.prisma.templateOrder.findMany({
        select: {
          amount: true,
          buyer: {
            select: {
              regionId: true,
              regionPath: true,
              region: { select: { name: true } },
            },
          },
        },
        take: 5000,
      }),
      // 图表②：近 14 日资金流水趋势
      this.prisma.templateOrder.findMany({
        where: { createdAt: { gte: since14 } },
        select: { amount: true, createdAt: true },
        take: 5000,
      }),
      // 表①：代理商绩效 TOP5 —— 按代理商辖区前缀匹配买家流水
      this.prisma.user.findMany({
        where: { role: 'AGENT' },
        select: {
          id: true,
          nickname: true,
          realName: true,
          regionId: true,
          regionPath: true,
          region: { select: { name: true } },
        },
        take: 50,
      }),
      // 表③：服务商入驻审核摘要（最近 5 条待审）
      this.prisma.user.findMany({
        where: { role: 'SERVICE_PROVIDER', providerStatus: 'PENDING' },
        select: {
          id: true,
          nickname: true,
          realName: true,
          phone: true,
          serviceRoles: true,
          createdAt: true,
          region: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    /* ── 区域经营对比（按流水降序取前 5） ── */
    const regionMap = new Map<string, { name: string; cents: number; orders: number }>();
    for (const r of regionRows) {
      const name = r.buyer?.region?.name || '未归属';
      const cur = regionMap.get(name) ?? { name, cents: 0, orders: 0 };
      cur.cents += r.amount ?? 0;
      cur.orders += 1;
      regionMap.set(name, cur);
    }
    const regionBars = [...regionMap.values()]
      .sort((a, b) => b.cents - a.cents)
      .slice(0, 5)
      .map((r) => ({
        name: r.name,
        // 原始分，由前端按量级选择 ¥ / ¥w 展示（避免小额取整为 0）
        revenueCents: r.cents,
        orders: r.orders,
      }));

    /* ── 近 14 日趋势（缺失日补 0，单位：分） ── */
    const trendMap = new Map<string, number>();
    for (const r of trendRows) {
      const d = new Date(r.createdAt);
      const key = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      trendMap.set(key, (trendMap.get(key) ?? 0) + (r.amount ?? 0));
    }
    const trend14d = lastDays(14).map((day) => ({
      day,
      amountCents: trendMap.get(day) ?? 0,
    }));

    /* ── 代理商绩效 TOP5：按 regionPath 前缀匹配辖区流水（与 DataScopeInterceptor 同口径） ── */
    const agentTop = agents
      .map((a) => {
        const prefix = a.regionPath ?? '';
        let cents = 0;
        let cnt = 0;
        for (const r of regionRows) {
          const rp = r.buyer?.regionPath ?? '';
          if (prefix && rp.startsWith(prefix)) {
            cents += r.amount ?? 0;
            cnt += 1;
          }
        }
        return {
          id: a.id,
          name: a.nickname || a.realName || '未命名代理商',
          region: a.region?.name ?? '—',
          revenueCents: cents,
          orders: cnt,
        };
      })
      // 保留零流水代理商：避免辖区暂无订单时绩效表为空
      .sort((x, y) => y.revenueCents - x.revenueCents)
      .slice(0, 5);

    const totalPayCents = revenueAgg._sum.amount ?? 0;
    const refundCents = refundAgg._sum.amount ?? 0;
    // 平台总流水 = 总支付 − 退款（净额，退单从成交统计冲减）
    const totalRevenueCents = Math.max(0, totalPayCents - refundCents);
    const platformFeeCents = Math.max(
      0,
      (revenueAgg._sum.platformFee ?? 0) - (refundAgg._sum.platformFee ?? 0),
    );

    return {
      /* KPI */
      users,
      providers,
      pendingProviders,
      orderTotal,
      dealOrders,
      refundedOrders,
      dealRate: orderTotal ? Math.round((dealOrders / orderTotal) * 1000) / 10 : 0,
      returnRate: orderTotal ? Math.round((refundedOrders / orderTotal) * 1000) / 10 : 0,
      refundRate: totalPayCents ? Math.round((refundCents / totalPayCents) * 1000) / 10 : 0,
      pendingWithdrawals,
      totalRevenueCents,
      platformFeeCents,
      /* 图表 */
      regionBars,
      trend14d,
      /* 表 */
      agentTop,
      reviewMini: reviewRows.map((r) => ({
        id: r.id,
        name: r.nickname || r.realName || r.phone || '未命名',
        serviceRoles: r.serviceRoles,
        region: r.region?.name ?? '—',
        createdAt: r.createdAt,
      })),
      /* 待办计数 */
      todos: {
        pendingWithdrawals,
        pendingProviders,
        escalatedTickets,
        pendingAnnouncements,
      },
    };
  }

  /**
   * 侧栏菜单待办角标（原型 .mi 的「菜单名 + 统计数字」）。
   *
   * 关键契约：角标数字 = 该业务的「新增的待处理（pending / 待处理）」统计数，
   * 是对应业务表的一个【严格子集】，绝不统计「所有相关记录数（全表）」。
   * 例如：提现审核只数待打款(pending)的、模板审核只数待审(PENDING)的、
   * 评价与反馈只数未关闭(待处理)的工单——点进去看到的总数一定 ≥ 角标数。
   *
   * 作用域与 DataScopeInterceptor 同口径：
   *   ADMIN              → 全量
   *   AGENT              → regionPath 前缀匹配的辖区
   *   SERVICE_PROVIDER   → 仅与自身相关（自己的模板/订单/工单/提现）
   */
  @Get('badges')
  @Roles('ADMIN', 'AGENT', 'SERVICE_PROVIDER', 'USER')
  @UseGuards(RolesGuard)
  async badges(@Req() req: ReqUser, @Query('subject') subject?: string) {
    // 视察视角：ADMIN 带 ?subject=<被视察对象id> 时，按被视察对象的作用域统计角标，
    // 使服务商/代理商/用户视角检索到某账号后，侧栏气泡数字反映该账号的真实待办，
    // 而非当前登录管理员的全局聚合数据。无 subject（总台自身视角）时取登录者作用域。
    let me: JwtUser = req.user;
    if (subject && (req.user.role === 'ADMIN' || req.user.role === 'AGENT')) {
      const target = await this.prisma.user.findUnique({ where: { id: subject } });
      if (!target) throw new ForbiddenException('被视察对象不存在');
      // AGENT 辖区校验：被视察对象必须在其辖区内
      if (
        req.user.role === 'AGENT' &&
        req.user.regionPath &&
        !(target.regionPath ?? '').startsWith(req.user.regionPath)
      ) {
        throw new ForbiddenException('该用户不在你的辖区内');
      }
      me = target as JwtUser;
    }
    const isAdmin = me.role === 'ADMIN';
    const rp = me.role === 'AGENT' && me.regionPath ? me.regionPath : null;

    // 辖区前缀条件（仅 AGENT）
    const userRp = rp ? { regionPath: { startsWith: rp } } : {};
    // 非 ADMIN 且非 AGENT 时，收敛到与自身相关
    const selfOnly = isAdmin || rp ? {} : { id: me.id };

    const [providerReview, withdrawals, templates, feedback, messages] =
      await this.prisma.$transaction([
        // ① 服务商管理（入驻审核）：资质 PENDING（待审）的服务商 = 新增的待处理子集
        this.prisma.user.count({
          where: { ...userRp, ...selfOnly, role: 'SERVICE_PROVIDER', providerStatus: 'PENDING' },
        }),

        // ② 提现审核：status=pending（待打款）的提现 = 新增的待处理子集
        this.prisma.withdrawal.count({
          where: {
            status: 'pending',
            ...(rp
              ? { provider: { regionPath: { startsWith: rp } } }
              : isAdmin
                ? {}
                : { providerId: me.id }),
          },
        }),

        // ③ 模板审核：status=PENDING（待审）的模板 = 新增的待处理子集
        this.prisma.template.count({
          where: {
            status: 'PENDING',
            ...(rp ? { author: { regionPath: { startsWith: rp } } } : isAdmin ? {} : { authorId: me.id }),
          },
        }),

        // ④ 评价与反馈中心：仍未关闭（待处理）的工单 = 新增的待处理子集
        //    OPEN(待处理) / NEGOTIATING(协商中) / ESCALATED(已升级) / ARBITRATING(仲裁中) 均视为待处理，
        //    CLOSED 已关闭不计入——始终是「未关闭」这一严格子集，而非全表工单数。
        //    作用域与 ticket.service.scopeWhere 完全一致：
        //      ADMIN 全量；AGENT = 辖区前缀 OR 被指派给自己（防止跨辖区但指派给本代理的工单漏算）；
        //      SP/USER = 自己发起或指向自己的工单。
        this.prisma.ticket.count({
          where: {
            status: { not: 'CLOSED' },
            ...(rp
              ? { OR: [{ regionPath: { startsWith: rp } }, { assigneeId: me.id }] }
              : isAdmin
                ? {}
                : { OR: [{ reporterId: me.id }, { targetId: me.id }] }),
          },
        }),

        // ⑤ 消息中心：待审核（PENDING）的公告 = 新增的待处理子集
        //    ADMIN 看全量待审公告（权威公告审核队列）；AGENT 只看自己提交、待总台审核的公告；
        //    SP/USER 无审核权限，恒为 0（前端也不挂 badgeKey）。
        this.prisma.message.count({
          where: {
            status: 'PENDING',
            ...(isAdmin ? {} : { authorId: me.id }),
          },
        }),
      ]);

    // ⑥ 订单处理：已支付、待履约（未退款）的订单 = 服务商待处理子集（仅服务商视角有意义）
    const orders =
      isAdmin || rp
        ? 0
        : await this.prisma.templateOrder.count({
            where: { status: 'paid', template: { authorId: me.id } },
          });

    // ⑦ 用户 / 服务商视角专属角标（被视察对象或登录者为 USER / SERVICE_PROVIDER 时统计）
    //    与各自视角「通知公告 / 业务消息」列表页默认筛选口径一致（provider-console 的
    //    notices/messages 端点可见性为 GLOBAL/REGION(前缀)/OWN(targetRole=SERVICE_PROVIDER)）：
    //     - noticeUnread   ：本人可见、已发布、ANNOUNCEMENT 类型、且未读（无 MessageRead 回执）
    //     - messagePending ：本人可见、已发布、非 ANNOUNCEMENT（业务/诉求）、且未读
    //     - feedbackPending：本人发起、且未关闭的工单数（仅 USER 视角的「我的反馈·待回复」；
    //                        服务商视角的意见反馈走 feedback 待处理工单数，已在上面 ④ 统计）
    const isEndUser = me.role === 'USER' || me.role === 'SERVICE_PROVIDER';
    let noticeUnread = 0;
    let messagePending = 0;
    let feedbackPending = 0;
    // ⑧ 「团队管理」待办：本组织收到的「加入团队」在途申请数（仅服务商 / 代理商自身视角统计）
    let joinPending = 0;
    if (isEndUser) {
      const targetRole = me.role === 'USER' ? 'USER' : 'SERVICE_PROVIDER';
      const vis = this.messageVisibleWhere(me.regionPath, targetRole, me.id);
      const [nu, mp] = await this.prisma.$transaction([
        // 通知公告「未读」：已发布 + ANNOUNCEMENT + 本人可见 + 无已读回执
        this.prisma.message.count({
          where: {
            status: 'PUBLISHED',
            type: 'ANNOUNCEMENT',
            ...vis,
            NOT: { reads: { some: { userId: me.id } } },
          },
        }),
        // 业务消息「待处理」：已发布 + 非 ANNOUNCEMENT（业务/诉求）+ 本人可见 + 无已读回执
        this.prisma.message.count({
          where: {
            status: 'PUBLISHED',
            type: { not: 'ANNOUNCEMENT' },
            ...vis,
            NOT: { reads: { some: { userId: me.id } } },
          },
        }),
      ]);
      noticeUnread = nu;
      messagePending = mp;
      // 我的反馈「待回复」：仅 USER 视角（服务商意见反馈已计入 feedback 待处理工单）
      if (me.role === 'USER') {
        feedbackPending = await this.prisma.ticket.count({
          where: { reporterId: me.id, status: { not: 'CLOSED' } },
        });
      }
    }
    if (me.role === 'SERVICE_PROVIDER' || me.role === 'AGENT') {
      joinPending = await this.prisma.teamJoinApplication.count({
        where: { orgType: me.role === 'AGENT' ? 'AGENT' : 'PROVIDER', orgId: me.id, status: 'PENDING' },
      });
    }

    // ⑨ 代理商视角专属角标（v2 红线闸口 + 辖区治理）。
    //    仅当查看者为 AGENT（rp 为真，含 ADMIN 视察某代理商）时统计；其余角色恒为 0
    //    （这些 badgeKey 只挂在 AGENT 侧栏菜单上，前端 AGENT 视角才读取）。
    //    口径与各自列表页默认筛选严格一致（点进去的总数 ≥ 角标数）：
    //      - onboarding      ：辖区待审(PENDING)服务商（= 入驻审批队列）
    //      - qualification   ：辖区服务商资质待审（FIRST_PENDING 待初审 / FINAL_PENDING 待终审）
    //      - templateReview  ：本辖区待审(PENDING)模板数（新红线闸口一审队列）
    //      - serviceReview   ：本辖区待代理商审核(review_pending)的服务/作品数（v2 新上架管线）
    //      - agentComplaints ：辖区待处理（未关闭）工单数
    //      - withdrawReview  ：辖区服务商提现待初审(pending)数
    //      - agentMessages   ：辖区 REGION 作用域、待审核(PENDING)的业务消息数
    //      - investPending   ：辖区招商新申请数（招商模块尚未上线，预留为 0，待回填）
    let onboarding = 0;
    let qualification = 0;
    let templateReview = 0;
    let serviceReview = 0;
    let agentComplaints = 0;
    let withdrawReview = 0;
    let investPending = 0;
    let agentMessages = 0;
    if (rp) {
      const [onb, qual, tplRev, svcRev, comp, wdRev, msg] = await this.prisma.$transaction([
        // 入驻审批：辖区待审(PENDING)服务商数（与 providerReview 的辖区子集同口径）
        this.prisma.user.count({
          where: { ...userRp, role: 'SERVICE_PROVIDER', providerStatus: 'PENDING' },
        }),
        // 资质审核：辖区服务商资质待审（FIRST_PENDING 待初审 / FINAL_PENDING 待终审）
        this.prisma.qualificationApplication.count({
          where: { kind: 'provider', status: { in: ['FIRST_PENDING', 'FINAL_PENDING'] }, regionPath: { startsWith: rp } },
        }),
        // 模板审核：本辖区待审(PENDING)模板数
        this.prisma.template.count({
          where: { status: 'PENDING', author: { regionPath: { startsWith: rp } } },
        }),
        // 服务审核：本辖区待代理商审核(review_pending)的服务/作品数（v2 新上架管线）
        this.prisma.project.count({
          where: { reviewStatus: 'review_pending', user: { regionPath: { startsWith: rp } } },
        }),
        // 意见反馈：辖区待处理（未关闭）工单数（与 feedback 的辖区子集同口径）
        this.prisma.ticket.count({
          where: { status: { not: 'CLOSED' }, OR: [{ regionPath: { startsWith: rp } }, { assigneeId: me.id }] },
        }),
        // 提现初审：辖区服务商提现待初审(pending)数
        this.prisma.withdrawal.count({
          where: { status: 'pending', provider: { regionPath: { startsWith: rp } } },
        }),
        // 业务消息：辖区 REGION 作用域、待审核(PENDING)的业务消息数
        this.prisma.message.count({
          where: { status: 'PENDING', scope: 'REGION', regionPath: { startsWith: rp } },
        }),
      ]);
      onboarding = onb;
      qualification = qual;
      templateReview = tplRev;
      serviceReview = svcRev;
      agentComplaints = comp;
      withdrawReview = wdRev;
      agentMessages = msg;
      // 招商申请：招商模块尚未上线，暂无独立招商申请表，预留为 0
      investPending = 0;
    }

    return {
      providerReview,
      withdrawals,
      templates,
      feedback,
      messages,
      orders,
      noticeUnread,
      messagePending,
      feedbackPending,
      joinPending,
      // ── 代理商视角新增角标 ──
      onboarding,
      qualification,
      templateReview,
      serviceReview,
      agentComplaints,
      withdrawReview,
      investPending,
      agentMessages,
    };
  }

  /**
   * 用户/服务商可见消息的 Prisma where（与 User/Provider ConsoleController 的可见性同口径）。
   * 额外纳入 scope=USER 的定向消息（加入团队申请的接收 / 拒绝回执）。
   */
  private messageVisibleWhere(regionPath: string | null | undefined, targetRole: string, userId?: string) {
    const or: any[] = [{ scope: 'GLOBAL' }];
    if (regionPath) or.push({ scope: 'REGION', regionPath: { startsWith: regionPath } });
    or.push({ scope: 'OWN', targetRole });
    if (userId) or.push({ scope: 'USER', recipientId: userId });
    return { OR: or };
  }
}
