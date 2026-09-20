import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface JwtPayload {
  sub: string;
  phone: string;
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
        pendingServiceRoles: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    return user;
  }
}
