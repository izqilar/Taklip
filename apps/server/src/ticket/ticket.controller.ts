import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { TicketService } from './ticket.service';
import { CreateTicketDto } from './dto/ticket.dto';
import type { JwtUser } from '../common/types/jwt-user';

@Controller('api/tickets')
@UseGuards(AuthGuard('jwt'))
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  private user(req: Request): JwtUser {
    return req.user as JwtUser;
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreateTicketDto) {
    return this.ticketService.create(this.user(req), dto);
  }

  @Get()
  list(
    @Req() req: Request,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('escalated') escalated?: string,
  ) {
    return this.ticketService.list(this.user(req), {
      type,
      status,
      escalated: escalated === 'true',
    });
  }

  @Get(':id')
  get(@Req() req: Request, @Param('id') id: string) {
    return this.ticketService.get(this.user(req), id);
  }

  @Patch(':id/assign')
  assign(@Req() req: Request, @Param('id') id: string) {
    return this.ticketService.assignAgent(this.user(req), id);
  }

  @Patch(':id/escalate')
  escalate(@Req() req: Request, @Param('id') id: string) {
    return this.ticketService.escalate(this.user(req), id);
  }

  @Patch(':id/resolve')
  resolve(@Req() req: Request, @Param('id') id: string) {
    return this.ticketService.resolve(this.user(req), id);
  }
}
