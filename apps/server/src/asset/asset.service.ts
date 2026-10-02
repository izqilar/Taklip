import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  HttpException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { existsSync, unlinkSync, readFileSync } from 'fs';
import { join, relative } from 'path';
import { createHash } from 'crypto';

/** 图库单图硬上限 2MB（超出由前端 canvas 预压缩后上传） */
const MAX_GALLERY_BYTES = 2 * 1024 * 1024;

/** 魔数判定真实格式：图库仅接受 WebP（RIFF....WEBP），从根上拒绝 SVG/伪装文件 */
function isWebp(buf: Buffer): boolean {
  return (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && // RIFF
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50 // WEBP
  );
}

@Injectable()
export class AssetService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 配额口径（按角色 + 会员等级，不硬编码在接口里）：
   *  - 服务商 SERVICE_PROVIDER：30 张
   *  - 用户 / 代理商 USER / AGENT：会员(vipLevel>=1) 20 张，免费 4 张
   */
  private getLimit(user?: { role?: string; vipLevel?: number } | null): number {
    if (!user) return 4;
    if (user.role === 'SERVICE_PROVIDER') return 30;
    return (user.vipLevel ?? 0) >= 1 ? 20 : 4;
  }

  async upload(
    file: Express.Multer.File,
    userId: string,
    opts?: { width?: number; height?: number; purpose?: string; derivedFrom?: string },
  ) {
    const purpose = opts?.purpose || 'media';

    // ── 图库私有图管线（2026-10）──
    if (purpose === 'gallery') {
      let data: Buffer;
      try {
        data = readFileSync(file.path);
      } catch {
        throw new BadRequestException('读取上传文件失败');
      }
      // 1) 魔数二次校验：必须是 WebP（前端已转码；此处防伪装/直传非 webp）
      if (!isWebp(data)) {
        this.safeUnlink(file.path);
        throw new BadRequestException('图库仅接受 WebP 格式图片（请在前端转换后上传）');
      }
      // 2) 体积硬上限 2MB
      if (file.size > MAX_GALLERY_BYTES) {
        this.safeUnlink(file.path);
        throw new BadRequestException('图片体积超过 2MB，请压缩后再上传');
      }
      // 3) 配额事务校验（会话级 advisory 锁防并发超额）
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, vipLevel: true },
      });
      const limit = this.getLimit(user);
      let created: any;
      try {
        created = await this.prisma.$transaction(async (tx) => {
          // pg_advisory_xact_lock() 返回 void，Prisma $queryRaw 无法反序列化；
          // 改用 $executeRaw（不解析结果集，仅取受影响行数）获取事务级锁，事务提交/回滚后自动释放
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}::text))`;
          const count = await tx.asset.count({
            where: { userId, type: 'image', status: 'ready', deletedAt: null },
          });
          if (count >= limit) {
            throw new HttpException({ code: 'QUOTA_EXCEEDED', limit, used: count }, 429);
          }
          const storageKey = relative(process.cwd(), file.path);
          return tx.asset.create({
            data: {
              userId,
              type: 'image',
              mime: 'image/webp',
              size: file.size,
              url: storageKey, // 历史 url 字段非 null；图库以 storageKey 为准
              storageKey,
              name: file.originalname || 'image.webp',
              width: opts?.width,
              height: opts?.height,
              compressed: true,
              derivedFrom: opts?.derivedFrom || null,
              sha256: createHash('sha256').update(data).digest('hex'),
              status: 'ready',
            },
          });
        });
      } catch (e: any) {
        // 配额超额：清理已落盘的物理文件，避免孤儿文件
        if (e?.response?.status === 429) this.safeUnlink(file.path);
        throw e;
      }
      return this.toGalleryDto(created);
    }

    // ── 历史媒体（背景音乐等）：保持原 uploads/ 行为不变 ──
    const fileType = this.getFileType(file.mimetype);
    return this.prisma.asset.create({
      data: {
        userId,
        url: `/uploads/${file.filename}`,
        type: fileType,
        size: file.size,
        width: opts?.width,
        height: opts?.height,
      },
    });
  }

  async findAll(userId: string, type?: string) {
    return this.prisma.asset.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getQuota(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, vipLevel: true },
    });
    const limit = this.getLimit(user);
    const used = await this.prisma.asset.count({
      where: { userId, type: 'image', status: 'ready', deletedAt: null },
    });
    return {
      used,
      limit,
      role: user?.role,
      plan: (user?.vipLevel ?? 0) >= 1 ? 'PAID' : 'FREE',
    };
  }

  async findOne(id: string, userId: string) {
    const a = await this.prisma.asset.findUnique({ where: { id } });
    // 统一 404：不暴露「是否存在 / 属于谁」
    if (!a || a.deletedAt) throw new NotFoundException('Asset not found');
    if (a.userId !== userId) throw new NotFoundException('Asset not found');
    return a;
  }

  /** 与 findOne 同语义，供 /file 鉴权下载复用 */
  findOwned(id: string, userId: string) {
    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string) {
    const a = await this.prisma.asset.findUnique({ where: { id } });
    if (!a || a.deletedAt) throw new NotFoundException('Asset not found');
    if (a.userId !== userId) throw new NotFoundException('Asset not found');

    // 级联保护：被作品引用的图禁止删除，避免串档 / 缺图
    const refs = await this.prisma.workImageRef.findMany({
      where: { assetId: id },
      select: { workId: true },
    });
    if (refs.length) {
      throw new ConflictException({
        code: 'IN_USE',
        works: refs.map((r) => r.workId),
        message: `该图片正用于 ${refs.length} 个作品，无法删除`,
      });
    }

    // 软删（保留审计行），并立即释放物理文件
    await this.prisma.asset.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'deleted' },
    });
    const filePath = a.storageKey
      ? join(process.cwd(), a.storageKey)
      : join(process.cwd(), 'uploads', String(a.url).replace('/uploads/', ''));
    this.safeUnlink(filePath);
    return { id, deleted: true };
  }

  private toGalleryDto(a: any) {
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      mime: a.mime,
      size: a.size,
      width: a.width,
      height: a.height,
      storageKey: a.storageKey,
      compressed: a.compressed,
      derivedFrom: a.derivedFrom,
      createdAt: a.createdAt,
      url: `/api/assets/${a.id}/file`,
    };
  }

  private safeUnlink(p: string) {
    try {
      if (p && existsSync(p)) unlinkSync(p);
    } catch {
      /* 忽略清理失败 */
    }
  }

  private getFileType(mimetype: string): string {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';
    return 'file';
  }
}
