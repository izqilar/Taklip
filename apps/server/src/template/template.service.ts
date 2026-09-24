import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContentSafetyService, assertRejectRedline } from '../common/services/content-safety.service';
import type { Project } from '@h5design/core';

@Injectable()
export class TemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contentSafety: ContentSafetyService,
  ) {}

  async findAll(category?: string, search?: string) {
    const where: Record<string, unknown> = {
      status: 'APPROVED', // 公开库仅展示审核通过的模板
    };
    if (category && category !== 'all') {
      where.category = category;
    }
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    return this.prisma.template.findMany({
      where,
      orderBy: { useCount: 'desc' },
      select: {
        id: true,
        name: true,
        category: true,
        tags: true,
        cover: true,
        isOfficial: true,
        useCount: true,
        price: true,
        currency: true,
        schema: true,
      },
    });
  }

  /** 管理员用：查找待审核模板 */
  async findPending() {
    return this.prisma.template.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { id: true, nickname: true, avatar: true, phone: true },
        },
      },
    });
  }

  /**
   * 管理员用：模板审核台全量列表（含全部状态），支持状态 / 关键词过滤与分页。
   * 公开 GET / 仅返回 APPROVED，不满足审核台需求。
   */
  async listAdmin(opts: {
    status?: string;
    keyword?: string;
    skip?: number;
    take?: number;
  }): Promise<{ items: any[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (opts.status && opts.status !== 'all') {
      // 允许运营端显式筛选 DRAFT（服务商草稿），其余情况默认隐藏草稿，避免草稿泄露进审核台
      where.status = opts.status;
    } else {
      where.status = { not: 'DRAFT' };
    }
    if (opts.keyword) {
      where.name = { contains: opts.keyword, mode: 'insensitive' };
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.template.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: opts.skip ?? 0,
        take: opts.take ?? 20,
        include: {
          author: {
            select: { id: true, nickname: true, avatar: true, phone: true },
          },
        },
      }),
      this.prisma.template.count({ where }),
    ]);
    return { items, total };
  }

  /** 设计师用：列出自己提交的模板 */
  async findByAuthor(authorId: string) {
    return this.prisma.template.findMany({
      where: { authorId },
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { id: true, nickname: true, avatar: true },
        },
      },
    });
  }

  /**
   * 提交新模板。
   * - 先经过内容安全扫描：命中敏感词 → 自动 REJECTED，reviewNote 列出命中的词和字段
   * - 通过扫描后：服务商(SERVICE_PROVIDER) → PENDING；管理员(ADMIN) → 直接 APPROVED（官方模板免审核）
   */
  async createByDesigner(
    authorId: string,
    role: 'USER' | 'SERVICE_PROVIDER' | 'ADMIN',
    data: {
      name: string;
      category: string;
      tags?: string[];
      schema: Project;
      isOfficial?: boolean;
      cover?: string;
      price?: number;
      currency?: string;
    },
  ) {
    // 混合审核模型：上架付费模板前，服务商必须通过资质审核（providerStatus=APPROVED）
    if ((data.price ?? 0) > 0) {
      const author = await this.prisma.user.findUnique({
        where: { id: authorId },
        select: { role: true, providerStatus: true },
      });
      if (!author || author.role !== 'SERVICE_PROVIDER') {
        throw new ForbiddenException('仅服务商可以发布付费模板');
      }
      if (author.providerStatus !== 'APPROVED') {
        throw new ForbiddenException('发布付费模板前需先通过服务商资质审核');
      }
      // M4：合同硬闸门 —— 已持有主合同的服务商，须合同签署生效后方可上架付费供给。
      // 兼容说明：主合同是本次改造新增的「终审通过后自动生成」产物，存量服务商可能尚未持有，
      // 故仅在**存在 MAIN 合同**时才强制 EFFECTIVE，避免一刀切误伤存量业务。
      const mainContract = await this.prisma.providerContract.findFirst({
        where: { providerId: authorId, type: 'MAIN' },
        select: { signStage: true, contractNo: true },
      });
      if (mainContract && mainContract.signStage !== 'EFFECTIVE') {
        throw new ForbiddenException(
          `主合同（${mainContract.contractNo}）尚未签署生效，生效后方可上架付费供给`,
        );
      }
    }

    // 内容安全扫描（v2 红线闸口：机审命中词 + 红线类别 + 命中字段）
    const scanResult = await this.contentSafety.scanContent(data.name, data.schema);

    // 命中敏感词 → 自动驳回，记录命中的词、红线类别与字段
    if (!scanResult.passed) {
      return this.prisma.template.create({
        data: {
          name: data.name,
          category: data.category,
          tags: data.tags ?? [],
          schema: data.schema as object,
          isOfficial: data.isOfficial ?? false,
          cover: data.cover,
          price: data.price ?? 0,
          currency: data.currency ?? 'CNY',
          authorId,
          status: 'REJECTED',
          reviewNote: `内容安全自动拦截：命中红线词 [${scanResult.matchedWords.join(', ')}]（类别：${scanResult.categories.join('/')}），涉及字段 [${scanResult.flaggedFields.join(', ')}]`,
          reviewedBy: null, // 系统自动拦截，无人工审核员
          reviewedAt: new Date(),
          reviewStage: 'SYSTEM',
          redlineCategory: scanResult.categories[0] ?? 'other',
        },
      });
    }

    const isAdmin = role === 'ADMIN';
    return this.prisma.template.create({
      data: {
        name: data.name,
        category: data.category,
        tags: data.tags ?? [],
        schema: data.schema as object,
        isOfficial: data.isOfficial ?? isAdmin,
        cover: data.cover,
        price: data.price ?? 0,
        currency: data.currency ?? 'CNY',
        authorId,
        status: isAdmin ? 'APPROVED' : 'PENDING',
      },
    });
  }

  /** 管理员用：审核模板（通过 / 驳回，可记录红线类别） */
  async review(templateId: string, decision: 'APPROVED' | 'REJECTED', reviewNote?: string, adminId?: string, redlineCategory?: string) {
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
    });
    if (!template) {
      throw new NotFoundException('模板不存在');
    }
    if (template.status !== 'PENDING') {
      throw new ConflictException('该模板已被审核，无法重复操作（STATE_CONFLICT）');
    }
    if (decision !== 'APPROVED' && decision !== 'REJECTED') {
      throw new BadRequestException('审核决定必须是 APPROVED 或 REJECTED');
    }
    if (decision === 'REJECTED') assertRejectRedline(redlineCategory, reviewNote);
    return this.prisma.template.update({
      where: { id: templateId },
      data: {
        status: decision,
        reviewNote: reviewNote ?? null,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        reviewStage: 'ADMIN',
        redlineCategory: decision === 'REJECTED' ? (redlineCategory ?? 'other') : null,
      },
    });
  }

  /** 代理商辖区待审模板列表（PENDING，按 author.regionPath 前缀收敛） */
  async listAgentPending(regionPath?: string) {
    const where: Record<string, unknown> = { status: 'PENDING' };
    if (regionPath) where.author = { regionPath: { startsWith: regionPath } };
    return this.prisma.template.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, nickname: true, avatar: true, phone: true, regionPath: true } },
      },
    });
  }

  /** 代理商辖区审核台全量（按 status 过滤；排除 DRAFT，避免草稿泄露） */
  async listAgentAll(
    regionPath?: string,
    status?: string,
    keyword?: string,
    skip = 0,
    take = 20,
  ): Promise<{ items: any[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (regionPath) where.author = { regionPath: { startsWith: regionPath } };
    if (status && status !== 'all') {
      where.status = status;
    } else {
      where.status = { not: 'DRAFT' };
    }
    if (keyword) where.name = { contains: keyword, mode: 'insensitive' };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.template.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          author: { select: { id: true, nickname: true, avatar: true, phone: true, regionPath: true } },
        },
      }),
      this.prisma.template.count({ where }),
    ]);
    return { items, total };
  }

  /**
   * 代理商一审（辖区闸口，决策点 6：代理一审 + 总台抽检，不双重审批）。
   * approve → APPROVED（公开）；reject → REJECTED + 红线类别（redlineCategory）。
   * 必须校验模板 author 落在代理商辖区内，否则拒绝（越权防护）。
   */
  async agentReview(
    templateId: string,
    decision: 'APPROVED' | 'REJECTED',
    reviewNote: string | undefined,
    agentId: string,
    regionPath?: string,
    redlineCategory?: string,
  ) {
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
      include: { author: { select: { regionPath: true } } },
    });
    if (!template) throw new NotFoundException('模板不存在');
    if (template.status !== 'PENDING') {
      throw new ConflictException('该模板已被审核，无法重复操作（STATE_CONFLICT）');
    }
    if (decision !== 'APPROVED' && decision !== 'REJECTED') {
      throw new BadRequestException('审核决定必须是 APPROVED 或 REJECTED');
    }
    if (regionPath && template.author?.regionPath && !template.author.regionPath.startsWith(regionPath)) {
      throw new ForbiddenException('该模板不在你的辖区范围内');
    }
    if (decision === 'REJECTED') assertRejectRedline(redlineCategory, reviewNote);
    return this.prisma.template.update({
      where: { id: templateId },
      data: {
        status: decision,
        reviewNote: reviewNote ?? null,
        reviewedBy: agentId,
        reviewedAt: new Date(),
        reviewStage: 'AGENT',
        redlineCategory: decision === 'REJECTED' ? (redlineCategory ?? 'other') : null,
      },
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.template.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('模板不存在');
    return template;
  }

  async getCategories() {
    const templates = await this.prisma.template.findMany({
      where: { status: 'APPROVED' },
      select: { category: true },
      distinct: ['category'],
    });
    return templates.map((t) => t.category);
  }

  /** 使用模板创建新作品（仅 APPROVED 模板） */
  async useTemplate(templateId: string, userId: string, title?: string) {
    const template = await this.findOne(templateId);
    if (template.status !== 'APPROVED') {
      throw new ForbiddenException('该模板尚未通过审核，无法使用');
    }

    // 深拷贝模板 schema 为新作品
    const schema = JSON.parse(
      JSON.stringify(template.schema),
    ) as Project;
    if (title) schema.title = title;

    // 更新模板使用次数
    await this.prisma.template.update({
      where: { id: templateId },
      data: { useCount: { increment: 1 } },
    });

    // 创建新作品
    return this.prisma.project.create({
      data: {
        userId,
        title: title ?? template.name,
        schema: schema as object,
      },
    });
  }

  /**
   * 购买付费模板。
   * - 仅 APPROVED 且 price > 0 的模板需购买
   * - 创建 TemplateOrder，增加 useCount
   * - 写入/更新 ProviderWallet（balance + totalIncome，平台抽成 10%）
   * - 幂等：同 buyer 已购同模板直接返回原订单
   */
  async purchase(templateId: string, buyerId: string) {
    const template = await this.findOne(templateId);
    if (template.status !== 'APPROVED') {
      throw new ForbiddenException('该模板尚未通过审核，无法购买');
    }

    // 免费模板无需购买
    if (template.price <= 0) {
      throw new BadRequestException('免费模板无需购买');
    }

    // 幂等：检查是否已购买
    const existing = await this.prisma.templateOrder.findFirst({
      where: { templateId, buyerId, status: 'paid' },
    });
    if (existing) return existing;

    const PLATFORM_FEE_RATE = 0.1;
    const amount = template.price;
    const platformFee = Math.round(amount * PLATFORM_FEE_RATE);
    const providerIncome = amount - platformFee;

    // 创建订单
    const order = await this.prisma.templateOrder.create({
      data: {
        buyerId,
        templateId,
        amount,
        platformFee,
        designerIncome: providerIncome,
        status: 'paid',
      },
    });

    // 增加模板使用次数
    await this.prisma.template.update({
      where: { id: templateId },
      data: { useCount: { increment: 1 } },
    });

    // 写入服务商钱包（如有 authorId）
    if (template.authorId) {
      await this.prisma.providerWallet.upsert({
        where: { providerId: template.authorId },
        create: {
          providerId: template.authorId,
          balance: providerIncome,
          totalIncome: providerIncome,
        },
        update: {
          balance: { increment: providerIncome },
          totalIncome: { increment: providerIncome },
        },
      });
    }

    return order;
  }

  /** 创建模板（管理用） */
  async create(data: {
    name: string;
    category: string;
    tags?: string[];
    schema: Project;
    isOfficial?: boolean;
    cover?: string;
  }) {
    return this.prisma.template.create({
      data: {
        name: data.name,
        category: data.category,
        tags: data.tags ?? [],
        schema: data.schema as object,
        isOfficial: data.isOfficial ?? false,
        cover: data.cover,
      },
    });
  }

  // ────────────────────────────────────────────
  //  违规下架与申诉（#256）
  // ────────────────────────────────────────────

  /** 管理员：对已通过的模板执行违规下架（红线强制下架，决策点：总台抽检） */
  async takedown(templateId: string, reason: string, adminId: string, redlineCategory?: string) {
    const template = await this.prisma.template.findUnique({ where: { id: templateId } });
    if (!template) {
      throw new NotFoundException('模板不存在');
    }
    if (template.status !== 'APPROVED') {
      throw new ConflictException('仅已通过(APPROVED)的模板可下架（STATE_CONFLICT）');
    }
    if (!reason.trim()) {
      throw new BadRequestException('下架原因不能为空');
    }
    return this.prisma.template.update({
      where: { id: templateId },
      data: {
        status: 'TAKEN_DOWN',
        reviewNote: `违规下架：${reason}`,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        reviewStage: 'ADMIN',
        redlineCategory: redlineCategory ?? template.redlineCategory ?? 'other',
      },
    });
  }

  /** 服务商：对下架/驳回的模板提交申诉 */
  async createAppeal(templateId: string, providerId: string, reason: string) {
    const template = await this.prisma.template.findUnique({ where: { id: templateId } });
    if (!template) {
      throw new NotFoundException('模板不存在');
    }
    if (template.authorId !== providerId) {
      throw new ForbiddenException('只能对自己的模板提交申诉');
    }
    if (template.status !== 'TAKEN_DOWN' && template.status !== 'REJECTED') {
      throw new BadRequestException('仅已下架(TAKEN_DOWN)或已驳回(REJECTED)的模板可申诉');
    }
    if (!reason.trim()) {
      throw new BadRequestException('申诉理由不能为空');
    }

    // 幂等：检查是否已有待处理的申诉
    const existing = await this.prisma.templateAppeal.findFirst({
      where: { templateId, status: 'pending' },
    });
    if (existing) {
      throw new BadRequestException('该模板已有待处理的申诉，请等待管理员审核');
    }

    return this.prisma.templateAppeal.create({
      data: {
        templateId,
        providerId,
        reason: reason.trim(),
        status: 'pending',
      },
      include: {
        template: { select: { id: true, name: true, category: true, cover: true } },
      },
    });
  }

  /** 管理员：列出申诉（默认仅 pending） */
  async findAppeals(status?: string) {
    const where: Record<string, unknown> = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    return this.prisma.templateAppeal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        template: {
          select: { id: true, name: true, category: true, cover: true, status: true },
        },
        provider: {
          select: { id: true, nickname: true, avatar: true, phone: true },
        },
      },
    });
  }

  /** 管理员：审核申诉（approve → 恢复 APPROVED；reject → 维持下架） */
  async reviewAppeal(
    appealId: string,
    decision: 'approved' | 'rejected',
    adminId: string,
    adminNote?: string,
  ) {
    const appeal = await this.prisma.templateAppeal.findUnique({
      where: { id: appealId },
      include: { template: true },
    });
    if (!appeal) {
      throw new NotFoundException('申诉记录不存在');
    }
    if (appeal.status !== 'pending') {
      throw new BadRequestException('该申诉已被处理，无法重复操作');
    }

    // 更新申诉记录
    const updated = await this.prisma.templateAppeal.update({
      where: { id: appealId },
      data: {
        status: decision,
        adminNote: adminNote ?? null,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
      include: {
        template: {
          select: { id: true, name: true, category: true, cover: true, status: true },
        },
        provider: {
          select: { id: true, nickname: true, avatar: true, phone: true },
        },
      },
    });

    // 申诉通过 → 恢复模板为 APPROVED（解封）
    if (decision === 'approved') {
      await this.prisma.template.update({
        where: { id: appeal.templateId },
        data: {
          status: 'APPROVED',
          reviewNote: `申诉通过，恢复上架。申诉理由：${appeal.reason}`,
          reviewedBy: adminId,
          reviewedAt: new Date(),
        },
      });
    }

    return updated;
  }
}
