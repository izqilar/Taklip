import {
  Controller,
  Get,
  Delete,
  Param,
  Post,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { AssetService } from './asset.service';

type AuthedRequest = Express.Request & {
  user: { id: string };
};

const storage = diskStorage({
  destination: join(process.cwd(), 'uploads'),
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

@Controller('api/assets')
@UseGuards(AuthGuard('jwt'))
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
      limits: { fileSize: 30 * 1024 * 1024 }, // 30MB：图片 + 背景音乐（音频文件较大）
      fileFilter: (_req, file, cb) => {
        // 支持常见网页图片与音频格式。SVG 已允许，但发布页/编辑器中应通过 img 标签安全属性
        // 及后续 CSP 策略降低 XSS 风险；必要时可引入 DOMPurify 等库做服务端清洗。
        // 注：mimetype 由客户端声明，生产环境建议以文件魔数二次校验。
        const ALLOWED = [
          /^image\/(jpg|jpeg|png|gif|webp|bmp|svg(\+xml)?|ico|tiff?|avif)$/,
          /^audio\/(mpeg|mp3|wav|x-wav|wave|x-ms-wav|ogg|vorbis|m4a|x-m4a|aac|webm|flac|x-flac)$/i,
        ];
        if (!ALLOWED.some((re) => re.test(file.mimetype))) {
          return cb(
            new BadRequestException(
              '仅支持 jpg、jpeg、png、gif、webp、bmp、svg、ico、tiff、avif 等图片格式，以及 mp3、wav、ogg、m4a、aac、webm、flac 等音频格式',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthedRequest,
    @Query('width') width?: string,
    @Query('height') height?: string,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    const meta: { width?: number; height?: number } = {};
    const w = Number(width);
    const h = Number(height);
    if (Number.isFinite(w) && w > 0) meta.width = w;
    if (Number.isFinite(h) && h > 0) meta.height = h;
    return this.assetService.upload(file, req.user.id, meta);
  }

  @Get()
  findAll(@Req() req: AuthedRequest, @Query('type') type?: string) {
    return this.assetService.findAll(req.user.id, type);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.assetService.remove(id, req.user.id);
  }
}
