import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../prisma/prisma-client';
import { createProject, safeMedia, buildPublishedSchema, shouldRegeneratePublishCode } from '@h5design/core';
import type { Project } from '@h5design/core';
import { randomBytes } from 'crypto';
import { assertWorkFontLicense } from '../common/font-license';

@Injectable()
export class PublishService {
  constructor(private readonly prisma: PrismaService) {}

  /** 发布作品 — 草稿原子替换线上 schema + 清草稿，首次发布生成 publishCode */
  async publish(projectId: string, userId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });
    if (!project) throw new NotFoundException('作品不存在');
    // 字体授权闸口（作品用付费字体须来自已购付费模板，业务码 6002）
    await assertWorkFontLicense(this.prisma, project, userId);

    // 方案 A draft/live：发布时以 draftSchema 为准，原子替换线上 schema 并清空草稿。
    // 发布闸口（双闸口之二）：发布前再次统一消毒，杜绝只读页 XSS 与渲染崩。
    // 取稿 + 消毒统一走 core 的 buildPublishedSchema，与运营端 publishTemplate / publishWork 同源。
    const nextSchema = buildPublishedSchema(project.draftSchema, project.schema);
    // 首次发布（之前未 published）才生成新 publishCode；重复发布沿用旧码，保持 /p/ 链接稳定。
    const publishCode = shouldRegeneratePublishCode(project.status)
      ? randomBytes(4).toString('hex')
      : project.publishCode;

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        schema: nextSchema as object,
        // 封面同样走媒体消毒（仅放通 http(s) 直链，剥离危险协议/脚本）。
        cover: project.cover ? safeMedia(project.cover) : project.cover,
        draftSchema: Prisma.DbNull,
        status: 'published',
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
}
