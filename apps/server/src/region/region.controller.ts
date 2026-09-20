import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RegionService } from './region.service';

@Controller('api/regions')
@UseGuards(AuthGuard('jwt'))
export class RegionController {
  constructor(private readonly regionService: RegionService) {}

  /** 行政区划树（登录即可读取，供代理商辖区选择） */
  @Get('tree')
  getTree() {
    return this.regionService.getTree();
  }
}
