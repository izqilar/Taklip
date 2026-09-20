import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

interface Hit {
  count: number;
  resetAt: number;
}

/**
 * 轻量级内存固定窗口限流（无第三方依赖）。
 * 按「作用域 + 客户端 IP + 路由路径」计数；超过阈值返回 429 Too Many Requests。
 *
 * 适用：单实例部署的防爆破/防滥用。多实例水平扩展时应改为基于 Redis 的共享计数。
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, Hit>();

  constructor(
    private readonly limit = 10,
    private readonly windowMs = 60_000,
    private readonly scope = 'global',
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{
      ip?: string;
      socket?: { remoteAddress?: string };
      path?: string;
    }>();
    const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${this.scope}:${clientIp}:${req.path}`;
    const now = Date.now();
    const rec = this.hits.get(key);

    if (!rec || now > rec.resetAt) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
    } else {
      rec.count += 1;
      if (rec.count > this.limit) {
        throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    // 内存回收：规模过大时清理过期条目
    if (this.hits.size > 2000) {
      for (const [k, v] of this.hits) {
        if (now > v.resetAt) this.hits.delete(k);
      }
    }
    return true;
  }
}
