import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** 订单/钱包相关的角色类型 */
type UserRole = 'USER' | 'SERVICE_PROVIDER' | 'ADMIN';

/** 订单状态 */
type OrderStatus = 'paid' | 'refunded';

/** 分页参数 */
interface PaginationParams {
  skip?: number;
  take?: number;
}

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 买家：列出自己购买的模板订单（含模板基本信息）
   * 支持分页，默认 20 条。
   */
  async listMyOrders(userId: string, _role: UserRole, params: PaginationParams = {}) {
    const { skip = 0, take = 20 } = params;
    return this.prisma.templateOrder.findMany({
      where: { buyerId: userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        template: {
          select: { name: true, cover: true, category: true, price: true, currency: true },
        },
      },
    });
  }

  /** 买家：获取单个订单详情 */
  async getOrder(orderId: string, userId: string) {
    const order = await this.prisma.templateOrder.findUnique({
      where: { id: orderId },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            cover: true,
            category: true,
            price: true,
            currency: true,
          },
        },
      },
    });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.buyerId !== userId) {
      throw new ForbiddenException('您无权查看此订单');
    }
    return order;
  }

  /**
   * 服务商/管理员：查看自己模板的订单列表。
   * SERVICE_PROVIDER 只能看到自己的模板订单；ADMIN 可筛选全部。
   */
  async listTemplateOrders(templateId: string, userId: string, role: UserRole) {
    // 校验模板归属
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
      select: { authorId: true, name: true },
    });
    if (!template) throw new NotFoundException('模板不存在');

    if (role === 'SERVICE_PROVIDER') {
      if (template.authorId !== userId) {
        throw new ForbiddenException('您无权查看此模板的订单');
      }
      return this.prisma.templateOrder.findMany({
        where: { templateId },
        orderBy: { createdAt: 'desc' },
        include: {
          buyer: { select: { id: true, nickname: true, avatar: true } },
        },
      });
    }

    // ADMIN：可查看全部订单
    return this.prisma.templateOrder.findMany({
      where: { templateId },
      orderBy: { createdAt: 'desc' },
      include: {
        buyer: { select: { id: true, nickname: true, avatar: true } },
      },
    });
  }
}
