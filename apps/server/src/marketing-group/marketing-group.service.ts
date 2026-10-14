import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtUser } from '../common/types/jwt-user';

/** 合法成员类型（圈层维度） */
const MEMBER_TYPES = ['CLIENT', 'GUEST_LIST', 'BATCH_PROJECT'] as const;
type MemberType = (typeof MEMBER_TYPES)[number];

/**
 * 服务商营销分组服务（2026-10-12，规范 §营销分组）
 *
 * 分组是服务商「圈层运营」的维度载体，可把客户(CLIENT) / 名单(GUEST_LIST) /
 * 批量请柬项目(BATCH_PROJECT) 圈进同一个分组做统一触达。
 *
 * 归属：providerId 即当前登录 SP 的 User.id；ADMIN 在「用户视角」监督窗口
 * 携带 subject 时改写为被视察对象（resolveProviderId）。
 */
@Injectable()
export class MarketingGroupService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 作用域解析：ADMIN 监督窗口把 providerId 改写为被视察对象，
   * 使其操作等价于该服务商登录；其余角色恒走自身 JWT 身份。
   */
  resolveProviderId(user: JwtUser, subject?: string): string {
    return subject && user.role === 'ADMIN' ? subject : user.id;
  }

  /** 分组列表（按 sortOrder 升序，附成员计数） */
  async list(providerId: string) {
    const rows = await this.prisma.marketingGroup.findMany({
      where: { providerId },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { members: true } } },
    });
    return rows.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      scene: g.scene,
      sortOrder: g.sortOrder,
      memberCount: g._count.members,
      updatedAt: g.updatedAt,
    }));
  }

  /** 新建分组（name 非空校验） */
  async create(
    providerId: string,
    dto: { name?: string; description?: string | null; scene?: string | null; sortOrder?: number },
  ) {
    const name = dto.name?.trim();
    if (!name) {
      throw new BadRequestException({ code: 'INVALID_PARAMS', message: 'name 必填' });
    }
    return this.prisma.marketingGroup.create({
      data: {
        providerId,
        name,
        description: dto.description ?? null,
        scene: dto.scene ?? null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  /**
   * 分组详情：附成员，逐成员 best-effort 回填 label。
   * CLIENT→ProviderClient.name；GUEST_LIST→GuestList.name；
   * BATCH_PROJECT→`请柬项目 ${templateId}`（取不到回退 memberId）。
   */
  async get(providerId: string, id: string) {
    const group = await this.prisma.marketingGroup.findFirst({
      where: { id, providerId },
      include: { members: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!group) throw new NotFoundException({ code: 'NOT_FOUND', message: '分组不存在' });
    const members = await this.resolveLabels(group.members);
    return { ...group, members };
  }

  /** 更新分组 */
  async update(
    providerId: string,
    id: string,
    dto: { name?: string; description?: string | null; scene?: string | null; sortOrder?: number },
  ) {
    const group = await this.prisma.marketingGroup.findFirst({
      where: { id, providerId },
      select: { id: true },
    });
    if (!group) throw new NotFoundException({ code: 'NOT_FOUND', message: '分组不存在' });
    return this.prisma.marketingGroup.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.scene !== undefined ? { scene: dto.scene } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
  }

  /** 删除分组（成员级联） */
  async remove(providerId: string, id: string) {
    const group = await this.prisma.marketingGroup.findFirst({
      where: { id, providerId },
      select: { id: true },
    });
    if (!group) throw new NotFoundException({ code: 'NOT_FOUND', message: '分组不存在' });
    await this.prisma.marketingGroup.delete({ where: { id } });
    return { id };
  }

  /**
   * 批量添加成员：逐条 best-effort 解析 label（同 get），
   * createMany + skipDuplicates（postgres 支持）去重，返回新增条数。
   */
  async addMembers(
    providerId: string,
    id: string,
    members: { memberType: string; memberId: string }[],
  ) {
    const group = await this.prisma.marketingGroup.findFirst({
      where: { id, providerId },
      select: { id: true },
    });
    if (!group) throw new NotFoundException({ code: 'NOT_FOUND', message: '分组不存在' });

    const valid = members.filter(
      (m) => m && MEMBER_TYPES.includes(m.memberType as MemberType) && m.memberId,
    );
    if (valid.length === 0) {
      return { count: 0 };
    }

    // 按类型聚合 memberId，批量查表回填 label
    const byType: Record<string, string[]> = {};
    for (const m of valid) {
      (byType[m.memberType] ??= []).push(m.memberId);
    }
    const maps: Record<string, Record<string, string>> = {};
    for (const [type, ids] of Object.entries(byType)) {
      const uniq = [...new Set(ids)];
      if (type === 'CLIENT') {
        const rows = await this.prisma.providerClient.findMany({
          where: { id: { in: uniq }, providerId },
          select: { id: true, name: true },
        });
        maps[type] = Object.fromEntries(rows.map((r) => [r.id, r.name]));
      } else if (type === 'GUEST_LIST') {
        const rows = await this.prisma.guestList.findMany({
          where: { id: { in: uniq }, orgId: providerId },
          select: { id: true, name: true },
        });
        maps[type] = Object.fromEntries(rows.map((r) => [r.id, r.name]));
      } else if (type === 'BATCH_PROJECT') {
        const rows = await this.prisma.batchRenderProject.findMany({
          where: { id: { in: uniq }, orgId: providerId },
          select: { id: true, templateId: true },
        });
        maps[type] = Object.fromEntries(rows.map((r) => [r.id, `请柬项目 ${r.templateId}`]));
      }
    }

    const data = valid.map((m) => ({
      groupId: id,
      memberType: m.memberType,
      memberId: m.memberId,
      label: maps[m.memberType]?.[m.memberId] ?? m.memberId,
    }));
    const result = await this.prisma.marketingGroupMember.createMany({
      data,
      skipDuplicates: true,
    });
    return { count: result.count };
  }

  /** 批量移除成员 */
  async removeMembers(providerId: string, id: string, memberIds: string[]) {
    const group = await this.prisma.marketingGroup.findFirst({
      where: { id, providerId },
      select: { id: true },
    });
    if (!group) throw new NotFoundException({ code: 'NOT_FOUND', message: '分组不存在' });
    const result = await this.prisma.marketingGroupMember.deleteMany({
      where: { groupId: id, id: { in: memberIds } },
    });
    return { count: result.count };
  }

  /**
   * 候选成员（限 ~200）：按 memberType 返回 [{id,label}]。
   * CLIENT→ProviderClient；GUEST_LIST→GuestList(orgId)；BATCH_PROJECT→BatchRenderProject(orgId)。
   */
  async candidates(providerId: string, memberType?: string) {
    if (!memberType || !MEMBER_TYPES.includes(memberType as MemberType)) {
      throw new BadRequestException({ code: 'INVALID_PARAMS', message: 'memberType 非法' });
    }
    if (memberType === 'CLIENT') {
      const rows = await this.prisma.providerClient.findMany({
        where: { providerId },
        select: { id: true, name: true },
        take: 200,
      });
      return rows.map((r) => ({ id: r.id, label: r.name }));
    }
    if (memberType === 'GUEST_LIST') {
      const rows = await this.prisma.guestList.findMany({
        where: { orgId: providerId },
        select: { id: true, name: true },
        take: 200,
      });
      return rows.map((r) => ({ id: r.id, label: r.name }));
    }
    // BATCH_PROJECT
    const rows = await this.prisma.batchRenderProject.findMany({
      where: { orgId: providerId },
      select: { id: true, templateId: true },
      take: 200,
    });
    return rows.map((r) => ({ id: r.id, label: `请柬项目 ${r.templateId}` }));
  }

  /** best-effort 回填成员 label（逐成员，按类型批量查表） */
  private async resolveLabels(members: { id: string; groupId: string; memberType: string; memberId: string; label: string | null; sortOrder: number; createdAt: Date }[]) {
    if (members.length === 0) return members;
    const byType: Record<string, string[]> = {};
    for (const m of members) {
      (byType[m.memberType] ??= []).push(m.memberId);
    }
    const maps: Record<string, Record<string, string>> = {};
    for (const [type, ids] of Object.entries(byType)) {
      const uniq = [...new Set(ids)];
      if (type === 'CLIENT') {
        const rows = await this.prisma.providerClient.findMany({
          where: { id: { in: uniq } },
          select: { id: true, name: true },
        });
        maps[type] = Object.fromEntries(rows.map((r) => [r.id, r.name]));
      } else if (type === 'GUEST_LIST') {
        const rows = await this.prisma.guestList.findMany({
          where: { id: { in: uniq } },
          select: { id: true, name: true },
        });
        maps[type] = Object.fromEntries(rows.map((r) => [r.id, r.name]));
      } else if (type === 'BATCH_PROJECT') {
        const rows = await this.prisma.batchRenderProject.findMany({
          where: { id: { in: uniq } },
          select: { id: true, templateId: true },
        });
        maps[type] = Object.fromEntries(rows.map((r) => [r.id, `请柬项目 ${r.templateId}`]));
      }
    }
    return members.map((m) => ({
      ...m,
      label: m.label ?? maps[m.memberType]?.[m.memberId] ?? m.memberId,
    }));
  }
}
