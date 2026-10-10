import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { existsSync, unlinkSync, readFileSync, writeFileSync, renameSync } from 'fs';
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
    // 唯一例外：编辑器图库选择器把「图库原图」转存为公开 media 副本时会回带 derivedFrom，
    // 此处必须落库 —— 否则副本与源图库图的关联断裂，findAll 的 usedInWorks 恒为 0，
    // 图库卡片的「已使用/未使用」标签与删除级联保护（IN_USE）都会失效。
    const fileType = this.getFileType(file.mimetype);
    return this.prisma.asset.create({
      data: {
        userId,
        url: `/uploads/${file.filename}`,
        type: fileType,
        size: file.size,
        width: opts?.width,
        height: opts?.height,
        derivedFrom: opts?.derivedFrom || null,
      },
    });
  }

  async findAll(userId: string, type?: string, galleryOnly = false) {
    const where = {
      userId,
      deletedAt: null,
      ...(type ? { type } : {}),
      // 图库列表仅展示「私有图库图」：该类资源必有 storageKey（private-assets/...）。
      // 编辑器 openAssetPicker 把图库图转存为公开 media 副本供画布渲染时，
      // 该副本 storageKey 为 null，不应作为重复条目出现在图库列表。
      ...(galleryOnly ? { storageKey: { not: null } } : {}),
    };
    // 排序必须【完全确定】：createdAt 相同（批量导入/同一毫秒）时，Postgres 不保证并列行的
    // 相对次序，两次查询可能返回不同顺序，导致 web 端与运营端视察窗口「同一批图片顺序不一致」。
    // 故追加 id 作为稳定的次级排序键。
    const assets = await this.prisma.asset.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    // 仅图库列表附带「被作品使用次数」，供前端展示「使用中 N 个作品」徽标与删除保护提示。
    // 关联口径（与 remove() 的级联保护一致）：
    //  ① 编辑器选择器把本图库图转存为公开 media 副本（asset.derivedFrom = 本图 id）后嵌入作品；
    //  ② 或显式写入 WorkImageRef（编辑器未来管线）。两者任一存在即视为「使用中」。
    if (!galleryOnly) return assets;
    const ids = assets.map((a) => a.id);
    let usageMap = new Map<string, number>();
    let refMap = new Map<string, number>();
    if (ids.length) {
      const [derived, refs] = await Promise.all([
        this.prisma.asset.groupBy({
          by: ['derivedFrom'],
          where: { userId, storageKey: null, derivedFrom: { in: ids } },
          _count: { _all: true },
        }),
        this.prisma.workImageRef.groupBy({
          by: ['assetId'],
          where: { assetId: { in: ids } },
          _count: { _all: true },
        }),
      ]);
      for (const d of derived) if (d.derivedFrom) usageMap.set(d.derivedFrom, d._count._all);
      for (const r of refs) refMap.set(r.assetId, r._count._all);
    }
    return assets.map((a) => ({
      ...a,
      usedInWorks: (usageMap.get(a.id) || 0) + (refMap.get(a.id) || 0),
    }));
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

  /**
   * 原位替换原图（裁剪弹窗「裁剪」按钮用）：在原 asset 记录上覆盖磁盘文件并更新尺寸/哈希，
   * **不新建 asset 行 → 不占图库配额**。仅图库私有图（storageKey 非空）可替换；
   * 媒体副本（storageKey 为 null）等不支持。
   * 流程（与删除管线同理，保证磁盘不留碎片、DB 不出现「文件已换但记录未更新」的中间态）：
   *  1) 先按魔数 + 体积校验新文件（WebP / ≤2MB），非法则清理临时上传文件并抛错；
   *  2) 原子覆盖：写临时文件后 rename 到原 storageKey 路径（同文件系统原子；跨文件系统失败则清理并抛错）；
   *  3) 覆盖成功后更新 DB 行（size/width/height/sha256/status），不新增行、不动配额。
   */
  async replace(id: string, userId: string, file: Express.Multer.File, opts?: { width?: number; height?: number }) {
    const a = await this.prisma.asset.findUnique({ where: { id } });
    // 统一 404：不暴露「是否存在 / 属于谁」
    if (!a || a.deletedAt) throw new NotFoundException('Asset not found');
    if (a.userId !== userId) throw new NotFoundException('Asset not found');
    if (!a.storageKey) throw new BadRequestException('该资源不支持原位替换');

    let data: Buffer;
    try {
      data = readFileSync(file.path);
    } catch {
      throw new BadRequestException('读取上传文件失败');
    }
    if (!isWebp(data)) {
      this.safeUnlink(file.path);
      throw new BadRequestException('图库仅接受 WebP 格式图片（请在前端转换后上传）');
    }
    if (file.size > MAX_GALLERY_BYTES) {
      this.safeUnlink(file.path);
      throw new BadRequestException('图片体积超过 2MB，请压缩后再上传');
    }
    const hash = createHash('sha256').update(data).digest('hex');
    const targetPath = join(process.cwd(), a.storageKey);
    // 原子覆盖：先写临时文件，再 rename 到目标（同文件系统下 rename 原子；
    // 跨文件系统失败则清理临时文件并抛 FILE_WRITE_FAILED，不写 DB，原文件保持完整）。
    const tmpPath = `${targetPath}.replace-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;
    writeFileSync(tmpPath, data);
    try {
      renameSync(tmpPath, targetPath);
    } catch {
      this.safeUnlink(tmpPath);
      throw new InternalServerErrorException({ code: 'FILE_WRITE_FAILED', message: '图片写入失败，请稍后重试' });
    }
    this.safeUnlink(file.path); // 丢弃 multer 落盘的临时上传文件
    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        size: file.size,
        width: opts?.width,
        height: opts?.height,
        sha256: hash,
        status: 'ready',
      },
    });
    return this.toGalleryDto(updated);
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

  async remove(id: string, userId: string, force = false) {
    const a = await this.prisma.asset.findUnique({ where: { id } });
    // 不存在：统一 404，不暴露「是否存在 / 属于谁」
    if (!a) throw new NotFoundException('Asset not found');
    // 幂等：已软删的行直接返回成功（带 alreadyDeleted 标记），不再抛 404。
    // 这样前端重试 / E2E 清理幂等可成功，也不会因「对已删行再删」误判清理失败而留下脏库。
    if (a.deletedAt) return { id, deleted: true, alreadyDeleted: true };
    if (a.userId !== userId) throw new NotFoundException('Asset not found');

    // 级联保护：图库图被作品引用时默认禁止删除，避免作品串档 / 缺图。
    // 引用口径（与 findAll 的 usedInWorks 一致）：
    //  ① 显式 WorkImageRef（编辑器未来写入）；
    //  ② 编辑器选择器把本图库图转存为公开 media 副本（asset.derivedFrom = 本图 id）后嵌入作品。
    // force=true 时跳过该拦截：前端已在「二次确认」中明确告知用户影响、由用户拍板。
    // （作品渲染用的是 uploads/ 下的 media 副本，删图库原图不会立刻打断已发布作品。）
    const inUse = a.storageKey
      ? await this.prisma.asset.count({ where: { userId, storageKey: null, derivedFrom: id } })
      : 0;
    const refCount = await this.prisma.workImageRef.count({ where: { assetId: id } });
    if (!force && inUse + refCount > 0) {
      throw new ConflictException({
        code: 'IN_USE',
        works: inUse + refCount,
        message: `该图片正用于 ${inUse + refCount} 个作品，无法删除`,
      });
    }

    // 删除管线策略（先软删 DB、后物理删，见下方实现）：
    //  - 先软删 DB：立即释放配额、findAll 按 deletedAt 过滤不再回显该行；
    //  - 再 best-effort 物理删：失败仅残留磁盘孤儿文件（行已软删、不在列表），不会造成可见断图幽灵；
    //  - 跨「文件系统 / 数据库」无法单事务原子提交，故以「DB 优先」换取列表一致性。
    const filePath = a.storageKey
      ? join(process.cwd(), a.storageKey)
      : join(process.cwd(), 'uploads', String(a.url).replace('/uploads/', ''));
    // 删除顺序修正：先软删 DB（立即释放配额、findAll 按 deletedAt 过滤不再回显），
    // 再 best-effort 物理删；物理删失败（ENOENT/权限/占用等）仅残留磁盘孤儿文件（行已软删、不在列表），
    // 绝不会造成「记录 active 但文件缺失」的可见断图幽灵。跨文件系统/DB 无法单事务原子提交，故 DB 优先。
    await this.prisma.asset.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'deleted' },
    });
    try {
      if (filePath && existsSync(filePath)) unlinkSync(filePath);
    } catch {
      /* 物理删失败非致命：行已软删，仅残留孤儿文件 */
    }
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
