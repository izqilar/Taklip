import { Module } from '@nestjs/common';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

/**
 * 服务端导出模块（Phase 3 — 导出硬门槛）
 * 只依赖全局的 PrismaModule，不引入其它业务模块，避免 DI 循环。
 */
@Module({
  controllers: [ExportController],
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}
