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
import { InspectSubjectGuard } from '../common/guards/inspect-subject.guard';

type AuthedRequest = Express.Request & { user: { id: string; role?: string } };

/**
 * 视察视角主体解析（对标 provider-console.controller 的 subjectId）：
 * ADMIN 带 ?subject=<被视察用户id> 时以被视察对象作用域操作，否则取自身。
 * 写操作（upload / remove）不经过 InspectSubjectGuard（该守卫仅改写只读 GET），
 * 故在此显式解析，使运营端「用户视角·我的图库」与被视察账号登录看到的数据严格一致。
 */
const subjectId = (req: AuthedRequest, subject?: string) =>
  subject && req.user.role === 'ADMIN' ? subject : req.user.id;

/** 私有图库存放根目录（在 uploads/ 之外，避免被公开静态服务暴露） */
const PRIVATE_ROOT = join(process.cwd(), 'private-assets');

/** 原位替换用的临时上传目录（private-assets/.tmp，整体 gitignore） */
const REPLACE_TMP = join(PRIVATE_ROOT, '.tmp');

const replaceStorage = diskStorage({
  // 替换原图：临时落盘到私有 .tmp 目录，service 内校验后原子 rename 覆盖原 storageKey 文件
  destination: (_req, _file, cb) => {
    try {
      mkdirSync(REPLACE_TMP, { recursive: true });
    } catch {
      /* 已存在则忽略 */
    }
    cb(null, REPLACE_TMP);
  },
  filename: (_req, _file, cb) => {
    const cuid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cb(null, `rep-${cuid}.webp.tmp`);
  },
});

const storage = diskStorage({
  // 按 purpose 分流：图库进私有目录并按 userId 前缀隔离；其余（背景音乐等）走原 uploads/
  destination: (req: any, _file, cb) => {
    // 视察视角（ADMIN + ?subject=）必须落到【被视察对象】的目录，与 assetService.upload
    // 写入 Asset.userId 的主体保持一致，否则文件与 DB 行的归属会分叉（文件在 A 目录、行记在 B 用户）。
    const userId =
      (req.query?.subject && req.user?.role === 'ADMIN' ? req.query.subject : req.user?.id) || '';
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
    @Query('subject') subject?: string,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    const meta: { width?: number; height?: number } = {};
    const w = Number(width);
    const h = Number(height);
    if (Number.isFinite(w) && w > 0) meta.width = Math.round(w);
    if (Number.isFinite(h) && h > 0) meta.height = Math.round(h);
    return this.assetService.upload(file, subjectId(req, subject), {
      ...meta,
      purpose: purpose || 'media',
      derivedFrom,
    });
  }

  @Get()
  @UseGuards(InspectSubjectGuard)
  findAll(
    @Req() req: AuthedRequest,
    @Query('type') type?: string,
    @Query('galleryOnly') galleryOnly?: string,
    @Query('subject') subject?: string,
  ) {
    return this.assetService.findAll(
      subjectId(req, subject),
      type,
      galleryOnly === '1' || galleryOnly === 'true',
    );
  }

  /** 配额（仅统计图库图片），须置于 :id 路由之前以避免被其捕获 */
  @Get('quota')
  @UseGuards(InspectSubjectGuard)
  quota(@Req() req: AuthedRequest, @Query('subject') subject?: string) {
    return this.assetService.getQuota(subjectId(req, subject));
  }

  @Get(':id')
  @UseGuards(InspectSubjectGuard)
  findOne(
    @Param('id') id: string,
    @Req() req: AuthedRequest,
    @Query('subject') subject?: string,
  ) {
    return this.assetService.findOne(id, subjectId(req, subject));
  }

  /** 私有图鉴权下载（替代公开 /uploads/），仅本人可读取 */
  @Get(':id/file')
  @UseGuards(InspectSubjectGuard)
  async file(
    @Param('id') id: string,
    @Req() req: AuthedRequest,
    @Res() res: Response,
    @Query('subject') subject?: string,
  ) {
    const asset = await this.assetService.findOwned(id, subjectId(req, subject));
    const filePath = asset.storageKey
      ? join(process.cwd(), asset.storageKey)
      : join(process.cwd(), 'uploads', String(asset.url).replace('/uploads/', ''));
    if (!existsSync(filePath)) throw new NotFoundException('file missing');
    res.setHeader('Content-Type', asset.mime || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.sendFile(filePath);
  }

  /** 原位替换原图（裁剪弹窗「裁剪」按钮）：覆盖原文件、更新尺寸/哈希，**不新建行、不占配额**。
   *  写操作，不经过 InspectSubjectGuard；以 subjectId 解析被视察对象归属（与 upload/remove 一致）。 */
  @Post(':id/replace')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: replaceStorage,
      limits: { fileSize: 30 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
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
  async replace(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthedRequest,
    @Query('width') width?: string,
    @Query('height') height?: string,
    @Query('subject') subject?: string,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    const meta: { width?: number; height?: number } = {};
    const w = Number(width);
    const h = Number(height);
    if (Number.isFinite(w) && w > 0) meta.width = Math.round(w);
    if (Number.isFinite(h) && h > 0) meta.height = Math.round(h);
    return this.assetService.replace(id, subjectId(req, subject), file, meta);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Req() req: AuthedRequest,
    @Query('force') force?: string,
    @Query('subject') subject?: string,
  ) {
    // force=1：跳过「被作品使用」的 409 拦截（前端已在二次确认中警示影响，由用户拍板）
    return this.assetService.remove(
      id,
      subjectId(req, subject),
      force === '1' || force === 'true',
    );
  }
}
