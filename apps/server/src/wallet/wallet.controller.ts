import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { InspectSubjectGuard } from '../common/guards/inspect-subject.guard';
import { WalletService } from './wallet.service';

type AuthedRequest = Express.Request & {
  user: {
    id: string;
    role: string;
  };
};

@Controller('api/wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  /** 服务商：获取自己的钱包 */
  @Get('mine')
  @UseGuards(AuthGuard('jwt'), RolesGuard, InspectSubjectGuard)
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  getMyWallet(@Req() req: AuthedRequest) {
    return this.walletService.getMyWallet(req.user.id);
  }

  /** 服务商：申请提现 */
  @Post('withdraw')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  withdraw(@Req() req: AuthedRequest, @Body('amount') amount: number) {
    return this.walletService.withdraw(req.user.id, amount);
  }

  /** 服务商：提现记录 */
  @Get('withdrawals')
  @UseGuards(AuthGuard('jwt'), RolesGuard, InspectSubjectGuard)
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  listWithdrawals(@Req() req: AuthedRequest) {
    return this.walletService.listWithdrawals(req.user.id);
  }

  /** 管理员：获取所有钱包 */
  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  listAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.walletService.listAllWallets(
      skip ? Number(skip) : 0,
      take ? Number(take) : 20,
    );
  }
}
