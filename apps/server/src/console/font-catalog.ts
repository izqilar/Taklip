import { resolveFontsDir, FONTS_URL_PREFIX } from '../common/font-dirs';
import { join, relative, parse, sep } from 'path';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { parseFontCoverage, type FontCoverage } from './cmap';

/**
 * 字体目录「目录即真相」扫描逻辑 —— 服务端唯一真源。
 *
 * 抽出来的原因：编辑器端点（font.controller.list 实时扫描）与**服务端导出**
 * （export.service.prepare 给渲染页下发 @font-face 所需的字体文件）必须读同一份
 * 目录扫描结果，否则会出现「编辑器里新字体正常、导出却回退默认字体」的不一致
 * （见 font.controller 注释与 export.service.prepare 的修复说明）。
 *
 * 历史坑：旧 export.service 直接 `prisma.font.findMany` 读 DB 的 `font` 表，而该表
 * 只在手动 `refresh` 时才更新；从目录增删字体后 DB 不会自动变 → 新字体进不了导出
 * render payload → 渲染页收不到 @font-face → 文字静默回退系统字体。
 */

export interface FontManifestEntry {
  family: string;
  displayName?: string;
  isPaid?: boolean;
  category?: string;
  sortOrder?: number;
  files?: { woff2?: string; woff?: string; ttf?: string; otf?: string };
}

export interface FontSeed {
  family: string;
  displayName: string;
  isPaid: boolean;
  category?: string;
  files: Record<string, string>;
  /** 字体对维吾尔文正字法的覆盖（目录即真相扫描时算出，供前端做确定性回退与警示） */
  coverage?: FontCoverage;
}

/**
 * 覆盖信息 sidecar 缓存：key = 字体文件相对 fonts 根的路径，
 * value = { mtime, size, coverage }。避免每次 /api/fonts 扫描都重解析 186 个字体文件。
 */
const COVERAGE_CACHE_FILE = '.coverage-cache.json';
interface CoverageCacheEntry {
  mtime: number;
  size: number;
  coverage: FontCoverage;
}
const coverageCache = new Map<string, CoverageCacheEntry>();
let coverageCacheDirty = false;

function loadCoverageCache(fontsDir: string): void {
  const p = join(fontsDir, COVERAGE_CACHE_FILE);
  if (!existsSync(p)) return;
  try {
    const json = JSON.parse(readFileSync(p, 'utf-8')) as Record<string, CoverageCacheEntry>;
    for (const [k, v] of Object.entries(json)) coverageCache.set(k, v);
  } catch {
    /* 缓存损坏则忽略，重新解析 */
  }
}

function saveCoverageCache(fontsDir: string): void {
  if (!coverageCacheDirty) return;
  const p = join(fontsDir, COVERAGE_CACHE_FILE);
  try {
    const obj: Record<string, CoverageCacheEntry> = {};
    for (const [k, v] of coverageCache) obj[k] = v;
    writeFileSync(p, JSON.stringify(obj), 'utf-8');
    coverageCacheDirty = false;
  } catch {
    /* 写缓存失败不影响主流程 */
  }
}

/** 取单个字体文件的覆盖信息（带 mtime/size 校验的缓存） */
function getCoverage(fontsDir: string, fullPath: string, relPath: string): FontCoverage {
  let st;
  try {
    st = statSync(fullPath);
  } catch {
    return parseFontCoverage(fullPath);
  }
  const hit = coverageCache.get(relPath);
  if (hit && hit.mtime === st.mtimeMs && hit.size === st.size) return hit.coverage;
  const cov = parseFontCoverage(fullPath);
  coverageCache.set(relPath, { mtime: st.mtimeMs, size: st.size, coverage: cov });
  coverageCacheDirty = true;
  return cov;
}

/** 受支持的字体文件扩展名（与 @h5design/core 的 FORMAT_TOKENS 对应） */
const FONT_EXT = ['woff2', 'woff', 'ttf', 'otf', 'eot', 'svg'];
/** 目录名命中即视为「付费字体目录」 */
const PAID_DIR_RE = /(licen|paid|收费|商用|vip)/i;

/** 把清单里写的文件名/相对路径规范成可访问的 URL（路径逐段编码，兼容空格与中文） */
export function normalizeFiles(files: Record<string, string | undefined>): Record<string, string> {
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
export function scanFontDir(root: string): { list: FontSeed[]; conflicts: string[] } {
  const groups = new Map<string, FontSeed>();
  const conflicts: string[] = [];
  loadCoverageCache(root);

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
      // 覆盖信息只算一次（取首个文件即可，同族各格式 cmap 通常一致）
      const relForCache = relSegs.map(encodeURIComponent).join('/');
      const coverage = getCoverage(root, full, relForCache);
      groups.set(stem, {
        family: stem,
        displayName: stem.replace(/[-_]+/g, ' ').trim(),
        isPaid,
        category: relSegs.length > 1 ? relSegs[0] : undefined,
        files: { [ext]: url },
        coverage,
      });
    }
  };

  walk(root);
  saveCoverageCache(root);
  return { list: [...groups.values()], conflicts };
}

/**
 * 把 fonts.json 里的元数据（displayName / category / 覆盖 isPaid / 远程 URL）合并回
 * 目录扫描结果。fonts.json 不存在或解析失败时原样返回，不影响「目录即真相」。
 */
export function applyManifest(list: FontSeed[], fontsDir: string): FontSeed[] {
  const manifestPath = join(fontsDir, 'fonts.json');
  if (!existsSync(manifestPath)) return list;
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as FontManifestEntry[];
    const byFamily = new Map(list.map((f) => [f.family, f]));
    for (const e of manifest ?? []) {
      if (!e?.family) continue;
      const s = byFamily.get(e.family);
      const files = normalizeFiles((e.files ?? {}) as Record<string, string>);
      byFamily.set(e.family, {
        family: e.family,
        displayName: e.displayName || s?.displayName || e.family,
        isPaid: e.isPaid ?? s?.isPaid ?? false,
        category: e.category ?? s?.category,
        files: Object.keys(files).length ? files : s?.files ?? {},
        coverage: s?.coverage,
      });
    }
    return [...byFamily.values()];
  } catch {
    return list;
  }
}

/** 实时目录扫描 + 合并 fonts.json 元数据，返回完整字体清单（目录即真相） */
export function buildFontCatalog(): FontSeed[] {
  const dir = resolveFontsDir();
  return applyManifest(scanFontDir(dir).list, dir);
}

/**
 * 给定作品里出现过的 fontFamily 列表，返回渲染所需 `{family, files}`。
 *
 * 直接从目录扫描取文件，不依赖 DB 的 `font` 表 —— 这样从目录增删字体后，无需手动
 * `refresh` 即可在导出渲染页正确注册 @font-face（否则新字体回退默认字体）。
 * 目录里不存在的 family（系统字体等）会被自然过滤掉。
 */
export function resolveRenderFonts(
  families: string[],
): { family: string; files: Record<string, string> }[] {
  if (!families.length) return [];
  const byFamily = new Map(buildFontCatalog().map((f) => [f.family, f]));
  const out: { family: string; files: Record<string, string> }[] = [];
  for (const fam of families) {
    const m = byFamily.get(fam);
    if (m && m.files && Object.keys(m.files).length) {
      out.push({ family: m.family, files: m.files });
    }
  }
  return out;
}
