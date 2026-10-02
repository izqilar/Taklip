import { Global, Module } from '@nestjs/common';
import { ContributionService } from './contribution.service';
import { AuditModule } from '../audit/audit.module';
import { MessageModule } from '../message/message.module';

/**
 * 贡献等级模块。标记为 @Global，使 ContributionService 可被任意模块的服务直接注入
 * （订单支付 / 合同生效 / 提现完成 等事件入口无需各自 import 本模块）。
 * PrismaService 由全局 PrismaModule 提供，此处无需重复 import。
 * MessageModule 提供系统通知（牌级变动定向提示）。
 */
@Global()
@Module({
  imports: [AuditModule, MessageModule],
  providers: [ContributionService],
  exports: [ContributionService],
})
export class ContributionModule {}
