import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 视察窗口作用域守卫（总台「服务商视角」）。
 *
 * 背景：运营端 apps/admin 的 ADMIN 可切到「服务商视角」视察某个服务商的内容，
 * 但后端 provider/wallet/messages 系列 GET 端点一律用 req.user（登录者自身）过滤，
 * 导致 ADMIN 视察时看到的是自己的（空）数据，与「服务商账号登录」看到的数据
 * 不一致（需求方要求两端界面与数据严格一致）。
 *
 * 本守卫仅对「只读 GET + ADMIN + 携带合法 subject」生效：
 *  - 校验 subject 确为 SERVICE_PROVIDER（否则 403，防止 ADMIN 越权视察任意用户）；
 *  - 在本请求作用域内把 req.user 的 id / role / regionPath 整体改写为被视察服务商的，
 *    使该请求在「数据作用域」上完全等价于「该服务商自己登录」——
 *    包括消息收件箱这类按 role 判定的逻辑（role===ADMIN 时后端会返回全量，
 *    改写后回落到服务商可见范围，从而与 SP 登录严格一致）；
 *  - 写操作（POST/PATCH/DELETE）与未带 subject 的 GET 一律不处理，保持 ADMIN 自身身份，
 *    避免 ADMIN 误以被视察者身份写入。
 *
 * 注意：role 改写后仅影响本请求的数据作用域；@Roles 仍含 SERVICE_PROVIDER，
 * 故端点鉴权不受影响。受守卫的端点（provider/wallet/messages）的 GET 分支均按 id 过滤，
 * 不存在「role===ADMIN 才放行」的 GET 分支，故改写安全。
 */
@Injectable()
export class InspectSubjectGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const u = req.user;
    if (!u || u.role !== 'ADMIN') return true; // 仅 ADMIN 视察窗口需要改写
    if (req.method !== 'GET') return true; // 仅只读注入，写操作保持 ADMIN 自身
    const subject = req.query?.subject;
    if (typeof subject !== 'string' || !subject) return true; // 未指定 → 回落 ADMIN 自身（空）
    const target = await this.prisma.user.findUnique({
      where: { id: subject },
      select: { id: true, role: true, regionPath: true },
    });
    if (!target || (target.role !== 'SERVICE_PROVIDER' && target.role !== 'USER' && target.role !== 'AGENT')) {
      throw new ForbiddenException('被视察对象必须是服务商、代理商或终端用户');
    }
    if (target.role === 'USER') {
      // USER 被视察对象（用户视角编辑个人作品走 provider/works 端点）：只改写 id / regionPath，
      // role 保持 ADMIN —— 本控制器端点 @Roles 含 ADMIN 但不含 USER，改写成 USER 会被 RolesGuard 拦下；
      // 数据作用域由端点内 subjectId(req, subject) 以显式 subject 解析，不依赖 role 改写。
      req.user = { ...u, id: target.id, regionPath: target.regionPath };
    } else {
      // SERVICE_PROVIDER / AGENT：整体改写为本请求作用域内的「被视察对象」身份
      // （仅 GET 生效，写操作不走到这里），使收件箱按被视察角色的作用域收敛，
      // 与「该对象自己登录」看到的消息严格一致。
      req.user = { ...u, id: target.id, role: target.role, regionPath: target.regionPath };
    }
    return true;
  }
}
