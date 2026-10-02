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
  Res,
  NotFoundException,
  HttpException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { Response } from 'express';
import { existsSync, mkdirSync } from 'fs';
import { AssetService } from './asset.service';

type AuthedRequest = Express.Request & { user: { id: string } };

/** 私有图库存放根目录（在 uploads/ 之外，避免被公开静态服务暴露） */
const PRIVATE_ROOT = join(process.cwd(), 'private-assets');

const storage = diskStorage({
  // 按 purpose 分流：图库进私有目录并按 userId 前缀隔离；其余（背景音乐等）走原 uploads/
  destination: (req: any, _file, cb) => {
    const userId = req.user?.id;
    const purpose = (req.query?.purpose as string) || 'media';
    if (purpose === 'gallery' && userId) {
      const dir = join(PRIVATE_ROOT, 'users', userId, 'imgs');
      try {
        mkdirSync(dir, { recursive: true });
      } catch {
        /* 已存在则忽略 */
      }
      cb(null, dir);
    } else {
      cb(null, join(process.cwd(), 'uploads'));
    }
  },
  filename: (req: any, file, cb) => {
    const purpose = (req.query?.purpose as string) || 'media';
    if (purpose === 'gallery') {
      // cuid 风格随机名，杜绝自增/可枚举；统一 webp 扩展名
      const rand = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.originalname}`;
      const cuid = Buffer.from(rand).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
      cb(null, `${cuid}.webp`);
    } else {
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
      cb(null, uniqueName);
    }
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
      limits: { fileSize: 30 * 1024 * 1024 }, // 上限 30MB（背景音乐等音频文件较大）；图库内部再强制 ≤2MB
      fileFilter: (_req, file, cb) => {
        // 类型白名单：图片 / 音频 / 视频。注意 mimetype 由客户端声明，
        // 图库场景在 service 内以魔数二次校验真实类型（拒绝 SVG/伪装）。
        const ALLOWED = [
          /^image\/(jpg|jpeg|png|gif|webp|bmp|svg(\+xml)?|ico|tiff?|avif)$/i,
          /^audio\//i,
          /^video\//i,
        ];
        if (!ALLOWED.some((re) => re.test(file.mimetype))) {
          return cb(new BadRequestException('仅支持常见图片、音频、视频格式'), false);
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthedRequest,
    @Query('purpose') purpose?: string,
    @Query('derivedFrom') derivedFrom?: string,
    @Query('width') width?: string,
    @Query('height') height?: string,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    const meta: { width?: number; height?: number } = {};
    const w = Number(width);
    const h = Number(height);
    if (Number.isFinite(w) && w > 0) meta.width = Math.round(w);
    if (Number.isFinite(h) && h > 0) meta.height = Math.round(h);
    return this.assetService.upload(file, req.user.id, {
      ...meta,
      purpose: purpose || 'media',
      derivedFrom,
    });
  }

  @Get()
  findAll(@Req() req: AuthedRequest, @Query('type') type?: string) {
    return this.assetService.findAll(req.user.id, type);
  }

  /** 配额（仅统计图库图片），须置于 :id 路由之前以避免被其捕获 */
  @Get('quota')
  quota(@Req() req: AuthedRequest) {
    return this.assetService.getQuota(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.assetService.findOne(id, req.user.id);
  }

  /** 私有图鉴权下载（替代公开 /uploads/），仅本人可读取 */
  @Get(':id/file')
  async file(@Param('id') id: string, @Req() req: AuthedRequest, @Res() res: Response) {
    const asset = await this.assetService.findOwned(id, req.user.id);
    const filePath = asset.storageKey
      ? join(process.cwd(), asset.storageKey)
      : join(process.cwd(), 'uploads', String(asset.url).replace('/uploads/', ''));
    if (!existsSync(filePath)) throw new NotFoundException('file missing');
    res.setHeader('Content-Type', asset.mime || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.sendFile(filePath);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.assetService.remove(id, req.user.id);
  }
}
