import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtUser } from '../common/types/jwt-user';

export interface AuditInput {
  actor: JwtUser;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
}

/**
 * 统一审计留痕服务：所有审核类操作（服务商资质审批 / 资料编辑 / 提现审批）调用 log()，
 * 把「操作者 + 动作 + 被操作对象 + 审核意见 + 前后快照」持久化到 AuditLog 表，
 * 取代此前 void reason / console.log 的留痕空转。
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditInput) {
    return this.prisma.auditLog.create({
      data: {
        actorId: input.actor.id,
        actorRole: input.actor.role,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason ?? null,
        before: (input.before ?? undefined) as any,
        after: (input.after ?? undefined) as any,
      },
    });
  }
}
