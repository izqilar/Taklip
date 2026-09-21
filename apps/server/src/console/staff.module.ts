import { Module } from '@nestjs/common';
import { StaffService } from './staff.service';

/**
 * 组织内员工模块。
 * PrismaModule 是 @Global，此处无需重复导入。
 * ConsoleModule（服务商 / 代理商层）与 AdminModule（总台层）都 import 本模块，
 * 复用同一套岗位池校验与红线裁剪逻辑（文档 §4/§9）。
 */
@Module({
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
