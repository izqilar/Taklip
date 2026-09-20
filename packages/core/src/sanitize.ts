/**
 * Schema 校验消毒（双闸口共用，纯 TS、可在 Node 与浏览器复用）
 *
 * 设计目标：在「草稿闸口」（内核 onSave 前）与「发布闸口」（服务端发布端点内）
 * 各跑一遍同样的消毒逻辑，确保落到数据库 / 渲染到只读页的 schema 不含危险内容。
 *
 * 覆盖字段：
 *  - 媒体地址：image.src / video.src / video.poster / gallery.images[] / puzzle.images[]
 *  - 外链：button.link
 *  - 背景图：page.backgroundImage（注意 page.background 是「颜色」，走 parseCssColor，不在此消毒）
 *  - 富文本/外链视频嵌入代码：video.src 形如 <iframe>/<embed>/<video> 整段 → sanitizeEmbedHtml
 *
 * 纯字符串函数（safeLink/safeMedia/safeBackgroundImage）同构；
 * sanitizeEmbedHtml 在浏览器用 DOMParser 完整清洗，在 Node 用正则兜底（不依赖 DOM），
 * 两者都不会清空合法的 http(s) iframe 嵌入。
 */

import { normalizeSchema } from './schema';
import type { Project, Page, Element } from './schema';

const LINK_PROTOCOL = /^(https?:|mailto:|tel:)/i;

function isRelative(url: string): boolean {
  return url.startsWith('/') || url.startsWith('./') || url.startsWith('../');
}

/** 校验外链（按钮跳转）。返回安全 URL，否则返回空串。 */
export function safeLink(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (isRelative(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed);
    return LINK_PROTOCOL.test(u.protocol) ? trimmed : '';
  } catch {
    return '';
  }
}

/** 校验媒体地址（图片/视频）。返回安全 URL，否则返回空串。 */
export function safeMedia(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  // 相对路径（站内 /uploads）直接放行
  if (isRelative(trimmed)) return trimmed;
  // data: 媒体放行；其余 data:（如 data:text/html）属危险协议，拦截。
  if (/^data:/i.test(trimmed)) {
    return /^(data:image\/|data:video\/|data:audio\/)/i.test(trimmed) ? trimmed : '';
  }
  try {
    const u = new URL(trimmed);
    return /^(https?:)$/i.test(u.protocol) ? trimmed : '';
  } catch {
    return '';
  }
}

/**
 * 校验并清洗「背景图字段」。支持裸 URL 与已包裹的 `url(...)` 两种存储形态，
 * 统一提取内部地址 → safeMedia 校验 → 重新包成 `url(...)`。
 */
export function safeBackgroundImage(value?: string | null): string {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const m = /^url\(\s*['"]?([^'")]+)['"]?\s*\)$/i.exec(trimmed);
  const inner = (m ? m[1] : trimmed).trim();
  const safe = safeMedia(inner);
  return safe ? `url(${safe})` : '';
}

/** 判断是否为整段嵌入代码（而非纯 URL） */
export function looksLikeEmbedCode(s: string): boolean {
  return /<(iframe|embed|video|object)\b/i.test(s);
}

/**
 * 校验并清洗「外链视频嵌入代码」（<iframe>/<embed>/<video>/<object>）。
 * 仅保留白名单标签与属性，剥离 script/style、on* 事件处理器、危险协议（javascript: 等），
 * 并强制 src 必须是 http(s) 或协议相对地址。
 *
 * 浏览器：使用 DOMParser 完整清洗（保留 allow/allowfullscreen 等播放器委派）。
 * Node（无 DOM）：使用正则兜底，足以剥离危险内容且不误杀合法 http(s) 嵌入。
 * 无有效内容时返回空串。
 */
export function sanitizeEmbedHtml(html?: string | null): string {
  if (!html || typeof html !== 'string') return '';

  const hasDom =
    typeof window !== 'undefined' && typeof (window as any).DOMParser !== 'undefined';
  if (hasDom) return sanitizeEmbedHtmlBrowser(html);
  return sanitizeEmbedHtmlNode(html);
}

const EMBED_ALLOWED_TAGS = new Set([
  'iframe',
  'embed',
  'video',
  'object',
  'source',
  'div',
  'span',
  'a',
  'img',
  'br',
  'p',
]);

const EMBED_ALLOWED_ATTRS = new Set([
  'src',
  'width',
  'height',
  'frameborder',
  'allowfullscreen',
  'allow',
  'scrolling',
  'style',
  'class',
  'id',
  'title',
  'name',
  'type',
  'poster',
  'controls',
  'autoplay',
  'loop',
  'muted',
  'playsinline',
]);

/**
 * 嵌入 style 属性白名单：仅允许几何/基础呈现属性，禁止任何可改变布局层级、
 * 定位或交互的属性（position / z-index / top / left / transform 等），
 * 防止攻击者通过 style 做全屏覆盖式钓鱼（如 position:fixed;z-index:2147483647）。
 */
const EMBED_SAFE_STYLE_PROPS = new Set([
  'width', 'height', 'max-width', 'max-height', 'min-width', 'min-height',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border', 'border-width', 'border-style', 'border-color', 'border-radius',
  'background-color', 'background', 'object-fit', 'vertical-align',
  'text-align', 'font-size', 'color', 'line-height', 'display',
]);

function sanitizeStyleValue(value: string): string {
  if (!value) return '';
  const kept: string[] = [];
  for (const decl of value.split(';')) {
    const d = decl.trim();
    if (!d) continue;
    const idx = d.indexOf(':');
    if (idx <= 0) continue;
    const prop = d.slice(0, idx).trim().toLowerCase();
    if (!EMBED_SAFE_STYLE_PROPS.has(prop)) continue;
    kept.push(d);
  }
  return kept.join('; ');
}

function sanitizeEmbedHtmlBrowser(html: string): string {
  const doc = new window.DOMParser().parseFromString(html, 'text/html');

  const walk = (root: globalThis.Element) => {
    const children = Array.from(root.children);
    for (const child of children) {
      const tag = child.tagName.toLowerCase();
      if (!EMBED_ALLOWED_TAGS.has(tag) || tag === 'script' || tag === 'style') {
        child.remove();
        continue;
      }
      for (const attr of Array.from(child.attributes)) {
        const name = attr.name.toLowerCase();
        const val = attr.value.trim();
        const safeAttr = EMBED_ALLOWED_ATTRS.has(name) || name.startsWith('data-');
        if (!safeAttr) {
          child.removeAttribute(attr.name);
          continue;
        }
        if (name === 'style') {
          const cleaned = sanitizeStyleValue(val);
          if (cleaned) child.setAttribute('style', cleaned);
          else child.removeAttribute('style');
          continue;
        }
        const safeVal = !/^\s*javascript:/i.test(val);
        if (!safeVal) {
          child.removeAttribute(attr.name);
        }
      }
      const src = child.getAttribute('src');
      if (src && !/^(https?:|\/\/)/i.test(src.trim())) {
        child.remove();
        continue;
      }
      if (tag === 'iframe' || tag === 'embed' || tag === 'video') {
        if (!child.hasAttribute('allowfullscreen')) {
          child.setAttribute('allowfullscreen', 'true');
        }
        const allow = (child.getAttribute('allow') || '')
          .split(';')
          .map((s: string) => s.trim())
          .filter(Boolean);
        for (const need of ['autoplay', 'encrypted-media', 'fullscreen', 'picture-in-picture', 'microphone']) {
          if (!allow.includes(need)) allow.push(need);
        }
        child.setAttribute('allow', allow.join('; '));
      }
      walk(child);
    }
  };
  walk(doc.body);
  return doc.body.innerHTML.trim();
}

function sanitizeEmbedHtmlNode(html: string): string {
  let s = html;
  // 1) 移除 <script>/<style> 整块
  s = s.replace(/<\s*(?:script|style)[\s\S]*?<\s*\/\s*(?:script|style)\s*>/gi, '');
  // 2) 移除 on* 事件属性
  s = s.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // 3) 移除值含 javascript: 的属性，以及 srcdoc（可内联脚本，XSS 高危）
  s = s.replace(/\s+[a-z-]+\s*=\s*("[^"]*javascript:[^"]*"|'[^']*javascript:[^']*')/gi, '');
  s = s.replace(/\s+srcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // 4) 移除不在白名单内的标签（保留白名单标签与其文本子节点）
  const ALLOWED = 'iframe|embed|video|object|source|div|span|a|img|br|p';
  s = s.replace(new RegExp(`<\\s*\\/?\\s*(?!(?:${ALLOWED})\\b)[a-z][a-z0-9]*`, 'gi'), '');
  // 5) iframe/embed/object 为叶子嵌入（无有意义子节点）：src/data 非法或缺失则整体移除（含内容+闭合标签）。
  //    注意：必须连同闭合标签一起删除，否则会残留孤儿 </iframe>。
  const LEAF_MEDIA = ['iframe', 'embed', 'object'];
  const leafRe = new RegExp(`<\\s*(${LEAF_MEDIA.join('|')})\\b[^>]*>(?:[\\s\\S]*?<\\/\\s*\\1\\s*>)?`, 'gi');
  s = s.replace(leafRe, (m, tag: string) => {
    const getAttr = (name: string) => {
      const am = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(m);
      return am ? (am[2] ?? am[3] ?? '').trim() : '';
    };
    const val = getAttr('src') || getAttr('data');
    return val && /^(https?:|\/\/)/i.test(val) ? m : '';
  });
  // 6) video 可能用 <source> 子节点承载资源：src 非法则仅去掉 video 标签，保留子节点（避免误杀合法视频）。
  // 6.5) 清理 style 属性中的危险声明（position / z-index / top / left / transform 等），
  //      防止通过 style 做全屏覆盖式钓鱼（仅处理双引号/单引号包裹的 style）。
  s = s.replace(/\sstyle\s*=\s*("([^"]*)"|'([^']*)')/gi, (_m: string, _q: string, dq: string, sq: string) => {
    const cleaned = sanitizeStyleValue(dq ?? sq ?? '');
    return cleaned ? ` style="${cleaned}"` : '';
  });
  const videoRe = /<\s*video\b[^>]*>([\s\S]*?)<\/\s*video\s*>/gi;
  s = s.replace(videoRe, (m, inner: string) => {
    const sm = /src\s*=\s*("([^"]*)"|'([^']*)')/i.exec(m);
    const src = sm ? (sm[2] ?? sm[3] ?? '').trim() : '';
    return src && /^(https?:|\/\/)/i.test(src) ? m : inner;
  });
  return s.trim();
}

/** 消毒单个元素（按类型处理媒体/外链/嵌入代码字段） */
function sanitizeElement(el: Element): Element {
  switch (el.type) {
    case 'image':
      return { ...el, src: safeMedia(el.src) };
    case 'video': {
      const raw = el.src || '';
      const src = looksLikeEmbedCode(raw) ? sanitizeEmbedHtml(raw) : safeMedia(raw);
      return {
        ...el,
        src,
        poster: el.poster ? safeMedia(el.poster) : el.poster,
      };
    }
    case 'button':
      return { ...el, link: el.link ? safeLink(el.link) : el.link };
    case 'gallery':
      return {
        ...el,
        images: Array.isArray(el.images) ? el.images.map(safeMedia) : [],
      };
    case 'puzzle':
      return {
        ...el,
        images: Array.isArray(el.images) ? el.images.map(safeMedia) : [],
      };
    default:
      return el;
  }
}

/** 消毒单个页面（backgroundImage 走安全校验；background 是颜色，不在此处理）
 *
 * ⚠️ backgroundImage 存储规范 = 裸 URL（如 /uploads/xxx.png）。
 * 编辑器画布 <img src> 和设置面板直接消费裸 URL；
 * 渲染层（SchemaRenderer / PublishedH5）在渲染时通过 safeBackgroundImage() 自行包裹为 url(...) 用于 CSS。
 * 因此此处只做安全校验 + 提取裸 URL，不做 url() 包裹。
 */
function sanitizePage(page: Page): Page {
  const elements = Array.isArray(page.elements)
    ? page.elements.map(sanitizeElement).filter(Boolean as unknown as (e: Element) => boolean)
    : [];
  // 提取 backgroundImage 的裸 URL（兼容已存储的 url(...) 形式）
  let bgImg = page.backgroundImage;
  if (bgImg && typeof bgImg === 'string') {
    const trimmed = bgImg.trim();
    if (trimmed) {
      const m = /^url\(\s*['"]?([^'")]+)['"]?\s*\)$/i.exec(trimmed);
      const inner = (m ? m[1] : trimmed).trim();
      bgImg = safeMedia(inner) || undefined; // 存裸 URL 或 undefined
    } else {
      bgImg = undefined;
    }
  }
  return {
    ...page,
    backgroundImage: bgImg,
    elements,
  };
}

/**
 * 消毒整份 Project schema：遍历所有页面与元素，对媒体/外链/嵌入代码字段做安全校验，
 * 并返回一份新的（深拷贝）Project，不修改入参。顶层结构经 normalizeSchema 兜底归一。
 */
export function sanitizeSchema(
  input: Project | Partial<Project> | null | undefined,
): Project {
  const p = (input ?? {}) as Partial<Project>;
  const pages = Array.isArray(p.pages)
    ? (p.pages.map(sanitizePage).filter(Boolean as unknown as (e: Page) => boolean) as Page[])
    : [];
  return normalizeSchema({ ...(p as Record<string, unknown>), pages });
}
