import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtUser } from '../common/types/jwt-user';
import type { Prisma } from '../../prisma/prisma-client';
import { CreateTicketDto } from './dto/ticket.dto';

const ticketInclude = {
  reporter: { select: { id: true, nickname: true, phone: true, role: true } },
  target: { select: { id: true, nickname: true, phone: true, role: true } },
  assignee: { select: { id: true, nickname: true, phone: true, role: true } },
} as const;

@Injectable()
export class TicketService {
  constructor(private readonly prisma: PrismaService) {}

  /** 按操作者角色计算数据作用域（辖区 / 自身 / 全量） */
  private scopeWhere(user: JwtUser): Prisma.TicketWhereInput {
    if (user.role === 'ADMIN') return {};
    if (user.role === 'AGENT' && user.regionPath) {
      return {
        OR: [
          { regionPath: { startsWith: user.regionPath } },
          { assigneeId: user.id },
        ],
      };
    }
    if (user.role === 'SERVICE_PROVIDER') {
      return { OR: [{ targetId: user.id }, { reporterId: user.id }] };
    }
    // USER：仅本人发起
    return { reporterId: user.id };
  }

  private matchesScope(user: JwtUser, ticket: { regionPath: string | null; assigneeId: string | null; targetId: string | null; reporterId: string }): boolean {
    if (user.role === 'ADMIN') return true;
    if (user.role === 'AGENT') {
      const inRegion = !!user.regionPath && (ticket.regionPath ?? '').startsWith(user.regionPath);
      return inRegion || ticket.assigneeId === user.id;
    }
    if (user.role === 'SERVICE_PROVIDER') {
      return ticket.targetId === user.id || ticket.reporterId === user.id;
    }
    return ticket.reporterId === user.id;
  }

  async create(user: JwtUser, dto: CreateTicketDto) {
    const reporter = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { regionPath: true },
    });
    let regionPath: string | null = reporter?.regionPath ?? null;

    if (dto.targetId) {
      const target = await this.prisma.user.findUnique({
        where: { id: dto.targetId },
        select: { id: true, regionPath: true },
      });
      if (!target) throw new NotFoundException('被反馈对象不存在');
      regionPath = target.regionPath ?? regionPath;
    }

    return this.prisma.ticket.create({
      data: {
        type: dto.type as Prisma.TicketCreateInput['type'],
        title: dto.title,
        content: dto.content,
        reporterId: user.id,
        reporterRole: user.role,
        targetId: dto.targetId ?? null,
        regionPath,
      },
      include: ticketInclude,
    });
  }

  async list(
    user: JwtUser,
    params: { type?: string; status?: string; escalated?: boolean },
  ) {
    const where: Prisma.TicketWhereInput = this.scopeWhere(user);
    if (params.type) where.type = params.type as Prisma.TicketWhereInput['type'];
    // 「待处理」= 未关闭（与侧栏角标 feedback 同口径）；其余为单一状态精确匹配
    if (params.status === 'not_closed') where.status = { not: 'CLOSED' };
    else if (params.status) where.status = params.status as Prisma.TicketWhereInput['status'];
    if (params.escalated) {
      where.status = { in: ['ESCALATED', 'ARBITRATING'] };
    }
    return this.prisma.ticket.findMany({
      where,
      include: ticketInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(user: JwtUser, id: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id }, include: ticketInclude });
    if (!ticket) throw new NotFoundException('反馈不存在');
    if (!this.matchesScope(user, ticket)) throw new ForbiddenException('无权访问该反馈');
    return ticket;
  }

  /** 代理商认领并进入协商 */
  async assignAgent(user: JwtUser, id: string) {
    if (user.role !== 'AGENT') throw new ForbiddenException('仅代理商可认领协商');
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('反馈不存在');
    if (ticket.status !== 'OPEN') throw new BadRequestException('仅待处理状态的反馈可认领');
    return this.prisma.ticket.update({
      where: { id },
      data: { status: 'NEGOTIATING', assigneeId: user.id, assigneeRole: 'AGENT' },
      include: ticketInclude,
    });
  }

  /** 代理商协商不成 → 升级转交总台 */
  async escalate(user: JwtUser, id: string) {
    if (user.role !== 'AGENT') throw new ForbiddenException('仅代理商可升级反馈');
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('反馈不存在');
    if (ticket.status !== 'OPEN' && ticket.status !== 'NEGOTIATING') {
      throw new BadRequestException('仅待处理/协商中的反馈可升级');
    }
    return this.prisma.ticket.update({
      where: { id },
      data: {
        status: 'ESCALATED',
        escalatedTo: 'ADMIN',
        escalatedAt: new Date(),
        assigneeRole: 'ADMIN',
      },
      include: ticketInclude,
    });
  }

  /** 管理总台仲裁关闭 */
  async resolve(user: JwtUser, id: string) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('仅管理总台可仲裁关闭');
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('反馈不存在');
    return this.prisma.ticket.update({
      where: { id },
      data: {
        status: 'CLOSED',
        resolvedAt: new Date(),
        assigneeRole: 'ADMIN',
        assigneeId: user.id,
      },
      include: ticketInclude,
    });
  }
}
