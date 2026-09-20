import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Project } from '@h5design/core';
import { createProject, sanitizeSchema, effectiveSchema } from '@h5design/core';

@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: { title?: string; schema?: Project }) {
    const schema = dto.schema ?? createProject(dto.title);
    return this.prisma.project.create({
      data: {
        userId,
        title: dto.title ?? schema.title ?? '未命名作品',
        schema: schema as object,
      },
    });
  }

  async findAll(userId: string) {
    const rows = await this.prisma.project.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        cover: true,
        status: true,
        version: true,
        updatedAt: true,
        publishCode: true,
        schema: true,
        draftSchema: true,
      },
    });
    // 方案 A draft/live：列表/缩略图须与编辑器一致——优先展示草稿（若有）。
    // 否则编辑器保存后缩略图仍显示旧版 live schema，用户看到"修改没生效"。
    return rows.map((p) => ({
      ...p,
      schema: effectiveSchema(p.draftSchema, p.schema) as unknown as Project,
    }));
  }

  async findOne(id: string, userId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, userId },
    });
    if (!project) throw new NotFoundException('作品不存在');
    // 方案 A draft/live：编辑器以 draftSchema 为工作副本，发布才原子替换线上 schema。
    // 因此加载时优先返回 draftSchema（存在草稿则取草稿），并附带 hasDraft 标记。
    const effective =
      project.draftSchema && typeof project.draftSchema === 'object'
        ? project.draftSchema
        : project.schema;
    return {
      ...project,
      schema: effective as unknown as Project,
      hasDraft: !!project.draftSchema,
    };
  }

  /**
   * 保存草稿（方案 A draft/live）—— 仅写 draftSchema，不动线上 schema。
   * snapshot=true 时额外写入一份版本快照（与历史手动保存行为一致）。
   */
  async saveDraft(
    id: string,
    userId: string,
    dto: { schema?: Project; title?: string; snapshot?: boolean },
  ) {
    await this.findOne(id, userId);
    const data: { draftSchema?: object; title?: string } = {};
    // 草稿闸口（双闸口之一）：写入草稿前统一消毒，防御 web 内核未消毒或越权直写。
    if (dto.schema !== undefined) data.draftSchema = sanitizeSchema(dto.schema as unknown as Project) as object;
    if (dto.title !== undefined) data.title = dto.title;
    const updated = await this.prisma.project.update({ where: { id }, data });
    if (dto.snapshot && dto.schema) {
      await this.prisma.projectVersion.create({
        data: { projectId: id, schema: dto.schema as object },
      });
      const count = await this.prisma.projectVersion.count({ where: { projectId: id } });
      if (count > 30) {
        const old = await this.prisma.projectVersion.findMany({
          where: { projectId: id },
          orderBy: { createdAt: 'asc' },
          take: count - 30,
          select: { id: true },
        });
        await this.prisma.projectVersion.deleteMany({
          where: { id: { in: old.map((v) => v.id) } },
        });
      }
    }
    return updated;
  }

  async update(
    id: string,
    userId: string,
    dto: { title?: string; cover?: string; status?: string; schema?: Project; snapshot?: boolean },
  ) {
    await this.findOne(id, userId);
    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        title: dto.title,
        cover: dto.cover,
        status: dto.status,
        // 直接写 live schema 的路径同样过消毒闸口。
        schema: dto.schema !== undefined ? (sanitizeSchema(dto.schema) as object) : undefined,
        version: { increment: 1 },
      },
    });

    // 手动保存时创建版本快照（仅保留最近 30 个）
    if (dto.snapshot) {
      await this.prisma.projectVersion.create({
        data: { projectId: id, schema: (dto.schema ?? updated.schema) as object },
      });
      const count = await this.prisma.projectVersion.count({ where: { projectId: id } });
      if (count > 30) {
        const old = await this.prisma.projectVersion.findMany({
          where: { projectId: id },
          orderBy: { createdAt: 'asc' },
          take: count - 30,
          select: { id: true },
        });
        await this.prisma.projectVersion.deleteMany({
          where: { id: { in: old.map((v) => v.id) } },
        });
      }
    }
    return updated;
  }

  /** 版本快照列表（最新优先，不含 schema 以控制体积） */
  async listVersions(projectId: string, userId: string) {
    await this.findOne(projectId, userId);
    return this.prisma.projectVersion.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true },
    });
  }

  /** 回滚到指定版本 —— 方案 A：回滚写入草稿（draftSchema），不直接覆盖线上 schema。
   *  前端历史弹窗读取返回 schema 重新装载编辑器后，再显式保存/发布才会生效。 */
  async rollback(projectId: string, userId: string, versionId: string) {
    await this.findOne(projectId, userId);
    const version = await this.prisma.projectVersion.findFirst({
      where: { id: versionId, projectId },
    });
    if (!version) throw new NotFoundException('版本不存在');
    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        draftSchema: version.schema as object,
      },
      select: { id: true, draftSchema: true },
    });
    return {
      id: updated.id,
      schema: updated.draftSchema as unknown as Project,
    };
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.project.delete({ where: { id } });
  }
}
