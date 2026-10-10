import { Module } from '@nestjs/common';
import { InvitationController } from './invitation.controller';
import { InvitationService } from './invitation.service';
import { GuestListModule } from '../guest-list/guest-list.module';
import { ExportModule } from '../export/export.module';

/** 批量请柬渲染模块（配额/锁定 + 队列渲染 + 付费分发）——规范 §5/§8 */
@Module({
  imports: [GuestListModule, ExportModule],
  controllers: [InvitationController],
  providers: [InvitationService],
  exports: [InvitationService],
})
export class InvitationModule {}
