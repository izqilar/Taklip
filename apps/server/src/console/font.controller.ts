import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { resolveFontsDir, FONTS_URL_PREFIX } from '../common/font-dirs';
import { join, relative, parse, sep } from 'path';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';

interface FontManifestEntry {
  family: string;
  displayName?: string;
  isPaid?: boolean;
  category?: string;
  sortOrder?: number;
  files?: { woff2?: string; woff?: string; ttf?: string; otf?: string };
}

interface FontSeed {
  family: string;
  displayName: string;
  isPaid: boolean;
  category?: string;
  files: Record<string, string>;
}

/** 受支持的字体文件扩展名（与 @h5design/core 的 FORMAT_TOKENS 对应） */
const FONT_EXT = ['woff2', 'woff', 'ttf', 'otf', 'eot', 'svg'];
/** 目录名命中即视为「付费字体目录」 */
const PAID_DIR_RE = /(licen|paid|收费|商用|vip)/i;

/** 把清单里写的文件名/相对路径规范成可访问的 URL（路径逐段编码，兼容空格与中文） */
function normalizeFiles(files: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(files)) {
    if (!v) continue;
    if (v.startsWith('http') || v.startsWith('/')) {
      out[k.toLowerCase()] = v;
    } else {
      // 清单里可写子目录相对路径（如 "LicensedFonts/x.ttf"）
      out[k.toLowerCase()] =
        `${FONTS_URL_PREFIX}${v.split(/[\\/]/).map(encodeURIComponent).join('/')}`;
    }
  }
  return out;
}

/**
 * 递归扫描字体目录。
 *
 * 约定（目录即真相，无需手写清单）：
 *  - `uploads/fonts/FreeFonts/**`      → isPaid = false
 *  - `uploads/fonts/LicensedFonts/**`  → isPaid = true（目录名含 licen/paid/收费/商用/vip 即付费）
 *  - 根目录 `uploads/fonts/*` 直接放的文件 → isPaid = false
 *  - family 取「文件名去扩展名」；同名不同格式（x.woff2 + x.ttf）自动合并为同一个字体的多源。
 */
function scanFontDir(root: string): { list: FontSeed[]; conflicts: string[] } {
  const groups = new Map<string, FontSeed>();
  const conflicts: string[] = [];

  const walk = (dir: string): void => {
    let entries: string[] = [];
    try {
      entries = readdirSync(dir).sort();
    } catch {
      return;
    }
    for (const name of entries) {
      const full = join(dir, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walk(full);
        continue;
      }
      const ext = (parse(name).ext || '').replace(/^\./, '').toLowerCase();
      if (!FONT_EXT.includes(ext)) continue;

      const relSegs = relative(root, full).split(sep);
      const stem = parse(name).name;
      const isPaid = relSegs.some((s) => PAID_DIR_RE.test(s));
      const url = `${FONTS_URL_PREFIX}${relSegs.map(encodeURIComponent).join('/')}`;

      const exist = groups.get(stem);
      if (exist) {
        // 同名不同格式 → 合并多源；若落在付费/免费不同目录下则记为冲突，保留先扫到的
        if (exist.isPaid !== isPaid) {
          conflicts.push(stem);
          continue;
        }
        exist.files[ext] = url;
        continue;
      }
      groups.set(stem, {
        family: stem,
        displayName: stem.replace(/[-_]+/g, ' ').trim(),
        isPaid,
        category: relSegs.length > 1 ? relSegs[0] : undefined,
        files: { [ext]: url },
      });
    }
  };

  walk(root);
  return { list: [...groups.values()], conflicts };
}

/**
 * 字体目录接口。
 * GET  /fonts          → 前端编辑器字体选择器拉取的目录（裸数组）
 * GET  /admin/fonts    → 运营端「字体管理」列表（{ items, total, page, pageSize }）
 * POST /fonts/refresh  → ADMIN 扫描 uploads/fonts（含子目录）并与 fonts.json 合并 upsert
 *
 * 字体文件由 main.ts 的 useStaticAssets(uploadsDir) 以 /uploads/fonts/ 对外托管。
 * 用法：把字体文件丢进 uploads/fonts/FreeFonts 或 LicensedFonts，调一次 refresh 即入库，
 *      无需手写清单；fonts.json 仅用于补充 displayName / category / 远程 URL 等元数据。
 */
/**
 * 路由前缀同时支持 `api/fonts` 与 `fonts`：
 * - 运营端 `API_URL` 带 `/api` 前缀，`authedFetch('/fonts')` → `/api/fonts`；
 * - web 端 `BASE_URL=''`，vite 只代理 `/api`，故 client 里写 `/api/fonts`。
 * 二者最终都落到同一组端点，避免「一端能取到、另一端 404 被静默吞掉」。
 *
 * 另加 `api/admin/fonts`：运营端后台「字体管理」页复用 GenericListPage，
 * 而 Refine 的惯例是 resource 名 == 后端路径（如 `admin/audit-logs` → `api/admin/audit-logs`），
 * 这里保持一致，免得前端为字体单独破例。
 */
@Controller(['api/fonts', 'fonts', 'api/admin/fonts'])
export class FontController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 字体目录列表。
   *
   * ⚠️ 响应体有两种形状，这是刻意的兼容设计：
   *  - **不带分页参数**（编辑器 / 发布页 `GET /api/fonts`）→ 返回**裸数组**。
   *    宿主 `bootstrapFonts()` 直接 `setFontCatalog(list)`，一旦包成 `{items:[…]}` 会导致
   *    整个字体目录丢空（下拉只剩系统字体），且异常被 catch 静默吞掉，极难排查。
   *  - **带 page / pageSize**（运营端后台走 Refine dataProvider）→ 返回 `{items,total,page,pageSize}`。
   *
   * 支持后台筛选：`family`（同时对 family / displayName 做包含匹配，忽略大小写）、
   * `isPaid`（'true' / 'false'）。
   */
  @Get()
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('family') family?: string,
    @Query('isPaid') isPaid?: string,
  ) {
    const where: Record<string, unknown> = {};
    if (family) {
      const contains = { contains: family, mode: 'insensitive' };
      where.OR = [{ family: contains }, { displayName: contains }];
    }
    if (isPaid === 'true' || isPaid === 'false') where.isPaid = isPaid === 'true';

    const all = await this.prisma.font.findMany({ where, orderBy: { sortOrder: 'asc' } });

    const p = Number(page) || 1;
    const ps = Number(pageSize) || 0;
    if (ps > 0) {
      const start = (p - 1) * ps;
      return { items: all.slice(start, start + ps), total: all.length, page: p, pageSize: ps };
    }
    return all;
  }

  /**
   * 扫描目录 + 合并清单 → upsert。
   * @param prune 传 '1' 时额外删除「目录与清单都不存在」的历史记录（目录即真相模式）。
   */
  @Post('refresh')
  // ⚠️ 必须写在同一个 @UseGuards 里：若拆成两行（@UseGuards(AuthGuard) / @UseGuards(RolesGuard)），
  // 装饰器自下而上求值会让 RolesGuard 排在 AuthGuard 之前，此时 req.user 尚未填充，
  // 角色比对必然拿到空用户 → 403「需要登录后访问」。
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  async refresh(@Query('prune') prune?: string) {
    const fontsDir = resolveFontsDir();
    const manifestPath = join(fontsDir, 'fonts.json');

    // 1) 目录扫描（主数据源）
    const { list: scanned, conflicts } = scanFontDir(fontsDir);
    const byFamily = new Map<string, FontSeed>();
    for (const f of scanned) byFamily.set(f.family, f);

    // 2) fonts.json 清单（可选，用于补充/覆盖元数据）
    let fromManifest = 0;
    if (existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as FontManifestEntry[];
        for (const entry of manifest ?? []) {
          if (!entry?.family) continue;
          const scannedSame = byFamily.get(entry.family);
          const files = normalizeFiles((entry.files ?? {}) as Record<string, string>);
          byFamily.set(entry.family, {
            family: entry.family,
            displayName: entry.displayName || entry.family,
            isPaid: entry.isPaid ?? scannedSame?.isPaid ?? false,
            category: entry.category ?? scannedSame?.category,
            files: Object.keys(files).length ? files : scannedSame?.files ?? {},
          });
          fromManifest += 1;
        }
      } catch {
        /* 清单解析失败时静默降级为纯目录扫描 */
      }
    }

    // 3) upsert（sortOrder 按本次顺序重排，保证选择器里顺序稳定）
    const list = [...byFamily.values()];
    let synced = 0;
    for (let i = 0; i < list.length; i += 1) {
      const f = list[i];
      const data = {
        displayName: f.displayName,
        isPaid: f.isPaid,
        category: f.category ?? null,
        sortOrder: i,
        files: f.files as object,
      };
      await this.prisma.font.upsert({
        where: { family: f.family },
        create: { family: f.family, ...data },
        update: data,
      });
      synced += 1;
    }

    // 4) 可选清理：目录里已删掉的字体同步下线
    let pruned = 0;
    if (prune === '1') {
      const keep = list.map((f) => f.family);
      const r = await this.prisma.font.deleteMany({ where: { family: { notIn: keep } } });
      pruned = r.count;
    }

    return {
      synced,
      scanned: scanned.length,
      fromManifest,
      pruned,
      conflicts,
      paid: list.filter((f) => f.isPaid).length,
      free: list.filter((f) => !f.isPaid).length,
    };
  }
}
