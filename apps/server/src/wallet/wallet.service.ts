import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** 提现状态 */
type WithdrawalStatus = 'pending' | 'paid' | 'failed';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  /** 服务商：获取自己的钱包余额 */
  async getMyWallet(userId: string) {
    const wallet = await this.prisma.providerWallet.findUnique({
      where: { providerId: userId },
    });
    if (!wallet) {
      throw new NotFoundException('钱包不存在，请先成为服务商');
    }
    return wallet;
  }

  /** 管理员：获取某个服务商的 wallet */
  async getWalletByProvider(providerId: string) {
    const wallet = await this.prisma.providerWallet.findUnique({
      where: { providerId },
      include: {
        provider: {
          select: { id: true, nickname: true, avatar: true, phone: true },
        },
      },
    });
    if (!wallet) {
      throw new NotFoundException('该服务商不存在或暂无钱包');
    }
    return wallet;
  }

  /** 服务商：申请提现 */
  async withdraw(userId: string, amount: number) {
    if (amount <= 0) {
      throw new BadRequestException('提现金额必须大于 0');
    }

    const wallet = await this.prisma.providerWallet.findUnique({
      where: { providerId: userId },
    });
    if (!wallet) {
      throw new NotFoundException('钱包不存在，请先成为服务商');
    }

    // 金额以分为单位，转为元比较
    if (wallet.balance < amount) {
      throw new BadRequestException('可提现余额不足');
    }

    // 使用事务：扣减余额 + 记录提现
    return this.prisma.$transaction(async (tx) => {
      await tx.providerWallet.update({
        where: { providerId: userId },
        data: {
          balance: { decrement: amount },
          withdrawn: { increment: amount },
        },
      });

      return tx.withdrawal.create({
        data: {
          providerId: userId,
          walletId: wallet.id,
          amount,
          currency: 'CNY',
          status: 'pending',
        },
      });
    });
  }

  /** 服务商：提现记录列表 */
  async listWithdrawals(userId: string) {
    return this.prisma.withdrawal.findMany({
      where: { providerId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 管理员：获取所有钱包列表（分页）。
   * 返回 { items, total }，与前端 dataProvider 的分页契约一致（此前返回裸数组导致 total 失真）。
   * 嵌套 provider 字段（id/nickname/avatar/phone）与前端 wallets 页 WalletRow 对齐。
   */
  async listAllWallets(skip = 0, take = 20) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.providerWallet.findMany({
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        include: {
          provider: {
            select: { id: true, nickname: true, avatar: true, phone: true },
          },
        },
      }),
      this.prisma.providerWallet.count(),
    ]);
    return { items, total };
  }

  /**
   * 管理员：批准提现 — 仅将状态置为 paid。
   * 余额已在申请时（withdraw）扣除，此处无需再动账。
   */
  async approveWithdrawal(withdrawalId: string) {
    const w = await this.prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!w) throw new NotFoundException('提现记录不存在');
    if (w.status !== 'pending') {
      throw new BadRequestException(`该提现已处理（当前状态：${w.status}）`);
    }
    return this.prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: { status: 'paid' },
    });
  }

  /**
   * 管理员：驳回提现 — 状态置为 failed，并把申请时已扣减的余额退回钱包
   * （balance 加回 amount，withdrawn 相应减少）。
   */
  async rejectWithdrawal(withdrawalId: string) {
    const w = await this.prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!w) throw new NotFoundException('提现记录不存在');
    if (w.status !== 'pending') {
      throw new BadRequestException(`该提现已处理（当前状态：${w.status}）`);
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.withdrawal.update({
        where: { id: withdrawalId },
        data: { status: 'failed' },
      });
      await tx.providerWallet.update({
        where: { id: w.walletId },
        data: {
          balance: { increment: w.amount },
          withdrawn: { decrement: w.amount },
        },
      });
      return { id: w.id, status: 'failed' };
    });
  }
}
