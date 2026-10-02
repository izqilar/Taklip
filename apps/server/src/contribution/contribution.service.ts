import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MessageService } from '../message/message.service';
import type { JwtUser } from '../common/types/jwt-user';
import {
  AGENT_TIERS,
  PROVIDER_TIERS,
  computeAgentTier,
  computeProviderTier,
  agentScore,
  providerScore,
  type AgentMetrics,
  type ProviderMetrics,
} from './tier-defs';

/**
 * 贡献等级服务（P-tier）
 *
 * 负责：
 *  - 按角色归集「代理商 / 服务商」的经营贡献指标；
 *  - 计算并定档（tier-defs 单一真值）；
 *  - 档位变更写入 AuditLog（action: TIER_CHANGE）；
 *  - 提供事件触发（订单支付 / 合同生效 / 提现完成）与每日批跑两种重算入口。
 *
 * 设计约束（最小改动 / 安全）：
 *  - 重算一律「读后比较、仅变更才写 + 审计」，避免无谓写库；
 *  - 事件触发入口均 fire-and-forget 且吞掉异常，绝不阻断主业务流（支付 / 审核）。
 */
@Injectable()
export class ContributionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ContributionService.name);
  // 系统操作者（批跑 / 事件触发无真实操作者时使用）
  private static readonly SYSTEM_ACTOR: JwtUser = {
    id: 'system',
    role: 'ADMIN',
    status: 'ACTIVE',
  } as unknown as JwtUser;

  private scheduler?: ReturnType<typeof setInterval>;

  // —— 事件触发延迟合并（debounce / coalesce）——
  // 同一 userId 在 debounceMs 窗口内的多次触发合并为一次重算，降低高频写库与 AuditLog 噪声。
  // 每日 03 点批跑 + 管理端手动 recompute 走 *Now 立即路径，不经过此队列。
  private readonly debounceMs = 30_000;
  private readonly maxBatch = 50;
  private pending = new Map<string, { role: 'agent' | 'provider'; id: string }>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly message: MessageService,
  ) {}

  onModuleInit() {
    // 每日批跑：每小时巡检，命中凌晨 03 点窗口即全量重算（与备份任务错峰在 03:00 之后）
    this.scheduler = setInterval(() => this.maybeDailyRecompute(), 60 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.scheduler) clearInterval(this.scheduler);
    // 停掉所有待触发定时器，并在销毁前把队列里剩余的重算立即算完（fire-and-forget，不阻塞）
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    for (const it of this.pending.values()) this.runNow(it);
    this.pending.clear();
  }

  private maybeDailyRecompute() {
    const now = new Date();
    if (now.getHours() === 3) {
      this.recomputeAllProviders().catch((e) => this.logger.error('daily provider tier recompute failed', e));
      this.recomputeAllAgents().catch((e) => this.logger.error('daily agent tier recompute failed', e));
    }
  }

  // ————————————————————————————————————————————————
  // 指标归集
  // ————————————————————————————————————————————————

  /** 代理商指标：辖区 GMV（下属用户已付订单）+ 有效下属服务商数（EFFECTIVE 合同 & APPROVED 资质） */
  async gatherAgentMetrics(agentId: string): Promise<AgentMetrics> {
    const [gmvAgg, effectiveProviders] = await Promise.all([
      this.prisma.templateOrder.aggregate({
        _sum: { amount: true },
        where: { status: 'paid', buyer: { agentId } },
      }),
      this.prisma.providerContract.count({
        where: {
          signStage: 'EFFECTIVE',
          provider: { agentId, role: 'SERVICE_PROVIDER', providerStatus: 'APPROVED' },
        },
      }),
    ]);
    return {
      gmvCents: gmvAgg._sum.amount ?? 0,
      effectiveProviders,
    };
  }

  /** 服务商指标：累计成交额 + 完单数 + 平均评分（均来自 TemplateOrder / Review） */
  async gatherProviderMetrics(providerId: string): Promise<ProviderMetrics> {
    const [gmvAgg, orderCount, ratingAgg] = await Promise.all([
      this.prisma.templateOrder.aggregate({
        _sum: { amount: true },
        where: { status: 'paid', template: { authorId: providerId } },
      }),
      this.prisma.templateOrder.count({
        where: { status: 'paid', template: { authorId: providerId } },
      }),
      this.prisma.review.aggregate({
        _avg: { rating: true },
        _count: { _all: true },
        where: { providerId },
      }),
    ]);
    return {
      gmvCents: gmvAgg._sum.amount ?? 0,
      completedOrders: orderCount,
      avgRating: ratingAgg._avg.rating ?? 0,
      reviewCount: ratingAgg._count._all ?? 0,
    };
  }

  // ————————————————————————————————————————————————
  // 单用户重算（按角色分发）
  // ————————————————————————————————————————————————

  /**
   * 事件触发入口（用户角色变动等）：按角色入队延迟合并。
   * 注：订单支付 / 合同生效 / 提现完成 三条链路直接调 recomputeAgent/recomputeProvider（同样入队）。
   */
  async recomputeUser(userId: string): Promise<void> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!u) return;
    if (u.role === 'AGENT') this.scheduleRecompute('agent', userId);
    else if (u.role === 'SERVICE_PROVIDER') this.scheduleRecompute('provider', userId);
  }

  /** 事件触发入口：代理商重算（延迟合并，返回 Promise 以兼容调用方 .catch） */
  async recomputeAgent(agentId: string): Promise<void> {
    this.scheduleRecompute('agent', agentId);
  }

  /** 事件触发入口：服务商重算（延迟合并，返回 Promise 以兼容调用方 .catch） */
  async recomputeProvider(providerId: string): Promise<void> {
    this.scheduleRecompute('provider', providerId);
  }

  // ————————————————————————————————————————————————
  // 延迟合并队列
  // ————————————————————————————————————————————————

  private scheduleRecompute(role: 'agent' | 'provider', id: string): void {
    const key = `${role}:${id}`;
    if (this.pending.has(key)) return; // 已在队列，等待窗口合并
    this.pending.set(key, { role, id });
    const timer = setTimeout(() => {
      this.timers.delete(key);
      this.flushKey(key);
    }, this.debounceMs);
    this.timers.set(key, timer);
    // 达到批量上限立即 flush 全部，避免窗口被高频事件无限叠加
    if (this.pending.size >= this.maxBatch) this.flushAll();
  }

  private flushKey(key: string): void {
    const item = this.pending.get(key);
    if (!item) return;
    this.pending.delete(key);
    this.runNow(item);
  }

  private flushAll(): void {
    const items = [...this.pending.values()];
    this.pending.clear();
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    for (const it of items) this.runNow(it);
  }

  private runNow(item: { role: 'agent' | 'provider'; id: string }): void {
    const p =
      item.role === 'agent'
        ? this.recomputeAgentNow(item.id).catch((e) => this.logger.warn(`agent ${item.id} tier recompute failed`, e))
        : this.recomputeProviderNow(item.id).catch((e) => this.logger.warn(`provider ${item.id} tier recompute failed`, e));
    void p;
  }

  /** 真实计算：代理商（被 recomputeAll / 每日批跑 / flush 调用，立即执行） */
  async recomputeAgentNow(agentId: string): Promise<void> {
    const u = await this.prisma.user.findUnique({
      where: { id: agentId },
      select: { role: true, agentTier: true },
    });
    if (!u || u.role !== 'AGENT') return;

    const m = await this.gatherAgentMetrics(agentId);
    const newTier = computeAgentTier(m);
    const score = agentScore(m);
    await this.applyTier(agentId, 'agentTier', u.agentTier, newTier, score, {
      gmvCents: m.gmvCents,
      effectiveProviders: m.effectiveProviders,
    });
  }

  /** 真实计算：服务商（被 recomputeAll / 每日批跑 / flush 调用，立即执行） */
  async recomputeProviderNow(providerId: string): Promise<void> {
    const u = await this.prisma.user.findUnique({
      where: { id: providerId },
      select: { role: true, providerStatus: true, providerTier: true },
    });
    if (!u || u.role !== 'SERVICE_PROVIDER') return;

    // 未过审服务商一律 L0（新锐），不计入等级体系
    if (u.providerStatus !== 'APPROVED') {
      if (u.providerTier !== 0) {
        await this.applyTier(providerId, 'providerTier', u.providerTier, 0, 0, { note: 'providerStatus != APPROVED' });
      }
      return;
    }

    const m = await this.gatherProviderMetrics(providerId);
    const newTier = computeProviderTier(m);
    const score = providerScore(m);
    await this.applyTier(providerId, 'providerTier', u.providerTier, newTier, score, {
      gmvCents: m.gmvCents,
      completedOrders: m.completedOrders,
      avgRating: m.avgRating,
      reviewCount: m.reviewCount,
    });
  }

  /** 统一写库 + 审计：仅档位变化才写 AuditLog */
  private async applyTier(
    userId: string,
    field: 'agentTier' | 'providerTier',
    oldTier: number,
    newTier: number,
    score: number,
    metrics: Record<string, unknown>,
  ): Promise<void> {
    if (oldTier === newTier) {
      // 档位未变也刷新评分快照，便于前端展示最新贡献
      await this.prisma.user.update({
        where: { id: userId },
        data: { tierScore: score, tierUpdatedAt: new Date() },
      });
      return;
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { [field]: newTier, tierScore: score, tierUpdatedAt: new Date() },
    });
    const defs = field === 'agentTier' ? AGENT_TIERS : PROVIDER_TIERS;
    const oldCode = defs.find((d) => d.level === oldTier)?.code ?? `L${oldTier}`;
    const newCode = defs.find((d) => d.level === newTier)?.code ?? `L${newTier}`;
    await this.audit.log({
      actor: ContributionService.SYSTEM_ACTOR,
      action: 'TIER_CHANGE',
      targetType: 'USER',
      targetId: userId,
      reason: `贡献等级 ${oldCode} → ${newCode}`,
      before: { [field]: oldTier },
      after: { [field]: newTier, tierScore: score, metrics },
    });
    this.logger.log(`tier changed user=${userId} ${field} ${oldCode}→${newCode}`);
    // 牌级变动提示（定向系统通知，fire-and-forget，失败不阻断审计/定档）
    this.sendTierNotice(userId, field, oldTier, newTier);
  }

  /** 牌级变动 → 给当事人发定向系统通知（content 用结构化 JSON，便于前端按语言渲染） */
  private sendTierNotice(
    userId: string,
    field: 'agentTier' | 'providerTier',
    oldTier: number,
    newTier: number,
  ): void {
    const role = field === 'agentTier' ? 'agent' : 'provider';
    const content = JSON.stringify({ kind: 'tier_change', role, old: oldTier, new: newTier });
    this.message
      .sendSystemNotice(userId, {
        title: '贡献等级变更通知',
        content,
        bizType: 'TIER_CHANGE',
        bizId: userId,
      })
      .catch((e) => this.logger.warn(`tier notice to ${userId} failed`, e));
  }

  // ————————————————————————————————————————————————
  // 批量重算
  // ————————————————————————————————————————————————

  async recomputeAllAgents(): Promise<number> {
    const ids = await this.prisma.user.findMany({
      where: { role: 'AGENT' },
      select: { id: true },
    });
    for (const { id } of ids) {
      await this.recomputeAgentNow(id).catch((e) => this.logger.warn(`agent ${id} tier recompute failed`, e));
    }
    return ids.length;
  }

  async recomputeAllProviders(): Promise<number> {
    const ids = await this.prisma.user.findMany({
      where: { role: 'SERVICE_PROVIDER' },
      select: { id: true },
    });
    for (const { id } of ids) {
      await this.recomputeProviderNow(id).catch((e) => this.logger.warn(`provider ${id} tier recompute failed`, e));
    }
    return ids.length;
  }

  /** 供管理端手动触发（ADMIN 守卫） */
  async recomputeAll(): Promise<{ agents: number; providers: number }> {
    const [agents, providers] = await Promise.all([this.recomputeAllAgents(), this.recomputeAllProviders()]);
    return { agents, providers };
  }

  /** 前端展示用：返回某用户的贡献指标明细 + 当前档位（只读，不写库、不审计） */
  async getTierBreakdown(userId: string): Promise<{
    role: string | null;
    tier: number;
    score: number;
    updatedAt: string | null;
    agent?: AgentMetrics;
    provider?: ProviderMetrics;
  }> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, agentTier: true, providerTier: true, tierScore: true, tierUpdatedAt: true },
    });
    if (!u) return { role: null, tier: 0, score: 0, updatedAt: null };
    if (u.role === 'AGENT') {
      const m = await this.gatherAgentMetrics(userId);
      return {
        role: u.role,
        tier: u.agentTier,
        score: u.tierScore,
        updatedAt: u.tierUpdatedAt?.toISOString() ?? null,
        agent: m,
      };
    }
    if (u.role === 'SERVICE_PROVIDER') {
      const m = await this.gatherProviderMetrics(userId);
      return {
        role: u.role,
        tier: u.providerTier,
        score: u.tierScore,
        updatedAt: u.tierUpdatedAt?.toISOString() ?? null,
        provider: m,
      };
    }
    return { role: u.role, tier: 0, score: u.tierScore, updatedAt: u.tierUpdatedAt?.toISOString() ?? null };
  }
}
