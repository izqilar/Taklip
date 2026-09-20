import { Module } from '@nestjs/common';
import { AgentConsoleController } from './agent-console.controller';
import { ProviderConsoleController } from './provider-console.controller';
import { UserConsoleController } from './user-console.controller';
import { ConsoleDashboardController } from './console-dashboard.controller';
import { FontController } from './font.controller';
import { PublishModule } from '../publish/publish.module';

/**
 * 控制台作用域端点模块（管理总台 / 代理商中心 / 服务商中心 / 用户视角监督镜像）。
 * PrismaService 为全局模块，可直接注入；各端点查询自带辖区/自身作用域，
 * 不依赖其他业务模块的 service，避免循环依赖。
 */
@Module({
  imports: [PublishModule],
  controllers: [
    AgentConsoleController,
    ProviderConsoleController,
    UserConsoleController,
    ConsoleDashboardController,
    FontController,
  ],
})
export class ConsoleModule {}
