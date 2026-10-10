import { Module } from '@nestjs/common';
import { GuestListController } from './guest-list.controller';
import { GuestListService } from './guest-list.service';

/** 人员名单模块（模板下载 / 文件导入 / 在线编辑 CRUD）——规范 §9 */
@Module({
  controllers: [GuestListController],
  providers: [GuestListService],
  exports: [GuestListService],
})
export class GuestListModule {}
