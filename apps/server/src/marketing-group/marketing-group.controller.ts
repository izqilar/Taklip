import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MarketingGroupService } from './marketing-group.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { JwtUser } from '../common/types/jwt-user';

type AuthedRequest = Express.Request & { user: JwtUser };

/** 合法成员类型（与 service 对齐） */
const MEMBER_TYPES = ['CLIENT', 'GUEST_LIST', 'BATCH_PROJECT'];

/**
 * 服务商营销分组接口（2026-10-12）
 *
 * 权限边界：
 *  - SERVICE_PROVIDER（含其员工）自身可用；
 *  - ADMIN 仅在「用户视角」监督窗口携带 ?subject=<服务商id> / body.subject 时，
 *    以该服务商作用域读写（resolveProviderId）。
 */
@Controller('api/marketing-groups')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SERVICE_PROVIDER', 'ADMIN')
export class MarketingGroupController {
  constructor(private readonly svc: MarketingGroupService) {}

  /** 分组列表（支持 ?subject=） */
  @Get()
  list(@Req() req: AuthedRequest, @Query('subject') subject?: string) {
    const providerId = this.svc.resolveProviderId(req.user, subject);
    return this.svc.list(providerId);
  }

  /** 新建分组（body 可含 subject） */
  @Post()
  create(
    @Req() req: AuthedRequest,
    @Body() body: { name?: string; description?: string | null; scene?: string | null; sortOrder?: number; subject?: string },
  ) {
    if (!body?.name?.trim()) {
      throw new BadRequestException({ code: 'INVALID_PARAMS', message: 'name 必填' });
    }
    const providerId = this.svc.resolveProviderId(req.user, body.subject);
    return this.svc.create(providerId, body);
  }

  /** 候选成员（必须声明在 GET /:id 之前；支持 ?subject=） */
  @Get('candidates')
  candidates(
    @Req() req: AuthedRequest,
    @Query('memberType') memberType?: string,
    @Query('subject') subject?: string,
  ) {
    if (!memberType || !MEMBER_TYPES.includes(memberType)) {
      throw new BadRequestException({ code: 'INVALID_PARAMS', message: 'memberType 必填且须为 CLIENT|GUEST_LIST|BATCH_PROJECT' });
    }
    const providerId = this.svc.resolveProviderId(req.user, subject);
    return this.svc.candidates(providerId, memberType);
  }

  /** 分组详情（支持 ?subject=） */
  @Get(':id')
  get(@Req() req: AuthedRequest, @Param('id') id: string, @Query('subject') subject?: string) {
    const providerId = this.svc.resolveProviderId(req.user, subject);
    return this.svc.get(providerId, id);
  }

  /** 更新分组（body 可含 subject） */
  @Put(':id')
  update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string | null; scene?: string | null; sortOrder?: number; subject?: string },
  ) {
    const providerId = this.svc.resolveProviderId(req.user, body.subject);
    return this.svc.update(providerId, id, body);
  }

  /** 删除分组（body/query 可含 subject） */
  @Delete(':id')
  remove(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Query('subject') subjectQuery?: string,
    @Body() body?: { subject?: string },
  ) {
    const providerId = this.svc.resolveProviderId(req.user, body?.subject ?? subjectQuery);
    return this.svc.remove(providerId, id);
  }

  /** 批量添加成员（body.members 数组，body 可含 subject） */
  @Post(':id/members')
  addMembers(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { members?: { memberType: string; memberId: string }[]; subject?: string },
  ) {
    const members = body?.members ?? [];
    for (const m of members) {
      if (!m || !MEMBER_TYPES.includes(m.memberType)) {
        throw new BadRequestException({ code: 'INVALID_PARAMS', message: 'memberType 须为 CLIENT|GUEST_LIST|BATCH_PROJECT' });
      }
    }
    const providerId = this.svc.resolveProviderId(req.user, body.subject);
    return this.svc.addMembers(providerId, id, members);
  }

  /** 批量移除成员（body.memberIds 数组，body 可含 subject） */
  @Delete(':id/members')
  removeMembers(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() body: { memberIds?: string[]; subject?: string },
  ) {
    const providerId = this.svc.resolveProviderId(req.user, body.subject);
    return this.svc.removeMembers(providerId, id, body.memberIds ?? []);
  }
}
