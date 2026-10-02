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

/**
 * 牌级 → 图库上限（张）：索引即 agentTier / providerTier（0..4）。
 * L0 见习/新锐=10，L1 铜=16，L2 银=20，L3 金=26，L4 钻石=30。
 * 与「图库管理管线开发文档.md」§2.1 服务商配额一致；代理商与服务商共用此档位。
 */
const TIER_GALLERY_LIMIT: readonly number[] = [10, 16, 20, 26, 30];

/**
 * 终端用户卡级 → 图库上限（张）：索引即 vipLevel（0..3）。
 * 免费=4，银卡=6，金卡=10，黑金=16（文档 §2.2）。
 */
const USER_GALLERY_LIMIT: readonly number[] = [4, 6, 10, 16];

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
   * 图库配额口径（分级动态上限，依据「图库管理管线开发文档.md」）：
   *  - 代理商 AGENT  / 服务商 SERVICE_PROVIDER：按各自牌级 agentTier / providerTier 取
   *      见习(L0)=10 / 铜(L1)=16 / 银(L2)=20 / 金(L3)=26 / 钻石(L4)=30。
   *  - 终端用户 USER：按卡级（§2.2）免费 4 / 银卡 6 / 金卡 10 / 黑金 16。
   * 牌级为 0..4（或卡级 0..3），越界统一夹到有效区间，避免脏数据导致无限额。
   */
  private getLimit(
    user?: { role?: string; vipLevel?: number; agentTier?: number; providerTier?: number } | null,
  ): number {
    const clamp = (n: number | undefined, max: number) => Math.max(0, Math.min(max, n ?? 0));
    if (!user) return 4;
    if (user.role === 'AGENT') return TIER_GALLERY_LIMIT[clamp(user.agentTier, 4)];
    if (user.role === 'SERVICE_PROVIDER') return TIER_GALLERY_LIMIT[clamp(user.providerTier, 4)];
    // USER：终端用户卡级（§2.2）
    return USER_GALLERY_LIMIT[clamp(user.vipLevel, 3)];
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
      // 3) 内容去重：同一用户上传内容（sha256）完全相同的图库图时，直接复用已有记录，
      //    不新建行 —— 保证「每张已提交的图片在图库中始终唯一」，从源头杜绝重复条目
      //    （含「同一张图被作品/模板引用后重复出现」的同类问题）。
      const hash = createHash('sha256').update(data).digest('hex');
      const dup = await this.prisma.asset.findFirst({
        where: { userId, type: 'image', sha256: hash, storageKey: { not: null }, deletedAt: null },
      });
      if (dup) {
        this.safeUnlink(file.path); // 丢弃本次重复上传的物理文件
        return this.toGalleryDto(dup);
      }
      // 4) 配额事务校验（会话级 advisory 锁防并发超额）
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, vipLevel: true, agentTier: true, providerTier: true },
      });
      const limit = this.getLimit(user);
      let created: any;
      try {
        created = await this.prisma.$transaction(async (tx) => {
          // pg_advisory_xact_lock() 返回 void，Prisma $queryRaw 无法反序列化；
          // 改用 $executeRaw（不解析结果集，仅取受影响行数）获取事务级锁，事务提交/回滚后自动释放
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}::text))`;
          // 配额仅统计「私有图库图」（storageKey 非空），与图库列表口径一致；media 副本不占额度
          const count = await tx.asset.count({
            where: { userId, type: 'image', storageKey: { not: null }, deletedAt: null },
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
              sha256: hash,
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

  async findAll(userId: string, type?: string, galleryOnly = false) {
    return this.prisma.asset.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(type ? { type } : {}),
        // 图库列表仅展示「私有图库图」：该类资源必有 storageKey（private-assets/...）。
        // 编辑器 openAssetPicker 把图库图转存为公开 media 副本供画布渲染时，
        // 该副本 storageKey 为 null，不应作为重复条目出现在图库列表。
        ...(galleryOnly ? { storageKey: { not: null } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getQuota(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, vipLevel: true, agentTier: true, providerTier: true },
    });
    const limit = this.getLimit(user);
    const used = await this.prisma.asset.count({
      where: { userId, type: 'image', storageKey: { not: null }, deletedAt: null },
    });
    // 牌级/卡级：供前端展示「见习/铜/银/金/钻石」或「免费/银卡/金卡/黑金」档位名
    const tierKind =
      user?.role === 'AGENT' ? 'agent' : user?.role === 'SERVICE_PROVIDER' ? 'provider' : 'user';
    const tier =
      user?.role === 'AGENT'
        ? user.agentTier ?? 0
        : user?.role === 'SERVICE_PROVIDER'
          ? user.providerTier ?? 0
          : user?.vipLevel ?? 0;
    return {
      used,
      limit,
      role: user?.role,
      plan: (user?.vipLevel ?? 0) >= 1 ? 'PAID' : 'FREE',
      tier,
      tierKind,
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
