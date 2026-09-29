/**
 * 字体目录与动态注册（@h5design/core）
 *
 * 配合「付费字体绑定付费模板」授权模型（见 docs/font-licensing-dev-doc.md）：
 * - 字体文件由服务端托管在 /uploads/fonts/，前端只认 URL；
 * - 编辑器挂载时由宿主通过 editorServices.listFonts() 拉取目录并 setFontCatalog；
 * - 渲染文本前 ensureFont() 用 FontFace API 注册，document.fonts 加载后发布态自动重排。
 */
export interface FontFiles {
  woff2?: string;
  woff?: string;
  ttf?: string;
  otf?: string;
  eot?: string;
  svg?: string;
}

/**
 * 文件扩展名 → CSS `format()` 合法关键字。
 *
 * ⚠️ 这里不能直接用扩展名：规范关键字里**没有 `ttf`**，TrueType 对应的是 `truetype`、
 * OpenType 对应 `opentype`。若写成 `format('ttf')`，浏览器判定为"不支持的格式"并
 * **整条 src 跳过**，结果就是字体文件存在、请求也发出去了，但字根本渲染不出来。
 */
const FORMAT_TOKENS: Record<string, string> = {
  woff2: 'woff2',
  woff: 'woff',
  ttf: 'truetype',
  otf: 'opentype',
  eot: 'embedded-opentype',
  svg: 'svg',
};

/** src 排列优先级：压缩率高的排前面，浏览器取第一条自己支持的 */
const FORMAT_PRIORITY = ['woff2', 'woff', 'otf', 'ttf', 'eot', 'svg'];

/**
 * 拼 `FontFace` 的 src 字符串。
 *
 * URL 一律加英文双引号：字体文件名可能含空格（如 `ALKATIP Asliya.TTF`），
 * 裸写 `url(...)` 时 CSS 会在空格处截断，导致加载失败。
 */
export function buildFontSources(files: FontFiles): string {
  const dict = files as Record<string, string | undefined>;
  const keys = Object.keys(files)
    .filter((k) => !!dict[k])
    .sort((a, b) => {
      const ia = FORMAT_PRIORITY.indexOf(a);
      const ib = FORMAT_PRIORITY.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  return keys
    .map((k) => `url("${dict[k]}") format("${FORMAT_TOKENS[k.toLowerCase()] ?? k}")`)
    .join(', ');
}

export interface FontMeta {
  id: string;
  /** 对应 schema 元素的 fontFamily 字符串 */
  family: string;
  displayName: string;
  isPaid: boolean;
  files: FontFiles;
  category?: string;
  /** 字体对维吾尔文正字法的覆盖（服务端「目录即真相」扫描产出，随 /api/fonts 下发） */
  coverage?: FontCoverage;
}

/**
 * 字体覆盖信息（与服务端 apps/server/src/console/cmap.ts 的 FontCoverage 字段对齐）。
 * - uyghur: 是否覆盖全部维吾尔文特定码位（缺任一即无法正确拼写维吾尔文）
 * - missingUyghur: 缺失的维吾尔文特定码位（十进制），供编辑器提示具体缺哪些字母
 * - ranges: 该字体真实覆盖的 unicode-range 字符串，用于 @font-face 的 unicode-range
 */
export interface FontCoverage {
  uyghur: boolean;
  missingUyghur: number[];
  ranges: string[];
  count: number;
}

/**
 * 统一的维吾尔文「补字字体」首选名（目录里真实存在、且完整覆盖维吾尔文正字法的字体）。
 * 实际回退字体会在运行时从字体目录动态解析（见 getUyghurFallbackFamily），此处仅作首选/兜底。
 */
export const UYGHUR_FALLBACK_FAMILY = 'NotoNaskhArabic-Regular';

let resolvedUyghurFallback: string | null = null;

/**
 * 从已加载的字体目录里解析「补字字体」：
 * 优先取首选名（UYGHUR_FALLBACK_FAMILY）；否则取目录中第一个 coverage.uyghur=true 的字体；
 * 再否则退回首选名字符串（即便未注册，浏览器也会用 system-ui 兜底，不会崩）。
 * 结果缓存，避免每次渲染重复遍历目录。
 */
export function getUyghurFallbackFamily(): string {
  if (resolvedUyghurFallback) return resolvedUyghurFallback;
  const cat = getFontCatalog();
  const pref = cat.find((f) => f.family === UYGHUR_FALLBACK_FAMILY);
  if (pref && pref.coverage?.uyghur) {
    resolvedUyghurFallback = pref.family;
    return resolvedUyghurFallback;
  }
  const covering = cat.find((f) => f.coverage?.uyghur);
  resolvedUyghurFallback = covering?.family ?? UYGHUR_FALLBACK_FAMILY;
  return resolvedUyghurFallback;
}

/** 维吾尔文特定码位 + 连写控制符（用于判断一段文本是否含维吾尔文） */
const UYGHUR_CODEPOINTS: number[] = [
  0x0626, 0x067e, 0x0686, 0x0698, 0x06ad, 0x06af, 0x06be, 0x06c6, 0x06c7, 0x06c8, 0x06cb,
  0x06d0, 0x06d5, 0x0649, 0x0640, 0x200c, 0x200d,
];

/** 判断文本是否包含维吾尔文字符（驱动是否启用补字回退） */
export function isUyghurText(text?: string | null): boolean {
  if (!text) return false;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined && UYGHUR_CODEPOINTS.includes(cp)) return true;
  }
  return false;
}

/**
 * 计算一段文本应使用的 CSS `font-family` 栈（DOM 与 Canvas 共用，保证两端一致）。
 *
 * 规则：
 *  - 文本不含维吾尔文 → `"原字体", 补字字体, system-ui, …`（补字字体对拉丁/中文无害，仅兜底）。
 *  - 含维吾尔文且所选字体【覆盖】uyghur → `"原字体", 补字字体, …`（原字体自身连字正确，优先用）。
 *  - 含维吾尔文且所选字体【不覆盖】uyghur → 整段交给补字字体（单一字体整形整词，
 *    保证跨浏览器一致的【正确连字】；否则各浏览器用各自系统字体补 ە，
 *    会出现 Firefox 断开 / Chrome 字形异常的差异）。
 *  - 含维吾尔文但覆盖信息暂未加载（coverage 为 undefined）→ 不贸然丢弃原字体，
 *    退回 `"原字体", 补字字体, …`，待目录就绪后再做整段回退。
 */
export function buildFontFamilyStack(
  family?: string | null,
  text?: string | null,
  coverage?: FontCoverage | null,
): string {
  const fb = `"${getUyghurFallbackFamily()}", system-ui, "Microsoft YaHei", "PingFang SC", sans-serif`;
  if (!family) return fb;
  const hasUyghur = isUyghurText(text);
  if (hasUyghur && coverage && !coverage.uyghur) {
    return fb; // 整段回退到覆盖字体，避免跨字体连字断裂
  }
  return `"${family}", ${fb}`;
}

// —— 运行时字体目录（宿主拉取后注入）——
const catalogCache = new Map<string, FontMeta>();
let catalog: FontMeta[] = [];

/**
 * 目录变更订阅。
 *
 * 目录是**异步**拉取的（`listFonts()` 走网络），而字体选择器是同步渲染的。
 * 若组件只在挂载时读一次快照，字体回来后不会重渲染 → 下拉里永远只有系统字体。
 * 因此这里提供订阅，组件用 `useSyncExternalStore` 订阅即可自动刷新。
 */
const catalogListeners = new Set<() => void>();

export function subscribeFontCatalog(cb: () => void): () => void {
  catalogListeners.add(cb);
  return () => {
    catalogListeners.delete(cb);
  };
}

function notifyCatalogChanged(): void {
  catalogListeners.forEach((cb) => {
    try {
      cb();
    } catch {
      /* 单个订阅者异常不影响其它订阅者 */
    }
  });
}

export function setFontCatalog(list: FontMeta[]): void {
  catalog = list.slice();
  catalogCache.clear();
  for (const f of catalog) catalogCache.set(f.family, f);
  notifyCatalogChanged();
}

export function getFontCatalog(): FontMeta[] {
  return catalog;
}

export function getFontMeta(family: string): FontMeta | undefined {
  return catalogCache.get(family);
}

/**
 * 字体目录异步拉取器的「宿主注入点」。
 *
 * 缩略图（SchemaThumbnail）等列表态组件本身不依赖具体 app 的 `api`，但渲染时
 * 必须用到正确的字体（否则静默回退系统字体、与编辑器/发布页不一致）。
 * 因此由宿主（web / admin）在启动时把 `() => api.fonts()` 注入到这里，
 * SchemaThumbnail 在目录为空时惰性调用它来填充目录，再按需注册本 schema 用到的字体。
 *
 * 这与 editorServices 注入 `listFonts` 同源，但针对「列表/缩略图」这种不一定打开过编辑器的场景。
 */
let fontCatalogFetcher: (() => Promise<FontMeta[]>) | undefined;

export function setFontCatalogFetcher(fn: () => Promise<FontMeta[]>): void {
  fontCatalogFetcher = fn;
}

export function getFontCatalogFetcher(): (() => Promise<FontMeta[]>) | undefined {
  return fontCatalogFetcher;
}

const fontFaceLoading = new Map<string, Promise<FontFace | null>>();

// —— 字体加载完成通知（版本号订阅）——
//
// ⚠️ 为什么不能只依赖 document.fonts 的 `loadingdone` 事件：
// `new FontFace(...).load()` 若在 face 被 add 进 FontFaceSet **之前**调用（ detached 加载），
// 浏览器不会为它派发任何 loading / loadingdone 事件（实测 Chromium 静默无事件）。
// 而「先 add 再 load」虽能让原生事件发出，但历史调用方（缩略图 / 发布页 / 导出页）
// 的重排版逻辑各自订阅事件，路径分散、极易漏。因此这里提供确定性的进程内通知：
// 任何 FontFace load 完成（成功或失败）时自增版本号并通知订阅者，
// 渲染层订阅后清空文本测量缓存并重排版，保证「字体到位 → 重新排版」闭环成立。
const fontLoadListeners = new Set<() => void>();
let fontLoadVersion = 0;

function notifyFontLoad(): void {
  fontLoadVersion += 1;
  fontLoadListeners.forEach((cb) => {
    try {
      cb();
    } catch {
      /* 单个订阅者异常不影响其它订阅者 */
    }
  });
}

/** 订阅字体加载完成通知（useSyncExternalStore 友好）。返回退订函数。 */
export function subscribeFontLoad(cb: () => void): () => void {
  fontLoadListeners.add(cb);
  return () => {
    fontLoadListeners.delete(cb);
  };
}

/** 字体加载完成通知的当前版本号（每次任意 FontFace load 完成后自增） */
export function getFontLoadVersion(): number {
  return fontLoadVersion;
}

/** 用 FontFace 注册一个字体（幂等）。浏览器外（SSR）直接返回 null。 */
export async function ensureFont(font: FontMeta): Promise<FontFace | null> {
  if (typeof document === 'undefined' || !('fonts' in document)) return null;
  if (fontFaceLoading.has(font.family)) return fontFaceLoading.get(font.family)!;
  const sources = buildFontSources(font.files);
  if (!sources) return null;
  // 给主字体面加 unicode-range：只在本字体确有字形的码位上使用它，
  // 缺失码位确定性地交给回退栈里的补字字体（消除各浏览器系统回退差异）。
  const range = font.coverage?.ranges?.length ? font.coverage.ranges.join(', ') : undefined;
  const ff = range
    ? new FontFace(font.family, sources, { unicodeRange: range })
    : new FontFace(font.family, sources);
  // 先 add 再 load：face 进入 FontFaceSet 后，原生 loadingdone 才会派发，
  // 依赖该事件的既有重排版逻辑（textLayout 清缓存 / TextElementView bump）才能工作。
  const fontSet = (document as Document & { fonts: FontFaceSet }).fonts;
  fontSet.add(ff);
  const p = ff
    .load()
    .then((f) => {
      notifyFontLoad();
      return f;
    })
    .catch(() => {
      // 加载失败：把 error 状态的 face 移出集合，避免污染字体匹配；同样通知
      // （失败也要让等待方醒来，用回退字体出一致结果，而不是永远卡在旧布局）。
      try {
        fontSet.delete(ff);
      } catch {
        /* 忽略移除失败 */
      }
      notifyFontLoad();
      return null;
    });
  fontFaceLoading.set(font.family, p);
  return p;
}

export async function ensureFontsByFamilies(families: string[]): Promise<void> {
  const set = new Set<string>(families);
  // 始终确保补字字体已注册（哪怕 schema 里没显式引用），否则含维吾尔文却缺覆盖的
  // 文本无法回退到统一字体，又退化成各浏览器系统字体 → 连字不一致复发。
  const fb = getUyghurFallbackFamily();
  if (getFontMeta(fb)) set.add(fb);
  await Promise.all(
    [...set].map((fam) => {
      const m = getFontMeta(fam);
      return m ? ensureFont(m) : null;
    }),
  );
}

/** data URL 的 MIME 类型（仅用于 @font-face 的 src，浏览器不看它做格式判定） */
const FONT_MIME: Record<string, string> = {
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
};

/** ArrayBuffer → base64（分块，避免一次性 apply 造成调用栈溢出） */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    binary += String.fromCharCode(...(slice as unknown as number[]));
  }
  return btoa(binary);
}

/** family → 已生成的 @font-face 规则（缓存，重复导出不再下载字体） */
const embedRuleCache = new Map<string, string>();

/**
 * 生成本地导出（DOM → SVG 截图）所需的 `@font-face` 内嵌 CSS。
 *
 * 为什么必须要它：本地兜底导出会把 DOM 克隆进 SVG 的 `<foreignObject>`，再把 SVG
 * 当**图片**渲染。那是独立文档，**页面里用 FontFace API 注册的字体在其中不可见**，
 * 文字会静默回退系统字体 —— 表现就是「导出后的图上所有文本都变成了默认字体」。
 * html-to-image 自带的 `getFontEmbedCSS()` 只扫描 `document.styleSheets`，同样扫不到
 * FontFace 注册的字体（这正是历史上只能用 `skipFonts: true` 的原因，而 skipFonts 会
 * 把字体彻底丢掉）。因此这里把字体文件取回来、转成 base64 data URL 写进 `@font-face`，
 * 再通过 html-to-image 的 `fontEmbedCSS` 选项注入克隆节点。
 *
 * 单个字体失败只跳过它（不抛错），不影响其余字体与整次导出。
 */
export async function buildFontEmbedCSS(families: string[]): Promise<string> {
  const set = new Set<string>(families);
  // 导出内嵌同样必须带上补字字体，否则导出图里含维吾尔文缺覆盖文本会回退系统字体、
  // 与编辑器/发布页不一致。
  const fb = getUyghurFallbackFamily();
  if (getFontMeta(fb)) set.add(fb);
  const rules = await Promise.all(
    [...set].map(async (family) => {
      const cached = embedRuleCache.get(family);
      if (cached !== undefined) return cached;
      const meta = getFontMeta(family);
      if (!meta) return '';
      const dict = meta.files as Record<string, string | undefined>;
      // 取体积/兼容性最优的一个格式即可（多写法会把导出体积翻几倍）
      const ext = FORMAT_PRIORITY.find((k) => !!dict[k]);
      if (!ext) return '';
      const url = dict[ext] as string;
      try {
        const res = await fetch(url);
        if (!res.ok) return '';
        const bytes = new Uint8Array(await res.arrayBuffer());
        const format = FORMAT_TOKENS[ext.toLowerCase()] ?? ext;
        const mime = FONT_MIME[ext.toLowerCase()] ?? 'application/octet-stream';
        // 主字体面带 unicode-range（与服务端 coverage 对齐），补字字体不带（覆盖全部）。
        const range =
          meta.coverage?.ranges?.length && family !== fb
            ? `unicode-range:${meta.coverage.ranges.join(',')};`
            : '';
        const rule =
          `@font-face{font-family:'${family}';` +
          `src:url('data:${mime};base64,${bytesToBase64(bytes)}') format('${format}');` +
          `${range}font-display:block;}`;
        embedRuleCache.set(family, rule);
        return rule;
      } catch {
        return '';
      }
    }),
  );
  return rules.filter(Boolean).join('\n');
}

/** 从任意 schema JSON 递归收集出现过的 fontFamily 值（不关心嵌套层级） */
export function collectFontFamilies(schema: unknown): string[] {
  const out = new Set<string>();
  const walk = (n: unknown): void => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    const obj = n as Record<string, unknown>;
    for (const k of Object.keys(obj)) {
      if (k === 'fontFamily') {
        const v = obj[k];
        if (typeof v === 'string' && v) out.add(v);
      } else {
        walk(obj[k]);
      }
    }
  };
  walk(schema);
  return [...out];
}

/** 在 canvas 上绘制斜向平铺水印（试用预览 / 截屏保护） */
export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  opts: { width: number; height: number; text?: string; color?: string },
): void {
  const { width, height, text = '试用预览 · 付费字体', color = 'rgba(0,0,0,0.14)' } = opts;
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const stepX = 200;
  const stepY = 120;
  for (let y = -height; y < height * 2; y += stepY) {
    for (let x = -width; x < width * 2; x += stepX) {
      ctx.translate(x, y);
      ctx.rotate((-25 * Math.PI) / 180);
      ctx.fillText(text, 0, 0);
      ctx.rotate((25 * Math.PI) / 180);
      ctx.translate(-x, -y);
    }
  }
  ctx.restore();
}
