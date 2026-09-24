import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../prisma/prisma-client';
import { createProject, safeMedia, buildPublishedSchema, shouldRegeneratePublishCode } from '@h5design/core';
import type { Project } from '@h5design/core';
import { randomBytes } from 'crypto';
import { assertWorkFontLicense } from '../common/font-license';
import { ContentSafetyService, assertRejectRedline } from '../common/services/content-safety.service';

@Injectable()
export class PublishService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contentSafety: ContentSafetyService,
  ) {}

  /** 发布作品 — 草稿原子替换线上 schema + 清草稿，首次发布生成 publishCode
   * v2 红线闸口：服务商(SERVICE_PROVIDER)上架须过代理商审核（机审→待审/自动驳回，不公开）；
   * 终端用户/总台直发公开（沿用旧行为）。
   */
  async publish(projectId: string, userId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      include: { user: { select: { role: true, regionPath: true } } },
    });
    if (!project) throw new NotFoundException('作品不存在');
    // 字体授权闸口（作品用付费字体须来自已购付费模板，业务码 6002）
    await assertWorkFontLicense(this.prisma, project, userId);

    // 方案 A draft/live：发布时以 draftSchema 为准，原子替换线上 schema 并清空草稿。
    const nextSchema = buildPublishedSchema(project.draftSchema, project.schema);
    // 首次发布（之前未 published）才生成新 publishCode；重复发布沿用旧码，保持 /p/ 链接稳定。
    const publishCode = shouldRegeneratePublishCode(project.status)
      ? randomBytes(4).toString('hex')
      : project.publishCode;

    const isProvider = project.user?.role === 'SERVICE_PROVIDER';
    if (isProvider) {
      // 红线机审：命中即自动驳回（不公开，回到草稿并标记 rejected + 红线类别）
      const scan = await this.contentSafety.scanContent(project.title, nextSchema);
      if (!scan.passed) {
        const rejected = await this.prisma.project.update({
          where: { id: projectId },
          data: {
            schema: nextSchema as object,
            cover: project.cover ? safeMedia(project.cover) : project.cover,
            draftSchema: Prisma.DbNull,
            status: 'draft',
            reviewStatus: 'rejected',
            reviewedAt: new Date(),
            reviewStage: 'SYSTEM',
            redlineCategory: scan.categories[0] ?? 'other',
            reviewNote: `内容安全自动拦截：命中红线词 [${scan.matchedWords.join(', ')}]（${scan.categories.join('/')}），字段 [${scan.flaggedFields.join(', ')}]`,
            version: { increment: 1 },
          },
          select: { id: true, title: true, status: true, reviewStatus: true },
        });
        return { ...rejected, url: null, needsReview: true, autoRejected: true };
      }
      // 机审通过 → 进入待代理商审核（不公开，对外不可见/不可购买）
      const pending = await this.prisma.project.update({
        where: { id: projectId },
        data: {
          schema: nextSchema as object,
          cover: project.cover ? safeMedia(project.cover) : project.cover,
          draftSchema: Prisma.DbNull,
          status: 'review_pending',
          reviewStatus: 'review_pending',
          publishCode,
          version: { increment: 1 },
        },
        select: { id: true, title: true, status: true, reviewStatus: true, publishCode: true },
      });
      return { ...pending, url: null, needsReview: true };
    }

    // 非服务商（终端用户 / 总台）：直接公开
    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        schema: nextSchema as object,
        cover: project.cover ? safeMedia(project.cover) : project.cover,
        draftSchema: Prisma.DbNull,
        status: 'published',
        reviewStatus: 'approved',
        publishCode,
        version: { increment: 1 },
      },
      select: {
        id: true,
        title: true,
        status: true,
        publishCode: true,
      },
    });

    return {
      ...updated,
      url: `/p/${publishCode}`,
    };
  }

  /** 通过 publishCode 获取已发布作品的 Schema */
  async getPublished(publishCode: string) {
    const project = await this.prisma.project.findFirst({
      where: { publishCode, status: 'published' },
      select: {
        id: true,
        title: true,
        schema: true,
        publishCode: true,
      },
    });
    if (!project) throw new NotFoundException('H5 页面不存在或已下线');

    // 访问量自增（公开访问每次 +1）。用原生 SQL 避免触发 updatedAt 变更。
    await this.prisma.$executeRawUnsafe(
      'UPDATE "Project" SET "viewCount" = "viewCount" + 1 WHERE "publishCode" = $1 AND "status" = \'published\'',
      publishCode,
    );

    let schema: Project;
    if (project.schema && typeof project.schema === 'object') {
      schema = project.schema as unknown as Project;
    } else {
      schema = createProject(project.title);
    }

    return {
      title: project.title,
      schema,
    };
  }

  /** 取消发布 */
  async unpublish(projectId: string, userId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });
    if (!project) throw new NotFoundException('作品不存在');

    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        status: 'draft',
        publishCode: null,
      },
    });
  }

  /** 获取 OG 分享元信息（标题 / 描述 / 封面），供服务端渲染分享卡片 */
  async getOgMeta(publishCode: string) {
    const project = await this.prisma.project.findFirst({
      where: { publishCode, status: 'published' },
      select: { title: true, cover: true },
    });
    if (!project) throw new NotFoundException('H5 页面不存在或已下线');

    return {
      title: project.title || '庆柬云 H5',
      description: `用庆柬云制作的 H5：${project.title || ''}`.trim(),
      image: project.cover ?? undefined,
    };
  }

  /* ════════════════ 内容审核 · 作品(服务)审核（红线闸口 · 代理一审） ════════════════ */

  /** 代理商辖区待审作品（服务商发布，reviewStatus=review_pending） */
  async listAgentPendingProjects(regionPath?: string) {
    const where: Record<string, unknown> = { reviewStatus: 'review_pending' };
    if (regionPath) where.user = { regionPath: { startsWith: regionPath } };
    return this.prisma.project.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: { user: { select: { id: true, nickname: true, phone: true, regionPath: true } } },
    });
  }

  /** 代理商辖区作品审核台（仅服务商作品，按 reviewStatus 过滤 + 分页） */
  async listAgentAllProjects(
    regionPath?: string,
    reviewStatus?: string,
    keyword?: string,
    skip = 0,
    take = 20,
  ): Promise<{ items: any[]; total: number }> {
    const where: Record<string, unknown> = {
      user: { role: 'SERVICE_PROVIDER', ...(regionPath ? { regionPath: { startsWith: regionPath } } : {}) },
    };
    if (reviewStatus && reviewStatus !== 'all') where.reviewStatus = reviewStatus;
    if (keyword) where.title = { contains: keyword, mode: 'insensitive' };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
        include: { user: { select: { id: true, nickname: true, phone: true, regionPath: true } } },
      }),
      this.prisma.project.count({ where }),
    ]);
    return { items, total };
  }

  /**
   * 代理商一审作品（辖区闸口，决策点 6/7）。
   * approve → 公开(published + approved)；reject → 回草稿(rejected) 待 SP 整改重发，并记录红线类别。
   */
  async agentReviewProject(
    projectId: string,
    decision: 'APPROVED' | 'REJECTED',
    reviewNote: string | undefined,
    agentId: string,
    regionPath?: string,
    redlineCategory?: string,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId },
      include: { user: { select: { regionPath: true, role: true } } },
    });
    if (!project) throw new NotFoundException('作品不存在');
    if (project.reviewStatus !== 'review_pending') {
      throw new ConflictException('该作品不在待审状态（STATE_CONFLICT）');
    }
    if (decision !== 'APPROVED' && decision !== 'REJECTED') {
      throw new BadRequestException('审核决定必须是 APPROVED 或 REJECTED');
    }
    if (regionPath && project.user?.regionPath && !project.user.regionPath.startsWith(regionPath)) {
      throw new ForbiddenException('该作品不在你的辖区范围内');
    }
    if (decision === 'REJECTED') assertRejectRedline(redlineCategory, reviewNote);
    if (decision === 'APPROVED') {
      return this.prisma.project.update({
        where: { id: projectId },
        data: {
          status: 'published',
          reviewStatus: 'approved',
          reviewedBy: agentId,
          reviewedAt: new Date(),
          reviewStage: 'AGENT',
          reviewNote: reviewNote ?? null,
        },
      });
    }
    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        status: 'draft',
        reviewStatus: 'rejected',
        reviewedBy: agentId,
        reviewedAt: new Date(),
        reviewStage: 'AGENT',
        redlineCategory: redlineCategory ?? 'other',
        reviewNote: reviewNote ?? null,
      },
    });
  }
}
