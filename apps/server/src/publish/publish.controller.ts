import { Controller, Get, Post, Delete, Param, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { PublishService } from './publish.service';
import { buildOgHtml } from './og.util';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';

type AuthedRequest = Express.Request & {
  user: { id: string };
};

@Controller('api')
export class PublishController {
  constructor(private readonly publishService: PublishService) {}

  /** 发布作品 */
  @Post('publish/:projectId')
  @UseGuards(AuthGuard('jwt'), new RateLimitGuard(10, 60_000, 'publish'))
  publish(@Param('projectId') projectId: string, @Req() req: AuthedRequest) {
    return this.publishService.publish(projectId, req.user.id);
  }

  /** 取消发布 */
  @Delete('publish/:projectId')
  @UseGuards(AuthGuard('jwt'))
  unpublish(@Param('projectId') projectId: string, @Req() req: AuthedRequest) {
    return this.publishService.unpublish(projectId, req.user.id);
  }

  /** 公开访问已发布 H5 — 返回 Schema JSON */
  @Get('p/:publishCode')
  getPublished(@Param('publishCode') publishCode: string) {
    return this.publishService.getPublished(publishCode);
  }

  /** 服务端渲染 OG 分享卡片（供微信/QQ/Telegram 等爬虫读取） */
  @Get('og/:publishCode')
  async getOg(@Param('publishCode') publishCode: string, @Req() req: Request, @Res() res: Response) {
    try {
      const meta = await this.publishService.getOgMeta(publishCode);
      const origin = `${req.protocol}://${req.get('host')}`;
      const image = meta.image?.startsWith('http') ? meta.image : meta.image ? `${origin}${meta.image}` : undefined;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(
        buildOgHtml({
          title: meta.title,
          description: meta.description,
          image,
          url: `${origin}/p/${publishCode}`,
        }),
      );
    } catch {
      res.status(404).send('Not Found');
    }
  }
}
