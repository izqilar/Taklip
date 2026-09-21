import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WalletModule } from '../wallet/wallet.module';
import { RegionModule } from '../region/region.module';
import { AuditModule } from '../audit/audit.module';
import { StaffModule } from '../console/staff.module';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [AuthModule, WalletModule, RegionModule, AuditModule, StaffModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
