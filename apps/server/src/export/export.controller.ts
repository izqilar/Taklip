import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { ExportService, ExportImageFormat, ExportMode, ExportSource } from './export.service';

type AuthedRequest = Express.Request & { user: { id: string; role?: string } };

/**
 * 服务端导出接口（导出硬门槛的唯一入口）
 *
 * - POST /api/export/prepare   准备导出：做字体授权判定，返回一次性 token 与授权结果
 * - POST /api/export/image     服务端渲染导出图片（按授权决定分辨率/水印），返回二进制
 * - POST /api/export/video     服务端渲染导出视频（逐页 + ffmpeg 合成），返回二进制
 * - GET  /api/export/payload   渲染页回调，凭 token 换取 payload（仅限服务端渲染页使用）
 */
@Controller('api/export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  /** 导出准备：授权判定 + 颁发凭证 */
  @Post('prepare')
  @UseGuards(AuthGuard('jwt'))
  async prepare(
    @Req() req: AuthedRequest,
    @Body() body: { projectId?: string; source?: ExportSource; subject?: string },
    @Query('subject') subject?: string,
  ) {
    if (!body?.projectId) throw new BadRequestException('projectId 必填');
    return this.exportService.prepare(
      body.projectId,
      this.effectiveUserId(req, subject ?? body.subject),
      body.source ?? 'draft',
    );
  }

  /** 渲染页拉取 payload（token 即为凭证，短期有效） */
  @Get('payload')
  getPayload(@Query('token') token?: string) {
    if (!token) throw new BadRequestException('token 必填');
    const payload = this.exportService.getPayload(token);
    if (!payload) throw new BadRequestException('导出凭证无效或已过期');
    return payload;
  }

  /** 导出图片（服务端渲染，返回二进制流） */
  @Post('image')
  @UseGuards(AuthGuard('jwt'))
  async exportImage(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      token?: string;
      projectId?: string;
      source?: ExportSource;
      page?: number;
      mode?: ExportMode;
      format?: ExportImageFormat;
      filename?: string;
      subject?: string;
    },
    @Query('subject') subject?: string,
    @Res() res?: Response,
  ) {
    const token = await this.resolveToken(req, body, subject);
    const { buffer, contentType } = await this.exportService.renderImage({
      token,
      page: body.page ?? 0,
      mode: body.mode ?? 'current',
      format: body.format ?? 'png',
    });
    this.sendBinary(res!, buffer, contentType, body.filename ?? this.imageName(body.format));
  }

  /** 导出视频（服务端逐页渲染 + ffmpeg 合成，返回二进制流） */
  @Post('video')
  @UseGuards(AuthGuard('jwt'))
  async exportVideo(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      token?: string;
      projectId?: string;
      source?: ExportSource;
      secondsPerPage?: number;
      filename?: string;
      subject?: string;
    },
    @Query('subject') subject?: string,
    @Res() res?: Response,
  ) {
    const token = await this.resolveToken(req, body, subject);
    const { buffer, contentType } = await this.exportService.renderVideo({
      token,
      secondsPerPage: body.secondsPerPage ?? 3,
    });
    this.sendBinary(res!, buffer, contentType, body.filename ?? 'export.mp4');
  }

  /** 允许直接传 token（前端先 prepare 拿到授权结果），也允许只传 projectId（后端代 prepare） */
  private async resolveToken(
    req: AuthedRequest,
    body: { token?: string; projectId?: string; source?: ExportSource; subject?: string },
    subject?: string,
  ): Promise<string> {
    if (body.token) return body.token;
    if (body.projectId) {
      const r = await this.exportService.prepare(
        body.projectId,
        this.effectiveUserId(req, subject ?? body.subject),
        body.source ?? 'draft',
      );
      return r.token;
    }
    throw new BadRequestException('token 或 projectId 必填其一');
  }

  /** 视察/监督视角归属解析：ADMIN 带 ?subject=（或 body.subject）时以被代操作用户判定作品归属 */
  private effectiveUserId(req: AuthedRequest, subject?: string): string {
    return subject && req.user?.role === 'ADMIN' ? subject : req.user.id;
  }

  private imageName(format?: ExportImageFormat): string {
    if (format === 'jpeg') return 'export.jpg';
    if (format === 'webp') return 'export.webp';
    return 'export.png';
  }

  private sendBinary(
    res: Response,
    buffer: Buffer,
    contentType: string,
    filename: string,
  ): void {
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.end(buffer);
  }
}
