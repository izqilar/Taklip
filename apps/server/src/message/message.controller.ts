import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { MessageService } from './message.service';
import { CreateMessageDto, AuditMessageDto } from './dto/message.dto';
import type { JwtUser } from '../common/types/jwt-user';
import { InspectSubjectGuard } from '../common/guards/inspect-subject.guard';

@Controller('api/messages')
@UseGuards(AuthGuard('jwt'))
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  private user(req: Request): JwtUser {
    return req.user as JwtUser;
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreateMessageDto) {
    return this.messageService.create(this.user(req), dto);
  }

  /**
   * 收件箱。
   * ADMIN 在「服务商视角」视察时携带 ?subject=<服务商id>：InspectSubjectGuard 把本请求
   * 作用域改写为该服务商（id/role/regionPath），使收件箱回落到服务商可见范围，
   * 与「该服务商账号登录」看到的收件箱严格一致。
   * 注意：仅 inbox 注入 subject；audit（权威公告审核）属总台职能，保持 ADMIN 自身身份。
   */
  @Get()
  @UseGuards(InspectSubjectGuard)
  inbox(@Req() req: Request) {
    return this.messageService.inbox(this.user(req));
  }

  /** 管理总台：待审权威公告 */
  @Get('audit')
  pending(@Req() req: Request) {
    return this.messageService.pending(this.user(req));
  }

  @Patch(':id/approve')
  approve(@Req() req: Request, @Param('id') id: string) {
    return this.messageService.approve(this.user(req), id);
  }

  @Patch(':id/reject')
  reject(@Req() req: Request, @Param('id') id: string, @Body() dto: AuditMessageDto) {
    return this.messageService.reject(this.user(req), id, dto);
  }
}
