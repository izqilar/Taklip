import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StatsService } from './stats.service';

type AuthedRequest = Express.Request & { user: { id: string } };

@Controller('api/stats')
@UseGuards(AuthGuard('jwt'))
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  /** 数据看板总览 */
  @Get('overview')
  overview(@Req() req: AuthedRequest) {
    return this.statsService.overview(req.user.id);
  }

  /** 当前用户作品访问量明细 */
  @Get('projects')
  projects(@Req() req: AuthedRequest) {
    return this.statsService.projects(req.user.id);
  }
}
