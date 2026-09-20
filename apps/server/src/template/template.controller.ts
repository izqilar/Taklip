import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { TemplateService } from './template.service';

type AuthedRequest = Express.Request & {
  user: { id: string; role: string };
};

@Controller('api/templates')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  // ── 公开路由 ──

  /** 公开：列出已审核通过的模板 */
  @Get()
  findAll(@Query('category') category?: string, @Query('search') search?: string) {
    return this.templateService.findAll(category, search);
  }

  /** 公开：获取所有分类 */
  @Get('categories')
  getCategories() {
    return this.templateService.getCategories();
  }

  // ── 设计师 / 管理员（静态路径必须在 :id 之前）──

  /** 服务商：列出自己提交的模板 */
  @Get('mine')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  findMine(@Req() req: AuthedRequest) {
    return this.templateService.findByAuthor(req.user.id);
  }

  /** 管理员：获取待审核模板列表 */
  @Get('pending')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  findPending() {
    return this.templateService.findPending();
  }

  /** 管理员：获取申诉列表（默认 pending） */
  @Get('appeals')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  findAppeals(@Query('status') status?: string) {
    return this.templateService.findAppeals(status);
  }

  /** 管理员：审核申诉（approve → 恢复上架；reject → 维持下架） */
  @Patch('appeals/:appealId/review')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  reviewAppeal(
    @Param('appealId') appealId: string,
    @Body() body: { decision: 'approved' | 'rejected'; adminNote?: string },
    @Req() req: AuthedRequest,
  ) {
    return this.templateService.reviewAppeal(appealId, body.decision, req.user.id, body.adminNote);
  }

  /** 管理员：模板审核台全量列表（全部状态 + 过滤 + 分页），必须先于 :id 路由注册 */
  @Get('admin')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  listAdmin(
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = page ? Number(page) : 1;
    const ps = pageSize ? Number(pageSize) : 20;
    return this.templateService.listAdmin({
      status,
      keyword,
      skip: (p - 1) * ps,
      take: ps,
    });
  }

  /** 公开：获取单个模板详情 */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.templateService.findOne(id);
  }

  /** 认证：使用模板创建新作品（仅 APPROVED 模板可用） */
  @Post(':id/use')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  useTemplate(
    @Param('id') id: string,
    @Body('title') title: string | undefined,
    @Req() req: AuthedRequest,
  ) {
    return this.templateService.useTemplate(id, req.user.id, title);
  }

  /** 服务商：提交模板到审核队列；管理员：官方模板直过 APPROVED */
  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  createByDesigner(
    @Req() req: AuthedRequest,
    @Body() body: {
      name: string;
      category: string;
      tags?: string[];
      schema: unknown;
      isOfficial?: boolean;
      cover?: string;
      price?: number;
      currency?: string;
    },
  ) {
    return this.templateService.createByDesigner(
      req.user.id,
      req.user.role as 'USER' | 'SERVICE_PROVIDER' | 'ADMIN',
      {
        name: body.name,
        category: body.category,
        tags: body.tags,
        schema: body.schema as ReturnType<typeof JSON.parse>,
        isOfficial: body.isOfficial,
        cover: body.cover,
        price: body.price,
        currency: body.currency,
      },
    );
  }

  /** 管理员：审核模板（approve / reject） */
  @Patch(':id/review')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  review(
    @Param('id') id: string,
    @Body() body: { decision: 'APPROVED' | 'REJECTED'; reviewNote?: string },
    @Req() req: AuthedRequest,
  ) {
    return this.templateService.review(id, body.decision, body.reviewNote, req.user.id);
  }

  /** 管理员：违规下架已通过的模板 */
  @Patch(':id/takedown')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  takedown(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Req() req: AuthedRequest,
  ) {
    return this.templateService.takedown(id, body.reason, req.user.id);
  }

  /** 服务商：对下架/驳回的模板提交申诉 */
  @Post(':id/appeal')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('SERVICE_PROVIDER', 'ADMIN')
  createAppeal(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Req() req: AuthedRequest,
  ) {
    return this.templateService.createAppeal(id, req.user.id, body.reason);
  }

  /**
   * 认证：购买模板（仅 APPROVED + 付费模板可用）。
   * 创建 TemplateOrder，增加 useCount，写入 ProviderWallet 收益。
   */
  @Post(':id/purchase')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('USER', 'SERVICE_PROVIDER', 'ADMIN')
  purchase(
    @Param('id') id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.templateService.purchase(id, req.user.id);
  }
}
