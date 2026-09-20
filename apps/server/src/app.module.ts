import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { RegionModule } from './region/region.module';
import { AgentModule } from './agent/agent.module';
import { ProjectModule } from './project/project.module';
import { TemplateModule } from './template/template.module';
import { PublishModule } from './publish/publish.module';
import { AssetModule } from './asset/asset.module';
import { MusicModule } from './music/music.module';
import { StatsModule } from './stats/stats.module';
import { OrderModule } from './order/order.module';
import { WalletModule } from './wallet/wallet.module';
import { TicketModule } from './ticket/ticket.module';
import { MessageModule } from './message/message.module';
import { ConsoleModule } from './console/console.module';
import { ExportModule } from './export/export.module';
import { HealthController } from './health/health.controller';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    AdminModule,
    RegionModule,
    AgentModule,
    ProjectModule,
    TemplateModule,
    PublishModule,
    AssetModule,
    MusicModule,
    StatsModule,
    OrderModule,
    WalletModule,
    TicketModule,
    MessageModule,
    ConsoleModule,
    ExportModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
