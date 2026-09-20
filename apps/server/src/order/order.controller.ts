import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OrderService } from './order.service';

type AuthedRequest = Express.Request & {
  user: {
    id: string;
    role: string;
  };
};

@Controller('api/orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /** 买家：列出自己的订单 */
  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  listMy(
    @Req() req: AuthedRequest,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.orderService.listMyOrders(
      req.user.id,
      req.user.role as never,
      {
        skip: skip ? Number(skip) : 0,
        take: take ? Number(take) : 20,
      },
    );
  }

  /** 买家：获取单个订单详情 */
  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  getOrder(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.orderService.getOrder(id, req.user.id);
  }

  /** 服务商/管理员：查看某个模板的订单列表 */
  @Get('template/:templateId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  listTemplateOrders(
    @Req() req: AuthedRequest,
    @Param('templateId') templateId: string,
  ) {
    return this.orderService.listTemplateOrders(
      templateId,
      req.user.id,
      req.user.role as never,
    );
  }
}
