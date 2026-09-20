import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtUser } from '../common/types/jwt-user';
import type { Prisma } from '../../prisma/prisma-client';
import { CreateMessageDto, AuditMessageDto } from './dto/message.dto';

const messageInclude = {
  author: { select: { id: true, nickname: true, phone: true, role: true } },
} as const;

@Injectable()
export class MessageService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: JwtUser, dto: CreateMessageDto) {
    // 角色发布约束
    if (user.role === 'SERVICE_PROVIDER' && dto.type !== 'NOTICE') {
      throw new BadRequestException('服务商仅可发送一般消息');
    }
    if (user.role === 'AGENT' && !['ANNOUNCEMENT', 'NOTICE'].includes(dto.type)) {
      throw new BadRequestException('代理商仅可发送一般消息或权威公告');
    }
    if (user.role === 'USER') {
      throw new ForbiddenException('Web 端用户中心发布消息，管理后台不接受用户直发');
    }

    let regionPath: string | null = null;
    if (dto.scope === 'REGION') {
      if (user.role === 'AGENT') {
        regionPath = user.regionPath ?? null; // 代理商强制自身辖区
      } else if (user.role === 'ADMIN') {
        regionPath = dto.regionPath ?? null;
      } else {
        throw new BadRequestException('无权发布区域消息');
      }
    }

    if (dto.scope === 'OWN' && !dto.targetRole) {
      throw new BadRequestException('指定接收对象需选择目标角色');
    }

    // 代理商发的权威公告 → 进入待审；其余直发
    const isPending = user.role === 'AGENT' && dto.type === 'ANNOUNCEMENT';

    return this.prisma.message.create({
      data: {
        type: dto.type as Prisma.MessageCreateInput['type'],
        scope: dto.scope as Prisma.MessageCreateInput['scope'],
        title: dto.title,
        content: dto.content,
        authorId: user.id,
        authorRole: user.role,
        regionPath,
        targetRole: dto.scope === 'OWN' ? (dto.targetRole as Prisma.MessageCreateInput['targetRole']) : null,
        status: isPending ? 'PENDING' : 'PUBLISHED',
      },
      include: messageInclude,
    });
  }

  /** 收件箱：返回对当前用户可见的已发布消息 */
  async inbox(user: JwtUser) {
    const all = await this.prisma.message.findMany({
      where: { status: 'PUBLISHED' },
      include: messageInclude,
      orderBy: { createdAt: 'desc' },
    });
    if (user.role === 'ADMIN') return all; // 总台可见全部已发布
    return all.filter((m) => this.visibleTo(user, m));
  }

  /** 管理总台：待审权威公告队列 */
  async pending(user: JwtUser) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('仅管理总台可审核');
    return this.prisma.message.findMany({
      where: { status: 'PENDING' },
      include: messageInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(user: JwtUser, id: string) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('仅管理总台可审核');
    const msg = await this.prisma.message.findUnique({ where: { id } });
    if (!msg || msg.status !== 'PENDING') throw new ConflictException('该消息不在待审状态，无法重复审核（STATE_CONFLICT）');
    return this.prisma.message.update({
      where: { id },
      data: { status: 'PUBLISHED', approvedBy: user.id, approvedAt: new Date() },
      include: messageInclude,
    });
  }

  async reject(user: JwtUser, id: string, dto: AuditMessageDto) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('仅管理总台可审核');
    const msg = await this.prisma.message.findUnique({ where: { id } });
    if (!msg || msg.status !== 'PENDING') throw new ConflictException('该消息不在待审状态，无法重复审核（STATE_CONFLICT）');
    return this.prisma.message.update({
      where: { id },
      data: { status: 'REJECTED', rejectNote: dto.note ?? null },
      include: messageInclude,
    });
  }

  private visibleTo(
    user: JwtUser,
    m: { scope: string; regionPath: string | null; targetRole: string | null },
  ): boolean {
    if (m.scope === 'GLOBAL') return true;
    if (m.scope === 'REGION') {
      return !!user.regionPath && !!m.regionPath && user.regionPath.startsWith(m.regionPath);
    }
    if (m.scope === 'OWN') {
      return m.targetRole === user.role;
    }
    return false;
  }
}
