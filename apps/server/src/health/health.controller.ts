import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 健康检查端点：GET /api/health
 * 返回数据库（PostgreSQL）探活结果与基础状态，供监控/负载均衡/健康检查探针使用。
 * Redis 当前代码未接入，统一标记为 not_configured（见 docs/launch-checklist.md）。
 */
@Controller('api/health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    let db = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'up';
    } catch {
      db = 'down';
    }
    return {
      status: db === 'up' ? 'ok' : 'degraded',
      db,
      redis: 'not_configured',
      timestamp: new Date().toISOString(),
    };
  }
}
