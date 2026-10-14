import { Module } from '@nestjs/common';
import { MarketingGroupController } from './marketing-group.controller';
import { MarketingGroupService } from './marketing-group.service';

/**
 * 服务商营销分组模块（2026-10-12）。
 * PrismaService 由全局 PrismaModule 提供（@Global，同 invitation.module 的依赖方式），
 * 本模块无需显式 imports。
 */
@Module({
  controllers: [MarketingGroupController],
  providers: [MarketingGroupService],
})
export class MarketingGroupModule {}
