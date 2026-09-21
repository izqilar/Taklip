import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { loadStaffContext } from '../../console/staff-context';

interface JwtPayload {
  sub: string;
  phone: string;
  /** P1：组织内员工上下文快照（每次请求仍重算，这里仅作下游服务可读副本） */
  staff?: import('../../common/types/jwt-user').StaffMembership[];
}

interface UserRow {
  id: string;
  phone: string | null;
  nickname: string | null;
  avatar: string | null;
  vipLevel: number | null;
  locale: string | null;
  role: import('../../../prisma/prisma-client').Role;
  serviceRoles: import('../../../prisma/prisma-client').ServiceRole[] | null;
  providerStatus: import('../../../prisma/prisma-client').ProviderStatus | null;
  regionId: string | null;
  agentId: string | null;
  regionPath: string | null;
  status: import('../../../prisma/prisma-client').UserStatus;
  realName: string | null;
  bio: string | null;
  email: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'h5design_jwt_secret_dev',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        phone: true,
        nickname: true,
        avatar: true,
        vipLevel: true,
        locale: true,
        role: true,
        serviceRoles: true,
        providerStatus: true,
        // —— 角色管理管线（P0）：区域维度注入 req.user ——
        regionId: true,
        agentId: true,
        regionPath: true,
        status: true,
        realName: true,
        bio: true,
        email: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    // ⚠️ R-05 / R-06（P1）：账户被停用（User.status === DISABLED）必须真生效，
    // 此前 jwt.strategy 不校验，停用员工仍能凭旧 JWT 登录，红线形同虚设。
    if (user.status === 'DISABLED') {
      throw new UnauthorizedException('账户已被停用');
    }

    // P1：注入组织内员工上下文（仅 ACTIVE；DISABLED 成员已被 loadStaffContext 剔除）。
    // 每次请求重算，避免旧 JWT 携带已失效的员工关系。
    const staff = await loadStaffContext(this.prisma, user.id);

    return {
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      avatar: user.avatar,
      vipLevel: user.vipLevel ?? 0,
      locale: user.locale,
      role: user.role,
      serviceRoles: user.serviceRoles ?? [],
      providerStatus: user.providerStatus ?? undefined,
      regionId: user.regionId,
      agentId: user.agentId,
      regionPath: user.regionPath,
      status: user.status,
      realName: user.realName,
      bio: user.bio,
      email: user.email,
      staff,
    };
  }
}
